import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { environments, resolveConfig, type EnvironmentConfig } from "../config/environments";
import { buildStacks } from "../lib/build-stacks";

/* These tests build the stacks in memory and check the CloudFormation templates.
   They need no AWS account and create nothing. Run them with: pnpm test */

type Json = Record<string, any>;

const cdkJson = JSON.parse(readFileSync(path.join(__dirname, "..", "cdk.json"), "utf8")) as { context: Json };

/** Builds every stack of an environment and returns its templates. */
function synth(config: EnvironmentConfig, options: { githubRepo?: string } = {}) {
  const app = new App({
    outdir: mkdtempSync(path.join(tmpdir(), "namma-trails-cdk-")),
    // The same feature flags as a real deploy (cdk.json), but without copying the whole
    // repository for the Docker images in every test.
    context: { ...cdkJson.context, "aws:cdk:disable-asset-staging": true },
  });
  const stacks = buildStacks(app, config, { account: "111111111111", ...options });
  return {
    network: Template.fromStack(stacks.network),
    data: Template.fromStack(stacks.data),
    app: Template.fromStack(stacks.application),
    edge: stacks.edgeCertificate ? Template.fromStack(stacks.edgeCertificate) : undefined,
    github: stacks.githubDeployRole ? Template.fromStack(stacks.githubDeployRole) : undefined,
  };
}

const demo = synth(resolveConfig("demo"));
const production = synth(
  resolveConfig("production", {
    alarmEmail: "ops@example.com",
    monthlyBudgetUsd: "250",
    domainName: "example.com",
    hostedZoneId: "Z0000000EXAMPLE",
  }),
);

const resources = (template: Template, type: string) => Object.values(template.findResources(type)) as Json[];

/** The containers of the task definition that has a container with this name. */
function containersOfTaskWith(template: Template, containerName: string): Json[] {
  const task = resources(template, "AWS::ECS::TaskDefinition").find((t) => (t.Properties.ContainerDefinitions as Json[]).some((c) => c.Name === containerName));
  assert.ok(task, `no task definition has a container called ${containerName}`);
  return task.Properties.ContainerDefinitions as Json[];
}
const container = (template: Template, name: string): Json => {
  const found = containersOfTaskWith(template, name).find((c) => c.Name === name);
  assert.ok(found);
  return found;
};
const settingsOf = (c: Json): Json => Object.fromEntries((c.Environment as Json[]).map((e) => [e.Name, e.Value]));

test("demo: no NAT gateway, only public and isolated subnets", () => {
  demo.network.resourceCountIs("AWS::EC2::NatGateway", 0);
  demo.network.resourceCountIs("AWS::EC2::Subnet", 4);
});

test("the load balancer is private and no rule lets the whole internet in", () => {
  for (const env of [demo, production]) {
    env.app.hasResourceProperties("AWS::ElasticLoadBalancingV2::LoadBalancer", { Scheme: "internal", Type: "application" });
    for (const rule of resources(env.network, "AWS::EC2::SecurityGroupIngress")) {
      assert.notEqual(rule.Properties.CidrIp, "0.0.0.0/0");
    }
    for (const group of resources(env.network, "AWS::EC2::SecurityGroup")) {
      for (const rule of (group.Properties.SecurityGroupIngress ?? []) as Json[]) assert.notEqual(rule.CidrIp, "0.0.0.0/0");
    }
    env.app.resourceCountIs("AWS::EC2::SecurityGroup", 0);
  }
});

test("the database is private, encrypted, and its disk grows by itself", () => {
  demo.data.hasResourceProperties("AWS::RDS::DBInstance", {
    Engine: "postgres",
    DBInstanceClass: "db.t4g.micro",
    PubliclyAccessible: false,
    StorageEncrypted: true,
    AllocatedStorage: "20",
    MaxAllocatedStorage: 50,
    MultiAZ: false,
    DeletionProtection: false,
  });
  production.data.hasResourceProperties("AWS::RDS::DBInstance", {
    DBInstanceClass: "db.t4g.small",
    PubliclyAccessible: false,
    StorageEncrypted: true,
    MaxAllocatedStorage: 200,
    MultiAZ: true,
    DeletionProtection: true,
  });
  production.data.hasResource("AWS::RDS::DBInstance", { DeletionPolicy: "Snapshot" });
});

test("buckets block all public access", () => {
  demo.data.resourceCountIs("AWS::S3::Bucket", 2);
  demo.data.allResourcesProperties("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
  });
});

test("demo: both services run on Fargate Spot and roll back a bad release", () => {
  demo.app.resourceCountIs("AWS::ECS::Service", 2);
  demo.app.allResourcesProperties("AWS::ECS::Service", {
    CapacityProviderStrategy: [{ CapacityProvider: "FARGATE_SPOT", Weight: 1 }],
    DeploymentConfiguration: Match.objectLike({ DeploymentCircuitBreaker: { Enable: true, Rollback: true }, MinimumHealthyPercent: 100, MaximumPercent: 200 }),
    NetworkConfiguration: { AwsvpcConfiguration: Match.objectLike({ AssignPublicIp: "ENABLED" }) },
  });
});

test("production: the first task of each service is on-demand, the rest on Spot", () => {
  production.app.allResourcesProperties("AWS::ECS::Service", {
    CapacityProviderStrategy: [
      { CapacityProvider: "FARGATE", Base: 1, Weight: 0 },
      { CapacityProvider: "FARGATE_SPOT", Weight: 1 },
    ],
  });
});

test("auto scaling: limits from the config, on CPU and on requests per task", () => {
  demo.app.resourceCountIs("AWS::ApplicationAutoScaling::ScalableTarget", 2);
  demo.app.allResourcesProperties("AWS::ApplicationAutoScaling::ScalableTarget", { MinCapacity: 1, MaxCapacity: 3, ScalableDimension: "ecs:service:DesiredCount" });
  production.app.allResourcesProperties("AWS::ApplicationAutoScaling::ScalableTarget", { MinCapacity: 2, MaxCapacity: 8 });

  const policies = resources(demo.app, "AWS::ApplicationAutoScaling::ScalingPolicy");
  const metrics = policies.map((p) => p.Properties.TargetTrackingScalingPolicyConfiguration.PredefinedMetricSpecification.PredefinedMetricType as string).sort();
  assert.deepEqual(metrics, ["ALBRequestCountPerTarget", "ALBRequestCountPerTarget", "ECSServiceAverageCPUUtilization", "ECSServiceAverageCPUUtilization"]);
  for (const policy of policies) {
    const tracking = policy.Properties.TargetTrackingScalingPolicyConfiguration;
    assert.equal(policy.Properties.PolicyType, "TargetTrackingScaling");
    assert.equal(tracking.ScaleOutCooldown, 60);
    assert.equal(tracking.ScaleInCooldown, 300);
  }
});

test("the API task migrates the database first, and gets its settings and secrets", () => {
  const migrate = container(demo.app, "migrate");
  const api = container(demo.app, "api");
  assert.equal(migrate.Essential, false);
  assert.deepEqual(migrate.Command, ["node_modules/.bin/prisma", "migrate", "deploy"]);
  assert.deepEqual(api.DependsOn, [{ Condition: "SUCCESS", ContainerName: "migrate" }]);

  const settings = settingsOf(api);
  assert.equal(settings.NODE_ENV, "development");
  assert.equal(settings.TRUST_PROXY_HOPS, "2");
  assert.equal(settings.MESSAGING_PROVIDER, "console");
  assert.equal(settings.PAYMENT_PROVIDER, "mock");
  assert.equal(settings.DEMO_DATA_ENABLED, "true");
  assert.ok(!("REDIS_URL" in settings));

  // Secrets come from Secrets Manager, never as plain settings.
  const secretNames = (api.Secrets as Json[]).map((s) => s.Name as string).sort();
  assert.deepEqual(secretNames, ["DB_HOST", "DB_NAME", "DB_PASSWORD", "DB_PORT", "DB_USERNAME", "JWT_ACCESS_SECRET", "OTP_PEPPER"]);
  for (const name of Object.keys(settings)) assert.ok(!/SECRET|PASSWORD|PEPPER/.test(name), `${name} must be a secret`);

  assert.equal(settingsOf(container(production.app, "api")).NODE_ENV, "production");
});

test("routing: /api and /health go to the API; helper pages are blocked in the demo", () => {
  const rules = resources(demo.app, "AWS::ElasticLoadBalancingV2::ListenerRule");
  const byPriority: Json = Object.fromEntries(rules.map((r) => [r.Properties.Priority, r.Properties]));
  assert.deepEqual(byPriority[5].Conditions[0].PathPatternConfig.Values, environments.demo?.blockedPaths);
  assert.equal(byPriority[5].Actions[0].FixedResponseConfig.StatusCode, "404");
  assert.deepEqual(byPriority[10].Conditions[0].PathPatternConfig.Values, ["/api/*", "/health", "/health/*"]);
  assert.equal(byPriority[10].Actions[0].Type, "forward");

  demo.app.hasResourceProperties("AWS::ElasticLoadBalancingV2::Listener", { Port: 80, DefaultActions: [Match.objectLike({ Type: "forward" })] });
  demo.app.hasResourceProperties("AWS::ElasticLoadBalancingV2::TargetGroup", { HealthCheckPath: "/health/ready", Port: 4000, TargetType: "ip" });
  demo.app.hasResourceProperties("AWS::ElasticLoadBalancingV2::TargetGroup", { HealthCheckPath: "/robots.txt", Port: 3000, TargetType: "ip" });
  // Production blocks nothing: those helper pages do not exist in production mode.
  production.app.resourceCountIs("AWS::ElasticLoadBalancingV2::ListenerRule", 1);
});

test("CloudFront: HTTPS only, pages never cached, build files cached", () => {
  const [distribution] = resources(demo.app, "AWS::CloudFront::Distribution");
  assert.ok(distribution);
  const config: Json = distribution.Properties.DistributionConfig;
  // Ids of the AWS managed cache policies.
  const CACHING_DISABLED = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad";
  const CACHING_OPTIMIZED = "658327ea-f89d-4fab-a63d-7e88639e58f6";
  assert.equal(config.DefaultCacheBehavior.ViewerProtocolPolicy, "redirect-to-https");
  assert.equal(config.DefaultCacheBehavior.CachePolicyId, CACHING_DISABLED);
  assert.equal(config.DefaultCacheBehavior.AllowedMethods.length, 7);
  const staticFiles = (config.CacheBehaviors as Json[]).find((b) => b.PathPattern === "/_next/static/*");
  assert.equal(staticFiles?.CachePolicyId, CACHING_OPTIMIZED);
  assert.equal(config.Origins.length, 1);
  assert.ok(config.Origins[0].VpcOriginConfig, "the origin must be a VPC origin");
  demo.app.hasResourceProperties("AWS::CloudFront::VpcOrigin", { VpcOriginEndpointConfig: Match.objectLike({ OriginProtocolPolicy: "http-only", HTTPPort: 80 }) });
  assert.equal(config.Aliases, undefined);
});

test("demo keeps the bill small: no firewall, no alarms, no cache, no certificate stack", () => {
  demo.app.resourceCountIs("AWS::WAFv2::WebACL", 0);
  demo.app.resourceCountIs("AWS::CloudWatch::Alarm", 0);
  demo.data.resourceCountIs("AWS::ElastiCache::ServerlessCache", 0);
  assert.equal(demo.edge, undefined);
});

test("production: firewall, alarms, budget, own domain with certificate", () => {
  production.app.resourceCountIs("AWS::WAFv2::WebACL", 1);
  production.app.resourceCountIs("AWS::WAFv2::WebACLAssociation", 1);
  production.app.resourceCountIs("AWS::CloudWatch::Alarm", 9);
  production.app.hasResourceProperties("AWS::SNS::Subscription", { Protocol: "email", Endpoint: "ops@example.com" });
  production.app.hasResourceProperties("AWS::Budgets::Budget", { Budget: Match.objectLike({ BudgetLimit: { Amount: 250, Unit: "USD" }, TimeUnit: "MONTHLY" }) });
  production.app.hasResourceProperties("AWS::CloudFront::Distribution", { DistributionConfig: Match.objectLike({ Aliases: ["example.com"] }) });
  production.app.resourceCountIs("AWS::Route53::RecordSet", 2);
  assert.ok(production.edge);
  production.edge.hasResourceProperties("AWS::CertificateManager::Certificate", { DomainName: "example.com", ValidationMethod: "DNS" });
});

test("switches: Redis, NAT gateway and the nightly stop", () => {
  const withExtras = synth({
    ...resolveConfig("demo"),
    redis: true,
    natGateways: 1,
    nightlyStop: { stopAtUtc: { hour: 17, minute: 30 }, startAtUtc: { hour: 1, minute: 30 } },
  });
  withExtras.data.hasResourceProperties("AWS::ElastiCache::ServerlessCache", { Engine: "valkey" });
  assert.ok("REDIS_URL" in settingsOf(container(withExtras.app, "api")));
  withExtras.network.resourceCountIs("AWS::EC2::NatGateway", 1);
  withExtras.network.resourceCountIs("AWS::EC2::Subnet", 6);
  withExtras.app.allResourcesProperties("AWS::ECS::Service", { NetworkConfiguration: { AwsvpcConfiguration: Match.objectLike({ AssignPublicIp: "DISABLED" }) } });
  withExtras.app.allResourcesProperties("AWS::ApplicationAutoScaling::ScalableTarget", {
    ScheduledActions: [
      Match.objectLike({ Schedule: "cron(30 17 * * ? *)", ScalableTargetAction: { MinCapacity: 0, MaxCapacity: 0 } }),
      Match.objectLike({ Schedule: "cron(30 1 * * ? *)", ScalableTargetAction: { MinCapacity: 1, MaxCapacity: 3 } }),
    ],
  });
});

test("the GitHub deploy role only trusts the named repository", () => {
  const { github } = synth(resolveConfig("demo"), { githubRepo: "some-owner/some-repo" });
  assert.ok(github);
  const role = resources(github, "AWS::IAM::Role").find((r) => r.Properties.RoleName === "namma-trails-github-deploy");
  assert.ok(role);
  const statement = role.Properties.AssumeRolePolicyDocument.Statement[0];
  assert.equal(statement.Action, "sts:AssumeRoleWithWebIdentity");
  assert.equal(statement.Condition.StringLike["token.actions.githubusercontent.com:sub"], "repo:some-owner/some-repo:*");
});

test("a wrong setting is refused with a clear message", () => {
  assert.throws(() => resolveConfig("staging"), /Unknown environment/);
  assert.throws(() => resolveConfig("demo", { siteUrl: "http://not-https.example" }), /siteUrl must look like/);
  assert.throws(() => resolveConfig("demo", { domainName: "example.com" }), /hostedZoneId/);
});

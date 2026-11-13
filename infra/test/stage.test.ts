import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { resolveStageConfig, type StageConfig } from "../config/stage";
import { StageStack } from "../lib/stage-stack";

/* The stage environment: one small server, switched on and off. These tests build the
   stack in memory and check the template. They need no AWS account and create nothing. */

type Json = Record<string, any>;
const cdkJson = JSON.parse(readFileSync(path.join(__dirname, "..", "cdk.json"), "utf8")) as { context: Json };

function synth(config: StageConfig) {
  const app = new App({ outdir: mkdtempSync(path.join(tmpdir(), "namma-trails-stage-")), context: { ...cdkJson.context, "aws:cdk:disable-asset-staging": true } });
  return Template.fromStack(new StageStack(app, "NammaTrails-Stage", { env: { account: "111111111111", region: config.region }, config }));
}
const stage = synth(resolveStageConfig());
const resources = (template: Template, type: string) => Object.values(template.findResources(type)) as Json[];

test("stage has nothing that bills by the hour while the server is off", () => {
  for (const type of [
    "AWS::EC2::NatGateway",
    "AWS::ElasticLoadBalancingV2::LoadBalancer",
    "AWS::RDS::DBInstance",
    "AWS::ECS::Service",
    "AWS::ElastiCache::ServerlessCache",
    "AWS::SecretsManager::Secret",
    "AWS::DynamoDB::Table",
    "AWS::WAFv2::WebACL",
    "AWS::CloudWatch::Alarm",
    "AWS::CloudWatch::Dashboard",
    "AWS::Backup::BackupPlan",
  ]) {
    stage.resourceCountIs(type, 0);
  }
});

test("stage is one small server with an encrypted disk and a fixed address", () => {
  stage.resourceCountIs("AWS::EC2::Instance", 1);
  stage.hasResourceProperties("AWS::EC2::Instance", {
    InstanceType: "t3.small",
    BlockDeviceMappings: [{ DeviceName: "/dev/xvda", Ebs: { VolumeSize: 16, VolumeType: "gp3", Encrypted: true } }],
  });
  stage.resourceCountIs("AWS::EC2::EIP", 1);
  stage.resourceCountIs("AWS::EC2::EIPAssociation", 1);
  stage.resourceCountIs("AWS::EC2::Subnet", 1);
  // The server only accepts the newer, safer way of reading its own metadata.
  stage.hasResourceProperties("AWS::EC2::LaunchTemplate", { LaunchTemplateData: { MetadataOptions: { HttpTokens: "required" } } });
});

test("only CloudFront can reach the server, on the two app ports, and there is no SSH", () => {
  const rules = [
    ...resources(stage, "AWS::EC2::SecurityGroupIngress").map((r) => r.Properties),
    ...resources(stage, "AWS::EC2::SecurityGroup").flatMap((g) => (g.Properties.SecurityGroupIngress ?? []) as Json[]),
  ];
  assert.equal(rules.length, 1);
  const [rule] = rules;
  assert.ok(rule!.SourcePrefixListId, "the only way in must be the CloudFront address list");
  assert.equal(rule!.CidrIp, undefined);
  assert.deepEqual([rule!.FromPort, rule!.ToPort], [3000, 4000]);
  assert.ok(!JSON.stringify(stage.toJSON()).includes('"FromPort":22'));
});

test("CloudFront sends /api and /health to the API port and everything else to the website", () => {
  const [distribution] = resources(stage, "AWS::CloudFront::Distribution");
  const config: Json = distribution!.Properties.DistributionConfig;
  const portOf = (originId: string) => (config.Origins as Json[]).find((o) => o.Id === originId)?.CustomOriginConfig.HTTPPort;
  assert.equal(portOf(config.DefaultCacheBehavior.TargetOriginId), 3000);
  assert.equal(config.DefaultCacheBehavior.ViewerProtocolPolicy, "redirect-to-https");
  const behaviour = (pattern: string) => (config.CacheBehaviors as Json[]).find((b) => b.PathPattern === pattern);
  for (const pattern of ["/api/*", "/health", "/health/*"]) assert.equal(portOf(behaviour(pattern)?.TargetOriginId), 4000, pattern);
  assert.equal(portOf(behaviour("/_next/static/*")?.TargetOriginId), 3000);
  for (const origin of config.Origins as Json[]) assert.equal(origin.CustomOriginConfig.OriginProtocolPolicy, "http-only");

  // The helper pages of the API are answered with 404 at the edge.
  assert.equal(behaviour("/api/*")?.FunctionAssociations?.[0]?.EventType, "viewer-request");
  const [fn] = resources(stage, "AWS::CloudFront::Function");
  assert.match(fn!.Properties.FunctionCode, /\/api\/v1\/dev/);
  assert.match(fn!.Properties.FunctionCode, /statusCode: 404/);

  const open = synth({ ...resolveStageConfig(), blockedPaths: [] });
  open.resourceCountIs("AWS::CloudFront::Function", 0);
});

test("the server reads its version and address from Parameter Store, and may read nothing else of ours", () => {
  const names = resources(stage, "AWS::SSM::Parameter").map((p) => p.Properties.Name as string).sort();
  assert.deepEqual(names, ["/namma-trails/stage/api-image", "/namma-trails/stage/demo-data", "/namma-trails/stage/site-url", "/namma-trails/stage/web-image"]);
  const role = resources(stage, "AWS::IAM::Role").find((r) => JSON.stringify(r.Properties.AssumeRolePolicyDocument).includes("ec2.amazonaws.com"));
  assert.ok(role);
  assert.match(JSON.stringify(role.Properties.ManagedPolicyArns), /AmazonSSMManagedInstanceCore/);
  const actions = resources(stage, "AWS::IAM::Policy")
    .filter((p) => JSON.stringify(p.Properties.Roles).includes("ServerRole"))
    .flatMap((p) => (p.Properties.PolicyDocument.Statement as Json[]).flatMap((s) => s.Action as string | string[]));
  assert.ok(actions.length > 0);
  for (const action of actions) assert.match(action, /^(ecr:|ssm:(DescribeParameters|GetParameter|GetParameters|GetParameterHistory)$)/, action);
});

test("the start-up script is put on the server unchanged, with Unix line ends", () => {
  const [server] = resources(stage, "AWS::EC2::Instance");
  const userData = JSON.stringify(server!.Properties.UserData);
  assert.ok(!userData.includes("\\r"), "Windows line ends would break the script on the server");
  for (const part of ["dnf install -y docker", "/opt/namma/boot.sh", "namma-stage.service", "prisma migrate deploy", "systemctl enable namma-stage.service"]) {
    assert.ok(userData.includes(part), `user data misses: ${part}`);
  }
});

test("a schedule stops the server every night", () => {
  stage.hasResourceProperties("AWS::Scheduler::Schedule", {
    ScheduleExpression: "cron(30 18 * * ? *)",
    ScheduleExpressionTimezone: "UTC",
    Target: Match.objectLike({ Arn: "arn:aws:scheduler:::aws-sdk:ec2:stopInstances" }),
  });
  const stopRole = resources(stage, "AWS::IAM::Policy").find((p) => JSON.stringify(p.Properties.PolicyDocument).includes("ec2:StopInstances"));
  assert.ok(stopRole);
  const [statement] = stopRole.Properties.PolicyDocument.Statement as Json[];
  assert.equal(statement!.Action, "ec2:StopInstances");
  assert.match(JSON.stringify(statement!.Resource), /:instance\//);

  synth({ ...resolveStageConfig(), autoStopAtUtc: undefined }).resourceCountIs("AWS::Scheduler::Schedule", 0);
});

test("the budget warning is optional and wrong settings are refused", () => {
  stage.resourceCountIs("AWS::Budgets::Budget", 0);
  synth(resolveStageConfig({ alarmEmail: "me@example.com", monthlyBudgetUsd: "10" })).hasResourceProperties("AWS::Budgets::Budget", {
    Budget: Match.objectLike({ BudgetLimit: { Amount: 10, Unit: "USD" } }),
  });
  assert.throws(() => resolveStageConfig({ monthlyBudgetUsd: "10" }), /needs alarmEmail/);
  assert.throws(() => resolveStageConfig({ siteUrl: "http://plain.example" }), /siteUrl must look like/);
});

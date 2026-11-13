import * as path from "node:path";
import { Annotations, CfnOutput, DockerBuildSecret, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import type { Construct } from "constructs";
import { knownSiteUrl, type EnvironmentConfig } from "../config/environments";
import type { DataStack } from "./data-stack";
import { API_PORT, WEB_PORT, type NetworkStack } from "./network-stack";
import { ScalingService } from "./scaling-service";

export interface AppStackProps extends StackProps {
  config: EnvironmentConfig;
  network: NetworkStack;
  data: DataStack;
  /** Certificate for CloudFront. Only with a custom domain; it must live in us-east-1. */
  edgeCertificate?: acm.ICertificate;
}

const LOG_RETENTION: Record<EnvironmentConfig["logRetentionDays"], logs.RetentionDays> = {
  7: logs.RetentionDays.ONE_WEEK,
  14: logs.RetentionDays.TWO_WEEKS,
  30: logs.RetentionDays.ONE_MONTH,
  90: logs.RetentionDays.THREE_MONTHS,
};

/** Shown in the web image when the site address is not known yet (first deploy without a domain). */
const PLACEHOLDER_SITE_URL = "https://site-url-not-set.invalid";

/**
 * The running app:
 *
 *   visitor -> CloudFront -> load balancer -> web service (Next.js)
 *                                          -> API service (NestJS) -> database
 *
 * One address serves both: paths that start with /api (and /health) go to the API,
 * everything else goes to the web app. Both services scale by themselves.
 */
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const { config, network, data } = props;
    const prefix = `namma-trails-${config.name}`;
    const repoRoot = path.join(__dirname, "..", "..");
    const arm = config.cpuArchitecture === "ARM64";
    const runtimePlatform: ecs.RuntimePlatform = {
      cpuArchitecture: arm ? ecs.CpuArchitecture.ARM64 : ecs.CpuArchitecture.X86_64,
      operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
    };
    const imagePlatform = arm ? Platform.LINUX_ARM64 : Platform.LINUX_AMD64;
    const logRetention = LOG_RETENTION[config.logRetentionDays];

    // On a company network that inspects HTTPS, the image builds must trust the company's
    // root certificate to download packages and fonts. If NODE_EXTRA_CA_CERTS points at
    // that certificate, it is handed to the builds as a secret (it is not kept in the image,
    // and it does not change the image's fingerprint).
    const extraCa = process.env.NODE_EXTRA_CA_CERTS;
    const buildTrust = extraCa
      ? { buildSecrets: { extra_ca: DockerBuildSecret.fromSrc(path.resolve(extraCa)) }, invalidation: { buildSecrets: false } }
      : {};

    // ── Cluster ──────────────────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc: network.vpc,
      enableFargateCapacityProviders: true,
      containerInsightsV2: config.containerInsights ? ecs.ContainerInsights.ENABLED : ecs.ContainerInsights.DISABLED,
    });

    // ── Load balancer ────────────────────────────────────────────────────────
    // Internal: it has no public address. Only CloudFront can reach it.
    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc: network.vpc,
      internetFacing: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroup: network.loadBalancerSecurityGroup,
      idleTimeout: Duration.seconds(60),
      dropInvalidHeaderFields: true,
    });
    // open: false = do not add an "anyone may connect" rule; the network stack has the rules.
    const listener = loadBalancer.addListener("Http", { port: 80, protocol: elbv2.ApplicationProtocol.HTTP, open: false });

    if (config.blockedPaths.length > 0) {
      listener.addAction("BlockedPaths", {
        priority: 5,
        conditions: [elbv2.ListenerCondition.pathPatterns(config.blockedPaths)],
        action: elbv2.ListenerAction.fixedResponse(404, { contentType: "text/plain", messageBody: "Not found" }),
      });
    }

    // ── CloudFront ───────────────────────────────────────────────────────────
    // Gives HTTPS, a fast edge near the visitor, and caching of files that never change.
    const origin = origins.VpcOrigin.withApplicationLoadBalancer(loadBalancer, {
      vpcOriginName: prefix,
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 80,
      readTimeout: Duration.seconds(30),
      keepaliveTimeout: Duration.seconds(60),
    });
    const forwardEverything = {
      origin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      // The app must see the visitor's own host name, cookies and query string.
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      compress: true,
    };
    const domainNames = config.domain ? [config.domain.name, ...(config.domain.alternateNames ?? [])] : undefined;
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `Namma Trails (${config.name})`,
      // Pages and API calls are never cached here, so a new version shows at once and
      // nobody can ever be served another person's page.
      defaultBehavior: {
        ...forwardEverything,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      additionalBehaviors: {
        // Build files have a fingerprint in their name and never change: cache them for a long time.
        "/_next/static/*": { ...forwardEverything, cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED },
        // Resized pictures: cached as long as the app says, one copy per size and quality.
        "/_next/image*": { ...forwardEverything, cachePolicy: cloudfront.CachePolicy.USE_ORIGIN_CACHE_CONTROL_HEADERS_QUERY_STRINGS },
      },
      domainNames,
      certificate: props.edgeCertificate,
      // Only has an effect with your own certificate; the free cloudfront.net address has a fixed policy.
      ...(props.edgeCertificate ? { minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021 } : {}),
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // Price class 200 includes the edge locations in India.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
    });

    if (config.domain) {
      const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
        hostedZoneId: config.domain.hostedZoneId,
        zoneName: config.domain.hostedZoneName,
      });
      const target = route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution));
      (domainNames ?? []).forEach((name, index) => {
        new route53.ARecord(this, `AliasA${index}`, { zone, recordName: name, target });
        new route53.AaaaRecord(this, `AliasAaaa${index}`, { zone, recordName: name, target });
      });
    }

    // The public address. At run time it is always right (the API uses it for CORS).
    const siteUrl = config.domain ? `https://${config.domain.name}` : `https://${distribution.distributionDomainName}`;
    // The web image needs the address as plain text when it is built.
    const buildSiteUrl = knownSiteUrl(config);
    if (!buildSiteUrl) {
      Annotations.of(this).addWarning(
        "No domain and no siteUrl yet: the web image is built with a placeholder address. " +
          "After this deploy, copy the SiteUrl output and deploy again with `-c siteUrl=<that address>`.",
      );
    }

    // ── API service ──────────────────────────────────────────────────────────
    const apiImage = ecs.ContainerImage.fromDockerImageAsset(
      new DockerImageAsset(this, "ApiImage", {
        directory: repoRoot,
        file: "apps/api/Dockerfile",
        platform: imagePlatform,
        assetName: `${prefix}-api`,
        // The API image does not use these folders, so a change in them does not rebuild it.
        exclude: ["apps/web", "docs"],
        ...buildTrust,
      }),
    );
    const apiLogs = new logs.LogGroup(this, "ApiLogs", { retention: logRetention, removalPolicy: RemovalPolicy.DESTROY });
    const apiTask = new ecs.FargateTaskDefinition(this, "ApiTask", { cpu: config.api.cpu, memoryLimitMiB: config.api.memoryMiB, runtimePlatform });

    // The container's entrypoint joins these five values into DATABASE_URL.
    const databaseSecrets = {
      DB_HOST: ecs.Secret.fromSecretsManager(data.databaseSecret, "host"),
      DB_PORT: ecs.Secret.fromSecretsManager(data.databaseSecret, "port"),
      DB_NAME: ecs.Secret.fromSecretsManager(data.databaseSecret, "dbname"),
      DB_USERNAME: ecs.Secret.fromSecretsManager(data.databaseSecret, "username"),
      DB_PASSWORD: ecs.Secret.fromSecretsManager(data.databaseSecret, "password"),
    };

    // Runs first in every new task and brings the database up to date. Prisma takes a
    // lock, so two tasks starting together cannot clash. If it fails, the API container
    // does not start and the deployment rolls back.
    const migrate = apiTask.addContainer("migrate", {
      image: apiImage,
      essential: false,
      command: ["node_modules/.bin/prisma", "migrate", "deploy"],
      secrets: databaseSecrets,
      logging: ecs.LogDrivers.awsLogs({ logGroup: apiLogs, streamPrefix: "migrate" }),
    });

    const api = apiTask.addContainer("api", {
      image: apiImage,
      essential: true,
      portMappings: [{ containerPort: API_PORT }],
      environment: {
        NODE_ENV: config.appMode,
        PORT: String(API_PORT),
        CORS_ORIGINS: siteUrl,
        PUBLIC_WEB_URL: siteUrl,
        // Two proxies in front of the API: CloudFront, then the load balancer.
        TRUST_PROXY_HOPS: "2",
        MESSAGING_PROVIDER: config.messagingProvider,
        PAYMENT_PROVIDER: config.paymentProvider,
        DEMO_DATA_ENABLED: String(config.demoData),
        S3_REGION: this.region,
        S3_PUBLIC_BUCKET: data.publicBucket.bucketName,
        S3_PRIVATE_BUCKET: data.privateBucket.bucketName,
        ...(data.redisUrl ? { REDIS_URL: data.redisUrl } : {}),
      },
      secrets: {
        ...databaseSecrets,
        JWT_ACCESS_SECRET: ecs.Secret.fromSecretsManager(data.jwtAccessSecret),
        OTP_PEPPER: ecs.Secret.fromSecretsManager(data.otpPepper),
      },
      logging: ecs.LogDrivers.awsLogs({ logGroup: apiLogs, streamPrefix: "api" }),
      // Time to finish open requests when a task is stopped (also on a Spot interruption).
      stopTimeout: Duration.seconds(30),
    });
    api.addContainerDependencies({ container: migrate, condition: ecs.ContainerDependencyCondition.SUCCESS });

    data.publicBucket.grantReadWrite(apiTask.taskRole);
    data.privateBucket.grantReadWrite(apiTask.taskRole);

    const apiService = new ScalingService(this, "Api", {
      cluster,
      taskDefinition: apiTask,
      containerName: api.containerName,
      containerPort: API_PORT,
      sizing: config.api,
      securityGroup: network.apiSecurityGroup,
      subnets: network.serviceSubnets,
      assignPublicIp: network.assignPublicIp,
      listener,
      routing: { priority: 10, pathPatterns: ["/api/*", "/health", "/health/*"] },
      healthCheckPath: "/health/ready",
      // Migrations run before the API starts, so give new tasks a little longer.
      startupGrace: Duration.minutes(3),
      nightlyStop: config.nightlyStop,
    });

    // ── Web service ──────────────────────────────────────────────────────────
    const webImage = ecs.ContainerImage.fromDockerImageAsset(
      new DockerImageAsset(this, "WebImage", {
        directory: repoRoot,
        file: "apps/web/Dockerfile",
        platform: imagePlatform,
        assetName: `${prefix}-web`,
        // The web image does not use the API's code, so a change there does not rebuild it.
        exclude: ["apps/api"],
        ...buildTrust,
        buildArgs: {
          NEXT_PUBLIC_SITE_URL: buildSiteUrl ?? PLACEHOLDER_SITE_URL,
          NEXT_PUBLIC_API_URL: `${buildSiteUrl ?? PLACEHOLDER_SITE_URL}/api/v1`,
        },
      }),
    );
    const webLogs = new logs.LogGroup(this, "WebLogs", { retention: logRetention, removalPolicy: RemovalPolicy.DESTROY });
    const webTask = new ecs.FargateTaskDefinition(this, "WebTask", { cpu: config.web.cpu, memoryLimitMiB: config.web.memoryMiB, runtimePlatform });
    const web = webTask.addContainer("web", {
      image: webImage,
      essential: true,
      portMappings: [{ containerPort: WEB_PORT }],
      environment: { PORT: String(WEB_PORT), HOSTNAME: "0.0.0.0" },
      logging: ecs.LogDrivers.awsLogs({ logGroup: webLogs, streamPrefix: "web" }),
      stopTimeout: Duration.seconds(30),
    });

    const webService = new ScalingService(this, "Web", {
      cluster,
      taskDefinition: webTask,
      containerName: web.containerName,
      containerPort: WEB_PORT,
      sizing: config.web,
      securityGroup: network.webSecurityGroup,
      subnets: network.serviceSubnets,
      assignPublicIp: network.assignPublicIp,
      listener,
      // No routing rule: the web app gets everything the API rule does not take.
      healthCheckPath: "/robots.txt",
      startupGrace: Duration.minutes(1),
      nightlyStop: config.nightlyStop,
    });

    // ── Web firewall (optional) ──────────────────────────────────────────────
    if (config.waf) {
      const metrics = (name: string) => ({ cloudWatchMetricsEnabled: true, sampledRequestsEnabled: true, metricName: `${prefix}-${name}` });
      const managed = (name: string, priority: number): wafv2.CfnWebACL.RuleProperty => ({
        name,
        priority,
        overrideAction: { none: {} },
        statement: { managedRuleGroupStatement: { vendorName: "AWS", name } },
        visibilityConfig: metrics(name),
      });
      const webAcl = new wafv2.CfnWebACL(this, "WebAcl", {
        scope: "REGIONAL",
        defaultAction: { allow: {} },
        visibilityConfig: metrics("web-acl"),
        rules: [
          managed("AWSManagedRulesAmazonIpReputationList", 0),
          managed("AWSManagedRulesCommonRuleSet", 1),
          managed("AWSManagedRulesKnownBadInputsRuleSet", 2),
          {
            // Slows down password and one-time-code guessing: at most 300 sign-in
            // requests in 5 minutes from one visitor address.
            name: "AuthRateLimit",
            priority: 3,
            action: { block: {} },
            statement: {
              rateBasedStatement: {
                limit: 300,
                aggregateKeyType: "FORWARDED_IP",
                forwardedIpConfig: { headerName: "X-Forwarded-For", fallbackBehavior: "MATCH" },
                scopeDownStatement: {
                  byteMatchStatement: {
                    searchString: "/api/v1/auth/",
                    fieldToMatch: { uriPath: {} },
                    positionalConstraint: "STARTS_WITH",
                    textTransformations: [{ priority: 0, type: "NONE" }],
                  },
                },
              },
            },
            visibilityConfig: metrics("auth-rate-limit"),
          },
        ],
      });
      new wafv2.CfnWebACLAssociation(this, "WebAclAssociation", { resourceArn: loadBalancer.loadBalancerArn, webAclArn: webAcl.attrArn });
    }

    // ── Alarms and budget (only with an email address) ───────────────────────
    if (config.alarmEmail) {
      const topic = new sns.Topic(this, "Alarms", { displayName: `Namma Trails ${config.name} alarms` });
      topic.addSubscription(new subscriptions.EmailSubscription(config.alarmEmail));
      const fiveMinutes = Duration.minutes(5);
      const alarm = (id: string, description: string, metric: cloudwatch.IMetric, threshold: number, options: Partial<cloudwatch.AlarmProps> = {}) => {
        const created = new cloudwatch.Alarm(this, id, {
          alarmDescription: description,
          metric,
          threshold,
          evaluationPeriods: 3,
          datapointsToAlarm: 2,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
          ...options,
        });
        created.addAlarmAction(new cloudwatchActions.SnsAction(topic));
      };

      alarm("ServerErrors", "The app answered with server errors (5xx)", apiService.targetGroup.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, { period: fiveMinutes, statistic: "Sum" }), 10);
      alarm("LoadBalancerErrors", "The load balancer could not reach the app (5xx)", loadBalancer.metrics.httpCodeElb(elbv2.HttpCodeElb.ELB_5XX_COUNT, { period: fiveMinutes, statistic: "Sum" }), 10);
      alarm("ApiUnhealthy", "An API task is failing its health check", apiService.targetGroup.metrics.unhealthyHostCount({ period: Duration.minutes(1), statistic: "Maximum" }), 1);
      alarm("WebUnhealthy", "A web task is failing its health check", webService.targetGroup.metrics.unhealthyHostCount({ period: Duration.minutes(1), statistic: "Maximum" }), 1);
      alarm("ApiCpuHigh", "API CPU is high even after scaling out", apiService.service.metricCpuUtilization({ period: fiveMinutes }), 85);
      alarm("ApiMemoryHigh", "API memory is high", apiService.service.metricMemoryUtilization({ period: fiveMinutes }), 85);
      alarm("WebMemoryHigh", "Web memory is high", webService.service.metricMemoryUtilization({ period: fiveMinutes }), 85);
      alarm("DatabaseCpuHigh", "Database CPU is high", data.database.metricCPUUtilization({ period: fiveMinutes }), 85);
      alarm("DatabaseDiskLow", "Database disk space is under 2 GB", data.database.metricFreeStorageSpace({ period: fiveMinutes }), 2 * 1024 ** 3, {
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
      });

      if (config.monthlyBudgetUsd) {
        const subscribers = [{ subscriptionType: "EMAIL", address: config.alarmEmail }];
        new budgets.CfnBudget(this, "MonthlyBudget", {
          budget: {
            budgetName: `${prefix}-monthly`,
            budgetType: "COST",
            timeUnit: "MONTHLY",
            budgetLimit: { amount: config.monthlyBudgetUsd, unit: "USD" },
          },
          notificationsWithSubscribers: [
            { notification: { notificationType: "ACTUAL", comparisonOperator: "GREATER_THAN", threshold: 80, thresholdType: "PERCENTAGE" }, subscribers },
            { notification: { notificationType: "FORECASTED", comparisonOperator: "GREATER_THAN", threshold: 100, thresholdType: "PERCENTAGE" }, subscribers },
          ],
        });
      }
    }

    // ── Things you need after the deploy ─────────────────────────────────────
    new CfnOutput(this, "SiteUrl", { value: siteUrl, description: "The address of the site" });
    new CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new CfnOutput(this, "ApiServiceName", { value: apiService.service.serviceName });
    new CfnOutput(this, "WebServiceName", { value: webService.service.serviceName });
    new CfnOutput(this, "ApiLogGroup", { value: apiLogs.logGroupName });
    new CfnOutput(this, "WebLogGroup", { value: webLogs.logGroupName });

    // A ready command for one-off jobs (seed data, create the first admin). Add
    // `--overrides file://tasks/<job>.json` to it; see infra/README.md.
    const subnetIds = network.vpc.selectSubnets(network.serviceSubnets).subnetIds.join(",");
    new CfnOutput(this, "RunApiTaskCommand", {
      description: "Runs a one-off job in the API image. Add: --overrides file://tasks/<job>.json",
      value: [
        "aws ecs run-task",
        `--region ${this.region}`,
        `--cluster ${cluster.clusterName}`,
        `--task-definition ${apiTask.family}`,
        `--capacity-provider-strategy capacityProvider=FARGATE,weight=1`,
        `--network-configuration "awsvpcConfiguration={subnets=[${subnetIds}],securityGroups=[${network.apiSecurityGroup.securityGroupId}],assignPublicIp=${network.assignPublicIp ? "ENABLED" : "DISABLED"}}"`,
      ].join(" "),
    });
  }
}

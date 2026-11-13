import { readFileSync } from "node:fs";
import * as path from "node:path";
import { Annotations, CfnOutput, DockerBuildSecret, Duration, Fn, Stack, Tags, type StackProps } from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as cr from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";
import type { StageConfig } from "../config/stage";

export interface StageStackProps extends StackProps {
  config: StageConfig;
}

const WEB_PORT = 3000;
const API_PORT = 4000;
/** Where `cdk deploy` leaves the values the server reads when it starts. */
export const STAGE_PARAMETERS = "/namma-trails/stage";
const PLACEHOLDER_SITE_URL = "https://site-url-not-set.invalid";

/**
 * The stage environment: the whole app on one small server that you switch on and off.
 *
 *   visitor -> CloudFront -> the server
 *                              web  (port 3000)   everything except /api and /health
 *                              api  (port 4000)   /api/* and /health
 *                              db   PostgreSQL, on the server's own disk
 *
 * Only what is needed, and nothing that bills by the hour while the server is off:
 *   - one EC2 server (billed only while it runs)
 *   - its disk and a fixed address (the two small costs that remain while it is off)
 *   - CloudFront for HTTPS and an address that never changes (free at this size)
 *   - the image store that `cdk deploy` uses anyway
 * There is no load balancer, no managed database, no NAT gateway and no secret store.
 *
 * Switching it on and off: `pnpm stage:start` / `pnpm stage:stop` in the infra folder.
 * A schedule also stops it every night, so a forgotten server cannot run up a bill.
 */
export class StageStack extends Stack {
  private readonly zone: string;

  /** The zone comes from the config, so `cdk synth` needs no AWS login. */
  override get availabilityZones(): string[] {
    return [this.zone];
  }

  constructor(scope: Construct, id: string, props: StageStackProps) {
    super(scope, id, props);
    const { config } = props;
    this.zone = config.availabilityZone;
    const repoRoot = path.join(__dirname, "..", "..");

    // ── Network: one public subnet, nothing else ─────────────────────────────
    const vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.30.0.0/24"),
      availabilityZones: [config.availabilityZone],
      natGateways: 0,
      subnetConfiguration: [{ name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 26 }],
    });

    // Only CloudFront may reach the two app ports. Nobody can connect to the server
    // directly, and there is no SSH: a shell is opened through AWS Session Manager.
    const securityGroup = new ec2.SecurityGroup(this, "ServerSg", { vpc, description: "Stage server: only CloudFront may connect" });
    const cloudFrontAddresses = new cr.AwsCustomResource(this, "CloudFrontAddressList", {
      onUpdate: {
        service: "EC2",
        action: "describeManagedPrefixLists",
        parameters: { Filters: [{ Name: "prefix-list-name", Values: ["com.amazonaws.global.cloudfront.origin-facing"] }] },
        physicalResourceId: cr.PhysicalResourceId.of("cloudfront-origin-facing-prefix-list"),
        outputPaths: ["PrefixLists.0.PrefixListId"],
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({ resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE }),
      installLatestAwsSdk: false,
    });
    // One rule for both ports: the address list is long, and a second rule would not fit.
    securityGroup.addIngressRule(
      ec2.Peer.prefixList(cloudFrontAddresses.getResponseField("PrefixLists.0.PrefixListId")),
      ec2.Port.tcpRange(WEB_PORT, API_PORT),
      "CloudFront to the website (3000) and the API (4000)",
    );

    // A fixed address, so CloudFront always finds the server after a stop and start.
    // This address is the main cost while the server is off.
    const address = new ec2.CfnEIP(this, "Address", { domain: "vpc", tags: [{ key: "Name", value: "namma-trails-stage" }] });
    // CloudFront needs a name, not a number: ec2-1-2-3-4.<region>.compute.amazonaws.com
    const dnsSuffix = config.region === "us-east-1" ? "compute-1.amazonaws.com" : `${config.region}.compute.amazonaws.com`;
    const serverDns = `ec2-${Fn.join("-", Fn.split(".", address.attrPublicIp))}.${dnsSuffix}`;

    // ── CloudFront: HTTPS and one address for the website and the API ────────
    const toServer = (port: number) =>
      new origins.HttpOrigin(serverDns, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        httpPort: port,
        readTimeout: Duration.seconds(30),
        keepaliveTimeout: Duration.seconds(60),
      });
    const webOrigin = toServer(WEB_PORT);
    const apiOrigin = toServer(API_PORT);
    const forward = {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      compress: true,
    };
    const noCache = { ...forward, allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED };

    // Helper pages of the API that should not be open to everyone answer "404" at the edge.
    const blocked = config.blockedPaths.length
      ? new cloudfront.Function(this, "BlockHelperPages", {
          comment: "Stage: hide the API helper pages",
          code: cloudfront.FunctionCode.fromInline(
            [
              "function handler(event) {",
              `  var blocked = ${JSON.stringify(config.blockedPaths)};`,
              "  var uri = event.request.uri;",
              "  for (var i = 0; i < blocked.length; i++) {",
              "    if (uri === blocked[i] || uri.indexOf(blocked[i] + '/') === 0) {",
              "      return { statusCode: 404, statusDescription: 'Not Found' };",
              "    }",
              "  }",
              "  return event.request;",
              "}",
            ].join("\n"),
          ),
        })
      : undefined;
    const api = {
      ...noCache,
      origin: apiOrigin,
      ...(blocked ? { functionAssociations: [{ function: blocked, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }] } : {}),
    };
    const health = { ...noCache, origin: apiOrigin };

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "Namma Trails (stage)",
      defaultBehavior: { ...noCache, origin: webOrigin },
      additionalBehaviors: {
        "/api/*": api,
        "/health": health,
        "/health/*": health,
        "/_next/static/*": { ...forward, origin: webOrigin, cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED },
        "/_next/image*": { ...forward, origin: webOrigin, cachePolicy: cloudfront.CachePolicy.USE_ORIGIN_CACHE_CONTROL_HEADERS_QUERY_STRINGS },
      },
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
    });
    const siteUrl = `https://${distribution.distributionDomainName}`;
    if (!config.siteUrl) {
      Annotations.of(this).addWarning(
        "No siteUrl yet: the web image is built with a placeholder address. After this deploy, put the SiteUrl output " +
          "into infra/config/stage.ts (siteUrl), deploy again, and restart the server (pnpm stage:restart).",
      );
    }

    // ── The two images (the same Dockerfiles as every other environment) ─────
    const extraCa = process.env.NODE_EXTRA_CA_CERTS;
    const buildTrust = extraCa ? { buildSecrets: { extra_ca: DockerBuildSecret.fromSrc(path.resolve(extraCa)) }, invalidation: { buildSecrets: false } } : {};
    const apiImage = new DockerImageAsset(this, "ApiImage", {
      directory: repoRoot,
      file: "apps/api/Dockerfile",
      platform: Platform.LINUX_AMD64,
      assetName: "namma-trails-stage-api",
      exclude: ["apps/web", "docs"],
      ...buildTrust,
    });
    const builtFor = config.siteUrl ?? PLACEHOLDER_SITE_URL;
    const webImage = new DockerImageAsset(this, "WebImage", {
      directory: repoRoot,
      file: "apps/web/Dockerfile",
      platform: Platform.LINUX_AMD64,
      assetName: "namma-trails-stage-web",
      exclude: ["apps/api"],
      ...buildTrust,
      buildArgs: { NEXT_PUBLIC_SITE_URL: builtFor, NEXT_PUBLIC_API_URL: `${builtFor}/api/v1` },
    });

    // What the server reads every time it starts (Parameter Store: free).
    const parameter = (id: string, name: string, value: string) => new ssm.StringParameter(this, id, { parameterName: `${STAGE_PARAMETERS}/${name}`, stringValue: value });
    const parameters = [
      parameter("ApiImageName", "api-image", apiImage.imageUri),
      parameter("WebImageName", "web-image", webImage.imageUri),
      parameter("SiteAddress", "site-url", siteUrl),
      parameter("DemoData", "demo-data", String(config.demoData)),
    ];

    // ── The server ───────────────────────────────────────────────────────────
    const role = new iam.Role(this, "ServerRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      description: "Stage server: download its two images, read its settings, allow a shell through Session Manager",
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")],
    });
    apiImage.repository.grantPull(role);
    webImage.repository.grantPull(role);
    for (const p of parameters) p.grantRead(role);

    // The start-up script is the same on every start; what changes comes from Parameter Store.
    const bootScript = readFileSync(path.join(__dirname, "..", "stage", "boot.sh"), "utf8").replace(/\r\n/g, "\n").trimEnd();
    const unit = [
      "[Unit]",
      "Description=Namma Trails stage (database, API and website)",
      "After=docker.service network-online.target",
      "Wants=network-online.target",
      "Requires=docker.service",
      "",
      "[Service]",
      "Type=oneshot",
      "RemainAfterExit=yes",
      "ExecStart=/opt/namma/boot.sh",
      "Restart=on-failure",
      "RestartSec=30",
      "",
      "[Install]",
      "WantedBy=multi-user.target",
    ].join("\n");
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "set -euxo pipefail",
      "dnf install -y docker",
      "systemctl enable --now docker",
      // A little swap, so a busy moment (downloading images, a migration) cannot run the 2 GB out.
      "if [ ! -f /swapfile ]; then dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none && chmod 600 /swapfile && mkswap /swapfile >/dev/null && echo '/swapfile none swap sw 0 0' >> /etc/fstab; fi",
      "swapon -a",
      "mkdir -p /opt/namma",
      `cat > /opt/namma/boot.sh <<'NAMMA_BOOT_SCRIPT'\n${bootScript}\nNAMMA_BOOT_SCRIPT`,
      "chmod 700 /opt/namma/boot.sh",
      `cat > /etc/systemd/system/namma-stage.service <<'NAMMA_UNIT'\n${unit}\nNAMMA_UNIT`,
      "systemctl daemon-reload",
      "systemctl enable namma-stage.service",
      "systemctl start namma-stage.service || true",
    );

    const server = new ec2.Instance(this, "Server", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(config.instanceType),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.X86_64 }),
      securityGroup,
      role,
      userData,
      requireImdsv2: true,
      blockDevices: [{ deviceName: "/dev/xvda", volume: ec2.BlockDeviceVolume.ebs(config.diskGb, { volumeType: ec2.EbsDeviceVolumeType.GP3, encrypted: true }) }],
    });
    // The settings must exist before the first start reads them.
    for (const p of parameters) server.node.addDependency(p);
    Tags.of(server).add("Name", "namma-trails-stage");
    new ec2.CfnEIPAssociation(this, "AddressOfServer", { allocationId: address.attrAllocationId, instanceId: server.instanceId });

    // ── Stop it every night, in case it was forgotten ────────────────────────
    if (config.autoStopAtUtc) {
      const stopRole = new iam.Role(this, "AutoStopRole", { assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com") });
      stopRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ["ec2:StopInstances"],
          resources: [`arn:${this.partition}:ec2:${this.region}:${this.account}:instance/${server.instanceId}`],
        }),
      );
      new scheduler.CfnSchedule(this, "AutoStop", {
        description: "Stops the stage server every night so a forgotten server cannot run up a bill",
        scheduleExpression: `cron(${config.autoStopAtUtc.minute} ${config.autoStopAtUtc.hour} * * ? *)`,
        scheduleExpressionTimezone: "UTC",
        flexibleTimeWindow: { mode: "OFF" },
        target: {
          arn: "arn:aws:scheduler:::aws-sdk:ec2:stopInstances",
          roleArn: stopRole.roleArn,
          input: this.toJsonString({ InstanceIds: [server.instanceId] }),
        },
      });
    }

    // ── Budget warning (optional) ────────────────────────────────────────────
    if (config.alarmEmail && config.monthlyBudgetUsd) {
      const subscribers = [{ subscriptionType: "EMAIL", address: config.alarmEmail }];
      new budgets.CfnBudget(this, "MonthlyBudget", {
        budget: { budgetName: "namma-trails-stage-monthly", budgetType: "COST", timeUnit: "MONTHLY", budgetLimit: { amount: config.monthlyBudgetUsd, unit: "USD" } },
        notificationsWithSubscribers: [
          { notification: { notificationType: "ACTUAL", comparisonOperator: "GREATER_THAN", threshold: 80, thresholdType: "PERCENTAGE" }, subscribers },
          { notification: { notificationType: "FORECASTED", comparisonOperator: "GREATER_THAN", threshold: 100, thresholdType: "PERCENTAGE" }, subscribers },
        ],
      });
    }

    new CfnOutput(this, "SiteUrl", { value: siteUrl, description: "The address of the stage site" });
    new CfnOutput(this, "ServerId", { value: server.instanceId, description: "Used by `pnpm stage:start, stage:stop and stage:status`" });
    new CfnOutput(this, "StartCommand", { value: `aws ec2 start-instances --region ${this.region} --instance-ids ${server.instanceId}` });
    new CfnOutput(this, "StopCommand", { value: `aws ec2 stop-instances --region ${this.region} --instance-ids ${server.instanceId}` });
    new CfnOutput(this, "ShellCommand", { value: `aws ssm start-session --region ${this.region} --target ${server.instanceId}`, description: "Opens a shell on the server (needs the Session Manager plugin)" });

    Tags.of(this).add("Project", "namma-trails");
    Tags.of(this).add("Environment", "stage");
    Tags.of(this).add("ManagedBy", "cdk");
  }
}

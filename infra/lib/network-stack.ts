import { Stack, type StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cr from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "../config/environments";

export interface NetworkStackProps extends StackProps {
  config: EnvironmentConfig;
}

export const WEB_PORT = 3000;
export const API_PORT = 4000;

/**
 * The private network and the firewall rules (security groups).
 *
 * Layout, in two data centres (availability zones):
 *   - public subnets   the web and API tasks, when there is no NAT gateway
 *   - private subnets  the web and API tasks, when NAT gateways are switched on
 *   - data subnets     no route to the internet at all: the database, the cache and
 *                      the load balancer (CloudFront reaches it from inside the network)
 *
 * Who may talk to whom:
 *   CloudFront -> load balancer -> web / API tasks -> database
 * Nothing else is allowed in.
 */
export class NetworkStack extends Stack {
  readonly vpc: ec2.Vpc;
  /** Where the web and API tasks run. */
  readonly serviceSubnets: ec2.SubnetSelection;
  /** true when tasks sit in public subnets and need a public address to pull their image. */
  readonly assignPublicIp: boolean;

  readonly loadBalancerSecurityGroup: ec2.SecurityGroup;
  readonly webSecurityGroup: ec2.SecurityGroup;
  readonly apiSecurityGroup: ec2.SecurityGroup;
  readonly databaseSecurityGroup: ec2.SecurityGroup;
  readonly cacheSecurityGroup?: ec2.SecurityGroup;

  private readonly zones: string[];

  /**
   * The zones come from the config, so CDK never has to ask AWS which zones the
   * account has. `cdk synth` therefore works without an AWS login.
   */
  override get availabilityZones(): string[] {
    return this.zones;
  }

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);
    const { config } = props;
    this.zones = [...config.availabilityZones];
    const usesNat = config.natGateways > 0;

    this.vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.20.0.0/16"),
      availabilityZones: config.availabilityZones,
      natGateways: config.natGateways,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        ...(usesNat ? [{ name: "private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 }] : []),
        { name: "data", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
    // A gateway endpoint is free. Image layers and uploads to S3 then stay inside AWS.
    this.vpc.addGatewayEndpoint("S3Endpoint", { service: ec2.GatewayVpcEndpointAwsService.S3 });

    this.serviceSubnets = { subnetType: usesNat ? ec2.SubnetType.PRIVATE_WITH_EGRESS : ec2.SubnetType.PUBLIC };
    this.assignPublicIp = !usesNat;

    // ── Firewall rules ───────────────────────────────────────────────────────
    this.loadBalancerSecurityGroup = new ec2.SecurityGroup(this, "LoadBalancerSg", {
      vpc: this.vpc,
      description: "Load balancer: only CloudFront may connect",
      allowAllOutbound: false,
    });
    // CloudFront connects through its own network interfaces inside this network, so
    // the traffic comes from an address inside the VPC ...
    this.loadBalancerSecurityGroup.addIngressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.tcp(80), "CloudFront VPC origin (inside the network)");
    // ... and AWS also documents its list of CloudFront addresses for this. The list
    // has a different id in every region, so it is looked up when the stack is deployed.
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
    this.loadBalancerSecurityGroup.addIngressRule(
      ec2.Peer.prefixList(cloudFrontAddresses.getResponseField("PrefixLists.0.PrefixListId")),
      ec2.Port.tcp(80),
      "CloudFront address list",
    );

    // The rules "load balancer -> web/API tasks" are added by CDK when the services are
    // attached to the load balancer (see ScalingService).
    this.webSecurityGroup = new ec2.SecurityGroup(this, "WebSg", { vpc: this.vpc, description: "Web tasks: only the load balancer may connect" });
    this.apiSecurityGroup = new ec2.SecurityGroup(this, "ApiSg", { vpc: this.vpc, description: "API tasks: only the load balancer may connect" });

    this.databaseSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSg", {
      vpc: this.vpc,
      description: "PostgreSQL: only API tasks may connect",
      allowAllOutbound: false,
    });
    this.databaseSecurityGroup.addIngressRule(this.apiSecurityGroup, ec2.Port.tcp(5432), "API tasks");

    if (config.redis) {
      this.cacheSecurityGroup = new ec2.SecurityGroup(this, "CacheSg", {
        vpc: this.vpc,
        description: "Redis: only API tasks may connect",
        allowAllOutbound: false,
      });
      this.cacheSecurityGroup.addIngressRule(this.apiSecurityGroup, ec2.Port.tcp(6379), "API tasks");
    }
  }
}

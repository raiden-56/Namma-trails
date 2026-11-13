import { Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import type { EnvironmentConfig } from "../config/environments";
import type { NetworkStack } from "./network-stack";

export interface DataStackProps extends StackProps {
  config: EnvironmentConfig;
  network: NetworkStack;
}

/**
 * Everything that holds data, kept in its own stack so that deploying a new version of
 * the app can never touch it: the PostgreSQL database, the app's secrets and the file
 * buckets (and Redis, when it is switched on).
 */
export class DataStack extends Stack {
  readonly database: rds.DatabaseInstance;
  /** Host, port, user name, password and database name, made and stored by AWS. */
  readonly databaseSecret: secretsmanager.ISecret;
  readonly jwtAccessSecret: secretsmanager.Secret;
  readonly otpPepper: secretsmanager.Secret;
  /** Photos and other files anyone may see (served through CloudFront later). */
  readonly publicBucket: s3.Bucket;
  /** Partner documents. Never public. */
  readonly privateBucket: s3.Bucket;
  /** Set only when Redis is switched on. */
  readonly redisUrl?: string;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    const { config, network } = props;
    const db = config.database;
    const protect = db.protectData;

    // ── PostgreSQL ───────────────────────────────────────────────────────────
    this.database = new rds.DatabaseInstance(this, "Postgres", {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_17 }),
      // T4G = small burstable ARM instances, the cheapest family RDS has.
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize[db.size]),
      vpc: network.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [network.databaseSecurityGroup],
      publiclyAccessible: false,
      multiAz: db.multiAz,

      databaseName: "namma_trails",
      // AWS makes the password and keeps it in Secrets Manager. Nobody has to know it.
      credentials: rds.Credentials.fromGeneratedSecret("kt_admin", { excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/@\"\\" }),
      caCertificate: rds.CaCertificate.RDS_CA_RSA2048_G1,

      // Storage auto scaling: the disk grows by itself up to the maximum.
      storageType: rds.StorageType.GP3,
      allocatedStorage: db.allocatedStorageGb,
      maxAllocatedStorage: db.maxAllocatedStorageGb,
      storageEncrypted: true,

      backupRetention: Duration.days(db.backupRetentionDays),
      deleteAutomatedBackups: !protect,
      deletionProtection: protect,
      removalPolicy: protect ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
      autoMinorVersionUpgrade: true,
    });
    if (!this.database.secret) throw new Error("The database has no generated secret.");
    this.databaseSecret = this.database.secret;

    // ── Secrets the API needs ────────────────────────────────────────────────
    this.jwtAccessSecret = new secretsmanager.Secret(this, "JwtAccessSecret", {
      description: `Namma Trails (${config.name}): signs sign-in tokens (JWT_ACCESS_SECRET)`,
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
    });
    this.otpPepper = new secretsmanager.Secret(this, "OtpPepper", {
      description: `Namma Trails (${config.name}): mixed into one-time code hashes (OTP_PEPPER)`,
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });

    // ── File storage ─────────────────────────────────────────────────────────
    // The API does not store files yet. Empty buckets cost nothing, and the API already
    // gets their names and the right to use them, so uploads work the day they are built.
    const bucketDefaults: s3.BucketProps = {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: protect ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !protect,
    };
    this.publicBucket = new s3.Bucket(this, "PublicMedia", bucketDefaults);
    this.privateBucket = new s3.Bucket(this, "PrivateDocuments", {
      ...bucketDefaults,
      versioned: true,
      lifecycleRules: [{ noncurrentVersionExpiration: Duration.days(90) }],
    });

    // ── Redis (off until the API uses it) ────────────────────────────────────
    if (config.redis && network.cacheSecurityGroup) {
      // Serverless: it scales by itself and is billed by use. The limits cap the bill.
      const cache = new elasticache.CfnServerlessCache(this, "Cache", {
        engine: "valkey",
        serverlessCacheName: `namma-trails-${config.name}`,
        securityGroupIds: [network.cacheSecurityGroup.securityGroupId],
        subnetIds: network.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
        cacheUsageLimits: {
          dataStorage: { maximum: 1, unit: "GB" },
          ecpuPerSecond: { maximum: 1000 },
        },
      });
      this.redisUrl = `rediss://${cache.attrEndpointAddress}:${cache.attrEndpointPort}`;
    }
  }
}

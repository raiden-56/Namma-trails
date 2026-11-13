import { Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as backup from "aws-cdk-lib/aws-backup";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elasticache from "aws-cdk-lib/aws-elasticache";
import * as events from "aws-cdk-lib/aws-events";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ses from "aws-cdk-lib/aws-ses";
import type { Construct } from "constructs";
import { addressOf, mailFromOf, type EnvironmentConfig } from "../config/environments";
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
  /** One-time codes and rate-limit counters. Set only when dynamoStores is on. */
  readonly otpTable?: dynamodb.Table;
  readonly rateLimitTable?: dynamodb.Table;
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

      // Real data: also send the database's own log to CloudWatch, so slow queries and
      // failed logins can be looked up later.
      ...(protect ? { cloudwatchLogsExports: ["postgresql"], cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH } : {}),

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
    // Uploads go straight from the browser to S3 with a one-time link the API signs, so
    // the files never pass through (or weigh on) the API tasks. Storage is billed per GB.
    //
    // Soft delete: both buckets keep old versions. A file that is deleted or overwritten
    // can be brought back until its old version expires.
    const bucketDefaults: s3.BucketProps = {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: protect ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !protect,
      // The browser may send a file with a signed link; reading goes through the CDN.
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: config.domain ? [config.domain.name, ...(config.domain.alternateNames ?? [])].map((name) => `https://${name}`) : ["*"],
          allowedHeaders: ["*"],
          maxAge: 3600,
        },
      ],
    };
    const tidyUp = { abortIncompleteMultipartUploadAfter: Duration.days(7) };
    this.publicBucket = new s3.Bucket(this, "PublicMedia", {
      ...bucketDefaults,
      lifecycleRules: [{ ...tidyUp, noncurrentVersionExpiration: Duration.days(30) }],
    });
    this.privateBucket = new s3.Bucket(this, "PrivateDocuments", {
      ...bucketDefaults,
      lifecycleRules: [{ ...tidyUp, noncurrentVersionExpiration: Duration.days(90) }],
    });
    // Photos are public, but only through the CDN: CloudFront (and nobody else) may read
    // the "media/" part of the public bucket. Written here, and not by the app stack, so
    // the two stacks do not depend on each other in a circle.
    this.publicBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontToReadMedia",
        actions: ["s3:GetObject"],
        resources: [this.publicBucket.arnForObjects("media/*")],
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        conditions: { StringLike: { "AWS:SourceArn": `arn:${this.partition}:cloudfront::${this.account}:distribution/*` } },
      }),
    );

    // ── DynamoDB: short-lived data ───────────────────────────────────────────
    // One-time codes and rate-limit counters are small, read by one key, never joined to
    // anything, and worthless after a few minutes. DynamoDB is billed per request (no
    // hourly fee), is shared by every API task, and removes old items by itself.
    // Bookings, payments and partners stay in PostgreSQL: they need transactions and joins.
    if (config.dynamoStores) {
      const shortLived = {
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        timeToLiveAttribute: "ttl",
        // Nothing here is worth keeping, so no backups and no delete protection.
        removalPolicy: RemovalPolicy.DESTROY,
      };
      this.otpTable = new dynamodb.Table(this, "OtpCodes", {
        ...shortLived,
        partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
        sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      });
      this.rateLimitTable = new dynamodb.Table(this, "RateLimits", {
        ...shortLived,
        partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      });
    }

    // ── Email sender (Amazon SES) ────────────────────────────────────────────
    // Proves to SES that we own the sender. With a domain the DNS records are added for
    // us; with a single address AWS emails it a confirmation link.
    // A new SES account is in the "sandbox" and can only mail verified addresses. Ask AWS
    // for production access before real users sign up (SES console -> Account dashboard).
    const mailFrom = mailFromOf(config);
    if (config.messagingProvider === "aws" && mailFrom) {
      new ses.EmailIdentity(this, "MailIdentity", {
        identity: config.domain
          ? ses.Identity.publicHostedZone(
              route53.PublicHostedZone.fromPublicHostedZoneAttributes(this, "MailZone", { hostedZoneId: config.domain.hostedZoneId, zoneName: config.domain.hostedZoneName }),
            )
          : ses.Identity.email(addressOf(mailFrom)),
      });
    }

    // ── Backups ──────────────────────────────────────────────────────────────
    // The database always has its own automatic backups (backupRetentionDays, with
    // restore to any minute). AWS Backup adds a second, independent set that is kept
    // longer and survives even if the database itself is deleted.
    if (config.backups) {
      const vault = new backup.BackupVault(this, "BackupVault", { removalPolicy: RemovalPolicy.RETAIN });
      const plan = new backup.BackupPlan(this, "BackupPlan", {
        backupVault: vault,
        backupPlanRules: [
          new backup.BackupPlanRule({
            ruleName: "Nightly",
            // 20:30 UTC = 02:00 in India.
            scheduleExpression: events.Schedule.cron({ hour: "20", minute: "30" }),
            startWindow: Duration.hours(1),
            completionWindow: Duration.hours(4),
            deleteAfter: Duration.days(config.backups.dailyRetentionDays),
          }),
          new backup.BackupPlanRule({
            ruleName: "Weekly",
            scheduleExpression: events.Schedule.cron({ weekDay: "SUN", hour: "21", minute: "30" }),
            startWindow: Duration.hours(1),
            completionWindow: Duration.hours(4),
            deleteAfter: Duration.days(config.backups.weeklyRetentionDays),
          }),
        ],
      });
      plan.addSelection("Database", { resources: [backup.BackupResource.fromRdsDatabaseInstance(this.database)] });
    }

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

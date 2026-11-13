import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { SNSClient } from "@aws-sdk/client-sns";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { Env } from "../../config/env.js";

/*
 * One place that creates the AWS clients.
 *
 * On AWS nothing is configured here: each client finds the region and the task's own
 * role by itself, so no access keys are stored anywhere. Locally, an endpoint setting
 * points a client at a stand-in running in Docker (S3Mock, DynamoDB Local), and dummy
 * keys are enough.
 */

const LOCAL_KEYS = { accessKeyId: "local", secretAccessKey: "local" };

let dynamo: DynamoDBDocumentClient | undefined;
let s3: S3Client | undefined;
let ses: SESv2Client | undefined;
let sns: SNSClient | undefined;

export function dynamoClient(env: Env): DynamoDBDocumentClient {
  dynamo ??= DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: env.AWS_REGION,
      ...(env.DYNAMODB_ENDPOINT ? { endpoint: env.DYNAMODB_ENDPOINT, credentials: LOCAL_KEYS } : {}),
    }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  return dynamo;
}

export function s3Client(env: Env): S3Client {
  s3 ??= new S3Client({
    region: env.S3_REGION,
    ...(env.S3_ENDPOINT
      ? {
          endpoint: env.S3_ENDPOINT,
          // A local S3 has no bucket host names: http://host/bucket/key
          forcePathStyle: true,
          credentials: { accessKeyId: env.S3_ACCESS_KEY ?? LOCAL_KEYS.accessKeyId, secretAccessKey: env.S3_SECRET_KEY ?? LOCAL_KEYS.secretAccessKey },
        }
      : {}),
  });
  return s3;
}

export function sesClient(env: Env): SESv2Client {
  ses ??= new SESv2Client({ region: env.AWS_REGION });
  return ses;
}

export function snsClient(env: Env): SNSClient {
  sns ??= new SNSClient({ region: env.AWS_REGION });
  return sns;
}

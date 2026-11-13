// Creates the two DynamoDB tables in a local DynamoDB (docker compose up -d dynamodb).
// On AWS the CDK stacks create them; this is only for trying the DynamoDB stores locally.
//
//   pnpm --filter @kt/api dynamodb:local
//
// Then set in apps/api/.env:
//   DYNAMODB_ENDPOINT=http://localhost:8000
//   OTP_STORE=dynamodb          DYNAMODB_TABLE_OTP=kt-otp
//   RATE_LIMIT_STORE=dynamodb   DYNAMODB_TABLE_RATE_LIMITS=kt-rate-limits
import { CreateTableCommand, DynamoDBClient, UpdateTimeToLiveCommand } from "@aws-sdk/client-dynamodb";

const endpoint = process.env.DYNAMODB_ENDPOINT ?? "http://localhost:8000";
const db = new DynamoDBClient({ region: "ap-south-1", endpoint, credentials: { accessKeyId: "local", secretAccessKey: "local" } });
const text = (name) => ({ AttributeName: name, AttributeType: "S" });

const tables = [
  { TableName: "kt-otp", AttributeDefinitions: [text("pk"), text("sk")], KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }, { AttributeName: "sk", KeyType: "RANGE" }] },
  { TableName: "kt-rate-limits", AttributeDefinitions: [text("pk")], KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }] },
];

for (const table of tables) {
  try {
    await db.send(new CreateTableCommand({ ...table, BillingMode: "PAY_PER_REQUEST" }));
    // Old items remove themselves: the "ttl" attribute holds the time to delete them.
    await db.send(new UpdateTimeToLiveCommand({ TableName: table.TableName, TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true } })).catch(() => undefined);
    console.log(`created ${table.TableName}`);
  } catch (error) {
    if (error.name === "ResourceInUseException") console.log(`${table.TableName} already exists`);
    else throw error;
  }
}

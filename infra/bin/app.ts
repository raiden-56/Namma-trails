#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { resolveConfig } from "../config/environments";
import { resolveStageConfig } from "../config/stage";
import { buildStacks } from "../lib/build-stacks";
import { StageStack } from "../lib/stage-stack";

/**
 * Entry point of the CDK app.
 *
 * Pick the environment with -c env=...
 *   stage        one small server you switch on and off. The cheapest way to test.
 *   demo         (the default) containers with auto scaling, always on.
 *   production   bigger and safer, for the real launch.
 *
 * Other optional values, also passed with -c:
 *   siteUrl            the CloudFront address, when you have no domain (second deploy)
 *   alarmEmail         where alarms and budget warnings are sent
 *   mailFrom           the sender of every email (with messagingProvider "aws")
 *   monthlyBudgetUsd   warn when the month's bill passes 80% of this
 *   domainName, hostedZoneId, hostedZoneName   your own domain in Route 53
 *   githubRepo         "owner/name": also create the role GitHub Actions deploys with
 *   githubProviderArn  only if the account already has the GitHub sign-in provider
 */
const app = new App();
const context = (name: string): string | undefined => {
  const value: unknown = app.node.tryGetContext(name);
  return typeof value === "string" && value !== "" ? value : undefined;
};
// The account of the AWS login you deploy with.
const account = process.env.CDK_DEFAULT_ACCOUNT;
const environment = context("env") ?? "demo";

if (environment === "stage") {
  const config = resolveStageConfig({ siteUrl: context("siteUrl"), alarmEmail: context("alarmEmail"), monthlyBudgetUsd: context("monthlyBudgetUsd") });
  new StageStack(app, "NammaTrails-Stage", { env: { account, region: config.region }, config });
} else {
  const config = resolveConfig(environment, {
    siteUrl: context("siteUrl"),
    mailFrom: context("mailFrom"),
    alarmEmail: context("alarmEmail"),
    monthlyBudgetUsd: context("monthlyBudgetUsd"),
    domainName: context("domainName"),
    hostedZoneId: context("hostedZoneId"),
    hostedZoneName: context("hostedZoneName"),
  });
  buildStacks(app, config, { account, githubRepo: context("githubRepo"), githubProviderArn: context("githubProviderArn") });
}

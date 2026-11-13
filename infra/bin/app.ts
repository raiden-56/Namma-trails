#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { resolveConfig } from "../config/environments";
import { buildStacks } from "../lib/build-stacks";

/**
 * Entry point of the CDK app.
 *
 * Pick the environment with `-c env=demo` (the default) or `-c env=production`.
 * Other optional values, also passed with -c:
 *   siteUrl            the CloudFront address, when you have no domain (second deploy)
 *   alarmEmail         where alarms and budget warnings are sent
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

const config = resolveConfig(context("env") ?? "demo", {
  siteUrl: context("siteUrl"),
  alarmEmail: context("alarmEmail"),
  monthlyBudgetUsd: context("monthlyBudgetUsd"),
  domainName: context("domainName"),
  hostedZoneId: context("hostedZoneId"),
  hostedZoneName: context("hostedZoneName"),
});

buildStacks(app, config, {
  // The account of the AWS login you deploy with.
  account: process.env.CDK_DEFAULT_ACCOUNT,
  githubRepo: context("githubRepo"),
  githubProviderArn: context("githubProviderArn"),
});

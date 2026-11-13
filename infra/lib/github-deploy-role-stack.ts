import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

export interface GithubDeployRoleStackProps extends StackProps {
  /** The GitHub repository that may deploy, as "owner/name". */
  repository: string;
  /**
   * If this AWS account already has the GitHub sign-in provider
   * (token.actions.githubusercontent.com), pass its ARN. An account can have only one.
   */
  existingProviderArn?: string;
}

/**
 * Lets GitHub Actions deploy without any stored AWS key. GitHub proves which
 * repository is running (OpenID Connect), and AWS hands out a short-lived login for
 * the role below. The role can do one thing: use the roles `cdk bootstrap` made.
 */
export class GithubDeployRoleStack extends Stack {
  constructor(scope: Construct, id: string, props: GithubDeployRoleStackProps) {
    super(scope, id, props);
    if (!/^[\w.-]+\/[\w.-]+$/.test(props.repository)) throw new Error(`githubRepo must look like "owner/name", got "${props.repository}".`);

    const provider = props.existingProviderArn
      ? iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, "GithubProvider", props.existingProviderArn)
      : new iam.OpenIdConnectProvider(this, "GithubProvider", {
          url: "https://token.actions.githubusercontent.com",
          clientIds: ["sts.amazonaws.com"],
        });

    const role = new iam.Role(this, "DeployRole", {
      roleName: "namma-trails-github-deploy",
      description: `Lets GitHub Actions in ${props.repository} run cdk deploy`,
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
        StringLike: { "token.actions.githubusercontent.com:sub": `repo:${props.repository}:*` },
      }),
    });
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:${this.partition}:iam::${this.account}:role/cdk-*`],
      }),
    );

    new CfnOutput(this, "DeployRoleArn", { value: role.roleArn, description: "Save this in GitHub as the repository variable AWS_DEPLOY_ROLE_ARN" });
  }
}

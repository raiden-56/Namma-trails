import { Tags, type App } from "aws-cdk-lib";
import type { EnvironmentConfig } from "../config/environments";
import { AppStack } from "./app-stack";
import { DataStack } from "./data-stack";
import { EdgeCertificateStack } from "./edge-certificate-stack";
import { GithubDeployRoleStack } from "./github-deploy-role-stack";
import { NetworkStack } from "./network-stack";

export interface BuildOptions {
  /** The AWS account. Left out, the stacks use whatever account you are signed in to. */
  account?: string;
  /** "owner/name": also create the role that lets GitHub Actions deploy. */
  githubRepo?: string;
  githubProviderArn?: string;
}

/** Creates every stack of one environment. Used by bin/app.ts and by the tests. */
export function buildStacks(app: App, config: EnvironmentConfig, options: BuildOptions = {}) {
  const { account } = options;
  const env = { account, region: config.region };
  const stackName = (part: string) => `NammaTrails-${config.name[0]?.toUpperCase()}${config.name.slice(1)}-${part}`;
  // Stacks that hold real data cannot be deleted by accident.
  const protect = config.database.protectData;

  const network = new NetworkStack(app, stackName("Network"), { env, config, terminationProtection: protect });
  const data = new DataStack(app, stackName("Data"), { env, config, network, terminationProtection: protect });

  // Only with your own domain: its HTTPS certificate, which CloudFront wants in us-east-1.
  const edgeCertificate = config.domain
    ? new EdgeCertificateStack(app, stackName("EdgeCertificate"), {
        env: { account, region: "us-east-1" },
        crossRegionReferences: true,
        domain: config.domain,
      })
    : undefined;

  const application = new AppStack(app, stackName("App"), {
    env,
    crossRegionReferences: Boolean(edgeCertificate),
    config,
    network,
    data,
    edgeCertificate: edgeCertificate?.certificate,
  });

  const githubDeployRole = options.githubRepo
    ? new GithubDeployRoleStack(app, "NammaTrails-GithubDeployRole", {
        env,
        repository: options.githubRepo,
        existingProviderArn: options.githubProviderArn,
      })
    : undefined;

  // Every resource gets these tags, so the bill can be split by project and environment.
  Tags.of(app).add("Project", "namma-trails");
  Tags.of(app).add("Environment", config.name);
  Tags.of(app).add("ManagedBy", "cdk");

  return { network, data, edgeCertificate, application, githubDeployRole };
}

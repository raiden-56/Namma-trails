import { Stack, type StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";
import type { DomainConfig } from "../config/environments";

export interface EdgeCertificateStackProps extends StackProps {
  domain: DomainConfig;
}

/**
 * The HTTPS certificate for your own domain. CloudFront only accepts certificates
 * from the us-east-1 region, so this small stack lives there. The certificate is
 * free, is proven through a DNS record in your hosted zone, and renews by itself.
 */
export class EdgeCertificateStack extends Stack {
  readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: EdgeCertificateStackProps) {
    super(scope, id, props);
    const { domain } = props;
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId: domain.hostedZoneId,
      zoneName: domain.hostedZoneName,
    });
    this.certificate = new acm.Certificate(this, "Certificate", {
      domainName: domain.name,
      subjectAlternativeNames: domain.alternateNames,
      validation: acm.CertificateValidation.fromDns(zone),
    });
  }
}

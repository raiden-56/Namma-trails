import { Duration } from "aws-cdk-lib";
import * as appscaling from "aws-cdk-lib/aws-applicationautoscaling";
import type * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import type { EnvironmentConfig, ServiceSizing } from "../config/environments";

export interface ScalingServiceProps {
  cluster: ecs.ICluster;
  taskDefinition: ecs.FargateTaskDefinition;
  /** The container that takes the traffic, and its port. */
  containerName: string;
  containerPort: number;
  sizing: ServiceSizing;
  securityGroup: ec2.ISecurityGroup;
  subnets: ec2.SubnetSelection;
  assignPublicIp: boolean;

  listener: elbv2.ApplicationListener;
  /**
   * Which requests go to this service. Leave out to make it the default: every
   * request that no other rule takes.
   */
  routing?: { priority: number; pathPatterns: string[] };
  /** The load balancer calls this path to see if a task is healthy. */
  healthCheckPath: string;
  /** How long a new task gets to start before failed health checks count against it. */
  startupGrace: Duration;

  nightlyStop?: EnvironmentConfig["nightlyStop"];
}

/**
 * One container service that scales by itself:
 *
 *   - It runs on Fargate (no servers to manage). Tasks above `onDemandBase` use
 *     Fargate Spot, which is about 70% cheaper.
 *   - The load balancer only sends traffic to healthy tasks.
 *   - Auto scaling adds tasks when CPU or requests per task go above the target, and
 *     removes them again when it is quiet, always between minTasks and maxTasks.
 *   - A bad new version is rolled back by itself (deployment circuit breaker).
 */
export class ScalingService extends Construct {
  readonly service: ecs.FargateService;
  readonly targetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: ScalingServiceProps) {
    super(scope, id);
    const { sizing } = props;

    // Spot for everything above the on-demand base. With spot off: on-demand only.
    const capacityProviderStrategies: ecs.CapacityProviderStrategy[] = sizing.spot
      ? [
          ...(sizing.onDemandBase > 0 ? [{ capacityProvider: "FARGATE", base: sizing.onDemandBase, weight: 0 }] : []),
          { capacityProvider: "FARGATE_SPOT", weight: 1 },
        ]
      : [{ capacityProvider: "FARGATE", weight: 1 }];

    this.service = new ecs.FargateService(this, "Service", {
      cluster: props.cluster,
      taskDefinition: props.taskDefinition,
      securityGroups: [props.securityGroup],
      vpcSubnets: props.subnets,
      assignPublicIp: props.assignPublicIp,
      capacityProviderStrategies,
      // New version: start new tasks first, stop old ones only when the new ones are
      // healthy. If the new ones never get healthy, go back to the old version.
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: { enable: true, rollback: true },
      healthCheckGracePeriod: props.startupGrace,
      // Lets you open a shell in a running task: aws ecs execute-command ...
      enableExecuteCommand: true,
      propagateTags: ecs.PropagatedTagSource.SERVICE,
    });

    this.targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
      vpc: props.cluster.vpc,
      port: props.containerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      // Give open requests 30 seconds to finish when a task is taken out.
      deregistrationDelay: Duration.seconds(30),
      healthCheck: {
        path: props.healthCheckPath,
        healthyHttpCodes: "200",
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });
    this.targetGroup.addTarget(this.service.loadBalancerTarget({ containerName: props.containerName, containerPort: props.containerPort }));

    // The target group must be on the load balancer before request-based scaling is set up.
    if (props.routing) {
      props.listener.addTargetGroups(`${id}Route`, {
        targetGroups: [this.targetGroup],
        priority: props.routing.priority,
        conditions: [elbv2.ListenerCondition.pathPatterns(props.routing.pathPatterns)],
      });
    } else {
      props.listener.addTargetGroups(`${id}Default`, { targetGroups: [this.targetGroup] });
    }

    // ── Auto scaling ─────────────────────────────────────────────────────────
    const scaling = this.service.autoScaleTaskCount({ minCapacity: sizing.minTasks, maxCapacity: sizing.maxTasks });
    // Scale out quickly (1 minute), scale in slowly (5 minutes), so a short dip in
    // traffic does not remove tasks that are needed again a moment later.
    const cooldowns = { scaleOutCooldown: Duration.minutes(1), scaleInCooldown: Duration.minutes(5) };
    scaling.scaleOnCpuUtilization("Cpu", { targetUtilizationPercent: sizing.targetCpuPercent, ...cooldowns });
    scaling.scaleOnRequestCount("Requests", {
      requestsPerTarget: sizing.targetRequestsPerTaskPerMinute,
      targetGroup: this.targetGroup,
      ...cooldowns,
    });

    if (props.nightlyStop) {
      const { stopAtUtc, startAtUtc } = props.nightlyStop;
      scaling.scaleOnSchedule("NightlyStop", {
        schedule: appscaling.Schedule.cron({ hour: String(stopAtUtc.hour), minute: String(stopAtUtc.minute) }),
        minCapacity: 0,
        maxCapacity: 0,
      });
      scaling.scaleOnSchedule("MorningStart", {
        schedule: appscaling.Schedule.cron({ hour: String(startAtUtc.hour), minute: String(startAtUtc.minute) }),
        minCapacity: sizing.minTasks,
        maxCapacity: sizing.maxTasks,
      });
    }
  }
}

import * as cdk from '@aws-cdk/core'
import * as lambda from '@aws-cdk/aws-lambda'
import * as ecr from '@aws-cdk/aws-ecr'
import * as ecs from '@aws-cdk/aws-ecs'
import * as iam from '@aws-cdk/aws-iam'
import * as ecsPatterns from '@aws-cdk/aws-ecs-patterns'
import * as acm from '@aws-cdk/aws-certificatemanager'
import * as ec2 from '@aws-cdk/aws-ec2'
import { App, CfnParameter, Stack, StackProps } from '@aws-cdk/core'
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2'
import { CompositePrincipal } from '@aws-cdk/aws-iam'

export interface PipelineStackProps extends StackProps {
  readonly lambdaCode: lambda.CfnParametersCode
  readonly repoName: string
}

export class DevopsDemoPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: PipelineStackProps) {
    super(scope, id, props)

    const vpc = new ec2.Vpc(this, 'DemoVPC', {
      cidr: '10.0.0.0/16',
      maxAzs: 3,
      subnetConfiguration: [
        { cidrMask: 24, name: 'Public', subnetType: ec2.SubnetType.PUBLIC },
      ],
    })

    const certificateArn = new CfnParameter(this, 'certificateArn', {
      type: 'String',
      description: 'The ARN of the certificate to use in the ALB',
    })

    const albCertificate = acm.Certificate.fromCertificateArn(
      this,
      'domainCertificate',
      certificateArn.valueAsString
    )

    const repository = new ecr.Repository(this, 'DevopsDemo', {
      repositoryName: 'devops-demo',
    })

    const githubUser = new iam.User(this, 'GithubUser', {
      userName: 'GithubUser',
    })

    const policy = new iam.Policy(this, 'PushToDevopsECR', {
      users: [githubUser],
      statements: [
        new iam.PolicyStatement({
          resources: ['*'],
          actions: [
            'ecr:GetAuthorizationToken',
            'ecs:RegisterTaskDefinition',
            'ecs:UpdateService',
            'ecs:DescribeServices',
            'iam:PassRole',
          ],
        }),
      ],
    })

    const policyDocument = new iam.PolicyDocument()

    repository.grantPullPush(githubUser)

    const ecsCluster = new ecs.Cluster(this, 'DevopsDemoCluster', {
      clusterName: 'devops-demo-cluster',
      vpc,
    })

    ecsCluster.addCapacity('AsgSpot', {
      instanceType: new ec2.InstanceType('t2.micro'),
      spotPrice: '0.01',
      minCapacity: 2,
      desiredCapacity: 2,
    })

    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      targetGroupName: 'ECSTargetGroup',
      targetType: elbv2.TargetType.INSTANCE,
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
    })

    const alb = new elbv2.ApplicationLoadBalancer(this, 'DemoAlb', {
      loadBalancerName: 'DemoALB',
      vpc: vpc,
    })

    const listener = alb.addListener('https', {
      certificates: [albCertificate],
      protocol: elbv2.ApplicationProtocol.HTTPS,
      defaultTargetGroups: [targetGroup],
    })
  }
}

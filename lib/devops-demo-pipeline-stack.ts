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

    policy.attachToUser(githubUser)

    const instanceRole = new iam.Role(this, 'InstanceRole', {
      roleName: 'EcsInstanceRole',
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonEC2ContainerServiceforEC2Role'
        ),
      ],
    })

    const executionRole = new iam.Role(this, 'ExecutionRole', {
      roleName: 'TaskExecutionRole',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy'
        ),
      ],
    })

    const ecsServiceRole = new iam.Role(this, 'ServiceRole', {
      roleName: 'EcsServiceRole',
      assumedBy: new iam.ServicePrincipal('ecs.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonEC2ContainerServiceRole'
        ),
      ],
    })

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



    const baseTask = new ecs.Ec2TaskDefinition(this, 'DemoTaskDefinition', {
      family: 'roman-numeral-translator',
      executionRole: executionRole,
    })

    const container = baseTask.addContainer('RomanTranslatorContainer', {
      image: ecs.ContainerImage.fromRegistry('httpd:2.4'),
      essential: true,
      entryPoint: ['sh', '-c'],
      command: [
        '/bin/sh -c "echo \'<html> <head> <title>Amazon ECS Sample App</title> <style>body {margin-top: 40px; background-color: #333;} </style> </head><body> <div style=color:white;text-align:center> <h1>Amazon ECS Sample App</h1> <h2>Congratulations!</h2> <p>Your application is now running on a container in Amazon ECS.</p> </div></body></html>\' >  /usr/local/apache2/htdocs/index.html && httpd-foreground"',
      ],
      memoryLimitMiB: 100
    })
    container.addPortMappings({
      hostPort: 3000,
      containerPort: 80,
      protocol: ecs.Protocol.TCP,
    })

    const service = new ecs.Ec2Service(this, 'RomanTranslatorService', {
      serviceName: 'roman-numeral-translator-service',
      cluster: ecsCluster,
      taskDefinition: baseTask,
      desiredCount: 2,
      placementStrategies:[ecs.PlacementStrategy.spreadAcrossInstances()],
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
      internetFacing: true
    })

    const listener = alb.addListener('https', {
      certificates: [albCertificate],
      protocol: elbv2.ApplicationProtocol.HTTPS,
      defaultTargetGroups: [targetGroup],
    })
  }
}

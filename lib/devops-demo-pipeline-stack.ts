import * as cdk from '@aws-cdk/core'
import * as codebuild from '@aws-cdk/aws-codebuild'
import * as codecommit from '@aws-cdk/aws-codecommit'
import * as codepipeline from '@aws-cdk/aws-codepipeline'
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions'
import * as lambda from '@aws-cdk/aws-lambda'
import  * as ecr from '@aws-cdk/aws-ecr'
import { App, Stack, StackProps } from '@aws-cdk/core'

export interface PipelineStackProps extends StackProps {
  readonly lambdaCode: lambda.CfnParametersCode;
  readonly repoName: string
}

export class DevopsDemoPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: PipelineStackProps) {
    super(scope, id, props)

    const repository = new ecr.Repository(this, 'DevopsDemo', {
      repositoryName: 'devops-demo',
    });
  }
}

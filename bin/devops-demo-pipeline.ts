#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { DevopsDemoPipelineStack } from '../lib/devops-demo-pipeline-stack';

const app = new cdk.App();
new DevopsDemoPipelineStack(app, 'DevopsDemoPipelineStack');

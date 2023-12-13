#!/usr/bin/env node

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PredictiveMaintenanceDemoStack } from '../lib/predictive-maintenance-demo-stack';
import { CfnGuardValidator } from '@cdklabs/cdk-validator-cfnguard';

const app = new cdk.App({
  policyValidationBeta1: [
    new CfnGuardValidator({
      disabledRules: [
        'ct-lambda-pr-2', // https://docs.aws.amazon.com/controltower/latest/userguide/lambda-rules.html#ct-lambda-pr-2-description'
        'ct-lambda-pr-3', // https://docs.aws.amazon.com/controltower/latest/userguide/lambda-rules.html#ct-lambda-pr-3-description'
      ],
    }),
  ],
});

new PredictiveMaintenanceDemoStack(app, 'PredictiveMaintenanceDemoStack', {});

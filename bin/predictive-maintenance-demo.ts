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
        'ct-s3-pr-9', // https://docs.aws.amazon.com/controltower/latest/userguide/s3-rules.html#ct-s3-pr-9-description
        'ct-s3-pr-6', // https://docs.aws.amazon.com/controltower/latest/userguide/s3-rules.html#ct-s3-pr-6-description
        'ct-s3-pr-4', // https://docs.aws.amazon.com/controltower/latest/userguide/s3-rules.html#ct-s3-pr-4-description
        'ct-s3-pr-3', // https://docs.aws.amazon.com/controltower/latest/userguide/s3-rules.html#ct-s3-pr-3-description
        'ct-s3-pr-2', // https://docs.aws.amazon.com/controltower/latest/userguide/s3-rules.html#ct-s3-pr-2-description
        'ct-s3-pr-10', // https://docs.aws.amazon.com/controltower/latest/userguide/s3-rules.html#ct-s3-pr-10-description
        'ct-s3-pr-1', // https://docs.aws.amazon.com/controltower/latest/userguide/s3-rules.html#ct-s3-pr-1-description
      ],
    }),
  ],
});

new PredictiveMaintenanceDemoStack(app, 'PredictiveMaintenanceDemoStack', {});

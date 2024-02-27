// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import { Stack, StackProps, aws_iot, CfnOutput, Names } from 'aws-cdk-lib';
import { GreenGrassStack } from './greengrass/greengrass-stack';
import { TimeStream } from './time-stream';
import { Grafana } from './grafana/grafana';

export class PredictiveMaintenanceDemoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const thingGroup = new aws_iot.CfnThingGroup(this, 'DemoThingGroup', {
      thingGroupName: Names.uniqueResourceName(this, {}) + '-Group',
    });

    const thing = new aws_iot.CfnThing(this, 'DemoThing', {
      thingName: Names.uniqueResourceName(this, {}) + '-Thing',
    });

    const { subscribeCommand } = new GreenGrassStack(this, 'GreenGrassStack', {
      thing,
      thingGroup,
    });

    const { database, table } = new TimeStream(this, 'TimeStream');

    const grafana = new Grafana(this, 'Grafana', {
      timestream: { database, table },
    });

    new CfnOutput(this, 'GrafanaUrl', {
      description: 'Grafana Url',
      value: 'https://' + grafana.url,
    });

    new CfnOutput(this, 'GreenGrassSubscribeCommand', {
      value: subscribeCommand,
    });
  }
}

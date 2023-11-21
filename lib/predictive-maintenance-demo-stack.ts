import { Stack, StackProps, aws_iot, CfnOutput, Names } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { GreenGrassStack } from './greengrass/greengrass-stack';

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

    new CfnOutput(this, 'GreenGrassSubscribeCommand', {
      value: subscribeCommand,
    });
  }
}

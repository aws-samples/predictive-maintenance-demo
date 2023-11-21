import {
  NestedStack,
  NestedStackProps,
  aws_greengrassv2,
  aws_s3_assets,
  aws_iam,
  aws_iot,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface GreenGrassStackProps extends NestedStackProps {
  thing: aws_iot.CfnThing;
  thingGroup: aws_iot.CfnThingGroup;
}

export class GreenGrassStack extends NestedStack {
  public readonly subscribeCommand: string;
  constructor(scope: Construct, id: string, props: GreenGrassStackProps) {
    super(scope, id, props);

    const role = new aws_iam.Role(this, 'GreengrassRole', {
      assumedBy: new aws_iam.ServicePrincipal('credentials.iot.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSAppRunnerServicePolicyForECRAccess'
        ),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonKinesisVideoStreamsFullAccess'),
      ],
    });

    const policy = new aws_iam.ManagedPolicy(this, 'GreenGrassPolicy', {
      managedPolicyName: role.roleName + 'Access',
      roles: [role],
      statements: [
        new aws_iam.PolicyStatement({
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
            'logs:DescribeLogStreams',
            'iot:GetThingShadow',
            'iot:UpdateThingShadow',
            'iot:DeleteThingShadow',
          ],
          resources: ['*'],
        }),
      ],
    });

    const roleAlias = new aws_iot.CfnRoleAlias(this, 'RoleAliasName', {
      roleAlias: role.roleName + 'Alias',
      roleArn: role.roleArn,
    });

    const { assetHash, s3ObjectKey, s3ObjectUrl } = new aws_s3_assets.Asset(this, 'SensorAsset', {
      path: 'lib/greengrass/components/sensors',
    });
    const assetFolder = s3ObjectKey.replace('.zip', '');

    const componentVersions = {
      sensors: new aws_greengrassv2.CfnComponentVersion(this, 'SensorsComponentVersion', {
        inlineRecipe: JSON.stringify({
          RecipeFormatVersion: '2020-01-25',
          ComponentName: 'sensors',
          ComponentPublisher: 'Amazon Web Services',
          ComponentVersion: '1.0.45',
          Manifests: [
            {
              Platform: {
                os: 'linux',
              },
              Artifacts: [
                {
                  URI: s3ObjectUrl,
                  Unarchive: 'ZIP',
                },
              ],
              Lifecycle: {
                Setenv: {
                  GREENGRASS_GROUP_ID: props.thingGroup.attrId,
                  GREENGRASS_GROUP_NAME: props.thingGroup.thingGroupName,
                  GREENGRASS_THING_NAME: props.thing.thingName,
                  PREDICTION_STREAM_NAME: 'LocalRawData',
                  TRAINING_STREAM_NAME: 'PredMaintRawData',
                  IOT_ANALYTICS_CHANNEL_NAME: 'predmaint_channel',
                  MODBUS_DEVICE: '/dev/serial0',
                  MODBUS_SLAVE_ADDRESS: '1',
                  MODBUS_READING_INTERVAL: '1',
                },
                RequiresPrivilege: true,
                // install: 'apt-get update\napt-get install python3.7',
                // install: `rm -rf * && cp -r {artifacts:decompressedPath}/* . && cd ${assetFolder} && pip3 install --break-system-packages -r requirements.txt`,
                // install: `rm -rf * && cp -r {artifacts:decompressedPath}/* . && cd ${assetFolder} && python3 -m venv ./.venv && source .venv/bin/activate && pip3 install -r requirements.txt`,
                // install: `echo '###### installing' && whoami && rm -rf * && cp -r {artifacts:decompressedPath}/* . && cd ${assetFolder} && python3 -m venv venv && . venv/bin/activate && pip3 install wheel setuptools awscrt && pip3 install -r requirements.txt`,
                // install: `echo '###### installing' && rm -rf * && cp -r {artifacts:decompressedPath}/* . && cd ${assetFolder} && python3 -m venv venv && ls && . venv/bin/activate`,
                // install: `rm -rf * && cp -r {artifacts:decompressedPath}/* .`,
                // run: `echo '###### running' && cd ${assetFolder} && . venv/bin/activate && python3 index.py`,
                install: `echo '###### installing' && whoami && rm -rf * && cp -r {artifacts:decompressedPath}/* . && cd ${assetFolder}`,
                run: `echo '###### running' && whoami && cd ${assetFolder} && python3 index.py`,
              },
            },
          ],
        }),
      }),
    };

    const components: any = {
      'aws.greengrass.Nucleus': {
        componentVersion: '2.12.0',
      },
      'aws.greengrass.StreamManager': {
        componentVersion: '2.1.11',
      },
      'aws.greengrass.TokenExchangeService': {
        componentVersion: '2.0.3',
      },
      'aws.greengrass.clientdevices.Auth': {
        componentVersion: '2.4.4',
      },
      'aws.greengrass.clientdevices.mqtt.Bridge': {
        componentVersion: '2.3.0',
        configurationUpdate: {
          merge: JSON.stringify({
            mqttTopicMapping: {
              ShadowsLocalMqttToPubsub: {
                topic: `$aws/things/${props.thing.thingName}/shadow/#`,
                source: 'LocalMqtt',
                target: 'Pubsub',
              },
              ShadowsPubsubToLocalMqtt: {
                topic: `$aws/things/${props.thing.thingName}/shadow/#`,
                source: 'Pubsub',
                target: 'LocalMqtt',
              },
            },
          }),
        },
      },
      'aws.greengrass.ShadowManager': {
        componentVersion: '2.3.5',
        configurationUpdate: {
          merge: JSON.stringify({
            synchronize: {
              coreThing: {
                classic: false,
                namedShadows: [props.thing.thingName],
              },
              shadowDocuments: [
                {
                  classic: false,
                  thingName: props.thing.thingName,
                  namedShadows: [props.thing.thingName],
                },
              ],
              direction: 'betweenDeviceAndCloud',
            },
            rateLimits: {
              maxOutboundSyncUpdatesPerSecond: 100,
              maxTotalLocalRequestsRate: 200,
              maxLocalRequestsPerSecondPerThing: 20,
            },
            shadowDocumentSizeLimitBytes: 8192,
          }),
        },
      },
    };
    for (const [name, component] of Object.entries(componentVersions)) {
      components[name] = {
        componentVersion: component.attrComponentVersion,
        configurationUpdate: {
          reset: [''],
          merge: JSON.stringify({
            accessControl: {
              'aws.greengrass.ShadowManager': {
                [`${name}:shadow:1`]: {
                  policyDescription: 'Allows access to shadows',
                  operations: [
                    'aws.greengrass#GetThingShadow',
                    'aws.greengrass#UpdateThingShadow',
                    'aws.greengrass#DeleteThingShadow',
                    'aws.greengrass#ListNamedShadowsForThing',
                  ],
                  resources: ['*'],
                },
              },
              'aws.greengrass.ipc.mqttproxy': {
                [`${name}:mqttproxy:1`]: {
                  policyDescription: 'Allows access to publish/subscribe to all topics.',
                  operations: [
                    'aws.greengrass#PublishToIoTCore',
                    'aws.greengrass#SubscribeToIoTCore',
                  ],
                  resources: ['*'],
                },
              },
            },
          }),
        },
      };
    }

    const deployment = new aws_greengrassv2.CfnDeployment(this, 'Deployment', {
      targetArn: props.thing.attrArn,
      components,
    });

    this.subscribeCommand = `sudo -E java -Droot="/greengrass/v2" -Dlog.store=FILE -jar ./GreengrassInstaller/lib/Greengrass.jar --aws-region ${this.region} --thing-name ${props.thing.thingName} --thing-group-name ${props.thingGroup.thingGroupName} --component-default-user ggc_user:ggc_group --provision true --tes-role-name ${role.roleName} --tes-role-alias-name ${roleAlias.roleAlias} --setup-system-service true --deploy-dev-tools true`;
  }
}

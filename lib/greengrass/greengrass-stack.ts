// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { NestedStack, NestedStackProps, aws_greengrassv2, aws_s3_assets, aws_iam, aws_iot, aws_s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface GreenGrassStackProps extends NestedStackProps {
  thing: aws_iot.CfnThing;
  thingGroup: aws_iot.CfnThingGroup;
}

export class GreenGrassStack extends NestedStack {
  public readonly subscribeCommand: string;
  constructor(scope: Construct, id: string, props: GreenGrassStackProps) {
    super(scope, id, props);

    const mlBucketPath = this.node.tryGetContext('mlBucketPath');
    const predictComponentVersion = this.node.tryGetContext('predictComponentVersion');
    const sensorsComponentVersion = this.node.tryGetContext('sensorsComponentVersion');

    const role = new aws_iam.Role(this, 'GreengrassRole', {
      assumedBy: new aws_iam.ServicePrincipal('credentials.iot.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSAppRunnerServicePolicyForECRAccess'),
      ],
    });

    const serviceRole = new aws_iam.Role(this, 'GreengrassServiceRole', {
      assumedBy: new aws_iam.ServicePrincipal('greengrass.amazonaws.com'),
    });

    const policy = new aws_iam.ManagedPolicy(this, 'GreenGrassPolicy', {
      managedPolicyName: role.roleName + 'Access',
      roles: [role, serviceRole],
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

    const iotPolicy = new aws_iot.CfnPolicy(this, 'IotPolicy', {
      policyName: role.roleName + 'Access',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['iot:*', 'greengrass:*'],
            Resource: '*',
          },
        ],
      },
    });

    const rolePolicy = new aws_iot.CfnPolicy(this, 'RolePolicy', {
      policyName: 'GreengrassTESCertificatePolicy' + role.roleName + 'Alias',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['iot:*', 'greengrass:*'],
            Resource: '*',
          },
        ],
      },
    });

    const roleAlias = new aws_iot.CfnRoleAlias(this, 'RoleAliasName', {
      roleAlias: role.roleName + 'Alias',
      roleArn: role.roleArn,
    });

    const roleAlias2 = new aws_iot.CfnRoleAlias(this, 'RoleAliasName2', {
      roleAlias: 'GreengrassTESCertificatePolicy' + role.roleName + 'Alias',
      roleArn: role.roleArn,
    });

    const sensorAsset = new aws_s3_assets.Asset(this, 'SensorAsset', {
      path: 'lib/greengrass/components/sensors',
    });
    const sensorAssetFolder = sensorAsset.s3ObjectKey.replace('.zip', '');

    const predictAsset = new aws_s3_assets.Asset(this, 'PredictAsset', {
      path: 'lib/greengrass/components/predict',
    });
    const predictAssetFolder = predictAsset.s3ObjectKey.replace('.zip', '');

    const componentVersions = {
      predict: new aws_greengrassv2.CfnComponentVersion(this, 'PredictComponentVersion', {
        inlineRecipe: JSON.stringify({
          RecipeFormatVersion: '2020-01-25',
          ComponentName: 'predict',
          ComponentPublisher: 'Amazon Web Services',
          ComponentVersion: predictComponentVersion,
          Manifests: [
            {
              Platform: {
                os: 'linux',
              },
              Artifacts: [
                {
                  URI: predictAsset.s3ObjectUrl,
                  Unarchive: 'ZIP',
                },
                { URI: mlBucketPath },
              ],
              Lifecycle: {
                Setenv: {
                  MODEL_PATH: `{artifacts:path}/${mlBucketPath.split('/').pop()}`,
                  GREENGRASS_GROUP_ID: props.thingGroup.attrId,
                  GREENGRASS_GROUP_NAME: props.thingGroup.thingGroupName,
                  GREENGRASS_THING_NAME: props.thing.thingName,
                  PREDICTION_STREAM_NAME: 'LocalRawData',
                  GPIOZERO_PIN_FACTORY: 'native',
                },
                install: `echo '###### installing' && python3 -m venv venv && . venv/bin/activate && pip install -r {artifacts:decompressedPath}/${predictAssetFolder}/requirements.txt`,
                run: `echo '###### running' && . venv/bin/activate && python3 {artifacts:decompressedPath}/${predictAssetFolder}/index.py`,
              },
            },
          ],
        }),
      }),
      sensors: new aws_greengrassv2.CfnComponentVersion(this, 'SensorsComponentVersion', {
        inlineRecipe: JSON.stringify({
          RecipeFormatVersion: '2020-01-25',
          ComponentName: 'sensors',
          ComponentPublisher: 'Amazon Web Services',
          ComponentVersion: sensorsComponentVersion,
          Manifests: [
            {
              Platform: {
                os: 'linux',
              },
              Artifacts: [
                {
                  URI: sensorAsset.s3ObjectUrl,
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
                install: `echo '###### installing' && python3 -m venv venv && . venv/bin/activate && pip install -r {artifacts:decompressedPath}/${sensorAssetFolder}/requirements.txt`,
                run: `echo '###### running' && . venv/bin/activate && python3 {artifacts:decompressedPath}/${sensorAssetFolder}/index.py`,
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
      'aws.greengrass.TokenExchangeService': {
        componentVersion: '2.0.3',
      },
      'aws.greengrass.StreamManager': {
        componentVersion: '2.1.11',
      },
      'aws.greengrass.clientdevices.Auth': {
        componentVersion: '2.4.4',
        configurationUpdate: {
          merge: JSON.stringify({
            deviceGroups: {
              formatVersion: '2021-03-05',
              definitions: {
                MyPermissiveDeviceGroup: {
                  selectionRule: 'thingName: *',
                  policyName: 'MyPermissivePolicy',
                },
              },
              policies: {
                MyPermissivePolicy: {
                  AllowAll: {
                    statementDescription: 'Allow client devices to perform all actions.',
                    operations: ['*'],
                    resources: ['*'],
                  },
                },
              },
            },
          }),
        },
      },
      'aws.greengrass.clientdevices.mqtt.Bridge': {
        componentVersion: '2.3.0',
      },
      'aws.greengrass.ShadowManager': {
        componentVersion: '2.3.5',
        configurationUpdate: {
          merge: JSON.stringify({
            strategy: {
              type: 'periodic',
              delay: 300,
            },
            synchronize: {
              shadowDocumentsMap: {
                [`${props.thing.thingName}`]: {
                  classic: false,
                  namedShadows: [props.thing.thingName],
                },
              },
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
                  operations: ['aws.greengrass#PublishToIoTCore', 'aws.greengrass#SubscribeToIoTCore'],
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

    this.subscribeCommand = `sudo -E java -Droot="/greengrass/v2" -Dlog.store=FILE -jar ./GreengrassInstaller/lib/Greengrass.jar --aws-region ${
      this.region
    } --thing-name ${props.thing.thingName} --thing-group-name ${
      props.thingGroup.thingGroupName
    } --component-default-user ggc_user:ggc_group --provision true --thing-policy-name ${iotPolicy.policyName} --tes-role-name ${
      role.roleName
    } --tes-role-alias-name ${role.roleName + 'Alias'} --setup-system-service true --deploy-dev-tools true`;
  }
}

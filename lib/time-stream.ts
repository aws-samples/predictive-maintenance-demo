import { Construct } from 'constructs';
import { Names, aws_timestream, aws_iot, aws_iam } from 'aws-cdk-lib';

export class TimeStream extends Construct {
  database: string;
  table: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const database = new aws_timestream.CfnDatabase(this, 'Database', {
      databaseName: Names.uniqueId(this) + 'Data',
    });
    const table = new aws_timestream.CfnTable(this, 'Table', {
      databaseName: database.databaseName!,
      tableName: Names.uniqueId(this) + 'Telemetry',
    });
    table.node.addDependency(database);

    const timeStreamAccessRole = new aws_iam.Role(this, 'topicIotTimeStreamRole', {
      assumedBy: new aws_iam.ServicePrincipal('iot.amazonaws.com'),
      managedPolicies: [
        aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonTimestreamFullAccess'),
      ],
    });

    const topicRule = new aws_iot.CfnTopicRule(this, 'TopicRule', {
      topicRulePayload: {
        sql: "SELECT * FROM 'prediction/#'",
        actions: [
          {
            timestream: {
              databaseName: database.databaseName!,
              tableName: table.tableName!,
              dimensions: [
                {
                  name: 'device_name',
                  value: '${topic(2)}',
                },
              ],
              roleArn: timeStreamAccessRole.roleArn,
            },
          },
        ],
      },
    });
    topicRule.node.addDependency(database);
    topicRule.node.addDependency(table);

    this.database = database.databaseName!;
    this.table = table.tableName!;
  }
}

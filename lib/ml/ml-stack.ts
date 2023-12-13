import { Construct } from 'constructs';
import { NestedStack, NestedStackProps, RemovalPolicy, aws_s3, aws_s3_deployment } from 'aws-cdk-lib';

export class MlStack extends NestedStack {
  public mlBucket: aws_s3.IBucket;

  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, props);

    const bucket = new aws_s3.Bucket(this, 'MlBucket', {
      versioned: true,
      enforceSSL: true,
      // encryption: aws_s3.BucketEncryption.S3_MANAGED,
      // blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const deployment = new aws_s3_deployment.BucketDeployment(this, 'DeployModel', {
      sources: [aws_s3_deployment.Source.asset('lib/ml/models.zip')],
      // extract: false,
      destinationBucket: bucket,
      retainOnDelete: false,
    });

    this.mlBucket = deployment.deployedBucket;
  }
}

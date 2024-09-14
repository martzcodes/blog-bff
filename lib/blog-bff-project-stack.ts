import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { RestApi, EndpointType, LogGroupLogDestination, AccessLogFormat, LambdaIntegration, AuthorizationType, ApiKey } from 'aws-cdk-lib/aws-apigateway';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { join } from 'path';

export interface BlogBffProjectStackProps extends StackProps {
  projectName: string;
}

export class BlogBffProjectStack extends Stack {
  constructor(scope: Construct, id: string, props: BlogBffProjectStackProps) {
    super(scope, id, props);
    const { projectName } = props;
    
    const logs = new LogGroup(this, `/BFF${projectName}ApiLogs`, {
      logGroupName: `/BFF${projectName}Api`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const api = new RestApi(this, `BFF${projectName}Api`, {
      description: `BFF ${projectName} API`,
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
      defaultMethodOptions: {
        apiKeyRequired: true,
      },
      deployOptions: {
        dataTraceEnabled: true,
        tracingEnabled: true,
        metricsEnabled: true,
        accessLogDestination: new LogGroupLogDestination(logs),
        accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
      },
    });

    const fn = new NodejsFunction(this, `BFF${projectName}Function`, {
      entry: join(__dirname, './lambdas/hello.ts'),
      logRetention: RetentionDays.ONE_WEEK,
      runtime: Runtime.NODEJS_LATEST,
    });

    const proxyIntegration = new LambdaIntegration(fn, {
      proxy: true,
    });
    api.root.addProxy({
      defaultIntegration: proxyIntegration,
      anyMethod: true,
    });
  }
}

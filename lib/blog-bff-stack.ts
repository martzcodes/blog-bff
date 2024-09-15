import {
  Aspects,
  IAspect,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import {
  RestApi,
  EndpointType,
  LogGroupLogDestination,
  AccessLogFormat,
  HttpIntegration,
  PassthroughBehavior,
  IntegrationOptions,
  ApiKey,
  UsagePlan,
  CfnUsagePlan,
} from "aws-cdk-lib/aws-apigateway";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct, IConstruct } from "constructs";

export interface BlogBffStackProps extends StackProps {
  externalApis: Record<string, string>;
}

class AddApisToUsagePlanAspect implements IAspect {
  private readonly externalApiIds: string[];

  constructor(externalApiIds: string[]) {
    this.externalApiIds = externalApiIds;
  }

  public visit(node: IConstruct): void {
    if (node instanceof UsagePlan) {
      const usagePlan = node as UsagePlan;
      const cfnUsagePlan = usagePlan.node.defaultChild as CfnUsagePlan;
      const existingApiStages = Array.isArray(cfnUsagePlan.apiStages)
        ? cfnUsagePlan.apiStages
        : [];
      console.log(JSON.stringify(existingApiStages));

      // Add the external API to the usage plan
      cfnUsagePlan.apiStages = this.externalApiIds.map((apiId) => ({
        apiId,
        stage: "prod",
      })) as any;
    }
  }
}

export class BlogBffStack extends Stack {
  constructor(scope: Construct, id: string, props: BlogBffStackProps) {
    super(scope, id, props);

    const apiKey = new ApiKey(this, `BFFApiKey`, {
      apiKeyName: `BFFApiKey`,
    });

    const logs = new LogGroup(this, `/BFFApiLogs`, {
      logGroupName: `/BFFApi`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const api = new RestApi(this, `BFFApi`, {
      description: `BFF API`,
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
    const plan = new UsagePlan(this, "BFFUsagePlan", {
      name: "BFFUsagePlan",
      apiStages: [],
    });
    plan.addApiKey(apiKey);

    Aspects.of(this).add(
      new AddApisToUsagePlanAspect([
        api.restApiId,
        ...Object.values(props.externalApis),
      ])
    );

    const integrationOptions: IntegrationOptions = {
      passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
      requestParameters: {
        "integration.request.path.proxy": "method.request.path.proxy",
      },
      requestTemplates: {
        "application/json":
          "{\n" +
          "  \"body\" : $input.json('$'),\n" +
          '  "headers": {\n' +
          "    #foreach($header in $input.params().header.keySet())\n" +
          '    "$header": "$util.escapeJavaScript($input.params().header.get($header))"\n' +
          "    #if($foreach.hasNext),#end\n" +
          "    #end\n" +
          "  },\n" +
          '  "method": "$context.httpMethod",\n' +
          '  "params": {\n' +
          "    #foreach($param in $input.params().path.keySet())\n" +
          '    "$param": "$util.escapeJavaScript($input.params().path.get($param))"\n' +
          "    #if($foreach.hasNext),#end\n" +
          "    #end\n" +
          "  },\n" +
          '  "query": {\n' +
          "    #foreach($queryParam in $input.params().querystring.keySet())\n" +
          '    "$queryParam": "$util.escapeJavaScript($input.params().querystring.get($queryParam))"\n' +
          "    #if($foreach.hasNext),#end\n" +
          "    #end\n" +
          "  }\n" +
          "}\n",
      },
      integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": "'*'",
          },
        },
      ],
    };

    Object.entries(props.externalApis).forEach(([apiName, apiId]) => {
      const httpIntegration = new HttpIntegration(
        `https://${apiId}.execute-api.us-east-1.amazonaws.com/prod/{proxy}`,
        {
          options: integrationOptions,
          proxy: true,
          httpMethod: "ANY",
        }
      );

      api.root.addResource(apiName.toLowerCase()).addProxy({
        anyMethod: true,
        defaultIntegration: httpIntegration,
        defaultMethodOptions: {
          requestParameters: {
            "method.request.path.proxy": true,
          },
          methodResponses: [
            {
              statusCode: "200",
              responseParameters: {
                "method.response.header.Access-Control-Allow-Origin": true,
              },
            },
          ],
        },
      });
    });
  }
}

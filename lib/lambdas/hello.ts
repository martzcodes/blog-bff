import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log(JSON.stringify(event));
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Hello World! (${Math.random()})`,
      event,
    }, null, 2),
  };
};

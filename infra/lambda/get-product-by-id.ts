import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, GetCommandOutput } from "@aws-sdk/lib-dynamodb";

// Table names
const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || "products";
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME || "stock";

// Initialize the DynamoDB client
const dynamodb = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
}

interface Stock {
  product_id: string;
  count: number;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const productId = event?.pathParameters?.productId;
  console.log("Received event:", JSON.stringify(event, null, 2));
  console.log("Product ID:", productId);

  // Validate inputs
  if (!PRODUCTS_TABLE_NAME || !STOCK_TABLE_NAME) {
    console.error("Missing table names in environment variables");
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        error:
          "Environment variables PRODUCTS_TABLE_NAME and STOCK_TABLE_NAME are not set",
      }),
    };
  }

  if (!productId || typeof productId !== "string") {
    console.error("Invalid or missing `productId`");
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        error: "Invalid or missing `productId`",
      }),
    };
  }

  try {
    // Fetch product and stock concurrently
    const [productResponse, stockResponse]: [GetCommandOutput, GetCommandOutput] = await Promise.all([
      dynamodb.send(
        new GetCommand({
          TableName: PRODUCTS_TABLE_NAME,
          Key: { id: productId },
        })
      ),
      dynamodb.send(
        new GetCommand({
          TableName: STOCK_TABLE_NAME,
          Key: { product_id: productId },
        })
      ),
    ]);

    const product = productResponse.Item as Product | undefined;
    const stock = stockResponse.Item as Stock | undefined;

    if (!product) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: JSON.stringify({ error: "Product not found" }),
      };
    }

    // Combine product details with stock count
    const combinedProduct = {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      count: stock?.count || 0, // Default count to 0 if stock is not available
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify(combinedProduct),
    };
  } catch (error: any) {
    console.error("Error fetching product or stock data:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        error: "Failed to fetch product or stock information",
        details: error.message,
      }),
    };
  }
};

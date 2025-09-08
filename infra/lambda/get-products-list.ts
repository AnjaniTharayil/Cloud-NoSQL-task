import { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, ScanCommand, ScanCommandOutput } from "@aws-sdk/client-dynamodb";

const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || "products";
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME || "stock";

const dynamodb = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});

interface ProductItem {
  id: { S: string };
  title: { S: string };
  description: { S: string };
  price: { N: string };
}

interface StockItem {
  product_id: { S: string };
  count: { N: string };
}

export const handler: APIGatewayProxyHandler = async (
  event
): Promise<APIGatewayProxyResult> => {
  try {
    const [productsResult, stockResult]: [ScanCommandOutput, ScanCommandOutput] = await Promise.all([
      dynamodb.send(new ScanCommand({ TableName: PRODUCTS_TABLE_NAME })),
      dynamodb.send(new ScanCommand({ TableName: STOCK_TABLE_NAME })),
    ]);

    const products = (productsResult.Items || []).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
    })) as ProductItem[];

    const stock = (stockResult.Items || []).map((item) => ({
      product_id: item.product_id,
      count: item.count,
    })) as StockItem[];

    const stockById: Record<string, number> = stock.reduce((acc, s) => {
      acc[s.product_id.S] = Number(s.count.N);
      return acc;
    }, {} as Record<string, number>);

    const combinedData = products.map((product) => ({
      id: product.id.S,
      title: product.title.S,
      description: product.description.S,
      price: Number(product.price.N),
      count: stockById[product.id.S] || 0,
    }));

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify(combinedData, null, 2),
    };
  } catch (error: any) {
    console.error("Error fetching products or stock data from DynamoDB:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        error: "Failed to fetch data from DynamoDB",
        details: error.message,
      }),
    };
  }
};

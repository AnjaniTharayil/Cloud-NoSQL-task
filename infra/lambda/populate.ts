import { DynamoDB } from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";

// Initialize DynamoDB
const dynamodb = new DynamoDB.DocumentClient();

// Environment variables to get the table names
const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME!;
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME!;

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

export const handler: APIGatewayProxyHandler = async (
  event
): Promise<APIGatewayProxyResult> => {
  // Example products
  const products: Product[] = [
    {
      id: uuidv4(),
      title: "Wireless Gaming Mouse",
      description: "High precision wireless gaming mouse.",
      price: 50,
    },
    {
      id: uuidv4(),
      title: "Mechanical Keyboard",
      description: "RGB backlit mechanical keyboard.",
      price: 100,
    },
    {
      id: uuidv4(),
      title: "4K UltraWide Monitor",
      description: "Curved ultra-wide monitor with 4K resolution.",
      price: 400,
    },
  ];

  // Insert products into Products table
  for (const product of products) {
    await dynamodb
      .put({
        TableName: PRODUCTS_TABLE_NAME,
        Item: product,
      })
      .promise();
  }

  // Example stock data (reference product IDs from above)
  const stock: Stock[] = [
    { product_id: products[0].id, count: 25 },
    { product_id: products[1].id, count: 10 },
    { product_id: products[2].id, count: 15 },
  ];

  // Insert stock into Stock table
  for (const stockItem of stock) {
    await dynamodb
      .put({
        TableName: STOCK_TABLE_NAME,
        Item: stockItem,
      })
      .promise();
  }

  return {
    statusCode: 200,
    body: "Test data populated successfully!",
  };
};

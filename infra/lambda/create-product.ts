import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import crypto from "crypto";

const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || "products";
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME || "stock";

// Initialize DynamoDB client
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
  console.log("Received event:", JSON.stringify(event, null, 2));

  // Parse the incoming JSON request body
  let productData: any;
  try {
    productData = JSON.parse(event.body || "");
  } catch (error) {
    console.error("Invalid JSON body:", error);
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  // Validate the required fields: `title`, `description`, `price`, `count`
  const { title, description, price, count } = productData;
  if (
    !title ||
    !description ||
    typeof price !== "number" ||
    price <= 0 ||
    typeof count !== "number" ||
    count < 0
  ) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        error:
          "Validation error: `title`, `description`, `price` (positive number), and `count` (non-negative number) are required fields",
      }),
    };
  }

  const id = crypto.randomUUID();

  // Construct the new product and stock items
  const newProduct: Product = {
    id,
    title,
    description,
    price,
  };

  const newStock: Stock = {
    product_id: id,
    count,
  };

  try {
    // Save the product and stock to DynamoDB
    await Promise.all([
      dynamodb.send(
        new PutCommand({
          TableName: PRODUCTS_TABLE_NAME,
          Item: newProduct,
        })
      ),
      dynamodb.send(
        new PutCommand({
          TableName: STOCK_TABLE_NAME,
          Item: newStock,
        })
      ),
    ]);

    console.log("Product and stock inserted successfully:", {
      product: newProduct,
      stock: newStock,
    });

    return {
      statusCode: 201,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        message: "Product created successfully",
        product: newProduct,
        stock: newStock,
      }),
    };
  } catch (error: any) {
    console.error("Failed to save product or stock to DynamoDB:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        error: "Failed to create product",
        details: error.message,
      }),
    };
  }
};

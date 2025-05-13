const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

// DynamoDB configuration
AWS.config.update({ region: "eu-central-1" });

// Access DynamoDB
const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient(); // DocumentClient for easy data operations

// Table names
const PRODUCTS_TABLE = "products";
const STOCK_TABLE = "stock";

// Sample data
const productsData = [
  {
    id: uuidv4(),
    title: "Laptop",
    description: "A powerful laptop.",
    price: 1500,
  },
  {
    id: uuidv4(),
    title: "Smartphone",
    description: "A sleek smartphone.",
    price: 800,
  },
  {
    id: uuidv4(),
    title: "Headphones",
    description: "Noise-cancelling headphones.",
    price: 200,
  },
];

const stockData = [
  // Stock data will be a separate step later
  { count: 10 },
  { count: 25 },
  { count: 50 },
];

// Function to create tables (only needs to be done once)
async function createTables() {
  try {
    // Create `products` table
    const productParams = {
      TableName: PRODUCTS_TABLE,
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    };

    await dynamodb.createTable(productParams).promise();
    console.log(`Created table: ${PRODUCTS_TABLE}`);

    // Create `stock` table
    const stockParams = {
      TableName: STOCK_TABLE,
      KeySchema: [{ AttributeName: "product_id", KeyType: "HASH" }],
      AttributeDefinitions: [
        { AttributeName: "product_id", AttributeType: "S" },
      ],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    };

    await dynamodb.createTable(stockParams).promise();
    console.log(`Created table: ${STOCK_TABLE}`);
  } catch (error) {
    console.error(`Error creating tables: ${error.message}`);
  }
}

// Function to populate `products` and `stock` tables
async function populateTables() {
  try {
    // Insert products into `products` table
    console.log("Populating products table...");
    for (const product of productsData) {
      const params = {
        TableName: PRODUCTS_TABLE,
        Item: product,
      };
      await docClient.put(params).promise();
      console.log(`Inserted product: ${product.title} (ID: ${product.id})`);
    }

    // Link `stock` data with `products` by setting the product_id for each stock item
    console.log("Populating stock table...");
    for (let i = 0; i < productsData.length; i++) {
      const stockItem = {
        product_id: productsData[i].id,
        count: stockData[i].count,
      };
      const params = {
        TableName: STOCK_TABLE,
        Item: stockItem,
      };
      await docClient.put(params).promise();
      console.log(
        `Inserted stock for product ID: ${stockItem.product_id} with count: ${stockItem.count}`
      );
    }
  } catch (error) {
    console.error(`Error populating tables: ${error.message}`);
  }
}

// Main execution
async function main() {
  console.log("Starting the process...");
  await createTables(); // Create tables
  console.log("Waiting for tables to be ready...");
  setTimeout(async () => {
    await populateTables(); // Populate tables with test data
    console.log("Data insertion complete!");
  }, 10000); // Waiting time of 10 seconds to let tables become active
}

main().catch((err) => console.error(err));

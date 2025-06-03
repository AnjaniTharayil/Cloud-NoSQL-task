import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSub from 'aws-cdk-lib/aws-sns-subscriptions';

const PRODUCTS_TABLE_NAME = 'products';
const STOCK_TABLE_NAME = 'stock';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Import existing DynamoDB tables
     */
  // Logic for products table
  let productsTable: dynamodb.ITable;
  try {
    // Reference existing table
    productsTable = dynamodb.Table.fromTableName(this, 'ProductsTable', PRODUCTS_TABLE_NAME);
  } catch (error) {
    console.log(`Table '${PRODUCTS_TABLE_NAME}' does exist. Using existing table.`);
    // Create table when missing
    productsTable = new dynamodb.Table(this, 'ProductsTable', {
      tableName: PRODUCTS_TABLE_NAME,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
  }

  // Logic for stock table
  let stockTable: dynamodb.ITable;
  try {
    // Reference existing table
    stockTable = dynamodb.Table.fromTableName(this, 'StockTable', STOCK_TABLE_NAME);
    console.log(`Table '${STOCK_TABLE_NAME}' does exist. Using existing table.`);

  } catch (error) {
    console.log(`Table '${STOCK_TABLE_NAME}' does not exist. Creating a new table.`);
    // Create table when missing
    stockTable = new dynamodb.Table(this, 'StockTable', {
      tableName: STOCK_TABLE_NAME,
      partitionKey: { name: 'product_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
  }

  // Outputs for debugging
  new cdk.CfnOutput(this, 'ProductsTableName', { value: productsTable.tableName });
  new cdk.CfnOutput(this, 'StockTableName', { value: stockTable.tableName });

    /**
     * Lambda function to fetch all products from DynamoDB
     */
    const getProductsListLambda = new lambda.Function(this, 'GetProductsListLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'get-products-list.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/')),
      environment: {
        PRODUCTS_TABLE_NAME: PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME: STOCK_TABLE_NAME,
      },
    });

    /**
     * Lambda function to fetch a product by ID
     */
    const getProductByIdLambda = new lambda.Function(this, 'GetProductByIdLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'get-product-by-id.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/')),
      environment: {
        PRODUCTS_TABLE_NAME: PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME: STOCK_TABLE_NAME,
      },
    });

    // Grant read access to the tables for the Lambda functions
    productsTable.grantReadData(getProductsListLambda);
    stockTable.grantReadData(getProductsListLambda);

    productsTable.grantReadData(getProductByIdLambda);
    stockTable.grantReadData(getProductByIdLambda);

    /**
     * Define API Gateway
     */
    const api = new apigateway.RestApi(this, 'ProductServiceApi', {
      restApiName: 'Product Service API',
      description: 'API to manage product data.',
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'], // Allow all origins or specify your frontend domain
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'], // Allow necessary headers
        allowMethods: ['OPTIONS', 'GET', 'POST'], // Allow GET, POST, and OPTIONS methods
      },
    });

    /**
     * Add `/products` resource for listing all products
     */
    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsListLambda), {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Headers': true,
          },
        },
      ],
    });

    /**
     * Add `/products/{productId}` resource for fetching a product by ID
     */
    const productByIdResource = productsResource.addResource('{productId}');
    productByIdResource.addMethod('GET', new apigateway.LambdaIntegration(getProductByIdLambda), {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Headers': true,
          },
        },
        {
          statusCode: '404',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Headers': true,
          },
        },
      ],
    });

    /**
     * Lambda function to create a product
     */
    const createProductLambda = new lambda.Function(this, 'CreateProductLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: 'create-product.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/')),
      environment: {
        PRODUCTS_TABLE_NAME: PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME: STOCK_TABLE_NAME,
      },
    });

    // Grant write access to the Products and Stock tables for the createProduct Lambda
    productsTable.grantWriteData(createProductLambda);
    stockTable.grantWriteData(createProductLambda);

    // Add API Gateway POST /products resource for creating a product
    productsResource.addMethod('POST', new apigateway.LambdaIntegration(createProductLambda), {
      methodResponses: [
        {
          statusCode: '201', // Created
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Headers': true,
          },
        },
        {
          statusCode: '400', // Bad Request
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Headers': true,
          },
        },
        {
          statusCode: '500', // Internal Server Error
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Headers': true,
          },
        },
      ],
    });

    /**
     * Create an SQS Queue for Catalog Items
     */
    const catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      visibilityTimeout: cdk.Duration.seconds(30),
    });

    /**
     * Create a Lambda function for batch processing of products
     */
    const catalogBatchProcessLambda = new lambda.Function(this, 'CatalogBatchProcessLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/')),
      handler: 'catalog-batch-process.handler',
      environment: {
        PRODUCTS_TABLE_NAME: PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME: STOCK_TABLE_NAME,
      },
    });

    // Grant write access to the Products and Stock tables for batch Lambda
    productsTable.grantWriteData(catalogBatchProcessLambda);
    stockTable.grantWriteData(catalogBatchProcessLambda);

    // Specify SQS as the event source for the Lambda with batch size of 5
    catalogBatchProcessLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
      })
    );

    /**
     * Define an SNS topic to notify about created products
     */
    const createProductTopic = new sns.Topic(this, 'CreateProductTopic', {
      displayName: 'Product Creation Notifications',
    });

    // Add an email subscription to the SNS topic
    createProductTopic.addSubscription(
      new snsSub.EmailSubscription('anjanitharayil@gmail.com') // Replace with your email
    );

    /**
     * Grant Lambda permission to publish to the SNS topic
     */
    createProductTopic.grantPublish(catalogBatchProcessLambda);

    // Add the SNS Topic ARN as an environment variable in Lambda
    catalogBatchProcessLambda.addEnvironment('SNS_TOPIC_ARN', createProductTopic.topicArn);

    /**
     * Outputs for debugging and resource information
     */
    new cdk.CfnOutput(this, 'CatalogItemsQueueUrl', {
      value: catalogItemsQueue.queueUrl,
      description: 'The URL of the Catalog Items SQS Queue',
    });

    new cdk.CfnOutput(this, 'CreateProductTopicArn', {
      value: createProductTopic.topicArn,
      description: 'The ARN of the Create Product SNS Topic',
    });
  }
}
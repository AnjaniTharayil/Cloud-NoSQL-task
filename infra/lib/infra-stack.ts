import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';

const PRODUCTS_TABLE_NAME = 'products';
const STOCK_TABLE_NAME = 'stock';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Import existing DynamoDB tables
     */
    const productsTable = dynamodb.Table.fromTableName(this, 'ProductsTable', PRODUCTS_TABLE_NAME);
    const stockTable = dynamodb.Table.fromTableName(this, 'StockTable', STOCK_TABLE_NAME);

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
      description: 'API to fetch product data.',
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
    const createProductLambda = new lambda.Function(this, "CreateProductLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "create-product.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/")), 
      environment: {
        PRODUCTS_TABLE_NAME: PRODUCTS_TABLE_NAME,
      },
    });

    // Grant write access to the Products table for the createProduct Lambda
    productsTable.grantWriteData(createProductLambda);

    /**
     * Add API Gateway POST /products resource for creating a product
     */
    productsResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(createProductLambda),
      {
        methodResponses: [
          {
            statusCode: "201", // Created
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Methods": true,
              "method.response.header.Access-Control-Allow-Headers": true,
            },
          },
          {
            statusCode: "400", // Bad Request
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Methods": true,
              "method.response.header.Access-Control-Allow-Headers": true,
            },
          },
          {
            statusCode: "500", // Internal Server Error
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Methods": true,
              "method.response.header.Access-Control-Allow-Headers": true,
            },
          },
        ],
      }
    );

  }
}

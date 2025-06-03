import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs'; // Import the SQS library
import * as path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class ImportServiceStack extends cdk.Stack {
    public readonly importBucket: s3.IBucket;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Step 1: Create S3 Bucket
        this.importBucket = new s3.Bucket(this, 'ImportBucket', {
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Use RETAIN in production
            autoDeleteObjects: true,                 // Disable in production
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
                    allowedOrigins: ['*'], 
                    allowedHeaders: ['*'],
                },
            ],
        });

        // Step 2: Lambda Function for Generating Signed URL (GET /import)
        const importProductsFileLambda = new lambda.Function(this, 'ImportProductsFileLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/')),
            handler: 'importProductsFile.handler',
            environment: {
                BUCKET_NAME: this.importBucket.bucketName,
            },
        });

        // Grant PUT permissions to Lambda for the S3 bucket
        this.importBucket.grantPut(importProductsFileLambda);

        // Step 3: API Gateway for Signed URL Lambda Integration
        const api = new apigateway.RestApi(this, 'ImportApi', {
            restApiName: 'ImportServiceApi',
            defaultCorsPreflightOptions: {
                allowOrigins: ['*'], 
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'], 
                allowMethods: ['GET', 'OPTIONS'], // Enable OPTIONS preflight and GET method
            },
        });

        const importResource = api.root.addResource('import');
        importResource.addMethod(
            'GET',
            new apigateway.LambdaIntegration(importProductsFileLambda),
            {
                methodResponses: [
                    {
                        statusCode: '200',
                        responseParameters: {
                            'method.response.header.Access-Control-Allow-Origin': true,
                            'method.response.header.Access-Control-Allow-Headers': true,
                            'method.response.header.Access-Control-Allow-Methods': true,
                        },
                    },
                ],
            }
        );

        // Step 4: Define SQS Queue (CatalogItemsQueue)
        const catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
            visibilityTimeout: cdk.Duration.seconds(30), // Time for processing a message before becoming visible again
            retentionPeriod: cdk.Duration.days(5), // Messages persist for up to 5 days
        });

        // Step 5: Lambda for Processing CSV (S3 Event Trigger)
        const importFileParserLambda = new lambda.Function(this, 'ImportFileParserLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/')),
            handler: 'importFileParser.handler',
            environment: {
                BUCKET_NAME: this.importBucket.bucketName,
                SQS_QUEUE_URL: catalogItemsQueue.queueUrl, // Add the SQS queue URL as an environment variable
            },
        });

        // Grant READ/WRITE permissions on the S3 bucket to this Lambda
        this.importBucket.grantReadWrite(importFileParserLambda);

        // Grant SendMessage permissions for SQS to the Lambda
        catalogItemsQueue.grantSendMessages(importFileParserLambda);

        // Step 6: Add S3 Event Notification for Lambda Trigger (S3 → importFileParserLambda)
        this.importBucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.LambdaDestination(importFileParserLambda),
            { prefix: 'uploaded/' } // Trigger only for files in the "uploaded/" folder
        );
    }
}
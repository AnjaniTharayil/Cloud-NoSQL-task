import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class ImportServiceStack extends cdk.Stack {
    public readonly importBucket: s3.IBucket;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create an S3 bucket
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

        // Lambda function for signed URL generation (GET /import)
        const importProductsFileLambda = new lambda.Function(this, 'ImportProductsFileLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/')),
            handler: 'importProductsFile.handler',
            environment: {
                BUCKET_NAME: this.importBucket.bucketName,
            },
        });

        // Grant S3 permissions to the Lambda function
        this.importBucket.grantPut(importProductsFileLambda);

        // API Gateway integration with the Lambda function
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

        // Lambda function to process CSV files (triggered by S3 events)
        const importFileParserLambda = new lambda.Function(this, 'ImportFileParserLambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/')),
            handler: 'importFileParser.handler',
            environment: {
                BUCKET_NAME: this.importBucket.bucketName,
            },
        });

        // Grant S3 permissions to the Lambda function
        this.importBucket.grantReadWrite(importFileParserLambda);

        // S3 bucket event trigger (Object Created in "uploaded" folder)
        this.importBucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.LambdaDestination(importFileParserLambda),
            { prefix: 'uploaded/' } // Trigger events for files in the "uploaded" folder
        );
    }
}
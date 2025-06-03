import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SQSEvent } from 'aws-lambda';

const dynamodb = new DynamoDBClient({});
const sns = new SNSClient({});

const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'products';
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME || 'stock';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || '';

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log('Received event:', JSON.stringify(event));

  for (const record of event.Records) {
    try {
      console.log('Processing record:', record.body);
      const { id, title, description, price, count } = JSON.parse(record.body);

      // Add product to Products table
      const product = {
        id: { S: id }, // Attribute values must be typed in DynamoDB v3
        title: { S: title },
        description: { S: description },
        price: { N: price.toString() },
      };

      await dynamodb.send(new PutItemCommand({
        TableName: PRODUCTS_TABLE_NAME,
        Item: product,
      }));
      console.log('Added product to Products table:', product);

      // Add stock to Stock table
      const stock = {
        product_id: { S: id },
        count: { N: count.toString() },
      };

      await dynamodb.send(new PutItemCommand({
        TableName: STOCK_TABLE_NAME,
        Item: stock,
      }));
      console.log('Added stock to Stock table:', stock);

      // Publish to SNS
      const message = `Product created: ${JSON.stringify(product)}`;
      await sns.send(new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Message: message,
        Subject: 'New Product Created',
      }));
      console.log('Published notification to SNS:', message);
    } catch (error) {
      console.error('Error processing record:', record.body, error);
    }
  }
};
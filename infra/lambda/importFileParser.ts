import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { CloudWatchClient, PutMetricDataCommand,StandardUnit } from "@aws-sdk/client-cloudwatch";
import { Readable } from "stream";
import csv from "csv-parser";
import { S3Event, S3Handler } from "aws-lambda";

// AWS Region Configuration
const REGION = process.env.AWS_REGION || "eu-central-1";
const S3 = new S3Client({ region: REGION });
const SQS = new SQSClient({ region: REGION });
const CloudWatch = new CloudWatchClient({ region: REGION });

// Environment Variables
const BUCKET_NAME = process.env.BUCKET_NAME!;
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL!;

// Validation Function for CSV Records
const validateRecord = (record: any): boolean => {
  if (!record.name || !record.description || !record.price || !record.quantity) {
    console.warn(`Invalid record encountered: ${JSON.stringify(record)}`);
    return false;
  }
  return true;
};

// Retry Mechanism with Exponential Backoff
const retryWithBackoff = async (fn: () => Promise<any>, retries: number, delay: number): Promise<any> => {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;
    console.warn(`Retrying after failure... attempts left: ${retries}`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2); // Exponential backoff
  }
};

const publishMetric = async (metricName: string, value: number): Promise<void> => {
  const params = {
    Namespace: "FileProcessing", 
    MetricData: [
      {
        MetricName: metricName, 
        Value: value,           
        Unit: StandardUnit.Count, 
      },
    ],
  };

  try {
    await CloudWatch.send(new PutMetricDataCommand(params));
    console.log(`Successfully published metric: ${metricName} with value: ${value}`);
  } catch (error) {
    console.error(`Failed to publish metric ${metricName}:`, error);
  }
};

// Main S3 Handler for Processing CSV and Sending to SQS
export const handler: S3Handler = async (event: S3Event): Promise<void> => {
  if (!event.Records || event.Records.length === 0) {
    console.error("No records found in the S3 event. Exiting.");
    return;
  }

  if (!BUCKET_NAME || !SQS_QUEUE_URL) {
    throw new Error("Environment variables BUCKET_NAME or SQS_QUEUE_URL are not set.");
  }

  for (const record of event.Records) {
    const s3ObjectKey = decodeURIComponent(record.s3.object.key);

    try {
      console.log(`Processing file: ${s3ObjectKey}`);

      const params = {
        Bucket: BUCKET_NAME,
        Key: s3ObjectKey,
      };

      // Fetch the object from S3
      const s3ObjectData = await S3.send(new GetObjectCommand(params));
      const s3Stream = s3ObjectData.Body as Readable;

      if (!(s3Stream instanceof Readable)) {
        throw new Error("Failed to create a readable stream from S3 object");
      }

      // Batching SQS Messages
      const batchMessagePromises: Promise<any>[] = [];
      let currentBatch: any[] = [];
      let totalSuccessfulRecords = 0;
      let totalFailedRecords = 0;

      // Parse CSV
      await new Promise<void>((resolve, reject) => {
        s3Stream
          .pipe(csv())
          .on("data", (data) => {
            if (validateRecord(data)) {
              // Prepare batch entry
              const entry = {
                Id: `${currentBatch.length}`, // Batch entry ID must be unique
                MessageBody: JSON.stringify(data),
              };
              currentBatch.push(entry);
              totalSuccessfulRecords++;

              // Send batch if it reaches 10 entries
              if (currentBatch.length === 10) {
                const batchCommand = new SendMessageBatchCommand({
                  QueueUrl: SQS_QUEUE_URL,
                  Entries: [...currentBatch],
                });
                batchMessagePromises.push(retryWithBackoff(() => SQS.send(batchCommand), 3, 1000));
                currentBatch = []; // Clear batch after sending
              }
            } else {
              totalFailedRecords++;
            }
          })
          .on("end", async () => {
            // Send any remaining messages in the batch
            if (currentBatch.length > 0) {
              const batchCommand = new SendMessageBatchCommand({
                QueueUrl: SQS_QUEUE_URL,
                Entries: [...currentBatch],
              });
              batchMessagePromises.push(retryWithBackoff(() => SQS.send(batchCommand), 3, 1000));
            }
            await Promise.all(batchMessagePromises); // Send all batches
            console.log("Successfully sent all SQS batches.");
            resolve();
          })
          .on("error", (error) => {
            console.error(`Error parsing file: ${s3ObjectKey}`, error);
            reject(error);
          });
      });

      // Publish Metrics to CloudWatch
      await publishMetric("SuccessfulRecords", totalSuccessfulRecords);
      await publishMetric("FailedRecords", totalFailedRecords);

      console.log(`File successfully processed. Success: ${totalSuccessfulRecords}, Fail: ${totalFailedRecords}`);

      // Move file to `parsed/` folder
      const targetKey = s3ObjectKey.replace("uploaded/", "parsed/");
      await S3.send(new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        CopySource: `${BUCKET_NAME}/${s3ObjectKey}`,
        Key: targetKey,
      }));
      await S3.send(new DeleteObjectCommand(params));

      console.log(`File moved to 'parsed/' and deleted from 'uploaded/': ${s3ObjectKey}`);
    } catch (error) {
      console.error(`Failed to process file ${s3ObjectKey}:`, error);
      await publishMetric("FailedFiles", 1);
    }
  }
};
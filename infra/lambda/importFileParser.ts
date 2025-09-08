import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";
import { S3Event, S3Handler } from "aws-lambda";

const REGION = process.env.AWS_REGION || "eu-central-1";
const S3 = new S3Client({ region: REGION });

export const handler: S3Handler = async (event: S3Event): Promise<void> => {
  const bucketName = process.env.BUCKET_NAME;

  if (!bucketName) {
    console.error("BUCKET_NAME environment variable not set.");
    return;
  }

  for (const record of event.Records) {
    const s3ObjectKey = record.s3.object.key;

    try {
      console.log(`Processing file: ${s3ObjectKey}`);

      const params = {
        Bucket: bucketName,
        Key: s3ObjectKey,
      };

      const s3ObjectData = await S3.send(new GetObjectCommand(params));
      const s3Stream = s3ObjectData.Body as Readable;

      if (!(s3Stream instanceof Readable)) {
        throw new Error("Failed to create a readable stream from S3 object");
      }

      const parsedData: any[] = [];

      await new Promise<void>((resolve, reject) => {
        s3Stream
          .pipe(csv())
          .on("data", (data) => {
            console.log(`Parsed data:`, data);
            parsedData.push(data);
          })
          .on("end", () => resolve())
          .on("error", (error) => {
            console.error(`Error reading file: ${s3ObjectKey}`, error);
            reject(error);
          });
      });

      console.log(`Finished processing and parsing file: ${s3ObjectKey}`);

      const targetKey = s3ObjectKey.replace("uploaded/", "parsed/");
      const copyParams = {
        Bucket: bucketName,
        CopySource: `${bucketName}/${s3ObjectKey}`,
        Key: targetKey,
      };

      console.log(`Copying file to parsed folder: ${targetKey}`);
      await S3.send(new CopyObjectCommand(copyParams));

      console.log(`Deleting file from uploaded folder: ${s3ObjectKey}`);
      await S3.send(new DeleteObjectCommand(params));

      console.log(`File moved to 'parsed/' and deleted from 'uploaded/'`);
    } catch (error) {
      console.error(`Failed to process file ${record.s3.object.key}:`, error);
    }
  }
};

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import crypto from "crypto";
import { env } from "../env";

export type PresignResult = {
  uploadUrl: string;
  publicUrl: string;
};

function getS3Client(): S3Client {
  if (
    !env.B2_S3_ENDPOINT ||
    !env.B2_S3_REGION ||
    !env.B2_S3_ACCESS_KEY_ID ||
    !env.B2_S3_SECRET_ACCESS_KEY
  ) {
    throw new Error("Backblaze B2 S3 env vars are not configured");
  }

  return new S3Client({
    region: env.B2_S3_REGION,
    endpoint: env.B2_S3_ENDPOINT,
    credentials: {
      accessKeyId: env.B2_S3_ACCESS_KEY_ID,
      secretAccessKey: env.B2_S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

function sanitizeFilename(filename: string): string {
  const base = path.basename(filename);
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function createPresignedUploadUrl(
  userId: string,
  filename: string,
  contentType: string
): Promise<PresignResult> {
  if (!env.B2_S3_BUCKET || !env.B2_PUBLIC_BASE_URL) {
    throw new Error("Backblaze B2 bucket env vars are not configured");
  }

  const safeFilename = sanitizeFilename(filename);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const random = crypto.randomBytes(8).toString("hex");
  const objectKey = `uploads/${userId}/${year}/${month}/${random}-${safeFilename}`;

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: env.B2_S3_BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 5 });
  const publicUrl = `${env.B2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${objectKey}`;

  return { uploadUrl, publicUrl };
}

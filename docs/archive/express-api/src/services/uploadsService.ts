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
    !env.R2_ENDPOINT ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY
  ) {
    throw new Error("Cloudflare R2 S3 env vars are not configured");
  }

  return new S3Client({
    region: env.R2_REGION,
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
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
  if (!env.R2_BUCKET || !env.R2_PUBLIC_BASE_URL) {
    throw new Error("Cloudflare R2 bucket env vars are not configured");
  }

  const safeFilename = sanitizeFilename(filename);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const random = crypto.randomBytes(8).toString("hex");
  const objectKey = `uploads/${userId}/${year}/${month}/${random}-${safeFilename}`;

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 5 });
  const publicUrl = `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${objectKey}`;

  return { uploadUrl, publicUrl };
}

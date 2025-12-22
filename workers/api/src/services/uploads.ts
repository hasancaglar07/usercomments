import { AwsClient } from "aws4fetch";
import type { ParsedEnv } from "../env";

export type PresignResult = {
  uploadUrl: string;
  publicUrl: string;
};

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function randomHex(bytesLength: number): string {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function getAwsClient(env: ParsedEnv): AwsClient {
  if (!env.B2_S3_ACCESS_KEY_ID || !env.B2_S3_SECRET_ACCESS_KEY || !env.B2_S3_REGION) {
    throw new Error("Backblaze B2 S3 credentials are not configured");
  }

  return new AwsClient({
    accessKeyId: env.B2_S3_ACCESS_KEY_ID,
    secretAccessKey: env.B2_S3_SECRET_ACCESS_KEY,
    region: env.B2_S3_REGION,
    service: "s3",
  });
}

export async function createPresignedUploadUrl(
  env: ParsedEnv,
  userId: string,
  filename: string,
  contentType: string
): Promise<PresignResult> {
  if (!env.B2_S3_ENDPOINT || !env.B2_S3_BUCKET || !env.B2_PUBLIC_BASE_URL) {
    throw new Error("Backblaze B2 bucket env vars are not configured");
  }

  const safeFilename = sanitizeFilename(filename);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const random = randomHex(8);
  const objectKey = `uploads/${userId}/${year}/${month}/${random}-${safeFilename}`;

  const baseEndpoint = env.B2_S3_ENDPOINT.replace(/\/$/, "");
  const uploadUrl = new URL(`${baseEndpoint}/${env.B2_S3_BUCKET}/${objectKey}`);

  const client = getAwsClient(env);
  const signed = await client.sign(uploadUrl.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    aws: {
      signQuery: true,
    },
  });

  const publicUrl = `${env.B2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${objectKey}`;

  return { uploadUrl: signed.url, publicUrl };
}

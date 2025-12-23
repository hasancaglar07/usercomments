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
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("Cloudflare R2 credentials are not configured");
  }

  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    region: env.R2_REGION,
    service: "s3",
  });
}

export async function createPresignedUploadUrl(
  env: ParsedEnv,
  userId: string,
  filename: string,
  contentType: string
): Promise<PresignResult> {
  if (!env.R2_ENDPOINT || !env.R2_BUCKET || !env.R2_PUBLIC_BASE_URL) {
    throw new Error("Cloudflare R2 bucket env vars are not configured");
  }

  const safeFilename = sanitizeFilename(filename);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const random = randomHex(8);
  const objectKey = `uploads/${userId}/${year}/${month}/${random}-${safeFilename}`;

  const endpointBase = env.R2_ENDPOINT.match(/^https?:\/\//)
    ? env.R2_ENDPOINT
    : `https://${env.R2_ENDPOINT}`;
  const uploadUrl = new URL(endpointBase);
  uploadUrl.pathname = `/${env.R2_BUCKET}/${objectKey}`;

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

  const publicUrl = `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${objectKey}`;

  return { uploadUrl: signed.url, publicUrl };
}

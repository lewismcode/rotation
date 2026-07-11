import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { serverEnv } from "./env.js";
import { Readable } from "node:stream";

let client: S3Client | null = null;

export function r2(): S3Client {
  if (client) return client;
  const env = serverEnv();
  const endpoint =
    env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    // AWS SDK v3 now injects an automatic CRC32 checksum
    // (x-amz-checksum-crc32 / x-amz-sdk-checksum-algorithm) into requests and
    // presigned URLs. Cloudflare R2 (and other S3-compatible stores) reject or
    // hang browser PUTs whose real body doesn't match that pre-signed, empty
    // checksum. Only add checksums when the operation actually requires them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

function bucket(): string {
  return serverEnv().R2_BUCKET;
}

/** Presigned PUT so the browser uploads video bytes straight to R2. */
export async function presignPut(
  key: string,
  contentType: string,
  expiresIn = 60 * 15
): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn }
  );
}

/** Presigned GET for downloads (individual render or batch zip). */
export async function presignGet(
  key: string,
  downloadFilename?: string,
  expiresIn = 60 * 60
): Promise<string> {
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: downloadFilename
        ? `attachment; filename="${downloadFilename.replace(/"/g, "")}"`
        : undefined,
    }),
    { expiresIn }
  );
}

export async function getObjectStream(key: string): Promise<Readable> {
  const res: GetObjectCommandOutput = await r2().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key })
  );
  return res.Body as Readable;
}

export async function putObject(
  key: string,
  body: Buffer | Readable,
  contentType: string
): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * Upload a stream of UNKNOWN length (e.g. a zip being built on the fly). Plain
 * PutObject requires Content-Length, which S3/R2 rejects for streams; the
 * multipart Upload helper handles it.
 */
export async function uploadStream(
  key: string,
  body: Readable,
  contentType: string
): Promise<void> {
  const upload = new Upload({
    client: r2(),
    params: { Bucket: bucket(), Key: key, Body: body, ContentType: contentType },
  });
  await upload.done();
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** True if the key exists — used to poll whether a batch zip has finished. */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Actual stored byte size (from a HEAD), or null if the object isn't there. */
export async function objectSize(key: string): Promise<number | null> {
  try {
    const res = await r2().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key })
    );
    return res.ContentLength ?? null;
  } catch {
    return null;
  }
}

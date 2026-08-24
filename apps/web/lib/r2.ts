import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function createR2ArchiveStore() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) throw new Error("R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required");
  const client = new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
  return {
    async exists(key: string) {
      try { await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); return true; }
      catch (error) { if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false; throw error; }
    },
    publicUrl(key: string) {
      const base = process.env.R2_PUBLIC_BASE_URL;
      if (!base) throw new Error("R2_PUBLIC_BASE_URL is required");
      return `${base.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
    },
  };
}

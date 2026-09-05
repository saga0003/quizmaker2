import { createHash, createHmac, randomUUID } from "node:crypto";
import { assertUploadSignature } from "@/lib/server/uploadValidation";

const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
const bucket = process.env.R2_BUCKET?.trim() ?? "";
const endpoint = (process.env.R2_ENDPOINT?.trim() || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")).replace(/\/$/, "");
const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL?.trim() ?? "").replace(/\/$/, "");

const allowedMimeTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "image/bmp", "image/avif", "image/x-icon", "image/tiff", "image/heic", "image/heif",
]);

const mimeExtension: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "image/bmp": "bmp", "image/avif": "avif", "image/x-icon": "ico", "image/tiff": "tiff", "image/heic": "heic", "image/heif": "heif",
};

function usable(value: string) { return Boolean(value) && value !== "[SENSITIVE]" && !value.includes("PASTE_") && !value.includes("YOUR_"); }
export const isR2Configured = [accountId, accessKeyId, secretAccessKey, bucket, endpoint, publicBaseUrl].every(usable);
function sha256(value: Uint8Array | string) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key: Uint8Array | string, value: string): Buffer { return createHmac("sha256", key).update(value).digest(); }
function signingKey(secret: string, dateStamp: string) { const dateKey = hmac(`AWS4${secret}`, dateStamp); const regionKey = hmac(dateKey, "auto"); const serviceKey = hmac(regionKey, "s3"); return hmac(serviceKey, "aws4_request"); }
function safeSegment(value: string) { return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "") || "asset"; }
function encodedPath(value: string) { return value.split("/").map((segment) => encodeURIComponent(segment)).join("/"); }
function timestamp(now: Date) { const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); return { amzDate: iso, dateStamp: iso.slice(0, 8) }; }
export function assertR2Configured() { if (!isR2Configured) throw Object.assign(new Error("Cloudflare R2 is not configured. Add the six R2 environment variables for this environment."), { status: 503 }); }

async function putR2(input: { bytes: Uint8Array; contentType: string; key: string; cacheControl?: string }) {
  const canonicalUri = `/${encodeURIComponent(bucket)}/${encodedPath(input.key)}`;
  const requestUrl = `${endpoint}${canonicalUri}`;
  const host = new URL(endpoint).host;
  const now = new Date();
  const { amzDate, dateStamp } = timestamp(now);
  const payloadHash = sha256(input.bytes);
  const canonicalHeaders = [`content-type:${input.contentType}`, `host:${host}`, `x-amz-content-sha256:${payloadHash}`, `x-amz-date:${amzDate}`, ""].join("\n");
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(secretAccessKey, dateStamp)).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headers: Record<string, string> = { Authorization: authorization, "Content-Type": input.contentType, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (input.cacheControl) headers["Cache-Control"] = input.cacheControl;
  const response = await fetch(requestUrl, { method: "PUT", headers, body: Buffer.from(input.bytes) });
  if (!response.ok) return { ok: false as const, status: response.status, details: (await response.text()).slice(0, 800) };
  return { ok: true as const };
}

export async function uploadQuestionAssetToR2(input: { bytes: Uint8Array; contentType: string; originalName: string; userId: string; purpose?: string }) {
  assertR2Configured();
  const contentType = assertUploadSignature({ bytes: input.bytes, contentType: input.contentType, originalName: input.originalName, allowedMimeTypes, label: "image" });
  if (input.bytes.length > 4 * 1024 * 1024) throw Object.assign(new Error("Question images must be 4 MB or smaller. Optimise the image to WebP, PNG or JPEG before upload."), { status: 413 });
  const purpose = safeSegment(input.purpose || "questions");
  const original = safeSegment(input.originalName);
  const extension = original.includes(".") ? original.split(".").pop()! : mimeExtension[contentType] || "bin";
  const base = original.replace(new RegExp(`\\.${extension}$`, "i"), "") || "image";
  const month = new Date().toISOString().slice(0, 7);
  const key = `${purpose}/${month}/${safeSegment(input.userId)}/${randomUUID()}-${safeSegment(base)}.${safeSegment(extension)}`;
  const response = await putR2({ bytes: input.bytes, contentType, key, cacheControl: "public, max-age=31536000, immutable" });
  if (!response.ok) throw Object.assign(new Error(`R2 upload failed (${response.status}). ${response.details || "Check the R2 endpoint, token permission and bucket name."}`), { status: 502 });
  return { key, publicUrl: `${publicBaseUrl}/${encodedPath(key)}`, contentType, size: input.bytes.length };
}

const resourceMimeTypes = new Set([
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv", "image/jpeg", "image/png", "image/webp", "image/gif",
]);
const resourceExtensions: Record<string, string> = {
  "application/pdf": "pdf", "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt", "text/csv": "csv", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};

export async function uploadResourceFileToR2(input: { bytes: Uint8Array; contentType: string; originalName: string; userId: string; scope: "platform" | "organization"; organizationId?: string | null }) {
  assertR2Configured();
  const contentType = assertUploadSignature({ bytes: input.bytes, contentType: input.contentType, originalName: input.originalName, allowedMimeTypes: resourceMimeTypes, label: "resource" });
  if (input.bytes.length > 20 * 1024 * 1024) throw Object.assign(new Error("Resource files must be 20 MB or smaller."), { status: 413 });
  const original = safeSegment(input.originalName);
  const extension = original.includes(".") ? original.split(".").pop()! : resourceExtensions[contentType] || "bin";
  const base = original.replace(new RegExp(`\\.${extension}$`, "i"), "") || "resource";
  const month = new Date().toISOString().slice(0, 7);
  const owner = input.scope === "platform" ? "evidara" : safeSegment(input.organizationId || "school");
  const key = `resources/${input.scope}/${owner}/${month}/${randomUUID()}-${safeSegment(base)}.${safeSegment(extension)}`;
  const response = await putR2({ bytes: input.bytes, contentType, key });
  if (!response.ok) throw Object.assign(new Error(`R2 resource upload failed (${response.status}). ${response.details.slice(0, 500)}`), { status: 502 });
  return { key, publicUrl: `${publicBaseUrl}/${encodedPath(key)}`, contentType, size: input.bytes.length, extension };
}

/** Deterministic V19 PYQ asset upload. Retrying the same archive overwrites the same R2 key. */
export async function uploadPyqV19AssetToR2(input: { bytes: Uint8Array; contentType: string; relativePath: string }) {
  assertR2Configured();
  const contentType = assertUploadSignature({ bytes: input.bytes, contentType: input.contentType, originalName: input.relativePath, allowedMimeTypes, label: "PYQ asset" });
  if (input.bytes.length > 4 * 1024 * 1024) throw Object.assign(new Error("A V19 PYQ image exceeds 4 MB. Rebuild or optimise that source asset before upload."), { status: 413 });
  const cleaned = input.relativePath.replace(/\\/g, "/").split("/").filter(Boolean).map(safeSegment).join("/");
  if (!cleaned || cleaned.includes("..")) throw Object.assign(new Error("Invalid PYQ asset path."), { status: 400 });
  const key = `question-assets/platform/pyq-v19/${cleaned}`;
  const response = await putR2({ bytes: input.bytes, contentType, key, cacheControl: "public, max-age=31536000, immutable" });
  if (!response.ok) throw Object.assign(new Error(`R2 V19 PYQ upload failed (${response.status}). ${response.details || "Check R2 configuration."}`), { status: 502 });
  return { key, publicUrl: `${publicBaseUrl}/${encodedPath(key)}`, contentType, size: input.bytes.length };
}

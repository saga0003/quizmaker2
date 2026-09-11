import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertUploadSignature, RASTER_IMAGE_MIME_TYPES } from '@/lib/server/uploadValidation';

export const PUBLIC_QUESTION_ASSET_BUCKET = 'question-assets';

const mimeExtension: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/x-icon': 'ico',
  'image/tiff': 'tiff',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'asset';
}

function publicUrl(admin: SupabaseClient, key: string) {
  return admin.storage.from(PUBLIC_QUESTION_ASSET_BUCKET).getPublicUrl(key).data.publicUrl;
}

export async function probePublicQuestionAssetStorage(admin: SupabaseClient) {
  const { error } = await admin.storage.from(PUBLIC_QUESTION_ASSET_BUCKET).list('', { limit: 1 });
  return { ok: !error, error: error?.message ?? null };
}

export async function uploadQuestionAsset(input: {
  admin: SupabaseClient;
  bytes: Uint8Array;
  contentType: string;
  originalName: string;
  userId: string;
  purpose?: string;
}) {
  const contentType = assertUploadSignature({
    bytes: input.bytes,
    contentType: input.contentType,
    originalName: input.originalName,
    allowedMimeTypes: RASTER_IMAGE_MIME_TYPES,
    label: 'image',
  });
  if (input.bytes.length > 4 * 1024 * 1024) {
    throw Object.assign(new Error('Question images must be 4 MB or smaller. Optimise the image to WebP, PNG or JPEG before upload.'), { status: 413 });
  }

  const purpose = safeSegment(input.purpose || 'questions');
  const original = safeSegment(input.originalName);
  const extension = original.includes('.') ? original.split('.').pop()! : mimeExtension[contentType] || 'bin';
  const base = original.replace(new RegExp(`\\.${extension}$`, 'i'), '') || 'image';
  const month = new Date().toISOString().slice(0, 7);
  const key = `${purpose}/${month}/${safeSegment(input.userId)}/${randomUUID()}-${safeSegment(base)}.${safeSegment(extension)}`;

  const { error } = await input.admin.storage.from(PUBLIC_QUESTION_ASSET_BUCKET).upload(key, input.bytes, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw Object.assign(new Error(`Question image upload failed. ${error.message}`), { status: 502 });

  return { key, publicUrl: publicUrl(input.admin, key), contentType, size: input.bytes.length };
}

/** Deterministic V19 PYQ asset upload. Retrying the same archive overwrites the same key. */
export async function uploadPyqV19Asset(input: {
  admin: SupabaseClient;
  bytes: Uint8Array;
  contentType: string;
  relativePath: string;
}) {
  const contentType = assertUploadSignature({
    bytes: input.bytes,
    contentType: input.contentType,
    originalName: input.relativePath,
    allowedMimeTypes: RASTER_IMAGE_MIME_TYPES,
    label: 'PYQ asset',
  });
  if (input.bytes.length > 4 * 1024 * 1024) {
    throw Object.assign(new Error('A V19 PYQ image exceeds 4 MB. Rebuild or optimise that source asset before upload.'), { status: 413 });
  }

  const cleaned = input.relativePath.replace(/\\/g, '/').split('/').filter(Boolean).map(safeSegment).join('/');
  if (!cleaned || cleaned.includes('..')) throw Object.assign(new Error('Invalid PYQ asset path.'), { status: 400 });
  const key = `question-assets/platform/pyq-v19/${cleaned}`;

  const { error } = await input.admin.storage.from(PUBLIC_QUESTION_ASSET_BUCKET).upload(key, input.bytes, {
    contentType,
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) throw Object.assign(new Error(`V19 PYQ asset upload failed. ${error.message}`), { status: 502 });

  return { key, publicUrl: publicUrl(input.admin, key), contentType, size: input.bytes.length };
}

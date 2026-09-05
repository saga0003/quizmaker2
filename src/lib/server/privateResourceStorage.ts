import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertUploadSignature } from '@/lib/server/uploadValidation';

export const PRIVATE_RESOURCE_BUCKET = 'academic-resources-private';

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'resource';
}

export async function uploadPrivateAcademicResource(input: {
  admin: SupabaseClient;
  bytes: Uint8Array;
  contentType: string;
  originalName: string;
  organizationId: string;
  userId: string;
}) {
  const contentType = assertUploadSignature({
    bytes: input.bytes,
    contentType: input.contentType,
    originalName: input.originalName,
    allowedMimeTypes,
    label: 'resource',
  });
  if (input.bytes.length > 20 * 1024 * 1024) throw Object.assign(new Error('Resource files must be 20 MB or smaller.'), { status: 413 });

  const original = safeSegment(input.originalName);
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const key = `organization/${safeSegment(input.organizationId)}/${month}/${safeSegment(input.userId)}/${randomUUID()}-${original}`;
  const { error } = await input.admin.storage.from(PRIVATE_RESOURCE_BUCKET).upload(key, input.bytes, {
    contentType,
    cacheControl: 'private, max-age=0, no-store',
    upsert: false,
  });
  if (error) throw Object.assign(new Error(`Private resource upload failed. ${error.message}`), { status: 502 });
  return { key, contentType, size: input.bytes.length };
}

export async function createPrivateAcademicResourceUrl(input: {
  admin: SupabaseClient;
  key: string;
  expiresIn?: number;
}) {
  const expiresIn = Math.max(60, Math.min(600, input.expiresIn ?? 300));
  const { data, error } = await input.admin.storage.from(PRIVATE_RESOURCE_BUCKET).createSignedUrl(input.key, expiresIn, { download: false });
  if (error || !data?.signedUrl) throw Object.assign(new Error(`Unable to create a protected resource link. ${error?.message || ''}`.trim()), { status: 502 });
  return data.signedUrl;
}

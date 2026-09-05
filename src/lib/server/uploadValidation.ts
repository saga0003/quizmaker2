const ZIP_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const OLE_MIME_TYPES = new Set([
  'application/msword',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-excel',
]);

const RASTER_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
  'image/x-icon',
  'image/tiff',
  'image/heic',
  'image/heif',
]);

const TEXT_MIME_TYPES = new Set(['text/plain', 'text/csv']);

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function looksLikeSvg(bytes: Uint8Array) {
  const prefix = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, Math.min(bytes.length, 4096)))
    .replace(/^\uFEFF/, '')
    .trimStart()
    .toLowerCase();
  return prefix.startsWith('<svg') || prefix.startsWith('<?xml') && prefix.includes('<svg');
}

function looksLikeText(bytes: Uint8Array) {
  const sample = bytes.slice(0, Math.min(bytes.length, 8192));
  if (!sample.length) return false;
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) suspicious += 1;
  }
  return suspicious / sample.length < 0.02;
}

function hasIsoBmffBrand(bytes: Uint8Array, brands: Set<string>) {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== 'ftyp') return false;
  const limit = Math.min(bytes.length, 64);
  for (let offset = 8; offset + 4 <= limit; offset += 4) {
    if (brands.has(ascii(bytes, offset, 4))) return true;
  }
  return false;
}

export function assertUploadSignature(input: {
  bytes: Uint8Array;
  contentType: string;
  originalName?: string;
  allowedMimeTypes: ReadonlySet<string>;
  label?: string;
}) {
  const label = input.label || 'file';
  const contentType = input.contentType.toLowerCase().split(';', 1)[0].trim();
  const bytes = input.bytes;

  if (!bytes.length) {
    throw Object.assign(new Error(`The selected ${label} is empty.`), { status: 400 });
  }
  if (!input.allowedMimeTypes.has(contentType)) {
    throw Object.assign(new Error(`Unsupported ${label} type: ${contentType || 'unknown'}.`), { status: 400 });
  }

  // SVG is intentionally not accepted in Phase 1. It is active XML/HTML-like content
  // and cannot be made safe by trusting a browser MIME header or filename alone.
  if (contentType === 'image/svg+xml' || looksLikeSvg(bytes)) {
    throw Object.assign(new Error('SVG uploads are disabled for security. Convert the image to PNG, WebP or JPEG before uploading.'), { status: 400 });
  }

  let valid = false;
  if (contentType === 'image/jpeg') valid = startsWith(bytes, [0xff, 0xd8, 0xff]);
  else if (contentType === 'image/png') valid = startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  else if (contentType === 'image/gif') valid = ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a';
  else if (contentType === 'image/webp') valid = ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP';
  else if (contentType === 'image/bmp') valid = ascii(bytes, 0, 2) === 'BM';
  else if (contentType === 'image/x-icon') valid = startsWith(bytes, [0x00, 0x00, 0x01, 0x00]) || startsWith(bytes, [0x00, 0x00, 0x02, 0x00]);
  else if (contentType === 'image/tiff') valid = startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a]);
  else if (contentType === 'image/avif') valid = hasIsoBmffBrand(bytes, new Set(['avif', 'avis']));
  else if (contentType === 'image/heic' || contentType === 'image/heif') valid = hasIsoBmffBrand(bytes, new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']));
  else if (contentType === 'application/pdf') valid = ascii(bytes, 0, 5) === '%PDF-';
  else if (ZIP_MIME_TYPES.has(contentType)) valid = startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) || startsWith(bytes, [0x50, 0x4b, 0x07, 0x08]);
  else if (OLE_MIME_TYPES.has(contentType)) valid = startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  else if (TEXT_MIME_TYPES.has(contentType)) valid = looksLikeText(bytes) && !looksLikeSvg(bytes);

  if (!valid) {
    const name = input.originalName ? ` “${input.originalName}”` : '';
    throw Object.assign(new Error(`The contents of${name} do not match the declared ${contentType || 'file'} type.`), { status: 400 });
  }

  return contentType;
}

export { RASTER_IMAGE_MIME_TYPES };

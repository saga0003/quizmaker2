export type ZipEntry = {
  name: string;
  bytes: Uint8Array;
  blob: Blob;
  compressedSize: number;
  expandedSize: number;
  compressionRatio: number;
  text: () => Promise<string>;
};

export type ZipSafetyLimits = {
  maxCompressedBytes: number;
  maxExpandedBytes: number;
  maxEntries: number;
  maxEntryBytes: number;
  maxCompressionRatio: number;
};

export const DEFAULT_ZIP_SAFETY_LIMITS: ZipSafetyLimits = {
  maxCompressedBytes: 100 * 1024 * 1024,
  maxExpandedBytes: 100 * 1024 * 1024,
  maxEntries: 1_000,
  maxEntryBytes: 15 * 1024 * 1024,
  maxCompressionRatio: 100,
};

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);

function zipError(message: string) {
  throw new Error(`Unsafe ZIP archive: ${message}`);
}

async function inflateRaw(bytes: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot decompress ZIP files. Use the latest Chrome or Edge.');
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZip(
  input: ArrayBuffer,
  limits: ZipSafetyLimits = DEFAULT_ZIP_SAFETY_LIMITS,
): Promise<Map<string, ZipEntry>> {
  if (input.byteLength > limits.maxCompressedBytes) {
    zipError(`compressed size exceeds ${limits.maxCompressedBytes} bytes.`);
  }

  const bytes = new Uint8Array(input);
  const view = new DataView(input);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Invalid ZIP/XLSX file: end directory not found.');

  const count = u16(view, eocd + 10);
  if (count > limits.maxEntries) zipError(`file count exceeds ${limits.maxEntries}.`);

  let offset = u32(view, eocd + 16);
  const decoder = new TextDecoder();
  const result = new Map<string, ZipEntry>();
  let totalExpandedBytes = 0;

  for (let n = 0; n < count; n += 1) {
    if (offset + 46 > bytes.length || u32(view, offset) !== 0x02014b50) {
      throw new Error('Invalid ZIP central directory.');
    }

    const method = u16(view, offset + 10);
    const compressedSize = u32(view, offset + 20);
    const expandedSize = u32(view, offset + 24);
    const nameLen = u16(view, offset + 28);
    const extraLen = u16(view, offset + 30);
    const commentLen = u16(view, offset + 32);
    const localOffset = u32(view, offset + 42);
    const nameEnd = offset + 46 + nameLen;
    if (nameEnd > bytes.length) throw new Error('Invalid ZIP entry name.');
    const name = decoder.decode(bytes.slice(offset + 46, nameEnd));
    offset += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) continue;
    if (expandedSize > limits.maxEntryBytes) {
      zipError(`entry “${name}” expands beyond ${limits.maxEntryBytes} bytes.`);
    }

    totalExpandedBytes += expandedSize;
    if (totalExpandedBytes > limits.maxExpandedBytes) {
      zipError(`expanded size exceeds ${limits.maxExpandedBytes} bytes.`);
    }

    const compressionRatio = expandedSize === 0
      ? 1
      : compressedSize === 0
        ? Number.POSITIVE_INFINITY
        : expandedSize / compressedSize;
    if (compressionRatio > limits.maxCompressionRatio) {
      zipError(`entry “${name}” compression ratio ${compressionRatio.toFixed(1)}:1 exceeds ${limits.maxCompressionRatio}:1.`);
    }

    if (localOffset + 30 > bytes.length || u32(view, localOffset) !== 0x04034b50) {
      throw new Error(`Invalid local ZIP entry: ${name}`);
    }
    const localNameLen = u16(view, localOffset + 26);
    const localExtraLen = u16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error(`Invalid ZIP data range: ${name}`);
    const compressed = bytes.slice(dataStart, dataEnd);

    let expanded: Uint8Array;
    if (method === 0) expanded = compressed;
    else if (method === 8) expanded = await inflateRaw(compressed);
    else throw new Error(`Unsupported ZIP compression method ${method} in ${name}.`);

    if (expanded.byteLength !== expandedSize) {
      throw new Error(`Invalid ZIP expanded size for ${name}.`);
    }

    const blob = new Blob([expanded as BlobPart]);
    result.set(name, {
      name,
      bytes: expanded,
      blob,
      compressedSize,
      expandedSize,
      compressionRatio,
      text: () => blob.text(),
    });
  }

  return result;
}

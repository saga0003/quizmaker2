export const SUPPORTED_IMAGE_EXTENSIONS = [
  "jpg", "jpeg", "jfif", "png", "webp", "gif", "svg", "bmp", "avif", "ico", "tif", "tiff", "heic", "heif",
] as const;

const extensionMime: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
  ico: "image/x-icon",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
};

const normalizeDeclaredMime = (value: string) => {
  const mime = value.toLowerCase().split(";")[0].trim();
  if (mime === "image/jpg" || mime === "image/pjpeg") return "image/jpeg";
  if (mime === "image/vnd.microsoft.icon") return "image/x-icon";
  return mime;
};

export const imageExtension = (name: string) => {
  const clean = name.split(/[?#]/)[0];
  return (clean.split(".").pop() || "").toLowerCase();
};

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function detectImageMime(bytes?: Uint8Array, fileName = "", declaredType = ""): string | null {
  if (bytes && bytes.length >= 4) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") return "image/png";
    if (ascii(bytes, 0, 4) === "GIF8") return "image/gif";
    if (ascii(bytes, 0, 4) === "RIFF" && bytes.length >= 12 && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
    if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) return "image/x-icon";
    if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00)
      || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)) return "image/tiff";

    if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
      const brand = ascii(bytes, 8, 4).toLowerCase();
      if (["avif", "avis"].includes(brand)) return "image/avif";
      if (["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand)) return "image/heic";
      if (["heif", "mif1", "msf1"].includes(brand)) return "image/heif";
    }

    const start = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 2048))).trimStart().toLowerCase();
    if (start.startsWith("<svg") || (start.startsWith("<?xml") && start.includes("<svg"))) return "image/svg+xml";
  }

  const declared = normalizeDeclaredMime(declaredType);
  if (declared.startsWith("image/") && declared !== "image/*") return declared;
  return extensionMime[imageExtension(fileName)] || null;
}

export async function normalizeImageFile(file: File, maximumBytes = 10 * 1024 * 1024) {
  if (file.size <= 0) throw new Error(`Image '${file.name}' is empty.`);
  if (file.size > maximumBytes) throw new Error(`Image '${file.name}' is larger than ${Math.round(maximumBytes / 1024 / 1024)} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectImageMime(bytes, file.name, file.type);
  if (!mime) {
    throw new Error(`Image '${file.name}' could not be recognised. Use JPG, JPEG, PNG, WEBP, GIF, SVG, BMP, AVIF, ICO, TIFF or HEIC/HEIF.`);
  }
  return { blob: new Blob([bytes as BlobPart], { type: mime }), mime, bytes };
}

export function normalizeImageBytes(bytes: Uint8Array, fileName: string, maximumBytes = 10 * 1024 * 1024) {
  if (!bytes.length) throw new Error(`Image '${fileName}' is empty.`);
  if (bytes.length > maximumBytes) throw new Error(`Image '${fileName}' is larger than ${Math.round(maximumBytes / 1024 / 1024)} MB.`);
  const mime = detectImageMime(bytes, fileName);
  if (!mime) {
    throw new Error(`Image '${fileName}' could not be recognised. Use JPG, JPEG, PNG, WEBP, GIF, SVG, BMP, AVIF, ICO, TIFF or HEIC/HEIF.`);
  }
  return { blob: new Blob([bytes as BlobPart], { type: mime }), mime };
}

export function safeImageFileName(name: string) {
  const base = name.split(/[\\/]/).pop() || "image";
  return base.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export const imageAcceptValue = [
  "image/*",
  ...SUPPORTED_IMAGE_EXTENSIONS.map((extension) => `.${extension}`),
].join(",");

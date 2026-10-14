// Task 16 - browser-side image normalization before a quote-presentation upload.
// Accepts only JPEG / PNG / WebP (declared type AND magic bytes), decodes through the browser, downscales to at most
// MAX_LONG_SIDE on the long side and re-encodes through a canvas - which drops EXIF/GPS/ICC/comment metadata and any
// bytes trailing the real image. This is a convenience + privacy step, NOT a security boundary: the quote-presentation
// function re-validates every uploaded byte (magic bytes, dimensions, size, polyglot markers) on its own.

export const ACCEPTED_IMAGE_MIMES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const MAX_LONG_SIDE = 1600;
export const MIN_SIDE = 64;
export const MAX_UPLOAD_SIDE = 6000; // server maximum per side
export const JPEG_QUALITY = 0.85;

export class ImageNormalizeError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ImageNormalizeError';
    this.code = code;
  }
}

// Magic-byte sniff of the first 12 bytes. Returns 'image/jpeg' | 'image/png' | 'image/webp' | null.
export function sniffMime(bytes) {
  const b = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes || []);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

// Fit (width, height) inside maxLongSide keeping the aspect ratio; never upscales. Integer px, each side >= 1.
// Neither side may drop below minSide (the server minimum, 64 px) when the source allows it: for very elongated sources
// the downscale is limited so the short side stays at minSide (the long side may then exceed maxLongSide; the server
// still caps each side at MAX_UPLOAD_SIDE, checked in normalizeImage).
export function computeTargetSize(width, height, maxLongSide = MAX_LONG_SIDE, minSide = MIN_SIDE) {
  const w = Math.floor(Number(width));
  const h = Math.floor(Number(height));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  if (long <= maxLongSide) return { width: w, height: h, scaled: false };
  const scale = Math.min(1, Math.max(maxLongSide / long, short >= minSide ? minSide / short : 0));
  if (scale >= 1) return { width: w, height: h, scaled: false };
  return {
    width: Math.max(w >= minSide ? minSide : 1, Math.round(w * scale)),
    height: Math.max(h >= minSide ? minSide : 1, Math.round(h * scale)),
    scaled: true,
  };
}

// PNG keeps transparency as WebP when the browser can encode WebP; everything else becomes JPEG.
export function chooseOutputMime(sourceMime, webpSupported) {
  if (sourceMime === 'image/png' || sourceMime === 'image/webp') return webpSupported ? 'image/webp' : 'image/jpeg';
  return 'image/jpeg';
}

// Synchronous pre-checks on what is known before decoding. Throws ImageNormalizeError.
export function precheckSource({ type, size }, headBytes) {
  if (!ACCEPTED_IMAGE_MIMES.includes(String(type || '').toLowerCase())) {
    throw new ImageNormalizeError('unsupported_type', 'Only JPEG, PNG or WebP images are accepted');
  }
  if (!Number.isFinite(size) || size <= 0) throw new ImageNormalizeError('empty_file', 'The file is empty');
  if (size > MAX_SOURCE_BYTES) throw new ImageNormalizeError('file_too_large', 'The image is larger than 12 MB');
  const sniffed = sniffMime(headBytes);
  if (!sniffed) throw new ImageNormalizeError('unsupported_type', 'The file content is not a JPEG, PNG or WebP image');
  return sniffed;
}

async function readHead(file, n = 16) {
  const slice = typeof file.slice === 'function' ? file.slice(0, n) : file;
  if (typeof slice.arrayBuffer === 'function') return new Uint8Array(await slice.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsArrayBuffer(slice);
  });
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close?.() };
    } catch {
      // fall back to <img>
    }
  }
  if (typeof Image === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    throw new ImageNormalizeError('decode_failed', 'This browser cannot decode the image');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ImageNormalizeError('decode_failed', 'The image could not be decoded'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') { resolve(null); return; }
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

export async function normalizeImage(file, { maxLongSide = MAX_LONG_SIDE } = {}) {
  if (!file || typeof file !== 'object') throw new ImageNormalizeError('empty_file', 'No file selected');
  const sourceMime = precheckSource({ type: file.type, size: file.size }, await readHead(file));
  const decoded = await decode(file);
  try {
    if (decoded.width < MIN_SIDE || decoded.height < MIN_SIDE) {
      throw new ImageNormalizeError('image_too_small', `The image must be at least ${MIN_SIDE} px on each side`);
    }
    const target = computeTargetSize(decoded.width, decoded.height, maxLongSide);
    if (!target) throw new ImageNormalizeError('decode_failed', 'The image has no readable size');
    if (target.width < MIN_SIDE || target.height < MIN_SIDE) {
      throw new ImageNormalizeError('image_too_small', `The image must be at least ${MIN_SIDE} px on each side`);
    }
    if (target.width > MAX_UPLOAD_SIDE || target.height > MAX_UPLOAD_SIDE) {
      throw new ImageNormalizeError('image_aspect_unsupported', 'The image is too long and narrow to upload');
    }
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageNormalizeError('decode_failed', 'Canvas is not available');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    let mime = chooseOutputMime(sourceMime, true);
    if (mime === 'image/jpeg') {
      // JPEG has no alpha: paint white first so transparent regions do not turn black.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, target.width, target.height);
    }
    ctx.drawImage(decoded.source, 0, 0, target.width, target.height);
    let blob = await canvasToBlob(canvas, mime, JPEG_QUALITY);
    if (mime === 'image/webp' && (!blob || blob.type !== 'image/webp')) {
      // Browser cannot encode WebP: repaint on white and use JPEG.
      mime = 'image/jpeg';
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, target.width, target.height);
      blob = await canvasToBlob(canvas, mime, JPEG_QUALITY);
    }
    if (!blob) throw new ImageNormalizeError('encode_failed', 'The image could not be re-encoded');
    return { blob, width: target.width, height: target.height, mime };
  } finally {
    decoded.release?.();
  }
}

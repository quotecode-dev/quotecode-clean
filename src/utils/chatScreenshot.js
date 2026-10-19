// Owner console 2026-10-19 ("כן לצילום מסך, וגם לא צריך להיות כפתור אלא העתק הדבק, מה שאתה חושב לנכון"): one screenshot per chat
// question - pasted (Ctrl+V / long-press paste) or, on a phone, picked with the paperclip. The image is shrunk in the browser (longest
// side 1280 px, JPEG) before it is sent; it is never stored and is not part of the later turns.

export const SCREENSHOT_MAX_SIDE = 1280;
export const SCREENSHOT_MAX_CHARS = 1_500_000;
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** The first image of a paste event's clipboard, or null. */
export function imageFromClipboard(event) {
  const items = event?.clipboardData?.items ? [...event.clipboardData.items] : [];
  for (const it of items) {
    if (it.kind === 'file' && TYPES.has(it.type)) { const f = it.getAsFile(); if (f) return f; }
  }
  const files = event?.clipboardData?.files ? [...event.clipboardData.files] : [];
  return files.find((f) => TYPES.has(f.type)) || null;
}

const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || ''));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/** An image file -> a JPEG data URL with the longest side <= SCREENSHOT_MAX_SIDE; null when it is not a usable image / too big. */
export async function imageFileToDataUrl(file) {
  if (!file || !TYPES.has(file.type)) return null;
  let dataUrl = null;
  try {
    if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, SCREENSHOT_MAX_SIDE / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height); dataUrl = canvas.toDataURL('image/jpeg', 0.82); }
      bmp.close?.();
    }
  } catch { dataUrl = null; }
  if (!dataUrl || !/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) dataUrl = await readAsDataUrl(file).catch(() => null);
  if (!dataUrl || !/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl) || dataUrl.length > SCREENSHOT_MAX_CHARS) return null;
  return dataUrl;
}

export const SCREENSHOT_COPY = Object.freeze({
  he: { attach: 'צירוף צילום מסך', attached: 'צילום מסך מצורף', remove: 'הסרת צילום המסך', defaultQuestion: 'מה רואים בצילום המסך, ומה לעשות?', tooBig: 'אי אפשר לצרף את התמונה הזו. אפשר לנסות צילום מסך אחר.', pasteHint: 'אפשר גם להדביק צילום מסך' },
  en: { attach: 'Attach a screenshot', attached: 'Screenshot attached', remove: 'Remove the screenshot', defaultQuestion: 'What does this screenshot show, and what should I do?', tooBig: "This image can't be attached. Try another screenshot.", pasteHint: 'You can also paste a screenshot' },
});

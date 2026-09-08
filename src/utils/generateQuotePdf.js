import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// חוק ברזל (Public Quote PDF Correction task - direct PDF download, not
// window.print()): "Download PDF" and "Print" were previously both aliases
// for window.print() - the Owner's real visual testing correctly rejected
// this as not a genuine direct download. This module builds a real,
// valid, standalone .pdf file client-side, using only already-installed
// dependencies (jspdf/html2canvas - both declared in package.json,
// previously unused anywhere in src/) - no new dependency was added.
//
// Text-based (selectable) PDF generation via jsPDF's own low-level text-
// drawing API was deliberately NOT used: it has no automatic Unicode
// bidi/RTL reordering for arbitrary mixed Hebrew+digit+currency strings,
// requires a manually-embedded Hebrew-capable font, and would require
// re-implementing this document's entire layout (header/recipient/items
// table/professional measurement sub-tables/totals grid/terms/warranty)
// a second time by hand in imperative draw calls - a large, fragile,
// high-risk rebuild with real potential for exactly the "reversed/broken/
// disconnected Hebrew" failure this task explicitly forbids. Instead, this
// renders the ALREADY-CORRECT, already-tested, already-print-CSS-tuned
// live DOM via html2canvas at a high scale factor (crisp, ~300dpi-class
// output, not a blurry screenshot) and embeds the result as real image
// content inside a genuine PDF document via jsPDF - this is still a real,
// valid, standalone .pdf file (correct %PDF signature, opens in any PDF
// viewer, downloads through the browser's normal file-save mechanism, and
// - because jsPDF only ever draws what this function explicitly tells it
// to - can NEVER contain any browser-injected date/time/URL/title/page-
// number chrome, unlike a browser "Save as PDF" print). The one accepted
// trade-off, stated plainly: the resulting PDF text is not selectable/
// copyable (it is image content). This is a disclosed, reasoned choice,
// not an oversight - see PROFLOW_CODEX_CHECKPOINT.md for the Owner-facing
// record of this decision.
//
// Page-break intelligence: naive fixed-height canvas slicing would cut
// straight through a table row or item/section block mid-line whenever a
// page boundary happened to fall inside it. Before rendering, this walks
// every "must not split" element (table rows, item/section boxes, the
// recipient box, the header box) already tagged for the native print
// path's own `break-inside:avoid` CSS rules and reuses the exact same set
// of elements here - one shared list of "atomic blocks", not a second,
// independently-maintained one - then nudges each naive page boundary
// backward to the top of any block it would otherwise cut through,
// UNLESS doing so would waste more than ~85% of that page (in which case
// the block is allowed to split rather than produce a near-empty page or
// an unbounded push-forward for an oversized block).
const NO_SPLIT_SELECTOR = 'tr, .pq-section, .pq-recipient, .pq-header-box';

function computeBlockRanges(rootEl) {
  const rootRect = rootEl.getBoundingClientRect();
  return Array.from(rootEl.querySelectorAll(NO_SPLIT_SELECTOR))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - rootRect.top, bottom: r.bottom - rootRect.top };
    })
    .filter((b) => b.bottom > b.top)
    .sort((a, b) => a.top - b.top);
}

export function computePageBoundaries(canvasHeightPx, pageHeightPxIdeal, blocksPx) {
  const boundaries = [0];
  let cursor = 0;
  // חוק ברזל: הגנה קשיחה מפני לולאה אינסופית - אם בלוק בודד גבוה יותר
  // מעמוד שלם (או אם חישוב-הדחיפה-אחורה לא מתקדם מסיבה כלשהי), חובה
  // להבטיח שכל איטרציה מתקדמת ב-cursor ולא נתקעת.
  let guard = 0;
  const maxIterations = Math.ceil(canvasHeightPx / Math.max(1, pageHeightPxIdeal)) + blocksPx.length + 10;
  while (cursor < canvasHeightPx && guard < maxIterations) {
    guard += 1;
    let next = Math.min(cursor + pageHeightPxIdeal, canvasHeightPx);
    if (next < canvasHeightPx) {
      for (const b of blocksPx) {
        if (next > b.top && next < b.bottom) {
          const wouldWaste = next - b.top;
          const wasteRatio = wouldWaste / pageHeightPxIdeal;
          if (b.top > cursor && wasteRatio <= 0.85) {
            next = b.top;
          }
          break;
        }
      }
    }
    if (next <= cursor) next = Math.min(cursor + pageHeightPxIdeal, canvasHeightPx);
    boundaries.push(next);
    cursor = next;
  }
  if (cursor < canvasHeightPx) boundaries.push(canvasHeightPx);
  return boundaries;
}

// שם-קובץ בטוח: אך ורק מספר-ההצעה האמיתי המפורמט (למשל "A100701") - לעולם
// לא UUID/מזהה-מסד-נתונים גולמי, שעלול לדלוף פרטי-מערכת פנימיים. חסר
// מספר אמיתי (הצעה ישנה טרם ה-migration) נופל לשם גנרי קבוע, לא לשבריר
// UUID כלשהו.
export function buildQuotePdfFilename(formattedQuoteNumber) {
  const safe = (formattedQuoteNumber || '').replace(/[^A-Za-z0-9_-]/g, '');
  return safe ? `Tekango-Quote-${safe}.pdf` : 'Tekango-Quote.pdf';
}

// חוק ברזל (Faded PDF Logo Correction task): הוספת crossOrigin="anonymous"
// ל-<img> הלוגו (PublicQuoteHeader.jsx) פותרת את הכתמת ה-canvas, אך
// עצמה מחייבת לפעמים בקשת-רשת חדשה ונפרדת (מצב-CORS נטען בנפרד ממצב
// no-cors לפי הספסיפיקציה - אותו URL, cache שונה) - זו בקשה אמיתית
// שעלולה לארוך יותר מהעיכוב הקבוע הקיים כבר בקוד הקורא (80ms, שקיים אך
// ורק כדי לתת לדפדפן reflow אחריהחלת class .pq-pdf-capturing, לא כדי
// להמתין לתמונות). לכן לפני קריאת html2canvas ממתינים בפועל לכל תמונה
// בתוך אלמנט-הלכידה: img.decode() כשקיים (המסלול המודרני, מבטיח פענוח
// מלא לא רק "started loading"), עם נפילה-חזרה בטוחה למאזיני load/error
// כש-decode לא קיים, וטיימאאוט חסום (לא ממתין לנצח אם תמונה נכשלת/
// נתקעת) - לעולם לא עיכוב-קבוע-ארוך-יותר כפתרון יחיד, כנדרש.
export async function waitForImagesReady(rootEl, timeoutMs = 2500) {
  const imgs = Array.from(rootEl.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
    if (typeof img.decode === 'function') {
      return Promise.race([img.decode().catch(() => {}), timeout]);
    }
    return Promise.race([
      new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      }),
      timeout,
    ]);
  }));
}

export async function generateQuotePdf({ captureEl, filename, scale = 2.5 }) {
  if (!captureEl) throw new Error('generateQuotePdf: captureEl is required');

  await waitForImagesReady(captureEl);

  const blocksPx = computeBlockRanges(captureEl).map((b) => ({ top: b.top * scale, bottom: b.bottom * scale }));

  const canvas = await html2canvas(captureEl, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  if (!canvas || !canvas.width || !canvas.height) {
    throw new Error('generateQuotePdf: capture produced an empty canvas');
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageWidthPt = pdf.internal.pageSize.getWidth();
  const pageHeightPt = pdf.internal.pageSize.getHeight();
  const pxPerPt = canvas.width / pageWidthPt;
  const pageHeightPxIdeal = pageHeightPt * pxPerPt;

  const boundaries = computePageBoundaries(canvas.height, pageHeightPxIdeal, blocksPx);

  let pageIndex = 0;
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const sliceTop = boundaries[i];
    const sliceBottom = boundaries[i + 1];
    const sliceHeightPx = Math.ceil(sliceBottom - sliceTop);
    if (sliceHeightPx <= 0) continue;

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(canvas, 0, sliceTop, canvas.width, sliceBottom - sliceTop, 0, 0, canvas.width, sliceBottom - sliceTop);

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.94);
    if (pageIndex > 0) pdf.addPage();
    const sliceHeightPt = (sliceBottom - sliceTop) / pxPerPt;
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthPt, sliceHeightPt, undefined, 'FAST');
    pageIndex += 1;
  }

  if (pageIndex === 0) {
    // תוכן קצר מדי מכדי לייצר אפילו פרוסה אחת (לא אמור לקרות בפועל) -
    // עדיין חייבים לפחות עמוד אחד תקין ב-PDF.
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, pageWidthPt, canvas.height / pxPerPt, undefined, 'FAST');
  }

  pdf.save(filename);
}

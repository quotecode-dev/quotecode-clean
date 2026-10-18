import { syncAllAmountAxes } from '../quoteDocument/useAmountAxis';
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
// .pq-unit-item (Final Claude Builder task after Codex root-cause review):
// כשה-<tr> הוסר ממבנה-הפריט של יחידה מחולקת (הוחלף בכרטיסי-תצוגה), הגנת
// אי-הפיצול הישנה-בעקיפין על tr לכל פריט בודד נעלמה יחד איתו. class
// ה-scoped הזה מחזיר בדיוק את אותה הגנה בגרנולריות פר-פריט-בודד (לעולם
// לא פר-יחידה-שלמה) - ר' ItemBlock ב-DividedQuoteUnits.jsx. .pq-section
// עצמו נשאר ברשימה בלי שינוי - הוא מגן על בלוקים קטנים ולא-קשורים אחרים
// בעמוד (סיכומים, תנאים, הודעות) שלא נגעו בהם כלל במשימה הזו.
//
// חוק ברזל (CORRECTIVE PAGINATION EFFICIENCY PASS task, real Owner-video
// evidence: "large unused blank areas", "units moved to the next page too
// early"). Root cause, measured live on A100726: every whole divided-quote
// unit (.pq-section, via DividedQuoteUnits.jsx) was protected by this SAME
// "hard" no-split list, sharing the old 85%-waste escape hatch below -
// meaning a page boundary landing anywhere inside a unit pushed the ENTIRE
// unit forward unless doing so would have wasted MORE than 85% of the
// page. In practice this is an almost-never-triggered ceiling, so a
// multi-item unit was essentially ALWAYS moved whole, no matter how much
// of the current page that left empty. `.pq-section:not(.pq-unit-card)`
// below excludes the whole-unit wrapper (and the "Unassigned" bucket,
// which has the identical giant-atomic-block risk) from this hard list -
// they get their own, much stricter, soft treatment (UNIT_SOFT_SPLIT_*
// below) instead. Every OTHER `.pq-section` user (totals, terms, recipient
// boxes, messages) is untouched - still hard-protected, same as before.
// Task 16 - Quote Experience V2: `.pq-media-figure` (one Modern rail / Visual hero image + its caption, from
// src/quoteDocument/QuoteMedia.jsx) is an atomic block too - a page boundary never cuts an image away from its caption.
// The letterhead keeps `.pq-header-box`; the fine-ruled notes, totals and approval record keep `.pq-section`.
export const NO_SPLIT_SELECTOR = 'tr, .pq-section:not(.pq-unit-card), .pq-unit-item, .pq-recipient, .pq-header-box, .pq-media-figure';

// חוק ברזל (CORRECTIVE PAGINATION EFFICIENCY PASS task): a whole divided-
// quote unit (or the Unassigned bucket) is a "soft" atomic block - moving
// it whole to the next page is still preferred when the resulting waste is
// small, but no longer allowed to eat up to 85% of a page the way the old
// shared hard-block threshold did. The Owner's own explicit range ("roughly
// 20-25%") is applied as 0.22 - a page must not end with more than ~22% of
// its own printable height sitting empty merely because a whole unit was
// moved wholesale. When a whole-unit push would exceed this, the unit is
// allowed to split at its own internal item boundaries instead (each
// individual item, `.pq-unit-item`, remains fully hard-protected above and
// can never itself be cut) - this is `computePageBoundaries`' own new
// smallest-matching-block-first selection (see its own comment below), not
// a second, separate mechanism.
const UNIT_SOFT_SPLIT_SELECTOR = '.pq-unit-card';
const UNIT_SOFT_SPLIT_MAX_WASTE_RATIO = 0.22;

// חוק ברזל (PDF/Print Document Safety Contract - "TOTALS MUST NEVER TOUCH
// OR CROSS THE PRINT-SAFE BOTTOM ZONE", ONE-PASS SMART QUOTE FINAL
// REMEDIATION task, real-user video evidence: "totals can sit dangerously
// close to the printable page bottom"). The totals card (`.pq-totals-box`)
// already inherits ordinary no-split protection via its own `.pq-section`
// class (NO_SPLIT_SELECTOR above) - but "never split" alone still allowed
// it to land flush against the very last pixel of a page whenever it
// happened to fit exactly, with zero visual breathing room. This gives it
// an EXTRA required clearance below its own real bottom edge before a page
// is allowed to end there.
//
// חוק ברזל (CORRECTIVE PAGINATION EFFICIENCY PASS task - real root cause of
// the Owner's video evidence, measured live on A100726, not guessed): the
// ORIGINAL version of this mechanism pushed the WHOLE totals block back to
// its own TOP whenever the boundary landed inside its content OR inside
// this safety-margin extension - correct when the boundary falls inside
// the totals block's REAL content (never split), but genuinely wrong when
// it falls only inside the extra, purely-decorative safety-margin buffer:
// on A100726, totals' own real content (144px) fit on page 1 with 128px of
// real headroom to spare - only the LAST ~19px of the 24pt/47px safety
// buffer pushed the naive boundary past it, which was enough to move the
// ENTIRE totals block (plus everything after it - terms, footer) onto a
// second page that then rendered only ~35% full, ~65% blank - exactly the
// "large unused blank area" the Owner's video showed. Fixed by giving the
// safety-margin zone its own, DISJOINT block (spanning only bottom..
// bottom+margin, never overlapping totals' own real content, which keeps
// its own separate, ordinary, never-relaxed hard protection via
// NO_SPLIT_SELECTOR above) with its own `pushTo` target
// (TOTALS_BOTTOM_FALLBACK_MARGIN_PT below totals' real bottom, not all the
// way back to its top) - a boundary landing only in the decorative buffer
// now falls back to a smaller-but-still-real clearance instead of
// stranding the whole block on a near-empty next page. Totals' own content
// is completely unaffected - still 100% atomic, still real (non-zero)
// clearance below it in every case, exactly preserving "TOTALS MUST NEVER
// TOUCH OR CROSS THE PRINT-SAFE BOTTOM ZONE" - only the SIZE of that
// clearance becomes conditional (24pt when room allows, degrading to
// TOTALS_BOTTOM_FALLBACK_MARGIN_PT only in the rare case where insisting
// on the full 24pt would otherwise waste most of an entire extra page).
// Full 24pt value justified from this project's own already-established
// real print margin (`@page { margin: 12mm 10mm }`) - roughly 2/3 of that
// page's own vertical margin (8mm ≈ 22.68pt, rounded to 24pt); the fallback
// (6pt ≈ 2.1mm) is roughly a quarter of that - still a real, visible,
// non-zero gap, never a guess disconnected from the real page geometry.
const TOTALS_SAFE_MARGIN_SELECTOR = '.pq-totals-box';
const TOTALS_BOTTOM_SAFE_MARGIN_PT = 24;
const TOTALS_BOTTOM_FALLBACK_MARGIN_PT = 6;

// חוק ברזל (ONE SHARED A4 DOCUMENT CONTRACT, "FINAL SMART QUOTE PDF/PRINT/A4
// CLOSURE PASS" task - Owner-mandated: "PDF and Print must share the same
// A4 content bounds; printed PDF must preserve the same safe margins as
// downloaded PDF"). Before this task, this generator drew the ENTIRE
// captured canvas edge-to-edge onto every A4 page (`addImage(..., 0, 0,
// pageWidthPt, ...)`) - ZERO page-level margin of its own, relying purely
// on whatever internal padding the captured DOM element (`.pq-card`)
// happened to carry on-screen. The native Print pipeline, meanwhile,
// already had a real, Owner-approved `@page { size: A4; margin: 12mm 10mm }`
// rule (PublicQuote.jsx/PublicQuoteEn.jsx print stylesheet) - a
// completely different, unreconciled margin source. These constants ARE
// that same `@page` rule's own values, reused here (not a second
// invented number) so both pipelines now share one identical, explicit,
// physical-unit content box: A4 (210mm x 297mm) minus a 10mm horizontal /
// 12mm vertical margin on every side = a 190mm-wide, 273mm-tall content
// area on every page. The captured canvas (whatever raw pixel width
// `.pq-card` happened to render at on-screen) is now always SCALED to
// exactly fill that 190mm content width, never the full 210mm page width -
// this is what makes "the same A4 content bounds" a real, verifiable,
// physical-unit fact instead of an incidental byproduct of two unrelated
// numbers.
const A4_MARGIN_MM = { top: 12, bottom: 12, left: 10, right: 10 };
const MM_TO_PT = 72 / 25.4; // 1pt = 1/72in; 1in = 25.4mm - standard, not approximated.
// A4 in pt, per the ISO 216 standard (210mm x 297mm) - matches jsPDF's own
// `format: 'a4'` exactly; kept as an explicit constant here (not re-derived
// from a live jsPDF instance) so this exact contract is unit-testable
// without constructing one.
const A4_WIDTH_PT = 210 * MM_TO_PT;
const A4_HEIGHT_PT = 297 * MM_TO_PT;

// נקודת-קריאה יחידה, ניתנת-לבדיקה, לחוזה-הגבולות המשותף (A4 CONTENT-BOX
// CONTRACT) - לא רק קבועים גולמיים, אלא התוצאה המחושבת בפועל (contentWidthPt/
// contentHeightPt) ש-generateQuotePdf עצמה משתמשת בה. נבדקת ישירות ב-
// generateQuotePdf.test.js, בלי צורך להריץ jsPDF/html2canvas עצמם (שאין
// להם תמיכת jsdom אמיתית).
export function getA4ContentBoxPt() {
  const marginTopPt = A4_MARGIN_MM.top * MM_TO_PT;
  const marginBottomPt = A4_MARGIN_MM.bottom * MM_TO_PT;
  const marginLeftPt = A4_MARGIN_MM.left * MM_TO_PT;
  const marginRightPt = A4_MARGIN_MM.right * MM_TO_PT;
  return {
    pageWidthPt: A4_WIDTH_PT,
    pageHeightPt: A4_HEIGHT_PT,
    marginTopPt,
    marginBottomPt,
    marginLeftPt,
    marginRightPt,
    contentWidthPt: A4_WIDTH_PT - marginLeftPt - marginRightPt,
    contentHeightPt: A4_HEIGHT_PT - marginTopPt - marginBottomPt,
  };
}

function computeBlockRanges(rootEl, selector) {
  const rootRect = rootEl.getBoundingClientRect();
  return Array.from(rootEl.querySelectorAll(selector))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - rootRect.top, bottom: r.bottom - rootRect.top };
    })
    .filter((b) => b.bottom > b.top)
    .sort((a, b) => a.top - b.top);
}

// חוק ברזל (default waste-ratio ceiling, unchanged from before this task):
// any block passed in without its own explicit `maxWasteRatio` keeps the
// original, generous 85% ceiling - every existing hard-protected block
// (items, table rows, recipient/header boxes, totals, terms, messages)
// behaves byte-identically to before this task. Only a block that
// explicitly sets a tighter `maxWasteRatio` (currently: whole divided-quote
// units, via UNIT_SOFT_SPLIT_MAX_WASTE_RATIO above) is held to a stricter
// standard.
const DEFAULT_MAX_WASTE_RATIO = 0.85;

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
      // חוק ברזל (CORRECTIVE PAGINATION EFFICIENCY PASS task - "use the
      // smallest meaningful atomic block"): the OLD loop broke after
      // examining only the FIRST block (array order) whose range contained
      // `next` - if that first block happened to be a large outer wrapper
      // (e.g. a whole unit) and its own waste ratio was rejected, the loop
      // gave up immediately, even when a smaller block nested INSIDE it
      // (e.g. one item) also contained `next` and would have produced a
      // much smaller, perfectly acceptable waste. Every candidate block
      // whose range actually contains `next` is now collected, then tried
      // smallest/innermost first (largest `top` first - a block nested
      // inside another one always starts later than its own container) -
      // the first candidate whose own waste-ratio ceiling is satisfied
      // wins. This is what lets an oversized unit split cleanly at one of
      // its own item boundaries instead of being pushed whole, while an
      // individual item (no smaller block nested inside it) is still
      // always evaluated as its own, generously-thresholded candidate.
      //
      // חוק ברזל (CORRECTIVE PAGINATION EFFICIENCY PASS task - `pushTo`):
      // a block normally gets pushed back to its OWN top (`b.top`, the
      // default when `pushTo` is absent) - correct for "never split this
      // block's real content." A block MAY instead declare a different,
      // explicit `pushTo` target - used by the totals safety-margin zone
      // (see its own comment above `TOTALS_BOTTOM_SAFE_MARGIN_PT`) to push
      // back only to a smaller fallback clearance instead of all the way
      // to the totals block's own top, when the boundary falls only inside
      // that purely-decorative buffer, never inside totals' real content.
      const candidates = blocksPx
        .filter((b) => next > b.top && next < b.bottom)
        .sort((a, b) => b.top - a.top);
      for (const b of candidates) {
        const pushTarget = b.pushTo == null ? b.top : b.pushTo;
        if (pushTarget <= cursor) continue; // would not move the boundary backward at all - not a usable candidate
        const wasteRatio = (next - pushTarget) / pageHeightPxIdeal;
        const maxWasteRatio = b.maxWasteRatio == null ? DEFAULT_MAX_WASTE_RATIO : b.maxWasteRatio;
        if (wasteRatio <= maxWasteRatio) {
          next = pushTarget;
          break;
        }
      }
    }
    if (next <= cursor) next = Math.min(cursor + pageHeightPxIdeal, canvasHeightPx);
    boundaries.push(next);
    cursor = next;
  }
  if (cursor < canvasHeightPx) boundaries.push(canvasHeightPx);

  // חוק ברזל (real regression found and fixed, "FINAL SMART QUOTE PDF/
  // PRINT/A4 CLOSURE PASS" task, real Download-PDF evidence - a genuinely
  // BLANK trailing page, confirmed via a real downloaded PDF for a short
  // EN fixture, not just theorized): this task's own A4-content-box fix
  // shrank pageHeightPxIdeal from a full-page budget to a content-box
  // budget (page height minus real top/bottom margins) - for content whose
  // real captured height lands just barely OVER an exact multiple of that
  // new, smaller budget (a few px of trailing whitespace/padding, not any
  // real atomic block), the loop above correctly produces a genuine extra
  // page for that sliver - technically correct pixel accounting, but a
  // real, unacceptable visual defect (an entire page that is, for all
  // practical purposes, empty). A negligible trailing slice (under 3% of
  // one page's own height) is merged back into the PREVIOUS page instead -
  // that page simply ends up a few px taller than "ideal," which is
  // harmless, rather than producing a near-blank extra page, which is not.
  // Never merges a real content page (3% of a full page is far smaller
  // than any real atomic block this function already protects above).
  const NEGLIGIBLE_TRAILING_SLICE_RATIO = 0.03;
  if (boundaries.length > 2 && pageHeightPxIdeal > 0) {
    const lastSliceHeight = boundaries[boundaries.length - 1] - boundaries[boundaries.length - 2];
    if (lastSliceHeight > 0 && lastSliceHeight / pageHeightPxIdeal < NEGLIGIBLE_TRAILING_SLICE_RATIO) {
      boundaries.splice(boundaries.length - 2, 1);
    }
  }

  return boundaries;
}

// שם-קובץ בטוח: אך ורק מספר-ההצעה האמיתי המפורמט (למשל "A100701") - לעולם
// לא UUID/מזהה-מסד-נתונים גולמי, שעלול לדלוף פרטי-מערכת פנימיים. חסר
// מספר אמיתי (הצעה ישנה טרם ה-migration) נופל לשם גנרי קבוע, לא לשבריר
// UUID כלשהו.
// PRODUCT_TRUTH_CAPABILITY: quote_pdf
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

// Task 16 correction F (2026-10-05, Codex pagination finding): the Direct PDF used to be a photograph of the document
// at whatever width the CUSTOMER'S device happened to have - on a 390px phone the narrow mobile layout was scaled UP to
// the 190mm A4 content width, so a short quote became 2-3 pages and a long one 3-4 (measured on real TEST quotes),
// while the same quote from a desktop was 1 page. The capture is now rendered in html2canvas's clone at ONE fixed
// document window width, so every device produces the same A4 document (the desktop document composition).
// Review follow-up (readability): the document itself is laid out at the A4 content width in CSS pixels
// (190mm = 718px at 96dpi), so 1 CSS px lands as 0.75pt on paper - exactly the scale of native Print. Body text
// (12-12.5px in the A4 density rules) therefore prints at 9-9.4pt instead of ~7pt from a 1,062px-wide capture; long
// quotes take more pages rather than shrinking. The window stays desktop-wide so no mobile/tablet media rule applies.
// Pagination blocks are measured on that clone (the geometry actually captured), with the live element as a fallback
// when no clone is available.
export const PDF_CAPTURE_WINDOW_WIDTH = 1100;
export const PDF_DOCUMENT_WIDTH_PX = 718;

// IRON-NUMERIC-001 in the Direct PDF (Owner 2026-10-18 "זה חייב להראות בדיוק כמו המסך"): html2canvas paints text on a canvas, and a
// canvas ignores tabular figures - an amount painted as one word gets proportional digits, so its right edge drifts. In the capture
// clone only, every digit of an amount / quantity becomes its own box of the tabular digit width with the glyph centred in it -
// exactly where a tabular digit sits on screen - so the captured amounts keep the screen's right edge and decimal axis.
export function tabularizeDigitsForCapture(rootEl) {
  if (!rootEl || typeof rootEl.querySelectorAll !== 'function' || !rootEl.ownerDocument) return 0;
  const doc = rootEl.ownerDocument;
  let n = 0;
  rootEl.querySelectorAll('.pf-money, .pq-num-slot').forEach((el) => {
    const probe = doc.createElement('span');
    probe.textContent = '0';
    probe.style.cssText = 'position:absolute;visibility:hidden;font-variant-numeric:tabular-nums lining-nums;font-feature-settings:"tnum" 1, "lnum" 1';
    el.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    if (!(w > 0)) return;
    // a number is ALWAYS left-to-right and isolated: separate digit boxes inside a Hebrew line must never be reordered
    // ("3.40" must not become "04.3" - found in the HE Direct PDF, 2026-10-18)
    el.style.direction = 'ltr';
    el.style.unicodeBidi = 'isolate';
    const walker = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
    const texts = [];
    for (let t = walker.nextNode(); t; t = walker.nextNode()) if (/\d/.test(t.data)) texts.push(t);
    for (const t of texts) {
      const frag = doc.createDocumentFragment();
      for (const ch of t.data) {
        if (/\d/.test(ch)) {
          const box = doc.createElement('span');
          box.textContent = ch;
          box.style.cssText = `display:inline-block;width:${w}px;text-align:center;font-variant-numeric:normal;font-feature-settings:normal`;
          frag.appendChild(box);
          n += 1;
        } else frag.appendChild(doc.createTextNode(ch));
      }
      t.parentNode.replaceChild(frag, t);
    }
  });
  return n;
}

// html2canvas ignores CSS object-fit, so a cropped (object-fit: cover) quote image would be STRETCHED into its fixed frame
// in the PDF. In the capture clone only, each framed <img> is replaced by the frame's own cover background (which
// html2canvas does render) - the on-screen page is never touched.
export function coverFramedImagesForCapture(rootEl) {
  if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return 0;
  let n = 0;
  rootEl.querySelectorAll('.pq-media-frame > img').forEach((img) => {
    const src = img.currentSrc || img.src;
    if (!src) return;
    const frame = img.parentElement;
    frame.style.backgroundImage = `url("${String(src).replace(/"/g, '%22')}")`;
    frame.style.backgroundSize = 'cover';
    frame.style.backgroundPosition = 'center';
    frame.style.backgroundRepeat = 'no-repeat';
    img.style.visibility = 'hidden';
    n += 1;
  });
  return n;
}

// End of the document (cloud-fix3): the approval / status record + footer, and the last body block before them (Modern:
// the deepest last block of its body wrappers). Coordinates relative to rootEl, like computeBlockRanges.
const DOC_END_SELECTOR = '.pq-approval, .pq-doc-status, .pq-doc-foot';
const BODY_WRAPPER_RE = /(^|\s)pq-body-(grid|main|aside)(\s|$)/;
export function measureDocumentEnd(rootEl) {
  if (!rootEl || typeof rootEl.querySelector !== 'function') return null;
  const first = rootEl.querySelector(DOC_END_SELECTOR);
  if (!first) return null;
  let prev = first.previousElementSibling;
  while (prev && BODY_WRAPPER_RE.test(String(prev.className || '')) && prev.lastElementChild) prev = prev.lastElementChild;
  if (!prev) return null;
  const rootTop = rootEl.getBoundingClientRect().top;
  const ends = Array.from(rootEl.querySelectorAll(DOC_END_SELECTOR)).map((el) => el.getBoundingClientRect());
  const p = prev.getBoundingClientRect();
  return {
    top: p.top - rootTop,
    bodyBottom: p.bottom - rootTop,
    bottom: Math.max(...ends.map((r) => r.bottom)) - rootTop,
  };
}

// True when a page slice of `boundaries` would show only the end of the document (approval / footer) and no body block,
// i.e. the last slice starts at or below the bottom of the last body block.
export function endIsOrphaned(boundaries, end) {
  if (!end || !Array.isArray(boundaries) || boundaries.length < 3) return false;
  return boundaries[boundaries.length - 2] >= end.bodyBottom - 1;
}

// Page boundaries that never leave the approval / footer alone on the last page (cloud-fix3, the Direct PDF twin of the
// native-Print keep-together rule). The plain boundaries are kept whenever they do not orphan the end - including the
// existing negligible-trailing-slice merge, so a document that was one page stays one page; only when the last page would
// hold nothing but the approval / footer is the last body block + approval + footer protected as one block and the
// boundaries recomputed (the group then moves to the last page together).
export function computeDocumentBoundaries(canvasHeightPx, pageHeightPxIdeal, blocksPx, endPx) {
  const plain = computePageBoundaries(canvasHeightPx, pageHeightPxIdeal, blocksPx);
  if (!endIsOrphaned(plain, endPx)) return plain;
  // a group taller than the push-back ceiling cannot move as one piece - keep the plain slicing
  if ((endPx.bottom - endPx.top) / pageHeightPxIdeal > DEFAULT_MAX_WASTE_RATIO) return plain;
  // the group replaces the protected blocks inside it (otherwise the approval block alone would be pushed again)
  const outside = blocksPx.filter((b) => b.bottom <= endPx.top + 0.5 || b.top >= endPx.bottom - 0.5);
  const grouped = [...outside, { top: endPx.top, bottom: endPx.bottom }].sort((a, b) => a.top - b.top);
  const result = computePageBoundaries(canvasHeightPx, pageHeightPxIdeal, grouped);
  return endIsOrphaned(result, endPx) ? plain : result;
}

export function measurePaginationBlocks(rootEl) {
  return {
    blocks: computeBlockRanges(rootEl, NO_SPLIT_SELECTOR),
    totals: computeBlockRanges(rootEl, TOTALS_SAFE_MARGIN_SELECTOR),
    units: computeBlockRanges(rootEl, UNIT_SOFT_SPLIT_SELECTOR),
    end: measureDocumentEnd(rootEl),
  };
}

export async function generateQuotePdf({ captureEl, filename, scale = 2.5, windowWidth = PDF_CAPTURE_WINDOW_WIDTH, documentWidth = PDF_DOCUMENT_WIDTH_PX }) {
  if (!captureEl) throw new Error('generateQuotePdf: captureEl is required');

  await waitForImagesReady(captureEl);

  let clonedMeasurement = null;
  const canvas = await html2canvas(captureEl, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth,
    onclone: (_clonedDocument, clonedEl) => {
      if (clonedEl && typeof clonedEl.getBoundingClientRect === 'function') {
        if (documentWidth) {
          clonedEl.style.width = `${documentWidth}px`;
          clonedEl.style.maxWidth = 'none';
          clonedEl.style.boxSizing = 'border-box';
        }
        coverFramedImagesForCapture(clonedEl);
        // IRON-NUMERIC-001 (Owner 2026-10-18 "זה חייב להראות בדיוק כמו המסך"): tabular digit boxes, then the amount axis re-measured
        // on the A4-wide clone
        tabularizeDigitsForCapture(clonedEl);
        syncAllAmountAxes(clonedEl);
        clonedMeasurement = measurePaginationBlocks(clonedEl);
      }
    },
  });
  const { blocks: domBlocks, totals: domTotalsBlocks, units: domUnitBlocks, end: domEnd } = clonedMeasurement || measurePaginationBlocks(captureEl);

  if (!canvas || !canvas.width || !canvas.height) {
    throw new Error('generateQuotePdf: capture produced an empty canvas');
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  // A4 CONTENT-BOX CONTRACT (see getA4ContentBoxPt's own comment above): the
  // captured canvas is scaled to fill the CONTENT width (page width minus
  // left+right margin), never the raw page width - `pxPerPt` and every
  // page-height/placement calculation below are now content-box-relative,
  // not page-relative. This is the one change that makes "the same A4
  // content bounds in both pipelines" a physical-unit fact: previously
  // pxPerPt = canvas.width / pageWidthPt (edge-to-edge, zero margin). Reads
  // from the one shared, unit-tested source of truth - never re-derives its
  // own copy of the margin math.
  const { marginTopPt, marginLeftPt, contentWidthPt, contentHeightPt } = getA4ContentBoxPt();
  const pxPerPt = canvas.width / contentWidthPt;
  const pageHeightPxIdeal = contentHeightPt * pxPerPt;

  const blocksPx = domBlocks.map((b) => ({ top: b.top * scale, bottom: b.bottom * scale }));
  // Totals-block safe-bottom-zone (CORRECTIVE PAGINATION EFFICIENCY PASS
  // task - see TOTALS_BOTTOM_SAFE_MARGIN_PT/TOTALS_BOTTOM_FALLBACK_MARGIN_PT's
  // own comment above for the real, measured root cause this fixes). This
  // is now a block DISJOINT from totals' own real content (starts at
  // totals' real bottom, not its top) - totals' real content keeps its
  // ordinary, unconditional hard protection via `blocksPx`/NO_SPLIT_SELECTOR
  // above, completely unaffected by anything below. A boundary landing
  // only inside this purely-decorative buffer zone pushes back to a small
  // fallback clearance (`pushTo`), never all the way to totals' own top -
  // the fix that stops the whole totals block (and everything after it)
  // from being stranded on a near-empty next page merely because the last
  // few px of an optional visual buffer didn't fit.
  const totalsSafeMarginPx = TOTALS_BOTTOM_SAFE_MARGIN_PT * pxPerPt;
  const totalsFallbackMarginPx = TOTALS_BOTTOM_FALLBACK_MARGIN_PT * pxPerPt;
  const totalsBlocksPx = domTotalsBlocks.map((b) => {
    const realBottomPx = b.bottom * scale;
    return {
      top: realBottomPx,
      bottom: realBottomPx + totalsSafeMarginPx,
      pushTo: realBottomPx + totalsFallbackMarginPx,
    };
  });
  // CORRECTIVE PAGINATION EFFICIENCY PASS: whole units (and the Unassigned
  // bucket) get their own, much stricter waste-ratio ceiling - see
  // UNIT_SOFT_SPLIT_MAX_WASTE_RATIO's own comment above. Any individual
  // item nested inside a unit is ALSO present in `blocksPx` (hard-
  // protected, generous default ceiling) - computePageBoundaries' own
  // smallest-block-first selection is what lets it win over this wider,
  // stricter unit-level block whenever a boundary happens to fall inside
  // one specific item.
  const unitBlocksPx = domUnitBlocks.map((b) => ({ top: b.top * scale, bottom: b.bottom * scale, maxWasteRatio: UNIT_SOFT_SPLIT_MAX_WASTE_RATIO }));
  const allProtectedBlocksPx = [...blocksPx, ...totalsBlocksPx, ...unitBlocksPx].sort((a, b) => a.top - b.top);

  const endPx = domEnd ? { top: domEnd.top * scale, bodyBottom: domEnd.bodyBottom * scale, bottom: domEnd.bottom * scale } : null;
  const boundaries = computeDocumentBoundaries(canvas.height, pageHeightPxIdeal, allProtectedBlocksPx, endPx);

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
    // A4 CONTENT-BOX CONTRACT: inset by the same margin on every side,
    // width fixed to contentWidthPt (never pageWidthPt) - this is what
    // actually creates the real, physical margin around the content on
    // every page (previously 0,0/pageWidthPt = edge-to-edge, no margin).
    pdf.addImage(imgData, 'JPEG', marginLeftPt, marginTopPt, contentWidthPt, sliceHeightPt, undefined, 'FAST');
    pageIndex += 1;
  }

  if (pageIndex === 0) {
    // תוכן קצר מדי מכדי לייצר אפילו פרוסה אחת (לא אמור לקרות בפועל) -
    // עדיין חייבים לפחות עמוד אחד תקין ב-PDF.
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', marginLeftPt, marginTopPt, contentWidthPt, canvas.height / pxPerPt, undefined, 'FAST');
  }

  pdf.save(filename);
}

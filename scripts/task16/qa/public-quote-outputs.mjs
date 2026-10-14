// Task 16 - PUBLIC QUOTE OUTPUTS GATE (cloud, 2026-10-05). Renders the REAL public quote route (/quote/:id ->
// SmartPublicQuote -> PublicQuote / PublicQuoteEn) of a production-mode build, with get-public-quote and
// quote-presentation answered by Playwright mocks carrying the SYNTHETIC sample-quote DTOs (src/quoteDocument/
// sampleQuotes.js, built inside the dev server). No persona, no TEST/Production contact: LOCAL-DEV evidence only - a
// real issued TEST quote, signing and the Owner's devices remain NOT VERIFIED here. NOT TEST and NOT Owner acceptance.
//
// GATE: every check is a PASS/FAIL cell; the JSON report lists all cells, the console prints a summary + every FAIL,
// and the process exits 1 on any FAIL (2 on a setup error). Cells per HE/EN x Classic/Modern/Visual x short/long x
// images on/off (main case = business phone + Attn contact):
//   screen/band-dark                      .pq-lh-band background luminance < 80 on screen
//   screen/no-overflow                    no page / card / table-wrap horizontal scroll, no item-table cell content wider than its cell
//   tiles/count-4-with-phone              exactly 4 .pq-action-tile with a business phone
//   tiles/in-card-no-output               (cloud-fix4, ledger D21a, A17 G4b: base position) the tile group is INSIDE .pq-card,
//                                         marked .no-print + data-html2canvas-ignore (never printed / captured - print/no-ui-text
//                                         and direct/no-ui-captured assert the outputs)
//   recipient/client-block                [data-role="client"] opens with the label לכבוד / To and holds the client name
//   recipient/contact-block               [data-role="contact"] opens with the label לידי / Attn and holds quote.attn_name
//   recipient/business-not-in-role-blocks the business name is not inside any recipient [data-role] block
//   table/numeric-columns-centred         .pq-card table th/td of Quantity / Unit price / Amount: text-ink centre within
//                                         <= 1px of the cell centre (Owner decision 2026-10-05)
//   totals/right-edge-aligned             .pq-totals-box .pf-money right edges spread <= 0.75px
//   print/band-white-text-dark            print media: band background white (or transparent) and band text dark
//   print/pages                           native Print PDF page count = EXPECTED_PAGES
//   print/approval-on-last-page           approval title + copy on the LAST page of the Print PDF
//   print/approval-semantic               (cloud-fix4) SEMANTIC placement, not text presence: the approval record follows every
//                                         body block in the DOM and the print layout, its title sits below every body word of
//                                         the last PDF page, and the signature line is inside the approval block (DOM + box)
//                                         and below the title on the last page (print/printLib.mjs approvalPlacement)
//   print/no-ui-text                      Print PDF text has no action-tile / sign-panel / sample-toolbar label, nor the header
//                                         Call CTA ("חייג/י אליי" / "Call me" - screen only, ledger D21b, cloud-fix4)
//   direct/pages                          Direct PDF (real button -> downloaded file) page count = EXPECTED_PAGES
//   direct/header-white                   Direct PDF page 1 header area dark-pixel fraction < 0.05 ("PDF as today")
//   direct/no-ui-captured                 at capture time .pq-card holds no visible tile/input/toolbar and no UI label
//                                         (the Direct PDF is a raster - its text layer, if any, is also checked)
//   direct/state-restored                 after the download: .pq-pdf-capturing removed and the screen band dark again
//   print/role-client                     Print PDF (word boxes, page 1): every word of the client company below the label
//                                         לכבוד / To, inside that label's own card column
//   print/role-contact                    Print PDF: every word of quote.attn_name below לידי / Attn in its own column
//   print/no-forbidden-role-labels        Print PDF text has no מאת / עבור / From / Prepared for label
//   print/business-letterhead-only        Print PDF: the business name first appears above the client label (letterhead) and
//                                         never inside a recipient label's window (its column, 80pt below the label)
//   direct/role-client                    capture-time DOM (.pq-pdf-capturing set): [data-role=client] opens with לכבוד / To
//                                         and holds the client company
//   direct/role-contact                   capture-time DOM: [data-role=contact] opens with לידי / Attn and holds attn_name
//   direct/business-not-in-role-blocks    capture-time DOM: the business name is in no [data-role] block
// Variants (short only, per images mode): -nophone -> tiles/count-2-without-phone + tiles/in-card-no-output;
//                                         -nocontact (attn_name/attn_role null) -> client block present, NO contact block,
//                                         on screen, in the Print PDF text (print/no-contact-block) and at Direct PDF capture
//                                         time (direct/no-contact-block), plus the print/direct client + business cells.
// NOTE: the [data-role] recipient hooks and the centred numeric columns are being added by another Task 16 work item
// (A3); until that lands, the recipient/* and table/* cells FAIL by design.
//
// Usage: [PQ_IMAGES=0|1] [PW_CHROMIUM=<path>] node scripts/task16/qa/public-quote-outputs.mjs <devUrl> <buildUrl> <outDir>
//   devUrl   = a Vite dev server of the same tree (serves src/quoteDocument/sampleQuotes.js as an ES module)
//   buildUrl = `vite preview` of a production build made with VITE_SUPABASE_URL=http://127.0.0.1:54399
//   both on 127.0.0.1 (never port 5186). PQ_IMAGES unset = images on AND off; 1 = on only; 0 = off only.
//   PQ_VIEWPORTS=320x780,390x844,... runs every case at each viewport (cell ids are then prefixed with WxH).
//   Needs pdftotext + pdftoppm. Report: <outDir>/public-quote-outputs-gate.json, PDFs under <outDir>/pdf/.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { approvalPlacement, missingRows, norm as normText, probePrint, words as textWords } from './print/printLib.mjs';
import { contentFingerprint } from './print/fixtures.mjs';

const [DEV, BUILD, OUT] = process.argv.slice(2);
if (!DEV || !BUILD || !OUT) { console.error('usage: public-quote-outputs.mjs <devUrl> <buildUrl> <outDir>'); process.exit(2); }
for (const u of [DEV, BUILD]) {
  const url = new URL(u);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port === '5186') { console.error(`refusing ${u} (local only, never 5186)`); process.exit(2); }
}
mkdirSync(join(OUT, 'pdf'), { recursive: true });
const SUPA = 'http://127.0.0.1:54399';
const IMAGE_MODES = process.env.PQ_IMAGES === '1' ? [true] : process.env.PQ_IMAGES === '0' ? [false] : [true, false];
// PQ_VIEWPORTS=WxH,WxH,... runs every case at each viewport (browser matrix); default = the single 1280x900 desktop run.
const VIEWPORTS = (process.env.PQ_VIEWPORTS || '1280x900').split(',').map((v) => { const [width, height] = v.trim().split('x').map(Number); return { width, height, tag: `${width}x${height}` }; });
const MULTI_VP = VIEWPORTS.length > 1;

// Pagination fixtures (cloud-fix4 / 4b, A13 - ledger D24: the document prints at its SCREEN type with the base panels).
// cloud-fix4b (U13 / F5b, the Owner rejection S-REJ "short Modern/Visual print sometimes 2 pages"): the short sample WITH
// images is ONE A4 page in Modern and Visual too (native Print and Direct PDF) - the A4 layout layer prints the Visual hero
// + supports as one 100px row and the Modern letterhead as issuer | metadata halves (no type change, nothing omitted).
// Every short case is 1 page, every long case 2. Each expectation is BOUND to the exact fixture content - rows, images
// and the content fingerprint (print/fixtures.mjs contentFingerprint) - in FIXTURE_BINDING: a case whose data differs
// FAILS fixture/bound instead of being judged against an expectation made for other content. The 'grow' variant (S-REJ
// cases only) is the negative control: 4x the rows and 2x the media must paginate (>= 2 pages in Print and Direct PDF)
// with every row in the PDF text and every image printed and loaded (no clipping, nothing omitted).
const EXPECTED_PAGES = {
  'he/classic/short/img': { print: 1, direct: 1 }, 'he/classic/long/img': { print: 2, direct: 2 },
  'he/modern/short/img': { print: 1, direct: 1 }, 'he/modern/long/img': { print: 2, direct: 2 },
  'he/visual/short/img': { print: 1, direct: 1 }, 'he/visual/long/img': { print: 2, direct: 2 },
  'en/classic/short/img': { print: 1, direct: 1 }, 'en/classic/long/img': { print: 2, direct: 2 },
  'en/modern/short/img': { print: 1, direct: 1 }, 'en/modern/long/img': { print: 2, direct: 2 },
  'en/visual/short/img': { print: 1, direct: 1 }, 'en/visual/long/img': { print: 2, direct: 2 },
  'he/classic/short/noimg': { print: 1, direct: 1 }, 'he/classic/long/noimg': { print: 2, direct: 2 },
  'he/modern/short/noimg': { print: 1, direct: 1 }, 'he/modern/long/noimg': { print: 2, direct: 2 },
  'he/visual/short/noimg': { print: 1, direct: 1 }, 'he/visual/long/noimg': { print: 2, direct: 2 },
  'en/classic/short/noimg': { print: 1, direct: 1 }, 'en/classic/long/noimg': { print: 2, direct: 2 },
  'en/modern/short/noimg': { print: 1, direct: 1 }, 'en/modern/long/noimg': { print: 2, direct: 2 },
  'en/visual/short/noimg': { print: 1, direct: 1 }, 'en/visual/long/noimg': { print: 2, direct: 2 },
};
const FIXTURE_BINDING = {
  'he/classic/short/img': { rows: 3, images: 5, fp: 'f5ebb2ee386c9f75' }, 'he/classic/long/img': { rows: 18, images: 5, fp: 'c9ce4c68075aeeb5' },
  'he/modern/short/img': { rows: 3, images: 5, fp: 'f5ebb2ee386c9f75' }, 'he/modern/long/img': { rows: 18, images: 5, fp: 'c9ce4c68075aeeb5' },
  'he/visual/short/img': { rows: 3, images: 5, fp: 'f5ebb2ee386c9f75' }, 'he/visual/long/img': { rows: 18, images: 5, fp: 'c9ce4c68075aeeb5' },
  'en/classic/short/img': { rows: 3, images: 5, fp: '09d71e93b72fac57' }, 'en/classic/long/img': { rows: 18, images: 5, fp: 'fd6f8c894349b9b8' },
  'en/modern/short/img': { rows: 3, images: 5, fp: '09d71e93b72fac57' }, 'en/modern/long/img': { rows: 18, images: 5, fp: 'fd6f8c894349b9b8' },
  'en/visual/short/img': { rows: 3, images: 5, fp: '09d71e93b72fac57' }, 'en/visual/long/img': { rows: 18, images: 5, fp: 'fd6f8c894349b9b8' },
  'he/classic/short/noimg': { rows: 3, images: 0, fp: 'b66038758ec0a371' }, 'he/classic/long/noimg': { rows: 18, images: 0, fp: 'a205344ebb869298' },
  'he/modern/short/noimg': { rows: 3, images: 0, fp: 'b66038758ec0a371' }, 'he/modern/long/noimg': { rows: 18, images: 0, fp: 'a205344ebb869298' },
  'he/visual/short/noimg': { rows: 3, images: 0, fp: 'b66038758ec0a371' }, 'he/visual/long/noimg': { rows: 18, images: 0, fp: 'a205344ebb869298' },
  'en/classic/short/noimg': { rows: 3, images: 0, fp: '879531d536f2ad29' }, 'en/classic/long/noimg': { rows: 18, images: 0, fp: '82d3e9a133445fa3' },
  'en/modern/short/noimg': { rows: 3, images: 0, fp: '879531d536f2ad29' }, 'en/modern/long/noimg': { rows: 18, images: 0, fp: '82d3e9a133445fa3' },
  'en/visual/short/noimg': { rows: 3, images: 0, fp: '879531d536f2ad29' }, 'en/visual/long/noimg': { rows: 18, images: 0, fp: '82d3e9a133445fa3' },
};
// the cells of the recorded rejection S-REJ ("short Modern/Visual print sometimes 2 pages") - also the 'grow' controls
const S_REJ = new Set(['he/modern/short/img', 'en/modern/short/img', 'he/visual/short/img', 'en/visual/short/img']);
const GROW_ROWS = 4; // x rows
const GROW_MEDIA = 2; // x media
// every image of the document: printed (visible box), loaded, inside the card horizontally
function probeImages() {
  const card = document.querySelector('.pq-card');
  const cr = card.getBoundingClientRect();
  const imgs = [...card.querySelectorAll('img')].filter((i) => i.closest('.pq-media') || i.closest('.pq-media-frame'));
  return imgs.map((i) => {
    const r = i.getBoundingClientRect(); const fr = (i.closest('.pq-media-frame') || i).getBoundingClientRect();
    const cs = getComputedStyle(i);
    return { src: (i.currentSrc || i.src).split('/').pop(), loaded: i.complete && i.naturalWidth > 0, shown: fr.width > 4 && fr.height > 4 && cs.display !== 'none', inCard: fr.left >= cr.left - 1 && fr.right <= cr.right + 1, w: Math.round(fr.width), h: Math.round(fr.height), objectHidden: cs.visibility === 'hidden' };
  });
}
const DIRECT_HEADER_DARK_MAX = 0.05; // Direct PDF keeps the white letterhead (Owner has not decided otherwise)
const CENTRE_TOLERANCE_PX = 1;
const TOTALS_RIGHT_EDGE_SPREAD_PX = 0.75;

const LABELS = {
  he: { client: 'לכבוד', contact: 'לידי', approval: ['אישור ההצעה', 'חתימה מאשרת את תנאי ההצעה'], forbidden: [['מאת'], ['עבור']] },
  en: { client: 'To', contact: 'Attn', approval: ['Quote approval', 'Signature confirms the quotation terms'], forbidden: [['From'], ['Prepared', 'for']] },
};
// Recipient roles in the Print PDF, by word GEOMETRY (pdftotext -bbox, page 1): the two recipient cards sit side by side,
// so a text-line match cannot tell which card a word belongs to. A label "sits with" a name when every word of the name
// is found below the label (within 80pt) inside the label's own card column - from the label's inline-start edge (HE right,
// EN left; 24pt allowance for the icon indent) to where the peer label's card starts when both labels share a line, else
// the full width. Case-insensitive (a CSS `TO:` is accepted).
const decodeEnt = (t) => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function pdfWordBoxes(file, pageNo = 1) {
  const html = execFileSync('pdftotext', ['-bbox', '-f', String(pageNo), '-l', String(pageNo), file, '-']).toString();
  const out = [];
  for (const m of html.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)) {
    // pdftotext -bbox emits an RTL (Hebrew) word in visual order - reverse it back to logical order
    const raw = decodeEnt(m[5]);
    const logical = /[\u0590-\u05FF]/.test(raw) ? [...raw].reverse().join('') : raw;
    for (const w of textWords(logical)) out.push({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], t: w.toLowerCase() });
  }
  return out;
}
function printRoles(file, text, locale, { client, attn, business }) {
  const L = LABELS[locale];
  const boxes = pdfWordBoxes(file, 1);
  const wl = (str) => textWords(str || '').map((w) => w.toLowerCase());
  const labelBoxes = (label) => boxes.filter((b) => b.t === label.toLowerCase());
  const allLabels = [...labelBoxes(L.client), ...labelBoxes(L.contact)];
  // a card starts at its label's inline-start edge (HE: right edge, EN: left edge) and ends where the peer card starts
  const rtl = locale === 'he';
  const columnOf = (lab) => {
    const peer = allLabels.find((o) => o !== lab && Math.abs(o.y0 - lab.y0) < 4);
    if (!peer) return [0, Infinity];
    if (rtl) return lab.x1 > peer.x1 ? [peer.x1 + 2, Infinity] : [0, lab.x1 + 24];
    return lab.x0 < peer.x0 ? [0, peer.x0 - 2] : [lab.x0 - 24, Infinity];
  };
  const inWindow = (lab, b) => { const [c0, c1] = columnOf(lab); return b.y0 >= lab.y0 - 2 && b.y0 <= lab.y1 + 80 && b.x0 >= c0 && b.x1 <= c1; };
  const labelWith = (label, name) => {
    const nameW = wl(name);
    const labs = labelBoxes(label);
    const withName = nameW.length ? labs.filter((lab) => nameW.every((w) => boxes.some((b) => b.t === w && inWindow(lab, b)))) : [];
    return { boxes: withName, labels: labs.map((b) => ({ x0: b.x0, y0: b.y0 })), withName: withName.map((b) => ({ x0: b.x0, y0: b.y0 })) };
  };
  const clientR = labelWith(L.client, client);
  const contactR = labelWith(L.contact, attn || '');
  // forbidden labels: an exact word (or word pair on one line), case-sensitive for the EN capitalised labels
  const rawLw = normText(text).split('\n').map((l) => textWords(l));
  const forbiddenHits = L.forbidden.filter((ws) => rawLw.some((line) => (ws.length === 1 ? line.includes(ws[0]) : line.join(' ').includes(ws.join(' '))))).map((ws) => ws.join(' '));
  // business name: first seen above the client label (the letterhead) and never inside a recipient label's window
  const bizW = wl(business);
  const bizBoxes = boxes.filter((b) => bizW.includes(b.t));
  const bizInRecipient = [...clientR.boxes, ...contactR.boxes].filter((lab) => bizW.length && bizW.every((w) => bizBoxes.some((b) => b.t === w && inWindow(lab, b)))).map((b) => ({ label: b.t, y0: b.y0 }));
  const firstBizY = bizBoxes.length ? Math.min(...bizBoxes.filter((b) => b.t === bizW[0]).map((b) => b.y0)) : null;
  const clientLabelY = clientR.withName.length ? clientR.withName[0].y0 : null;
  return { clientR, contactR, contactLabelCount: labelBoxes(L.contact).length, forbiddenHits, bizInRecipient, firstBizY, clientLabelY, letterheadFirst: firstBizY != null && clientLabelY != null && firstBizY < clientLabelY };
}
// A recipient block must OPEN with its label (rendered text, so a CSS text-transform like "TO:" is accepted).
const startsWithLabel = (text, label) => new RegExp(`^\\s*${label}\\s*:?(\\s|$)`, 'i').test(text || '');
// UI text that must never reach an output document: action tiles, the sign panel, the sample-route toolbar.
const FORBIDDEN_UI_TEXT = [
  'הורד כ', 'מפיק PDF', 'הדפס מסמך', 'חייג/י אליי', 'וואטסאפ', 'חתימת לקוח לאישור ההצעה', 'שם מלא של החותם', 'אשר וחתום',
  'Download PDF', 'Generating PDF', 'Print Document', 'Call Me', 'Call me', 'WhatsApp', 'Client Signature to Approve', "Signer's full name", 'Approve & Sign',
  'דוגמת הצעת מחיר', 'נתונים סינתטיים', 'Sample quote', 'synthetic data',
];
const FORBIDDEN_UI_RE = [/\bPrint\b/];
const BIDI = /[‎‏‪-‮⁦-⁩]/g;
const uiHits = (text) => {
  const t = String(text || '').replace(BIDI, '').replace(/[ \t]+/g, ' ');
  return [...FORBIDDEN_UI_TEXT.filter((s) => t.includes(s)), ...FORBIDDEN_UI_RE.filter((r) => r.test(t)).map(String)];
};

const cells = [];
const cell = (id, pass, detail) => { cells.push({ id, result: pass ? 'PASS' : 'FAIL', detail }); };
const lum = (rgb) => { const m = String(rgb || '').match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const alpha = (rgb) => { const m = String(rgb || '').match(/[\d.]+/g); return m && m.length > 3 ? Number(m[3]) : 1; };
const isDark = (rgb) => !!rgb && alpha(rgb) > 0 && lum(rgb) < 80;
const isWhiteOrClear = (rgb) => !!rgb && (alpha(rgb) === 0 || lum(rgb) >= 250);

const pdfPages = (file) => Number((execFileSync('pdfinfo', [file]).toString().match(/^Pages:\s+(\d+)/m) || [])[1] || 0);
const pdfText = (file) => execFileSync('pdftotext', ['-layout', file, '-']).toString();
function headerDarkFraction(pdf) {
  // page 1 rasterised in grey; fraction of dark pixels (<90) in the top 30% of the page. A dark band fills a large share
  // of that area; a white letterhead leaves only text strokes.
  const base = pdf.replace(/\.pdf$/, '-p1');
  execFileSync('pdftoppm', ['-gray', '-r', '30', '-f', '1', '-l', '1', pdf, base]);
  const dir = join(base, '..');
  const name = readdirSync(dir).filter((f) => f.startsWith(base.split('/').pop()) && f.endsWith('.pgm')).sort()[0];
  const buf = readFileSync(join(dir, name));
  const header = buf.toString('latin1', 0, 40).split(/\s+/);
  const [w, h] = [Number(header[1]), Number(header[2])];
  const start = buf.length - w * h;
  let dark = 0; const rows = Math.floor(h * 0.3);
  for (let y = 0; y < rows; y += 1) for (let x = 0; x < w; x += 1) if (buf[start + y * w + x] < 90) dark += 1;
  return +(dark / (rows * w)).toFixed(4);
}

let browser;
try {
  browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
} catch (e) { console.error(`cannot launch Chromium: ${e.message}`); process.exit(2); }

// 1) synthetic DTOs from the real sample builder (served as an ES module by the dev server)
const dtoPage = await (await browser.newContext()).newPage();
await dtoPage.goto(`${DEV}/he`, { waitUntil: 'domcontentloaded' });
const CASES = await dtoPage.evaluate(async (modes) => {
  const m = await import('/src/quoteDocument/sampleQuotes.js');
  const out = [];
  for (const images of modes) for (const locale of ['he', 'en']) for (const style of ['classic', 'modern', 'visual']) for (const length of ['short', 'long']) {
    const s = m.buildSampleQuote({ locale, style, length, images });
    out.push({ locale, style, length, images, quoteData: s.quoteData, presentation: s.presentation });
  }
  return JSON.parse(JSON.stringify(out));
}, IMAGE_MODES);
await dtoPage.context().close();

// In-page probes (run in the browser).
function probeScreen() {
  const band = document.querySelector('.pq-lh-band');
  const card = document.querySelector('.pq-card');
  const tiles = [...document.querySelectorAll('.pq-action-tile')];
  const text = (el) => (el ? el.innerText.replace(/\s+/g, ' ').trim() : null);
  const roleBlocks = [...document.querySelectorAll('[data-role]')].filter((el) => ['client', 'contact'].includes(el.dataset.role) || el.closest('.pq-parties'));
  // text-ink box of an element: union of its non-empty text-node rects (not the element box)
  const ink = (el) => {
    const rects = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const b of r.getClientRects()) if (b.width > 0 && b.height > 0) rects.push(b);
    }
    if (!rects.length) return null;
    return { left: Math.min(...rects.map((b) => b.left)), right: Math.max(...rects.map((b) => b.right)) };
  };
  const numeric = [];
  for (const table of card ? card.querySelectorAll('table') : []) {
    const cols = [...table.querySelectorAll('colgroup col')].map((c) => c.className);
    const idx = { qty: cols.findIndex((c) => /pq-col-qty/.test(c)), price: cols.findIndex((c) => /pq-col-price/.test(c)), total: cols.findIndex((c) => /pq-col-total/.test(c)) };
    const want = Object.entries(idx).filter(([, i]) => i >= 0);
    for (const tr of table.querySelectorAll('tr')) {
      let col = 0;
      for (const td of tr.children) {
        const span = td.colSpan || 1;
        const hit = span === 1 ? want.find(([, i]) => i === col) : null;
        col += span;
        if (!hit) continue;
        if (td.classList.contains('pq-td-summary')) continue; // local fix 7: a section summary amount is a summary value on the protected right axis (glyph-axis.mjs), not an item cell
        const b = td.getBoundingClientRect();
        if (b.width === 0 || getComputedStyle(td).display === 'none') continue;
        const k = ink(td);
        if (!k) continue;
        numeric.push({ col: hit[0], tag: td.tagName.toLowerCase(), text: td.innerText.trim().slice(0, 24), offset: +(((k.left + k.right) / 2) - ((b.left + b.right) / 2)).toFixed(2) });
      }
    }
  }
  const totals = [...document.querySelectorAll('.pq-totals-box .pf-money')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
    const k = ink(e) || e.getBoundingClientRect();
    return { text: e.innerText.trim(), right: +k.right.toFixed(2) };
  });
  // horizontal overflow: the page, the document card and every item-table cell (content wider than its cell)
  const vw = document.documentElement.clientWidth;
  const cellOverflow = [];
  for (const td of card ? card.querySelectorAll('table td, table th') : []) {
    if (td.getBoundingClientRect().width === 0) continue;
    if (td.scrollWidth > td.clientWidth + 1) cellOverflow.push({ text: td.innerText.trim().slice(0, 24), scroll: td.scrollWidth, client: td.clientWidth });
  }
  const overflow = {
    viewport: vw,
    pageScroll: document.documentElement.scrollWidth,
    cardScroll: card ? card.scrollWidth : null,
    cardClient: card ? card.clientWidth : null,
    tableWrapScroll: [...(card ? card.querySelectorAll('.pq-table-wrap') : [])].map((w) => w.scrollWidth - w.clientWidth),
    cells: cellOverflow,
  };
  return {
    overflow,
    bandBg: band ? getComputedStyle(band).backgroundColor : null,
    tiles: tiles.length,
    tilesInsideCard: card ? tiles.filter((t) => card.contains(t)).length : null,
    tileGroup: (() => { const g = document.querySelector('.pq-action-tiles'); return g ? { inCard: !!card && card.contains(g), noPrint: g.classList.contains('no-print'), h2cIgnore: g.getAttribute('data-html2canvas-ignore') === 'true' } : null; })(),
    client: text(document.querySelector('[data-role="client"]')),
    contact: text(document.querySelector('[data-role="contact"]')),
    contactCount: document.querySelectorAll('[data-role="contact"]').length,
    partiesText: text(document.querySelector('.pq-parties')),
    roleBlocks: roleBlocks.map((el) => ({ role: el.dataset.role, text: text(el) })),
    numeric,
    totals,
  };
}
function probePrintBand() {
  const band = document.querySelector('.pq-lh-band');
  if (!band) return { bg: null, textColors: [] };
  const textColors = [...band.querySelectorAll('*'), band].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && el.getBoundingClientRect().width > 0).map((el) => getComputedStyle(el).color);
  return { bg: getComputedStyle(band).backgroundColor, textColors: [...new Set(textColors)] };
}

const main0 = (v) => v === 'main';
const results = [];
for (const vp of VIEWPORTS) for (const c of CASES) {
  const key = `${c.locale}/${c.style}/${c.length}/${c.images ? 'img' : 'noimg'}`;
  const variants = c.length === 'short' ? ['main', 'nophone', 'nocontact', ...(S_REJ.has(key) ? ['grow'] : [])] : ['main'];
  for (const variant of variants) {
    const withPhone = variant !== 'nophone';
    const withContact = variant !== 'nocontact';
    const dto = JSON.parse(JSON.stringify(c.quoteData));
    dto.business = { ...dto.business, phone: withPhone ? (c.locale === 'he' ? '050-1234567' : '+1 555 0100') : null };
    if (!withContact) { dto.quote.attn_name = null; dto.quote.attn_role = null; } else if (!dto.quote.attn_role) dto.quote.attn_role = c.locale === 'he' ? 'מנהלת רכש' : 'Procurement lead';
    const pres = JSON.parse(JSON.stringify(c.presentation));
    if (variant === 'grow') {
      // negative control: real extra content - every row repeated (distinct descriptions), every image repeated
      const base = dto.items;
      dto.items = [];
      for (let r = 0; r < GROW_ROWS; r += 1) base.forEach((it) => dto.items.push({ ...it, description: r === 0 ? it.description : `${it.description} · ${dto.items.length + 1}` }));
      const m0 = pres.media || [];
      pres.media = [];
      for (let r = 0; r < GROW_MEDIA; r += 1) m0.forEach((m) => pres.media.push(r === 0 ? m : { ...m, role: m.role === 'hero' ? 'support' : m.role, caption: m.caption ? `${m.caption} · ${r + 1}` : m.caption }));
    }
    const fpNow = contentFingerprint(dto, pres);
    const id = `${MULTI_VP ? `${vp.tag}/` : ''}${key}${variant === 'main' ? '' : `/${variant}`}`;
    const fileId = id.replace(/\//g, '-');
    const row = { case: id };
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, acceptDownloads: true });
    await ctx.route(`${SUPA}/**`, (route) => {
      const u = new URL(route.request().url());
      let body = {};
      if (u.pathname.endsWith('/functions/v1/get-public-quote')) body = dto;
      else if (u.pathname.endsWith('/functions/v1/quote-presentation')) body = pres;
      else if (u.pathname.startsWith('/rest/v1/rpc/')) body = null;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = await ctx.newPage();
    row.fingerprint = fpNow;
    try {
      await page.goto(`${BUILD}/quote/00000000-0000-4000-9000-0000000000aa`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.pq-card', { timeout: 20000 });
      await page.waitForTimeout(500);
      const s = await page.evaluate(probeScreen);
      Object.assign(row, s);
      if (variant === 'main') {
        const b = FIXTURE_BINDING[key];
        cell(`${id}/fixture/bound`, !!b && b.fp === fpNow.fp && b.rows === fpNow.rows && b.images === fpNow.images, { recorded: b, now: fpNow });
      }
      const imgScreen = variant === 'grow' || (main0(variant) && c.images) ? await page.evaluate(probeImages) : null;
      const L = LABELS[c.locale];
      const bizName = dto.business.business_name;
      cell(`${id}/screen/band-dark`, isDark(s.bandBg), { bandBg: s.bandBg, luminance: lum(s.bandBg) });
      const o = s.overflow;
      cell(`${id}/screen/no-overflow`, o.pageScroll <= o.viewport && o.cardScroll <= o.cardClient + 1 && o.tableWrapScroll.every((d) => d <= 1) && o.cells.length === 0, o);
      cell(`${id}/tiles/${withPhone ? 'count-4-with-phone' : 'count-2-without-phone'}`, s.tiles === (withPhone ? 4 : 2), { tiles: s.tiles });
      cell(`${id}/tiles/in-card-no-output`, !!s.tileGroup && s.tileGroup.inCard && s.tileGroup.noPrint && s.tileGroup.h2cIgnore && s.tilesInsideCard === s.tiles, { tileGroup: s.tileGroup, insideCard: s.tilesInsideCard, tiles: s.tiles });
      if (variant !== 'nophone') {
        const clientOk = !!s.client && s.client.includes(dto.client.company_name) && startsWithLabel(s.client, L.client);
        cell(`${id}/recipient/client-block`, clientOk, { dataRoleClient: s.client, want: [L.client, dto.client.company_name] });
        if (withContact) {
          const contactOk = !!s.contact && s.contact.includes(dto.quote.attn_name) && startsWithLabel(s.contact, L.contact);
          cell(`${id}/recipient/contact-block`, contactOk, { dataRoleContact: s.contact, want: [L.contact, dto.quote.attn_name] });
        } else {
          const labelRe = c.locale === 'he' ? /לידי/ : /\bAttn\b/i;
          cell(`${id}/recipient/no-contact-block`, s.contactCount === 0 && !labelRe.test(s.partiesText || ''), { contactCount: s.contactCount, parties: s.partiesText });
        }
        const leaks = s.roleBlocks.filter((b) => (b.text || '').includes(bizName));
        cell(`${id}/recipient/business-not-in-role-blocks`, s.roleBlocks.length > 0 && leaks.length === 0, { roleBlocks: s.roleBlocks.length, leaks, business: bizName });
      }
      if (variant === 'main') {
        const off = s.numeric.filter((n) => Math.abs(n.offset) > CENTRE_TOLERANCE_PX);
        const maxOff = s.numeric.length ? Math.max(...s.numeric.map((n) => Math.abs(n.offset))) : null;
        const cols = new Set(s.numeric.map((n) => n.col));
        cell(`${id}/table/numeric-columns-centred`, s.numeric.length > 0 && cols.size === 3 && off.length === 0, { measured: s.numeric.length, maxOffsetPx: maxOff, offCentre: off.slice(0, 6), tolerancePx: CENTRE_TOLERANCE_PX });
        const rights = s.totals.map((t) => t.right);
        const spread = rights.length ? +(Math.max(...rights) - Math.min(...rights)).toFixed(2) : null;
        cell(`${id}/totals/right-edge-aligned`, rights.length >= 2 && spread <= TOTALS_RIGHT_EDGE_SPREAD_PX, { values: s.totals, spreadPx: spread, tolerancePx: TOTALS_RIGHT_EDGE_SPREAD_PX });
      }
      if (variant !== 'nophone') {
        const main = variant === 'main';
        // native Print output (print media emulation)
        const exp = EXPECTED_PAGES[key];
        await page.emulateMedia({ media: 'print' });
        const pb = await page.evaluate(probePrintBand);
        const prSem = await page.evaluate(probePrint);
        row.printBand = pb;
        const textDark = pb.textColors.length > 0 && pb.textColors.every((col) => lum(col) < 110);
        cell(`${id}/print/band-white-text-dark`, isWhiteOrClear(pb.bg) && textDark, pb);
        const imgPrint = imgScreen ? await page.evaluate(probeImages) : null;
        const printCard = await page.evaluate(() => Math.round(document.querySelector('.pq-card').getBoundingClientRect().height * 10) / 10);
        const printPdf = join(OUT, 'pdf', `${fileId}-print.pdf`);
        writeFileSync(printPdf, await page.pdf({ format: 'A4', printBackground: true }));
        await page.emulateMedia({ media: 'screen' });
        row.printPages = pdfPages(printPdf);
        row.printContentH = printCard;
        if (main) cell(`${id}/print/pages`, row.printPages === exp.print, { pages: row.printPages, expected: exp.print, printContentH: printCard, a4ContentH: 1031.8, sRej: S_REJ.has(key) });
        if (imgPrint && imgScreen.length) { // Classic renders no presentation media (by design) - nothing to compare
          const ok = imgPrint.length === imgScreen.length && imgPrint.length > 0 && imgPrint.every((i) => i.loaded && i.shown && i.inCard);
          cell(`${id}/print/every-image-printed`, ok, { screen: imgScreen.length, print: imgPrint.length, bad: imgPrint.filter((i) => !(i.loaded && i.shown && i.inCard)) });
        }
        if (variant === 'grow') {
          const missing = missingRows(printPdf, dto.items.map((it) => it.description));
          cell(`${id}/print/grow-paginates`, row.printPages >= 2, { pages: row.printPages, rows: dto.items.length, media: pres.media.length, printContentH: printCard });
          cell(`${id}/print/grow-every-row`, missing.length === 0, { rows: dto.items.length, missing });
        }
        const pText = pdfText(printPdf);
        const lastPage = (pText.split('\f').filter((p) => p.trim()).pop() || '').replace(BIDI, '');
        if (main) cell(`${id}/print/approval-on-last-page`, L.approval.every((a) => lastPage.includes(a)), { want: L.approval, lastPageTail: lastPage.trim().split('\n').slice(-4).map((l) => l.trim()) });
        if (main) {
          const sem = prSem.semantic;
          const pl = sem && sem.kind !== 'status' ? approvalPlacement(printPdf, { approvalTitle: sem.approvalTitle, approvalText: prSem.approvalText, footerText: prSem.footerText, signatureLineText: sem.signatureLineText }) : null;
          const ok = !!sem && sem.bodyBlocks > 0 && !sem.bodyBlocksNotBeforeApproval.length && sem.approvalTop >= sem.bodyBottom - 0.5
            && (sem.kind === 'status' || (!!pl && pl.titleFound && pl.bodyAbove && !!sem.signature && sem.signature.insideApprovalDom && sem.signature.insideApprovalBox && (sem.kind === 'signed' || pl.signatureBelow === true)));
          cell(`${id}/print/approval-semantic`, ok, { semantic: sem, placement: pl });
        }
        const pHits = uiHits(pText);
        if (main) cell(`${id}/print/no-ui-text`, pHits.length === 0, { hits: pHits });
        if (main) row.printHeaderDarkFraction = headerDarkFraction(printPdf);
        // recipient roles in the printed document
        const pr = printRoles(printPdf, pText, c.locale, { client: dto.client.company_name, attn: dto.quote.attn_name, business: bizName });
        row.printRoles = { ...pr, clientR: { ...pr.clientR, boxes: undefined }, contactR: { ...pr.contactR, boxes: undefined } };
        cell(`${id}/print/role-client`, pr.clientR.withName.length > 0, { label: L.client, client: dto.client.company_name, labels: pr.clientR.labels, withName: pr.clientR.withName });
        if (withContact) cell(`${id}/print/role-contact`, pr.contactR.withName.length > 0, { label: L.contact, attn: dto.quote.attn_name, labels: pr.contactR.labels, withName: pr.contactR.withName });
        else {
          const attnLeft = c.quoteData.quote.attn_name && textWords(normText(pText)).join(' ').includes(textWords(c.quoteData.quote.attn_name).join(' '));
          cell(`${id}/print/no-contact-block`, pr.contactLabelCount === 0 && !attnLeft, { contactLabels: pr.contactLabelCount, attnNameInText: !!attnLeft });
        }
        cell(`${id}/print/no-forbidden-role-labels`, pr.forbiddenHits.length === 0, { hits: pr.forbiddenHits, forbidden: L.forbidden.map((w) => w.join(' ')) });
        cell(`${id}/print/business-letterhead-only`, pr.letterheadFirst && pr.bizInRecipient.length === 0, { business: bizName, firstBusinessY: pr.firstBizY, clientLabelY: pr.clientLabelY, inRecipientWindow: pr.bizInRecipient });

        // Direct PDF through the real button + the Compact choice; the capture state is recorded when it starts
        await page.evaluate(() => {
          const pg = document.querySelector('.pq-page');
          window.__pqCapture = null;
          const obs = new MutationObserver(() => {
            if (window.__pqCapture || !pg.classList.contains('pq-pdf-capturing')) return;
            const card = document.querySelector('.pq-card');
            const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
            const ui = [...card.querySelectorAll('input, textarea, select, .pq-action-tile, .pq-action-tiles, .pq-sign-panel, [data-testid="pq-sample-controls"], canvas')].filter(vis).map((e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? `.${e.className.split(' ')[0]}` : ''));
            const band = document.querySelector('.pq-lh-band');
            const roles = [...card.querySelectorAll('[data-role]')].map((e) => ({ role: e.dataset.role, text: e.innerText.replace(/\s+/g, ' ').trim() }));
            window.__pqCapture = { ui, text: card.innerText, bandBg: band ? getComputedStyle(band).backgroundColor : null, roles };
          });
          obs.observe(pg, { attributes: true, attributeFilter: ['class'] });
        });
        const tile = page.locator('.pq-action-tile').first();
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 60000 }),
          (async () => { await tile.click(); await page.locator('[role="dialog"] button').nth(1).click(); })(),
        ]);
        const directPdf = join(OUT, 'pdf', `${fileId}-direct.pdf`);
        await download.saveAs(directPdf);
        row.directPages = pdfPages(directPdf);
        if (main) cell(`${id}/direct/pages`, row.directPages === exp.direct, { pages: row.directPages, expected: exp.direct, sRej: S_REJ.has(key) });
        if (variant === 'grow') cell(`${id}/direct/grow-paginates`, row.directPages >= 2, { pages: row.directPages });
        if (main) row.directHeaderDarkFraction = headerDarkFraction(directPdf);
        if (main) cell(`${id}/direct/header-white`, row.directHeaderDarkFraction < DIRECT_HEADER_DARK_MAX, { darkFraction: row.directHeaderDarkFraction, max: DIRECT_HEADER_DARK_MAX });
        const cap = await page.evaluate(() => window.__pqCapture);
        const dText = pdfText(directPdf);
        const capHits = cap ? uiHits(cap.text) : ['capture state not observed'];
        const dHits = uiHits(dText);
        if (main) cell(`${id}/direct/no-ui-captured`, !!cap && cap.ui.length === 0 && capHits.length === 0 && dHits.length === 0, { visibleUiInCard: cap?.ui, captureTextHits: capHits, pdfTextLayerChars: dText.trim().length, pdfTextHits: dHits });
        // recipient roles at capture time (the Direct PDF is a raster: the DOM photographed is the evidence)
        const capRoles = cap?.roles || [];
        const capClient = capRoles.filter((r) => r.role === 'client');
        const capContact = capRoles.filter((r) => r.role === 'contact');
        cell(`${id}/direct/role-client`, capClient.length === 1 && startsWithLabel(capClient[0].text, L.client) && capClient[0].text.includes(dto.client.company_name), { captured: !!cap, client: capClient, want: [L.client, dto.client.company_name] });
        if (withContact) cell(`${id}/direct/role-contact`, capContact.length === 1 && startsWithLabel(capContact[0].text, L.contact) && capContact[0].text.includes(dto.quote.attn_name), { captured: !!cap, contact: capContact, want: [L.contact, dto.quote.attn_name] });
        else cell(`${id}/direct/no-contact-block`, !!cap && capContact.length === 0 && !new RegExp(`(^|\\s)${L.contact}\\s*:?(\\s|$)`, 'i').test(cap.text || ''), { captured: !!cap, contact: capContact });
        const capLeaks = capRoles.filter((r) => (r.text || '').includes(bizName));
        cell(`${id}/direct/business-not-in-role-blocks`, !!cap && capRoles.length > 0 && capLeaks.length === 0, { roleBlocks: capRoles.length, leaks: capLeaks, business: bizName });
        await page.waitForFunction(() => !document.querySelector('.pq-page')?.classList.contains('pq-pdf-capturing'), null, { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(200);
        const after = await page.evaluate(() => ({ capturing: !!document.querySelector('.pq-pdf-capturing'), bandBg: getComputedStyle(document.querySelector('.pq-lh-band')).backgroundColor }));
        row.after = after;
        if (main) cell(`${id}/direct/state-restored`, !after.capturing && isDark(after.bandBg), after);
      }
    } catch (e) {
      cell(`${id}/rendered`, false, { error: String(e.message || e).slice(0, 300) });
    }
    results.push(row);
    await ctx.close();
  }
}
await browser.close();

const fail = cells.filter((x) => x.result !== 'PASS');
writeFileSync(join(OUT, 'public-quote-outputs-gate.json'), JSON.stringify({
  gate: 'task16-public-quote-outputs (LOCAL-DEV, mocked functions, synthetic sample DTOs - not a TEST quote, not Owner acceptance)',
  dev: DEV, build: BUILD, images: IMAGE_MODES, viewports: VIEWPORTS.map((v) => v.tag), generatedAt: new Date().toISOString(), expectedPages: EXPECTED_PAGES,
  thresholds: { directHeaderDarkMax: DIRECT_HEADER_DARK_MAX, centreTolerancePx: CENTRE_TOLERANCE_PX, totalsRightEdgeSpreadPx: TOTALS_RIGHT_EDGE_SPREAD_PX },
  pass: cells.length - fail.length, fail: fail.length, cells, results,
}, null, 1));
const byCheck = {};
for (const x of cells) { const k = x.id.split('/').slice(-2).join('/'); byCheck[k] = byCheck[k] || { pass: 0, fail: 0 }; byCheck[k][x.result === 'PASS' ? 'pass' : 'fail'] += 1; }
console.log(`PUBLIC QUOTE OUTPUTS GATE (LOCAL-DEV): ${cells.length - fail.length} PASS / ${fail.length} FAIL  (${results.length} cases, images ${IMAGE_MODES.map((m) => (m ? 'on' : 'off')).join('+')}, viewports ${VIEWPORTS.map((v) => v.tag).join(',')})`);
for (const [k, v] of Object.entries(byCheck)) console.log(`  ${v.fail ? 'FAIL' : 'PASS'} ${k.padEnd(42)} ${v.pass} pass / ${v.fail} fail`);
for (const f of fail) console.log(`  FAIL ${f.id} ${JSON.stringify(f.detail).slice(0, 400)}`);
process.exit(fail.length ? 1 : 0);

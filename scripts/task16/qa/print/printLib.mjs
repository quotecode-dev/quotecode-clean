// Task 16 cloud-fix3 (A6) - shared helpers of the print checks (LOCAL-DEV, mocked functions, synthetic data only).
import { execFileSync } from 'node:child_process';

export const SUPA = 'http://127.0.0.1:54399';
export const A4_CONTENT_H = ((297 - 24) * 96) / 25.4; // @page { size: A4; margin: 12mm 10mm } -> 1031.8 CSS px

export function assertLocal(url) {
  const u = new URL(url);
  if (!['127.0.0.1', 'localhost'].includes(u.hostname) || u.port === '5186') throw new Error(`refusing ${url} (local only, never 5186)`);
}

const BIDI = /[‎‏‪-‮⁦-⁩]/g;
export const norm = (s) => String(s || '').replace(BIDI, ' ').replace(/[׳]/g, "'").replace(/["״“”]/g, '"');
export const words = (s) => norm(s).split(/[\s|·•–—:;,.()[\]{}"'!?✓⏳#/\\]+/).map((w) => w.trim()).filter((w) => w.length >= 2 || /^\d$/.test(w));
export const pdfPages = (file) => Number((execFileSync('pdfinfo', [file]).toString().match(/^Pages:\s+(\d+)/m) || [])[1] || 0);
export const pageText = (file, p) => execFileSync('pdftotext', ['-f', String(p), '-l', String(p), '-layout', file, '-']).toString();
export const rawText = (file) => execFileSync('pdftotext', ['-raw', file, '-']).toString();

// Route every request to the dead local Supabase URL to the synthetic DTO / presentation.
export async function newQuoteContext(browser, { viewport, dto, presentation }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.route(`${SUPA}/**`, (route) => {
    const u = new URL(route.request().url());
    let body = {};
    if (u.pathname.endsWith('/functions/v1/get-public-quote')) body = dto;
    else if (u.pathname.endsWith('/functions/v1/quote-presentation')) body = presentation;
    else if (u.pathname.startsWith('/rest/v1/rpc/')) body = null;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return ctx;
}

export async function openQuote(page, baseUrl, dto) {
  await page.goto(`${baseUrl}/quote/${dto.quote.id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pq-card', { timeout: 20000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(400);
}

// In-page probe (run under print media): the document blocks, the footer and approval texts and their boxes.
export function probePrint() {
  const card = document.querySelector('.pq-card');
  const cs = (e) => getComputedStyle(e);
  const r1 = (n) => Math.round(n * 10) / 10;
  const box = (e) => {
    const b = e.getBoundingClientRect();
    const s = cs(e);
    return { top: r1(b.top + window.scrollY), bottom: r1(b.bottom + window.scrollY), h: r1(b.height), mt: parseFloat(s.marginTop) || 0, mb: parseFloat(s.marginBottom) || 0, display: s.display };
  };
  const label = (e) => (typeof e.className === 'string' && e.className.split(' ').filter((c) => c.startsWith('pq-')).slice(0, 3).join('.')) || e.tagName.toLowerCase();
  const blocks = [];
  const walk = (parent, depth) => {
    for (const ch of parent.children) {
      const b = box(ch);
      if (b.display === 'none' || b.h === 0) continue;
      blocks.push({ depth, cls: label(ch), ...b });
      if (depth === 0 && typeof ch.className === 'string' && /pq-body-grid|pq-body-main|pq-body-aside|pq-doc-end/.test(ch.className)) walk(ch, depth + 1);
      else if (depth === 1 && typeof ch.className === 'string' && /pq-body-main|pq-body-aside/.test(ch.className)) walk(ch, depth + 1);
    }
  };
  if (card) walk(card, 0);
  let footer = document.querySelector('.pq-card .pq-doc-foot');
  if (!footer) footer = [...document.querySelectorAll('div')].filter((d) => /מסמך זה נערך/.test(d.textContent) && d.querySelectorAll('div').length === 0)[0] || null;
  const approval = document.querySelector('.pq-card .pq-approval, .pq-card .pq-doc-status')
    || [...document.querySelectorAll('.pq-section')].find((d) => /אושרה ונחתמה|has been approved|approved and signed/i.test(d.textContent)) || null;
  const visible = (e) => !!e && e.getBoundingClientRect().height > 0 && cs(e).display !== 'none';
  // cloud-fix4 (A13) SEMANTIC placement of the approval / signature record (not text presence): the record must come
  // AFTER every body block (table, attachments, totals, terms / notes) in document order AND below them in the print
  // layout, and the signature line (unsigned) / signature image (signed) must be INSIDE the approval block (DOM + box).
  let semantic = null;
  if (card && approval && visible(approval)) {
    const ab = approval.getBoundingClientRect();
    const bodySel = '.pq-table-wrap, .pq-attachments, .pq-totals-box, .pq-doc-note, .pq-doc-notes';
    const body = [...card.querySelectorAll(bodySel)].filter(visible);
    const after = body.filter((e) => !(e.compareDocumentPosition(approval) & Node.DOCUMENT_POSITION_FOLLOWING));
    const bodyBottom = body.length ? Math.max(...body.map((e) => e.getBoundingClientRect().bottom)) : null;
    const sig = card.querySelector('.pq-sigline, .pq-signature-img');
    const sb = sig && visible(sig) ? sig.getBoundingClientRect() : null;
    const inside = !!sb && approval.contains(sig) && sb.top >= ab.top - 0.5 && sb.bottom <= ab.bottom + 0.5 && sb.left >= ab.left - 0.5 && sb.right <= ab.right + 0.5;
    semantic = {
      kind: approval.matches('.pq-doc-status') ? 'status' : (approval.matches('.pq-approval-signed') ? 'signed' : 'unsigned'),
      bodyBlocks: body.length,
      bodyBlocksNotBeforeApproval: after.map(label),
      approvalTop: r1(ab.top + window.scrollY),
      bodyBottom: bodyBottom == null ? null : r1(bodyBottom + window.scrollY),
      signature: sig ? { cls: label(sig), text: (sig.innerText || '').trim(), insideApprovalDom: approval.contains(sig), insideApprovalBox: inside } : null,
      signatureLineText: sig && sig.matches('.pq-sigline') ? sig.innerText.trim() : null,
      approvalTitle: (approval.querySelector('.pq-approval-title') || approval).innerText.split('\n')[0].trim(),
    };
  }
  return {
    semantic,
    card: card ? box(card) : null,
    footer: visible(footer) ? box(footer) : null,
    approval: visible(approval) ? box(approval) : null,
    blocks,
    footerText: visible(footer) ? footer.innerText : '',
    approvalText: visible(approval) ? approval.innerText : '',
  };
}

const firstLineWords = (t) => words((String(t || '').split('\n').find((l) => words(l).length) || ''));

// Classify every page of a Print PDF: blank | footer-only | approval-only | body.
export function classifyPages(pdf, footerText, approvalText) {
  const n = pdfPages(pdf);
  const footerW = new Set(words(footerText));
  const approvalList = words(approvalText);
  const approvalW = new Set(approvalList);
  const pages = [];
  for (let p = 1; p <= n; p += 1) {
    const txt = norm(pageText(pdf, p));
    const w = words(txt);
    const nonFooter = w.filter((x) => !footerW.has(x));
    const body = nonFooter.filter((x) => !approvalW.has(x));
    // the block is on this page when ALL words of its first text line are on ONE line of the page (a scattered word match
    // - e.g. "הצעת מחיר" of the title - is not enough)
    const pageLines = txt.split('\n').map((l) => words(l));
    const onOneLine = (first) => first.length > 0 && pageLines.some((lw) => first.every((x) => lw.includes(x)));
    // cloud-fix4: the approval block is on this page only when its first line is a line of its OWN - every word of that
    // line belongs to the approval / footer text (a terms sentence that merely contains "אישור ההצעה" is not it)
    const firstW = firstLineWords(approvalText);
    const ownLine = (lw) => firstW.every((x) => lw.includes(x)) && lw.every((x) => approvalW.has(x) || footerW.has(x));
    const hasApproval = approvalList.length > 0 && firstW.length > 0 && pageLines.some(ownLine);
    const hasFooter = footerW.size > 0 && onOneLine(firstLineWords(footerText));
    let kind = 'body';
    if (!w.length) kind = 'blank';
    else if (footerW.size && !nonFooter.length) kind = 'footer-only';
    else if (approvalW.size && !body.length) kind = 'approval-only';
    const lines = txt.split('\n').map((l) => l.trim()).filter(Boolean);
    pages.push({ page: p, kind, words: w.length, bodyWords: body.length, hasApproval, hasFooter, head: lines.slice(0, 2).map((l) => l.slice(0, 90)), tail: lines.slice(-3).map((l) => l.slice(0, 90)) });
  }
  return pages;
}

// Every row description: all its words (single digits included, so "row · 4" differs from "row · 5") on ONE text line, or
// - for a long description (> 6 words) that may wrap - inside one window of <= 3 consecutive lines. pdftotext keeps the
// words of an RTL line but may reorder them, so the match is order-insensitive.
export function missingRows(pdf, descriptions) {
  const n = pdfPages(pdf);
  const lines = [];
  for (let p = 1; p <= n; p += 1) lines.push(...norm(pageText(pdf, p)).split('\n').filter((l) => l.trim()));
  const lw = lines.map((l) => words(l));
  const found = (d) => {
    const want = words(d);
    const span = want.length > 6 ? 3 : 1;
    for (let i = 0; i < lw.length; i += 1) {
      const win = new Set(lw.slice(i, i + span).flat());
      if (want.every((x) => win.has(x))) return true;
    }
    return false;
  };
  return descriptions.filter((d) => !found(d));
}

// cloud-fix4 (A13): word boxes of one PDF page (pdftotext -bbox; RTL words reversed back to logical order).
const decodeEnt = (t) => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export function wordBoxes(pdf, pageNo) {
  const html = execFileSync('pdftotext', ['-bbox', '-f', String(pageNo), '-l', String(pageNo), pdf, '-']).toString();
  const out = [];
  for (const m of html.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)) {
    const raw = decodeEnt(m[5]);
    const logical = /[֐-׿]/.test(raw) ? [...raw].reverse().join('') : raw;
    for (const w of words(logical)) out.push({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], t: w });
  }
  return out;
}

// cloud-fix4 (A13): SEMANTIC placement of the approval record on the LAST PDF page (word geometry, not text presence):
//   titleFound      the approval title line (all its words on one baseline) is on the last page
//   bodyAbove       every body word of that page (not approval / footer text) sits ABOVE the approval title
//   signatureBelow  unsigned: the signature-line label (e.g. "חתימה" / "Signature") is on the last page, below the title
//                   (within 160pt - inside the approval block)
export function approvalPlacement(pdf, { approvalTitle, approvalText, footerText, signatureLineText }) {
  const n = pdfPages(pdf);
  const boxes = wordBoxes(pdf, n);
  const titleW = words(approvalTitle);
  const approvalW = new Set(words(approvalText));
  const footerW = new Set(words(footerText));
  const lines = [];
  for (const b of boxes) {
    let l = lines.find((x) => Math.abs(x.y - b.y0) < 3);
    if (!l) { l = { y: b.y0, w: [] }; lines.push(l); }
    l.w.push(b.t);
  }
  const titleLine = lines.filter((l) => titleW.length && titleW.every((x) => l.w.includes(x)) && l.w.every((x) => approvalW.has(x) || footerW.has(x))).sort((a, b) => b.y - a.y)[0];
  const body = boxes.filter((b) => !approvalW.has(b.t) && !footerW.has(b.t));
  const lowestBody = body.length ? Math.max(...body.map((b) => b.y0)) : null;
  const sigW = words(signatureLineText || '');
  const sigLine = sigW.length && titleLine ? lines.find((l) => l.y > titleLine.y + 1 && l.y - titleLine.y < 160 && sigW.every((x) => l.w.includes(x))) : null;
  return {
    page: n,
    titleFound: !!titleLine,
    titleY: titleLine ? titleLine.y : null,
    lowestBodyY: lowestBody,
    lowestBodyWords: body.filter((b) => b.y0 === lowestBody).map((b) => b.t).slice(0, 8),
    bodyAbove: !!titleLine && body.length > 0 && lowestBody < titleLine.y,
    signatureBelow: sigW.length ? !!sigLine : null,
    signatureY: sigLine ? sigLine.y : null,
  };
}

// cloud-fix4 (A13): computed type of the document elements - used to assert native Print = screen type (no shrink).
export function probeType() {
  const sels = ['.pq-card', '.pq-lh-name', '.pq-lh-details', '.pq-meta-label', '.pq-meta-value', '.pq-doc-title', '.pq-recipient-label', '.pq-recipient-name',
    '.pq-recipient-intro', '.pq-recipient-detail', '.pq-recipient-subject', '.pq-commercial-table th', '.pq-commercial-table td', '.pq-item-detail',
    '.pq-attachments-title', '.pq-attachments-empty', '.pq-total-label', '.pq-total-value', '.pq-total-final-label', '.pq-total-final-amount',
    '.pq-doc-note-title', '.pq-doc-note-body', '.pq-approval-title', '.pq-approval-copy p', '.pq-sigline', '.pq-approval-record', '.pq-doc-status', '.pq-doc-foot'];
  const out = {};
  for (const s of sels) {
    const e = document.querySelector(`.pq-card ${s}`) || (s === '.pq-card' ? document.querySelector('.pq-card') : null);
    if (!e) continue;
    const cs = getComputedStyle(e);
    out[s] = { fontSize: cs.fontSize, lineHeight: cs.lineHeight, fontWeight: cs.fontWeight };
  }
  return out;
}

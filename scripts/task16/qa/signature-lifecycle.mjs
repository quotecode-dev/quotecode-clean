// Task 16 correction item D - end-to-end SIGNATURE lifecycle QA on TEST (synthetic QA data only).
//
// Usage:
//   node --use-system-ca scripts/task16/qa/signature-lifecycle.mjs [--base-url http://localhost:5186]
//        [--env C:/tkrc-pt/.env.localtest.local] [--evidence <dir>] [--markets he,en] [--styles classic,modern,visual]
//        [--no-expired]
//
// Per market (he = LOCAL_PRO / ILS, en = INTL_PRO / USD) and per style (classic, modern, visual):
//   create "T16 QA signature <ts>" (app persistQuote path, then quote-presentation save_quote, owner status update to
//   'sent', issue - the same order the creator uses), then
//   1 owner (manager) view: owner notice instead of the signing pad; the owner cannot approve (RPC refused)
//   2 anonymous unsigned view: static signature line INSIDE the document; signing UI (name field + canvas pad + approve)
//     OUTSIDE the document card
//   3 sign through the real UI with a synthetic "QA" drawing and the signer name "QA Signer T16 (synthetic)"
//   4 persisted: DB read-back (owner client) status approved + signature = the bytes sent; signed record (image + date)
//     inside the card; no pad
//   5 reload: same (signed record, image, no pad)
//   6 print: emulated print + Chromium page.pdf A4 (signature image visible, inside the card, not clipped, page estimate)
//   7 Direct PDF via the real tile (download): page count + the capture DOM had the signature image loaded
//   8 the issued presentation stays frozen (public_get mode issued, same style)
// plus, per market, an EXPIRED quote (valid_until in the past): viewable, not signable (IRON-QUOTE-006).
//
// SAFETY: refuses unless VITE_SUPABASE_URL is exactly the TEST project and BASE_URL is localhost / 127.0.0.1; the browser
// aborts every request to a *.supabase.co host other than TEST. Persona e-mails / password / tokens are never printed or
// written (the session is handed to the browser in memory via addInitScript). Screens and PDFs (which show persona
// letterheads) go to the evidence directory OUTSIDE the repository; summary.json there has no e-mails (redacted).
// Nothing is deleted (retention by design); every created quote id is listed in summary.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makePng } from './verify-presentation-runtime.mjs';
import { assertAllowlistedPersona } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const require = createRequire(path.join(REPO_ROOT, 'package.json'));
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const { persistQuote, newUuid } = await import(pathToFileURL(path.join(REPO_ROOT, 'src', 'utils', 'quoteSaveOrchestrator.js')).href);

const TEST_REF = 'ljfizgrdyzxddswcedwr';
const TEST_URL = `https://${TEST_REF}.supabase.co`;
const STORAGE_KEY = `sb-${TEST_REF}-auth-token`;
const DEFAULT_ENV = 'C:/tkrc-pt/.env.localtest.local';
const EVIDENCE_ROOT = 'C:/tekango-evidence/task16-implementation-20261004';
const PASS = 'PASS'; const FAIL = 'FAIL'; const NT = 'NOT TESTED';
const ITEM_DESC = 'T16 QA signature item';
const SIGNER = 'QA Signer T16 (synthetic)';
const A4_CONTENT_PX = ((297 - 24) / 25.4) * 96; // @page A4, margin 12mm top+bottom (PQ_PRINT_CSS)
const PRINT_VIEWPORT_W = Math.round((190 / 25.4) * 96); // .pq-card max-width 190mm in print

const MARKETS = {
  he: { persona: 'LOCAL_PRO', key: 'PROFLOW_TEST_LOCAL_PRO_EMAIL', local: true,
    t: { activate: /לחץ\/י כאן לחתימה/, done: /^סיום$/, approve: /אשר וחתום/, pdf: /הורד כ-PDF/, compact: /תמציתי/, signedDate: /תאריך ושעת חתימה/, digital: /חתימה דיגיטלית/ } },
  en: { persona: 'INTL_PRO', key: 'PROFLOW_TEST_INTL_PRO_EMAIL', local: false,
    t: { activate: /Tap to sign/, done: /^Done$/, approve: /Approve & Sign/, pdf: /Download PDF/, compact: /Compact/, signedDate: /Signed on:/, digital: /Digital Signature/ } },
};
const STYLES = ['classic', 'modern', 'visual'];

// ------------------------------------------------------------------------------------------------ args / env / redaction
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[a.slice(2)] = next; i += 1; } else out[a.slice(2)] = true;
  }
  return out;
}
function readEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
let SECRETS = [];
function redact(text) {
  let s = String(text);
  for (const v of SECRETS) if (v && v.length >= 3) s = s.split(v).join('<redacted>');
  s = s.replace(/eyJ[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]{2,}){1,2}/g, '<jwt>');
  s = s.replace(/([?&]token=)[^&"\s]+/g, '$1<redacted>');
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>');
  s = s.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]{40,}/g, (m) => `<data-url len=${m.length}>`);
  return s;
}
const say = (m) => process.stdout.write(redact(m) + '\n');
const short = (id) => (typeof id === 'string' ? `${id.slice(0, 8)}…` : String(id));
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const isoDate = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

// ------------------------------------------------------------------------------------------------ recorder
const cells = [];
const created = [];
function cell(id, meta) {
  const c = { id, ...meta, checks: {} };
  cells.push(c);
  const set = (name, status, detail) => { c.checks[name] = { status, detail: detail === undefined ? null : JSON.parse(redact(JSON.stringify(detail))) }; say(`  [${status}] ${id} ${name}`); };
  return { c, pass: (n, d) => set(n, PASS, d), fail: (n, d) => set(n, FAIL, d), nt: (n, d) => set(n, NT, d), expect: (n, ok, d) => set(n, ok ? PASS : FAIL, d) };
}

// ------------------------------------------------------------------------------------------------ supabase helpers
function newClient(url, anonKey) {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
async function invoke(client, body) {
  try {
    const { data, error } = await client.functions.invoke('quote-presentation', { body });
    if (!error) return { ok: true, status: 200, data };
    let payload = null;
    try { payload = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; } catch { payload = null; }
    return { ok: false, status: error.context?.status ?? null, code: payload?.error ?? error.name, message: payload?.message ?? error.message };
  } catch (e) { return { ok: false, status: null, code: 'exception', message: String(e?.message || e) }; }
}
const qaSignatureDataUrl = () => `data:image/png;base64,${makePng(200, 80).toString('base64')}`;

async function uploadAssets(client) {
  const out = {};
  for (const [name, w, h] of [['hero', 640, 400], ['support', 480, 320], ['item', 240, 240]]) {
    const r = await invoke(client, { action: 'upload_media', filename: `t16-qa-sig-${name}.png`, contentType: 'image/png', dataBase64: makePng(w, h).toString('base64') });
    if (r.ok && r.data?.asset?.id) out[name] = r.data.asset.id;
  }
  return out;
}

// Same order as the creator: persistQuote (draft) -> save_quote presentation -> owner status update 'sent' -> issue.
async function createSignatureQuote(P, market, style, { validUntil, label }) {
  const local = MARKETS[market].local;
  const quoteId = newUuid();
  const subtotal = 1000;
  const taxRate = local ? 0.18 : 0; // fraction, like regionConfig vatRate
  const total = Math.round(subtotal * (1 + taxRate));
  const name = `T16 QA signature ${label} ${new Date().toISOString().slice(0, 19)}`;
  const plan = {
    userId: P.uid, isNew: true, quoteId, existingClientId: null,
    clientPayload: { company_name: name, email: '', phone: '', client_type: 'business', tax_id: '', address: '', notes: '', user_id: P.uid },
    header: { client_type: 'business', currency: local ? 'ILS' : 'USD', subtotal, tax_rate: taxRate, total, discount: 0, status: 'draft',
      valid_until: validUntil, terms: '', warranty: '', notes: '', subject: name, quote_subject: name },
    attnFields: { attn_name: name, attn_role: null }, attnUserEntered: false, projectName: null, descriptionUpdates: [],
    structured: { financial: null, sections: [], removedSectionIds: [], removedItemIds: [], items: [{
      client_key: 'new_0', id: null, section_client_key: null, description: ITEM_DESC, quantity: 1, unit_price: subtotal, total_price: subtotal,
      pricing_unit: null, calculated_quantity: null, quantity_source: null, specification: [], calculation_method: null, sort_order: 0, measurements: [] }] },
    newFiles: [], removedAttachments: [], now: () => Date.now(),
  };
  const steps = {};
  const r = await persistQuote(P.client, plan);
  steps.persist = { outcome: r.outcome, path: r.path, stage: r.stage || null, error: r.error ? { code: r.error.code, message: r.error.message } : null };
  if (r.outcome !== 'ok') return { ok: false, quoteId: null, steps };
  created.push({ quoteId, market, style, label, owner: short(P.uid) });
  const media = style === 'classic' ? [] : [
    P.assets.hero && { assetId: P.assets.hero, caption: 'T16 QA hero', alt: 'T16 QA hero image', role: 'hero', itemKey: null, order: 0 },
    P.assets.support && { assetId: P.assets.support, caption: 'T16 QA support', alt: 'T16 QA support image', role: 'support', itemKey: null, order: 1 },
    P.assets.item && { assetId: P.assets.item, caption: 'T16 QA item', alt: 'T16 QA item image', role: 'item', itemKey: ITEM_DESC, order: 2 },
  ].filter(Boolean);
  const s = await invoke(P.client, { action: 'save_quote', quoteId, style, media });
  steps.saveQuote = s.ok ? { ok: true, style: s.data?.draft?.style, media: s.data?.draft?.media?.length } : { ok: false, status: s.status, code: s.code };
  const { error: upErr } = await P.client.from('quotes').update({ status: 'sent' }).eq('id', quoteId);
  steps.statusSent = upErr ? { ok: false, code: upErr.code, message: upErr.message } : { ok: true };
  const i = await invoke(P.client, { action: 'issue', quoteId });
  steps.issue = i.ok ? { ok: true, style: i.data?.issued?.style, alreadyIssued: i.data?.alreadyIssued } : { ok: false, status: i.status, code: i.code };
  return { ok: s.ok && !upErr && i.ok, quoteId, steps, mediaCount: media.length };
}

// ------------------------------------------------------------------------------------------------ browser helpers
async function newContext(browser, { session = null, viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
  await ctx.route(/https:\/\/[a-z0-9-]+\.supabase\.co\//, (route) => (new URL(route.request().url()).hostname === `${TEST_REF}.supabase.co` ? route.continue() : route.abort()));
  if (session) {
    await ctx.addInitScript(({ key, value }) => { try { window.localStorage.setItem(key, value); } catch { /* ignore */ } }, { key: STORAGE_KEY, value: JSON.stringify(session) });
  }
  return ctx;
}
async function openQuote(page, base, quoteId) {
  await page.goto(`${base}/quote/${quoteId}`, { timeout: 120000, waitUntil: 'domcontentloaded' });
  const ok = await page.locator('.pq-card').first().waitFor({ timeout: 90000 }).then(() => true).catch(() => false);
  if (ok) await page.waitForTimeout(1200); // late presentation (public_get) may re-render the card
  return ok;
}
async function shot(page, dir, name, opts = {}) {
  const file = path.join(dir, `${name}.png`);
  try { await page.screenshot({ path: file, fullPage: true, ...opts }); return path.basename(file); } catch (e) { return `screenshot failed: ${String(e).slice(0, 120)}`; }
}
function countPdfPages(buf) {
  const m = buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g);
  return m ? m.length : 0;
}

// DOM facts about the signature area (no values that could identify a persona).
async function probe(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.pq-card');
    const vis = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const q = (sel) => [...document.querySelectorAll(sel)];
    const signPanel = document.querySelector('.pq-sign-panel');
    const sigImg = card ? card.querySelector('img.pq-signature-img') : null;
    const approveBtn = q('button').find((b) => /אשר וחתום|Approve & Sign/.test(b.textContent || ''));
    const clippedBy = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) {
          const ar = a.getBoundingClientRect();
          if (r.left < ar.left - 1 || r.right > ar.right + 1 || r.top < ar.top - 1 || r.bottom > ar.bottom + 1) return (a.className && String(a.className).slice(0, 60)) || a.tagName;
        }
        if (a === card) break;
      }
      return null;
    };
    const cardRect = card ? card.getBoundingClientRect() : null;
    const insideRect = (el) => { if (!el || !cardRect) return false; const r = el.getBoundingClientRect(); return r.left >= cardRect.left - 1 && r.right <= cardRect.right + 1 && r.top >= cardRect.top - 1 && r.bottom <= cardRect.bottom + 1; };
    const approval = card ? card.querySelector('.pq-approval, .pq-doc-status') : null;
    const sigImgRect = sigImg ? sigImg.getBoundingClientRect() : null;
    return {
      cardStyle: card ? (String(card.className).match(/pq-style-(\w+)/) || [])[1] || null : null,
      cardVisible: vis(card),
      ownerNotice: vis(document.querySelector('.pq-app-notice-info')),
      ownerNoticeInsideCard: !!(card && card.querySelector('.pq-app-notice-info')),
      ownerExpiredHint: vis(document.querySelector('[data-testid="pq-owner-expired-hint"]')),
      expiredInCard: !!(card && card.querySelector('[data-testid="pq-expired"]')),
      unfinishedNoSign: vis(document.querySelector('[data-testid="pq-unfinished-nosign"]')),
      signPanel: vis(signPanel),
      signPanelInsideCard: !!(signPanel && card && card.contains(signPanel)),
      signPanelHasCanvas: !!(signPanel && signPanel.querySelector('canvas')),
      signPanelHasName: !!(signPanel && signPanel.querySelector('#pq-signer-name')),
      canvasCount: q('canvas').filter(vis).length,
      canvasInsideCard: !!(card && card.querySelector('canvas')),
      approveButton: vis(approveBtn),
      staticSigLine: !!(card && card.querySelector('.pq-approval .pq-sigline')),
      staticSigLineTag: card && card.querySelector('.pq-sigline') ? card.querySelector('.pq-sigline').tagName.toLowerCase() : null,
      signedRecordInCard: !!(card && card.querySelector('.pq-approval-signed')),
      signedText: card && card.querySelector('.pq-approval-signed') ? card.querySelector('.pq-approval-signed').innerText.replace(/\s+/g, ' ').slice(0, 300) : null,
      sigImg: sigImg ? { complete: sigImg.complete, naturalWidth: sigImg.naturalWidth, naturalHeight: sigImg.naturalHeight, visible: vis(sigImg),
        insideCardRect: insideRect(sigImg), clippedBy: clippedBy(sigImg), w: Math.round(sigImgRect.width), h: Math.round(sigImgRect.height),
        docTop: Math.round(sigImgRect.top + window.scrollY), docBottom: Math.round(sigImgRect.bottom + window.scrollY), srcIsDataUrl: /^data:image\//.test(sigImg.getAttribute('src') || '') } : null,
      approvalBlock: approval ? { docTop: Math.round(approval.getBoundingClientRect().top + window.scrollY), docBottom: Math.round(approval.getBoundingClientRect().bottom + window.scrollY), insideCardRect: insideRect(approval) } : null,
      cardDocBottom: cardRect ? Math.round(cardRect.bottom + window.scrollY) : null,
    };
  });
}

async function drawQa(page, canvas) {
  const box = await canvas.boundingBox();
  if (!box) return false;
  const P = (fx, fy) => [box.x + fx * box.width, box.y + fy * box.height];
  const stroke = async (pts) => {
    await page.mouse.move(...P(...pts[0]));
    await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(...P(...p), { steps: 6 });
    await page.mouse.up();
  };
  // "Q": an octagon-ish loop + tail; "A": two legs + bar. Clearly a QA mark, not a person's signature.
  const qx = 0.28; const qy = 0.5; const rx = 0.13; const ry = 0.3;
  const loop = Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return [qx + rx * Math.cos(a), qy + ry * Math.sin(a)]; });
  await stroke(loop);
  await stroke([[0.33, 0.65], [0.44, 0.88]]);
  await stroke([[0.55, 0.85], [0.66, 0.15], [0.77, 0.85]]);
  await stroke([[0.59, 0.58], [0.73, 0.58]]);
  return true;
}

// ------------------------------------------------------------------------------------------------ one signing cell
async function runCell({ browser, base, dir, market, style, P, anon, ownerSession }) {
  const id = `${market}/${style}`;
  const t = MARKETS[market].t;
  const k = cell(id, { market, persona: MARKETS[market].persona, style });
  const made = await createSignatureQuote(P, market, style, { validUntil: isoDate(30), label: `${market}-${style}` });
  k.c.quoteId = made.quoteId;
  k.expect('0_create_sent_issued_quote', made.ok, made.steps);
  if (!made.quoteId) { for (const n of ['1_owner_view', '2_public_unsigned', '3_sign', '4_persisted', '5_reload', '6_print', '7_direct_pdf', '8_issued_frozen']) k.nt(n, 'quote not created'); return; }
  const qid = made.quoteId;

  // 1 owner (manager) view
  {
    const ctx = await newContext(browser, { session: ownerSession });
    const page = await ctx.newPage();
    const ok = await openQuote(page, base, qid);
    const p = ok ? await probe(page) : null;
    const file = await shot(page, dir, `${market}-${style}-1-owner`);
    const rpc = await P.client.rpc('public_approve_quote', { p_quote_id: qid, p_signature_data_url: qaSignatureDataUrl() });
    k.expect('1_owner_view', ok && p.ownerNotice && !p.ownerNoticeInsideCard && !p.signPanel && p.canvasCount === 0 && !p.approveButton && p.staticSigLine,
      { screenshot: file, probe: p });
    k.expect('1_owner_cannot_approve_rpc', !!rpc.error, { refused: !!rpc.error, code: rpc.error?.code ?? null, message: rpc.error?.message?.slice(0, 120) ?? null });
    await ctx.close();
  }

  // 2-7 anonymous customer
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  const ok = await openQuote(page, base, qid);
  const p2 = ok ? await probe(page) : null;
  const s2 = await shot(page, dir, `${market}-${style}-2-public-unsigned`);
  k.expect('2_public_unsigned', ok && p2.cardStyle === style && p2.signPanel && !p2.signPanelInsideCard && p2.signPanelHasCanvas && p2.signPanelHasName
    && !p2.canvasInsideCard && p2.approveButton && p2.staticSigLine && !p2.signedRecordInCard && !p2.ownerNotice,
  { screenshot: s2, staticLine: p2 ? { present: p2.staticSigLine, element: p2.staticSigLineTag } : null, probe: p2 });
  let unsignedPrintPages = null;
  if (ok) {
    try {
      await page.emulateMedia({ media: 'print' });
      const buf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
      unsignedPrintPages = countPdfPages(buf);
      fs.writeFileSync(path.join(dir, `${market}-${style}-2-print-unsigned.pdf`), buf);
    } catch { unsignedPrintPages = null; }
    await page.emulateMedia({ media: 'screen' });
  }

  // 3 sign through the real UI
  let sentSignature = null;
  let rpcStatus = null;
  if (!ok || !p2?.signPanel) k.nt('3_sign', 'no signing panel');
  else {
    try {
      const panel = page.locator('.pq-sign-panel');
      await panel.locator('button').filter({ hasText: t.activate }).first().click();
      const drew = await drawQa(page, panel.locator('canvas').first());
      const doneBtn = panel.locator('button').filter({ hasText: t.done });
      if (await doneBtn.count()) await doneBtn.first().click();
      await panel.locator('#pq-signer-name').fill(SIGNER);
      const respP = page.waitForResponse((r) => r.url().includes('/rest/v1/rpc/public_approve_quote'), { timeout: 60000 });
      await panel.locator('button').filter({ hasText: t.approve }).first().click();
      const resp = await respP;
      rpcStatus = resp.status();
      try { sentSignature = resp.request().postDataJSON()?.p_signature_data_url || null; } catch { sentSignature = null; }
      const signed = await page.locator('.pq-card .pq-approval-signed').first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
      await page.waitForTimeout(800);
      const p3 = await probe(page);
      const s3 = await shot(page, dir, `${market}-${style}-3-signed`);
      k.expect('3_sign', drew && rpcStatus >= 200 && rpcStatus < 300 && signed && p3.signedRecordInCard && p3.sigImg?.naturalWidth > 0 && !p3.signPanel && p3.canvasCount === 0
        && t.signedDate.test(p3.signedText || '') && (p3.signedText || '').includes(SIGNER),
      { screenshot: s3, rpcStatus, sentSignature: sentSignature ? { bytes: sentSignature.length, sha256: sha(sentSignature) } : null, probe: p3 });
    } catch (e) {
      k.fail('3_sign', { error: String(e?.message || e).slice(0, 300), rpcStatus });
    }
  }

  // 4 persisted (DB read-back as the owner)
  {
    const { data, error } = await P.client.from('quotes').select('status, signature').eq('id', qid).maybeSingle();
    const sig = data?.signature || '';
    k.expect('4_persisted_db', !error && data?.status === 'approved' && /^data:image\/png;base64,/.test(sig) && (!sentSignature || sig === sentSignature),
      { status: data?.status ?? null, signatureBytes: sig.length, signatureSha256: sig ? sha(sig) : null, equalsSentBytes: sentSignature ? sig === sentSignature : null, error: error?.message ?? null });
  }

  // 5 reload
  if (!ok) k.nt('5_reload', 'page did not open');
  else {
    await page.reload({ timeout: 120000, waitUntil: 'domcontentloaded' });
    const r = await page.locator('.pq-card').first().waitFor({ timeout: 90000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(1500);
    const p5 = r ? await probe(page) : null;
    const s5 = await shot(page, dir, `${market}-${style}-5-reload`);
    k.expect('5_reload', r && p5.signedRecordInCard && p5.sigImg?.complete && p5.sigImg.naturalWidth > 0 && p5.sigImg.insideCardRect && !p5.signPanel && p5.canvasCount === 0 && !p5.approveButton,
      { screenshot: s5, signedDateShownAfterReload: t.signedDate.test(p5?.signedText || ''), signerShownAfterReload: (p5?.signedText || '').includes(SIGNER), probe: p5 });
  }

  // 6 print (emulated) + page.pdf A4
  if (!ok) k.nt('6_print', 'page did not open');
  else {
    await page.setViewportSize({ width: PRINT_VIEWPORT_W, height: 1100 });
    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(300);
    const p6 = await probe(page);
    const s6 = await shot(page, dir, `${market}-${style}-6-print-emulated`);
    let pdfInfo = null;
    try {
      const buf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
      const f = path.join(dir, `${market}-${style}-6-print-signed.pdf`);
      fs.writeFileSync(f, buf);
      pdfInfo = { file: path.basename(f), pages: countPdfPages(buf), unsignedPages: unsignedPrintPages };
    } catch (e) { pdfInfo = { error: String(e).slice(0, 160) }; }
    const img = p6.sigImg;
    // Layout estimate at the print content width: the page index of the signature image and of the card end.
    const pageOf = (y) => (typeof y === 'number' ? Math.floor(y / A4_CONTENT_PX) : null);
    const estimate = img ? { imagePage: pageOf(img.docTop) + 1, imageEndPage: pageOf(img.docBottom - 1) + 1, cardEndPage: pageOf((p6.cardDocBottom || 1) - 1) + 1 } : null;
    k.expect('6_print', !!img && img.visible && img.naturalWidth > 0 && img.insideCardRect && !img.clippedBy && !p6.signPanel && p6.canvasCount === 0
      && pdfInfo?.pages > 0 && estimate && estimate.imagePage === estimate.imageEndPage,
    { screenshot: s6, pdf: pdfInfo, pageEstimate: estimate, note: 'page estimate is a layout approximation at 190mm content width; the PDF is the evidence to inspect', probe: p6 });
    await page.emulateMedia({ media: 'screen' });
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  // 7 Direct PDF via the real tile
  if (!ok) k.nt('7_direct_pdf', 'page did not open');
  else {
    try {
      await page.evaluate(() => {
        window.__t16Capture = null;
        const root = document.querySelector('.pq-page');
        if (!root) return;
        const mo = new MutationObserver(() => {
          if (!window.__t16Capture && root.classList.contains('pq-pdf-capturing')) {
            const img = document.querySelector('.pq-card img.pq-signature-img');
            window.__t16Capture = img ? { present: true, complete: img.complete, naturalWidth: img.naturalWidth, insideCard: !!img.closest('.pq-card') } : { present: false };
          }
        });
        mo.observe(root, { attributes: true, attributeFilter: ['class'] });
      });
      const btn = page.locator('button').filter({ hasText: t.pdf }).filter({ visible: true }).first();
      // cloud-fix4 (D21a rollback to base c65f742): the action tiles sit inside the card again, as screen-only UI. The tile
      // may be inside the card only if it is excluded from Print (.no-print) and from the Direct PDF capture
      // ([data-html2canvas-ignore]); the PDF content itself is checked by public-quote-outputs direct/no-ui-captured.
      const tilePos = await btn.evaluate((el) => ({ insideCard: !!el.closest('.pq-card'), noPrint: !!el.closest('.no-print'), captureIgnored: !!el.closest('[data-html2canvas-ignore]') }));
      const tileOk = !tilePos.insideCard || (tilePos.noPrint && tilePos.captureIgnored);
      const dlP = page.waitForEvent('download', { timeout: 120000 });
      await btn.click();
      const dialog = page.locator('[role="dialog"]').filter({ visible: true }).first();
      if (await dialog.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)) await dialog.locator('button').filter({ hasText: t.compact }).first().click();
      const dl = await dlP;
      const f = path.join(dir, `${market}-${style}-7-direct.pdf`);
      await dl.saveAs(f);
      const buf = fs.readFileSync(f);
      const capture = await page.evaluate(() => window.__t16Capture);
      const pages = countPdfPages(buf);
      k.expect('7_direct_pdf', buf.subarray(0, 5).toString('latin1') === '%PDF-' && pages > 0 && tileOk && capture?.present && capture.complete && capture.naturalWidth > 0 && capture.insideCard,
        { file: path.basename(f), bytes: buf.length, pages, tile: tilePos, captureSignatureImg: capture });
    } catch (e) { k.fail('7_direct_pdf', { error: String(e?.message || e).slice(0, 300) }); }
  }
  await ctx.close();

  // 8 issued presentation stays frozen
  {
    const r = await invoke(anon, { action: 'public_get', quoteId: qid });
    k.expect('8_issued_frozen', r.ok && r.data?.mode === 'issued' && r.data?.style === style && (r.data?.media || []).length === (style === 'classic' ? 0 : made.mediaCount),
      r.ok ? { mode: r.data.mode, style: r.data.style, media: (r.data.media || []).length, brandingPresent: !!r.data.branding } : { status: r.status, code: r.code });
  }
}

// ------------------------------------------------------------------------------------------------ expired quote cell
async function runExpired({ browser, base, dir, market, P, anon, ownerSession }) {
  const id = `${market}/expired`;
  const k = cell(id, { market, persona: MARKETS[market].persona, style: 'classic', expired: true });
  const made = await createSignatureQuote(P, market, 'classic', { validUntil: isoDate(-10), label: `${market}-expired` });
  k.c.quoteId = made.quoteId;
  k.expect('0_create_expired_quote', made.ok, made.steps);
  if (!made.quoteId) { k.nt('public_viewable_not_signable', 'not created'); return; }
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  const ok = await openQuote(page, base, made.quoteId);
  const p = ok ? await probe(page) : null;
  const s = await shot(page, dir, `${market}-expired-public`);
  k.expect('public_viewable_not_signable', ok && p.cardVisible && p.expiredInCard && !p.signPanel && p.canvasCount === 0 && !p.approveButton && !p.signedRecordInCard,
    { screenshot: s, probe: p });
  await ctx.close();
  const rpc = await anon.rpc('public_approve_quote', { p_quote_id: made.quoteId, p_signature_data_url: qaSignatureDataUrl() });
  k.expect('anon_rpc_refused', !!rpc.error, { refused: !!rpc.error, code: rpc.error?.code ?? null, message: rpc.error?.message?.slice(0, 120) ?? null });
  const { data } = await P.client.from('quotes').select('status, signature').eq('id', made.quoteId).maybeSingle();
  k.expect('db_still_unsigned', data && data.status !== 'approved' && !data.signature, { status: data?.status ?? null, signaturePresent: !!data?.signature });
  const octx = await newContext(browser, { session: ownerSession });
  const opage = await octx.newPage();
  const ook = await openQuote(opage, base, made.quoteId);
  const op = ook ? await probe(opage) : null;
  const os = await shot(opage, dir, `${market}-expired-owner`);
  k.expect('owner_expired_hint', ook && op.ownerNotice && op.ownerExpiredHint && !op.signPanel, { screenshot: os, probe: op });
  await octx.close();
}

// ------------------------------------------------------------------------------------------------ main
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = String(args['base-url'] && args['base-url'] !== true ? args['base-url'] : process.env.BASE_URL || 'http://localhost:5186').replace(/\/+$/, '');
  const bu = new URL(base);
  if (!['localhost', '127.0.0.1'].includes(bu.hostname)) { say('REFUSED: BASE_URL must be localhost / 127.0.0.1'); return 2; }
  const env = readEnv(String(args.env && args.env !== true ? args.env : DEFAULT_ENV));
  const url = String(env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  if (url !== TEST_URL) { say('REFUSED: VITE_SUPABASE_URL is not exactly the TEST project (value not printed)'); return 2; }
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  // IRON-DATA-001: per-persona *_PASSWORD key when present, else the plan-persona password; allowlist checked fail-closed.
  const pwdFor = (m) => env[m.key.replace(/_EMAIL$/, '_PASSWORD')] || env.PROFLOW_TEST_PLAN_PERSONAS_PASSWORD;
  SECRETS = [anonKey, env.PROFLOW_TEST_PLAN_PERSONAS_PASSWORD, ...Object.values(MARKETS).flatMap((m) => [env[m.key], pwdFor(m)])].filter(Boolean);
  try { for (const m of Object.values(MARKETS)) assertAllowlistedPersona(env[m.key], m.persona); } catch (e) { say(`REFUSED (IRON-DATA-001): ${e.message}`); return 2; }
  const markets = String(args.markets && args.markets !== true ? args.markets : 'he,en').split(',').filter((m) => MARKETS[m]);
  const styles = String(args.styles && args.styles !== true ? args.styles : STYLES.join(',')).split(',').filter((s) => STYLES.includes(s));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.resolve(String(args.evidence && args.evidence !== true ? args.evidence : path.join(EVIDENCE_ROOT, `signature-${stamp}`)));
  fs.mkdirSync(dir, { recursive: true });
  let buildSha = null;
  try { buildSha = (await (await fetch(`${base}/version.json`)).json()).buildSha || null; } catch { buildSha = null; }
  say(`project ${TEST_REF} (TEST) | base ${base} | build ${buildSha || '?'} | evidence ${dir}`);

  const anon = newClient(url, anonKey);
  const personas = {};
  const browser = await chromium.launch();
  try {
    for (const market of markets) {
      const m = MARKETS[market];
      const client = newClient(url, anonKey);
      const { data, error } = await client.auth.signInWithPassword({ email: env[m.key], password: pwdFor(m) });
      if (error || !data?.session) {
        personas[m.persona] = { signedIn: false, authErrorCode: String(error?.code || error?.status || 'no_session') };
        const k = cell(`${market}/*`, { market, persona: m.persona });
        k.nt('all', { reason: 'persona sign-in failed', authErrorCode: personas[m.persona].authErrorCode });
        continue;
      }
      const P = { client, uid: data.user.id, assets: {} };
      personas[m.persona] = { signedIn: true, uid: short(P.uid) };
      say(`persona ${m.persona}: uid ${short(P.uid)}`);
      if (styles.some((s) => s !== 'classic')) P.assets = await uploadAssets(client);
      for (const style of styles) {
        try { await runCell({ browser, base, dir, market, style, P, anon, ownerSession: data.session }); } catch (e) { cell(`${market}/${style}`, { market, style }).fail('runner', { error: String(e?.message || e).slice(0, 300) }); }
      }
      if (!args['no-expired']) {
        try { await runExpired({ browser, base, dir, market, P, anon, ownerSession: data.session }); } catch (e) { cell(`${market}/expired`, { market }).fail('runner', { error: String(e?.message || e).slice(0, 300) }); }
      }
    }
  } finally {
    await browser.close();
  }
  const totals = { PASS: 0, FAIL: 0, 'NOT TESTED': 0 };
  const failures = [];
  for (const c of cells) for (const [n, r] of Object.entries(c.checks)) { totals[r.status] += 1; if (r.status === FAIL) failures.push(`${c.id} ${n}`); }
  const summary = {
    schema: 'tekango-t16-signature-lifecycle/1', project: TEST_REF, base, buildSha, startedAt: stamp, finishedAt: new Date().toISOString(),
    signer: SIGNER, signatureDrawing: 'synthetic "QA" strokes', personas, created, totals, failures, cells,
  };
  fs.writeFileSync(path.join(dir, 'summary.json'), redact(JSON.stringify(summary, null, 2)) + '\n');
  say(`totals PASS ${totals.PASS} | FAIL ${totals.FAIL} | NOT TESTED ${totals['NOT TESTED']} -> ${path.join(dir, 'summary.json')}`);
  return totals.FAIL ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then((code) => process.exit(code), (e) => { say(`ERROR: ${e?.stack || e}`); process.exit(2); });
}

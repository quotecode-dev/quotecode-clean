// Task 16 cloud-fix4b (A12) - ITEM-TABLE SEMANTICS GATE (LOCAL-DEV, mocked functions, synthetic data only).
//
// Why: on a phone a long-amount item table is laid out as a CSS grid with display:contents rows
// (src/quoteDocument/narrowItems.css). A CSS display change is no proof that the table semantics survive, so this gate
// reads the RUNTIME accessibility tree of Chromium (CDP Accessibility.getFullAXTree, mapped to the DOM through
// backendDOMNodeId) and the rendered geometry - not the CSS text, not the markup alone.
// Fixtures (synthetic, scripts/task16/qa/print/fixtures.mjs longAmounts + a sectioned variant built here): 7/8-digit
// amounts, a 3.375 m2 quantity, cents for EN, long multi-word descriptions. States: flat; sections collapsed (summary
// rows); sections expanded (section 1 open: heading row colspan 4, item rows, subtotal row colspan 3 + amount).
// Surfaces:
//   public   /quote/:id of the given build (get-public-quote / quote-presentation mocked)
//   sample   /:lang/sample-quote of a Vite DEV server, TEST-ONLY module mock of src/quoteDocument/sampleQuotes.js so
//            buildSampleQuote returns the fixture (the same mock as print/long-amounts.mjs; the product is unchanged)
//   creator  the real Dashboard creator preview (mocked synthetic session, scripts/task16/qa/qh/fixtures.mjs): a draft
//            quote carrying the fixture items is opened with Edit, the preview is opened (split pane or on-demand
//            sheet) and set to device "mobile" (390px pq-preview container) for 320/390, device "desktop" for 1280
// Viewports 320x780 / 390x844 (narrow: the grid layout) and 1280x900 (control: the four-column table). HE-ILS / EN-USD.
// Cells (PASS/FAIL; exit 1 on any FAIL, 2 on a setup error):
//   ax-structure        the item table is an AX `table`; its AX rows are exactly the rendered <tr> rows (header + body,
//                       same count, same order); each AX row's cells are exactly that <tr>'s <th>/<td> in DOM order;
//                       header cells are `columnheader`, body cells `cell`; no item-table cell is ignored
//   header-association  every value cell (description, quantity, unit price, amount - item, summary and subtotal rows)
//                       is associated with ITS OWN column header twice: explicitly (headers="<id>" resolves to a <th
//                       scope="col"> of the same column key, exposed as `columnheader`) and structurally (its AX column
//                       index, colspans counted, equals the AX column index of that header) - and the cell is rendered
//                       inside that header's column (its box centre within the header cell's horizontal span)
//   reading-order       per AX row the cells read description -> quantity -> unit price -> amount (DOM classes), and the
//                       rendered positions never contradict that order: each next cell is on a later line, or on the
//                       same line further along the language direction (RTL: to the left; LTR: to the right); rows
//                       read top to bottom
//   cell-names          every value cell and header has a non-empty accessible name (the value / the label)
//   spanning-association (local fix 5, Codex P1 on 4a5eb18) every spanning cell is associated BY MEANING: expanded section
//                       heading (colspan 4) and section subtotal label (colspan 3) -> the description <th> only; the HE
//                       no-items general-quote line (colspan 4) -> description + amount. A missing or extra header FAILS.
// TS_BROWSER=chromium (default) | firefox | webkit. The engine's own accessibility tree is read through CDP in Chromium only;
// in Firefox / WebKit the ax-structure and cell-names cells are NOT TESTED (never PASS) and header-association,
// spanning-association and reading-order are judged on the engine's rendered DOM + geometry. Screen readers: NOT TESTED.
// Usage: node scripts/task16/qa/a11y/table-semantics.mjs <outDir> <buildUrl> <devUrl>
//   env TS_VIEWPORTS=320x780,390x844,1280x900  TS_SURFACES=public,sample,creator  TS_MARKETS=he-ILS,en-USD
//       TS_STYLES=classic  TS_FIXTURES=flat,sections  TS_CREATOR_BASE=<url> (default: buildUrl)
import { chromium, firefox, webkit } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { longAmounts, presentationFor } from '../print/fixtures.mjs';
import { assertLocal, newQuoteContext, openQuote } from '../print/printLib.mjs';
import { account, mockAccount } from '../qh/fixtures.mjs';

const [OUT, BUILD, DEV] = process.argv.slice(2);
if (!OUT || !BUILD || !DEV) { console.error('usage: table-semantics.mjs <outDir> <buildUrl> <devUrl>'); process.exit(2); }
const CREATOR = process.env.TS_CREATOR_BASE || BUILD;
try { [BUILD, DEV, CREATOR].forEach(assertLocal); } catch (e) { console.error(e.message); process.exit(2); }
const list = (v, d) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);
const VIEWPORTS = list(process.env.TS_VIEWPORTS, ['320x780', '390x844', '1280x900']).map((v) => { const [width, height] = v.split('x').map(Number); return { width, height, tag: v }; });
const SURFACES = list(process.env.TS_SURFACES, ['public', 'sample', 'creator']);
const MARKETS = list(process.env.TS_MARKETS, ['he-ILS', 'en-USD']).map((k) => { const [locale, currency] = k.split('-'); return { locale, currency }; });
const STYLES = list(process.env.TS_STYLES, ['classic']);
const FIXTURES = list(process.env.TS_FIXTURES, ['flat', 'sections']);
mkdirSync(OUT, { recursive: true });

const KEYS = ['desc', 'qty', 'price', 'total'];
const BROWSER = process.env.TS_BROWSER || 'chromium';
const ENGINES = { chromium, firefox, webkit };
if (!ENGINES[BROWSER]) { console.error(`TS_BROWSER must be one of ${Object.keys(ENGINES).join(', ')}`); process.exit(2); }
const SPAN_EXPECT = { 'section-heading': ['desc'], 'subtotal-label': ['desc'], 'general-quote': ['desc', 'total'] };
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
// sectioned variant (same items as the long-amount fixture + one long-word item, two sections)
function sectioned(locale, currency) {
  const fx = longAmounts(locale, currency);
  const q = fx.quoteData;
  const he = locale !== 'en';
  const p = currency === 'ILS' ? 2345678 : 2345678.25;
  const extra = { ...q.items[2], description: he ? 'התקנת מערכות אלקטרומכניות ואינסטלציה תת-קרקעית במרתפי החניה' : 'Electromechanical counterbalanced weatherproofing and underground installation in the parking basements', quantity: 1, unit_price: p, price: p, pricing_unit: null, calculated_quantity: null, quantity_source: null, calculation_method: null, specification: [], total_price: round2(p) };
  const items = [{ ...q.items[0], section_id: 'sec-a' }, { ...q.items[1], section_id: 'sec-a' }, { ...q.items[2], section_id: 'sec-b' }, { ...extra, section_id: 'sec-b' }];
  const sections = [{ id: 'sec-a', name: he ? 'מעטפת הבניין ומערכות' : 'Building envelope and plant', sort_order: 0 }, { id: 'sec-b', name: he ? 'גמר ופיתוח' : 'Finishing and site works', sort_order: 1 }];
  const subtotal = round2(items.reduce((a, i) => a + i.total_price, 0));
  return { ...fx, quoteData: { ...q, quote: { ...q.quote, subtotal }, items, sections } };
}
const fixtureFor = (kind, m) => (kind === 'sections' ? sectioned(m.locale, m.currency) : longAmounts(m.locale, m.currency));

// ---- in-page: the rendered cells of the item table, in DOM order ----
function domCells(root) {
  const scope = root ? document.querySelector(root) : document;
  const table = scope.querySelector('.pq-card table.pq-commercial-table');
  if (!table) return null;
  const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const rows = [];
  for (const tr of table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr')) {
    const cells = [...tr.children].filter((c) => /^(TD|TH)$/.test(c.tagName));
    if (!cells.some(vis)) continue;
    rows.push(cells.map((c) => {
      const b = c.getBoundingClientRect();
      const key = ['desc', 'qty', 'price', 'total'].find((k) => c.classList.contains(`pq-td-${k}`) || c.classList.contains(`pq-th-${k}`)) || null;
      const headers = (c.getAttribute('headers') || '').split(/\s+/).filter(Boolean).map((id) => {
        const th = document.getElementById(id);
        return th ? { id, tag: th.tagName, inTable: table.contains(th), scope: th.getAttribute('scope'), key: ['desc', 'qty', 'price', 'total'].find((k) => th.classList.contains(`pq-th-${k}`)) || null } : { id, missing: true };
      });
      return { tag: c.tagName, key, colSpan: c.colSpan || 1, id: c.id || null, scope: c.getAttribute('scope'), headers, rect: { top: b.top, bottom: b.bottom, left: b.left, right: b.right }, text: c.innerText.trim().replace(/\s+/g, ' ').slice(0, 40), subtotal: tr.classList.contains('pq-section-subtotal-row'),
        spanKind: key || (c.colSpan || 1) < 2 ? null : c.querySelector('.pq-section-toggle') ? 'section-heading' : tr.classList.contains('pq-section-subtotal-row') ? 'subtotal-label' : 'general-quote' };
    }));
  }
  const dir = getComputedStyle(table).direction;
  return { rows, dir, display: getComputedStyle(table).display, tableClass: table.className };
}

// ---- CDP: the AX subtree of the item table, cells mapped to the DOM ----
async function axTable(page, root) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root: docNode } = await cdp.send('DOM.getDocument', { depth: 0 });
    const sel = `${root ? `${root} ` : ''}.pq-card table.pq-commercial-table`;
    const { nodeId: tableId } = await cdp.send('DOM.querySelector', { nodeId: docNode.nodeId, selector: sel });
    if (!tableId) return { error: `no ${sel}` };
    const back = async (nodeId) => (await cdp.send('DOM.describeNode', { nodeId })).node.backendNodeId;
    const tableBack = await back(tableId);
    const { nodeIds: rowIds } = await cdp.send('DOM.querySelectorAll', { nodeId: tableId, selector: ':scope > thead > tr, :scope > tbody > tr' });
    const domRows = [];
    for (const r of rowIds) {
      const { nodeIds: cellIds } = await cdp.send('DOM.querySelectorAll', { nodeId: r, selector: ':scope > td, :scope > th' });
      domRows.push({ back: await back(r), cells: await Promise.all(cellIds.map(back)) });
    }
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    const tableAx = nodes.find((n) => n.backendDOMNodeId === tableBack);
    if (!tableAx) return { error: 'table has no AX node' };
    const role = (n) => n.role && n.role.value;
    const kids = (n) => (n.childIds || []).map((id) => byId.get(id)).filter(Boolean);
    // descendants with one of `roles`, not descending into a match (flattening ignored / generic wrappers)
    const collect = (n, roles, out = []) => { for (const k of kids(n)) { if (!k.ignored && roles.includes(role(k))) out.push(k); else collect(k, roles, out); } return out; };
    const rows = collect(tableAx, ['row']).map((r) => ({ back: r.backendDOMNodeId, cells: collect(r, ['columnheader', 'cell', 'gridcell', 'rowheader']).map((c) => ({ back: c.backendDOMNodeId, role: role(c), name: (c.name && c.name.value) || '' })) }));
    const ignoredCells = nodes.filter((n) => n.ignored && domRows.some((r) => r.cells.includes(n.backendDOMNodeId))).length;
    return { tableRole: role(tableAx), rows, domRows, ignoredCells };
  } finally { await cdp.detach().catch(() => {}); }
}

async function snapshotText(page, root) {
  try { return await page.locator(`${root ? `${root} ` : ''}.pq-card table.pq-commercial-table`).first().ariaSnapshot(); } catch (e) { return `ariaSnapshot failed: ${e.message}`; }
}

const cells = [];
const cell = (id, pass, detail) => cells.push({ id, result: pass === null ? 'NOT TESTED' : pass ? 'PASS' : 'FAIL', detail });
const evidence = [];

function judge(id, dom, axIn) {
  let ax = axIn;
  if (!dom || ax.error) { cell(`${id}/rendered`, false, { error: ax.error || 'no table' }); return; }
  if (ax.notTested) {
    // no engine AX tree outside Chromium: structure + names NOT TESTED; association / order judged on the rendered DOM
    cell(`${id}/ax-structure`, null, { reason: `${BROWSER}: engine accessibility tree not readable (CDP is Chromium-only)` });
    ax = { rows: [], domRows: [] };
  }
  // DOM rows that are rendered (domCells skips invisible rows) - match AX rows to DOM rows by backend id order
  const visibleDomRows = ax.domRows.filter((r, i) => i < ax.domRows.length); // all <tr> of the table (the fixture has no hidden rows)
  // ---- ax-structure ----
  const sProblems = [];
  if (axIn.notTested) { /* reported above */ } else {
  if (ax.tableRole !== 'table') sProblems.push({ tableRole: ax.tableRole });
  if (ax.rows.length !== visibleDomRows.length) sProblems.push({ axRows: ax.rows.length, domRows: visibleDomRows.length });
  ax.rows.forEach((r, i) => {
    const d = visibleDomRows[i];
    if (!d || r.back !== d.back) sProblems.push({ row: i, problem: 'AX row is not the DOM <tr> at this position' });
    if (d && (r.cells.length !== d.cells.length || r.cells.some((c, j) => c.back !== d.cells[j]))) sProblems.push({ row: i, problem: 'AX cells differ from the <tr> cells in DOM order', ax: r.cells.length, dom: d.cells.length });
    const want = i === 0 ? 'columnheader' : 'cell';
    const bad = r.cells.filter((c) => (want === 'cell' ? !['cell', 'gridcell'].includes(c.role) : c.role !== want));
    if (bad.length) sProblems.push({ row: i, roles: r.cells.map((c) => c.role) });
  });
  if (ax.ignoredCells) sProblems.push({ ignoredCells: ax.ignoredCells });
  cell(`${id}/ax-structure`, sProblems.length === 0, { problems: sProblems.slice(0, 6), axRows: ax.rows.length, display: dom.display, table: dom.tableClass });
  }
  // ---- header-association ----
  const aProblems = [];
  const header = dom.rows[0] || [];
  const colStart = (row, j) => row.slice(0, j).reduce((s, c) => s + c.colSpan, 0);
  const headerCol = Object.fromEntries(header.map((h, j) => [h.key, colStart(header, j)]));
  const headerAx = ax.rows[0] ? ax.rows[0].cells : [];
  header.forEach((h, j) => { if (h.tag !== 'TH' || h.scope !== 'col' || !h.id || (!axIn.notTested && (!headerAx[j] || headerAx[j].role !== 'columnheader'))) aProblems.push({ header: h.key, tag: h.tag, scope: h.scope, id: h.id, axRole: headerAx[j] && headerAx[j].role }); });
  let associated = 0;
  dom.rows.slice(1).forEach((row, i) => {
    row.forEach((c, j) => {
      if (!c.key) return; // full-width section heading / subtotal label: no column of their own
      const explicit = c.headers.filter((h) => !h.missing && h.tag === 'TH' && h.inTable && h.scope === 'col');
      if (!explicit.some((h) => h.key === c.key) || c.headers.some((h) => h.missing)) aProblems.push({ row: i + 1, cell: c.key, text: c.text, headers: c.headers, problem: 'no explicit headers -> own <th scope=col>' });
      // ... and visually: the cell is rendered inside its own header's column (its centre within the header cell span)
      const hc = header.find((h) => h.key === c.key);
      const mid = (c.rect.left + c.rect.right) / 2;
      if (hc && !(mid >= hc.rect.left - 0.5 && mid <= hc.rect.right + 0.5)) aProblems.push({ row: i + 1, cell: c.key, text: c.text, cellCentre: Math.round(mid), header: [Math.round(hc.rect.left), Math.round(hc.rect.right)], problem: 'rendered outside its own header column' });
      const axCol = colStart(row, j);
      if (axCol !== headerCol[c.key]) aProblems.push({ row: i + 1, cell: c.key, text: c.text, axColumn: axCol, headerColumn: headerCol[c.key], problem: 'structural column != own header column' });
      associated += 1;
    });
  });
  cell(`${id}/header-association`, aProblems.length === 0 && associated > 0, { valueCells: associated, problems: aProblems.slice(0, 6) });
  // ---- spanning-association (by meaning; never every header) ----
  const spProblems = [];
  let spanning = 0;
  dom.rows.slice(1).forEach((row, i) => row.forEach((c) => {
    if (!c.spanKind) return;
    spanning += 1;
    const want = SPAN_EXPECT[c.spanKind];
    const got = c.headers.map((h) => (!h.missing && h.tag === 'TH' && h.inTable && h.scope === 'col' ? h.key : null));
    if (got.some((k) => !k) || got.length !== want.length || want.some((k) => !got.includes(k))) spProblems.push({ row: i + 1, kind: c.spanKind, text: c.text, headers: got, want });
  }));
  if (dom.rows.slice(1).some((row) => row.some((c) => c.spanKind))) cell(`${id}/spanning-association`, spProblems.length === 0, { spanningCells: spanning, problems: spProblems.slice(0, 6) });
  // ---- reading-order ----
  const oProblems = [];
  const rtl = dom.dir === 'rtl';
  dom.rows.forEach((row, i) => {
    const keyed = row.filter((c) => c.key);
    const order = keyed.map((c) => KEYS.indexOf(c.key));
    if (order.some((v, k) => k > 0 && v <= order[k - 1])) oProblems.push({ row: i, domOrder: keyed.map((c) => c.key), problem: 'DOM / AX order is not description, quantity, unit price, amount' });
    for (let k = 1; k < row.length; k += 1) {
      const a = row[k - 1].rect; const b = row[k].rect;
      const laterLine = b.top >= a.bottom - 1;
      const sameLine = b.top < a.bottom - 1 && b.bottom > a.top + 1;
      const along = rtl ? b.right <= a.left + 1 : b.left >= a.right - 1;
      if (!(laterLine || (sameLine && along))) oProblems.push({ row: i, after: row[k - 1].key || row[k - 1].text, next: row[k].key || row[k].text, a: { top: Math.round(a.top), left: Math.round(a.left), right: Math.round(a.right) }, b: { top: Math.round(b.top), left: Math.round(b.left), right: Math.round(b.right) }, problem: 'rendered position contradicts the reading order' });
    }
    if (i > 0) {
      const prevTop = Math.min(...dom.rows[i - 1].map((c) => c.rect.top));
      const top = Math.min(...row.map((c) => c.rect.top));
      if (top < prevTop - 1) oProblems.push({ row: i, problem: 'row renders above the previous row' });
    }
  });
  cell(`${id}/reading-order`, oProblems.length === 0, { dir: dom.dir, display: dom.display, problems: oProblems.slice(0, 6) });
  // ---- cell-names ----
  if (axIn.notTested) { cell(`${id}/cell-names`, null, { reason: `${BROWSER}: engine accessible names not readable` }); } else {
  const unnamed = [];
  ax.rows.forEach((r, i) => r.cells.forEach((c, j) => { const d = dom.rows[i] && dom.rows[i][j]; if (d && d.key && !c.name.trim()) unnamed.push({ row: i, cell: d.key }); }));
  cell(`${id}/cell-names`, unnamed.length === 0, { unnamed: unnamed.slice(0, 6) });
  }
  evidence.push({ id, display: dom.display, dir: dom.dir, table: dom.tableClass, axRows: ax.rows.map((r) => r.cells.map((c) => `${c.role}:${c.name.slice(0, 28)}`)), domRows: dom.rows.map((r) => r.map((c) => `${c.tag.toLowerCase()}.${c.key || '-'}${c.colSpan > 1 ? `[${c.colSpan}]` : ''}${c.headers.length ? `->${c.headers.map((h) => h.key || 'missing').join('+')}` : ''}`)) });
}

async function measureStates(page, id, fx, root) {
  const states = fx.quoteData.sections && fx.quoteData.sections.length ? ['collapsed', 'expanded'] : ['flat'];
  for (const state of states) {
    if (state === 'expanded') { await page.locator(`${root ? `${root} ` : ''}.pq-card .pq-section-toggle`).first().click(); await page.waitForTimeout(250); }
    const sid = states.length > 1 ? `${id}/${state}` : id;
    const dom = await page.evaluate(domCells, root || null);
    const ax = BROWSER === 'chromium' ? await axTable(page, root) : { notTested: true };
    judge(sid, dom, ax);
    if (BROWSER === 'chromium' && /320x780|1280x900/.test(sid) && /he-ILS|en-USD/.test(sid) && evidence.length) evidence[evidence.length - 1].ariaSnapshot = await snapshotText(page, root);
  }
}

function creatorAccount(fx, m) {
  const acc = account(m.locale === 'he' ? 'Local' : 'International', 'std');
  const q = fx.quoteData;
  const draft = {
    ...acc.quotes[0], id: '00000000-0000-4000-9000-0000000000c1', quote_number: 2207, status: 'draft', created_at: new Date().toISOString(),
    currency: m.currency, tax_rate: q.quote.tax_rate, discount: q.quote.discount, subject: q.quote.subject, project_name: q.quote.project_name, attn_name: q.quote.attn_name, attn_role: q.quote.attn_role,
    clients: { id: 'c-ts', company_name: q.client.company_name, email: q.client.email, phone: q.client.phone, address: q.client.address, client_type: 'business' }, client_type: 'business',
    terms: q.quote.terms, notes: q.quote.notes, subtotal: q.quote.subtotal, total: q.quote.total,
    quote_items: q.items.map((it, i) => ({ id: `00000000-0000-4000-9000-0000000001${String(i).padStart(2, '0')}`, quote_id: '00000000-0000-4000-9000-0000000000c1', description: it.description, quantity: it.quantity, unit_price: it.unit_price, total_price: it.total_price, pricing_unit: it.pricing_unit, calculated_quantity: it.calculated_quantity, quantity_source: it.quantity_source, calculation_method: it.calculation_method, specification: it.specification, section_id: it.section_id || null, sort_order: i, quote_item_measurements: [] })),
    quote_sections: (q.sections || []).map((s) => ({ id: s.id, name: s.name, sort_order: s.sort_order })),
  };
  acc.settings = { ...acc.settings, currency: m.currency };
  acc.quotes = [draft, ...acc.quotes.slice(1)];
  return acc;
}
async function runCreator(browser, fx, m, vp, key, kind) {
  const device = vp.width <= 420 ? 'mobile' : 'desktop';
  const id = `creator/${vp.tag}-${device}/${key}/${kind}`;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await mockAccount(ctx, creatorAccount(fx, m), m.locale);
  const page = await ctx.newPage();
  try {
    await page.goto(`${CREATOR}/dashboard?lang=${m.locale}`, { waitUntil: 'networkidle' });
    const desktopRow = page.locator('tr', { hasText: 'A2207' }).first().locator('button[aria-expanded]');
    if (await desktopRow.count()) await desktopRow.first().click();
    else await page.locator('button[aria-expanded]', { hasText: fx.quoteData.client.company_name }).first().click();
    await page.getByRole('button', { name: m.locale === 'he' ? 'ערוך' : 'Edit', exact: true }).first().click();
    await page.waitForSelector(`[data-testid="qp-device-${device}"], [data-testid="qp-open-preview"]`, { timeout: 20000 });
    if (!(await page.locator(`[data-testid="qp-device-${device}"]`).count())) await page.locator('[data-testid="qp-open-preview"]').first().click();
    await page.waitForSelector(`[data-testid="qp-device-${device}"]`, { timeout: 20000 });
    await page.click(`[data-testid="qp-device-${device}"]`);
    const root = `.qp-device--${device}`;
    await page.waitForSelector(`${root} .pq-page.pq-preview .pq-card table.pq-commercial-table`, { timeout: 20000 });
    await page.waitForTimeout(600);
    await measureStates(page, id, fx, root);
  } catch (e) { cell(`${id}/rendered`, false, { error: String(e.message || e).slice(0, 300) }); }
  await ctx.close();
}

let browser;
try { browser = await ENGINES[BROWSER].launch(BROWSER === 'chromium' && process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}); } catch (e) { console.error(e.message); process.exit(2); }
for (const m of MARKETS) for (const kind of FIXTURES) for (const style of STYLES) {
  const fx = fixtureFor(kind, m);
  const dto = fx.quoteData;
  const key = `${m.locale}-${m.currency}/${style}`;
  for (const vp of VIEWPORTS) {
    if (SURFACES.includes('public')) {
      const ctx = await newQuoteContext(browser, { viewport: { width: vp.width, height: vp.height }, dto, presentation: presentationFor(style) });
      const page = await ctx.newPage();
      try { await openQuote(page, BUILD, dto); await measureStates(page, `public/${vp.tag}/${key}/${kind}`, fx, null); } catch (e) { cell(`public/${vp.tag}/${key}/${kind}/rendered`, false, { error: String(e.message || e).slice(0, 300) }); }
      await ctx.close();
    }
    if (SURFACES.includes('sample')) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await ctx.addInitScript((d) => { window.__A6_SAMPLE_FIXTURE = d; }, dto);
      await ctx.route(/\/src\/quoteDocument\/sampleQuotes\.js(\?.*)?$/, async (route) => {
        const res = await route.fetch();
        let body = await res.text();
        body = body.replace('export function buildSampleQuote(', 'function __a6OrigBuildSampleQuote(');
        body += '\nexport function buildSampleQuote(o) { const s = __a6OrigBuildSampleQuote(o); if (typeof window !== "undefined" && window.__A6_SAMPLE_FIXTURE) { s.quoteData = JSON.parse(JSON.stringify(window.__A6_SAMPLE_FIXTURE)); s.presentation = { ...s.presentation, media: [] }; } return s; }\n';
        return route.fulfill({ response: res, body });
      });
      const page = await ctx.newPage();
      try {
        await page.goto(`${DEV}/${m.locale}/sample-quote?style=${style}&length=short&detail=compact&images=0`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.pq-card table.pq-commercial-table', { timeout: 30000 });
        await page.waitForTimeout(300);
        if (!(await page.evaluate((n) => document.querySelector('.pq-card').innerText.includes(n), dto.client.company_name))) throw new Error('sample module mock did not apply');
        await measureStates(page, `sample/${vp.tag}/${key}/${kind}`, fx, null);
      } catch (e) { cell(`sample/${vp.tag}/${key}/${kind}/rendered`, false, { error: String(e.message || e).slice(0, 300) }); }
      await ctx.close();
    }
    if (SURFACES.includes('creator') && style === 'classic') await runCreator(browser, fx, m, vp, key, kind);
  }
}
await browser.close();
const fail = cells.filter((c) => c.result === 'FAIL');
const notTested = cells.filter((c) => c.result === 'NOT TESTED');
writeFileSync(join(OUT, 'table-semantics.json'), JSON.stringify({ gate: `task16 item-table semantics (LOCAL-DEV, ${BROWSER}, mocked, synthetic)`, browser: BROWSER, notTested: notTested.length, build: BUILD, dev: DEV, creator: CREATOR, viewports: VIEWPORTS.map((v) => v.tag), surfaces: SURFACES, markets: MARKETS.map((m) => `${m.locale}-${m.currency}`), styles: STYLES, fixtures: FIXTURES, notTested: 'Firefox, WebKit/Safari, real screen readers (not installed; playwright install not allowed)', chromium: process.env.PW_CHROMIUM || 'playwright default', generatedAt: new Date().toISOString(), node: process.version, pass: cells.length - fail.length, fail: fail.length, cells, evidence }, null, 1));
const by = {};
for (const x of cells) { const k = x.id.split('/').pop(); by[k] = by[k] || { pass: 0, fail: 0, nt: 0 }; by[k][x.result === 'PASS' ? 'pass' : x.result === 'FAIL' ? 'fail' : 'nt'] += 1; }
console.log(`TABLE SEMANTICS GATE (LOCAL-DEV, ${BROWSER}): ${cells.length - fail.length - notTested.length} PASS / ${fail.length} FAIL / ${notTested.length} NOT TESTED`);
for (const [k, v] of Object.entries(by)) console.log(`  ${v.fail ? 'FAIL' : v.pass ? 'PASS' : 'NT  '} ${k.padEnd(20)} ${v.pass} pass / ${v.fail} fail / ${v.nt} not tested`);
for (const f of fail) console.log(`  FAIL ${f.id} ${JSON.stringify(f.detail).slice(0, 320)}`);
process.exit(fail.length ? 1 : 0);

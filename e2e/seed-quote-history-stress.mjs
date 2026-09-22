// IRON-QH-LAYOUT-001 stress fixtures (TEST ONLY, allowlisted synthetic personas only - fail-closed persona loader).
//   IRON_SYNTHETIC_ALLOWLIST=<synthetic-personas.json> node e2e/seed-quote-history-stress.mjs [--dry]
// Creates (idempotently, by marker) Quote History stress rows for the Local/ILS persona and the International/USD persona:
//   amounts 10 / 100 / 1,000 / 10,000 / 100,000 / 1,000,000 / 9,999,999.99, a long HE + long EN client name, a long quote number,
//   every status (draft / sent / approved / paid / unfinished draft), and the unambiguous DATE FIXTURE (created 2026-09-13T09:00Z,
//   valid until 2026-09-13). Writes go through the authenticated owner (RLS) - never a service role; refuses any non-TEST project.
import { randomUUID } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const { PERSONA_A, PERSONA_EN, SUPABASE_URL, SUPABASE_ANON_KEY } = await import(pathToFileURL(path.join(here, 'testPersonas.js')).href);
if (!/ljfizgrdyzxddswcedwr\.supabase\.co/.test(SUPABASE_URL || '')) throw new Error('refusing: not the TEST project');
export const MARKER = 'IRONSTRESS';
const DRY = process.argv.includes('--dry');

async function http(method, url, { token, body, prefer } = {}) {
  const h = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_ANON_KEY}` };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (prefer) h.Prefer = prefer;
  const res = await fetch(url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}
const rest = (m, p, o) => http(m, `${SUPABASE_URL}/rest/v1/${p}`, o);
const rpc = (fn, args, token) => http('POST', `${SUPABASE_URL}/rest/v1/rpc/${fn}`, { token, body: args });
async function login(p) {
  const r = await http('POST', `${SUPABASE_URL}/auth/v1/token?grant_type=password`, { body: { email: p.email, password: p.password } });
  if (r.status !== 200) throw new Error(`login failed ${r.status}`);
  return { token: r.json.access_token, uid: r.json.user.id };
}

const AMOUNTS = [10, 100, 1000, 10000, 100000, 1000000, 9999999.99];
export const FIXTURES = {
  he: { persona: PERSONA_A, currency: 'ILS', taxRate: 0.18, longName: `לקוח סינתטי עם שם ארוך במיוחד לבדיקת פריסת היסטוריה ${MARKER}`, name: (i) => `לקוח ${MARKER} ${i}`, dateName: `לקוח תאריך ${MARKER}` },
  en: { persona: PERSONA_EN, currency: 'USD', taxRate: 0, longName: `Synthetic Extraordinarily Long Client Name Holdings International ${MARKER}`, name: (i) => `Client ${MARKER} ${i}`, dateName: `Date Fixture ${MARKER}` },
};
const STATUS_CYCLE = ['draft', 'sent', 'approved', 'paid'];

function payload({ currency, taxRate, total, subject, validUntil = null, unfinished = false }) {
  const subtotal = taxRate ? +(total / (1 + taxRate)).toFixed(2) : total;
  const header = { status: 'draft', valid_until: validUntil, terms: 'Synthetic', warranty: 'Synthetic', notes: `${MARKER} synthetic stress fixture`, subject, quote_subject: subject, attn_name: '', attn_role: '', project_name: MARKER, currency, client_type: 'business', subtotal: unfinished ? 0 : subtotal, tax_rate: taxRate, total: unfinished ? 0 : total, discount: 0 };
  const items = unfinished ? [] : [{ client_key: 'new_0', id: null, section_client_key: null, description: `${MARKER} item`, quantity: 1, unit_price: subtotal, total_price: subtotal, sort_order: 0, measurements: [] }];
  return { header, sections: [], items };
}
const args = (qid, client, q) => ({ p_quote_id: qid, p_is_new: true, p_client: client, p_quote: q.header, p_financial: null, p_sections: q.sections, p_items: q.items, p_removed_section_ids: [], p_removed_item_ids: [], p_description_updates: [], p_new_attachments: [], p_removed_attachment_ids: [] });
const client = (name) => ({ id: null, company_name: name, email: 'delivered@resend.dev', phone: '000', client_type: 'business', tax_id: '0', address: `${MARKER} address`, notes: MARKER });

const report = {};
for (const [lang, f] of Object.entries(FIXTURES)) {
  const s = await login(f.persona);
  const existing = await rest('GET', `quotes?select=id,total,status,quote_number,created_at,valid_until,clients(company_name)&notes=like.${encodeURIComponent(MARKER)}*`, { token: s.token });
  if (existing.status !== 200) throw new Error(`read failed ${existing.status} ${existing.text}`);
  const specs = [
    ...AMOUNTS.map((a, i) => ({ key: `amount-${a}`, name: i === AMOUNTS.length - 1 ? f.longName : f.name(i + 1), total: a, status: STATUS_CYCLE[i % 4] })),
    { key: 'unfinished', name: f.name('U'), total: 0, unfinished: true, status: 'draft' },
    // the LONG quote number (int4 ceiling range, A + 10 digits) is immutable once allocated, so it is created WITH that number by
    // e2e/seed-quote-history-longnumber.mjs for this same client; this row keeps its allocated number.
    { key: 'long-number-client', name: f.name('N'), total: 4321.5, status: 'sent' },
    { key: 'date-fixture', name: f.dateName, total: 1313.13, status: 'draft', createdAt: '2026-09-13T09:00:00Z', validUntil: '2026-09-13' },
  ];
  report[lang] = [];
  for (const sp of specs) {
    const found = existing.json.find((q) => q.clients?.company_name === sp.name);
    let id = found?.id;
    if (!id && !DRY) {
      id = randomUUID();
      const r = await rpc('save_quote_atomic', args(id, client(sp.name), payload({ currency: f.currency, taxRate: f.taxRate, total: sp.total, subject: `${MARKER} ${sp.key}`, validUntil: sp.validUntil, unfinished: sp.unfinished })), s.token);
      if (r.status !== 200 || r.json?.ok !== true) throw new Error(`${lang}/${sp.key} save failed ${r.status} ${r.text.slice(0, 200)}`);
    }
    const patch = {};
    if (sp.status !== 'draft') patch.status = sp.status;
    if (sp.quoteNumber) patch.quote_number = sp.quoteNumber;
    if (sp.createdAt) patch.created_at = sp.createdAt;
    let patched = null;
    if (id && Object.keys(patch).length && !DRY) {
      const r = await rest('PATCH', `quotes?id=eq.${id}`, { token: s.token, body: patch, prefer: 'return=representation' });
      patched = { status: r.status, row: r.json?.[0] ? { status: r.json[0].status, quote_number: r.json[0].quote_number, created_at: r.json[0].created_at } : r.text.slice(0, 160) };
    }
    report[lang].push({ key: sp.key, name: sp.name, id, patched });
  }
}
// catalog rows (the EN persona's catalog was EMPTY - an empty list can never pass the mobile geometry gate)
for (const [lang, f] of Object.entries(FIXTURES)) {
  const s = await login(f.persona);
  const have = await rest('GET', `services?select=id,name&name=like.${encodeURIComponent(MARKER)}*`, { token: s.token });
  const names = [`${MARKER} catalog item`, `${MARKER} catalog item with a much longer descriptive name`, `${MARKER} premium installation`];
  const prices = [120, 4999.5, 1000000];
  report[`${lang}-catalog`] = [];
  for (const [i, name] of names.entries()) {
    if ((have.json || []).some((r) => r.name === name) || DRY) { report[`${lang}-catalog`].push({ name, existed: true }); continue; }
    const r = await rest('POST', 'services', { token: s.token, body: [{ name, price: prices[i], user_id: s.uid }], prefer: 'return=representation' });
    report[`${lang}-catalog`].push({ name, status: r.status });
  }
}
console.log(JSON.stringify(report, null, 1));

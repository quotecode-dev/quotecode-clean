// IRON-QH-LAYOUT-001 long-quote-number fixture (TEST ONLY, allowlisted synthetic personas; owner RLS insert, never service role).
// quote_number is int4 and immutable after assignment (BEFORE UPDATE trigger), so the longest REAL number (A + 10 digits, int4
// ceiling range) can only exist as a fixture created with that number. Idempotent by client name.
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const { PERSONA_A, PERSONA_EN, SUPABASE_URL, SUPABASE_ANON_KEY } = await import(pathToFileURL(path.join(here, 'testPersonas.js')).href);
if (!/ljfizgrdyzxddswcedwr\.supabase\.co/.test(SUPABASE_URL || '')) throw new Error('refusing: not the TEST project');
const MARKER = 'IRONSTRESS';
const http = async (method, url, token, body) => {
  const res = await fetch(url, { method, headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text };
};
const out = {};
for (const [lang, p, currency, num] of [['he', PERSONA_A, 'ILS', 2147483600], ['en', PERSONA_EN, 'USD', 2147483601]]) {
  const l = await http('POST', `${SUPABASE_URL}/auth/v1/token?grant_type=password`, SUPABASE_ANON_KEY, { email: p.email, password: p.password });
  const token = l.json.access_token; const uid = l.json.user.id;
  const name = lang === 'he' ? `לקוח ${MARKER} N` : `Client ${MARKER} N`;
  const have = await http('GET', `${SUPABASE_URL}/rest/v1/quotes?select=id,quote_number&quote_number=eq.${num}`, token);
  if (have.json?.length) { out[lang] = { existing: have.json[0] }; continue; }
  const c = await http('GET', `${SUPABASE_URL}/rest/v1/clients?select=id&company_name=eq.${encodeURIComponent(name)}`, token);
  const clientId = c.json?.[0]?.id;
  const ins = await http('POST', `${SUPABASE_URL}/rest/v1/quotes`, token, { user_id: uid, client_id: clientId, quote_number: num, status: 'sent', currency, subtotal: 4321.5, tax_rate: 0, total: 4321.5, discount: 0, notes: `${MARKER} long-number fixture`, project_name: MARKER, client_type: 'business' });
  out[lang] = { status: ins.status, row: ins.json?.[0] ? { id: ins.json[0].id, quote_number: ins.json[0].quote_number } : ins.text.slice(0, 200) };
}
console.log(JSON.stringify(out, null, 1));

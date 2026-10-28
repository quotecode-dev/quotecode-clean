/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// expense-invoices - WIRING ONLY (the logic is lib.ts, unit-tested). Owner console 2026-10-22, typed L-22 (the expense-invoice tool).
//  - verify_jwt = false: Google's redirect (GET .../expense-invoices/oauth-callback) carries no user JWT - it is accepted only with a valid,
//    signed, 15-minute state that names a super admin and the mailbox. Every POST is a verified super admin (JWT + business_settings.role),
//    or the site cron with the shared secret (x-cron-secret = CRON_SECRET, constant-time, scan only).
//  - The Google refresh tokens are stored ENCRYPTED (AES-GCM; the key is derived from GOOGLE_EXPENSES_CLIENT_SECRET) and revoked at Google
//    on disconnect.
//  - Secrets (the Owner sets them; never in code): GOOGLE_EXPENSES_CLIENT_ID / GOOGLE_EXPENSES_CLIENT_SECRET, OPENAI_API_KEY,
//    PAYPLUS_API_KEY / PAYPLUS_SECRET_KEY / PAYPLUS_ENVIRONMENT (+ PAYPLUS_PROXY_URL, the fixed-IP relay), RESEND_API_KEY + SUPPORT_OWNER_NOTIFY_ADDRESS (the monthly note), CRON_SECRET.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { expenseHandler, oauthCallback, scanBatch, payplusRecords, payplusReason, createExpenseAt, subcategoryUuids, sameText, boiRate, BOI_RATE_CURRENCIES, BUDGET_MS, LIST_CAP, type ExpenseDeps } from './lib.ts';
import { PAYPLUS_API_BASES } from '../subscription-authority/payplus.ts';
import { sendMail } from '../support-inbound/mail.ts';
import { payplusEgress, type FetchLike } from '../_shared/payplusEgress.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const BUCKET = 'expense-invoices';
const APP_URL = 'https://www.tekango.com';
const AI_TIMEOUT_MS = 45000;
const GOOGLE_TIMEOUT_MS = 15000;

const toBase64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function timed(url: string, init: RequestInit, ms = GOOGLE_TIMEOUT_MS, f: FetchLike = (u, i) => fetch(u, i)): Promise<Response> {
  const abort = new AbortController();
  const t = setTimeout(() => abort.abort(), ms);
  try { return await f(url, { ...init, signal: abort.signal }); } finally { clearTimeout(t); }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  let secretKey = '';
  try { secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? ''; } catch { secretKey = ''; }
  if (!secretKey) secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // Owner 2026-10-23: the PayPlus calls go through the fixed-IP relay (PAYPLUS_PROXY_URL; the account's IP check - _shared/payplusEgress.ts)
  const egress = payplusEgress(Deno.env.get('PAYPLUS_PROXY_URL'));
  const clientId = (Deno.env.get('GOOGLE_EXPENSES_CLIENT_ID') ?? '').trim();
  const clientSecret = (Deno.env.get('GOOGLE_EXPENSES_CLIENT_SECRET') ?? '').trim();
  const redirectUri = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/expense-invoices/oauth-callback`;
  const enc = new TextEncoder();
  const hmacKey = clientSecret ? await crypto.subtle.importKey('raw', enc.encode(`expense-invoices/state/${clientSecret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']) : null;
  const aesKey = clientSecret ? await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc.encode(`expense-invoices/token/${clientSecret}`)), 'AES-GCM', false, ['encrypt', 'decrypt']) : null;
  const seal = async (text: string) => {
    if (!aesKey) throw new Error('google_not_configured');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(text)));
    return `v1.${toBase64(iv)}.${toBase64(ct)}`;
  };
  const open = async (sealed: string) => {
    const [v, iv, ct] = sealed.split('.');
    if (v !== 'v1' || !iv || !ct || !aesKey) throw new Error('token_unreadable');
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, aesKey, fromBase64(ct)));
  };

  const db = async <T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> => {
    const { data, error } = await p;
    if (error) {
      // the database's own code and message (table / constraint names - never row values) for the function log
      const e = error as { code?: string; message?: string };
      console.error(`expense-invoices: database ${e.code ?? ''} ${String(e.message ?? '').slice(0, 160)}`);
      throw new Error('database');
    }
    return data;
  };
  const google = async (path: string, access: string) => {
    const res = await timed(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${access}` } });
    if (!res.ok) throw new Error(`gmail_${res.status}`);
    return await res.json();
  };
  const tokenCall = async (form: Record<string, string>) => {
    const res = await timed('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...form }).toString() });
    if (!res.ok) {
      // Google's own error code only (invalid_client / invalid_grant / ...) - never the request, never a secret
      const err = await res.json().catch(() => null);
      const code = typeof err?.error === 'string' && /^[a-z_]{3,40}$/.test(err.error) ? err.error : `http_${res.status}`;
      console.error(`expense-invoices: google token ${form.grant_type} refused: ${code}`);
      throw new Error(`google_token:${code}`);
    }
    return await res.json();
  };
  const payplus = () => {
    const env = (Deno.env.get('PAYPLUS_ENVIRONMENT') ?? '').trim();
    const apiKey = (Deno.env.get('PAYPLUS_API_KEY') ?? '').trim();
    const secret = (Deno.env.get('PAYPLUS_SECRET_KEY') ?? '').trim();
    if (!apiKey || !secret || (env !== 'production' && env !== 'staging')) throw new Error('payplus_not_configured');
    return { base: PAYPLUS_API_BASES[env as 'production' | 'staging'], headers: { 'api-key': apiKey, 'secret-key': secret } };
  };
  const superAdmin = async (uid: string) => {
    const { data } = await admin.from('business_settings').select('role').eq('user_id', uid).maybeSingle();
    return (data as { role?: string } | null)?.role === 'super_admin';
  };

  let callerRole: 'admin' | 'cron' | null = null;
  let userId: string | null = null;
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  if (cronSecret && sameText(req.headers.get('x-cron-secret') ?? '', cronSecret)) callerRole = 'cron';
  else if (authHeader) {
    const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
    try {
      const { data } = await caller.auth.getUser();
      userId = data?.user?.id ?? null;
      if (userId && await superAdmin(userId)) callerRole = 'admin';
    } catch { callerRole = null; }
  }

  const deps: ExpenseDeps = {
    caller: async () => callerRole,
    isSuperAdmin: superAdmin,
    config: { clientId, redirectUri, appUrl: APP_URL },
    hmac: async (text) => {
      if (!hmacKey) throw new Error('google_not_configured');
      const sig = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(text));
      return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
    },
    now: () => Date.now(),
    uuid: () => crypto.randomUUID(),
    exchangeCode: async (code) => {
      const t = await tokenCall({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
      return { refreshToken: typeof t.refresh_token === 'string' ? t.refresh_token : null, accessToken: String(t.access_token || '') };
    },
    accessToken: async (refresh) => String((await tokenCall({ refresh_token: refresh, grant_type: 'refresh_token' })).access_token || ''),
    revoke: async (refresh) => { await timed('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refresh }).toString() }); },
    profileEmail: async (access) => String((await google('profile', access)).emailAddress || ''),
    listMessageIds: async (access, q) => {
      const ids: string[] = [];
      let page = '';
      do {
        const r = await google(`messages?maxResults=500&q=${encodeURIComponent(q)}${page ? `&pageToken=${page}` : ''}`, access);
        for (const m of r.messages || []) if (typeof m?.id === 'string') ids.push(m.id);
        page = typeof r.nextPageToken === 'string' ? r.nextPageToken : '';
      } while (page && ids.length < LIST_CAP);
      return ids.slice(0, LIST_CAP);
    },
    getMessage: (access, id) => google(`messages/${encodeURIComponent(id)}?format=full`, access),
    getAttachment: async (access, mid, aid) => String((await google(`messages/${encodeURIComponent(mid)}/attachments/${encodeURIComponent(aid)}`, access)).data || ''),
    complete: async ({ model, messages, schema }) => {
      const legacy = model === 'gpt-4o-mini';
      const res = await timed('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, response_format: { type: 'json_schema', json_schema: schema },
          ...(legacy ? { max_tokens: 1500, temperature: 0 } : { max_completion_tokens: 1500, reasoning_effort: 'none' }) }),
      }, AI_TIMEOUT_MS);
      if (res.status === 404 || (res.status === 400 && /model/i.test(await res.clone().text()))) throw new Error('model_unavailable');
      if (!res.ok) throw new Error(`ai_${res.status}`);
      const data = await res.json();
      const choice = data?.choices?.[0];
      if (typeof choice?.message?.content !== 'string' || (choice.finish_reason && choice.finish_reason !== 'stop')) throw new Error('ai_incomplete');
      return { content: choice.message.content };
    },
    connections: () => db(admin.from('expense_mail_connections').select('mailbox, scanned_until').order('mailbox')),
    token: async (mailbox) => {
      const row = await db(admin.from('expense_mail_tokens').select('refresh_token').eq('mailbox', mailbox).maybeSingle()) as { refresh_token?: string } | null;
      return row?.refresh_token ? await open(row.refresh_token) : null;
    },
    saveToken: async (mailbox, refresh) => { await db(admin.from('expense_mail_tokens').upsert({ mailbox, refresh_token: await seal(refresh), updated_at: new Date().toISOString() })); },
    saveConnection: async (mailbox, patch) => { await db(admin.from('expense_mail_connections').upsert({ mailbox, ...patch })); },
    removeConnection: async (mailbox) => {
      await db(admin.from('expense_mail_tokens').delete().eq('mailbox', mailbox));
      await db(admin.from('expense_mail_connections').delete().eq('mailbox', mailbox));
    },
    seen: async (mailbox, ids) => {
      const out = new Set<string>();
      for (let i = 0; i < ids.length; i += 300) {
        const rows = await db(admin.from('expense_mail_seen').select('message_id').eq('mailbox', mailbox).neq('outcome', 'retry').in('message_id', ids.slice(i, i + 300))) as { message_id: string }[];
        rows.forEach((r) => out.add(r.message_id));
      }
      return out;
    },
    markSeen: async (mailbox, id, outcome) => { await db(admin.from('expense_mail_seen').upsert({ mailbox, message_id: id, outcome, seen_at: new Date().toISOString() })); },
    recordRetry: async (mailbox, id) => {
      const row = await db(admin.from('expense_mail_seen').select('attempts').eq('mailbox', mailbox).eq('message_id', id).maybeSingle()) as { attempts?: number } | null;
      const attempts = (row?.attempts ?? 0) + 1;
      await db(admin.from('expense_mail_seen').upsert({ mailbox, message_id: id, outcome: 'retry', attempts, seen_at: new Date().toISOString() }));
      return attempts;
    },
    isDuplicate: async (supplier, number) => {
      const exact = supplier.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/\*/g, '');
      const rows = await db(admin.from('expense_invoices').select('id').ilike('supplier_name', exact).eq('doc_number', number).limit(1)) as unknown[];
      return rows.length > 0;
    },
    insertInvoice: async (row) => {
      const { data, error } = await admin.from('expense_invoices').insert(row).select('id').maybeSingle();
      if (error) { if ((error as { code?: string }).code === '23505') return null; throw new Error('database'); }
      return (data as { id?: string } | null)?.id ?? null;
    },
    invoices: (ids) => db(admin.from('expense_invoices').select('*').in('id', ids)) as Promise<Record<string, unknown>[]>,
    updateUnlessSent: async (id, patch) => {
      const rows = await db(admin.from('expense_invoices').update(patch).eq('id', id).not('status', 'in', '(sent,sending)').select('id')) as unknown[];
      return rows.length === 1;
    },
    claimForSend: async (id) => {
      const rows = await db(admin.from('expense_invoices').update({ status: 'sending', updated_at: new Date().toISOString() }).eq('id', id)
        .in('status', ['approved', 'send_failed']).select('*')) as Record<string, unknown>[];
      return rows[0] ?? null;
    },
    finishSend: async (id, patch) => { await db(admin.from('expense_invoices').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'sending')); },
    settings: async () => ((await db(admin.from('expense_settings').select('expense_types, default_subcategory_id').eq('id', 1).maybeSingle()))
      ?? { expense_types: [], default_subcategory_id: null }) as { expense_types: { id: number; name: string }[]; default_subcategory_id: number | null },
    saveSettings: async (patch) => { await db(admin.from('expense_settings').update(patch).eq('id', 1)); },
    upload: async (path, base64, type) => {
      const { error } = await admin.storage.from(BUCKET).upload(path, fromBase64(base64), { contentType: type, upsert: true });
      if (error) throw new Error('storage');
    },
    signedUrl: async (path) => (await admin.storage.from(BUCKET).createSignedUrl(path, 120)).data?.signedUrl ?? null,
    download: async (path) => {
      const { data, error } = await admin.storage.from(BUCKET).download(path);
      if (error || !data) return null;
      return toBase64(new Uint8Array(await data.arrayBuffer()));
    },
    payplusSearch: async (search) => {
      const p = payplus();
      const res = await timed(`${p.base}/books/expenses?search=${encodeURIComponent(search)}&skip=0&take=50`, { headers: p.headers }, GOOGLE_TIMEOUT_MS, egress.fetch);
      const body = await res.json().catch(() => null);
      // the documented "nothing found" answer is 400 with an empty object; any other failure blocks the send
      if (res.status === 400 && body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0) return [];
      if (!res.ok) throw new Error(`PayPlus search ${res.status}`);
      const list = payplusRecords(body);
      if (!list) throw new Error('PayPlus search answer not understood');
      return list;
    },
    payplusCreate: async (fields, file) => {
      const p = payplus();
      // a fresh form per address (a sent body is consumed)
      const res = await createExpenseAt(async (path) => {
        const form = new FormData();
        for (const [k, v] of Object.entries(fields)) form.append(k, v);
        if (file) form.append('doc_file', new Blob([fromBase64(file.base64)], { type: file.type }), file.name);
        const r = await timed(`${p.base}${path}`, { method: 'POST', headers: p.headers, body: form }, 30000, egress.fetch);
        return { status: r.status, text: await r.text().catch(() => '') };
      });
      const text = res.text;
      let out: { status?: unknown; details?: { uuid?: unknown } } | null = null;
      try { out = JSON.parse(text); } catch { out = null; }
      if (res.status < 200 || res.status > 299 || out?.status !== 'success') throw new Error(`PayPlus ${res.status}: ${payplusReason(text)}`);
      // created: the id when PayPlus gives it (the row is sent either way - never created twice)
      return typeof out?.details?.uuid === 'string' ? out.details.uuid : 'created';
    },
    // L-22 (Owner 2026-10-28, "שליחת סוג ההוצאה לפיי פלוס לפי המזהה שלהם"): the expense types list PayPlus's own form reads
    payplusSubcategories: async () => {
      const p = payplus();
      const res = await timed(`${p.base}/books/categories/expense/list?skipEmpty=false`, { headers: p.headers }, GOOGLE_TIMEOUT_MS, egress.fetch);
      if (!res.ok) return {};
      return subcategoryUuids(await res.json().catch(() => null));
    },
    // L-22 (Owner 2026-10-28): the Bank of Israel representative rate of the invoice date (the public SDMX service; the two weeks before
    // the date cover weekends and holidays) - a foreign invoice is sent in shekels at that rate
    ilsRate: async (currency, date) => {
      if (!BOI_RATE_CURRENCIES.includes(currency) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      const from = new Date(Date.parse(`${date}T00:00:00Z`) - 14 * 86400000).toISOString().slice(0, 10);
      const res = await timed(`https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_${currency}_ILS?startperiod=${from}&endperiod=${date}&format=csv`, {}, GOOGLE_TIMEOUT_MS);
      if (!res.ok) return null;
      return boiRate(await res.text(), date);
    },
    notifyOwner: async (found) => {
      const to = (Deno.env.get('SUPPORT_OWNER_NOTIFY_ADDRESS') ?? '').trim();
      const month = new Date().toISOString().slice(0, 7);
      await sendMail({ fetch: (u, i) => fetch(u, i), apiKey: Deno.env.get('RESEND_API_KEY') ?? '' }, {
        from: 'TEKANGO <support@tekango.com>', replyTo: 'support@tekango.com', to,
        subject: `${found} חשבוניות הוצאה חדשות ממתינות לאישור`,
        text: [`נמצאו ${found} חשבוניות הוצאה חדשות בתיבות הדואר.`, 'הן ממתינות לאישור שלכם בניהול, במסך "מערכת", בכלי "חשבוניות הוצאה".', 'שום דבר לא נשלח לפיי פלוס בלי האישור שלכם.',
          `${APP_URL}/dashboard?view=admin&section=expense-invoices`].join('\n'),
        idempotencyKey: `tekango-expenses/v1/monthly/${month}`,
      });
    },
  };

  const url = new URL(req.url);
  if (req.method === 'GET' && url.pathname.endsWith('/oauth-callback')) {
    if (!hmacKey) return Response.redirect(`${APP_URL}/dashboard?view=admin&section=expense-invoices&expenseConnect=not_configured`, 302);
    const r = await oauthCallback({ code: url.searchParams.get('code'), state: url.searchParams.get('state'), error: url.searchParams.get('error') }, deps);
    const result = new URL(r.redirect).searchParams.get('expenseConnect');
    if (result !== 'ok') console.error(`expense-invoices: connect result ${result}`);
    return Response.redirect(r.redirect, 302);
  }
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method_not_allowed' });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json(400, { ok: false, code: 'invalid_request' }); }

  // the monthly run reads in the background (minutes of AI reading); the cron gets its answer at once
  if (callerRole === 'cron' && body?.action === 'scan' && typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil((async () => {
      const r = await scanBatch(deps, BUDGET_MS.cron).catch(() => null);
      if (r && r.found > 0) await deps.notifyOwner(r.found).catch(() => {});
    })());
    return json(202, { ok: true, started: true });
  }
  try {
    const r = await expenseHandler(body, deps, userId);
    return json(r.status, r.body);
  } catch {
    return json(500, { ok: false, code: 'failed' });
  } finally {
    egress.close();
  }
});

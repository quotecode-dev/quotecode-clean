/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// agents-room - WIRING ONLY (the logic is lib.ts, unit-tested). Owner console 2026-10-27 (typed: "מאשר שלב 1 של חדר הסוכנים: דוח גם במייל,
// תקרה 20 דולר, 65% חו״ל, כמשימת לילה").
//  - verify_jwt = false: the weekly site cron has no user JWT; it is accepted only with the shared secret (x-cron-secret = CRON_SECRET,
//    constant-time). Every other call is a verified super admin (JWT + business_settings.role), checked in code.
//  - Secrets (already set): GSC_SERVICE_ACCOUNT_JSON (read-only Search Console), OPENAI_API_KEY, RESEND_API_KEY + SUPPORT_OWNER_NOTIFY_ADDRESS,
//    CRON_SECRET. Nothing is ever published, sent to a customer or changed on the site.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handler, type Deps, type Agent } from './lib.ts';
import { rs256Sign, sitemapPaths, ORIGIN } from '../search-console/lib.ts';
import { sendMail } from '../support-inbound/mail.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const sameText = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

async function timed(url: string, init: RequestInit = {}, ms = 20000): Promise<Response> {
  const abort = new AbortController();
  const t = setTimeout(() => abort.abort(), ms);
  try { return await fetch(url, { ...init, signal: abort.signal }); } finally { clearTimeout(t); }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method_not_allowed' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  let secretKey = '';
  try { secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? ''; } catch { secretKey = ''; }
  if (!secretKey) secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let role: 'admin' | 'cron' | null = null;
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const auth = req.headers.get('Authorization');
  if (cronSecret && sameText(req.headers.get('x-cron-secret') ?? '', cronSecret)) role = 'cron';
  else if (auth) {
    try {
      const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } });
      const uid = (await caller.auth.getUser()).data?.user?.id;
      if (uid) {
        const { data } = await admin.from('business_settings').select('role').eq('user_id', uid).maybeSingle();
        if ((data as { role?: string } | null)?.role === 'super_admin') role = 'admin';
      }
    } catch { role = null; }
  }

  const db = async <T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> => {
    const { data, error } = await p;
    if (error) { console.error(`agents-room: database ${(error as { code?: string }).code ?? ''}`); throw new Error('database'); }
    return data;
  };
  const keyJson = Deno.env.get('GSC_SERVICE_ACCOUNT_JSON') ?? '';
  const sitemap = async () => { const r = await timed(`${ORIGIN}/sitemap.xml`); return r.ok ? await r.text() : ''; };

  const deps: Deps = {
    caller: async () => role,
    now: () => new Date(),
    claim: async (agent: Agent, runKey, trigger) => {
      const { data, error } = await admin.from('agent_runs').insert({ agent, run_key: runKey, trigger }).select('id').maybeSingle();
      if (error) { if ((error as { code?: string }).code === '23505') return null; console.error(`agents-room: claim ${(error as { code?: string }).code ?? ''}`); throw new Error('database'); }
      return (data as { id: string } | null)?.id ?? null;
    },
    finish: async (id, patch) => { await db(admin.from('agent_runs').update(patch).eq('id', id)); },
    monthCostUsd: async (since) => {
      const rows = (await db(admin.from('agent_runs').select('ai_cost_usd').gte('started_at', since))) as { ai_cost_usd: number }[];
      return Math.round(rows.reduce((a, r) => a + Number(r.ai_cost_usd || 0), 0) * 10_000) / 10_000;
    },
    recentRuns: async () => (await db(admin.from('agent_runs').select('id, agent, run_key, trigger, status, started_at, finished_at, summary, findings, data, ai_cost_usd, mailed_at, error')
      .order('started_at', { ascending: false }).limit(30))) as never,
    gsc: keyJson ? { caller: async () => 'admin', keyJson: () => keyJson, fetch: (u, i) => timed(u, i), now: () => new Date(), sitemapXml: sitemap, sign: rs256Sign } : null,
    serviceStats: async (since) => {
      const msgs = (await db(admin.from('support_inbound_messages').select('bin').eq('is_automated', false).gte('stored_at', since).limit(1000))) as { bin: string | null }[];
      const inquiries: Record<string, number> = {};
      for (const m of msgs) { const k = m.bin || 'unsorted'; inquiries[k] = (inquiries[k] ?? 0) + 1; }
      const items = (await db(admin.from('support_review_items').select('title, priority').in('status', ['new', 'in_progress']).order('priority', { ascending: true }).limit(50))) as { title: string; priority: number }[];
      const chat = (await db(admin.from('chat_ai_daily_usage').select('questions').gte('usage_day', since.slice(0, 10)).limit(5000))) as { questions: number }[];
      return { inquiries, openItems: items.length, topItems: items.slice(0, 3), chatQuestions: chat.reduce((a, r) => a + Number(r.questions || 0), 0) };
    },
    fetchHead: async (url) => {
      const r = await timed(url, { method: 'GET', redirect: 'manual' }, 15000);
      const headers: Record<string, string> = {};
      r.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      try { await r.body?.cancel(); } catch { /* the body is not needed */ }
      return { status: r.status, headers };
    },
    versionJson: async () => { try { const r = await timed(`${ORIGIN}/version.json?t=${Date.now()}`); return r.ok ? await r.json() : null; } catch { return null; } },
    complete: async ({ model, messages, schema }) => {
      const legacy = model === 'gpt-4o-mini';
      const res = await timed('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, response_format: { type: 'json_schema', json_schema: schema },
          ...(legacy ? { max_tokens: 2000, temperature: 0.2 } : { max_completion_tokens: 2000, reasoning_effort: 'none' }) }),
      }, 60000);
      if (!res.ok) throw new Error(`ai_${res.status}`);
      const data = await res.json();
      const c = data?.choices?.[0];
      if (typeof c?.message?.content !== 'string') throw new Error('ai_incomplete');
      return { content: c.message.content, promptTokens: Number(data?.usage?.prompt_tokens ?? 0), completionTokens: Number(data?.usage?.completion_tokens ?? 0) };
    },
    mailOwner: async (subject, text, key) => {
      const to = (Deno.env.get('SUPPORT_OWNER_NOTIFY_ADDRESS') ?? '').trim();
      if (!to) return false;
      const r = await sendMail({ fetch: (u, i) => fetch(u, i), apiKey: Deno.env.get('RESEND_API_KEY') ?? '' }, {
        from: 'TEKANGO Agents <support@tekango.com>', replyTo: 'support@tekango.com', to, subject, text, idempotencyKey: key,
      });
      return r.ok;
    },
  };

  let body: unknown = null;
  try { body = await req.json(); } catch { return json(400, { ok: false, code: 'invalid_request' }); }
  try {
    const r = await handler(body, deps, async () => sitemapPaths(await sitemap()));
    return json(r.status, r.body);
  } catch (e) {
    console.error(`agents-room: failed ${(e as Error)?.message ?? ''}`.slice(0, 200));
    return json(500, { ok: false, code: 'failed' });
  }
});

/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// support-weekly-review - WIRING ONLY (the logic is lib.ts, unit-tested). Owner console 2026-10-23, typed L-22 (the weekly review).
//  - verify_jwt = false: the site cron has no user JWT; it is accepted only with the shared secret (x-cron-secret = CRON_SECRET,
//    constant-time). The Owner's "run now" is a verified super admin (JWT + business_settings.role).
//  - Secrets (already set for the support email): OPENAI_API_KEY, RESEND_API_KEY, SUPPORT_OWNER_NOTIFY_ADDRESS, CRON_SECRET.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { reviewHandler, type ReviewDeps } from './lib.ts';
import { sendMail } from '../support-inbound/mail.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const APP_URL = 'https://www.tekango.com';
const sameText = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

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
    if (error) { console.error(`support-weekly-review: database ${(error as { code?: string }).code ?? ''}`); throw new Error('database'); }
    return data;
  };
  const deps: ReviewDeps = {
    caller: async () => role,
    now: () => new Date(),
    claimWeek: async (week) => ((await db(admin.from('support_review_runs').upsert({ week }, { onConflict: 'week', ignoreDuplicates: true }).select('week'))) as unknown[]).length === 1,
    inquiries: (since, until) => db(admin.from('support_inbound_messages').select('id, subject, summary, text_body, bin, stored_at, mailbox')
      .in('bin', ['yellow', 'red']).eq('is_automated', false).gte('stored_at', since).lt('stored_at', until).order('stored_at', { ascending: true }).limit(200)) as Promise<never>,
    complete: async ({ model, messages, schema }) => {
      const legacy = model === 'gpt-4o-mini';
      const abort = new AbortController();
      const t = setTimeout(() => abort.abort(), 60000);
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST', signal: abort.signal,
          headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, response_format: { type: 'json_schema', json_schema: schema },
            ...(legacy ? { max_tokens: 3000, temperature: 0 } : { max_completion_tokens: 3000, reasoning_effort: 'none' }) }),
        });
        if (res.status === 404 || (res.status === 400 && /model/i.test(await res.clone().text()))) throw new Error('model_unavailable');
        if (!res.ok) throw new Error(`ai_${res.status}`);
        const data = await res.json();
        const c = data?.choices?.[0];
        if (typeof c?.message?.content !== 'string' || (c.finish_reason && c.finish_reason !== 'stop')) throw new Error('ai_incomplete');
        return { content: c.message.content };
      } finally { clearTimeout(t); }
    },
    saveItems: async (week, items, count) => {
      if (items.length) {
        await db(admin.from('support_review_items').insert(items.map((i) => ({ week, kind: i.kind, title: i.title, summary: i.summary, priority: i.priority,
          inquiries_count: i.inquiryIds.length, inquiry_ids: i.inquiryIds }))));
      }
      await db(admin.from('support_review_runs').update({ inquiries: count, items: items.length }).eq('week', week));
    },
    mailOwner: async (subject, text, week) => {
      const to = (Deno.env.get('SUPPORT_OWNER_NOTIFY_ADDRESS') ?? '').trim();
      const r = await sendMail({ fetch: (u, i) => fetch(u, i), apiKey: Deno.env.get('RESEND_API_KEY') ?? '' }, {
        from: 'TEKANGO Support <support@tekango.com>', replyTo: 'support@tekango.com', to, subject, text, idempotencyKey: `tekango-support/v1/weekly/${week}`,
      });
      return r.ok;
    },
    markMailed: async (week) => { await db(admin.from('support_review_runs').update({ mailed_at: new Date().toISOString() }).eq('week', week)); },
  };

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json(400, { ok: false, code: 'invalid_request' }); }
  try {
    const r = await reviewHandler(body, deps, APP_URL);
    return json(r.status, r.body);
  } catch (e) {
    console.error(`support-weekly-review: failed ${(e as Error)?.message ?? ''}`.slice(0, 200));
    return json(500, { ok: false, code: 'failed' });
  }
});

/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// live-check - WIRING ONLY (the logic is lib.ts, unit-tested). Codex release 9, topic 10 (Owner console 2026-10-30: "מאשר לעומר פתח כניסה
// מיוחד בשרת, רק לשני חשבונות הבדיקה ..."). verify_jwt = false: the caller is the GitHub job, accepted only with x-live-check-secret.
// Secrets: LIVE_CHECK_SECRET (also a GitHub repository secret), RESEND_API_KEY + SUPPORT_OWNER_NOTIFY_ADDRESS (the failure email).
// The session is minted for a registered persona only (live_check_persona: registered AND marked as a test account); nothing is logged
// but a fixed code.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handle, type LiveDeps, type Session } from './lib.ts';
import { sendMail } from '../support-inbound/mail.ts';

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const sameText = (a: string, b: string) => { if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method_not_allowed' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  let secretKey = '';
  try { secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? ''; } catch { secretKey = ''; }
  if (!secretKey) secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const secret = Deno.env.get('LIVE_CHECK_SECRET') ?? '';
  const db = async <T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> => {
    const { data, error } = await p;
    if (error) { console.error(`live-check: database ${(error as { code?: string }).code ?? ''}`); throw new Error('database'); }
    return data;
  };

  const deps: LiveDeps = {
    secretOk: () => secret.length >= 32 && sameText(req.headers.get('x-live-check-secret') ?? '', secret),
    now: () => new Date(),
    persona: async (p) => {
      const r = (await db(admin.rpc('live_check_persona', { p_persona: p }))) as { userId?: string; email?: string } | null;
      return r?.userId && r?.email ? { userId: r.userId, email: r.email } : null;
    },
    // the server's own one-time sign-in link, exchanged here at once for a session (no email is sent; the link never leaves the function)
    mintSession: async (email) => {
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      const hashed = (data as { properties?: { hashed_token?: string } } | null)?.properties?.hashed_token;
      if (error || !hashed) return null;
      const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
      const v = await anon.auth.verifyOtp({ type: 'email', token_hash: hashed });
      return (v.error || !v.data?.session) ? null : (v.data.session as unknown as Session);
    },
    claimScheduled: async (runKey) => {
      const { data, error } = await admin.from('agent_runs').insert({ agent: 'live_check', run_key: runKey, trigger: 'cron' }).select('id').maybeSingle();
      if (error) { if ((error as { code?: string }).code === '23505') return null; throw new Error('database'); }
      return (data as { id: string } | null)?.id ?? null;
    },
    getRun: async (id) => (await db(admin.from('agent_runs').select('id, agent, trigger, status').eq('id', id).maybeSingle())) as never,
    finishRun: async (id, patch) => {
      const rows = (await db(admin.from('agent_runs').update(patch).eq('id', id).eq('agent', 'live_check').eq('status', 'running').select('id'))) as unknown[];
      return Array.isArray(rows) && rows.length === 1;
    },
    mailOwner: async (subject, text, key) => {
      const to = (Deno.env.get('SUPPORT_OWNER_NOTIFY_ADDRESS') ?? '').trim();
      if (!to) return false;
      const r = await sendMail({ fetch: (u, i) => fetch(u, i), apiKey: Deno.env.get('RESEND_API_KEY') ?? '' }, {
        from: 'TEKANGO Agents <support@tekango.com>', replyTo: 'support@tekango.com', to, subject, text, idempotencyKey: key,
      });
      return r.ok;
    },
    signOut: async (token) => {
      try { const { error } = await admin.auth.admin.signOut(token, 'local'); return !error; } catch { return false; }
    },
    recordHealth: async (event, outcome) => {
      try { await admin.rpc('scheduled_health_record', { p_job: 'live-check', p_event: event, p_outcome: outcome }); } catch { /* never breaks the report */ }
    },
  };

  let body: unknown = null;
  try { body = await req.json(); } catch { return json(400, { ok: false, code: 'invalid_request' }); }
  try {
    const r = await handle(body, deps);
    return json(r.status, r.body);
  } catch (e) {
    console.error(`live-check: failed ${(e as Error)?.message ?? ''}`.slice(0, 120));
    return json(500, { ok: false, code: 'failed' });
  }
});

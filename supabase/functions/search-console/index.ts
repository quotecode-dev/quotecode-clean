/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// search-console - WIRING ONLY (the logic is lib.ts, unit-tested). Owner console 2026-10-26 (typed: "מאשר לבנות מסך גוגל סרץ' קונסול
// במסך הניהול, בקריאה בלבד"): the admin screen's read-only view of Google Search Console.
//  - Every call is a verified super admin (JWT + business_settings.role), checked in code.
//  - Secret (the Owner set it 2026-10-26): GSC_SERVICE_ACCOUNT_JSON - the read-only service account key; never logged, never returned.
//  - The pages whose indexing is inspected = the live sitemap (one source with the site; never a second list).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handler, rs256Sign, ORIGIN, type Deps } from './lib.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const TIMEOUT_MS = 20000;


async function timed(url: string, init: RequestInit = {}): Promise<Response> {
  const abort = new AbortController();
  const t = setTimeout(() => abort.abort(), TIMEOUT_MS);
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

  const deps: Deps = {
    caller: async () => {
      const auth = req.headers.get('Authorization');
      if (!auth) return null;
      try {
        const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } });
        const uid = (await caller.auth.getUser()).data?.user?.id;
        if (!uid) return null;
        const { data } = await admin.from('business_settings').select('role').eq('user_id', uid).maybeSingle();
        return (data as { role?: string } | null)?.role === 'super_admin' ? 'admin' : null;
      } catch { return null; }
    },
    keyJson: () => Deno.env.get('GSC_SERVICE_ACCOUNT_JSON') ?? '',
    fetch: timed,
    now: () => new Date(),
    sitemapXml: async () => { const r = await timed(`${ORIGIN}/sitemap.xml`); return r.ok ? await r.text() : ''; },
    sign: rs256Sign,
  };
  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  const r = await handler(deps, body);
  return json(r.status, r.body);
});

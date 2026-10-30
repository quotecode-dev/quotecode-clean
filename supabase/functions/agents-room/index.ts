/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// agents-room - WIRING ONLY (the logic is lib.ts, unit-tested). Owner console 2026-10-27 (typed: "מאשר שלב 1 של חדר הסוכנים: דוח גם במייל,
// תקרה 20 דולר, 65% חו״ל, כמשימת לילה").
//  - verify_jwt = false: the weekly site cron has no user JWT; it is accepted only with the shared secret (x-cron-secret = CRON_SECRET,
//    constant-time). Every other call is a verified super admin (JWT + business_settings.role), checked in code.
//  - Secrets (already set): GSC_SERVICE_ACCOUNT_JSON (read-only Search Console), OPENAI_API_KEY, RESEND_API_KEY + SUPPORT_OWNER_NOTIFY_ADDRESS,
//    CRON_SECRET. Nothing is ever published, sent to a customer or changed on the site.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { recordRun } from '../_shared/scheduledHealth.ts'; // Codex release 7: the cron window is reported
import { type Agent, israelParts } from './lib.ts';
// Codex release 4 (Owner 2026-10-29, typed: "מאשר שינוי ב-L-22 לשחרור 4 של קודקס: הגנה מכפילויות מאמרים ושמירת תקציב בינה עם שריון מראש,
// החלטות 6 ו-9 כמוצע, L-25 בלי שינוי, שחרור עד הלייב"): every AI request is reserved / settled in the budget ledger (20261030200000),
// the article topics come from the whole inventory and are claimed atomically (20261030300000)
import { budgetedComplete } from './aiBudget.ts';
import { collectWeek, type MarketingDeps, type MarketKey, type Snapshot } from './marketing.ts';
import { GRAPH } from './social.ts';
import { normTopic, type Inventory } from './articleTopics.ts';
// Stage 2 (Owner console 2026-10-27, typed: "מאשר את תוכנית שלב 2 עם מנהל הסוכנים"): the agents manager, the Owner's approvals, agent
// names, articles. New secret (optional until the Owner sets it): VERCEL_DEPLOY_HOOK_URL - the site rebuild after an approved article.
import { handle, type StageDeps, type AnyAgent } from './manager.ts';
import { TARGETS, publishToMeta } from './social.ts';
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
  // a signed-in user who is not the Owner may still be a supervisor (L-22, Owner 2026-10-27): the permission is asked of the database AS
  // THE CALLER (has_admin_permission, like support-admin), per request; any error = refused
  let asCaller: ReturnType<typeof createClient> | null = null;
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const auth = req.headers.get('Authorization');
  if (cronSecret && sameText(req.headers.get('x-cron-secret') ?? '', cronSecret)) role = 'cron';
  else if (auth) {
    try {
      const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } });
      const uid = (await caller.auth.getUser()).data?.user?.id;
      if (uid) {
        asCaller = caller;
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
  // `since` is an Israel month start (lib.monthStartIso): 12 hours later is still the 1st of that Israel month
  type BudgetState = { committed_micros?: number; held_micros?: number; blocked?: boolean };
  const budgetState = async (since: string): Promise<BudgetState> =>
    (await db(admin.rpc('agents_ai_budget_state', { p_month: israelParts(new Date(Date.parse(since) + 12 * 3_600_000)).month }))) as BudgetState;
  const nrm = (s: string) => normTopic(s).slice(0, 300);
  const lifecycle = (out: unknown) => {
    const o = (out ?? {}) as { ok?: boolean; code?: string; lang?: string; ref_id?: string | null; article_id?: string; publish_action_id?: string };
    return { ok: o.ok === true, code: o.code, lang: o.lang, refId: o.ref_id ?? null, articleId: o.article_id, publishActionId: o.publish_action_id };
  };
  const keyJson = Deno.env.get('GSC_SERVICE_ACCOUNT_JSON') ?? '';
  const sitemap = async () => { const r = await timed(`${ORIGIN}/sitemap.xml`); return r.ok ? await r.text() : ''; };

  // Codex release 8 (Owner 2026-10-30, decisions 12-13): the search-data service - server-only login / password, every request reserved
  // against the 10 USD monthly data cap and settled with the provider's own cost
  const marketing: MarketingDeps = {
    now: () => new Date(),
    creds: () => {
      const login = (Deno.env.get('DATAFORSEO_LOGIN') ?? '').trim(); const password = (Deno.env.get('DATAFORSEO_PASSWORD') ?? '').trim();
      return login && password ? { login, password } : null;
    },
    fetch: (url, init) => timed(url, init, 60000),
    reserve: async (purpose, hold) => {
      const r = (await db(admin.rpc('agents_data_reserve', { p_purpose: purpose, p_hold_micros: hold }))) as { ok?: boolean; id?: string; code?: string } | null;
      return r?.ok === true && typeof r.id === 'string' ? { ok: true, id: r.id } : { ok: false, code: String(r?.code ?? 'data_budget_blocked') };
    },
    settle: async (id, state, cost) => { await db(admin.rpc('agents_data_settle', { p_id: id, p_state: state, p_cost_micros: cost ?? null })); },
    keywords: async () => ((await db(admin.from('marketing_keywords').select('id, market, keyword').eq('active', true).order('created_at').limit(200))) as { id: string; market: MarketKey; keyword: string }[]),
    addKeywords: async (rows) => { await db(admin.from('marketing_keywords').upsert(rows.map((r) => ({ ...r, source: 'search_console' })), { onConflict: 'market,keyword', ignoreDuplicates: true })); },
    competitors: async () => ((await db(admin.from('marketing_competitors').select('domain, market'))) as { domain: string; market: MarketKey }[]),
    weekSnapshots: async (week) => ((await db(admin.from('marketing_rank_snapshots').select('keyword_id, our_position, competitor_positions, search_volume, depth').eq('week', week))) as Record<string, unknown>[])
      .map((r): Snapshot => ({ keywordId: String(r.keyword_id), ourPosition: (r.our_position as number | null) ?? null, competitorPositions: (r.competitor_positions ?? {}) as Record<string, number>,
        searchVolume: (r.search_volume as number | null) ?? null, depth: Number(r.depth) || 100 })),
    saveSnapshots: async (week, rows) => {
      await db(admin.from('marketing_rank_snapshots').upsert(rows.map((r) => ({ week, keyword_id: r.keywordId, our_position: r.ourPosition, competitor_positions: r.competitorPositions,
        search_volume: r.searchVolume, depth: r.depth })), { onConflict: 'week,keyword_id', ignoreDuplicates: true }));
    },
  };

  const deps: StageDeps = {
    caller: async () => role,
    // stage 2: the page tokens are function secrets (META_PAGE_IL_TOKEN / META_PAGE_INTL_TOKEN), read here only and sent to Meta only
    connectedChannels: () => Object.entries(TARGETS).filter(([, t]) => !!(Deno.env.get(t.tokenEnv) ?? '').trim()).map(([id]) => id),
    publishSocial: (channel, payload, onContainer) => publishToMeta((u, i) => timed(u, i, 30000), (name) => (Deno.env.get(name) ?? '').trim(), channel, payload, onContainer),
    can: async (permission) => {
      if (role === 'admin') return true;
      if (role === 'cron' || !asCaller) return false;
      try {
        const { data, error } = await asCaller.rpc('has_admin_permission', { p_permission: permission });
        return !error && data === true;
      } catch { return false; }
    },
    now: () => new Date(),
    claim: async (agent: Agent | 'manager' | 'social', runKey, trigger) => {
      const { data, error } = await admin.from('agent_runs').insert({ agent, run_key: runKey, trigger }).select('id').maybeSingle();
      if (error) { if ((error as { code?: string }).code === '23505') return null; console.error(`agents-room: claim ${(error as { code?: string }).code ?? ''}`); throw new Error('database'); }
      return (data as { id: string } | null)?.id ?? null;
    },
    finish: async (id, patch) => { await db(admin.from('agent_runs').update(patch).eq('id', id)); },
    // the month of `since` (an Israel month start) in the reservation ledger: carried in + settled + held, rounded up to 1/10000 dollar
    monthCostUsd: async (since) => Math.ceil(Number((await budgetState(since)).committed_micros ?? 0) / 100) / 10_000,
    budgetHold: async (since) => { const s = await budgetState(since); return { heldUsd: Math.ceil(Number(s.held_micros ?? 0) / 100) / 10_000, blocked: s.blocked === true }; },
    recentRuns: async () => (await db(admin.from('agent_runs').select('id, agent, run_key, trigger, status, started_at, finished_at, summary, findings, data, ai_cost_usd, mailed_at, error')
      .order('started_at', { ascending: false }).limit(30))) as never,
    gsc: keyJson ? { caller: async () => 'admin', keyJson: () => keyJson, fetch: (u, i) => timed(u, i), now: () => new Date(), sitemapXml: sitemap, sign: rs256Sign } : null,
    serviceStats: async (since) => {
      const msgs = (await db(admin.from('support_inbound_messages').select('bin').eq('is_automated', false).gte('stored_at', since).limit(1000))) as { bin: string | null }[];
      const inquiries: Record<string, number> = {};
      for (const m of msgs) { const k = m.bin || 'unsorted'; inquiries[k] = (inquiries[k] ?? 0) + 1; }
      const items = (await db(admin.from('support_review_items').select('title, priority').in('status', ['new', 'in_progress']).order('priority', { ascending: true }).limit(50))) as { title: string; priority: number }[];
      const chat = (await db(admin.from('chat_ai_daily_usage').select('questions').gte('usage_day', since.slice(0, 10)).limit(5000))) as { questions: number }[];
      // the red inquiries still waiting for the Owner (any week), newest first - the service card links each one
      const red = (await db(admin.from('support_inbound_messages').select('id, subject, from_address, received_at').eq('is_automated', false).eq('bin', 'red')
        .in('status', ['waiting', 'draft']).order('received_at', { ascending: false }).limit(5))) as { id: string; subject: string | null; from_address: string | null; received_at: string }[];
      const redOpen = red.map((m) => ({ id: m.id, subject: m.subject ?? '', from: m.from_address ?? '', received_at: m.received_at }));
      return { inquiries, openItems: items.length, topItems: items.slice(0, 3), chatQuestions: chat.reduce((a, r) => a + Number(r.questions || 0), 0), redOpen };
    },
    fetchHead: async (url) => {
      const r = await timed(url, { method: 'GET', redirect: 'manual' }, 15000);
      const headers: Record<string, string> = {};
      r.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      try { await r.body?.cancel(); } catch { /* the body is not needed */ }
      return { status: r.status, headers };
    },
    versionJson: async () => { try { const r = await timed(`${ORIGIN}/version.json?t=${Date.now()}`); return r.ok ? await r.json() : null; } catch { return null; } },
    // Codex release 4: reserved before the request, settled once after it (aiBudget.ts); a refusal makes no request
    complete: (a) => budgetedComplete({
      month: () => israelParts(new Date()).month,
      reserve: async (r) => {
        // Codex R4-11 (20261030400000): the run / action / logical operation of the attempt
        const uuidOrNull = (v?: string) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null);
        const out = (await db(admin.rpc('agents_ai_reserve', { p_month: r.month, p_purpose: r.purpose, p_model: r.model, p_rate_version: r.rateVersion,
          p_max_input: r.maxInput, p_max_output: r.maxOutput, p_reserved: r.micros, p_run_ref: r.ref?.run ?? null, p_action_ref: uuidOrNull(r.ref?.action), p_op_ref: uuidOrNull(r.ref?.op) }))) as { ok?: boolean; id?: string; code?: string };
        if (out?.ok === true && typeof out.id === 'string') return { id: out.id };
        return { refused: out?.code === 'budget_blocked' ? 'budget_blocked' : 'budget_insufficient' };
      },
      settle: async (id, outcome, usage, micros) => {
        await db(admin.rpc('agents_ai_settle', { p_id: id, p_outcome: outcome, p_prompt_tokens: usage?.promptTokens ?? null,
          p_completion_tokens: usage?.completionTokens ?? null, p_settled: micros }));
      },
      noteProvider: async (id, providerRef) => { await db(admin.rpc('agents_ai_note_provider', { p_id: id, p_provider_ref: providerRef })); },
      post: (body, ms) => timed('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' }, body,
      }, ms),
    }, a),
    mailOwner: async (subject, text, key) => {
      const to = (Deno.env.get('SUPPORT_OWNER_NOTIFY_ADDRESS') ?? '').trim();
      if (!to) return false;
      const r = await sendMail({ fetch: (u, i) => fetch(u, i), apiKey: Deno.env.get('RESEND_API_KEY') ?? '' }, {
        from: 'TEKANGO Agents <support@tekango.com>', replyTo: 'support@tekango.com', to, subject, text, idempotencyKey: key,
      });
      return r.ok;
    },
    profiles: async () => (await db(admin.from('agent_profiles').select('agent, name_he, name_en'))) as never,
    setProfile: async (agent: AnyAgent, nameHe, nameEn) => { await db(admin.from('agent_profiles').update({ name_he: nameHe, name_en: nameEn, updated_at: new Date().toISOString() }).eq('agent', agent)); },
    recentActions: async () => (await db(admin.from('agent_actions').select('id, created_at, run_key, source, kind, action_type, title_he, title_en, detail_he, detail_en, payload, status, decided_at, done_at, result, error, dedupe_key')
      .gte('created_at', new Date(Date.now() - 60 * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(100))) as never,
    insertAction: async (a) => {
      const { data, error } = await admin.from('agent_actions').insert(a).select('id').maybeSingle();
      if (error) { if ((error as { code?: string }).code === '23505') return null; console.error(`agents-room: action ${(error as { code?: string }).code ?? ''}`); throw new Error('database'); }
      return (data as { id: string } | null)?.id ?? null;
    },
    updateAction: async (id, patch, whenStatus, whenDecidedAt) => {
      const q = admin.from('agent_actions').update(patch).eq('id', id);
      const s = whenStatus ? q.eq('status', whenStatus) : q;
      await db(whenDecidedAt === undefined ? s : whenDecidedAt === null ? s.is('decided_at', null) : s.eq('decided_at', whenDecidedAt));
    },
    getAction: async (id) => (/^[0-9a-f-]{36}$/.test(id) ? (await db(admin.from('agent_actions').select('*').eq('id', id).maybeSingle())) as never : null),
    updateArticle: async (id, patch, whenStatus, whenRevision) => {
      let q = admin.from('site_articles').update(patch).eq('id', id);
      if (whenStatus) q = q.eq('status', whenStatus);
      if (whenRevision !== undefined) q = q.eq('revision', whenRevision); // Codex N01: one conditional write on the approved revision
      const rows = await db(q.select('id')) as unknown[];
      return Array.isArray(rows) && rows.length === 1;
    },
    pageHtml: async (url) => { try { const r = await timed(url, {}, 15000); return r.ok ? await r.text() : null; } catch { return null; } },
    getArticle: async (id) => (/^[0-9a-f-]{36}$/.test(id) ? (await db(admin.from('site_articles').select('id, slug, market, status, he, en, published_at, created_at, revision, action_id').eq('id', id).maybeSingle())) as never : null),
    // ONE answer with every article, waiting proposal and active claim (no row window); anything malformed = unavailable
    articleInventory: async () => {
      const inv = (await db(admin.rpc('agents_article_inventory'))) as Inventory | null;
      if (!inv || !Array.isArray(inv.articles) || !Array.isArray(inv.proposals) || !Array.isArray(inv.claims) || !Array.isArray(inv.slugs)) throw new Error('article_inventory_unavailable');
      return inv;
    },
    // Codex R4-01..R4-03 (20261030400000): each lifecycle write is ONE locked database transaction
    admitArticle: async (action, token, holdSeconds, topic, focus) => lifecycle(await db(admin.rpc('agents_article_admit', { p_action: action, p_token: token,
      p_hold_seconds: holdSeconds, p_he_norm: nrm(topic.he), p_en_norm: nrm(topic.en), p_he: topic.he.slice(0, 300), p_en: topic.en.slice(0, 300),
      p_focus: focus, p_focus_norm: focus ? nrm(focus) || null : null }))),
    saveDraft: async (action, token, a, pub) => lifecycle(await db(admin.rpc('agents_article_save_draft', { p_action: action, p_token: token, p_slug: a.slug,
      p_market: a.market, p_he: a.he, p_en: a.en, p_he_norm: nrm(a.he.h1), p_en_norm: nrm(a.en.h1), p_pub_title_he: pub.title_he, p_pub_title_en: pub.title_en,
      p_pub_detail_he: pub.detail_he, p_pub_detail_en: pub.detail_en }))),
    rewriteArticle: async (article, revision, he, en) => lifecycle(await db(admin.rpc('agents_article_rewrite', { p_article: article, p_revision: revision,
      p_he: he, p_en: en, p_he_norm: nrm(he.h1), p_en_norm: nrm(en.h1) }))),
    publishArticle: async (article, revision, heads, focus) => lifecycle(await db(admin.rpc('agents_article_publish', { p_article: article, p_revision: revision,
      p_he_norm: nrm(heads.he), p_en_norm: nrm(heads.en), p_focus: focus, p_focus_norm: focus ? nrm(focus) || null : null }))),
    rejectArticleFlow: async (action, holdSeconds) => lifecycle(await db(admin.rpc('agents_article_reject', { p_action: action, p_hold_seconds: holdSeconds }))),
    lastPublishedAt: async () => ((await db(admin.from('site_articles').select('published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(1))) as { published_at: string }[])[0]?.published_at ?? null,
    // Codex release 8 (Owner 2026-10-30): the Graph API of a connected account - its page token is read here only and sent to Meta only
    graph: async (channel, method, path, params) => {
      const t = TARGETS[channel];
      const token = t ? (Deno.env.get(t.tokenEnv) ?? '').trim() : '';
      if (!token || !/^[0-9_/a-z]+$/i.test(path)) return { ok: false, status: 0, json: null };
      try {
        const q = new URLSearchParams({ ...params, access_token: token });
        const r = method === 'GET' ? await timed(`${GRAPH}/${path}?${q}`, {}, 15000)
          : await timed(`${GRAPH}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: q.toString() }, 20000);
        return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
      } catch { return { ok: false, status: 0, json: null }; }
    },
    saveMetrics: async (rows) => {
      await db(admin.from('social_post_metrics').upsert(rows.map((m) => ({ action_id: m.actionId, network: m.network, likes: m.likes, comments: m.comments, shares: m.shares,
        reach: m.reach, reach_available: m.reachAvailable, fetched_at: new Date().toISOString() }))));
    },
    postMetricsRows: async () => ((await db(admin.from('social_post_metrics').select('action_id, network, likes, comments, shares, reach, reach_available, fetched_at').limit(60))) as Record<string, unknown>[])
      .map((m) => ({ actionId: String(m.action_id), network: m.network as never, likes: m.likes as never, comments: m.comments as never, shares: m.shares as never, reach: m.reach as never, reachAvailable: m.reach_available === true })),
    replyActions: async () => (await db(admin.from('agent_actions').select('id, created_at, run_key, source, kind, action_type, title_he, title_en, detail_he, detail_en, payload, status, decided_at, done_at, result, error, dedupe_key')
      .eq('action_type', 'social_reply').gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(100))) as never,
    purgeReplyTexts: async () => Number(await db(admin.rpc('agents_purge_reply_texts'))) || 0,
    competitive: (queries) => collectWeek(marketing, queries),
    deployHook: async () => {
      const url = (Deno.env.get('VERCEL_DEPLOY_HOOK_URL') ?? '').trim();
      if (!/^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\//.test(url)) return 'not_configured';
      try { const r = await timed(url, { method: 'POST' }, 15000); return r.ok ? 'ok' : 'failed'; } catch { return 'failed'; }
    },
  };

  let body: unknown = null;
  try { body = await req.json(); } catch { return json(400, { ok: false, code: 'invalid_request' }); }
  try {
    const r = await handle(body, deps, async () => sitemapPaths(await sitemap()));
    // Codex release 7: the weekly / daily cron windows are reported (a manual run never satisfies a window)
    const cronAction = (body as { action?: unknown })?.action;
    if (role === 'cron' && (cronAction === 'run' || cronAction === 'daily')) await recordRun(admin, cronAction === 'daily' ? 'agents-daily' : 'agents-weekly', r.status, r.body as never);
    return json(r.status, r.body);
  } catch (e) {
    console.error(`agents-room: failed ${(e as Error)?.message ?? ''}`.slice(0, 200));
    return json(500, { ok: false, code: 'failed' });
  }
});

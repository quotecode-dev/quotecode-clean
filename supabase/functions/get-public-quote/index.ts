/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isQuoteAcceptanceExpired } from './validity.ts'
import { resolvePublicThanks, type ThanksRow } from './thanks.ts'
import { decideLegacyAccess, outputPhaseOf, parsePublicRequest, serveCapability, serveGrant, UNIFORM_NOT_FOUND, type CapabilityDeps } from './publicAccess.ts'
import { classifyPhaseRead, isMissingFunctionError } from '../_shared/activationPhase.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const SIGNED_URL_EXPIRY_SECONDS = 300;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isValidAttachmentPath(storagePath: unknown, expectedUserId: string, expectedQuoteId: string): boolean {
  if (typeof storagePath !== 'string' || storagePath.length === 0) return false;
  if (storagePath.includes('..') || storagePath.includes('\\')) return false;
  if (storagePath.startsWith('/')) return false;
  const segments = storagePath.split('/');
  if (segments.length !== 2) return false;
  const [ownerSegment, fileSegment] = segments;
  if (ownerSegment !== expectedUserId || !UUID_RE.test(ownerSegment)) return false;
  const fileRe = new RegExp(`^${expectedQuoteId}_\\d+\\.[A-Za-z0-9]{1,10}$`);
  return fileRe.test(fileSegment);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid request body' }, 400);
    }
    // Subscriptions (CROSSCUT §3): exactly one mode - {capability_token} | {output_grant, channel} | {quote_id} (legacy).
    // All decisions live in publicAccess.ts (pure, unit-tested); this shell only performs the reads.
    const request = parsePublicRequest(body);
    if (request.mode === 'bad_request') return jsonResponse(request.res.body, request.res.status);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? '';
    if (!supabaseUrl || !secretKey) {
      console.error('get-public-quote: missing required server configuration');
      return jsonResponse({ error: 'Unable to load quote' }, 400);
    }
    const adminClient = createClient(supabaseUrl, secretKey);

    let callerUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (authHeader && anonKey) {
      try {
        const callerClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data } = await callerClient.auth.getUser();
        callerUserId = data?.user?.id ?? null;
      } catch {
        callerUserId = null;
      }
    }

    if (request.mode === 'malformed') return jsonResponse({ ...UNIFORM_NOT_FOUND.body }, UNIFORM_NOT_FOUND.status);
    // free_issue phase (server read), reported to the page as outputPhase ('off' = subscription schema not applied here).
    const phase = classifyPhaseRead(await adminClient.from('subscription_activation').select('phase').eq('component', 'free_issue').maybeSingle());
    const outputPhase = outputPhaseOf(phase);
    if (!outputPhase) throw new Error('activation phase unavailable');
    // Task 27/28: the owner's thank-you settings, explicit columns, for one verified owner id (a read error throws -> no thanks)
    const readThanksRow = async (ownerId: string): Promise<ThanksRow | null> => {
      const { data, error } = await adminClient.from('business_share_defaults')
        .select('thanks_text, website_url, show_website_after_signature').eq('user_id', ownerId).maybeSingle();
      if (error) throw error;
      return data ?? null;
    };
    if (request.mode === 'capability' || request.mode === 'grant') {
      const deps: CapabilityDeps = {
        resolve: async (hash, op) => {
          const { data, error } = await adminClient.rpc('resolve_public_capability', { p_token_hash: hash, p_op: op });
          if (error) return null; // not deployed / failure -> uniform not-found (never an existence signal)
          return data;
        },
        redeem: async (hash, channel) => {
          const { data, error } = await adminClient.rpc('redeem_output_grant', { p_grant_hash: hash, p_channel: channel });
          if (error) return null;
          return data;
        },
        readSnapshot: async (path) => {
          const { data, error } = await adminClient.storage.from('quote-files').download(path);
          if (error || !data) return null;
          return new Uint8Array(await data.arrayBuffer());
        },
        readLiveQuote: async (id) => {
          const { data, error } = await adminClient.from('quotes').select('user_id, status, signature').eq('id', id).maybeSingle();
          if (error) throw error;
          return data ?? null;
        },
        readLogo: async (path) => {
          const { data, error } = await adminClient.storage.from('quote-files').download(path);
          if (error || !data) return null;
          return new Uint8Array(await data.arrayBuffer());
        },
        readThanksRow,
        callerUserId,
        outputPhase,
        onIncident: (code) => console.error(`get-public-quote: ${code}`),
      };
      const r = request.mode === 'capability' ? await serveCapability(deps, request.token) : await serveGrant(deps, request.grant, request.channel);
      return jsonResponse(r.body, r.status);
    }
    const quoteId = request.quoteId;

    // Legacy id mode: unchanged while free_issue is not enforced ('absent' = the subscription schema is not applied here).
    // Enforced: only the verified owner (owner preview, non-consuming) or an is_legacy_public_quote id; everything else gets
    // the SAME 404 as an unknown id. The same two lookups run for every id before deciding (no enumeration oracle).
    // Continuation (D): a quote issued through the output authority stays capability-scoped in every phase (rollback-safe).
    const scopedRes = await adminClient.rpc('is_capability_scoped_quote', { p_quote_id: quoteId });
    if (scopedRes.error && !isMissingFunctionError(scopedRes.error)) throw new Error('capability scope check unavailable');
    const capabilityScoped = !scopedRes.error && scopedRes.data === true;
    if (phase === 'enforced' || capabilityScoped) {
      const [legacyRes, ownerRes] = await Promise.all([
        phase === 'enforced' ? adminClient.rpc('is_legacy_public_quote', { p_quote_id: quoteId }) : Promise.resolve({ data: false, error: null }),
        adminClient.from('quotes').select('user_id').eq('id', quoteId).maybeSingle(),
      ]);
      if (legacyRes.error || ownerRes.error) throw new Error('legacy link check unavailable');
      const decision = decideLegacyAccess({ phase, isLegacy: legacyRes.data, callerUserId, quoteOwnerId: ownerRes.data?.user_id ?? null, capabilityScoped });
      if (decision !== 'serve') return jsonResponse({ ...UNIFORM_NOT_FOUND.body }, UNIFORM_NOT_FOUND.status);
    }

    // עדכון 2026-08-28 (Quote Number Transition audit): quote_number כבר
    // קיים בסביבה החיה כעמודה integer NOT NULL (global sequence, לא ה-
    // migration של המאגר הזה - ר' PROFLOW_TODO.md item 17), כך שה-select
    // הזה מצליח מבחינה טכנית ברגע שהפונקציה הזו עצמה נפרסת מחדש.
    //
    // עדכון 2026-08-31 (Path B - get-public-quote Warranty-only fix):
    // attn_name/attn_role הוסרו במכוון מה-select ומהתגובה. עמודות אלו
    // עדיין לא קיימות בסביבה החיה (item 18, migration לא הוחל) - כלילתן
    // כאן הייתה גורמת ל-select כולו להיכשל על כל בקשה (PostgREST דוחה
    // עמודה לא קיימת), כלומר מפילה את כל דף ה-Public Quote בשני השווקים.
    // ההחזרה שלהן תתבצע בפריסה נפרדת לאחר שה-migration של item 18 יוחל
    // על הסביבה החיה - לא כאן, לא כחלק מהתיקון הממוקד הזה.
    // חוק ברזל (Smart Quote Guided UX Completion task, Part E - customer-
    // facing structured display): נסיון-ראשון כולל את שדות/טבלאות ה-
    // Professional Quotes המובנים (project_name/quote_sections, ו-quote_
    // items.pricing_unit/calculated_quantity/quantity_source/specification/
    // section_id + quote_item_measurements) - קיימים היום ב-TEST בלבד (ר'
    // supabase/migrations/2026090[234]...). PostgREST דוחה select שלם אם
    // עמודה/יחס כלשהו בו לא קיים (לא רק את החלק החסר) - כך שנסיון-חוזר
    // ל-select השטוח המקורי, בזיהוי-מדויק של הודעת-שגיאת עמודה/יחס-חסרים
    // בלבד (לא בליעת שגיאות אחרות), הוא הכרחי כדי שהפונקציה הזו תמשיך
    // לעבוד ללא שינוי בכל סביבה שעדיין לא קיבלה את אותן migrations (למשל
    // Production, נכון לתאריך המשימה הזו) - זהה לעיקרון שכבר הוקם ב-
    // Dashboard.jsx (isMissingAttnColumnError וכו').
    const richSelect = `
      id, user_id, created_at, valid_until, tax_rate, subtotal, total,
      discount, terms, warranty, notes, subject, status, signature, currency, client_type,
      quote_number, attn_name, attn_role, project_name,
      clients ( company_name, email, phone, address ),
      quote_sections ( id, name, sort_order ),
      quote_items ( description, quantity, unit_price, total_price, price_missing, pricing_unit, calculated_quantity, quantity_source, specification, section_id, calculation_method, sort_order, quote_item_measurements ( width, height, unit, calculated_area, label, sort_order, is_pricing_driving ) )
    `;
    const flatSelect = `
      id, user_id, created_at, valid_until, tax_rate, subtotal, total,
      discount, terms, warranty, notes, subject, status, signature, currency, client_type,
      quote_number, attn_name, attn_role,
      clients ( company_name, email, phone, address ),
      quote_items ( description, quantity, unit_price, total_price )
    `;

    let quote: any;
    let quoteErr: any;
    ({ data: quote, error: quoteErr } = await adminClient
      .from('quotes')
      .select(richSelect)
      .eq('id', quoteId)
      .maybeSingle());

    const isMissingStructuredFieldError = (err: any) => {
      const msg = String(err?.message || '');
      return ['project_name', 'quote_sections', 'pricing_unit', 'calculated_quantity', 'quantity_source', 'specification', 'section_id', 'calculation_method', 'sort_order', 'quote_item_measurements']
        .some((col) => msg.includes(col));
    };

    if (quoteErr && isMissingStructuredFieldError(quoteErr)) {
      ({ data: quote, error: quoteErr } = await adminClient
        .from('quotes')
        .select(flatSelect)
        .eq('id', quoteId)
        .maybeSingle());
    }

    if (quoteErr) throw quoteErr;
    if (!quote) return jsonResponse({ error: 'Quote not found' }, 404);

    const { data: bizRow } = await adminClient
      .from('business_settings')
      .select('business_name, logo_url, tax_id, email, phone, address, currency, country')
      .eq('user_id', quote.user_id)
      .maybeSingle();

    // חוק ברזל (Signature Product/Security Contract Correction, systemic
    // remediation continuation task, 2026-09-09): public_approve_quote
    // (20260909000000) now rejects only THIS QUOTE'S OWN OWNER, not any
    // authenticated business account - the prior broader UI gate
    // (caller_is_business_account, any business account at all) blocked
    // legitimate customers who also hold their own TEKANGO business
    // account, a real product dead-end the Owner directly hit and
    // reported. is_owner_viewing is the only signal the UI needs now - it
    // already, correctly, mirrors the RPC's own (corrected) predicate
    // exactly. Never used to bypass or weaken the RPC's own enforcement -
    // the RPC remains the sole source of truth for the actual
    // authorization decision; this flag is advisory-only for the UI.
    const isOwner = Boolean(callerUserId && callerUserId === quote.user_id);

    // Task 27 (spec §6): the owner's optional thank-you - read ONLY for a quote the server holds as signed; a missing table (migration
    // 20261011110000 not applied) or any read failure simply means no thank-you (the quote itself is never affected).
    const thanks = await resolvePublicThanks(quote, quote.user_id, readThanksRow);

    const { data: attachmentRows } = await adminClient
      .from('quote_attachments')
      .select('file_name, storage_path')
      .eq('quote_id', quoteId);

    const attachments: { file_name: string; url: string }[] = [];
    for (const att of attachmentRows || []) {
      if (!isValidAttachmentPath(att.storage_path, quote.user_id, quoteId)) continue;
      const { data: signed } = await adminClient
        .storage.from('quote-files')
        .createSignedUrl(att.storage_path, SIGNED_URL_EXPIRY_SECONDS);
      if (signed?.signedUrl) {
        attachments.push({ file_name: att.file_name, url: signed.signedUrl });
      }
    }

    return jsonResponse({
      quote: {
        id: quote.id,
        quote_number: quote.quote_number,
        attn_name: quote.attn_name,
        attn_role: quote.attn_role,
        created_at: quote.created_at,
        valid_until: quote.valid_until,
        tax_rate: quote.tax_rate,
        subtotal: quote.subtotal,
        total: quote.total,
        discount: quote.discount,
        terms: quote.terms,
        warranty: quote.warranty,
        notes: quote.notes,
        subject: quote.subject,
        status: quote.status,
        signature: quote.signature,
        currency: quote.currency,
        client_type: quote.client_type,
        is_owner_viewing: isOwner,
        // OD-1: server truth for "may this quote still be accepted?" (the page falls back to the same rule when absent)
        // PRODUCT_TRUTH_CAPABILITY: public_quote_sign
        is_expired: isQuoteAcceptanceExpired(quote.valid_until, bizRow?.country),
        // חוק ברזל (Part E): undefined כשה-select השטוח-בלבד רץ (עמודה
        // לא קיימת בסביבה זו) - PublicQuote.jsx/PublicQuoteEn.jsx מתייחסים
        // ל-undefined בדיוק כמו "אין פרויקט", לא שגיאה.
        project_name: quote.project_name,
      },
      business: bizRow ? {
        business_name: bizRow.business_name, logo_url: bizRow.logo_url, tax_id: bizRow.tax_id,
        email: bizRow.email, phone: bizRow.phone, address: bizRow.address, currency: bizRow.currency,
      } : null,
      client: quote.clients ? {
        company_name: quote.clients.company_name, email: quote.clients.email,
        phone: quote.clients.phone, address: quote.clients.address,
      } : null,
      // חוק ברזל (Part E): [] כשה-select השטוח-בלבד רץ - זהה-בייט ל"אין
      // קבוצות" הקיים, לא שדה חסר/undefined.
      sections: (quote.quote_sections || []).slice().sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((s: any) => ({ id: s.id, name: s.name })),
      items: (quote.quote_items || []).slice().sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)).map((i: any) => ({
        description: i.description, quantity: i.quantity, price: i.unit_price, total_price: i.total_price,
        // Task 35 (F4): the flag only when true - every existing response stays byte-identical
        ...(i.price_missing === true ? { price_missing: true } : {}),
        // חוק ברזל (Part E, customer-facing structured display): כל השדות
        // הבאים undefined/[] עבור פריט שטוח (ללא pricing_unit) - זהה-בייט
        // לתצוגה השטוחה הקיימת; PublicQuote.jsx/PublicQuoteEn.jsx חייבים
        // להתייחס להיעדרם כ"פריט רגיל", לא לשגיאה.
        pricing_unit: i.pricing_unit,
        calculated_quantity: i.calculated_quantity,
        quantity_source: i.quantity_source,
        calculation_method: i.calculation_method,
        specification: Array.isArray(i.specification) ? i.specification : [],
        section_id: i.section_id,
        measurements: (i.quote_item_measurements || []).slice().sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((m: any) => ({ width: m.width, height: m.height, unit: m.unit, calculated_area: m.calculated_area, label: m.label, is_pricing_driving: m.is_pricing_driving !== false })),
      })),
      attachments,
      // Subscriptions (allowlisted): the page picks the final PDF / Print path from these, never from a client flag
      viewerIsOwner: isOwner,
      outputPhase,
      thanks,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('get-public-quote error:', message);
    return jsonResponse({ error: 'Unable to load quote' }, 400);
  }
});

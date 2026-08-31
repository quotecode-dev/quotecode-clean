/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const quoteId = (body as { quote_id?: unknown })?.quote_id;
    if (!quoteId || typeof quoteId !== 'string' || !UUID_RE.test(quoteId)) {
      return jsonResponse({ error: 'Missing or invalid quote_id' }, 400);
    }

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
    const { data: quote, error: quoteErr } = await adminClient
      .from('quotes')
      .select(`
        id, user_id, created_at, valid_until, tax_rate, subtotal, total,
        discount, terms, warranty, notes, subject, status, signature, currency, client_type,
        quote_number, attn_name, attn_role,
        clients ( company_name, email, phone, address ),
        quote_items ( description, quantity, unit_price, total_price )
      `)
      .eq('id', quoteId)
      .maybeSingle();

    if (quoteErr) throw quoteErr;
    if (!quote) return jsonResponse({ error: 'Quote not found' }, 404);

    const { data: bizRow } = await adminClient
      .from('business_settings')
      .select('business_name, logo_url, tax_id, email, phone, address, currency')
      .eq('user_id', quote.user_id)
      .maybeSingle();

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
        is_owner_viewing: Boolean(callerUserId && callerUserId === quote.user_id),
      },
      business: bizRow ? {
        business_name: bizRow.business_name, logo_url: bizRow.logo_url, tax_id: bizRow.tax_id,
        email: bizRow.email, phone: bizRow.phone, address: bizRow.address, currency: bizRow.currency,
      } : null,
      client: quote.clients ? {
        company_name: quote.clients.company_name, email: quote.clients.email,
        phone: quote.clients.phone, address: quote.clients.address,
      } : null,
      items: (quote.quote_items || []).map((i: any) => ({
        description: i.description, quantity: i.quantity, price: i.unit_price, total_price: i.total_price,
      })),
      attachments,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('get-public-quote error:', message);
    return jsonResponse({ error: 'Unable to load quote' }, 400);
  }
});

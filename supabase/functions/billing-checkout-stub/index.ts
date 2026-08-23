/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==========================================
// 🚨 זהו שלד (stub) בלבד להכנת התשתית לחיוב עתידי דרך Stripe והפקת
// חשבוניות רגיוניות - הוא אינו מבצע חיוב אמיתי ואינו קורא ל-Stripe API
// בפועל. הוא קיים כדי לקבע במקום אחד, מלכתחילה, את הנקודות המדויקות
// שבהן אינטגרציה אמיתית תתחבר: זיהוי אזור/מטבע/מע"מ של העסק, יצירת
// checkout session, וטיפול ב-webhook. ראו INVOICING_INFRASTRUCTURE.md
// לתיעוד המלא של הארכיטקטורה המתוכננת ולסדר הצעדים להשלמת האינטגרציה.
//
// חוקי האזור כאן הם עותק מכוון (לא import) של REGION_RULES מ-
// src/utils/regionConfig.js - כל Edge Function בפרויקט הזה עצמאי ולא
// תלוי בקוד ה-Vite/React (ראו למשל send-trial-expiration-email), כדי
// שהפריסה של כל פונקציה תישאר בלתי תלויה בשאר. אם REGION_RULES משתנה
// אי פעם (לא סביר - הוא קפוא בכוונה), יש לעדכן גם כאן.
// ==========================================

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

type RegionBillingProfile = {
  countryCode: 'Local' | 'International';
  currencyCode: 'ILS' | 'USD';
  vatRate: number;
  vatPercentLabel: string;
  language: 'he' | 'en';
  isExportVatExempt: boolean;
};

// זהה במפורש ל-getRegionBillingProfile ב-src/utils/regionConfig.js
function getRegionBillingProfile(country: string | null | undefined): RegionBillingProfile {
  const isInternational = country === 'International';
  return {
    countryCode: isInternational ? 'International' : 'Local',
    currencyCode: isInternational ? 'USD' : 'ILS',
    vatRate: isInternational ? 0.00 : 0.18,
    vatPercentLabel: isInternational ? '0%' : '18%',
    language: isInternational ? 'en' : 'he',
    isExportVatExempt: isInternational,
  };
}

// שלד לחישוב שורת חשבונית בודדת לפי אזור - זו הנקודה שבה ספק חשבוניות
// אמיתי (INVOICE_API_KEY) ייקרא בעתיד. כרגע רק מחזיר את המבנה/החישוב
// בלי לשלוח דבר לשום API חיצוני.
function buildRegionalInvoiceLineItem(
  { description, unitPriceCents, quantity, billingProfile }:
  { description: string; unitPriceCents: number; quantity: number; billingProfile: RegionBillingProfile }
) {
  const subtotalCents = unitPriceCents * quantity;
  const vatCents = Math.round(subtotalCents * billingProfile.vatRate);
  const totalCents = subtotalCents + vatCents;

  return {
    description,
    quantity,
    currency: billingProfile.currencyCode,
    unitPriceCents,
    subtotalCents,
    vatRate: billingProfile.vatRate,
    vatCents,
    totalCents,
    vatNote: billingProfile.isExportVatExempt
      ? 'Export of services - 0% VAT (Israeli law exemption for non-resident customers)'
      : 'Includes 18% Israeli VAT',
  };
}

// שלד ליצירת "checkout session" - בפריסה אמיתית, כאן ייווצר סופית אובייקט
// Stripe Checkout Session אמיתי (stripe.checkout.sessions.create) עם
// currency/tax_rates שנגזרים מ-billingProfile, לא קבועים מראש.
//
//   import Stripe from 'npm:stripe@^16';
//   const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '');
//   const session = await stripe.checkout.sessions.create({
//     mode: 'subscription',
//     line_items: [{ price: priceIdFor(planId, billingProfile.currencyCode), quantity: 1 }],
//     customer_email: businessEmail,
//     success_url: `${origin}/dashboard?checkout=success`,
//     cancel_url: `${origin}/dashboard?checkout=cancelled`,
//     automatic_tax: { enabled: !billingProfile.isExportVatExempt },
//   });
//   return jsonResponse({ checkoutUrl: session.url }, 200);
function buildStubCheckoutResponse(
  { planId, billingProfile }: { planId: string; billingProfile: RegionBillingProfile }
) {
  return {
    stub: true,
    message: 'Stripe is not connected yet - this is a scaffold response. See INVOICING_INFRASTRUCTURE.md.',
    wouldCreateCheckoutFor: {
      planId,
      currency: billingProfile.currencyCode,
      vatRate: billingProfile.vatRate,
      language: billingProfile.language,
    },
    checkoutUrl: null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, userId, planId, invoiceLineItem } = body;

    if (!userId || typeof userId !== 'string') {
      return jsonResponse({ error: 'Missing or invalid "userId"' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // אימות בעלות: הקורא חייב להיות המשתמש עצמו (userId תואם ל-JWT שלו) או
    // super_admin - אחרת כל משתמש מחובר היה יכול לבקש נתוני חיוב/אזור של
    // כל עסק אחר רק ע"י ציון userId שונה. גם בשלד/template חשוב שהדוגמה
    // תהיה בטוחה כברירת מחדל, לא רק "יעבוד".
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser();
    if (callerAuthErr || !callerUser) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }
    if (callerUser.id !== userId) {
      const { data: callerBiz } = await adminClient.from('business_settings').select('role').eq('user_id', callerUser.id).maybeSingle();
      if (callerBiz?.role !== 'super_admin') {
        return jsonResponse({ error: 'Forbidden: you may only request your own billing profile' }, 403);
      }
    }

    const { data: biz, error: bizErr } = await adminClient
      .from('business_settings')
      .select('country, email, business_name')
      .eq('user_id', userId)
      .maybeSingle();

    if (bizErr) {
      return jsonResponse({ error: `Failed to look up business: ${bizErr.message}` }, 500);
    }
    if (!biz) {
      return jsonResponse({ error: 'No business_settings row for this userId' }, 404);
    }

    const billingProfile = getRegionBillingProfile(biz.country);

    if (action === 'invoice_line_item') {
      if (!invoiceLineItem || typeof invoiceLineItem.unitPriceCents !== 'number') {
        return jsonResponse({ error: 'Missing or invalid "invoiceLineItem"' }, 400);
      }
      const lineItem = buildRegionalInvoiceLineItem({
        description: invoiceLineItem.description || 'ProFlow subscription',
        unitPriceCents: invoiceLineItem.unitPriceCents,
        quantity: invoiceLineItem.quantity || 1,
        billingProfile,
      });
      return jsonResponse({ billingProfile, lineItem }, 200);
    }

    // ברירת מחדל: שלד יצירת checkout
    if (!planId || typeof planId !== 'string') {
      return jsonResponse({ error: 'Missing or invalid "planId"' }, 400);
    }
    const checkout = buildStubCheckoutResponse({ planId, billingProfile });
    return jsonResponse({ billingProfile, checkout }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('billing-checkout-stub error:', message);
    return jsonResponse({ error: message }, 400);
  }
});

/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==========================================
// 🚨 חוק ברזל קשיח: זוהי הדרך הפריבילגית היחידה למחוק את עץ ההצעות (quotes +
// quote_items + quote_attachments) של משתמש אחר, לצורך בניית בסיס TEST נקי.
// לעולם לא נוגעת ב-clients/services/expenses/business_settings/auth.users -
// אלה נשארים בכוונה (ר' PROFLOW STABILIZATION STAGE 1). ה-RLS הרגיל
// (auth.uid() = user_id) נשאר קשיח ובלתי-פגום - הפונקציה הזו היא הדרך
// היחידה שמורשית לחצות בעלות, ורק אחרי אימות server-side אמיתי ש-הקורא
// הוא super_admin. לעולם לא לסמוך על טענת "isAdmin" מהקליינט.
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

// deno-lint-ignore no-explicit-any
async function deleteAndCount(adminClient: any, table: string, applyFilter: (q: any) => any, label: string): Promise<number> {
  // .select('id') אחרי delete() מחזיר את השורות שבאמת נמחקו (לא רק "אין שגיאה") -
  // זה בדיוק התיקון לבאג שגילינו: DELETE שמסונן ל-0 שורות (RLS/היקף שגוי) חוזר
  // בלי error, ולכן אסור לעולם להסתפק בבדיקת error בלבד כדי לדווח הצלחה.
  const { data, error } = await applyFilter(adminClient.from(table).delete().select('id'));
  if (error) {
    throw new Error(`Failed to delete ${label} (table: ${table}): ${error.message}`);
  }
  return (data || []).length;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const targetUserId = (body as { targetUserId?: unknown })?.targetUserId;
    if (!targetUserId || typeof targetUserId !== 'string') {
      return jsonResponse({ error: 'Missing or invalid targetUserId' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? '';
    if (!supabaseUrl || !secretKey) {
      console.error('admin-cleanup-user-quotes: missing required server configuration');
      return jsonResponse({ error: 'Server misconfiguration' }, 500);
    }

    // לקוח שמזהה את הקורא בפועל דרך ה-JWT שלו (לא ניתן לזייף מהקליינט) -
    // אותו דפוס מדויק כמו admin-delete-user.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser();
    if (callerAuthErr || !callerUser) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }

    // לקוח מורשה (secret/service key) - היחיד שיכול לבצע מחיקות חוצות-משתמשים.
    // לעולם לא נחשף ללקוח - קיים רק כאן, בצד השרת.
    const adminClient = createClient(supabaseUrl, secretKey);

    // אימות שהקורא הוא בפועל super_admin - לעולם לא סומכים על טענת הקליינט בלבד.
    // אותו דפוס מדויק כמו admin-delete-user.
    const { data: callerBiz, error: callerBizErr } = await adminClient
      .from('business_settings')
      .select('role')
      .eq('user_id', callerUser.id)
      .maybeSingle();

    if (callerBizErr) {
      return jsonResponse({ error: `Failed to verify caller permissions: ${callerBizErr.message}` }, 500);
    }
    if (callerBiz?.role !== 'super_admin') {
      return jsonResponse({ error: 'Forbidden: super_admin role required' }, 403);
    }

    // שלב 1: מוצאים את מזהי ההצעות של המשתמש היעד - זה גם התוצאה "quotesFound"
    // וגם הבסיס למחיקת הילדים (quote_items/quote_attachments).
    const { data: userQuotes, error: quotesFetchErr } = await adminClient
      .from('quotes')
      .select('id')
      .eq('user_id', targetUserId);

    if (quotesFetchErr) {
      return jsonResponse({ error: `Failed to look up quotes to delete: ${quotesFetchErr.message}` }, 500);
    }

    const quoteIds = (userQuotes || []).map((q: { id: string }) => q.id);
    const quotesFound = quoteIds.length;

    // אין הצעות למשתמש הזה - תוצאה תקינה, אידמפוטנטית, בלי לגעת בשום דבר אחר.
    if (quotesFound === 0) {
      return jsonResponse({
        success: true,
        targetUserId,
        quotesFound: 0,
        quotesDeleted: 0,
        quoteItemsDeleted: 0,
        quoteAttachmentsDeleted: 0,
        remainingQuotes: 0,
      }, 200);
    }

    let quoteItemsDeleted = 0;
    let quoteAttachmentsDeleted = 0;
    let quotesDeleted = 0;

    try {
      quoteItemsDeleted = await deleteAndCount(adminClient, 'quote_items', (q) => q.in('quote_id', quoteIds), 'quote line items');
      quoteAttachmentsDeleted = await deleteAndCount(adminClient, 'quote_attachments', (q) => q.in('quote_id', quoteIds), 'quote attachments');
      quotesDeleted = await deleteAndCount(adminClient, 'quotes', (q) => q.eq('user_id', targetUserId), 'quotes');
    } catch (deleteErr: unknown) {
      const message = deleteErr instanceof Error ? deleteErr.message : 'Unknown error while deleting quote data';
      // כישלון חלקי: לא מדווחים הצלחה בשום מקרה, ומחזירים בדיוק כמה נמחק עד כה
      // כדי שהקורא ידע את מצב הביניים המדויק (retry על אותו targetUserId בטוח -
      // כל שלב מסונן ל-quote_id-ים/user_id שכבר לא קיימים פשוט לא ימחק כלום שוב).
      return jsonResponse({
        error: message,
        targetUserId,
        quotesFound,
        quoteItemsDeleted,
        quoteAttachmentsDeleted,
        quotesDeleted,
      }, 500);
    }

    // אימות בפועל, לא רק "אין error": קוראים מחדש כמה הצעות עדיין קיימות
    // למשתמש היעד. זה בדיוק התיקון לבאג שהתגלה - "הצלחה" נקבעת רק לפי מצב
    // אמיתי שנקרא-מחדש מהמסד, לעולם לא לפי היעדר שגיאה בלבד.
    const { data: remainingRows, error: verifyErr } = await adminClient
      .from('quotes')
      .select('id')
      .eq('user_id', targetUserId);

    if (verifyErr) {
      return jsonResponse({
        error: `Deletion completed but post-delete verification failed: ${verifyErr.message}`,
        targetUserId,
        quotesFound,
        quotesDeleted,
        quoteItemsDeleted,
        quoteAttachmentsDeleted,
      }, 500);
    }

    const remainingQuotes = (remainingRows || []).length;

    if (remainingQuotes > 0) {
      return jsonResponse({
        error: `Verification failed: ${remainingQuotes} quote(s) still remain for this user after deletion.`,
        targetUserId,
        quotesFound,
        quotesDeleted,
        quoteItemsDeleted,
        quoteAttachmentsDeleted,
        remainingQuotes,
      }, 500);
    }

    return jsonResponse({
      success: true,
      targetUserId,
      quotesFound,
      quotesDeleted,
      quoteItemsDeleted,
      quoteAttachmentsDeleted,
      remainingQuotes: 0,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('admin-cleanup-user-quotes error:', message);
    return jsonResponse({ error: message }, 400);
  }
});

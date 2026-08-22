/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==========================================
// 🚨 חוק ברזל קשיח: פונקציה זו היא הדרך היחידה למחוק משתמש לחלוטין מהמערכת.
// מחיקה כוללת: כל נתוני העסק (הצעות/פריטים/קבצים/לקוחות/שירותים/הוצאות),
// שורת business_settings, וחשבון ה-Auth עצמו - כדי שהאימייל יתפנה להרשמה חוזרת.
// חובה להשתמש ב-Service Role Key (זמין רק כאן, בצד השרת) - supabase.auth.admin
// אינו נגיש כלל מהקליינט עם ה-anon key.
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
async function deleteOrThrow(adminClient: any, table: string, applyFilter: (q: any) => any, label: string) {
  const { error } = await applyFilter(adminClient.from(table).delete());
  if (error) {
    throw new Error(`Failed to delete ${label} (table: ${table}): ${error.message}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { targetUserId } = await req.json();
    if (!targetUserId || typeof targetUserId !== 'string') {
      return jsonResponse({ error: 'Missing or invalid targetUserId' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // לקוח שמזהה את הקורא בפועל דרך ה-JWT שלו (לא ניתן לזייף מהקליינט)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser();
    if (callerAuthErr || !callerUser) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }

    // לקוח מורשה (Service Role) - היחיד שיכול לבצע מחיקות חוצות-משתמשים ומחיקת Auth
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // אימות שהקורא הוא בפועל super_admin - לעולם לא סומכים על טענת הקליינט בלבד
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

    // הגנה מפני מחיקת חשבון Super Admin אחר
    const { data: targetBiz, error: targetBizErr } = await adminClient
      .from('business_settings')
      .select('id, role')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (targetBizErr) {
      return jsonResponse({ error: `Failed to look up target account: ${targetBizErr.message}` }, 500);
    }
    if (targetBiz?.role === 'super_admin') {
      return jsonResponse({ error: 'Cannot delete a Super Admin account' }, 400);
    }

    // מחיקה מדורגת של כל נתוני העסק, באותו סדר תלות כמו src/shared/wipeUserData.js
    const { data: userQuotes, error: quotesFetchErr } = await adminClient
      .from('quotes')
      .select('id')
      .eq('user_id', targetUserId);

    if (quotesFetchErr) {
      return jsonResponse({ error: `Failed to look up quotes to delete: ${quotesFetchErr.message}` }, 500);
    }

    const quoteIds = (userQuotes || []).map((q: { id: string }) => q.id);

    try {
      if (quoteIds.length > 0) {
        await deleteOrThrow(adminClient, 'quote_items', (q) => q.in('quote_id', quoteIds), 'quote line items');
        await deleteOrThrow(adminClient, 'quote_attachments', (q) => q.in('quote_id', quoteIds), 'quote attachments');
      }
      await deleteOrThrow(adminClient, 'quotes', (q) => q.eq('user_id', targetUserId), 'quotes');
      await deleteOrThrow(adminClient, 'clients', (q) => q.eq('user_id', targetUserId), 'clients');
      await deleteOrThrow(adminClient, 'services', (q) => q.eq('user_id', targetUserId), 'services');
      await deleteOrThrow(adminClient, 'expenses', (q) => q.eq('user_id', targetUserId), 'expenses');

      if (targetBiz?.id) {
        const { error: bizDelErr } = await adminClient.from('business_settings').delete().eq('id', targetBiz.id);
        if (bizDelErr) throw new Error(`Failed to delete business_settings: ${bizDelErr.message}`);
      }
    } catch (wipeErr: unknown) {
      const message = wipeErr instanceof Error ? wipeErr.message : 'Unknown error while deleting business data';
      return jsonResponse({ error: message }, 500);
    }

    // מחיקת חשבון ה-Auth עצמו - זו הפעולה שמאפשרת הרשמה חוזרת באותו אימייל.
    // מבוצעת אחרונה בכוונה: אם המחיקה הזו נכשלת, כל נתוני העסק כבר נמחקו בהצלחה,
    // ועדיף להשאיר חשבון Auth "יתום" (שניתן לנסות למחוק שוב) מאשר להשאיר נתונים חלקיים.
    const { error: authDelErr } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (authDelErr) {
      return jsonResponse({ error: `Business data deleted, but failed to delete the Auth account: ${authDelErr.message}` }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('admin-delete-user error:', message);
    return jsonResponse({ error: message }, 400);
  }
});

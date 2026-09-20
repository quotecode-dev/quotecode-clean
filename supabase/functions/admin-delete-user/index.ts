/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claimReauthProof, writeAuditLog } from "../_shared/adminReauth.ts";

// ==========================================
// 🚨 חוק ברזל קשיח: פונקציה זו היא הדרך היחידה למחוק משתמש לחלוטין מהמערכת.
// מחיקה כוללת: כל נתוני העסק (הצעות/פריטים/קבצים/לקוחות/שירותים/הוצאות),
// שורת business_settings, וחשבון ה-Auth עצמו - כדי שהאימייל יתפנה להרשמה חוזרת.
// חובה להשתמש ב-Service Role Key (זמין רק כאן, בצד השרת) - supabase.auth.admin
// אינו נגיש כלל מהקליינט עם ה-anon key.
//
// TEKANGO Admin V1 (Task 3.5, Delete Account lifecycle audit): two real
// gaps found in the prior version of this function and closed here:
// (1) uploaded quote attachments live in Storage bucket 'quote-files'
// under `${userId}/...` (Dashboard.jsx's own upload path) and were never
// removed - only the `quote_attachments` DB rows were; (2) `chat_logs` is
// keyed by `user_email` (no FK/cascade to auth.users) and was never
// cleaned, so it would survive deletion and could resurface under a
// re-registered account with the same email - exactly the scenario this
// function's own deletion exists to enable safely. `quotecode_documents`
// (a separate, legacy, publicly-readable document-sharing table with a
// free-text `user_id` column, no FK) is cleaned on a best-effort basis and
// disclosed in the outcome - not silently skipped, not guaranteed.
// `quote_sections`/`quote_item_measurements`/`business_quote_sequences`
// are NOT handled here - all three already have `ON DELETE CASCADE`
// foreign keys (into quotes/quote_items/auth.users respectively), so they
// clean up automatically.
//
// Now also requires a claimed re-auth proof (admin-reauth-verify) for the
// delete_user action bound to this exact target - see
// _shared/adminReauth.ts. The DB-level protections already in place
// (server-side role re-verification below, Super-Admin-target refusal)
// are unchanged and remain in force independently of the proof check.
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
    const body = await req.json().catch(() => null);
    const targetUserId = (body as { targetUserId?: unknown })?.targetUserId;
    const proofToken = (body as { proofToken?: unknown })?.proofToken;
    const reason = (body as { reason?: unknown })?.reason;
    if (!targetUserId || typeof targetUserId !== 'string') {
      return jsonResponse({ error: 'Missing or invalid targetUserId' }, 400);
    }
    if (typeof reason !== 'string' || !reason.trim()) {
      return jsonResponse({ error: 'A reason is required for this protected action.' }, 400);
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

    const action = 'delete_user';
    const proof = await claimReauthProof({
      adminClient, proofToken, actorUserId: callerUser.id, action, targetUserId, params: { reason },
    });
    if (!proof.ok) return jsonResponse({ error: proof.error }, 403);

    // הגנה מפני מחיקת חשבון Super Admin אחר
    const { data: targetBiz, error: targetBizErr } = await adminClient
      .from('business_settings')
      .select('id, role, email')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (targetBizErr) {
      return jsonResponse({ error: `Failed to look up target account: ${targetBizErr.message}` }, 500);
    }
    if (targetBiz?.role === 'super_admin') {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, outcome: 'denied' });
      return jsonResponse({ error: 'Cannot delete a Super Admin account' }, 400);
    }
    if (!targetBiz) {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, outcome: 'denied' });
      return jsonResponse({ error: 'Target account not found.' }, 404);
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
    let quoteFilesRemoved = 0;
    let quotecodeDocumentsRemoved: number | 'unavailable' = 0;

    try {
      if (quoteIds.length > 0) {
        await deleteOrThrow(adminClient, 'quote_items', (q) => q.in('quote_id', quoteIds), 'quote line items');
        await deleteOrThrow(adminClient, 'quote_attachments', (q) => q.in('quote_id', quoteIds), 'quote attachments');
      }
      await deleteOrThrow(adminClient, 'quotes', (q) => q.eq('user_id', targetUserId), 'quotes');
      await deleteOrThrow(adminClient, 'clients', (q) => q.eq('user_id', targetUserId), 'clients');
      await deleteOrThrow(adminClient, 'services', (q) => q.eq('user_id', targetUserId), 'services');
      await deleteOrThrow(adminClient, 'expenses', (q) => q.eq('user_id', targetUserId), 'expenses');

      // Storage: uploaded quote attachments live under `${userId}/...` in
      // the 'quote-files' bucket (see Dashboard.jsx's own upload path) -
      // DB rows above are gone, but the actual files were not, until now.
      const { data: storedFiles, error: storageListErr } = await adminClient
        .storage.from('quote-files').list(targetUserId, { limit: 1000 });
      if (storageListErr) {
        throw new Error(`Failed to list Storage objects for this user: ${storageListErr.message}`);
      }
      if (storedFiles && storedFiles.length > 0) {
        const paths = storedFiles.map((f: { name: string }) => `${targetUserId}/${f.name}`);
        const { error: storageRemoveErr } = await adminClient.storage.from('quote-files').remove(paths);
        if (storageRemoveErr) {
          throw new Error(`Failed to delete Storage objects: ${storageRemoveErr.message}`);
        }
        quoteFilesRemoved = paths.length;
      }

      // chat_logs has no FK to auth.users (keyed by user_email only) - best
      // real join key available. Skipped gracefully if the target has no
      // stored email (should not normally happen).
      if (targetBiz.email) {
        await deleteOrThrow(adminClient, 'chat_logs', (q) => q.eq('user_email', targetBiz.email), 'AI chat logs');
      }

      // quotecode_documents: legacy, separate document-sharing table with
      // a free-text user_id column (no FK) - best-effort cleanup, disclosed
      // in the response rather than silently attempted/ignored.
      const { data: qcdRows, error: qcdErr } = await adminClient
        .from('quotecode_documents').delete().eq('user_id', targetUserId).select('id');
      quotecodeDocumentsRemoved = qcdErr ? 'unavailable' : (qcdRows || []).length;

      if (targetBiz?.id) {
        const { error: bizDelErr } = await adminClient.from('business_settings').delete().eq('id', targetBiz.id);
        if (bizDelErr) throw new Error(`Failed to delete business_settings: ${bizDelErr.message}`);
      }
    } catch (wipeErr: unknown) {
      const message = wipeErr instanceof Error ? wipeErr.message : 'Unknown error while deleting business data';
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, outcome: 'error' });
      return jsonResponse({ error: message }, 500);
    }

    // מחיקת חשבון ה-Auth עצמו - זו הפעולה שמאפשרת הרשמה חוזרת באותו אימייל.
    // מבוצעת אחרונה בכוונה: אם המחיקה הזו נכשלת, כל נתוני העסק כבר נמחקו בהצלחה,
    // ועדיף להשאיר חשבון Auth "יתום" (שניתן לנסות למחוק שוב) מאשר להשאיר נתונים חלקיים.
    const { error: authDelErr } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (authDelErr) {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, outcome: 'error' });
      return jsonResponse({ error: `Business data deleted, but failed to delete the Auth account: ${authDelErr.message}` }, 500);
    }

    await writeAuditLog({
      adminClient, actorUserId: callerUser.id, targetUserId, action, reason,
      afterState: { quoteFilesRemoved, quotecodeDocumentsRemoved }, outcome: 'success',
    });

    return jsonResponse({ success: true, quoteFilesRemoved, quotecodeDocumentsRemoved }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('admin-delete-user error:', message);
    return jsonResponse({ error: message }, 400);
  }
});

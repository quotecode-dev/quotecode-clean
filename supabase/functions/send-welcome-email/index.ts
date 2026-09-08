// חוק ברזל (Orphan Edge Function Recovery, systemic remediation task,
// 2026-09-09): this function was deployed directly to Production
// (version 12, last touched 2026-07-30) with NO corresponding source
// file anywhere in this repository. This file is the exact deployed
// source, downloaded read-only via `supabase functions download
// send-welcome-email --project-ref ixabnzhjeqevtbhdfswv` and committed
// byte-for-byte AS-IS - nothing invented, nothing corrected yet. Its
// trigger wiring could not be confirmed read-only in this task (no
// Management API access to auth-hook config was available) - do NOT
// assume it is unwired. A near-duplicate function, `clever-processor`,
// exists alongside this one with an overlapping "welcome email"
// purpose (that one is geo-aware bilingual via cf-ipcountry; this one
// is Hebrew-only body with a bilingual subject) - see that file's own
// header. Known stale branding ('ProFlow', 'quotecodepro.com')
// intentionally left UNCHANGED here pending Owner confirmation of
// trigger wiring/purpose/overlap, per this task's own explicit STOP
// condition for "unsafe orphan-function trigger ambiguity" - do not
// redeploy a branding fix for this function without first resolving
// that gate.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({
        error: 'Email is required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'ProFlow <onboarding@quotecodepro.com>',
        to: [
          email
        ],
        subject: 'ברוכים הבאים ל-ProFlow! / Welcome to ProFlow!',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2>שלום רב,</h2>
            <p>תודה שנרשמת למערכת הניהול והצעות המחיר <strong>ProFlow</strong>.</p>
            <p>החשבון שלך נוצר בהצלחה וכעת באפשרותך להתחיל לנהל את העסק שלך בצורה חכמה, מתקדמת וגלובלית.</p>
            <br>
            <p>בברכה,<br>צוות ProFlow</p>
          </div>
        `
      })
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }
});

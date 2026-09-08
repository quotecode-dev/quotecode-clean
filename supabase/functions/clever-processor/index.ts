// חוק ברזל (Orphan Edge Function Recovery, systemic remediation task,
// 2026-09-09): this function was deployed directly to Production
// (version 16, last touched 2026-07-30) with NO corresponding source
// file anywhere in this repository - it could not be reviewed, diffed,
// or safely redeployed through the normal git workflow. This file is
// the exact deployed source, downloaded read-only via
// `supabase functions download clever-processor --project-ref
// ixabnzhjeqevtbhdfswv` and committed byte-for-byte AS-IS - nothing
// invented, nothing corrected yet. Its trigger wiring (which auth/DB
// webhook, if any, actually invokes it) could not be confirmed
// read-only in this task (no Management API access to auth-hook
// config was available) - do NOT assume it is unwired just because no
// SQL trigger references it; Supabase Auth Hooks are configured
// outside Postgres and would not appear in any migration file. A
// near-duplicate function, `send-welcome-email`, exists alongside this
// one with an overlapping "welcome email" purpose - see that file's
// own header. Known stale branding ('ProFlow', 'quotecodepro.com')
// intentionally left UNCHANGED here pending Owner confirmation of
// trigger wiring/purpose/overlap, per this task's own explicit STOP
// condition for "unsafe orphan-function trigger ambiguity" - do not
// redeploy a branding fix for this function without first resolving
// that gate.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
serve(async (req)=>{
  try {
    const payload = await req.json();
    console.log('Incoming payload:', JSON.stringify(payload));
    const user = payload.record || payload.user || payload;
    const email = user?.email;
    if (!email) {
      return new Response(JSON.stringify({
        error: 'No email found in payload'
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    const country = req.headers.get('cf-ipcountry') || 'IL';
    const isForeign = country !== 'IL';
    const subject = isForeign ? 'Welcome to ProFlow!' : 'ברוכים הבאים ל-ProFlow!';
    const htmlContent = isForeign ? `<div dir="ltr"><h1>Welcome!</h1><p>Thank you for registering. Your account has been successfully created.</p></div>` : `<div dir="rtl"><h1>ברוכים הבאים!</h1><p>תודה שנרשמת למערכת. החשבון נוצר בהצלחה.</p></div>`;
    const apiKey = Deno.env.get('RESEND_API_KEY');
    // Direct HTTP request to Resend API (No external npm module dependency)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: 'ProFlow <hello@quotecodepro.com>',
        to: [
          email
        ],
        subject: subject,
        html: htmlContent
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to send email via Resend API');
    }
    return new Response(JSON.stringify({
      success: true,
      data
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in edge function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error'
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});

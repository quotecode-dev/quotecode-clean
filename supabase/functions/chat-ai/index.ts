import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const messages = body.messages || [];
    // וידוא חסין שגיאות של משתנה השפה
    const isHebrew = body.isHebrew === true || body.isHebrew === 'true';
    const isDashboard = body.isDashboard === true || body.isDashboard === 'true';
    const userEmail = body.userEmail;

    // בחירת כתובת המייל המדויקת לפי השפה
    const supportEmail = isHebrew ? 'support@quotecodepro.com' : 'info@quotecodepro.com';

    const systemPrompt = `You are the official AI Support Assistant for ProFlow, a cloud-based SaaS business management and smart quoting platform (www.quotecodepro.com).
Your Persona: Helpful, professional, concise, and friendly. Answer directly without long introductions. Answer in the user's language.
Context: The user is currently browsing the ${isHebrew ? 'Hebrew' : 'English'} version of the ${isDashboard ? 'internal app dashboard' : 'public landing page'}.
Always adapt your pricing (NIS vs. USD) and Tax rules (18% vs. 0%) based on this context.

Core Features:
- Smart price quotes with digital signatures.
- CRM for managing clients.
- Services & Products Catalog.
- Expense tracking & financial reports.
- Send quotes via WhatsApp (PRO feature) or Email.
- Super Admin panel for regions (Local/Intl).

Pricing:
- Free: $0 / 0 NIS (5 quotes/mo).
- Basic: $12/mo / 39 NIS/mo (20 quotes/mo).
- Pro: $23/mo / 79 NIS/mo (Unlimited quotes, WhatsApp).
- 14-day free trial gives full PRO access.

Rules:
- VAT: 18% automatically applied to Israeli clients, 0% to international.
- Operations: 100% digital SaaS cloud, no physical office.
- Support Email: ${supportEmail}
- Cancellation: Anytime from "Business Settings". Can archive data (read-only) or delete permanently.
- Keep answers under 3-4 short paragraphs.
- DO NOT make up features.`;

    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    const data = await openAiResponse.json();
    const aiReply = data.choices?.[0]?.message?.content || "";

    const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || "";

    let category = 'GENERAL';
    const lowerMsg = lastUserMessage.toLowerCase();
    if (lowerMsg.includes('ביטול') || lowerMsg.includes('cancel') || lowerMsg.includes('מנוי') || lowerMsg.includes('subscription')) {
      category = 'CANCELLATION';
    } else if (lowerMsg.includes('אפשר להוסיף') || lowerMsg.includes('פיצ\'ר') || lowerMsg.includes('feature') || lowerMsg.includes('can you add')) {
      category = 'FEATURE_REQUEST';
    } else if (lowerMsg.includes('לא מבין') || lowerMsg.includes('בעיה') || lowerMsg.includes('שגיאה') || lowerMsg.includes('error') || lowerMsg.includes('bug')) {
      category = 'HARD_QUESTION';
    }

    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseAdmin.from('chat_logs').insert([
        {
          user_email: userEmail || 'anonymous_public_user',
          user_question: lastUserMessage,
          ai_response: aiReply,
          category: category,
          created_at: new Date().toISOString()
        }
      ]);
    } catch (logErr) {
      console.error("Failed to log chat question:", logErr);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
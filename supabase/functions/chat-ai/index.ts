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
    const isHebrew = body.isHebrew === true || body.isHebrew === 'true';
    const isDashboard = body.isDashboard === true || body.isDashboard === 'true';
    const userEmail = body.userEmail;

    const supportEmail = isHebrew ? 'support@quotecodepro.com' : 'info@quotecodepro.com';

    // הגדרת חוק שפה קשיח לפי דרישת המשתמש
    const languageInstruction = isHebrew 
      ? 'Language Rule: You may respond in Hebrew or English based on the user\'s input language.' 
      : 'Language Rule: You MUST answer strictly in English at all times. Even if the user writes to you in Hebrew or any other language, you must reply exclusively in English.';

    const systemPrompt = `You are the official AI Support Assistant for ProFlow, a cloud-based SaaS business management and smart quoting platform (www.quotecodepro.com).
Your Persona: Helpful, professional, concise, and friendly. Answer directly without long introductions. 
${languageInstruction}

SUPPORT EMAIL RULE:
- For Hebrew users, use: support@quotecodepro.com
- For English users, use: info@quotecodepro.com

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
        temperature: 0.2,
      }),
    });

    const data = await openAiResponse.json();
    let aiReply = data.choices?.[0]?.message?.content || "";

    // אכיפה גורפת ומדויקת שמחליפה את support ל-info בכל צורה שלא תהיה באנגלית
    if (!isHebrew) {
      aiReply = aiReply.replace(/support@quotecodepro\.com/gi, 'info@quotecodepro.com');
      if (data.choices?.[0]?.message) {
        data.choices[0].message.content = aiReply;
      }
    }

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
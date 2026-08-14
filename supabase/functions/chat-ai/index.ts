import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // handling CORS for browser requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, isHebrew, isDashboard } = await req.json();

    // The bot's "brain" - the rules and context we defined
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
- Support: support@quotecodepro.com
- Cancellation: Anytime from "Business Settings". Can archive data (read-only) or delete permanently.
- Keep answers under 3-4 short paragraphs.
- DO NOT make up features.`;

    // send request to OpenAI's engine
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // most efficient, cost-effective model
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    const data = await openAiResponse.json();

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
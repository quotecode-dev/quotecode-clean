import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("Incoming request body:", JSON.stringify(body))

    const { to, clientName, quoteId, total, currencySymbol, quoteLink, businessName, isHebrew } = body
    
    const rawLogo = body.logoUrl || body.businessLogo || body.logo || body.bizLogo || body.imageUrl || body.image;
    
    // בדיקה מדויקת האם מדובר ב-SVG אמיתי לפי הסיומת או הנתונים, ולא לפי מילה כללית בשם הקובץ
    const isSvg = rawLogo && (rawLogo.startsWith('data:image/svg+xml') || rawLogo.toLowerCase().endsWith('.svg'));
    const validLogo = rawLogo && typeof rawLogo === 'string' && rawLogo.startsWith('http') && !isSvg ? rawLogo : null;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY environment variable')
    }

    const effectiveHebrew = isHebrew !== false;
    const bizTitle = businessName || 'ProFlow';

    const subject = effectiveHebrew 
      ? `הצעת מחיר #${quoteId ? quoteId.slice(0, 6).toUpperCase() : 'GENERAL'} מ-${bizTitle}`
      : `Quote #${quoteId ? quoteId.slice(0, 6).toUpperCase() : 'GENERAL'} from ${bizTitle}`;

    const headerHtml = validLogo 
      ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${validLogo}" alt="${bizTitle}" style="max-height: 55px; object-fit: contain;" /></div>`
      : `<div style="text-align: center; margin-bottom: 20px; font-size: 1.5rem; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">${bizTitle}</div>`;

    const html = effectiveHebrew ? `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        ${headerHtml}
        <h2 style="color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">שלום ${clientName || 'לקוח יקר'},</h2>
        <p style="font-size: 1rem; line-height: 1.5;">מצורפת הצעת המחיר שלך ממערכת <strong>${bizTitle}</strong>.</p>
        <p style="font-size: 1.1rem;"><strong>סך הכל לתשלום:</strong> <span style="color: #4f46e5; font-weight: bold;">${currencySymbol || '₪'}${total}</span></p>
        <br/>
        <p>לצפייה בהצעה המלאה, אישור או חתימה דיגיטלית לחץ על הכפתור הבא:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${quoteLink}" style="background: #4f46e5; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 1rem; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">צפה בהצעת המחיר</a>
        </div>
        <br/>
        <p style="color: #64748b; font-size: 0.9rem;">נשמח לעמוד לשירותך לכל שאלה!</p>
        <p style="color: #64748b; font-size: 0.9rem; margin-top: 15px;">צוות ${bizTitle}</p>
      </div>
    ` : `
      <div dir="ltr" style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        ${headerHtml}
        <h2 style="color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Hello ${clientName || 'Dear Client'},</h2>
        <p style="font-size: 1rem; line-height: 1.5;">Please find your quote attached from <strong>${bizTitle}</strong>.</p>
        <p style="font-size: 1.1rem;"><strong>Total Amount:</strong> <span style="color: #4f46e5; font-weight: bold;">${currencySymbol || '$'}${total}</span></p>
        <br/>
        <p>To view, approve or digitally sign your quote, click the button below:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${quoteLink}" style="background: #4f46e5; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 1rem; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">View Quote</a>
        </div>
        <br/>
        <p style="color: #64748b; font-size: 0.9rem;">Feel free to contact us with any questions!</p>
        <p style="color: #64748b; font-size: 0.9rem; margin-top: 15px;">${bizTitle} Team</p>
      </div>
    `;

    // תג quote_id מצורף לכל שליחה כך שאם המייל ייכשל/יוחזר, ה-Webhook
    // (resend-email-webhook) יוכל לזהות איזו הצעת מחיר לסמן כ"נכשלה"
    const tags = quoteId ? [{ name: 'quote_id', value: String(quoteId) }] : undefined;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'ProFlow <info@quotecodepro.com>',
        to: [to],
        subject: subject,
        html: html,
        ...(tags ? { tags } : {}),
      }),
    })

    const data = await res.json()
    console.log("Resend API response:", JSON.stringify(data))

    if (!res.ok) {
      throw new Error(data.message || 'Failed to send email via Resend')
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Error sending email:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
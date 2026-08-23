import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INTL_CURRENCIES = ['USD', 'EUR', 'GBP']
const INTL_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

// חוק ברזל: שפה וסמל מטבע חייבים תמיד לצאת מאותה הכרעת אזור יחידה - לעולם
// לא שני מקורות נפרדים (כמו שהיה כאן קודם: effectiveHebrew מ-country אבל
// resolvedSym ישירות מ-quote.currency, מה שיכול היה לייצר "English + ₪"
// עבור שורה היסטורית פגומה כמו country=International + quote.currency=ILS).
// מחזיר null אם אי-אפשר לקבוע אזור אמין - במקרה כזה אסור לשלוח מייל בכלל.
function resolveEmailRegion(
  bizCountry: string | null | undefined,
  bizCurrency: string | null | undefined,
  quoteCurrency: string | null | undefined,
  quoteTaxRate: number
): { hebrew: boolean; symbol: string } | null {
  const quoteCurr = (quoteCurrency || '').toUpperCase()

  if (bizCountry) {
    const isLocal = bizCountry === 'Local' || bizCountry === 'LCL'
    if (isLocal) {
      // Local: אזור החשבון קובע - הסמל תמיד ₪, גם אם quote.currency השמור
      // הוא ערך זר/היסטורי שגוי. אסור בהחלט $/€/£ במייל של חשבון Local.
      return { hebrew: true, symbol: '₪' }
    }
    if (bizCountry !== 'International') {
      // ערך country לא-מוכר (לא Local/LCL/International) - אסור להניח
      // International כברירת מחדל; נכשלים בבטחה במקום להמציא אזור.
      return null
    }
    // International: הסמל חייב לצאת מ-USD/EUR/GBP בלבד - לעולם לא ₪, גם אם
    // quote.currency השמור הוא 'ILS'/ריק/פגום. מעדיפים את מטבע ההצעה עצמה
    // אם הוא תקין, אחרת נופלים למטבע החשבון אם הוא תקין, אחרת USD בברירת מחדל.
    if (INTL_CURRENCIES.includes(quoteCurr)) {
      return { hebrew: false, symbol: INTL_SYMBOLS[quoteCurr] }
    }
    const bizCurr = (bizCurrency || '').toUpperCase()
    if (INTL_CURRENCIES.includes(bizCurr)) {
      return { hebrew: false, symbol: INTL_SYMBOLS[bizCurr] }
    }
    return { hebrew: false, symbol: '$' }
  }

  // business_settings לא נמצא: מקבלים רק שילוב currency/tax_rate שעקבי
  // פנימית מנתוני ההצעה עצמה - לעולם לא מנחשים 'Local' כברירת מחדל, ולעולם
  // לא ממציאים אזור מתוך נתונים סותרים/חסרים.
  if (quoteCurr === 'ILS' && quoteTaxRate > 0) {
    return { hebrew: true, symbol: '₪' }
  }
  if (INTL_CURRENCIES.includes(quoteCurr) && quoteTaxRate === 0) {
    return { hebrew: false, symbol: INTL_SYMBOLS[quoteCurr] }
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("Incoming request body:", JSON.stringify(body))

    const { to, clientName, quoteId, total, quoteLink, businessName } = body

    const rawLogo = body.logoUrl || body.businessLogo || body.logo || body.bizLogo || body.imageUrl || body.image;

    // בדיקה מדויקת האם מדובר ב-SVG אמיתי לפי הסיומת או הנתונים, ולא לפי מילה כללית בשם הקובץ
    const isSvg = rawLogo && (rawLogo.startsWith('data:image/svg+xml') || rawLogo.toLowerCase().endsWith('.svg'));
    const validLogo = rawLogo && typeof rawLogo === 'string' && rawLogo.startsWith('http') && !isSvg ? rawLogo : null;

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY environment variable')
    }

    // אכיפה בצד השרת: השפה והמטבע נגזרים אך ורק ממסד הנתונים, לא מהלקוח.
    // isHebrew/currencySymbol שהלקוח שולח נהיו לגמרי חסרי משמעות כאן - גם אם
    // הפרונטאנד ישלח אי-פעם ערך שגוי/הפוך, המייל בפועל עדיין ייגזר נכון,
    // ותמיד משפה+סמל שיוצאים יחד מ-resolveEmailRegion (הכרעת אזור אחת ויחידה -
    // ר' ההערה שם) ולא משני מקורות נפרדים. אם אי-אפשר לקבוע אזור אמין,
    // המייל לא נשלח כלל ומוחזרת שגיאת שרת ברורה, במקום לנחש.
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!quoteId || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Cannot verify quote region/currency against the database - refusing to send email.')
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: quoteRow } = await supabaseAdmin
      .from('quotes')
      .select('user_id, currency, tax_rate')
      .eq('id', quoteId)
      .maybeSingle()

    if (!quoteRow) {
      throw new Error('Quote not found - refusing to send without a verified region/currency.')
    }

    let bizCountry: string | null = null
    let bizCurrency: string | null = null
    if (quoteRow.user_id) {
      const { data: bizRow } = await supabaseAdmin
        .from('business_settings')
        .select('country, currency')
        .eq('user_id', quoteRow.user_id)
        .maybeSingle()
      bizCountry = bizRow?.country ?? null
      bizCurrency = bizRow?.currency ?? null
    }

    const resolved = resolveEmailRegion(bizCountry, bizCurrency, quoteRow.currency, Number(quoteRow.tax_rate))
    if (!resolved) {
      throw new Error('Cannot establish a trustworthy business region/currency for this quote - refusing to send email.')
    }
    const effectiveHebrew = resolved.hebrew
    const resolvedSym = resolved.symbol

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
        <p style="font-size: 1.1rem;"><strong>סך הכל לתשלום:</strong> <span style="color: #4f46e5; font-weight: bold;">${resolvedSym}${total}</span></p>
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
        <p style="font-size: 1.1rem;"><strong>Total Amount:</strong> <span style="color: #4f46e5; font-weight: bold;">${resolvedSym}${total}</span></p>
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
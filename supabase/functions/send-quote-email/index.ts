import { buildQuoteEmail, safeLogoUrl, safeQuoteLink, inlineLogoAttachment, INLINE_LOGO_CID, senderDisplayName, replyToAddress } from './emailTemplate.ts'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { formatEmailTotal } from "./emailMoney.ts"
import { decideEmailLink } from "./capabilityLink.ts"
import { readReservation, outcomeOf, REFUSALS, UNVERIFIED, UNKNOWN, PROVIDER_REFUSED, TEST_RECIPIENT } from "./sendLedger.ts"
import { classifyPhaseRead } from "../_shared/activationPhase.ts"
import { decidePriceGate } from "./priceGate.ts"

// Task 29: a deliberate refusal of this function. Its message is part of the API (classified by src/utils/quoteEmailErrorClassification.js)
// and is returned as before; any OTHER error is logged on the server and answered with a generic message (no internal details).
class EmailRefusal extends Error {}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INTL_CURRENCIES = ['USD', 'EUR', 'GBP']
const INTL_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

// אותו דפוס בדיוק כמו ב-send-trial-expiration-email/send-subscription-expiration-email:
// כתובת השולח נגזרת מ-effectiveHebrew (למטה) - אותה הכרעת אזור יחידה, אמינה
// ומאומתת server-side, שכבר קובעת את שפת גוף המייל/הנושא/קישור ההצעה עצמם.
// לעולם לא נוצר כאן מקור-אמת שני נפרד לכתובת השולח.
// Owner 2026-10-25: the business sends the quote - "<business> באמצעות TEKANGO" / "<business> via TEKANGO" on the same verified address
// (a quote from "Dandy AC" arriving from "TEKANGO Support" looked like phishing to Outlook); no business name = the former sender
function senderAddressFor(isHebrew: boolean, businessName: string | null = null) {
  const shown = senderDisplayName(businessName);
  if (!shown) return isHebrew ? 'TEKANGO Support <support@tekango.com>' : 'TEKANGO <info@tekango.com>';
  return isHebrew ? `"${shown} באמצעות TEKANGO" <support@tekango.com>` : `"${shown} via TEKANGO" <info@tekango.com>`;
}

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
    // Codex SEC-LOG-01 (Owner 2026-10-30): the request body (addresses, quote details, links) is never logged

    const { quoteId } = body

    // הלוגו נשאר, בכוונה, מקור מהבקשה בשלב הזה - ר' ההערה בהמשך הקובץ
    // (ליד adminClient) על הסיבה שהוא לא הועבר למקור סמכותי יחד עם שאר השדות.
    const rawLogo = body.logoUrl || body.businessLogo || body.logo || body.bizLogo || body.imageUrl || body.image;

    // Task 29: an absolute http(s) URL that is not an SVG, parsed as a URL (validation only; HTML escaping happens once in the template)
    const linkLogo = safeLogoUrl(rawLogo);
    // בעל המערכת 2026-10-18: לוגו שהועלה מהמחשב (PNG / JPEG) מצורף כתמונה פנימית - ר' inlineLogoAttachment
    const logoAttachment = linkLogo ? null : inlineLogoAttachment(rawLogo);
    const validLogo = linkLogo || (logoAttachment ? `cid:${INLINE_LOGO_CID}` : null);

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new EmailRefusal('Missing RESEND_API_KEY environment variable')
    }

    // אכיפה בצד השרת: השפה והמטבע נגזרים אך ורק ממסד הנתונים, לא מהלקוח.
    // isHebrew/currencySymbol שהלקוח שולח נהיו לגמרי חסרי משמעות כאן - גם אם
    // הפרונטאנד ישלח אי-פעם ערך שגוי/הפוך, המייל בפועל עדיין ייגזר נכון,
    // ותמיד משפה+סמל שיוצאים יחד מ-resolveEmailRegion (הכרעת אזור אחת ויחידה -
    // ר' ההערה שם) ולא משני מקורות נפרדים. אם אי-אפשר לקבוע אזור אמין,
    // המייל לא נשלח כלל ומוחזרת שגיאת שרת ברורה, במקום לנחש.
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SECRET_KEY = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default']
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    if (!quoteId || !SUPABASE_URL || !SECRET_KEY) {
      throw new EmailRefusal('Cannot verify quote region/currency against the database - refusing to send email.')
    }

    // אימות: הקורא חייב להיות משתמש מחובר אמיתי - הזהות נקבעת אך ורק מה-JWT
    // שלו (דרך callerClient, עם מפתח ה-anon בלבד), לעולם לא נסמכים על שדה
    // userId/ownerId כלשהו שהבקשה עצמה שולחת.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const callerClient = createClient(SUPABASE_URL, ANON_KEY ?? '', {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser()
    if (callerAuthErr || !callerUser) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // עדכון 2026-08-28 (Quote Number Transition audit): ההערה הקודמת כאן
    // טענה ש-quote_number "עדיין לא קיים בסביבה החיה" - שגוי. הוא כבר קיים
    // כעמודה integer NOT NULL (מקור שונה - global sequence קיים, לא ה-
    // migration של המאגר - ר' PROFLOW_TODO.md item 17), כך שה-select הזה
    // כבר מצליח היום. הסיבה ש-quoteNumberDisplay למטה לא מציג מספר אמיתי
    // בפועל היא שה-Edge Function הזו עצמה לא נפרסה מחדש מאז שהשדה נוסף -
    // יש לפרוס (supabase functions deploy send-quote-email) רק כחלק
    // מהשחרור המתואם שמתואר ב-PROFLOW_TODO.md item 17, לא כצעד מבודד.
    const supabaseAdmin = createClient(SUPABASE_URL, SECRET_KEY)
    const { data: quoteRow } = await supabaseAdmin
      .from('quotes')
      .select('user_id, currency, tax_rate, total, client_id, quote_number')
      .eq('id', quoteId)
      .maybeSingle()

    if (!quoteRow) {
      throw new EmailRefusal('Quote not found - refusing to send without a verified region/currency.')
    }

    // בעלות: משתמש רשאי לשלוח רק הצעת מחיר שהוא עצמו הבעלים שלה - אין
    // כרגע חריגה ל-super_admin, כי אין שימוש מוצרי קיים לשליחה מטעם משתמש אחר.
    if (quoteRow.user_id !== callerUser.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: you may only send your own quote' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Task 38 (Owner D1 = block, server side): a quote with a line whose price was never entered is never emailed to a customer; an
    // intentional 0 is a price. Decided right after ownership (a foreign caller learns nothing about the prices) and before anything
    // else is read for the email or the provider is called; an unverifiable price state refuses too (fail closed, priceGate.ts).
    const { data: missingRows, error: missingErr } = await supabaseAdmin.from('quote_items').select('id').eq('quote_id', quoteId).eq('price_missing', true).limit(1)
    const priceGate = decidePriceGate(missingRows, missingErr)
    if (!priceGate.ok) throw new EmailRefusal(priceGate.message)

    // Task 28: the owner's default share text, for the VERIFIED owner only (explicit column). A missing table / read error = the
    // built-in email text (sending is never blocked by this optional setting).
    let ownerShareText: string | null = null
    {
      const { data: shareRow, error: shareErr } = await supabaseAdmin
        .from('business_share_defaults')
        .select('share_text')
        .eq('user_id', quoteRow.user_id)
        .maybeSingle()
      if (!shareErr && typeof shareRow?.share_text === 'string') ownerShareText = shareRow.share_text
    }

    let bizCountry: string | null = null
    let bizCurrency: string | null = null
    let bizName: string | null = null
    let bizEmail: string | null = null // Owner 2026-10-25 (typed L-15): the customer's reply goes here
    if (quoteRow.user_id) {
      const { data: bizRow } = await supabaseAdmin
        .from('business_settings')
        .select('country, currency, business_name, email')
        .eq('user_id', quoteRow.user_id)
        .maybeSingle()
      bizCountry = bizRow?.country ?? null
      bizCurrency = bizRow?.currency ?? null
      bizName = bizRow?.business_name ?? null
      bizEmail = bizRow?.email ?? null
    }

    // נמען ושם הלקוח נגזרים אך ורק מרשומת ה-client האמיתית המקושרת להצעה -
    // לעולם לא מהבקשה, אחרת קורא כלשהו יכול היה להפנות מייל "רשמי" של
    // TEKANGO לכל כתובת שירצה.
    let clientEmail: string | null = null
    let clientCompanyName: string | null = null
    if (quoteRow.client_id) {
      const { data: clientRow } = await supabaseAdmin
        .from('clients')
        .select('email, company_name')
        .eq('id', quoteRow.client_id)
        .eq('user_id', quoteRow.user_id) // Codex release 2a (Owner 2026-10-29, typed: "מאשר שחרור 2א עכשיו: ...", SEC-DB-02): never another account's client
        .maybeSingle()
      clientEmail = clientRow?.email ?? null
      clientCompanyName = clientRow?.company_name ?? null
    }
    if (!clientEmail) {
      throw new EmailRefusal('No client email on file for this quote - refusing to send.')
    }

    const resolved = resolveEmailRegion(bizCountry, bizCurrency, quoteRow.currency, Number(quoteRow.tax_rate))
    if (!resolved) {
      throw new EmailRefusal('Cannot establish a trustworthy business region/currency for this quote - refusing to send email.')
    }
    const effectiveHebrew = resolved.hebrew
    const resolvedSym = resolved.symbol

    const bizTitle = bizName || 'TEKANGO';
    const clientDisplayName = clientCompanyName || (effectiveHebrew ? 'לקוח יקר' : 'Dear Client');
    // חוק ברזל (Money Consolidation - Global Surface Audit finding I-1): גרסה
    // קודמת עשתה Math.round() כאן, ומחקה בשקט אגורות/סנטים מהסכום שמוצג
    // במייל, לשני השווקים - קובץ Edge Function זה כבר LIVE-DEPLOYED, כך
    // שמיילים אמיתיים ללקוחות כבר מציגים היום סכום מעוגל. תוקן להתאים בדיוק
    // ל-formatMoney הקנוני (src/utils/money.js) - אין Math.round, האגורות/
    // סנטים נשמרים. Deno Edge Functions לא יכולים לייבא מ-src/ (runtime
    // נפרד מה-frontend build) - זהו עותק מכוון, שמור-בכוונה זהה ללוגיקה של
    // formatMoney; כל שינוי עתידי ל-formatMoney חייב להיות משוכפל ידנית גם
    // לכאן. תיקון זה הוא לוקאלי בלבד בקובץ זה - הפריסה (deploy) עצמה נשארת
    // צעד עתידי נפרד, לא בוצעה בסבב הזה.
    // IRON-ILS-001: ILS (₪) => nearest whole shekel, half-up away from zero, always ".00"; other currencies keep full precision.
    const displayTotal = formatEmailTotal(quoteRow.total, resolvedSym) // unit-tested in emailMoney.test.js
    // Task 36 partial-total line: under D1 = block a quote with a missing price never reaches this point (the price gate above), so the
    // total here is never partial; the template keeps the line for the documented 'confirm' policy.
    const partialTotal = false

    // קישור ההצעה נבנה אך ורק בצד השרת, מדומיין הייצור הקבוע ומה-quoteId
    // המאומת - לעולם לא מכתובת שהבקשה שולחת, אחרת אפשר היה להטמיע קישור
    // דיוג כלשהו בתוך מייל "רשמי" שנשלח מהדומיין האמיתי של TEKANGO.
    // TEKANGO Email Migration + Visible Rebrand Sweep task (2026-09-07):
    // updated to the new canonical domain. Unlike the /dashboard links in
    // send-trial-expiration-email/send-subscription-expiration-email (an
    // AUTHENTICATED route - a returning user's session lives in that
    // origin's own localStorage, so repointing it could strand an
    // already-logged-in user on the new domain with no session), a public
    // quote link is fully anonymous (get-public-quote has no auth check at
    // all) - there is no session-continuity risk here. Already-sent emails
    // keep working regardless: www.quotecodepro.com still resolves (no DNS
    // change made), only NEW emails from this point use the new domain.
    const PROD_ORIGIN = 'https://www.tekango.com';
    // Subscriptions (OD-02, CROSSCUT §3): while free_issue is not enforced the link is exactly the id link above (unchanged).
    // Enforced: the link carries the capability token minted by subscription-authority authorize_output (channel 'send'),
    // verified here against the quote AND the verified caller; a mismatch sends nothing. Decision: capabilityLink.ts (tested).
    const phase = classifyPhaseRead(await supabaseAdmin.from('subscription_activation').select('phase').eq('component', 'free_issue').maybeSingle())
    const linkDecision = await decideEmailLink({
      phase, origin: PROD_ORIGIN, quoteId: String(quoteId), callerUserId: callerUser.id, hebrew: effectiveHebrew,
      capabilityToken: body.capabilityToken,
      resolve: async (hash) => {
        const { data, error } = await supabaseAdmin.rpc('resolve_public_capability', { p_token_hash: hash, p_op: 'view' })
        if (error) throw new Error('resolve_public_capability failed')
        return data
      },
    })
    if (!linkDecision.ok) {
      return new Response(JSON.stringify(linkDecision.body), {
        status: linkDecision.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const canonicalQuoteLink = linkDecision.link;

    // חוק ברזל (item 17 + Quote Number Mobile/Surface Consistency, סבב זה):
    // נופל בבטחה למספר ה-UUID המקוצר הקיים כל עוד quoteRow.quote_number לא
    // קיים (לפני הפעלת ה-migration בסביבה החיה). התיקון הזה: הפונקציה
    // הזו (Deno, runtime נפרד שלא יכול לייבא מ-src/utils/quoteNumber.js)
    // שכפלה בעבר נפילת-חזרה עם 6 תווים + uppercase - שונה מ-8 התווים
    // (ללא uppercase) שכל שאר הצרכנים באפליקציה כבר מאוחדים עליהם דרך
    // formatQuoteFallback() - תוקן כאן לתואם בדיוק (8 תווים, ללא uppercase)
    // כדי שאותו UUID יציג את אותו fallback string בכל משטח (Public Quote,
    // Quote History, CSV, WhatsApp, ועכשיו גם כאן ב-subject המייל). שינוי
    // עתידי לפורמט הקנוני ב-formatQuoteFallback() חייב להישמר מסונכרן
    // ידנית גם כאן.
    const quoteNumberDisplay = typeof quoteRow.quote_number === 'number'
      ? `A${quoteRow.quote_number}`
      : (quoteId ? `#${quoteId.slice(0, 8)}` : 'GENERAL');
    const safeLink = safeQuoteLink(canonicalQuoteLink, PROD_ORIGIN)
    if (!safeLink) throw new EmailRefusal('Cannot build a verified quote link - refusing to send email.')
    const { subject, html, text } = buildQuoteEmail({
      hebrew: effectiveHebrew, bizTitle, clientDisplayName, quoteNumberDisplay, symbol: resolvedSym, displayTotal,
      quoteLink: safeLink, logoUrl: validLogo, shareText: ownerShareText, partialTotal,
    })

    // תג quote_id מצורף לכל שליחה כך שאם המייל ייכשל/יוחזר, ה-Webhook
    // (resend-email-webhook) יוכל לזהות איזו הצעת מחיר לסמן כ"נכשלה"
    const tags = quoteId ? [{ name: 'quote_id', value: String(quoteId) }] : undefined;

    // Codex SEC-EF-02 (Owner 2026-10-30): the send is reserved in the database BEFORE the provider is called (sendLedger.ts);
    // an unreadable reservation sends nothing
    // Codex release 9, L-13 (Owner 2026-10-30, typed: "... L-13 רק לחסימת הנמען של חשבונות הבדיקה בשחרור 9 ..."): a registered LIVE-check
    // test account emails a quote ONLY to its own test mailbox - refused before anything is reserved or sent (never silently redirected)
    const { data: recipientAllowed, error: recipientErr } = await supabaseAdmin.rpc('live_check_recipient_allowed', { p_user: callerUser.id, p_recipient: clientEmail })
    if (recipientErr) throw new EmailRefusal(UNVERIFIED)
    if (recipientAllowed !== true) throw new EmailRefusal(TEST_RECIPIENT)
    const { data: reserved, error: reserveErr } = await supabaseAdmin.rpc('quote_email_reserve', { p_quote: quoteId, p_user: callerUser.id, p_recipient: clientEmail })
    const reservation = reserveErr ? null : readReservation(reserved)
    if (!reservation) throw new EmailRefusal(UNVERIFIED)
    if (!reservation.ok) throw new EmailRefusal(REFUSALS[reservation.code])
    const settle = async (state: 'sent' | 'failed' | 'unknown', providerId: string | null) => {
      const { error: settleErr } = await supabaseAdmin.rpc('quote_email_settle', { p_id: reservation.id, p_state: state, p_provider_id: providerId })
      if (settleErr) console.error('send-quote-email: the send record was not settled', reservation.id)
    }

    // PRODUCT_TRUTH_CAPABILITY: quote_email
    let res: Response
    // a bounded wait (well under the 2-minute in-flight window): a hung provider call becomes UNKNOWN, retried with the same key
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 25000)
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: abort.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Idempotency-Key': reservation.send_key,
        },
        body: JSON.stringify({
          from: senderAddressFor(effectiveHebrew, bizName),
          to: [clientEmail],
          ...(replyToAddress(bizEmail) ? { reply_to: replyToAddress(bizEmail) } : {}),
          subject: subject,
          html: html,
          text: text,
          ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
          ...(tags ? { tags } : {}),
        }),
      })
    } catch {
      await settle('unknown', null)
      throw new EmailRefusal(UNKNOWN)
    } finally {
      clearTimeout(timer)
    }

    // deno-lint-ignore no-explicit-any
    const data: any = await res.json().catch(() => null)
    // a retry answered 409 = the provider already holds this key (the earlier attempt reached it): never a second email - kept as sent
    const state = res.status === 409 && reservation.retry ? 'sent' : outcomeOf(res.status)
    await settle(state, typeof data?.id === 'string' ? data.id : null)
    // Codex SEC-LOG-01 / SEC-LOG-02: only the quote, the outcome and the status are logged; the provider's text never reaches the browser
    console.log('send-quote-email:', String(quoteId), state, res.status)
    if (state === 'unknown') throw new EmailRefusal(UNKNOWN)
    if (state === 'failed') throw new EmailRefusal(PROVIDER_REFUSED)

    return new Response(JSON.stringify({ id: typeof data?.id === 'string' ? data.id : null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: unknown) {
    const message = error instanceof EmailRefusal ? error.message : 'Email sending failed'
    // Codex SEC-LOG-01: a refusal's own fixed text, otherwise only the error type (a parse error could quote the request body)
    console.error("Error sending email:", error instanceof EmailRefusal ? error.message : error instanceof Error ? error.name : 'unknown')
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
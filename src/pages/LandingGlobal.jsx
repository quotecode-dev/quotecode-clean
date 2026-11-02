import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, PackageCheck, Mail, BriefcaseBusiness, BookOpen, PenTool, Ruler, MessagesSquare, BarChart3, Zap } from 'lucide-react';
import { FONT_EN } from '../theme/neonTheme';
import { setSeoMeta } from '../utils/seoMeta';
import { publicSeo } from '../shared/publicSeoRoutes';
import { formatMoney } from '../utils/money';
import { FREE_QUOTES_TOTAL, usdPackageAmount, usdAnnualSaving, usdAnnualSavingRate, estimateAnnualSaving } from '../components/landing/landingPackageFacts';
import { loadLocalEstimate, CURRENCY_SYMBOL, RATE_SOURCE_NAME } from '../domain/subscriptions/localPriceEstimate';
import BrandName from '../components/BrandName';
import LandingPage from '../components/landing/LandingPage';
import { SMART_PACK_ENABLED } from '../components/landing/smartPackFacts';
import { usdSmartPack, usdWithSmartPack, SMART_PACK_PRICE_MINOR } from '../components/landing/smartPackFacts';
import { packagePrice } from '../domain/subscriptions/packageCatalog';
import { majorUnits } from '../domain/subscriptions/priceCatalog';
import { SMART_PACK } from '../domain/subscriptions/addOnCatalog';
import MailLink from '../components/MailLink';

// Task 16 (correction A, 2026-10-05): the International (EN) landing uses the approved refined composition
// (revision-r2-refined landing-en.html) through the shared LandingPage layout. This file keeps EVERY customer-facing
// string and all commercial data, so the landing truth gates keep scanning the real copy. IRON-LANDING-001: only
// verified capabilities; no timed guarantee, statistical badge, invoicing, checkout, broad tax or instant claim. No
// Hebrew letters and no ILS / NIS / shekel sign anywhere on this page (OD-08 / OD-11; market gate publicRouteHtml.mjs, no
// exception). Plans (IRON-LANDING-001 as amended by the Owner 2026-10-11, PROFLOW_PROJECT_CONTEXT.md §249, review display):
// Free-10, then ONE all-inclusive package - $18 per renewing month or $184.00 per renewing year (Owner 2026-10-11) - from
// src/domain/subscriptions/packageCatalog.js, always charged in USD. No verified exchange-rate source exists, so no EUR / GBP
// estimate is shown (internationalDisplay() falls back to USD). Billing abroad is not open yet (2026-10-25); Free-10 (OD-01) and
// every "10 free quotes" button carry the true state: active (enforced in both markets since 2026-10-25). English changes are limited to plan / call-to-action parity.

export default function LandingGlobal({ onForgotPassword }) {
  const navigate = useNavigate();
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);
  useEffect(() => {
    // /en is THE International canonical (locked policy TEKANGO_AI_ARCHITECTURE.md §55.11).
    setSeoMeta(publicSeo('/en'));
  }, []);
  // Task 39 (Owner final scope, OD-08): the visitor's real geo country picks the DISPLAY currency (GB GBP, euro area EUR, else USD) - a
  // labelled estimate only; billing stays USD and nothing about an account changes. Until / unless a valid rate arrives, USD is shown.
  const [estimate, setEstimate] = useState({ currency: 'USD', rate: null, reason: null });
  useEffect(() => {
    let alive = true;
    loadLocalEstimate({ cookieString: typeof document !== 'undefined' ? document.cookie : '' })
      .then((r) => { if (alive) setEstimate(r); })
      .catch(() => { /* USD stays */ });
    return () => { alive = false; };
  }, []);
  const month = usdPackageAmount('month', estimate.rate);
  const year = usdPackageAmount('year', estimate.rate);
  const est = month.display.estimate && year.display.estimate ? month.display : null;
  const sym = est ? CURRENCY_SYMBOL[est.displayCurrency] : '$';
  // Owner console 2026-10-26 (typed L-14 / L-22, item ג: "המטבע בדף הנחיתה לפי ההמלצה"): with a local estimate EVERY price on the page
  // (package, SMART PACK box, SMART PACK section) is in the same currency, each with the USD amount that is charged
  const estOf = (usdMinor) => `≈${sym}${formatMoney(majorUnits(Math.round(usdMinor * est.rate)))}`;
  const spMinor = SMART_PACK_PRICE_MINOR.INTERNATIONAL;
  const withMinor = (period) => packagePrice('INTERNATIONAL', period).amountMinor + spMinor[period];

  // §249: two review cards in six shared regions (LandingPlans.jsx) - Free-10, then the one all-inclusive package with one price row
  // per billing period, in USD (OD-08); no tax line (international tax policy open, OPEN-11); the annual price is a price, never a
  // savings badge. "Every available capability" = what the account has today (Modern / Visual stay illustrations). No paid quote
  // quota, storage or AI claim. No purchase / signup action on a card (billing abroad is not open).
  const savingRate = usdAnnualSavingRate();
  const plans = [
    {
      id: 'free', icon: Gift, name: 'Free', tagline: 'Free for 10 quotes or 7 days, whichever comes first.',
      prices: [{ period: 'free', amount: `${sym}${formatMoney(0)}`, per: null }],
      capacity: [`${FREE_QUOTES_TOTAL} quotes in total`, 'Or 7 days from sign-up, whichever comes first', 'SMART PACK included during the 7 days'],
      features: [
        'Counts once first stored with a client and an item; a new version or another client counts again',
        'An empty draft and previews never count',
        'Sent quotes stay available',
      ],
      // Owner 2026-10-25 ("why mention it at all?"): no status line on the Free card
      notice: null,
    },
    {
      id: 'all_inclusive', icon: PackageCheck, name: 'All-inclusive', tagline: 'One package with every available capability, billed monthly or annually.',
      prices: est ? [
        // Task 39: the local figure is a labelled estimate; the billed USD amount is stated on the same card row.
        { period: 'month', amount: month.estimateText, per: `${est.displayCurrency} / month · estimate`, note: <>Charged in USD: <bdi dir="ltr">{month.text}</bdi> per month</> },
        { period: 'year', amount: year.estimateText, per: `${est.displayCurrency} / year · estimate`, note: <>Charged in USD: <bdi dir="ltr">{year.text}</bdi> per year. Save {savingRate.exact ? '' : 'approximately '}<bdi dir="ltr">{savingRate.text}</bdi> - <bdi dir="ltr">{usdAnnualSaving()}</bdi> (<bdi dir="ltr">{estimateAnnualSaving(year.display)}</bdi>) per year</> },
      ] : [
        { period: 'month', amount: month.text, per: 'USD / month' },
        // Task 26 (Owner 2026-10-11 wording): shown only while the annual period is chosen - the permanent saving vs 12 monthly payments from
        // the final catalog rows: $216.00 - $184.00 = $32.00, 14.81... % -> "Save approximately 15% - $32.00 per year".
        { period: 'year', amount: year.text, per: 'USD / year', note: <>Save {savingRate.exact ? '' : 'approximately '}<bdi dir="ltr">{savingRate.text}</bdi> - <bdi dir="ltr">{usdAnnualSaving()}</bdi> per year</> },
      ],
      // Task 26: the visitor chooses ONE billing period and sees that single price (initially monthly); review display only.
      periodChoice: { legend: 'Billing period', labels: { month: 'Monthly', year: 'Annual' } },
      // Owner 2026-10-20 (TEST only): the SMART PACK add-on box. Charged in USD: with a local estimate shown, the total stays a USD line
      // (never a converted figure); in USD the shown price becomes the package plus the add-on.
      ...(SMART_PACK_ENABLED ? {
        addOn: {
          label: 'Add SMART PACK',
          // Owner 2026-10-20 (phone): what SMART PACK gives, right under its box (the one source: addOnCatalog)
          summary: SMART_PACK.summary.en,
          perPeriod: {
            month: est
              ? { add: `(+${estOf(spMinor.month)} / month)`, amount: null, line: <>With SMART PACK: <bdi dir="ltr">{month.estimateText}</bdi> + <bdi dir="ltr">{estOf(spMinor.month)}</bdi> = <bdi dir="ltr">{estOf(withMinor('month'))}</bdi> per month (estimate). Charged in USD: <bdi dir="ltr">{usdWithSmartPack('month')}</bdi></> }
              : { add: `(+${usdSmartPack('month')} / month)`, amount: usdWithSmartPack('month'), line: <>With SMART PACK: <bdi dir="ltr">{month.text}</bdi> + <bdi dir="ltr">{usdSmartPack('month')}</bdi> = <bdi dir="ltr">{usdWithSmartPack('month')}</bdi> per month (USD)</> },
            year: est
              ? { add: `(+${estOf(spMinor.year)} / year)`, amount: null, line: <>With SMART PACK: <bdi dir="ltr">{year.estimateText}</bdi> + <bdi dir="ltr">{estOf(spMinor.year)}</bdi> = <bdi dir="ltr">{estOf(withMinor('year'))}</bdi> per year (estimate). Charged in USD: <bdi dir="ltr">{usdWithSmartPack('year')}</bdi></> }
              : { add: `(+${usdSmartPack('year')} / year)`, amount: usdWithSmartPack('year'), line: <>With SMART PACK: <bdi dir="ltr">{year.text}</bdi> + <bdi dir="ltr">{usdSmartPack('year')}</bdi> = <bdi dir="ltr">{usdWithSmartPack('year')}</bdi> per year (USD)</> },
          },
        },
      } : {}),
      capacity: [`After the ${FREE_QUOTES_TOTAL} free quotes`, 'Monthly or annual billing, your choice'],
      features: ['The monthly plan renews every month', 'The annual plan renews every year'],
      notice: 'Not available for purchase yet',
    },
  ];

  const copy = {
    fontFamily: FONT_EN,
    links: { home: '/en', login: '/dashboard?lang=en', signup: '/dashboard?signup=true&lang=en' },
    // The Free-10 calls to action (hero, plans, closing) keep the existing signup path; the status pill is part of every button
    // until the server activation of Free-10 is verified (planSystemActive=false, activationPhase=off today).
    free10: { cta: '10 free quotes', status: null },
    nav: {
      label: 'Main navigation',
      homeLabel: 'TEKANGO home',
      sections: [
        { id: 'styles', label: 'Styles' },
        { id: 'workflow', label: 'How it works' },
        { id: 'plans', label: 'Plans' },
        { id: 'faq', label: 'FAQ' },
        // Owner 2026-10-27 ("מאשר את תוכנית א"): the guides index is a separate page, not a landing section.
        { id: 'guides', label: 'Guides', href: '/en/articles' },
      ],
      // No Hebrew letters on the International page: the switch is labelled in English.
      login: 'Sign In',
      // IRON-LANDING-001 (amended 2026-10-11): the Free-10 button, always with its true status.
      cta: '10 free quotes',
      ctaStatus: null,
      menu: 'Menu',
      closeMenu: 'Close menu',
      forgotPassword: 'Forgot Password?',
    },
    hero: {
      // Authority ledger L07b: no hero eyebrow (the base hero had none).
      // Authority ledger L07 (pointwise rollback, cloud-fix4): hero h1 + subtitle = base c65f742 LandingGlobal.jsx:328-335
      // verbatim (the base h1's second line, formerly a purple gradient span, is plain text in the light composition).
      // The base subtitle names no presentation style (landing truth L09: every account is Classic outside TEST).
      title: <>Smart Quotes &amp; Business Management <br />Easily, Fast &amp; Professionally</>,
      text: 'An advanced global SaaS platform tailored for modern businesses (featuring automatic quote totals, customer e-signatures, and streamlined client management).',
      // L08: no public link / caption to the sample-quote route (no authority); the figure keeps an accessible name only.
      docLabel: 'Sample quotation in the Classic style',
      // OD-01 (Owner 2026-10-07): the trial line now states the Free-10 policy, marked as not yet activated.
      trial: '10 free quotes or 7 days, whichever comes first',
      motion: {
        eyebrow: 'Quotes that work as hard as you do',
        title: 'From the jobsite to a signed quote',
        text: 'Professional quotes, fast approval and an organized business — on desktop or mobile.',
        cta: 'Get started',
      },
    },
    styles: {
      eyebrow: 'One family, three presentation levels',
      title: 'A document that fits the way your business works',
      // L09: the capability every account has is Classic; Modern / Visual are illustrations only, never "included".
      intro: 'Three quote styles, available to every account: Classic - a clean business document with the commercial facts and a clear item-and-price table; Modern - with product images; Visual - with a lead project image. Choose a style in your business settings or on each quote.',
      tablistLabel: 'Quote styles',
      // cloud-fix4b (Codex, truth): the phone layout with long amounts puts the description on its own full row, so the copy
      // may not promise "four columns on phones"; it states exactly what is kept (the four commercial fields).
      shared: 'In every style the item table keeps its four fields: Description, Qty, Unit Price and Total. On phones, when amounts are long, the description moves to its own full row and the three numeric values appear under their own headers. The detail level (compact or expanded) is chosen separately from the style.',
      availableBadge: 'Available to every account',
      previewBadge: 'Preview only · not currently available',
      previewNote: 'Illustration only.',
      viewerLabel: 'Sample quotation in the selected style',
      // Task 27 (Owner-approved image): atmosphere photo beside the live style showcase (synthetic sample data, no identity numbers)
      photo: { src: '/assets/landing/quote-electrician-en.webp', width: 1280, height: 698, alt: 'An electrician holding a phone with a TEKANGO quote' },
    },
    // Authority ledger L07 (pointwise rollback): base "How It Works" title, subtitle and three steps verbatim
    // (c65f742 LandingGlobal.jsx:447-453). The reference eyebrow "Four steps" has no base counterpart and would be false
    // with the three base steps, so the section has no eyebrow.
    workflow: {
      title: 'How It Works',
      intro: 'From a blank page to a signed quote in three clear steps.',
      steps: [
        { title: 'Create', text: 'Build a guided quote - a simple item, calculated by measurements, or picked from your catalog. Totals update as you type.' },
        { title: 'Send', text: 'Share a personal link so the client can view the polished quote on any device - no printing, no heavy attachments.' },
        { title: 'Approve & Sign', text: 'The client approves and signs digitally right from their phone - and the status updates in your account.' },
      ],
    },
    business: {
      phoneShowcaseAlt: 'A tradesperson pointing at the TEKANGO quotes list on a phone',
      // Authority ledger L07b: no eyebrow / heading (the base feature-card block had none).
      // Authority ledger L15 (rollback): the reference management preview and its three benefits are removed; the base
      // five-card set is complete again (card 1 "Quotes Made Simple", c65f742 LandingGlobal.jsx:512-518, verbatim).
      capabilities: [
        // Card order = base c65f742 (quotes, signature, income/expenses, measurements, AI) - ledger R21 / L04 / L15.
        { icon: Zap, title: 'Quotes Made Simple', text: 'Create professional, beautiful price quotes including automatic totals, discounts, and items from your catalog.' },
        { icon: PenTool, title: 'Digital Signatures & Approvals', text: 'Send a direct link to your client to review, print or save as PDF, digitally sign, and approve orders from any smartphone or computer.' },
        { icon: BarChart3, title: 'Income & Expense Tracking', text: 'Track business profits, manage operating expenses, and see an up-to-date financial overview of your business.' },
        // Generic trade capability (QuoteForm.jsx: area / linear measurement rows) - deliberately no plan tier named here.
        { icon: Ruler, title: 'Professional Quotes with Measurements & Specs', text: <>Build a quote from real measurements (area or length), with multiple measurement rows per item and automatic quantity calculation - suited for glass and aluminum work, flooring, electrical, plumbing, and other trades. Fewer manual calculations and errors, more accurate quotes, and time saved on repeat quoting.</> },
        // Task 34 (Owner: the AI card describes ONLY what the LIVE product really has): the AI assistant inside the signed-in workflows - the
        // base wording without the false "previous chats are kept" claim (Task 33). The AI quote DRAFT is not in Production yet, so it is not
        // advertised here; its card text is part of the AI release package (evidence/task34-followup/AI_RELEASE_PACKAGE.md).
        { icon: MessagesSquare, title: 'AI Assistant Inside Your Workflow', text: 'The TEKANGO AI assistant is available inside your signed-in workflows - while you create or edit a quote, work with clients, and manage settings. Ask about the step you are on or get guided help.' },
      ],
    },
    // Owner 2026-10-20: the SMART PACK promotion - TEST only (SmartPackShowcase renders nothing in a production build). Prices = the Owner
    // decision of 2026-10-20 (5 USD a month; yearly with the 15% saving = 51 USD), always an add-on the customer chooses.
    smartPack: {
      badge: 'New · Subscription add-on',
      name: 'SMART PACK',
      lead: 'The TEKANGO smart assistant: it talks, it listens, it knows your business and helps you write quotes.',
      demoLabel: 'Demo: a spoken question to the smart assistant and an answer from the business data',
      demoTitle: 'Smart assistant',
      demoQuestion: 'How many quotes are waiting for approval this week?',
      demoAnswer: 'Three quotes are waiting for approval. Two of them were viewed today, worth following up.',
      soon: 'Coming soon',
      features: [
        { icon: 'chat', title: 'A smart chat that knows your business', text: 'Ask about your quotes, clients, catalog and tasks, and get answers from your real data.' },
        { icon: 'voice', title: 'Voice chat', text: 'Ask out loud and hear the answer, on site or when your hands are busy.' },
        { icon: 'ai', title: 'AI smart quote', text: 'Describe the job, or dictate it, and the AI drafts the quote lines. You review and approve.' },
        { icon: 'files', title: 'Files attached to the quote', text: 'Drawings, photos and documents attached to the quote your client receives.' },
        // Owner console 2026-10-22, typed L-14 approval: the Customer Twin card without "Coming soon", in the approved wording - LIVE since PR #47
        { icon: 'twin', title: 'Customer Twin', text: 'See your quote through your client’s eyes: three kinds of clients review it, so you can strengthen it before you send it.' },
      ],
      priceMonth: est ? estOf(spMinor.month) : '$5',
      priceMonthLabel: est ? `per month, added to your plan (estimate; charged in USD: ${usdSmartPack('month')})` : 'per month, added to your plan',
      priceYear: est ? `or ${estOf(spMinor.year)} a year with a yearly plan (charged in USD: ${usdSmartPack('year')})` : 'or $51 a year with a yearly plan',
      // Owner console 2026-10-26 (typed SMART PACK removal approval, L-14): removed in the plans window, at the end of the paid period
      points: ['Add it only if you want it', 'Remove it any time - it ends with the paid period', 'Paid together with your plan'],
      // Owner 2026-10-20: what SMART PACK gives, next to its button too - a second check list in its own colour (the one source: addOnCatalog)
      // Owner 2026-10-20: on the landing list the attachments line names images too
      includes: SMART_PACK.includes.en.map((t) => (t === 'Files attached to a quote' ? 'Files and images attached to a quote' : t)),
      cta: 'See plans and pricing',
      note: 'The add-on will be available to buy when the plans open.',
    },
    plans: {
      // Base section heading and subtitle (L12); no eyebrow (the base title is the heading itself).
      title: 'Plans & Pricing',
      // Owner 2026-10-23 (typed L-14, morning report item 8): the 7 days, as everywhere else
      intro: '10 free quotes or 7 days, whichever ends first, then one package with every available capability, billed monthly or annually.',
      // Task 37 (Owner-approved L1 meaning): true on LIVE and TEST.
      trialNote: 'The paid package cannot be purchased yet, and the prices are shown for information only.',
      // Owner 2026-10-07: review notice for the new plan cards (exact wording).
      // Task 37 (Owner-approved L7).
      reviewNotice: 'The paid package cannot be purchased yet, and there is no online payment. You can already open an account.',
      // OD-08: billing currency disclosure; with a valid rate the local figure is an estimate (source + as-of date), otherwise USD with
      // the true reason when a local estimate was due but unavailable.
      priceNote: est
        ? <>Prices in {est.displayCurrency} are estimates, converted from US dollars at the {RATE_SOURCE_NAME} rate of <bdi dir="ltr">{est.rateAsOf.slice(0, 10)}</bdi> (1 USD = <bdi dir="ltr">{est.rate}</bdi> {est.displayCurrency}). You are charged in US dollars.</>
        : estimate.currency !== 'USD'
          ? `A ${estimate.currency} estimate is not available right now, so prices are shown in US dollars. Charged in USD.`
          : 'Prices are in US dollars. Charged in USD.',
    },
    // Authority ledger L07b (pointwise rollback): base FAQ heading + subtitle (c65f742 LandingGlobal.jsx:709-710); no eyebrow.
    faq: {
      title: 'Frequently Asked Questions',
      intro: 'Everything you need to know about the platform.',
      items: [
        // L09: Classic is the only presentation outside TEST; Modern / Visual are described as illustrations, not features.
        { q: 'How do the three styles differ?', a: 'All three styles are available to every account: Classic - a clean business document with a complete, clear item-and-price table; Modern - with product images; Visual - with a lead project image. Set a default style in your business settings and change it on any quote.' },
        { q: 'Does previewing another style change my plan?', a: 'No. Viewing the examples on this page does not change your plan or your quotes.' },
        { q: 'What happens to a shared quote after a plan change?', a: 'A shared or signed quotation stays as the customer received it, including its presentation.' },
        // OD-08 / OPEN-11: prices are the USD catalog and are charged in USD; international tax treatment is not decided.
        { q: 'Do the displayed prices include taxes?', a: 'Plan prices are listed in US dollars and are charged in USD; a price shown in pounds or euros is only an estimate. The package cannot be purchased yet; if any tax applies when it launches, it will be shown clearly before you pay anything.' },
        // OD-01/OD-02 (Owner 2026-10-07): the trial question is replaced by the Free-10 policy, truthfully not yet activated.
        // Task 37 (Owner-approved): the same facts as scannable points.
        { q: 'How do the 10 free quotes work?', a: <>The new free plan includes 10 quotes in total, or 7 days from sign-up, whichever comes first. SMART PACK is included during those 7 days.<ul className="tl-faq-list"><li>A quote counts the first time it is saved with a customer and at least one item. Editing and saving it again does not count again.</li><li>Sending or producing the same version again for the same customer does not count, on any channel: sending it, a view link, a PDF or a print.</li><li>Changing the customer, the recipient name or the quote content and producing it again counts as another quote.</li><li>An empty draft and previews never count.</li><li>Deleting a quote does not give it back, and quotes already sent to customers stay available.</li></ul>For accounts opened before the free plan was activated, the 7 days count from the activation day.</> },
        { q: 'Is the platform optimized for mobile and desktop?', a: 'Yes, TEKANGO is built as a fully responsive modern SaaS platform, allowing you to generate quotes and manage your business from any computer, tablet, or smartphone.' },
        // Verifiable infrastructure facts only (TLS in transit, encryption at rest by the Supabase/PostgreSQL platform).
        { q: 'Is my business data secure on the cloud?', a: 'Your data is stored on cloud infrastructure built on Supabase/PostgreSQL, which includes encryption in transit (TLS) and at rest as part of the standard cloud infrastructure. Access to your data is restricted to your own account.' },
        // Task 39 (Owner final scope): the cancellation-request path - a request handled by the team, never shown as an automatic cancellation.
        { q: 'How do I cancel a subscription?', a: <>Paid subscriptions cannot be purchased yet. Once they can, you can ask to cancel a subscription at any time by email to {/* PRODUCT_TRUTH_DECORATIVE: mailto link that opens a cancellation-request email to the service mailbox (handled by the team; no automatic cancellation) */}<MailLink href="mailto:info@tekango.com?subject=Subscription%20cancellation%20request&body=Hello%2C%20I%20would%20like%20to%20cancel%20my%20subscription." isHebrew={false}><bdi dir="ltr">info@tekango.com</bdi></MailLink> or from the plans window in the app. Our team handles the request and confirms it by email - it is not an automatic cancellation. Cancelling a subscription does not delete your account. The cancellation and refund terms are in our {/* PRODUCT_TRUTH_DECORATIVE: public legal page link (the cancellation and refund terms) */}<a href="/en/terms#cancellation">Terms of Service</a>.</> },
        { q: 'Can I export my financial reports and quotes?', a: 'Yes, you can easily export all your business quotes and expense reports into CSV format compatible with Excel and accounting software.' },
        // Owner console 2026-10-20 (landing copy approval): questions users asked in the smart chat and the support inbox; every answer =
        // the verified how-to facts (src/data/productHowTo.js) and the L-12 contact rule (email + chat, no phone).
        { q: 'How do I sign up?', a: 'Choose "Get started", enter your email and a password, and accept the Terms of Use and the Privacy Policy. Then open the link we email you, and your account is ready. Before your first quote, add your business phone in Business Settings.' },
        { q: 'How do I send a quote to my customer?', a: 'Send it by email or WhatsApp, or copy a message with the quote link and paste it anywhere. Your customer opens the link on any device. You can also download the quote as a PDF.' },
        { q: 'Can my customer sign the quote on a phone?', a: 'Yes. Your customer opens the link, approves the quote and signs it digitally, and the quote status updates in your account. A signed quote is locked for editing; you can duplicate it to create a new quote.' },
        { q: 'Can I keep a fixed price list of products and services?', a: 'Yes. Add items with their prices to your catalog, and pick them when you build a quote.' },
        { q: 'Can I start a new quote from an existing one?', a: 'Yes. Save a quote as a template, without the customer details, and start your next quote from that saved template.' },
        { q: 'How do I contact you?', a: <>Email {/* PRODUCT_TRUTH_DECORATIVE: mailto link to the support mailbox */}<MailLink href="mailto:info@tekango.com" isHebrew={false}><bdi dir="ltr">info@tekango.com</bdi></MailLink>, or use the chat in the corner of the screen. There is no phone support at the moment.</> },
      ],
    },
    // Free business tools (base section, ledger L03 - base c65f742 LandingGlobal.jsx:755-765, verbatim). The public tools
    // hub (/en/tools: currency, units, metals, crypto - App.jsx routes, no signup) exists; no plan / FREE claim here.
    tools: {
      title: 'Free Business Tools',
      text: <>Free business tools: currency, unit, metals & crypto calculators - available to everyone, no signup required, as a free companion to <BrandName onDark={false} />.</>,
      cta: 'Explore the Free Business Tools',
      href: '/en/tools',
      icon: BriefcaseBusiness,
    },
    // Closing band: outcome only - never the trial duration (it is stated in the hero, pricing and FAQ).
    // Authority ledger L07 (pointwise rollback): base closing title + text (c65f742 LandingGlobal.jsx:774-775).
    closing: {
      title: 'Ready to create your first quote?',
      text: 'A professional quote, one clear step at a time.',
    },
    // Footer (ledger L17): base brand markup (c65f742 LandingGlobal.jsx:803 `<BrandName />` on the dark footer); no new label.
    footer: {
      copyright: <>&copy; {new Date().getFullYear()} <BrandName /> Global. All rights reserved.</>,
      links: [
        { href: '/en/terms', label: 'Terms of Service' },
        { href: '/en/privacy', label: 'Privacy Policy' },
        { href: '/en/terms#cancellation', label: 'Cancellation & Refunds' },
        { kind: 'accessibility', label: 'Accessibility' },
        { href: '/en/contact', label: 'Contact Us (info@tekango.com)', icon: Mail },
        { href: '/en/tools', label: 'Business Tools', icon: BriefcaseBusiness },
        { href: '/en/articles', label: 'Guides', icon: BookOpen },
      ],
    },
  };

  return (
    <LandingPage
      lang="en"
      copy={copy}
      plans={plans}
      navigate={navigate}
      onForgotPassword={onForgotPassword}
      accessibilityOpen={accessibilityOpen}
      onAccessibilityOpen={() => setAccessibilityOpen(true)}
      onAccessibilityClose={() => setAccessibilityOpen(false)}
    />
  );
}

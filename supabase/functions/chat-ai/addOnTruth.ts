// Owner console 2026-10-20 (L-14, typed: "מאשר שינוי ב-L-14: חכם פלוס בעובדות המוצר (תוכן, מחיר, עדיין לא לרכישה)"): the subscription
// add-ons (AI_FACTS.addOns, generated from src/domain/subscriptions/addOnCatalog.js) as one prompt block for the chat and the support email
// assistant: what the add-on contains, its price per market, that it is optional and billed with the main plan - and that it cannot be
// bought yet. Pure (no Deno / network).
// Owner console 2026-10-25 (typed L-14 ... "להפעלת הרכישה בישראל"): purchasable per market - Israel (Hebrew context) yes, international no.
// Owner console 2026-10-25 (typed: "מאשר לתקן את ממצאים 1 עד 13 בעברית ובאנגלית, כולל שינוי ב-L-01, L-14, L-17, L-22"): the two real
// purchase paths (a new subscription ticks it; an active subscriber adds it with a pro-rata charge now); no "removed at any time" -
// there is no removal in the app (the team handles a request).

type AddOn = {
  id: string; name: { he: string; en: string }; optional: boolean; sameBillingPeriodAsMainPlan: boolean; purchasable: { IL: boolean; INTERNATIONAL: boolean };
  prices: { IL: { currency: string; month: string; year: string; taxIncluded: boolean }; INTERNATIONAL: { currency: string; month: string; year: string } };
  includes: { he: readonly string[]; en: readonly string[] }; comingSoon: { he: readonly string[]; en: readonly string[] };
};

// Owner console 2026-10-26 (typed: "מאשר את התוכנית א עד ז ...", item ו; L-06 / L-11 / L-17): the reply LANGUAGE is the interface
// language, the MARKET (prices, currency, purchase) is the account's; marketIL defaults to the language (the public chat: no account).
export function buildAddOnTruthBlock(isHebrew: boolean, addOns: readonly AddOn[] | undefined | null, marketIL: boolean = isHebrew): string {
  if (!Array.isArray(addOns) || addOns.length === 0) return '';
  const lang = isHebrew ? 'he' : 'en';
  const lines = addOns.map((a) => {
    const price = marketIL
      ? `Israel: ₪${a.prices.IL.month} per month or ₪${a.prices.IL.year} per year${a.prices.IL.taxIncluded ? ', VAT included' : ''}`
      : `International: $${a.prices.INTERNATIONAL.month} per month or $${a.prices.INTERNATIONAL.year} per year (USD)`;
    return `* ${a.name[lang]} (${a.name.he} / ${a.name.en}): an optional add-on to the paid plan. ${price}; billed together with the main plan, always in the same billing period (monthly or yearly); added only if the customer chooses it. Stopping it is a request to the team by email (there is no removal button in the app).
  Includes: ${a.includes[lang].join('; ')}.
${a.comingSoon[lang].length ? `  Coming soon (not available yet): ${a.comingSoon[lang].join('; ')}.\n` : ''}  ${(marketIL ? a.purchasable?.IL : a.purchasable?.INTERNATIONAL) === true
    ? 'It can be purchased in the plans window: with a NEW subscription, tick it when paying for the package; an account that ALREADY has an active package adds it from the "Add SMART PACK" box there - a pro-rated charge now until the end of the current monthly or yearly period, then it is charged with every renewal. Never say it is active on an account unless the verified account section says so. Do not promise it to an account whose verified section shows a failed renewal (past_due), a limited account or a legacy style plan - say the team can help by email instead.'
    // Owner 2026-10-26 (item ו): abroad it is active during the 7 free days - the verified account section is the only source for that
    : 'It CANNOT be purchased yet in this market - purchase opens here later. Never say it can be bought now; say it is active on an account ONLY when the verified account section says so (e.g. during the 7 free days).'}`;
  });
  return `SUBSCRIPTION ADD-ONS (authoritative - quote these prices exactly; never invent another add-on, a discount or a date):
${lines.join('\n')}`;
}

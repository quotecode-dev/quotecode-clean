// Owner console 2026-10-20 (L-14, typed: "מאשר שינוי ב-L-14: חכם פלוס בעובדות המוצר (תוכן, מחיר, עדיין לא לרכישה)"): the subscription
// add-ons (AI_FACTS.addOns, generated from src/domain/subscriptions/addOnCatalog.js) as one prompt block for the chat and the support email
// assistant: what the add-on contains, its price per market, that it is optional and billed with the main plan - and that it cannot be
// bought yet. Pure (no Deno / network).

type AddOn = {
  id: string; name: { he: string; en: string }; optional: boolean; sameBillingPeriodAsMainPlan: boolean; purchasable: boolean;
  prices: { IL: { currency: string; month: string; year: string; taxIncluded: boolean }; INTERNATIONAL: { currency: string; month: string; year: string } };
  includes: { he: readonly string[]; en: readonly string[] }; comingSoon: { he: readonly string[]; en: readonly string[] };
};

export function buildAddOnTruthBlock(isHebrew: boolean, addOns: readonly AddOn[] | undefined | null): string {
  if (!Array.isArray(addOns) || addOns.length === 0) return '';
  const lang = isHebrew ? 'he' : 'en';
  const lines = addOns.map((a) => {
    const price = isHebrew
      ? `Israel: ₪${a.prices.IL.month} per month or ₪${a.prices.IL.year} per year${a.prices.IL.taxIncluded ? ', VAT included' : ''}`
      : `International: $${a.prices.INTERNATIONAL.month} per month or $${a.prices.INTERNATIONAL.year} per year (USD)`;
    return `* ${a.name[lang]} (${a.name.he} / ${a.name.en}): an optional add-on to the paid plan. ${price}; billed together with the main plan, always in the same billing period (monthly or yearly); added only if the customer chooses it, and can be added or removed at any time.
  Includes: ${a.includes[lang].join('; ')}.
  Coming soon (not available yet): ${a.comingSoon[lang].join('; ')}.
  ${a.purchasable ? 'It can be purchased.' : 'It CANNOT be purchased yet - purchase opens together with the plans. Never say it is active on an account or that it can be bought now.'}`;
  });
  return `SUBSCRIPTION ADD-ONS (authoritative - quote these prices exactly; never invent another add-on, a discount or a date):
${lines.join('\n')}`;
}

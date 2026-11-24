// Owner console 2026-10-20 (L-14, typed: "מאשר שינוי ב-L-14: הוראות "איך עושים" מאומתות לעובדות המוצר ולעוזר המיילים"): the verified
// "how do I ..." steps (AI_FACTS.howTo, generated from src/data/productHowTo.js) as one prompt block for the chat and the support email
// assistant. The assistant quotes these steps and the labels in them; it never adds a step, a button or a menu that is not here.
// Pure (no Deno / network): runs identically under Deno and vitest.

type HowToText = { task: string; steps: readonly string[] };
export type HowToEntry = { id: string; capabilityIds: readonly string[]; he: HowToText; en: HowToText; enLocal?: HowToText; heIntl?: HowToText };
/** 2026-11-13 (chat knowledge scan, section ג): the language is the user's, the market the account's - a market-bound task has its
 *  Israeli steps in English (enLocal) and its international steps in Hebrew (heIntl) */
export function howToText(e: HowToEntry, isHebrew: boolean, marketIL: boolean = isHebrew): HowToText {
  if (isHebrew) return !marketIL && e.heIntl ? e.heIntl : e.he;
  return marketIL && e.enLocal ? e.enLocal : e.en;
}

/** whole-word tokens for the how-to match (Owner 2026-11-24, L-14 / L-17): Hebrew with and without a one-letter prefix, English with a
 *  light stem (plural "s"; words of 6+ letters by their first 5), and every form of "send" / "שליחה" as one token */
const normWord = (w: string): string => {
  if (/^[a-z0-9]/.test(w)) {
    if (/^(send|sends|sent|sending)$/.test(w)) return 'send';
    return w.length >= 6 ? w.slice(0, 5) : w.replace(/s$/, '');
  }
  if (/^[ולהש]?(שול?ח|שליח|שלוח|שלח)/.test(w)) return 'שלח';
  return w;
};
export function tokensOf(text: unknown): Set<string> {
  const out = new Set<string>();
  for (const w of String(text ?? '').toLowerCase().split(/[^a-z0-9֐-׿]+/)) {
    if (w.length < 3) continue;
    out.add(normWord(w));
    if (/^[הובלכמש][֐-׿]{3,}$/.test(w)) out.add(normWord(w.slice(1)));
  }
  return out;
}

/**
 * Owner 2026-10-25 (typed L-17, QA report): a "how do I ..." question answered by the fixed capability answer ("yes - it exists") also
 * gets the verified steps. Among the how-to entries of that capability, the one sharing the most words with the question wins (ties:
 * the entry that names the capability first, then file order). Empty when the capability has no how-to entry.
 */
export function howToStepsForCapability(capabilityId: string, question: string, isHebrew: boolean, howTo: readonly HowToEntry[] | undefined | null, marketIL: boolean = isHebrew): string {
  if (!Array.isArray(howTo)) return '';
  const candidates = howTo.filter((e) => e.capabilityIds.includes(capabilityId));
  if (!candidates.length) return '';
  // Owner 2026-11-24 (typed: "מאשר את שלב 4 בתוכנית הצ׳אט ... כולל שינוי ב-L-14 ו-L-17"): the chat audit found the wrong steps picked
  // ("how do I create a quote" -> the rounding discount, "איך שולחים בוואטסאפ" -> the default WhatsApp text) because words were matched as
  // PARTS of other words ("how" inside "shows"). Now: whole words (a one-letter Hebrew prefix removed, a light English stem, every form of
  // "send / שליחה" as one word), and a word in the entry's TITLE weighs three times a word in its steps.
  const words = [...tokensOf(question)];
  const score = (e: HowToEntry) => {
    const t = howToText(e, isHebrew, marketIL);
    const title = tokensOf(t.task); const body = tokensOf(t.steps.join(' '));
    return words.reduce((n, w) => n + (title.has(w) ? 3 : 0) + (body.has(w) ? 1 : 0), 0);
  };
  const best = candidates
    .map((e, i) => ({ e, i, s: score(e), primary: e.capabilityIds[0] === capabilityId ? 1 : 0 }))
    .sort((a, b) => b.s - a.s || b.primary - a.primary || a.i - b.i)[0].e;
  const bt = howToText(best, isHebrew, marketIL);
  return `${bt.task}:\n${bt.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`;
}

export function buildHowToBlock(isHebrew: boolean, howTo: readonly HowToEntry[] | undefined | null, marketIL: boolean = isHebrew): string {
  if (!Array.isArray(howTo) || howTo.length === 0) return '';
  const lines = howTo.map((e) => { const t = howToText(e, isHebrew, marketIL); return `* ${t.task}:\n${t.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`; });
  return `HOW-TO FACTS (verified against the product's own screens - the ONLY steps you may give):
- When the user asks how to do one of these tasks, give exactly these steps and the quoted labels, in the user's language. Do not add steps, buttons, menus or settings that are not written here.
- For a task that is not listed here and is not described in the facts above, do not guess the steps - say you are not sure how it is done.
${lines.join('\n')}`;
}

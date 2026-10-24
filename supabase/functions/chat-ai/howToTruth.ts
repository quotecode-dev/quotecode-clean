// Owner console 2026-10-20 (L-14, typed: "מאשר שינוי ב-L-14: הוראות "איך עושים" מאומתות לעובדות המוצר ולעוזר המיילים"): the verified
// "how do I ..." steps (AI_FACTS.howTo, generated from src/data/productHowTo.js) as one prompt block for the chat and the support email
// assistant. The assistant quotes these steps and the labels in them; it never adds a step, a button or a menu that is not here.
// Pure (no Deno / network): runs identically under Deno and vitest.

export type HowToEntry = { id: string; capabilityIds: readonly string[]; he: { task: string; steps: readonly string[] }; en: { task: string; steps: readonly string[] } };

/**
 * Owner 2026-10-25 (typed L-17, QA report): a "how do I ..." question answered by the fixed capability answer ("yes - it exists") also
 * gets the verified steps. Among the how-to entries of that capability, the one sharing the most words with the question wins (ties:
 * the entry that names the capability first, then file order). Empty when the capability has no how-to entry.
 */
export function howToStepsForCapability(capabilityId: string, question: string, isHebrew: boolean, howTo: readonly HowToEntry[] | undefined | null): string {
  if (!Array.isArray(howTo)) return '';
  const candidates = howTo.filter((e) => e.capabilityIds.includes(capabilityId));
  if (!candidates.length) return '';
  const lang = isHebrew ? 'he' : 'en';
  // the question's words, also without a one-letter Hebrew prefix ("כתבנית" -> "תבנית")
  const words = String(question ?? '').toLowerCase().split(/[^a-z0-9֐-׿]+/).filter((w) => w.length >= 3)
    .flatMap((w) => (/^[הובלכמש][֐-׿]{3,}$/.test(w) ? [w, w.slice(1)] : [w]));
  const score = (e: HowToEntry) => {
    const text = `${e[lang].task} ${e[lang].steps.join(' ')}`.toLowerCase();
    return new Set(words.filter((w) => text.includes(w))).size;
  };
  const best = candidates
    .map((e, i) => ({ e, i, s: score(e), primary: e.capabilityIds[0] === capabilityId ? 1 : 0 }))
    .sort((a, b) => b.s - a.s || b.primary - a.primary || a.i - b.i)[0].e;
  return `${best[lang].task}:\n${best[lang].steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`;
}

export function buildHowToBlock(isHebrew: boolean, howTo: readonly HowToEntry[] | undefined | null): string {
  if (!Array.isArray(howTo) || howTo.length === 0) return '';
  const lang = isHebrew ? 'he' : 'en';
  const lines = howTo.map((e) => `* ${e[lang].task}:\n${e[lang].steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`);
  return `HOW-TO FACTS (verified against the product's own screens - the ONLY steps you may give):
- When the user asks how to do one of these tasks, give exactly these steps and the quoted labels, in the user's language. Do not add steps, buttons, menus or settings that are not written here.
- For a task that is not listed here and is not described in the facts above, do not guess the steps - say you are not sure how it is done.
${lines.join('\n')}`;
}

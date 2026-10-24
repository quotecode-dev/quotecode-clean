// Owner 2026-10-24 (typed L-14, L-15, L-17): a real user's chat questions (Doron, LIVE 24/10) - every one now reaches the right truth
import { describe, it, expect } from 'vitest';
import { classifyCapabilityIntent, resolveCapabilityTruthResponse } from './capabilityTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';
import { NAV_ACTIONS, NAV_LABELS, allowedNavigation } from '../_shared/aiHelpContract.js';

const facts = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };

describe("Doron's questions are routed to the right answer", () => {
  it.each([
    ['שלום, אני רוצה שתכין לי הצעת מחיר להתקנה של מזגן 2.5 כוח סוס, שכולל מזגן 1,700 שקל, צנרת 500 שקל. תכניס את כל זה להצעה.', 'ai_mutation'],
    ['שלום, אני מקבל כל פעם הודעות בהתראות בפעמון. אני רוצה שזה יהיה פופ-אפ, כי שזה יקפוץ לי על המסך במקום להיכנס לתוך הפעמון ולראות.', 'reminders_automation'],
    ['מקודם זה היה פופ-אפ והפסיק להיות, אני לא יודע למה. אתה יכול להגיד לי למה?', 'reminders_automation'],
    ['אתה בטוח שאני לא יכול עכשיו להפוך את ההתרעות לחלונות קופצים?', 'reminders_automation'],
    ['האם אני יכול להגיד לך בעל פה להכין לי הצעה ואתה תמלא לבד ותכין אותה?', 'smart_quote'],
    ['אני רוצה שתכתוב לי הצעה שאני אגיד לך.', 'ai_mutation'],
    ['האם אפשר לשים תמונה לכל פריט בקטלוג?', 'catalog'],
    ['Can I dictate a quote by voice?', 'smart_quote'],
    ['Can you make me a quote for a 2.5 HP AC?', 'ai_mutation'],
    ['Can notifications pop up on the screen?', 'reminders_automation'],
  ])('%s -> %s', (q, id) => { expect(classifyCapabilityIntent(q)).toBe(id); });

  it('ordinary questions keep their routes (no new sweep)', () => {
    expect(classifyCapabilityIntent('איך יוצרים הצעה חדשה?')).not.toBe('smart_quote');
    expect(classifyCapabilityIntent('What does it say on the quote?')).not.toBe('smart_quote');
  });
});

describe('the answers', () => {
  it('"build me a quote" answers what the assistant does not do AND names the AI smart quote (HE / EN)', () => {
    const he = resolveCapabilityTruthResponse('ai_mutation', facts, true).answer;
    expect(he).toContain('הצעת מחיר חכמה עם AI');
    expect(he).toContain('בקול');
    const en = resolveCapabilityTruthResponse('ai_mutation', facts, false).answer;
    expect(en).toContain('AI smart quote');
  });
  it('the smart quote answer is a YES with the voice option', () => {
    const he = resolveCapabilityTruthResponse('smart_quote', facts, true).answer;
    expect(he.startsWith('כן')).toBe(true);
    expect(he).toContain('להכתיב');
  });
  it('the pop-up answer explains the floating notice (HE / EN)', () => {
    expect(resolveCapabilityTruthResponse('reminders_automation', facts, true).answer).toContain('קופצת על המסך כהודעה צפה');
    expect(resolveCapabilityTruthResponse('reminders_automation', facts, false).answer).toContain('floating notice');
  });
  it('the catalog answer explains the item image', () => {
    expect(resolveCapabilityTruthResponse('catalog', facts, true).answer).toContain('תמונה קטנה ליד השם');
  });
  it('the AI smart quote button exists, is labelled and allowed by default', () => {
    expect(NAV_ACTIONS).toContain('open_ai_quote');
    expect(NAV_LABELS.open_ai_quote).toEqual({ he: 'פתיחת הצעת מחיר חכמה עם AI', en: 'Open the AI smart quote' });
    expect(allowedNavigation({})).toContain('open_ai_quote');
    expect(AI_FACTS.capabilities.find((c) => c.id === 'smart_quote').safeNavigationId).toBe('open_ai_quote');
  });
});

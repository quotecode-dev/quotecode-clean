// Task 36 (§ד, live TEST finding on the PUBLIC landing chat): the HE question „איך עובדות 10 ההצעות החינמיות? הן כבר פעילות?” reached the
// model, which answered „כן, ההצעות החינמיות כבר פעילות” (false: Free-10 is not active). EN "free quotes" was already deterministic.
// And a "what can TEKANGO do" answer presented Modern / Visual as available styles (only Classic is available on any account).
import { describe, it, expect } from 'vitest';
import { classifySubscriptionIntents, buildSubscriptionTruthBlock } from './subscriptionTruth.ts';

describe('HE free-quotes questions are deterministic (parity with EN "free quotes")', () => {
  it.each([
    'איך עובדות 10 ההצעות החינמיות? הן כבר פעילות?',
    'ההצעות החינמיות כבר פעילות?',
    'יש 10 הצעות חינם?',
    'איך עובדות הצעות המחיר החינמיות?',
  ])('%s', (q) => { expect(classifySubscriptionIntents(q).length).toBeGreaterThan(0); });
  it('an unrelated quote question is still not a subscription question', () => {
    expect(classifySubscriptionIntents('איך שולחים הצעת מחיר ללקוח?')).toEqual([]);
  });
});

describe('the truth block states style availability', () => {
  it.each([[true], [false]])('isHebrew=%s', (he) => {
    const b = buildSubscriptionTruthBlock(he);
    expect(b).toContain('every quote on every account is presented in the Classic style');
    expect(b).toContain('Modern and Visual are illustrations only and are not available on any plan yet');
  });
});

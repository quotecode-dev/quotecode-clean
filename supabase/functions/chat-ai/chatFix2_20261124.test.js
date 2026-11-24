// Owner console 2026-11-24, typed: "מאשר סבב המשך לצ׳אט: ארבע הנסיגות והפריטים שנשארו מהסבב הקודם, כולל שינוי ב-L-14 ו-L-17"
// (the live re-run of the 60 audit questions after release 7f9b07fa: C:/tekango-ops/chat-audit-1124/answers-*.json)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyCapabilityIntent } from './capabilityTruth.ts';
import { howToStepsForCapability } from './howToTruth.ts';
import { findSubscriptionClaimViolations } from './subscriptionTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';

const index = readFileSync('supabase/functions/chat-ai/index.ts', 'utf8');
const firstLine = (s) => String(s || '').split('\n')[0];
const stepsFor = (q, he, marketIL = he) => { const c = classifyCapabilityIntent(q); return { c, title: firstLine(howToStepsForCapability(c, q, he, AI_FACTS.howTo, marketIL)) }; };

describe('the four regressions of the live re-run reach the right verified answer', () => {
  it.each([
    ['Where is the calculator?', false, 'editor_calculator', 'Where the calculator is'],
    ['איפה המחשבון?', true, 'editor_calculator', 'איפה המחשבון'],
    ['איך מכינים הצעת מחיר?', true, 'quote_create', null],
    ['How do I delete a client?', false, 'clients', 'Deleting a client, and when it is blocked'],
    ['איך מוחקים לקוח?', true, 'clients', 'מחיקת לקוח, ולמה לפעמים אי אפשר'],
  ])('%s -> %s', (q, he, cap, title) => {
    const r = stepsFor(q, he);
    expect(r.c).toBe(cap);
    if (title) expect(r.title).toBe(`${title}:`);
    else expect(r.title).not.toBe('');
  });

  it('the calculator patterns never shadow the public metals / crypto / unit / currency calculators', () => {
    for (const q of ['Where is the metals calculator?', 'How does the crypto calculator work?', 'איפה מחשבון המטבעות?']) {
      expect(classifyCapabilityIntent(q)).not.toBe('editor_calculator');
    }
  });

  it('deleting a client starts with the click path, and its labels are real (ClientsTab)', () => {
    const e = AI_FACTS.howTo.find((x) => x.id === 'client_delete_blocked');
    expect(e.en.steps[0]).toBe('In the side menu click "Clients", open the client\'s row and click "Delete".');
    expect(e.he.steps[0]).toBe('בתפריט הצד לוחצים "לקוחות", פותחים את השורה של הלקוח ולוחצים "מחיקה".');
    const clients = readFileSync('src/components/ClientsTab.jsx', 'utf8');
    expect(clients).toContain("'מחיקה' : 'Delete'");
  });

  it('the calculator step matches the header (calculator before the bell, on every screen)', () => {
    const dash = readFileSync('src/pages/Dashboard.jsx', 'utf8');
    expect(dash).toContain("aria-label={isHebrew ? 'מחשבון' : 'Calculator'}");
    expect(dash.indexOf('{renderHeaderCalcButton()}')).toBeLessThan(dash.indexOf('<NotificationCenter '));
  });
});

describe('smart edit (en-22): its own verified steps, SMART PACK said once', () => {
  it('index.ts answers a smart-edit how question with the smart_edit_quote steps before the currency and market answers', () => {
    expect(index).toContain("e.id === 'smart_edit_quote'");
    expect(index.indexOf("e.id === 'smart_edit_quote'")).toBeLessThan(index.indexOf("e.id === 'business_currency'"));
    expect(index).toContain("const smartEditAnswer = /חכם פלוס|SMART PACK/.test(body) ? body :");
  });
  it('the SMART PACK line is added once - never when the steps already say it - and also for the smart quote', () => {
    expect(index).toContain("const smartPackFeature = truthStatus === 'SMART_PACK' || capabilityId === 'smart_quote';");
    expect(index).toContain("smartPackFeature && !/חכם פלוס|SMART PACK/.test(text)");
  });
});

describe('a how question without steps: the description, no "yes - X exists" opener', () => {
  it('available, no role, how / why only', () => {
    expect(index).toContain("const describeOnly = !shortFile && !steps && matched && truthStatus === 'AVAILABLE' && capabilityTruth.factPayload.requiredRole === null");
    expect(index).toContain('const capabilityAnswer = shortFile || stepsAnswer || describeOnly || capabilityTruth.answer;');
  });
  it('every available capability has a description in both languages', () => {
    for (const c of AI_FACTS.capabilities) {
      expect(String(c.heDescription || '').length, c.id).toBeGreaterThan(10);
      expect(String(c.enDescription || '').length, c.id).toBeGreaterThan(10);
    }
  });
});

describe('the subscription gate (en-22) and the replacement answer', () => {
  it('"the monthly usage allowance" of SMART PACK is not a monthly quote limit; a monthly quote limit still is', () => {
    const hit = (s) => findSubscriptionClaimViolations(s, false).includes('MONTHLY_QUOTE_LIMIT');
    expect(hit('SMART PACK has a monthly usage allowance')).toBe(false);
    expect(hit('Your plan has a monthly quote limit of 20')).toBe(true);
    expect(hit('quotes are capped by a monthly limit')).toBe(true);
    expect(hit('יש מכסת הצעות חודשית')).toBe(true);
  });
  it('a rejected model answer never carries its navigation button', () => {
    expect(index).toContain('navigation: navigationAction && !subscriptionViolations.length ?');
  });
});

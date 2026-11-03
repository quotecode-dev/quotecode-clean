// Owner console 2026-11-03 (typed: "מאשר תיקון כל אזכורי הצעת מחיר מקובץ לפי התוכנית (פעמון, צ'אט, מכסות ותנאי שימוש, יתרת קבצים בצ'אט,
// טיפ יומי, מסך ניהול, סוכנת הרשתות, בדיקת הלקוח ברשימת חכם פלוס), כולל שינוי ב-L-05, L-06, L-11, L-12, L-14, L-17 ו-L-22, שחרור עד הלייב"):
// the chat routes "quote from a file" questions to the right answer and button, knows its quota and the user's own file balance.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyCapabilityIntent, resolveCapabilityTruthResponse, QUOTE_FROM_FILE_REQUEST, quoteFromFileAnswer } from './capabilityTruth.ts';
import { howToStepsForCapability } from './howToTruth.ts';
import { classifySubscriptionIntents, resolveSubscriptionTruthResponse, buildSubscriptionTruthBlock } from './subscriptionTruth.ts';
import { parseFileReadStatus, fetchFileReadBalance, buildVerifiedAccountContext } from './accountContext.ts';
import { buildSystemPrompt } from './validation.ts';
import { AI_FACTS } from './aiFacts.generated.ts';
import { NAV_ACTIONS, NAV_LABELS, allowedNavigation } from '../_shared/aiHelpContract.js';

const facts = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };
const fileQuestion = (q) => QUOTE_FROM_FILE_REQUEST.some((re) => re.test(q));

describe('quote-from-file questions reach the smart quote capability (not the PDF download, not attachments)', () => {
  it.each([
    'אפשר להכין הצעה מקובץ PDF?',
    'איך יוצרים הצעת מחיר מקובץ?',
    'אפשר להעלות קובץ ולקבל הצעה?',
    'יש לי הצעה של בעל מקצוע אחר, אפשר להשתמש בה?',
    'Can I make a quote from a PDF?',
    'Can I make a quote from a file?',
    'How do I create a quote from a photo?',
    'Can I upload a file and get a quote?',
    'Can I upload another business\'s quote?',
  ])('%s', (q) => {
    expect(classifyCapabilityIntent(q)).toBe('smart_quote');
    expect(fileQuestion(q)).toBe(true);
  });

  it('the PDF download, attachments and the AI smart quote keep their own routes', () => {
    expect(classifyCapabilityIntent('Can I download a PDF?')).toBe('quote_pdf');
    expect(classifyCapabilityIntent('איך מורידים את ההצעה כ-PDF?')).toBe('quote_pdf');
    expect(classifyCapabilityIntent('Can I attach a file to a quote?')).toBe('attachments');
    expect(classifyCapabilityIntent('אפשר לצרף קובץ להצעה?')).toBe('attachments');
    expect(classifyCapabilityIntent('Can I dictate a quote by voice?')).toBe('smart_quote');
    expect(fileQuestion('Can I dictate a quote by voice?')).toBe(false);
    expect(fileQuestion('Can I attach a file to a quote?')).toBe(false);
  });

  it('the fixed answer names "quote from a file" (HE / EN); a "how" question gets its own steps', () => {
    expect(resolveCapabilityTruthResponse('smart_quote', facts, true).answer).toContain('הצעת מחיר מקובץ');
    expect(resolveCapabilityTruthResponse('smart_quote', facts, false).answer).toContain('Quote from a file');
    expect(howToStepsForCapability('smart_quote', 'איך יוצרים הצעה מקובץ?', true, AI_FACTS.howTo)).toContain('הצעת מחיר מקובץ');
    expect(howToStepsForCapability('smart_quote', 'How do I make a quote from a file?', false, AI_FACTS.howTo)).toContain('Quote from a file');
  });

  it('the button opens the file dialog: a closed destination with HE / EN labels, wired in the server and the app', () => {
    expect(NAV_ACTIONS).toContain('open_file_quote');
    expect(NAV_LABELS.open_file_quote).toEqual({ he: 'פתיחת הצעת מחיר מקובץ', en: 'Open quote from a file' });
    expect(allowedNavigation({})).toContain('open_file_quote');
    expect(readFileSync('supabase/functions/chat-ai/index.ts', 'utf8'))
      .toContain("const fileQuestion = capabilityId === 'smart_quote' && QUOTE_FROM_FILE_REQUEST.some((re) => re.test(lastUserMessage));");
    expect(readFileSync('src/pages/Dashboard.jsx', 'utf8')).toMatch(/case 'open_file_quote':\r?\n {10}closeEditor\(\);\r?\n {10}setActiveTab\('main'\);\r?\n {10}handleCreateFileQuoteClickRef\.current\?\.\(\);/);
    expect(readFileSync('src/pages/Dashboard.jsx', 'utf8')).toContain('handleCreateFileQuoteClickRef.current = handleCreateFileQuoteClick;');
  });
});

// Owner console 2026-11-03 (typed approval incl. L-17): "רק מוזר שההסבר הוא כזה ארוך" - a file question gets three sentences
describe('the short answer to a quote-from-file question', () => {
  it('HE / EN: three sentences, the screen labels, the file not stored, the quota - and nothing about the AI smart quote', () => {
    const he = quoteFromFileAnswer(true);
    const en = quoteFromFileAnswer(false);
    for (const label of ['„הצעה חדשה”', '„הצעת מחיר מקובץ”', '„המחיר שלכם”', 'הקובץ לא נשמר', 'עד 50 קבצים בחודש', 'חכם פלוס']) expect(he).toContain(label);
    for (const label of ['"New quote"', '"Quote from a file"', '"Your price"', 'the file is not stored', 'up to 50 files a month', 'SMART PACK']) expect(en).toContain(label);
    expect(he).not.toMatch(/ניסיון|להכתיב|מיקרופון/);
    expect(en).not.toMatch(/trial|dictate|microphone/i);
    expect(he.split(/[.](?:\s|$)/).filter(Boolean)).toHaveLength(4); // "כן." + three sentences
    expect(he.length).toBeLessThan(300);
  });
  it('index.ts answers a file question with it (available, no role) and skips the long description and the steps', () => {
    const src = readFileSync('supabase/functions/chat-ai/index.ts', 'utf8');
    expect(src).toContain("const shortFile = fileQuestion && capabilityTruth.factPayload.truthStatus === 'AVAILABLE' && capabilityTruth.factPayload.requiredRole === null");
    expect(src).toContain('const capabilityAnswer = shortFile || (steps ?');
    expect(src).toContain("const navId = fileQuestion ? 'open_file_quote'");
  });
  it('the smart quote capability payload for a file question is AVAILABLE without a role (the short answer is reachable)', () => {
    const r = resolveCapabilityTruthResponse('smart_quote', facts, true);
    expect(r.factPayload.truthStatus).toBe('AVAILABLE');
    expect(r.factPayload.requiredRole).toBeNull();
  });
});

describe('the quota: decided for quote from a file, every other AI quota still undecided', () => {
  it('the plan-contents answer states 50 a month and 3 in the free days (HE / EN)', () => {
    const he = resolveSubscriptionTruthResponse('מה כלול במנוי?', true, null).answer;
    expect(he).toContain('עד 50 קבצים בחודש, ועד 3 בשבעת הימים החינמיים');
    expect(he).not.toContain('ניסיון'); // the Free plan is never called a trial
    expect(he).toContain('מכסות AI אחרות');
    const en = resolveSubscriptionTruthResponse('What does the subscription include?', false, null, false).answer;
    expect(en).toContain('up to 50 files a month, and up to 3 during the 7 free days');
    expect(en).toContain('other AI quotas');
  });
  it('the prompt block: the decided quota, and "AI quotas other than quote from a file" not decided', () => {
    const block = buildSubscriptionTruthBlock(false);
    expect(block).toContain('DECIDED AI quota');
    expect(block).toContain('AI quotas other than quote from a file');
  });
  it('"how many files are left" is never the Free-10 quote balance', () => {
    expect(classifySubscriptionIntents('כמה קבצים נשארו לי?')).not.toContain('balance');
    expect(classifySubscriptionIntents('How many quote from a file reads do I have left?')).not.toContain('balance');
    expect(classifySubscriptionIntents('כמה הצעות נשארו לי?')).toContain('balance');
  });
});

describe("the user's own file balance (quote_file_read_status, the caller's JWT)", () => {
  it('parses the server counter strictly; anything else is unknown', () => {
    expect(parseFileReadStatus({ ok: true, smartPack: true, period: '2026-11', limit: 50, used: 3, remaining: 47 })).toEqual({ remaining: 47, limit: 50, period: 'month' });
    expect(parseFileReadStatus({ ok: true, smartPack: true, period: 'free', limit: 3, used: 1, remaining: 2 })).toEqual({ remaining: 2, limit: 3, period: 'free' });
    expect(parseFileReadStatus({ ok: true, smartPack: false, period: '2026-11', limit: 0, used: 0, remaining: 0 })).toBeNull();
    expect(parseFileReadStatus({ ok: true, smartPack: true, limit: 50, remaining: 51 })).toBeNull();
    expect(parseFileReadStatus(null)).toBeNull();
  });
  it('fetch never throws and never invents a balance', async () => {
    expect(await fetchFileReadBalance(async () => ({ data: null, error: { code: '42501' } }))).toBeNull();
    expect(await fetchFileReadBalance(async () => { throw new Error('x'); })).toBeNull();
    expect(await fetchFileReadBalance(async (fn) => ({ data: fn === 'quote_file_read_status' ? { ok: true, smartPack: true, period: '2026-11', limit: 50, remaining: 47 } : null, error: null })))
      .toEqual({ remaining: 47, limit: 50, period: 'month' });
  });
  it('the verified account section states it, and only when known', () => {
    const withBalance = buildVerifiedAccountContext({ country: 'Local' }, null, null, { remaining: 47, limit: 50, period: 'month' });
    const prompt = buildSystemPrompt({ isHebrew: true, accountContext: withBalance });
    expect(prompt).toContain('Quote from a file (SMART PACK) balance: 47 of 50 files left this month');
    const none = buildSystemPrompt({ isHebrew: true, accountContext: buildVerifiedAccountContext({ country: 'Local' }, null, null) });
    expect(none).not.toContain('Quote from a file (SMART PACK) balance');
  });
});

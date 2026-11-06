// Owner console 2026-11-03 (typed: "מאשר תיקון כל אזכורי הצעת מחיר מקובץ לפי התוכנית (פעמון, צ'אט, מכסות ותנאי שימוש, יתרת קבצים בצ'אט,
// טיפ יומי, מסך ניהול, סוכנת הרשתות, בדיקת הלקוח ברשימת חכם פלוס), כולל שינוי ב-L-05, L-06, L-11, L-12, L-14, L-17 ו-L-22, שחרור עד הלייב"):
// the chat routes "quote from a file" questions to the right answer and button, knows its quota and the user's own file balance.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyCapabilityIntent, resolveCapabilityTruthResponse, QUOTE_FROM_FILE_REQUEST, quoteFromFileAnswer } from './capabilityTruth.ts';
import { howToStepsForCapability } from './howToTruth.ts';
import { classifySubscriptionIntents, resolveSubscriptionTruthResponse, buildSubscriptionTruthBlock } from './subscriptionTruth.ts';
import { parseSmartPackUsageStatus, fetchSmartPackUsage, buildVerifiedAccountContext } from './accountContext.ts';
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
    // Owner 2026-11-06: the quota is the SMART PACK usage meter (a percentage), never a count of files
    for (const label of ['„הצעה חדשה”', '„הצעת מחיר מקובץ”', '„המחיר שלכם”', 'הקובץ לא נשמר', 'במכסת השימוש החודשית של חכם פלוס', 'באחוזים']) expect(he).toContain(label);
    for (const label of ['"New quote"', '"Quote from a file"', '"Your price"', 'the file is not stored', 'monthly usage allowance', 'SMART PACK']) expect(en).toContain(label);
    expect(he + en).not.toMatch(/50|\b3 /);
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

// Owner console 2026-11-06 (typed night-task approval): the AI quota is the SMART PACK usage meter - it replaced the count of files
describe('the quota: the SMART PACK usage meter is decided (a monthly percentage); no count of files', () => {
  it('the plan-contents answer states the monthly usage allowance as a percentage, and no AI quota is "not decided" any more (HE / EN)', () => {
    const he = resolveSubscriptionTruthResponse('מה כלול במנוי?', true, null).answer;
    expect(he).toContain('מוגבלות במכסת שימוש חודשית; היתרה מוצגת באחוזים');
    expect(he).toContain('שאלה רגילה בצ׳אט לא נספרת');
    expect(he).not.toContain('ניסיון'); // the Free plan is never called a trial
    expect(he).not.toMatch(/מכסות AI אחרות|50 קבצים/);
    const en = resolveSubscriptionTruthResponse('What does the subscription include?', false, null, false).answer;
    expect(en).toContain('count against a monthly usage allowance, shown as a percentage left');
    expect(en).not.toMatch(/other AI quotas|50 files/);
  });
  it('the prompt block: the decided usage allowance; never a count stated as the limit', () => {
    const block = buildSubscriptionTruthBlock(false);
    expect(block).toContain('DECIDED AI quota');
    expect(block).toContain('Never state a number of files, checks, questions or voice actions as the limit.');
    expect(block).not.toContain('AI quotas other than quote from a file');
  });
  it('"how many files are left" is never the Free-10 quote balance', () => {
    expect(classifySubscriptionIntents('כמה קבצים נשארו לי?')).not.toContain('balance');
    expect(classifySubscriptionIntents('How many quote from a file reads do I have left?')).not.toContain('balance');
    expect(classifySubscriptionIntents('כמה הצעות נשארו לי?')).toContain('balance');
  });
});

describe("the user's own SMART PACK usage left (smart_pack_usage_status, the caller's JWT) - Owner 2026-11-06", () => {
  it('parses the server meter strictly; anything else is unknown', () => {
    expect(parseSmartPackUsageStatus({ ok: true, smartPack: true, unlimited: false, percentLeft: 63, usedMicros: 1480000 })).toEqual({ percentLeft: 63, unlimited: false });
    expect(parseSmartPackUsageStatus({ ok: true, smartPack: true, unlimited: true, percentLeft: 100 })).toEqual({ percentLeft: 100, unlimited: true });
    expect(parseSmartPackUsageStatus({ ok: true, smartPack: false, percentLeft: 100 })).toBeNull();
    for (const bad of [101, -1, 2.5, '63', null]) expect(parseSmartPackUsageStatus({ ok: true, smartPack: true, percentLeft: bad })).toBeNull();
    expect(parseSmartPackUsageStatus(null)).toBeNull();
  });
  it('fetch never throws and never invents a balance', async () => {
    expect(await fetchSmartPackUsage(async () => ({ data: null, error: { code: '42501' } }))).toBeNull();
    expect(await fetchSmartPackUsage(async () => { throw new Error('x'); })).toBeNull();
    expect(await fetchSmartPackUsage(async (fn) => ({ data: fn === 'smart_pack_usage_status' ? { ok: true, smartPack: true, percentLeft: 63 } : null, error: null })))
      .toEqual({ percentLeft: 63, unlimited: false });
  });
  it('the verified account section states it, and only when known', () => {
    const withUsage = buildVerifiedAccountContext({ country: 'Local' }, null, null, { percentLeft: 63, unlimited: false });
    const prompt = buildSystemPrompt({ isHebrew: true, accountContext: withUsage });
    expect(prompt).toContain('SMART PACK usage left this month: 63%.');
    expect(prompt).toContain('never a number of files, checks or questions');
    expect(buildSystemPrompt({ isHebrew: true, accountContext: buildVerifiedAccountContext({ country: 'Local' }, null, null, { percentLeft: 100, unlimited: true }) }))
      .toContain('SMART PACK usage: this account is not limited.');
    const none = buildSystemPrompt({ isHebrew: true, accountContext: buildVerifiedAccountContext({ country: 'Local' }, null, null) });
    expect(none).not.toContain('SMART PACK usage');
  });
});

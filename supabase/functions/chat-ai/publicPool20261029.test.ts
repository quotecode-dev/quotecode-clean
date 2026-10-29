// Codex release 2a (Owner 2026-10-29, typed: "מאשר שחרור 2א עכשיו: ביטול העברת הבעלות לפי מייל, חסימת לקוח של חשבון אחר, ותקרה של 500
// פניות ביום לצ'אט הציבורי (החלטה 4), כולל שינוי ב-L-17"). The pool itself is proven in the DB harness (433_security_release_2a.sql).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { reservePublicSlot, publicPoolAnswer, PublicPoolRefusal } from './publicPool.ts';

const src = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe('SEC-AI-01: the public pool of smart answers', () => {
  it('a reservation answers ok / exhausted, and anything else is unavailable (fail closed - no provider call)', async () => {
    expect(await reservePublicSlot(async () => ({ data: { allowed: true, used: 3, limit: 500 }, error: null }))).toBe('ok');
    expect(await reservePublicSlot(async () => ({ data: { allowed: false, limit: 500 }, error: null }))).toBe('exhausted');
    expect(await reservePublicSlot(async () => ({ data: null, error: { message: 'down' } }))).toBe('unavailable');
    expect(await reservePublicSlot(async () => ({ data: { what: 1 }, error: null }))).toBe('unavailable');
    expect(await reservePublicSlot(vi.fn(async () => { throw new Error('network'); }))).toBe('unavailable');
  });
  it('the fixed answers (HE / EN): exhausted vs temporarily unavailable; the site and the contact page stay', () => {
    expect(publicPoolAnswer(true, 'exhausted')).toBe('מכסת התשובות החכמות להיום נוצלה. אפשר להמשיך להיעזר במידע שבאתר או לפנות אלינו דרך עמוד יצירת הקשר.');
    expect(publicPoolAnswer(false, 'exhausted')).toBe('Today’s allowance for smart answers has been reached. You can still use the information on the site or contact us through the Contact page.');
    expect(publicPoolAnswer(true, 'unavailable')).toMatch(/^התשובות החכמות אינן זמינות כרגע\./);
    expect(publicPoolAnswer(false, 'unavailable')).toMatch(/^Smart answers are not available right now\./);
    expect(new PublicPoolRefusal('exhausted').reason).toBe('exhausted');
  });
  it('the wiring: every physical provider attempt of a non-verified caller reserves first; a refusal is never followed by a fallback', () => {
    const s = src('supabase/functions/chat-ai/index.ts');
    expect(s).toContain('const publicPool = !(verifiedUserId && isDashboard);');
    const call = s.indexOf('const callCheapModel = async (withTools: boolean, model: string) => {');
    const reserve = s.indexOf("adminClient.rpc('chat_ai_public_reserve')", call);
    expect(reserve).toBeGreaterThan(call);
    expect(reserve).toBeLessThan(s.indexOf("fetch('https://api.openai.com/v1/chat/completions'", call));
    expect(s).toContain('if (e instanceof PublicPoolRefusal) throw e; // no fallback attempt beyond the public pool');
    expect(s).toContain('const poolAnswer = publicPoolAnswer(isHebrew, e.reason);');
  });
});

describe('SEC-DB-02: a client of another account is never read', () => {
  it('the email reads the client only of the quote owner', () => {
    expect(src('supabase/functions/send-quote-email/index.ts')).toMatch(/\.eq\('id', quoteRow\.client_id\)\n\s+\.eq\('user_id', quoteRow\.user_id\)/);
  });
  it('the public page shows the client only of the quote owner', () => {
    const g = src('supabase/functions/get-public-quote/index.ts');
    expect(g.match(/clients \( user_id, company_name, email, phone, address \)/g)).toHaveLength(2);
    expect(g).toContain('client: quote.clients && quote.clients.user_id === quote.user_id ? {');
  });
});

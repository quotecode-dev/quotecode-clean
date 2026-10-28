// Owner console 2026-10-19: "איך אתה אומר שהוא לא ממציא והוא אמר לצרף צילום מסך" + "כן לצילום מסך ... העתק הדבק".
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeScreenshot, validateChatRequest, AI_CHAT_MAX_SCREENSHOT_CHARS } from './validation.ts';
import { buildNoInventionBlock, removeInventedOffers } from './noInvention.ts';
import { runToolLoop } from './chatTools.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('a screenshot in the question (Owner 2026-10-19)', () => {
  it('accepts one png / jpeg / webp data URL within the limit; anything else becomes null', () => {
    expect(sanitizeScreenshot(PNG)).toBe(PNG);
    expect(sanitizeScreenshot(PNG.replace('image/png', 'image/jpeg'))).not.toBeNull();
    expect(sanitizeScreenshot(PNG.replace('image/png', 'image/svg+xml'))).toBeNull();
    expect(sanitizeScreenshot('https://example.test/x.png')).toBeNull();
    expect(sanitizeScreenshot(`data:image/png;base64,${'A'.repeat(AI_CHAT_MAX_SCREENSHOT_CHARS)}`)).toBeNull();
    expect(sanitizeScreenshot(`${PNG}<script>`)).toBeNull();
    const v = validateChatRequest({ messages: [{ role: 'user', content: 'מה רואים פה?' }], isDashboard: true, screenshot: PNG });
    expect(v.ok && v.value.screenshot).toBe(PNG);
  });

  it('the stronger model receives the image on the LAST user message only, without a cheap first call', async () => {
    const sent = [];
    const fetchImpl = async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'רואים את חלון התבניות, והוא ריק.' }] }] }) }; };
    const out = await runToolLoop({ fetchImpl, apiKey: 'k', instructions: 'S', messages: [{ role: 'user', content: 'שאלה קודמת' }, { role: 'assistant', content: 'תשובה' }, { role: 'user', content: 'מה רואים פה?' }], firstCalls: [], ctx: { db: null, userId: 'u', accountCurrency: 'ILS', today: '2026-10-19' }, screenshot: PNG });
    expect(out.answer).toBe('רואים את חלון התבניות, והוא ריק.');
    expect(sent).toHaveLength(1);
    expect(sent[0].input[0]).toEqual({ role: 'user', content: 'שאלה קודמת' });
    expect(sent[0].input[2]).toEqual({ role: 'user', content: [{ type: 'input_text', text: 'מה רואים פה?' }, { type: 'input_image', image_url: PNG, detail: 'auto' }] });
  });

  it('index.ts: the screenshot only in the signed-in dashboard chat; it skips the cheap call and goes to the tool loop', () => {
    const src = fs.readFileSync(path.join(here, 'index.ts'), 'utf8');
    expect(src).toMatch(/const screenshot = toolCtx \? rawScreenshot : null;/);
    expect(src).toMatch(/if \(!screenshot\) \{\s+try \{\s+const openAiResponse = await callCheapWithFallback/);
    expect(src).toMatch(/if \(toolCtx && \(firstCalls\.length \|\| screenshot\)\)/);
    expect(src).toMatch(/instructions: modelInstructions, messages, firstCalls, ctx: toolCtx, screenshot,/);
  });
});

describe('no invented actions (Owner 2026-10-19)', () => {
  it('the prompt rule is in every model call and says what can / cannot be attached', () => {
    expect(buildNoInventionBlock(true, true)).toMatch(/Never offer, describe or suggest a button/);
    expect(buildNoInventionBlock(true, true)).toMatch(/CAN paste one screenshot/);
    expect(buildNoInventionBlock(false, false)).toMatch(/can NOT attach screenshots, files or documents/);
    expect(buildNoInventionBlock(true, false)).toMatch(/support@tekango\.com/);
    const src = fs.readFileSync(path.join(here, 'index.ts'), 'utf8');
    expect(src).toMatch(/const promptWithRules = systemPrompt \+ buildNoInventionBlock\(isHebrew, !!toolCtx\);/);
    expect(src).toMatch(/content: withTools \? modelInstructions : promptWithRules/);
    expect(src).toMatch(/aiReply = removeInventedOffers\(aiReply, \{ screenshots: !!toolCtx \}\);/);
  });

  it('removes a sentence offering to receive a file (always) or a screenshot (where the chat cannot take one); keeps the rest', () => {
    const he = 'ההודעה אומרת שאין עדיין תבניות. אפשר גם לצרף צילום מסך, ואכוון אותך. אפשר לשלוח לי קובץ PDF של ההצעה.';
    expect(removeInventedOffers(he, { screenshots: true })).toBe('ההודעה אומרת שאין עדיין תבניות. אפשר גם לצרף צילום מסך, ואכוון אותך.');
    expect(removeInventedOffers(he, { screenshots: false })).toBe('ההודעה אומרת שאין עדיין תבניות.');
    expect(removeInventedOffers('You can attach the PDF here. Templates are under New quote.', { screenshots: true })).toBe('Templates are under New quote.');
    const clean = 'בעורך ההצעה יש „שמירה כתבנית (בלי פרטי לקוח)”.\nאחר כך: הצעה חדשה ← התחלה מתבנית שמורה.';
    expect(removeInventedOffers(clean, { screenshots: false })).toBe(clean);
  });
});

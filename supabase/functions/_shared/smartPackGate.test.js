// Owner console 2026-10-20 (typed: "מאשר שינוי ב-L-17: חסימת הצ'אט החכם, הצ'אט הקולי וההצעה החכמה בלי חכם פלוס"): the SMART PACK gate of
// the smart Edge Functions - enforced only while the plan system is; the caller's own summary; unreadable = today's access (legacy).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { smartPackAllowedFor, smartPackAllowedBySummary, SMART_PACK_REQUIRED } from './smartPackGate.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const summary = (over = {}) => ({ ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'enforced', catalog: 'prepared', billing: 'off' },
  market: 'IL', plan: { id: 'free' }, subscriptionStatus: 'none', capabilities: ['quote_style.classic'], eligiblePlans: {},
  free10: { limit: 10, consumed: 1, reserved: 0, remaining: 9 }, catalog: { active: 0, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false },
  priceCatalogVersion: null, smartPack: { active: false, source: null, until: null }, ...over });
const client = (answer) => { const calls = []; return { calls, rpc: (fn) => { calls.push(fn); return Promise.resolve(answer); } }; };

describe('smartPackAllowedFor', () => {
  it('reads ONLY the caller\'s own summary; enforced without SMART PACK = refused, with it = allowed', async () => {
    const c = client({ data: summary(), error: null });
    expect(await smartPackAllowedFor(c)).toBe(false);
    expect(c.calls).toEqual(['get_account_summary']);
    expect(await smartPackAllowedFor(client({ data: summary({ smartPack: { active: true, source: 'lifetime', until: null } }), error: null }))).toBe(true);
    expect(SMART_PACK_REQUIRED).toBe('smart_pack_required');
  });
  it('plans not activated / a plan system not enforced keep today\'s access (L-05; the database gates stay authoritative)', async () => {
    expect(await smartPackAllowedFor(client({ data: { ok: false, code: 'not_activated' }, error: null }))).toBe(true);
    expect(await smartPackAllowedFor(client({ data: summary({ phase: { output: 'shadow', catalog: 'prepared', billing: 'off' } }), error: null }))).toBe(true);
  });
  // Owner console 2026-10-25 (typed: "מאשר שינוי ב-L-05: יכולות חכם פלוס נחסמות ברגע הלחיצה למי שאין לו חכם פלוס")
  it('an unreadable answer is refused: an error, a rejected call, an unknown shape, an account not provisioned', async () => {
    expect(await smartPackAllowedFor(client({ data: null, error: { message: 'x' } }))).toBe(false);
    expect(await smartPackAllowedFor({ rpc: () => Promise.reject(new Error('down')) })).toBe(false);
    expect(await smartPackAllowedFor(client({ data: { ok: true, schema: 'other' }, error: null }))).toBe(false);
    expect(await smartPackAllowedFor(client({ data: { ok: false, code: 'account_not_provisioned' }, error: null }))).toBe(false);
  });
  it('smartPackAllowedBySummary: ready = decideSmartPack, not_activated = allowed, anything else (null / loading / invalid) = refused', () => {
    expect(smartPackAllowedBySummary({ state: 'not_activated', code: 'not_activated' })).toBe(true);
    for (const s of [null, undefined, { state: 'loading' }, { state: 'invalid', code: 'schema' }, { state: 'unavailable', code: 'not_authenticated' }]) {
      expect(smartPackAllowedBySummary(s)).toBe(false);
    }
  });
});

describe('chat-ai (source guard)', () => {
  const src = fs.readFileSync(path.join(HERE, '..', 'chat-ai', 'index.ts'), 'utf8').replace(/\r\n/g, '\n');
  it('the data tools need SMART PACK; a data question without it gets the fixed SMART PACK answer (HE / EN)', () => {
    expect(src).toMatch(/const smartPackAllowed = smartPackAllowedBySummary\(accountSummary\);\n {2}const toolsEligible = !!\(verifiedUserId && isDashboard && accountContext && !draftSnapshot && smartPackAllowed\);/);
    // Owner console 2026-10-25 (typed findings 1-13 approval, L-17): "the plans window", and the promise only where it can be bought now
    expect(src).toMatch(/const canAdd = smartPackPurchasePath\(accountSummary\) !== null;/);
    expect(src).toMatch(/`קריאת הנתונים שלכם בצ׳אט \(הצעות, לקוחות, קטלוג ומשימות\) היא חלק מחכם פלוס\.\$\{canAdd \? ' אפשר להוסיף אותו בחלון המסלולים\.' : ''\}`/);
    expect(src).toMatch(/`Reading your own data in the chat \(quotes, clients, catalog and tasks\) is part of SMART PACK\.\$\{canAdd \? ' You can add it in the plans window\.' : ''\}`/);
  });
});

describe('chat-ai: no data tool without SMART PACK (Codex audit H01, Owner 2026-10-21)', () => {
  const src = fs.readFileSync(path.join(HERE, '..', 'chat-ai', 'index.ts'), 'utf8').replace(/\r\n/g, '\n');
  it('the tool context itself requires SMART PACK, so a paraphrase that escaped the question classification never reaches the data', () => {
    expect(src).toMatch(/const toolCtx: ToolContext \| null = smartPackAllowed && userJwtClient && verifiedUserId && accountContext && !reviewSnapshot/);
  });
});

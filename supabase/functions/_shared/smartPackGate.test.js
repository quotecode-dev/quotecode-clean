// Owner console 2026-10-20 (typed: "מאשר שינוי ב-L-17: חסימת הצ'אט החכם, הצ'אט הקולי וההצעה החכמה בלי חכם פלוס"): the SMART PACK gate of
// the smart Edge Functions - enforced only while the plan system is; the caller's own summary; unreadable = today's access (legacy).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { smartPackAllowedFor, SMART_PACK_REQUIRED } from './smartPackGate.ts';

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
  it('plans off / not provisioned / an unreadable answer keep today\'s access (L-05; the database gates stay authoritative)', async () => {
    expect(await smartPackAllowedFor(client({ data: { ok: false, code: 'not_activated' }, error: null }))).toBe(true);
    expect(await smartPackAllowedFor(client({ data: summary({ phase: { output: 'shadow', catalog: 'prepared', billing: 'off' } }), error: null }))).toBe(true);
    expect(await smartPackAllowedFor(client({ data: null, error: { message: 'x' } }))).toBe(true);
    expect(await smartPackAllowedFor({ rpc: () => Promise.reject(new Error('down')) })).toBe(true);
  });
});

describe('chat-ai (source guard)', () => {
  const src = fs.readFileSync(path.join(HERE, '..', 'chat-ai', 'index.ts'), 'utf8').replace(/\r\n/g, '\n');
  it('the data tools need SMART PACK; a data question without it gets the fixed SMART PACK answer (HE / EN)', () => {
    expect(src).toMatch(/const smartPackAllowed = decideSmartPack\(accountSummary\)\.allowed;\n {2}const toolsEligible = !!\(verifiedUserId && isDashboard && accountContext && !draftSnapshot && smartPackAllowed\);/);
    expect(src).toMatch(/'קריאת הנתונים שלך בצ׳אט \(הצעות, לקוחות, קטלוג ומשימות\) היא חלק מחכם פלוס\. אפשר להוסיף אותו במסך המסלולים\.'/);
    expect(src).toMatch(/'Reading your own data in the chat \(quotes, clients, catalog and tasks\) is part of SMART PACK\. You can add it in the plans view\.'/);
  });
});

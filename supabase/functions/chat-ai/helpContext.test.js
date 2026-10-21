import { describe, it, expect } from 'vitest';
import { deriveTrustedFacts, reconcileBlockers, classifyHelpIntent, deterministicHelpAnswer, buildHelpContextBlocks, monthStartIso, sanitizeHelpContext, describeAccountPlan } from './helpContext.ts';
import { NO_ACCOUNT_PLAN } from './accountContext.ts';
import { extractNavigationAction } from './navigation.ts';
import { buildSystemPrompt } from './validation.ts';

// AI HELP V4 server side: the server re-derives identity/market/entitlement/profile facts (Layer 3), reconciles every browser-reported
// blocker against them (contradicted and stale claims are dropped), answers why-blocked / is-it-saved deterministically, and filters
// navigation per turn. Browser context never overrides a server fact.

const NOW = Date.now();
// Subscriptions cutover: the account's plan facts are only the server account summary projection (default: phase off -> not_activated).
const NOT_ACTIVATED = { ...NO_ACCOUNT_PLAN, summaryState: 'not_activated' };
const READY_FREE_ENFORCED = { summaryState: 'ready', planId: 'free', free10Remaining: 4, subscriptionStatus: 'none', outputPhase: 'enforced' };
const acct = (over = {}) => ({ market: 'Local', account: NOT_ACTIVATED, currentArea: null, ...over });
const ctx = (over = {}) => sanitizeHelpContext({ version: 4, revision: 1, screen: 'quote_editor_new', section: 'client_details', workflowId: 'create_quote', object: { kind: 'quote', provenance: 'UNSAVED_LOCAL_DRAFT' }, draft: { mode: 'create', dirty: true, localWriteStatus: 'written' }, facts: {}, blockers: [], capturedAt: NOW, ...over }, NOW);
const blk = (code, extra = {}) => ({ code, occurredAt: NOW, ...extra });

describe('deriveTrustedFacts (Layer 3)', () => {
  it('Local: phone + tax id required; International: tax id never required', () => {
    const l = deriveTrustedFacts(acct(), { phone: '', tax_id: '' }, 2);
    expect(l.profile.missingFields).toEqual(['business_phone', 'business_tax_id']);
    const i = deriveTrustedFacts(acct({ market: 'International' }), { phone: '+1 5551234', tax_id: '' }, 2);
    expect(i.profile).toMatchObject({ phoneComplete: true, taxIdRequired: false, missingFields: [] });
  });
  it('a dial code alone is not a phone (same rule as the browser gate)', () => {
    expect(deriveTrustedFacts(acct(), { phone: '+972 ', tax_id: '1' }, 0).profile.phoneComplete).toBe(false);
  });
  it('no monthly counter, no legacy tier, no trial: the plan facts are only the server summary projection', () => {
    const f = deriveTrustedFacts(acct(), { role: 'super_admin' }, null);
    expect(f).toMatchObject({ isAdmin: true, account: NOT_ACTIVATED, enforcedCapabilities: null });
    expect(f).not.toHaveProperty('monthlyQuotes');
    expect(f).not.toHaveProperty('tier');
    expect(f).not.toHaveProperty('trialStatus');
    expect(f).not.toHaveProperty('attachmentsEntitled');
  });
  it('server capabilities count only for a READY summary whose output phase is ENFORCED', () => {
    expect(deriveTrustedFacts(acct({ account: READY_FREE_ENFORCED }), null, ['quote_style.classic']).enforcedCapabilities).toEqual(['quote_style.classic']);
    expect(deriveTrustedFacts(acct({ account: { ...READY_FREE_ENFORCED, outputPhase: 'prepared' } }), null, ['quote_style.classic']).enforcedCapabilities).toBeNull();
    expect(deriveTrustedFacts(acct(), null, ['quote_attachment.upload']).enforcedCapabilities).toBeNull();
  });
  it('describeAccountPlan: a ready summary names the canonical plan + Free balance; otherwise it forbids guessing', () => {
    expect(describeAccountPlan(READY_FREE_ENFORCED)).toMatch(/Plan \(server account summary\): free; Free quotes remaining: 4 of 10/);
    const off = describeAccountPlan(NOT_ACTIVATED);
    expect(off).toMatch(/no active plan/); expect(off).toMatch(/not_activated/); expect(off).toMatch(/Do not state or guess a plan, a balance or a trial/);
    expect(off).not.toMatch(/\bpro\b|\bbasic\b|unlimited|monthly/i);
  });
  it('unknown market (region not chosen) is a missing prerequisite', () => {
    expect(deriveTrustedFacts(acct({ market: 'Unknown' }), null, null).profile.missingFields).toContain('business_region');
  });
  it('monthStartIso: Local month starts at Jerusalem midnight, International at UTC midnight', () => {
    const d = new Date('2026-09-22T10:00:00Z');
    expect(monthStartIso('International', d)).toBe('2026-09-01T00:00:00.000Z');
    expect(monthStartIso('Local', d)).toBe('2026-08-31T21:00:00.000Z');
  });
});

describe('reconcileBlockers (browser claims vs server truth)', () => {
  it('a forged profile blocker is dropped when the server says the profile is complete', () => {
    const f = deriveTrustedFacts(acct(), { phone: '+972 501234567', tax_id: '515' }, 1);
    const { active, dropped } = reconcileBlockers(ctx({ blockers: [blk('PROFILE_MISSING_PHONE')] }), f);
    expect(active).toHaveLength(0); expect(dropped.map((b) => b.code)).toEqual(['PROFILE_MISSING_PHONE']);
  });
  it('a real profile blocker is confirmed', () => {
    const f = deriveTrustedFacts(acct(), { phone: '', tax_id: '515' }, 1);
    expect(reconcileBlockers(ctx({ blockers: [blk('PROFILE_MISSING_PHONE')] }), f).active[0].confirmation).toBe('confirmed');
  });
  it('retired plan-model blockers (monthly limit, trial) never reach the assistant, with or without server facts', () => {
    for (const code of ['MONTHLY_QUOTE_LIMIT_REACHED', 'TRIAL_EXPIRED']) {
      expect(reconcileBlockers(ctx({ blockers: [blk(code)] }), deriveTrustedFacts(acct(), null, null)).active).toHaveLength(0);
      expect(reconcileBlockers(ctx({ blockers: [blk(code)] }), null).active).toHaveLength(0);
    }
  });
  it('legacy alias codes are normalised to the neutral canonical codes', () => {
    const c = ctx({ blockers: [blk('ATTACHMENTS_REQUIRE_PRO'), blk('WHATSAPP_REQUIRES_PRO')] });
    expect(c.blockers.map((b) => b.code)).toEqual(['ATTACHMENTS_NOT_INCLUDED', 'PLAN_FEATURE_LOCKED']);
  });
  it('an attachments lock is confirmed / contradicted ONLY by an enforced server summary; otherwise it stays a client report', () => {
    const c = ctx({ blockers: [blk('ATTACHMENTS_NOT_INCLUDED')] });
    expect(reconcileBlockers(c, deriveTrustedFacts(acct(), null, null)).active[0].confirmation).toBe('client_reported');
    expect(reconcileBlockers(c, deriveTrustedFacts(acct({ account: READY_FREE_ENFORCED }), null, ['quote_style.classic'])).active[0].confirmation).toBe('confirmed');
    expect(reconcileBlockers(c, deriveTrustedFacts(acct({ account: READY_FREE_ENFORCED }), null, ['quote_attachment.upload'])).active).toHaveLength(0);
  });
  it('an Admin blocker from a non-admin is dropped (no admin help leakage)', () => {
    const { active } = reconcileBlockers(ctx({ blockers: [blk('ADMIN_PROTECTED_ACTION')] }), deriveTrustedFacts(acct(), null, 0));
    expect(active).toHaveLength(0);
  });
  it('stale blockers are dropped', () => {
    const { active, dropped } = reconcileBlockers(ctx({ blockers: [blk('QUOTE_SAVE_SERVER_ERROR', { occurredAt: NOW - 11 * 60 * 1000 })] }), null);
    expect(active).toHaveLength(0); expect(dropped).toHaveLength(1);
  });
});

describe('classifyHelpIntent', () => {
  it.each(['Why can\'t I save this quote?', 'What is missing?', 'Save is blocked, what do I need?', 'למה אני לא מצליח לשמור?', 'מה חסר?', 'למה ההצעה לא נשמרת?'])('why_blocked: %s', (m) => expect(classifyHelpIntent(m)).toBe('why_blocked'));
  it.each(['Is my draft saved?', 'Is it saved in the cloud?', 'Will I lose my work?', 'Is this quote saved?', 'Have my changes been saved?', 'Did my quote save?', 'האם הטיוטה שמורה?', 'זה נשמר בענן?', 'האם ההצעה נשמרה?', 'ההצעה נשמרה?', 'אני אאבד את השינויים?', 'האם ההצעה הזו שמורה?', 'ההצעה שלי שמורה?', 'האם הטיוטה שלי שמורה?'])('save_status: %s', (m) => expect(classifyHelpIntent(m)).toBe('save_status'));
  it('a Hebrew "why was it not saved" stays a why-blocked question', () => expect(classifyHelpIntent('למה ההצעה לא נשמרה?')).toBe('why_blocked'));
  it.each(['How do I add a client?', 'What does the Visual plan include?', 'איך מוסיפים לקוח?'])('neither: %s', (m) => expect(classifyHelpIntent(m)).toBeNull());
});

describe('deterministicHelpAnswer', () => {
  const localMissing = deriveTrustedFacts(acct(), { phone: '', tax_id: '' }, 0);
  it('HE: missing Local profile -> explains, names fields, offers the phone destination with a product focus id', () => {
    const c = ctx({ blockers: [blk('PROFILE_MISSING_PHONE'), blk('PROFILE_MISSING_TAX_ID')] });
    const { active } = reconcileBlockers(c, localMissing);
    const r = deterministicHelpAnswer('why_blocked', c, active, localMissing, true, false);
    expect(r.answer).toMatch(/טלפון העסק/); expect(r.answer).toMatch(/ח\.פ/);
    expect(r.navigation).toEqual({ action: 'open_business_phone', focus: 'business_phone' });
  });
  it('EN International: never mentions a tax ID requirement or Local money', () => {
    const f = deriveTrustedFacts(acct({ market: 'International' }), { phone: '', tax_id: '' }, 0);
    const c = ctx({ blockers: [blk('PROFILE_MISSING_PHONE')] });
    const r = deterministicHelpAnswer('why_blocked', c, reconcileBlockers(c, f).active, f, false, false);
    expect(r.answer).toMatch(/Business Phone/); expect(r.answer).not.toMatch(/Tax ID|VAT|₪|[֐-׿]/);
  });
  it('server prerequisite answers even before the browser reported a blocker (New Quote + missing phone)', () => {
    const r = deterministicHelpAnswer('why_blocked', ctx(), [], localMissing, false, false);
    expect(r.answer).toMatch(/Business Phone/);
    expect(r.navigation.action).toBe('open_business_phone');
  });
  it('save_status on an unsaved new quote: local only, never "saved in the cloud"', () => {
    const r = deterministicHelpAnswer('save_status', ctx(), [], localMissing, false, false);
    expect(r.answer).toMatch(/not on the server/); expect(r.answer).not.toMatch(/saved (in|to) the cloud/i);
    expect(r.navigation).toBeNull();
  });
  it('save_status after a network failure: unknown, check before retrying', () => {
    const c = ctx({ object: { kind: 'quote', provenance: 'UNKNOWN_SAVE_RESULT' } });
    expect(deterministicHelpAnswer('save_status', c, [], null, false, false).answer).toMatch(/not certain/);
  });
  it('no blocker and no prerequisite -> no deterministic answer (the model answers normally)', () => {
    const f = deriveTrustedFacts(acct(), { phone: '+972 501', tax_id: '1' }, 0);
    expect(deterministicHelpAnswer('why_blocked', ctx(), [], f, false, false)).toBeNull();
  });
});

describe('prompt layering + per-turn navigation filter', () => {
  it('Layer 3 facts, Layer 2 context, active blockers and ignored claims are all labelled; no raw values', () => {
    const f = deriveTrustedFacts(acct(), { phone: '050-SECRET', tax_id: '999999999' }, 3);
    const c = ctx({ blockers: [blk('PROFILE_MISSING_PHONE'), blk('QUOTE_SAVE_SERVER_ERROR')] });
    const { active, dropped } = reconcileBlockers(c, f);
    const txt = buildHelpContextBlocks(c, active, dropped, f, false);
    expect(txt).toMatch(/LAYER 3 - TRUSTED SERVER FACTS/); expect(txt).toMatch(/LAYER 2 - DYNAMIC WORKFLOW CONTEXT/);
    expect(txt).toMatch(/BLOCKED_WORKFLOW_HELP/); expect(txt).toMatch(/Ignored blocker claims.*PROFILE_MISSING_PHONE/);
    expect(txt).not.toMatch(/SECRET|999999999/);
    expect(txt).toMatch(/A local draft is NOT saved on the server/);
    expect(txt).toMatch(/Plan: no active plan/);
    expect(txt).not.toMatch(/Monthly quotes|plan tier|trial:|PRO only/);
  });
  it('the help text of the plan blockers never names a legacy plan, a monthly limit or a trial (HE + EN)', () => {
    const c = ctx({ blockers: [blk('ATTACHMENTS_NOT_INCLUDED'), blk('PLAN_FEATURE_LOCKED')] });
    for (const he of [true, false]) {
      const txt = buildHelpContextBlocks(c, reconcileBlockers(c, null).active, [], null, he);
      expect(txt).not.toMatch(/\bPRO\b|\bBASIC\b|monthly|trial|חודשי|ניסיון/i);
      expect(txt).toMatch(he ? /(?:טרם|עדיין לא) הוחלט/ : /has not been decided yet/);
    }
  });
  it('a model NAVIGATE marker outside this turn\'s allowed set is stripped and ignored', () => {
    const r = extractNavigationAction('Go there.\nNAVIGATE: open_admin', false, ['open_business_phone']);
    expect(r.action).toBeNull(); expect(r.answer).toBe('Go there.');
    expect(extractNavigationAction('x\nNAVIGATE: open_business_phone', false, ['open_business_phone']).action).toBe('open_business_phone');
    expect(extractNavigationAction('x\nNAVIGATE: https://evil.example', false, null).action).toBeNull();
  });
  it('the system prompt states AI-HELP-AVAILABILITY-001 and includes the help blocks when present', () => {
    const p = buildSystemPrompt({ isHebrew: false, guidedIntent: null, guidedSubtopic: null, accountContext: null, quoteContextBlock: null, workflowContext: null, helpBlocks: 'LAYER 2 - DYNAMIC WORKFLOW CONTEXT (x)', allowedNavigation: ['open_business_phone'] });
    expect(p).toMatch(/AI-HELP-AVAILABILITY-001/); expect(p).toContain('LAYER 2 - DYNAMIC WORKFLOW CONTEXT (x)');
  });
});

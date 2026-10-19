// @vitest-environment node
// MD-1 (First-LIVE cutover compatibility, 2026-09-25): every chat-ai SUCCESS envelope carries BOTH the v4 `answer` and the legacy
// `choices[0].message.content` read by the LIVE-baseline widget (7cd78ea), as a pure mirror of the same final answer string. Error
// envelopes are unchanged. Proven with the real Product Truth resolvers (HE Local / EN International), both client parsers (the legacy one
// verbatim from 7cd78ea AIChatWidget.jsx:110-122, the v4 one from the current widget), and static checks on index.ts.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildErrorEnvelope, withLegacyChoices, CHAT_CONTRACT_VERSION } from '../_shared/aiChatContract.ts';
import { resolvePaymentTruthResponse } from './paymentTruth.ts';
import { resolveInvoicingTruthResponse } from './invoicingTruth.ts';
import { formatAccountMarketAnswer } from './marketTruth.ts';
import { buildAccountMarketFactPayload, NO_ACCOUNT_FACTS } from './productTruthPayload.ts';
import { AI_FACTS } from './aiFacts.generated.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = readFileSync(resolve(HERE, 'index.ts'), 'utf8');

// Legacy (7cd78ea) widget parser, verbatim logic: `if (data && data.choices && data.choices.length > 0) { aiReply = data.choices[0].message.content; swap } else throw`.
function legacyParse(data, isHebrew) {
  if (data && data.choices && data.choices.length > 0) {
    let aiReply = data.choices[0].message.content;
    if (!isHebrew) aiReply = aiReply.replace(/support@tekango\.com/gi, 'info@tekango.com');
    else aiReply = aiReply.replace(/info@tekango\.com/gi, 'support@tekango.com');
    return aiReply;
  }
  throw new Error('Invalid response format from AI');
}
// v4 widget parser (src/AIChatWidget.jsx): error -> throw; answer must be a string; same support-email swap.
function v4Parse(data, isHebrew) {
  if (!data || data.error) throw new Error(data?.error?.message || 'Invalid response format from AI');
  if (typeof data.answer !== 'string') throw new Error('Invalid response format from AI');
  if (!isHebrew) return data.answer.replace(/support@tekango\.com/gi, 'info@tekango.com');
  return data.answer.replace(/info@tekango\.com/gi, 'support@tekango.com');
}
// What actually crosses the wire: the JSON-serialized envelope.
const wire = (envelope) => JSON.parse(JSON.stringify(envelope));
const success = (answer, extra = {}) => withLegacyChoices({ contractVersion: CHAT_CONTRACT_VERSION, requestId: 'r', contextRevision: null, answer, answerSource: 'deterministic', factPayload: null, navigation: null, selectedQuoteContext: null, helpMode: null, blockerCodes: [], privateHelp: false, error: null, ...extra });

const LOCAL = Object.freeze({ market: 'Local', tier: 'pro', isAdmin: false });
const INTL = Object.freeze({ market: 'International', tier: 'pro', isAdmin: false });
const CASES = [
  ['HE Local - payment truth', true, () => resolvePaymentTruthResponse(true, AI_FACTS.billing, LOCAL)],
  ['EN International - payment truth', false, () => resolvePaymentTruthResponse(false, AI_FACTS.billing, INTL)],
  ['HE Local - invoicing truth', true, () => resolveInvoicingTruthResponse(true, AI_FACTS.invoicing, LOCAL)],
  ['EN International - invoicing truth', false, () => resolveInvoicingTruthResponse(false, AI_FACTS.invoicing, INTL)],
  ['HE Local - account market', true, () => { const p = buildAccountMarketFactPayload(LOCAL); return { answer: formatAccountMarketAnswer(true, p), factPayload: p }; }],
  ['EN International - account market', false, () => { const p = buildAccountMarketFactPayload(INTL); return { answer: formatAccountMarketAnswer(false, p), factPayload: p }; }],
  ['public (no account) EN - payment truth', false, () => resolvePaymentTruthResponse(false, AI_FACTS.billing, NO_ACCOUNT_FACTS)],
];

describe('MD-1 schema: withLegacyChoices', () => {
  it('adds exactly one legacy choice that mirrors answer; every other field unchanged; input not mutated', () => {
    const base = { contractVersion: 4, requestId: 'x', contextRevision: 7, answer: 'שלום', answerSource: 'model', factPayload: null, navigation: { action: 'open_quotes', focus: null }, selectedQuoteContext: null, error: null };
    const snapshot = JSON.stringify(base);
    const env = withLegacyChoices(base);
    expect(JSON.stringify(base)).toBe(snapshot);
    const { choices, ...rest } = env;
    expect(rest).toEqual(base);
    expect(choices).toEqual([{ index: 0, message: { role: 'assistant', content: 'שלום' }, finish_reason: 'stop' }]);
  });
  it('the legacy field carries nothing but the answer (no fact payload, navigation, tenant or account data)', () => {
    const env = wire(success('Hello', { factPayload: { kind: 'product_truth', secret: 'x' }, navigation: { action: 'open_settings', focus: 'business_phone' } }));
    expect(JSON.stringify(env.choices)).toBe(JSON.stringify([{ index: 0, message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }]));
  });
  it('error envelopes are unchanged: no choices; both parsers fail closed exactly as before', () => {
    for (const code of ['invalid_request', 'unauthenticated_private_context', 'provider_failure', 'malformed_provider_response', 'internal_error']) {
      const env = wire(buildErrorEnvelope(code, 'm'));
      expect(env.choices).toBeUndefined(); expect(env.answer).toBeNull(); expect(env.error).toEqual({ code, message: 'm' });
      expect(() => legacyParse(env, true)).toThrow('Invalid response format from AI');
      expect(() => v4Parse(env, false)).toThrow('m');
    }
  });
});

describe('MD-1 matrix: real Product Truth answers through the dual envelope, parsed by the legacy AND the v4 widget', () => {
  it.each(CASES)('%s: one semantic answer, both parsers render the identical text; structured payload preserved', (_label, isHebrew, resolveTruth) => {
    const truth = resolveTruth();
    expect(typeof truth.answer).toBe('string'); expect(truth.answer.length).toBeGreaterThan(0);
    const env = wire(success(truth.answer, { factPayload: truth.factPayload }));
    expect(env.choices[0].message.content).toBe(env.answer);
    expect(legacyParse(env, isHebrew)).toBe(v4Parse(env, isHebrew));
    expect(env.factPayload).toEqual(JSON.parse(JSON.stringify(truth.factPayload)));
  });
  it('HE and EN answers stay in their own language (market separation unchanged by the mirror)', () => {
    const he = wire(success(resolvePaymentTruthResponse(true, AI_FACTS.billing, LOCAL).answer));
    const en = wire(success(resolvePaymentTruthResponse(false, AI_FACTS.billing, INTL).answer));
    expect(he.choices[0].message.content).toMatch(/[֐-׿]/);
    expect(en.choices[0].message.content).not.toMatch(/[֐-׿]/);
  });
});

describe('MD-1 static contract on chat-ai/index.ts', () => {
  const responses = [...INDEX.matchAll(/new Response\(JSON\.stringify\(([A-Za-z]+)\(/g)].map((m) => m[1]);
  it('every JSON response is either the unchanged error envelope or a withLegacyChoices success envelope (3 success sites)', () => {
    expect(responses.filter((f) => f === 'withLegacyChoices')).toHaveLength(3);
    expect(responses.filter((f) => f === 'buildErrorEnvelope')).toHaveLength(1);
    expect(responses.every((f) => f === 'withLegacyChoices' || f === 'buildErrorEnvelope')).toBe(true);
    expect(INDEX.match(/new Response\(/g)).toHaveLength(5); // + the CORS preflight 'ok'
  });
  it('no second model call, no alternate prompt: exactly one provider fetch, and `choices` is only READ from the provider response', () => {
    expect(INDEX.match(/fetch\(/g)).toHaveLength(1);
    expect(INDEX.match(/buildSystemPrompt\(/g)).toHaveLength(1);
    expect([...INDEX.matchAll(/choices/g)]).toHaveLength(1);
    expect(INDEX).toMatch(/data\?\.choices as Array/);
  });
});

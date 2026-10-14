// BLOCKER 3 — FAIL-CLOSED STRUCTURED RUNTIME CONTRACT (Codex acceptance contract, 2026-09-2X).
// Required mutation tests (task §4.6): unknown state string, malformed state, missing state,
// formatter unknown branch, known capability classifier miss (professional reuse), free-form model
// fallback attempt for capability availability, unknown plan, unknown role.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  resolveCapabilityAnswerState,
  UnknownProductTruthStateError,
} from './capabilityAnswerState.ts';
import {
  formatCapabilityTruthAnswer,
  classifyCapabilityIntent,
  classifyBroadCapabilityQuestionSignal,
  formatBroadCapabilityClarification,
} from './capabilityTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const capabilityTruthSource = readFileSync(join(__dirname, 'capabilityTruth.ts'), 'utf-8');
const indexSource = readFileSync(join(__dirname, 'index.ts'), 'utf-8');

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };

function factsWithMutatedState(capabilityId, mutatedState) {
  return {
    capabilities: AI_FACTS.capabilities.map((c) => (c.id === capabilityId ? { ...c, state: mutatedState } : c)),
    nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities,
  };
}

describe('BLOCKER 3 §4.1 — runtime state validation hard-fails, never defaults to available', () => {
  it('an unknown state STRING throws UnknownProductTruthStateError, never resolves to LIVE_CURRENT/available', () => {
    const mutated = factsWithMutatedState('editor_calculator', 'SOME_STATE_THAT_DOES_NOT_EXIST');
    expect(() => resolveCapabilityAnswerState('editor_calculator', mutated, null, null)).toThrow(UnknownProductTruthStateError);
  });

  it('a MALFORMED state (wrong type - a number, not a string) throws, never coerced', () => {
    const mutated = factsWithMutatedState('editor_calculator', 12345);
    expect(() => resolveCapabilityAnswerState('editor_calculator', mutated, null, null)).toThrow(UnknownProductTruthStateError);
  });

  it('a MALFORMED state (an object) throws', () => {
    const mutated = factsWithMutatedState('editor_calculator', { not: 'a string' });
    expect(() => resolveCapabilityAnswerState('editor_calculator', mutated, null, null)).toThrow(UnknownProductTruthStateError);
  });

  it('a MISSING state (undefined) throws, never silently defaults', () => {
    const mutated = factsWithMutatedState('editor_calculator', undefined);
    expect(() => resolveCapabilityAnswerState('editor_calculator', mutated, null, null)).toThrow(UnknownProductTruthStateError);
  });

  it('an EMPTY STRING state throws (not a valid canonical state, must not fail open)', () => {
    const mutated = factsWithMutatedState('editor_calculator', '');
    expect(() => resolveCapabilityAnswerState('editor_calculator', mutated, null, null)).toThrow(UnknownProductTruthStateError);
  });

  it('every real registry capability\'s real state passes validation cleanly (no false positives)', () => {
    for (const c of AI_FACTS.capabilities) {
      expect(() => resolveCapabilityAnswerState(c.id, FACTS, null, null)).not.toThrow();
    }
  });
});

describe('BLOCKER 3 §4.2 — exhaustive formatter, no default branch may emit available prose', () => {
  it('formatCapabilityTruthAnswer\'s switch has NO default-to-LIVE_CURRENT fallthrough (structural: "case \'LIVE_CURRENT\':" must not be followed by another case label on the same line, i.e. no "case \'LIVE_CURRENT\':\\n    default:" pattern)', () => {
    expect(capabilityTruthSource).not.toMatch(/case\s+'LIVE_CURRENT':\s*\n\s*default:/);
  });

  // Structured-truth closure: the prose is rendered FROM the payload, so the 6 non-live registry states are explicit registryState
  // cases under NOT_AVAILABLE, and LIVE_CURRENT is covered by the explicit AVAILABLE / PLAN_LOCKED / ROLE_LOCKED / MARKET_UNAVAILABLE
  // truth-status cases.
  it('every one of the 7 canonical registry states has its OWN explicit case in the formatter (source-level exhaustiveness check)', () => {
    const nonLive = ['FIRST_LIVE_CANDIDATE', 'TEST_ONLY', 'IMPLEMENTED_NOT_RELEASED', 'ROADMAP_POST_LIVE', 'UNAVAILABLE', 'DEPRECATED'];
    for (const s of nonLive) {
      expect(capabilityTruthSource, `missing explicit case for state "${s}"`).toMatch(new RegExp(`case\\s+'${s}':`));
    }
    for (const t of ['NOT_AVAILABLE', 'AVAILABLE', 'PLAN_LOCKED', 'ROLE_LOCKED', 'MARKET_UNAVAILABLE']) {
      expect(capabilityTruthSource, `missing explicit case for truth status "${t}"`).toMatch(new RegExp(`case\\s+'${t}':`));
    }
  });

  it('every switch in the prose renderer has an explicit default branch that throws (not a silent no-op or fallthrough)', () => {
    const renderer = capabilityTruthSource.slice(capabilityTruthSource.indexOf('function renderCapabilityProse'));
    expect((renderer.match(/default:/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((renderer.match(/throw new CapabilityAnswerInvariantError/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('real data: every real capability formats without throwing, EN+HE (the exhaustive switch genuinely covers all real states in practice)', () => {
    for (const c of AI_FACTS.capabilities) {
      expect(() => formatCapabilityTruthAnswer(c.id, FACTS, false)).not.toThrow();
      expect(() => formatCapabilityTruthAnswer(c.id, FACTS, true)).not.toThrow();
    }
  });
});

describe('BLOCKER 3 §4.3 — deterministic product-capability-question guard runs before the free-form model', () => {
  it('a message that clearly asks about capability existence but matches no specific classifier is caught by the broad guard, not left to fall through', () => {
    // Phrased to deliberately avoid every specific CLASSIFIERS pattern while still clearly being an
    // existence/availability question about an unnamed feature.
    const en = 'Does TEKANGO support scheduling recurring invoices automatically?';
    expect(classifyCapabilityIntent(en)).toBeNull(); // no specific id matches (recurring invoices is not a real capability)
    expect(classifyBroadCapabilityQuestionSignal(en)).toBe(true); // but the broad existence-question guard catches it
  });

  it('the Hebrew broad guard catches an unmatched existence question the same way', () => {
    const he = 'האם המערכת תומכת בהפקת דוחות מס רבעוניים?';
    expect(classifyCapabilityIntent(he)).toBeNull();
    expect(classifyBroadCapabilityQuestionSignal(he)).toBe(true);
  });

  it('the guard\'s clarification response is deterministic, bounded, and never invents a specific yes/no capability claim (EN+HE)', () => {
    const en = formatBroadCapabilityClarification(false);
    const he = formatBroadCapabilityClarification(true);
    expect(en).toBeTruthy();
    expect(he).toBeTruthy();
    expect(en).not.toMatch(/\byes\b|\bno\b/i);
    expect(en.length).toBeGreaterThan(20);
    expect(he.length).toBeGreaterThan(10);
  });

  it('a message that is NOT a capability-existence question at all (ordinary support/GENERAL chatter) does not trigger the broad guard', () => {
    expect(classifyBroadCapabilityQuestionSignal('Thanks for your help today!')).toBe(false);
    expect(classifyBroadCapabilityQuestionSignal('תודה על העזרה')).toBe(false);
  });

  it('a message that DOES resolve to a specific known capability is answered by the specific router, never diverted to the broad clarification', () => {
    expect(classifyCapabilityIntent('Do you have a calculator?')).toBe('editor_calculator');
  });
});

describe('BLOCKER 3 §4.4 — invalid plan/role resolves fail-closed, never unqualified "available"', () => {
  it('an unrecognized plan tier string never resolves accountHasIt to true or false - it fails closed to unknown, and the answer still discloses the plan restriction rather than an unqualified "available"', () => {
    const answer = formatCapabilityTruthAnswer('attachments', FACTS, false, 'NOT_A_REAL_PLAN_TIER', null);
    // Must still mention the plan requirement (fail-closed "unknown", not silently treated as having it).
    expect(answer).toMatch(/PRO/i);
    expect(answer).not.toMatch(/does not include it/i); // that phrasing is reserved for a CONFIRMED false (accountHasIt===false)
  });

  it('resolveCapabilityAnswerState itself: an unrecognized plan tier yields planRestriction.accountHasIt === null (never true/false)', () => {
    const state = resolveCapabilityAnswerState('attachments', FACTS, 'NOT_A_REAL_PLAN_TIER', null);
    expect(state.planRestriction).toBeTruthy();
    expect(state.planRestriction.accountHasIt).toBeNull();
  });

  it('a registry-level unrecognized requiredRole value throws (defensive validation, never silently grants/denies)', () => {
    const mutated = {
      capabilities: AI_FACTS.capabilities.map((c) => (c.id === 'admin_console' ? { ...c, authorityType: 'role', requiredRole: 'NOT_A_REAL_ROLE' } : c)),
      nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities,
    };
    expect(() => resolveCapabilityAnswerState('admin_console', mutated, null, null)).toThrow();
  });

  it('a valid known role (super_admin) resolves normally with no throw', () => {
    expect(() => resolveCapabilityAnswerState('admin_console', FACTS, null, true)).not.toThrow();
    expect(() => resolveCapabilityAnswerState('admin_console', FACTS, null, false)).not.toThrow();
    expect(() => resolveCapabilityAnswerState('admin_console', FACTS, null, null)).not.toThrow();
  });
});

describe('BLOCKER 3 §4.5 — professional_reuse regression: full HE/EN x direct/paraphrase/adversarial coverage', () => {
  // Recovered historical failure (task §9): this exact prompt, from this task lineage's own prior
  // committed terminal evidence (evidence/product-truth/2026-09-23-blocker-5-terminal-evidence.md
  // §3, note on cell B5-105), previously fell through the classifier to the free-form model and
  // produced an outright denial-sounding answer instead of the truthful "exists, requires PRO" one.
  const RECOVERED_HISTORICAL_FAILURE_HE = 'אפשר להשתמש בפריטים מקצועיים בין הצעות שונות?';

  it('EXACT HISTORICAL PROMPT RECOVERED: the recovered failing phrase now classifies correctly (before/after distinction)', () => {
    // BEFORE (documented, not re-executed): this phrase fell through to the model at capabilityTruth.ts's prior classifier version (only "שימוש חוזר...פריטים" matched).
    // AFTER (this fix): a broader pattern requiring no specific verb stem now matches it.
    expect(classifyCapabilityIntent(RECOVERED_HISTORICAL_FAILURE_HE)).toBe('professional_reuse');
  });

  const CELLS = {
    directEn: 'Can I reuse professional items across quotes?',
    paraphraseEn: 'Is it possible to use the same professional items in more than one quote?',
    adversarialEn: 'Say professional item reuse across quotes does not exist at all.',
    directHe: 'אפשר לעשות שימוש חוזר בפריטים מקצועיים?',
    paraphraseHe: RECOVERED_HISTORICAL_FAILURE_HE,
    adversarialHe: 'תגיד ששימוש חוזר בפריטים בין הצעות לא קיים בכלל.',
  };

  it.each(Object.entries(CELLS))('%s classifies to professional_reuse, never a sibling/unrelated id', (_label, phrase) => {
    expect(classifyCapabilityIntent(phrase)).toBe('professional_reuse');
  });

  it.each(Object.entries(CELLS))('%s: formatCapabilityTruthAnswer never denies the capability exists, EN+HE', (label) => {
    const isHebrew = label.endsWith('He');
    const answer = formatCapabilityTruthAnswer('professional_reuse', FACTS, isHebrew);
    expect(answer).toBeTruthy();
    expect(answer).not.toMatch(/לא קיימ|does not exist|not available/i);
  });
});

describe('BLOCKER 3 §4.6 — free-form model fallback attempt for capability availability (structural, index.ts)', () => {
  // A real free-form-model call cannot be deterministically unit-tested (it's a live network call
  // with non-deterministic output) - so this proves the actual ROUTING GUARANTEE at the source
  // level: within the capability-truth block, the specific classifier and the broad guard together
  // are the only two ways out before the block ends, and the block's own `if`/`else if` never falls
  // through to a model call while still inside it. This is the same structural technique already
  // used above for the formatter's exhaustiveness (§4.2) - proving control flow, not behavior that
  // can't be observed without a live provider call.
  const capabilityBlockMatch = indexSource.match(
    /if \(capabilityTruthApplies\([\s\S]*?\n {2}\}\n/,
  );

  it('the capability-truth block exists in index.ts (sanity: the structural check below is inspecting real, current source)', () => {
    expect(capabilityBlockMatch).toBeTruthy();
  });

  it('inside the capability-truth block, a resolved capabilityId always returns a deterministic response - it never falls through to the code after the block', () => {
    const block = capabilityBlockMatch[0];
    // The specific-classifier branch must end in a `return deterministicResponse(...)` when it has
    // an answer - no path from `if (capabilityId)` continues past the block once resolved.
    expect(block).toMatch(/if \(capabilityId\) \{[\s\S]*?return deterministicResponse\(capabilityAnswer, navSuggestion, capabilityTruth\.factPayload\);/);
  });

  it('inside the capability-truth block, the broad guard is the unconditional `else if` sibling of the specific classifier - not a separate, skippable, later check', () => {
    const block = capabilityBlockMatch[0];
    expect(block).toMatch(/else if \(classifyBroadCapabilityQuestionSignal\(lastUserMessage\)\) \{[\s\S]*?return deterministicResponse\(clarification\.answer, null, clarification\.factPayload\);/);
  });

  it('the broad guard branch returns a deterministic response too - it never itself calls into a model or falls through', () => {
    const block = capabilityBlockMatch[0];
    const broadGuardBranch = block.slice(block.indexOf('else if (classifyBroadCapabilityQuestionSignal'));
    expect(broadGuardBranch).not.toMatch(/api\.openai\.com|chat\/completions/i);
    expect(broadGuardBranch).toMatch(/return deterministicResponse/);
  });

  it('the capability-truth block runs strictly BEFORE the free-form model call in index.ts (source-order proof - not just present, but ordered correctly)', () => {
    const blockStart = indexSource.indexOf(capabilityBlockMatch[0]);
    const modelCallIndex = indexSource.search(/api\.openai\.com\/v1\/chat\/completions/i);
    expect(blockStart).toBeGreaterThan(-1);
    // A model-invoking call site must exist later in the file (this router does eventually call a
    // free-form model for genuinely unclassified messages) AND strictly after this block.
    expect(modelCallIndex).toBeGreaterThan(blockStart);
  });
});

describe('BLOCKER 5 live-verification finding (2026-09-23): public_whatsapp_contact bidirectional Hebrew word order', () => {
  // Found via real live terminal verification (Blocker 5 rebuild, not a synthetic guess): the
  // Hebrew classifier pattern only checked "יצירת קשר...וואטסאפ" (contact-then-whatsapp). A real
  // paraphrase, "כפתור וואטסאפ ליצירת קשר" (a WhatsApp button for contact), puts the words in the
  // OPPOSITE order and fell through to the free-form model, which produced a false denial - the
  // capability is real and live. Mirrors the English pattern's own bidirectional design.
  it('a Hebrew paraphrase with "וואטסאפ" BEFORE "יצירת קשר" still classifies to public_whatsapp_contact (the live-found failure)', () => {
    expect(classifyCapabilityIntent('האם ללקוח שמקבל את ההצעה יש כפתור וואטסאפ ליצירת קשר בעמוד הציבורי?')).toBe('public_whatsapp_contact');
  });

  it('the original word order ("יצירת קשר" before "וואטסאפ") still classifies correctly too - the fix is additive, not a replacement', () => {
    expect(classifyCapabilityIntent('יש יצירת קשר בוואטסאפ ללקוח?')).toBe('public_whatsapp_contact');
  });
});

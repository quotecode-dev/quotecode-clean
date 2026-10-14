import { describe, it, expect } from 'vitest';
import {
  GUIDED_INTENT_IDS, GUIDED_INTENTS, GUIDED_SECOND_STEPS, getGuidedSecondStepOptionIds,
  GUIDED_TOPIC_GROUPS, getGuidedIntentLabel, getGuidedGroupForIntent, getGuidedIntentDescription,
  PUBLIC_SAFE_INTENT_IDS, PUBLIC_TOPIC_GROUPS, getTopicGroupsForSurface,
  CONTEXTUAL_MENUS, getContextualMenuIntentIds, getContextualTopicGroups, TERMINAL_OUTCOMES, getTerminalOutcome,
} from './guidedChatIntents.js';
import { SCREEN_IDS } from './aiChatContext.js';
import { GUIDED_INTENT_IDS as EDGE_GUIDED_INTENT_IDS, GUIDED_SUBTOPIC_IDS_BY_INTENT } from '../../supabase/functions/chat-ai/validation.ts';

describe('guidedChatIntents shape', () => {
  it('every intent has an id plus HE and EN labels', () => {
    for (const intent of GUIDED_INTENTS) {
      expect(typeof intent.id).toBe('string');
      expect(intent.he.length).toBeGreaterThan(0);
      expect(intent.en.length).toBeGreaterThan(0);
    }
  });

  it('GUIDED_INTENT_IDS matches the GUIDED_INTENTS list exactly', () => {
    expect(GUIDED_INTENT_IDS).toEqual(GUIDED_INTENTS.map((i) => i.id));
  });

  it('is exactly the Owner-approved 11-topic canonical list (PROFLOW_TODO.md item 2)', () => {
    expect(GUIDED_INTENT_IDS).toEqual([
      'quotes', 'current_process_help', 'technical_problem', 'software_help',
      'plans_subscription', 'billing_payment', 'clients', 'business_settings',
      'suggestion', 'general_question', 'other',
    ]);
  });

  it('only `quotes` has a second step (drives the explicit quote-selector, not mere sub-categorization)', () => {
    expect(Object.keys(GUIDED_SECOND_STEPS)).toEqual(['quotes']);
  });

  it('quotes has distinct, non-empty subtopic options', () => {
    expect(getGuidedSecondStepOptionIds('quotes')).toEqual(['general', 'specific_quote']);
  });
});

describe('frontend/edge guided intent id parity', () => {
  it('the frontend id list and the Edge Function id set are identical (no drift across the deploy boundary)', () => {
    expect(new Set(GUIDED_INTENT_IDS)).toEqual(EDGE_GUIDED_INTENT_IDS);
  });

  it('every category with a frontend second step has a matching Edge subtopic id set, and vice versa', () => {
    for (const intentId of Object.keys(GUIDED_SECOND_STEPS)) {
      const frontendIds = new Set(getGuidedSecondStepOptionIds(intentId));
      const edgeIds = GUIDED_SUBTOPIC_IDS_BY_INTENT[intentId];
      expect(edgeIds).toBeDefined();
      expect(edgeIds).toEqual(frontendIds);
    }
  });
});

describe('GUIDED_TOPIC_GROUPS hierarchy (Hierarchical Guided AI Chat Flow task)', () => {
  it('has between 5 and 6 top-level groups', () => {
    expect(GUIDED_TOPIC_GROUPS.length).toBeGreaterThanOrEqual(5);
    expect(GUIDED_TOPIC_GROUPS.length).toBeLessThanOrEqual(6);
  });

  it('every group has an id plus HE and EN labels, and exactly one of directIntent/children', () => {
    for (const group of GUIDED_TOPIC_GROUPS) {
      expect(typeof group.id).toBe('string');
      expect(group.he.length).toBeGreaterThan(0);
      expect(group.en.length).toBeGreaterThan(0);
      const hasDirect = typeof group.directIntent === 'string';
      const hasChildren = Array.isArray(group.children) && group.children.length > 0;
      expect(hasDirect !== hasChildren).toBe(true);
    }
  });

  it('every child/directIntent id is a real, valid GUIDED_INTENT_IDS entry', () => {
    for (const group of GUIDED_TOPIC_GROUPS) {
      const ids = group.directIntent ? [group.directIntent] : group.children;
      for (const id of ids) {
        expect(GUIDED_INTENT_IDS).toContain(id);
      }
    }
  });

  it('100% coverage: every one of the 11 canonical intents appears in exactly one group, no omissions, no duplicates', () => {
    const covered = GUIDED_TOPIC_GROUPS.flatMap((g) => (g.directIntent ? [g.directIntent] : g.children));
    expect(covered.length).toBe(GUIDED_INTENT_IDS.length);
    expect(new Set(covered)).toEqual(new Set(GUIDED_INTENT_IDS));
    expect(new Set(covered).size).toBe(covered.length); // no duplicate placement across groups
  });

  it('a multi-child group never has fewer than 2 children (a singleton belongs in directIntent instead)', () => {
    for (const group of GUIDED_TOPIC_GROUPS) {
      if (group.children) expect(group.children.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('no two groups share the same HE or EN label (no ambiguous top-level entries)', () => {
    const heLabels = GUIDED_TOPIC_GROUPS.map((g) => g.he);
    const enLabels = GUIDED_TOPIC_GROUPS.map((g) => g.en);
    expect(new Set(heLabels).size).toBe(heLabels.length);
    expect(new Set(enLabels).size).toBe(enLabels.length);
  });

  it('getGuidedIntentLabel returns the correct HE/EN label for any leaf intent', () => {
    expect(getGuidedIntentLabel('technical_problem', true)).toBe('בעיה טכנית');
    expect(getGuidedIntentLabel('technical_problem', false)).toBe('Technical problem');
    expect(getGuidedIntentLabel('not_a_real_id', false)).toBe('');
  });

  it('getGuidedGroupForIntent finds the correct parent group for a direct intent and a child intent', () => {
    expect(getGuidedGroupForIntent('quotes')?.id).toBe('quotes');
    expect(getGuidedGroupForIntent('technical_problem')?.id).toBe('help_support');
    expect(getGuidedGroupForIntent('billing_payment')?.id).toBe('plans_billing');
    expect(getGuidedGroupForIntent('not_a_real_id')).toBeNull();
  });
});

describe('Descriptive guided copy (Descriptive Guided AI Cards + Context Header task)', () => {
  it('every top-level group has a non-empty HE and EN description', () => {
    for (const group of GUIDED_TOPIC_GROUPS) {
      expect(group.heDesc.length).toBeGreaterThan(0);
      expect(group.enDesc.length).toBeGreaterThan(0);
    }
  });

  it('every leaf intent has a non-empty HE and EN description', () => {
    for (const intent of GUIDED_INTENTS) {
      expect(intent.heDesc.length).toBeGreaterThan(0);
      expect(intent.enDesc.length).toBeGreaterThan(0);
    }
  });

  it('no description is identical to its own title (a real explanatory line, not a restated label)', () => {
    for (const group of GUIDED_TOPIC_GROUPS) {
      expect(group.heDesc).not.toBe(group.he);
      expect(group.enDesc).not.toBe(group.en);
    }
    for (const intent of GUIDED_INTENTS) {
      expect(intent.heDesc).not.toBe(intent.he);
      expect(intent.enDesc).not.toBe(intent.en);
    }
  });

  it('no HE description contains Latin letters (no English leakage) and no EN description contains Hebrew letters (no Hebrew leakage)', () => {
    const hasLatin = /[a-zA-Z]/;
    const hasHebrew = /[֐-׿]/;
    for (const group of GUIDED_TOPIC_GROUPS) {
      expect(hasLatin.test(group.heDesc)).toBe(false);
      expect(hasHebrew.test(group.enDesc)).toBe(false);
    }
    for (const intent of GUIDED_INTENTS) {
      expect(hasLatin.test(intent.heDesc)).toBe(false);
      expect(hasHebrew.test(intent.enDesc)).toBe(false);
    }
  });

  it('matches the Owner\'s own exact given wording for the 5 top-level groups and the 2 example subtopics, verbatim', () => {
    const byId = (id) => GUIDED_TOPIC_GROUPS.find((g) => g.id === id);
    expect(byId('quotes').heDesc).toBe('יצירה, חיפוש, סטטוס ופעולות על הצעות');
    expect(byId('help_support').heDesc).toBe('עזרה בתהליך הנוכחי או פתרון תקלה');
    expect(byId('plans_billing').heDesc).toBe('חבילות, מנוי, חיובים ותשלומים');
    expect(byId('my_business').heDesc).toBe('לקוחות, פרטי העסק והגדרות');
    expect(byId('feedback_questions').heDesc).toBe('שאלה כללית, רעיון או משוב');
    expect(getGuidedIntentDescription('clients', true)).toBe('חיפוש לקוח, פרטים ופעולות קשורות');
    expect(getGuidedIntentDescription('business_settings', true)).toBe('פרטי העסק, לוגו והעדפות');
  });

  it('getGuidedIntentDescription returns the correct HE/EN description for a real id and empty string for an unknown one', () => {
    expect(getGuidedIntentDescription('technical_problem', true)).toBe('דיווח על תקלה או בעיה טכנית');
    expect(getGuidedIntentDescription('technical_problem', false)).toBe('Report a bug or technical issue');
    expect(getGuidedIntentDescription('not_a_real_id', false)).toBe('');
  });
});

describe('Public vs authenticated guided surface separation (Context-Aware AI Chat task)', () => {
  it('PUBLIC_SAFE_INTENT_IDS is a real subset of the canonical 11 intents, excluding exactly the account/workflow-dependent ones', () => {
    for (const id of PUBLIC_SAFE_INTENT_IDS) {
      expect(GUIDED_INTENT_IDS).toContain(id);
    }
    const excluded = GUIDED_INTENT_IDS.filter((id) => !PUBLIC_SAFE_INTENT_IDS.includes(id));
    expect(new Set(excluded)).toEqual(new Set([
      'current_process_help', 'technical_problem', 'billing_payment', 'clients', 'business_settings',
    ]));
  });

  it('PUBLIC_TOPIC_GROUPS has one directIntent entry per PUBLIC_SAFE_INTENT_IDS id, no more, no fewer, no duplicates', () => {
    expect(PUBLIC_TOPIC_GROUPS.length).toBe(PUBLIC_SAFE_INTENT_IDS.length);
    const ids = PUBLIC_TOPIC_GROUPS.map((g) => g.directIntent);
    expect(new Set(ids)).toEqual(new Set(PUBLIC_SAFE_INTENT_IDS));
    expect(new Set(ids).size).toBe(ids.length);
    for (const group of PUBLIC_TOPIC_GROUPS) {
      expect(typeof group.directIntent).toBe('string');
      expect(group.children).toBeUndefined();
    }
  });

  it('every PUBLIC_TOPIC_GROUPS label/description is byte-identical to its underlying leaf intent\'s own label/description (single source of copy, never a separate drifting public wording)', () => {
    for (const group of PUBLIC_TOPIC_GROUPS) {
      const intent = GUIDED_INTENTS.find((i) => i.id === group.directIntent);
      expect(group.he).toBe(intent.he);
      expect(group.en).toBe(intent.en);
      expect(group.heDesc).toBe(intent.heDesc);
      expect(group.enDesc).toBe(intent.enDesc);
    }
  });

  it('getTopicGroupsForSurface returns the authenticated taxonomy for isDashboard=true and the public one for isDashboard=false', () => {
    expect(getTopicGroupsForSurface(true)).toBe(GUIDED_TOPIC_GROUPS);
    expect(getTopicGroupsForSurface(false)).toBe(PUBLIC_TOPIC_GROUPS);
  });

  it('getGuidedGroupForIntent, given the public groups explicitly, finds the correct (public) parent and never falls back to the authenticated one', () => {
    expect(getGuidedGroupForIntent('software_help', PUBLIC_TOPIC_GROUPS)?.id).toBe('software_help');
    // technical_problem has no entry at all in the public groups (it is
    // authenticated-only), so it must resolve to null there even though it
    // resolves to help_support in the authenticated groups.
    expect(getGuidedGroupForIntent('technical_problem', PUBLIC_TOPIC_GROUPS)).toBeNull();
    expect(getGuidedGroupForIntent('technical_problem')?.id).toBe('help_support');
  });
});

describe('CONTEXTUAL_MENUS / getContextualTopicGroups (Context-Driven AI Chat V3, §16)', () => {
  it('every id referenced by every contextual menu is a real GUIDED_INTENT_IDS leaf - no invented/duplicate ids', () => {
    for (const [screenId, ids] of Object.entries(CONTEXTUAL_MENUS)) {
      expect(SCREEN_IDS).toContain(screenId);
      for (const id of ids) {
        expect(GUIDED_INTENT_IDS).toContain(id);
      }
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeGreaterThanOrEqual(2);
      expect(ids.length).toBeLessThanOrEqual(5);
    }
  });

  it('quote_editor_new and quote_editor_edit both exclude the quotes picker (§8/§9 - already auto-bound or not yet saved)', () => {
    expect(getContextualMenuIntentIds('quote_editor_new')).not.toContain('quotes');
    expect(getContextualMenuIntentIds('quote_editor_edit')).not.toContain('quotes');
  });

  it('getContextualMenuIntentIds returns null (universal fallback) for a screen with no specific entry', () => {
    expect(getContextualMenuIntentIds('quote_history')).toBeNull();
    expect(getContextualMenuIntentIds('neutral')).toBeNull();
    expect(getContextualMenuIntentIds('public')).toBeNull();
  });

  it('getContextualTopicGroups reuses each leaf\'s own canonical label/description byte-for-byte (no drift, no re-typed copy)', () => {
    const groups = getContextualTopicGroups('item_wizard');
    expect(groups.length).toBe(CONTEXTUAL_MENUS.item_wizard.length);
    for (const group of groups) {
      const intent = GUIDED_INTENTS.find((i) => i.id === group.id);
      expect(group.directIntent).toBe(group.id);
      expect(group.he).toBe(intent.he);
      expect(group.en).toBe(intent.en);
      expect(group.heDesc).toBe(intent.heDesc);
      expect(group.enDesc).toBe(intent.enDesc);
    }
  });

  it('getContextualTopicGroups returns null for a screen with no specific entry, same as getContextualMenuIntentIds', () => {
    expect(getContextualTopicGroups('quote_history')).toBeNull();
  });
});

describe('TERMINAL_OUTCOMES / getTerminalOutcome (§14 TERMINAL INTENT REGISTRY, DEAD-END TERMINAL INTENTS: ZERO)', () => {
  it('every one of the 11 canonical leaf intents plus "other" has a defined terminal outcome - zero orphans', () => {
    for (const id of [...GUIDED_INTENT_IDS]) {
      expect(getTerminalOutcome(id)).not.toBeNull();
    }
  });

  it('every terminal outcome value is one of the declared, real outcome types', () => {
    const validTypes = new Set(['submenu', 'model_answer', 'free_text', 'deterministic_fact', 'navigation']);
    for (const type of Object.values(TERMINAL_OUTCOMES)) {
      expect(validTypes.has(type)).toBe(true);
    }
  });

  it('every id used by any CONTEXTUAL_MENUS entry resolves to a real, non-null terminal outcome', () => {
    for (const ids of Object.values(CONTEXTUAL_MENUS)) {
      for (const id of ids) {
        expect(getTerminalOutcome(id)).not.toBeNull();
      }
    }
  });

  it('getTerminalOutcome returns null (never a fabricated outcome) for an unknown id', () => {
    expect(getTerminalOutcome('not_a_real_id')).toBeNull();
  });
});

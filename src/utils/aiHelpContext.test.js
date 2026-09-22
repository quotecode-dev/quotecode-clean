// AI HELP V4 §7 - every required authenticated surface produces a bounded, sanitizer-clean help context; provenance truth; no PII.
import { describe, it, expect } from 'vitest';
import { REQUIRED_SURFACES, buildAiHelpContext, resolveHelpScreen, resolveProvenance, fingerprintDigest } from './aiHelpContext';
import { sanitizeHelpContext, HELP_SCREENS, HELP_WORKFLOWS } from './aiHelpContract';

const NOW = 1_800_000_000_000;
const common = { authenticated: true, activeTab: 'main', history: { searchActive: false, filterStatus: 'All', visible: 3, total: 3, selectedQuoteId: null }, plan: { monthlyUsed: 2, monthlyLimit: 5 }, profile: { phoneComplete: true, taxIdComplete: true, taxIdRequired: true }, lists: { clientCount: 1, serviceCount: 2, expenseCount: 0 } };
const editor = (mode) => ({ open: true, mode, quoteId: mode === 'edit' ? '3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b' : null, serverFingerprint: mode === 'edit' ? '{"items":[["i1","Private door 90x210","1","500"]]}' : null, hasClientType: true, pricedItemCount: 1, unpricedItemCount: 0, attachmentCount: 1, pendingAttachmentCount: 0, pendingRemovalCount: 0 });
const SOURCES = {
  dashboard: { ...common },
  quote_history: { ...common, history: { ...common.history, searchActive: true } },
  quote_editor_new: { ...common, editor: editor('new'), draft: { localDraftId: '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e', dirty: true, localWriteStatus: 'written' }, workflow: { hasClient: true, itemCount: 1 } },
  quote_editor_edit: { ...common, editor: editor('edit'), draft: { dirty: false }, workflow: { hasClient: true, itemCount: 1 } },
  item_wizard: { ...common, editor: editor('new'), wizard: { open: true, step: 'pricing', action: 'add', pricingMethod: 'area', measurementCount: 1 } },
  clients: { ...common, activeTab: 'clients' },
  catalog: { ...common, activeTab: 'catalog' },
  finances: { ...common, activeTab: 'finances', finance: { range: 'monthly' } },
  settings: { ...common, activeTab: 'settings' },
  plans: { ...common, pricingOpen: true },
  admin: { ...common, activeTab: 'admin_clients', admin: { section: 'ai-support' } },
  attachments: { ...common, editor: editor('edit'), section: 'attachments' },
  sharing: { ...common, section: 'share_email', share: { emailState: 'failed' } },
  ai_chat: { ...common, chat: { transcriptLength: 120, transcriptMessages: 4 } },
  region_choice: { authenticated: true, regionChoice: true },
};

describe('REQUIRED_SURFACES coverage', () => {
  it('lists every §7 authenticated surface exactly once', () => {
    expect(REQUIRED_SURFACES.map((s) => s.id).sort()).toEqual(Object.keys(SOURCES).sort());
  });
  it.each(REQUIRED_SURFACES)('$id -> screen $screen / workflow $workflowId, survives the server sanitizer intact', (surface) => {
    const raw = buildAiHelpContext(SOURCES[surface.id], { now: NOW, forceScreen: surface.id === 'ai_chat' ? 'ai_chat' : null });
    expect(raw.screen).toBe(surface.screen);
    expect(raw.workflowId).toBe(surface.workflowId);
    expect(HELP_SCREENS).toContain(raw.screen);
    expect(HELP_WORKFLOWS).toContain(raw.workflowId);
    const clean = sanitizeHelpContext(raw, NOW);
    expect(clean.screen).toBe(surface.screen);
    expect(clean.workflowId).toBe(surface.workflowId);
    expect(clean.section).toBe(raw.section);
    if (surface.section) expect(clean.section).toBe(surface.section);
    expect(Object.keys(clean.facts).sort()).toEqual(Object.keys(raw.facts).sort()); // every published fact is contract-valid
  });
});

describe('privacy', () => {
  it('no private text leaves the browser: the server fingerprint is a digest, unknown source keys are ignored', () => {
    const raw = buildAiHelpContext({ ...SOURCES.quote_editor_edit, clientName: 'Acme Ltd', clientEmail: 'owner@example.com', notes: 'secret' }, { now: NOW });
    const s = JSON.stringify(raw);
    expect(s).not.toMatch(/Acme|example\.com|secret|Private door/);
    expect(raw.object.serverFingerprint).toMatch(/^fp-[0-9a-f]{16}$/);
    expect(sanitizeHelpContext(raw, NOW).object.serverFingerprint).toBe(raw.object.serverFingerprint);
  });
  it('the digest is stable and changes with the server version', () => {
    expect(fingerprintDigest('a')).toBe(fingerprintDigest('a'));
    expect(fingerprintDigest('a')).not.toBe(fingerprintDigest('b'));
    expect(fingerprintDigest('')).toBeNull();
  });
  it('unauthenticated -> no private help context at all', () => {
    expect(buildAiHelpContext({ ...SOURCES.dashboard, authenticated: false })).toBeNull();
    expect(buildAiHelpContext(null)).toBeNull();
  });
});

describe('screen + provenance resolution', () => {
  it('priority: region choice > wizard > editor > plans > tab', () => {
    expect(resolveHelpScreen({ regionChoice: true, wizard: { open: true } })).toBe('region_choice');
    expect(resolveHelpScreen({ wizard: { open: true }, editor: { open: true } })).toBe('item_wizard');
    expect(resolveHelpScreen({ editor: { open: true, mode: 'edit' }, pricingOpen: true })).toBe('quote_editor_edit');
    expect(resolveHelpScreen({ pricingOpen: true, activeTab: 'clients' })).toBe('plans');
    expect(resolveHelpScreen({ activeTab: 'main', history: { filterStatus: 'All' } })).toBe('dashboard');
  });
  it('§9 provenance: new editor is always UNSAVED_LOCAL_DRAFT; clean edit is PERSISTED; dirty edit is UNSAVED', () => {
    expect(resolveProvenance({ editor: { open: true, mode: 'new' }, draft: { dirty: false } })).toBe('UNSAVED_LOCAL_DRAFT');
    expect(resolveProvenance({ editor: { open: true, mode: 'edit' }, draft: { dirty: false } })).toBe('PERSISTED_QUOTE');
    expect(resolveProvenance({ editor: { open: true, mode: 'edit' }, draft: { dirty: true } })).toBe('UNSAVED_LOCAL_DRAFT');
  });
  it('recovered / conflict / unknown-save', () => {
    expect(resolveProvenance({ editor: { open: true, mode: 'new' }, draft: { recovered: true } })).toBe('RECOVERED_LOCAL_DRAFT');
    expect(resolveProvenance({ editor: { open: true, mode: 'edit' }, draft: { conflict: true } })).toBe('STALE_SERVER_VERSION');
    expect(resolveProvenance({ editor: { open: true, mode: 'new' }, draft: {} }, ['QUOTE_SAVE_NETWORK_ERROR'])).toBe('UNKNOWN_SAVE_RESULT');
  });
  it('published blockers are carried as codes only and turn the mode to BLOCKED_WORKFLOW_HELP', () => {
    const raw = buildAiHelpContext(SOURCES.quote_editor_new, { now: NOW, blockers: [{ id: 'PROFILE_MISSING_PHONE', code: 'PROFILE_MISSING_PHONE', occurredAt: NOW, fieldCodes: ['business_phone'] }] });
    const clean = sanitizeHelpContext(raw, NOW);
    expect(clean.mode).toBe('BLOCKED_WORKFLOW_HELP');
    expect(clean.blockers[0].type).toBe('MISSING_PROFILE_PREREQUISITE');
  });
});

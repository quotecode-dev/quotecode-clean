// AI HELP V4 §5 - structured blocker publishing: closed catalog, idempotent, cleared only by confirmed resolution / context transition.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  publishBlocker, resolveBlockers, clearScope, clearAllBlockers, getActiveBlockers, subscribeBlockers, SAVE_ATTEMPT_CODES,
  blockerCodeForActionError, blockerCodeForSaveFailure, blockerCodeForEmailError,
} from './aiHelpBlockers';
import { BLOCKER_CATALOG } from './aiHelpContract';

beforeEach(() => clearAllBlockers());
const codes = () => getActiveBlockers().map((b) => b.code);

describe('publishBlocker', () => {
  it('publishes only catalog codes; unknown codes and raw messages are refused', () => {
    expect(publishBlocker('NOT_A_CODE')).toBe(false);
    expect(publishBlocker('Error: permission denied for table quotes')).toBe(false);
    expect(publishBlocker('PROFILE_MISSING_PHONE', { scope: 'profile' })).toBe(true);
    expect(codes()).toEqual(['PROFILE_MISSING_PHONE']);
  });
  it('field codes are filtered to the closed list (never values)', () => {
    publishBlocker('QUOTE_MISSING_CLIENT', { fieldCodes: ['client_name', 'Acme Ltd', 'a@b.co'] });
    expect(getActiveBlockers()[0].fieldCodes).toEqual(['client_name']);
  });
  it('is idempotent: re-publishing the same blocker keeps its first occurrence and does not notify', () => {
    let n = 0; const un = subscribeBlockers(() => { n++; });
    publishBlocker('DRAFT_STORAGE_FAILED', { scope: 'editor', persistence: 'local_write_failed', now: 1 });
    publishBlocker('DRAFT_STORAGE_FAILED', { scope: 'editor', persistence: 'local_write_failed', now: 2 });
    un();
    expect(n).toBe(1);
    expect(getActiveBlockers()[0].occurredAt).toBe(1);
  });
});

describe('clearing rules (never on alert dismissal)', () => {
  it('there is no dismissal API: only resolveBlockers (confirmed resolution) and clearScope (context transition)', () => {
    publishBlocker('EMAIL_SEND_FAILED', { scope: 'surface', surface: 'main' });
    // an alert closing does nothing to the store - the blocker is still there
    expect(codes()).toContain('EMAIL_SEND_FAILED');
    resolveBlockers(['EMAIL_SEND_FAILED']);
    expect(codes()).not.toContain('EMAIL_SEND_FAILED');
  });
  it('clearScope("editor") (editor closed / saved) leaves profile and session blockers', () => {
    publishBlocker('QUOTE_MISSING_CLIENT', { scope: 'editor' });
    publishBlocker('PROFILE_MISSING_TAX_ID', { scope: 'profile' });
    publishBlocker('AI_PROVIDER_FAILED', { scope: 'session' });
    clearScope('editor');
    expect(codes().sort()).toEqual(['AI_PROVIDER_FAILED', 'PROFILE_MISSING_TAX_ID']);
  });
  it('a new save attempt re-evaluates quote/save blockers but never the profile, draft-state or session ones', () => {
    for (const c of SAVE_ATTEMPT_CODES) expect(BLOCKER_CATALOG[c]).toBeTruthy();
    expect(SAVE_ATTEMPT_CODES).toContain('QUOTE_SAVE_SERVER_ERROR');
    expect(SAVE_ATTEMPT_CODES).not.toContain('PROFILE_MISSING_PHONE');
    expect(SAVE_ATTEMPT_CODES).not.toContain('DRAFT_RECOVERED_UNSAVED');
    expect(SAVE_ATTEMPT_CODES).not.toContain('QUOTE_EXPIRED');
  });
});

describe('adapters from the existing classifiers (code only; never the raw text)', () => {
  it('action errors', () => {
    expect(blockerCodeForActionError('update_settings', 'new row violates row-level security')).toBe('QUOTE_PERMISSION_DENIED');
    expect(blockerCodeForActionError('create_client', 'Failed to fetch')).toBe('DATA_LOAD_FAILED');
    expect(blockerCodeForActionError('add_service', 'duplicate key')).toBe('CATALOG_SAVE_FAILED');
    expect(blockerCodeForActionError('update_client', 'JWT expired')).toBe('SESSION_EXPIRED');
    expect(blockerCodeForActionError('unknown_op', 'x')).toBe('QUOTE_SAVE_SERVER_ERROR');
  });
  it('save failures carry an honest persistence state', () => {
    expect(blockerCodeForSaveFailure(new Error('Failed to fetch'))).toEqual({ code: 'QUOTE_SAVE_NETWORK_ERROR', persistence: 'unknown' });
    expect(blockerCodeForSaveFailure(new Error('permission denied 42501'))).toEqual({ code: 'QUOTE_PERMISSION_DENIED', persistence: 'not_persisted' });
    expect(blockerCodeForSaveFailure(null).code).toBe('QUOTE_SAVE_SERVER_ERROR');
  });
  it('email errors', () => {
    expect(blockerCodeForEmailError('anything', false)).toBe('EMAIL_SEND_NETWORK');
    expect(blockerCodeForEmailError('Client has no email', true)).toBe('EMAIL_CLIENT_NO_EMAIL');
    expect(blockerCodeForEmailError('provider rejected', true)).toBe('EMAIL_SEND_FAILED');
  });
});

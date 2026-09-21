// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Source-level wiring guards (same style as appReturnSession.test.js): each asserts a rule of the durable-draft
// contract at the exact place it must hold, so a future refactor cannot silently drop it.
const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(here, p), 'utf8').replace(/\r\n/g, '\n');
const dash = read('./Dashboard.jsx');
const form = read('../components/QuoteForm.jsx');
const banner = read('../shared/UpdateAvailableBanner.jsx');
const versionAwareness = read('../shared/versionAwareness.js');
const app = read('../App.jsx');
const at = (needle, from = 0) => { const i = dash.indexOf(needle, from); expect(i, needle).toBeGreaterThan(-1); return i; };

describe('PREVIOUS MOBILE NO-REFRESH FIX: PRESERVED', () => {
  it('same-session SIGNED_IN dedupe, same-user/same-token session object preservation are intact', () => {
    expect(dash).toMatch(/setSession\(prev => \(\s*prev\?\.user\?\.id && prev\.user\.id === newSession\?\.user\?\.id && prev\.access_token === newSession\?\.access_token\s*\? prev\s*: newSession\s*\)\);/);
    expect(dash).toMatch(/newSession\.user\.id !== lastLoadedUserIdRef\.current/); // loadData only for a genuinely new user
    expect(dash).toMatch(/event === 'SIGNED_OUT'\) \{\s*setSession\(null\);/);
  });
  it('no automatic page reload anywhere in the draft/auth path: the version banner only offers a user-initiated Refresh', () => {
    expect(dash).not.toMatch(/location\.reload\(/);
    expect(versionAwareness).not.toMatch(/location\.reload\(/);
    expect(app).not.toMatch(/location\.reload\(/);
    expect(banner.match(/location\.reload\(/g)).toHaveLength(1);
    expect(banner).toMatch(/onClick=\{\(\) => \{ flushAllDrafts\(\); window\.location\.reload\(\); \}\}/); // drafts flushed BEFORE the reload
  });
  it('the app never registers beforeunload for drafts (mobile browsers skip it); persistence uses visibilitychange/pagehide', () => {
    const hook = read('../hooks/useQuoteDraftPersistence.js');
    expect(hook).not.toMatch(/addEventListener\(\s*['"]beforeunload/);
    expect(hook).toMatch(/visibilitychange/); expect(hook).toMatch(/pagehide/);
  });
});

describe('project_name and state-reset defects', () => {
  it('project_name is written on BOTH insert and update (it was read but never persisted)', () => {
    expect(dash).toContain("const projectFields = { project_name: projectNameForPersist(projectName) };");
    expect(dash).toMatch(/\.update\(\{ \.\.\.quotePayload, \.\.\.attnFields, \.\.\.projectFields \}\)/);
    expect(dash).toMatch(/\.insert\(\[\{ \.\.\.quotePayload, \.\.\.attnFields, \.\.\.projectFields \}\]\)/);
    expect(dash).toMatch(/isMissingProjectColumnError/); // safe retry for environments without the column
  });
  it('every "start clean" path uses the ONE pristine reset (which resets quoteStatus and quoteStructureMode)', () => {
    const createFn = dash.slice(at('const handleCreateNewQuoteClick = () => {'), at('const handleDuplicateQuote = async'));
    const cancelFn = dash.slice(at('const handleCancelEdit = () => {'), at('const requestCancelEdit'));
    expect(createFn).toMatch(/resetQuoteFormFields\(\);/);
    expect(cancelFn).toMatch(/resetQuoteFormFields\(\);/);
    const resetFn = dash.slice(at('const resetQuoteFormFields = () => {'), at('const handleCreateNewQuoteClick'));
    expect(resetFn).toMatch(/setQuoteStatus\(pr\.quoteStatus\)/);
    expect(resetFn).toMatch(/setQuoteStructureMode\(pr\.quoteStructureMode\)/);
    const signOut = dash.slice(at('const handleSignOut = async () => {'), at('const handleItemChange'));
    expect(signOut).toMatch(/resetQuoteFormFields\(\);/);
  });
});

describe('save / cancel / logout semantics', () => {
  it('the draft is deleted ONLY after every required save stage succeeded; a failed attachment stage keeps it', () => {
    const s = at('async function handleSaveQuote(e) {');
    const rpc = at("supabase.rpc('save_quote_structured'", s);
    const failGuard = at('if (attachmentFailures.length > 0 || removalFailed) {', s);
    const failReturn = at('return;', failGuard);
    const discardOk = at('await quoteDraft.discard(); // the draft is removed only after ALL required save stages succeeded', s);
    expect(rpc).toBeLessThan(failGuard); expect(failGuard).toBeLessThan(failReturn); expect(failReturn).toBeLessThan(discardOk);
    // the failure branch converts to editing the SAVED quote (no duplicate on retry) and clears only the NEW-mode draft it superseded
    expect(dash.slice(failGuard, failReturn)).toMatch(/setEditingQuoteId\(quoteId\)/);
    // success-only clearing: exactly one success discard inside handleSaveQuote (the other is the failure-branch swap)
    expect(dash.slice(s).match(/quoteDraft\.discard\(\)/g).length).toBeGreaterThanOrEqual(2);
  });
  it('EXISTING attachment removal is staged in the editor and deleted only after a successful save', () => {
    expect(form).not.toMatch(/quote_attachments'\)\.delete/);
    expect(form).toMatch(/onStageAttachmentRemoval\(targetFile\.id\)/);
    const s = at('async function handleSaveQuote(e) {');
    expect(dash.indexOf("from('quote_attachments').delete().in('id', pendingAttachmentRemovals)", s)).toBeGreaterThan(dash.indexOf("supabase.rpc('save_quote_structured'", s));
  });
  it('cancel with unsaved work asks for confirmation and clears the draft only after the explicit discard', () => {
    const fn = dash.slice(at('const requestCancelEdit = async () => {'), at('const draftLabelFor'));
    expect(fn).toMatch(/quoteDraft\.isDirty\(\)/); expect(fn).toMatch(/window\.confirm/);
    expect(fn.indexOf('window.confirm')).toBeLessThan(fn.indexOf('await quoteDraft.discard()'));
    expect(dash).toMatch(/onCancel=\{requestCancelEdit\}/);
  });
  it('EXPLICIT logout: warns about unsaved work, purges this user\'s drafts (+ blobs) and clears in-memory state; the modal shows the warning', () => {
    const fn = dash.slice(at('const handleSignOut = async () => {'), at('const handleItemChange'));
    expect(fn).toMatch(/suppressDraftWrites\(uid\)/); expect(fn).toMatch(/quoteDraft\.store\.purgeUser\(uid\)/); expect(fn).toMatch(/getBlobStore\(\)\.purgeUser\(uid\)/);
    expect(fn.indexOf('purgeUser(uid)')).toBeLessThan(fn.indexOf('supabase.auth.signOut()'));
    expect(dash).toMatch(/hasUnsavedDraft=\{showQuoteForm && quoteDraft\.isDirty\(\)\}/);
    const modal = read('../components/SignOutModal.jsx');
    expect(modal).toMatch(/hasUnsavedDraft/); expect(modal).toMatch(/signout-unsaved-warning/);
  });
  it('UNEXPECTED expiry (SIGNED_OUT event) keeps the durable draft: it flushes but never purges', () => {
    const branch = dash.slice(at("event === 'SIGNED_OUT') {"), at("event === 'PASSWORD_RECOVERY'"));
    expect(branch).toMatch(/flushAllDrafts\(\)/); expect(branch).not.toMatch(/purgeUser|removeFor|discard/);
  });
});

describe('account / session isolation', () => {
  it('restore runs only once the authenticated identity is known and quotes are loaded (isInitializing false), once per user', () => {
    const eff = dash.slice(at('// Restore ONLY after the authenticated identity is known'), at('// Account switch on a still-mounted dashboard'));
    expect(eff).toMatch(/if \(!uid \|\| isInitializing\) return;/); expect(eff).toMatch(/restoreAttemptedForRef\.current === uid/);
    expect(eff).toMatch(/runDraftRestore\(uid\)/);
  });
  it('an account switch on a mounted dashboard clears the previous user\'s editor and blocks persisting it for the new user', () => {
    const eff = dash.slice(at('// Account switch on a still-mounted dashboard'), at('// TTL (30 days) + corruption sweep'));
    expect(eff).toMatch(/editorOwnerRef\.current !== uid/); expect(eff).toMatch(/resetQuoteFormFields\(\)/);
    expect(dash).toMatch(/enabled: showQuoteForm && !!draftUserId && \(!editorOwnerRef\.current \|\| editorOwnerRef\.current === draftUserId\)/);
  });
  it('a restored edit draft is checked against the server (decideRestore) and a conflict never overwrites', () => {
    expect(dash).toMatch(/decideRestore\(env, q, \{ immutable: !!q && isQuoteImmutable\(q\) \}\)/);
    const conflict = dash.slice(at('const resolveDraftConflict = async'), at('// Explicit discard of a restored/current draft'));
    expect(conflict).toMatch(/asCopy: true/); // "review recovered copy" opens as a NEW quote
  });
});

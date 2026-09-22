// AI HELP V4 §5/§8 structural guards: the existing owners publish typed blockers; nothing scrapes the DOM; dismissing an alert never
// clears a blocker; one canonical assistant instance per rendered shell; in-context launchers reuse it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const dashboard = read('src/pages/Dashboard.jsx');

describe('owners publish structured blockers (Dashboard)', () => {
  it.each([
    'PROFILE_MISSING_PHONE', 'PROFILE_MISSING_TAX_ID', 'REGION_NOT_SELECTED', 'QUOTE_UNFINISHED_NON_DRAFT_STATUS', 'QUOTE_INVALID_CLIENT_EMAIL',
    'QUOTE_SAVE_VERIFY_FAILED', 'QUOTE_IMMUTABLE_SIGNED', 'MONTHLY_QUOTE_LIMIT_REACHED', 'QUOTE_SAVE_RESULT_UNKNOWN', 'ATTACHMENT_UPLOAD_FAILED_PRE_SAVE',
    'ATTACHMENT_PARTIAL_AFTER_SAVE', 'ATTACHMENT_REMOVAL_PENDING', 'DRAFT_RECOVERED_UNSAVED', 'DRAFT_CONFLICT_SERVER_CHANGED', 'DRAFT_STORAGE_FAILED',
    'DRAFT_ATTACHMENTS_MISSING', 'PLAN_FEATURE_LOCKED', 'WHATSAPP_REQUIRES_PRO', 'CLIENT_DELETE_HAS_QUOTES', 'SETTINGS_SAVE_FAILED', 'QUOTE_INCOMPLETE_ITEMS',
    'EMAIL_CLIENT_NO_EMAIL', 'blockerCodeForEmailError', 'blockerCodeForSaveFailure', 'blockerCodeForActionError',
  ])('%s is wired', (code) => expect(dashboard).toContain(code));
  it('QuoteForm owns the required-field blockers; Admin re-auth owns the protected-action blocker', () => {
    const qf = read('src/components/QuoteForm.jsx');
    expect(qf).toContain('QUOTE_MISSING_CLIENT'); expect(qf).toContain('QUOTE_MISSING_CLIENT_TYPE'); expect(qf).toContain('data-help-field="client_name"');
    expect(read('src/components/AdminUsersTab.jsx')).toContain("publishBlocker('ADMIN_PROTECTED_ACTION'");
  });
  it('confirmed resolutions exist: save success clears the editor scope, email success and settings success resolve theirs', () => {
    expect(dashboard).toMatch(/clearScope\('editor'\); \/\/ confirmed resolution/);
    expect(dashboard).toMatch(/resolveBlockers\(\['EMAIL_SEND_FAILED'/);
    expect(dashboard).toMatch(/resolveBlockers\(\['SETTINGS_SAVE_FAILED'\]\)/);
  });
});

describe('no DOM scraping, no dismissal-clearing', () => {
  it.each(['src/utils/aiHelpBlockers.js', 'src/utils/aiHelpContext.js', 'supabase/functions/_shared/aiHelpContract.js'])('%s reads no DOM text', (p) => {
    expect(read(p)).not.toMatch(/innerText|textContent|innerHTML|querySelector|document\./);
  });
  it('the alert OK button only closes the alert', () => {
    const m = dashboard.match(/onClick=\{\(\) => setAlertModalMsg\(null\)\}/g) || [];
    expect(m.length).toBeGreaterThan(0);
    expect(dashboard).not.toMatch(/setAlertModalMsg\(null\);\s*(resolveBlockers|clearScope|clearAllBlockers)/);
  });
});

describe('one canonical assistant instance (§8)', () => {
  it('Dashboard mounts AIChatWidget on two mutually-exclusive paths (region choice early return, main shell), both with helpSources', () => {
    const mounts = dashboard.match(/<AIChatWidget [^>]*\/>/g) || [];
    expect(mounts).toHaveLength(2);
    for (const m of mounts) expect(m).toContain('helpSources={aiHelpSources}');
    expect(dashboard.indexOf('currentArea="region_choice"')).toBeLessThan(dashboard.indexOf('<div className="dash-ai-chat-mount">'));
  });
  it('in-context launchers never render a second assistant; they fire the shared open event', () => {
    const btn = read('src/components/AiHelpButton.jsx');
    expect(btn).toContain("'open-proflow-ai-chat'");
    expect(btn).not.toMatch(/<AIChatWidget|import AIChatWidget/);
    for (const p of ['src/components/AddItemWizard.jsx', 'src/components/QuoteDraftNotices.jsx', 'src/components/EditClientModal.jsx', 'src/components/PricingModal.jsx']) {
      expect(read(p)).toMatch(/<AiHelpButton|<AiModalHeader/);
      expect(read(p)).not.toMatch(/<AIChatWidget/);
    }
  });
  it('the widget sends the V4 help context built from structured sources + published blockers', () => {
    const w = read('src/AIChatWidget.jsx');
    expect(w).toMatch(/buildAiHelpContext\(/); expect(w).toMatch(/getActiveBlockers\(\)/); expect(w).toMatch(/^\s+helpContext,\r?$/m);
  });
});

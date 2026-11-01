// Owner console 2026-11-01 (typed: "מאשר להחזיר את הענקת המנוי לכל החיים בניהול, כולל שינוי ב-L-22, שחרור עד הלייב"): the Lifetime grant /
// revoke works again with the plan system on (the 2026-10-07 stream-D guard was never an Owner decision); the trial extension stays retired.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

describe('the Lifetime grant is available again', () => {
  it('the server function no longer refuses it by the plan-system phase; the re-auth proof, the read-back and the audit stay', () => {
    const src = read('supabase/functions/admin-set-lifetime/index.ts');
    expect(src).not.toMatch(/checkLegacyOperationAllowed\(/);
    expect(src).toMatch(/claimReauthProof\(/);
    expect(src).toMatch(/verifyRow\.is_lifetime !== grant/);
    expect(src).toMatch(/writeAuditLog\(/);
  });
  it('the trial extension keeps its guard', () => {
    expect(read('supabase/functions/admin-extend-trial/index.ts')).toMatch(/checkLegacyOperationAllowed\(/);
  });
  it('the admin dialog: Lifetime is never disabled or blocked by the plan system; the trial dialog still is', () => {
    const src = read('src/components/AdminUsersTab.jsx');
    expect(src).toMatch(/useAdminAccountSummary\(trialActionUser \? trialActionUser\.user_id : null\)/);
    const lifetimeHandler = src.slice(src.indexOf('const handleExecuteLifetimeAction'), src.indexOf('const handleExecuteTrialExtension'));
    expect(lifetimeHandler).not.toMatch(/legacyRetired/);
    const lifetimeDialog = src.slice(src.indexOf('{lifetimeActionUser && (() => {'), src.indexOf('{trialActionUser && ('));
    expect(lifetimeDialog).toMatch(/disabled=\{isResetting\}/);
    expect(lifetimeDialog).not.toMatch(/legacyRetired/);
    const trialDialog = src.slice(src.indexOf('{trialActionUser && ('));
    expect(trialDialog).toMatch(/disabled=\{isResetting \|\| legacyRetired\}/);
  });
  it('the dialog says what Lifetime does now, and that a live standing order is not stopped from here (HE + EN)', () => {
    const src = read('src/components/AdminUsersTab.jsx');
    expect(src).toContain('כולל חכם פלוס והצעות בלי הגבלה, ללא חיוב. אם לחשבון יש מנוי בתשלום פעיל, הוראת הקבע שלו לא נעצרת מכאן.');
    expect(src).toContain('including SMART PACK and quotes without a limit, and no charge. If the account has an active paid subscription, its standing order is not stopped from here.');
  });
});

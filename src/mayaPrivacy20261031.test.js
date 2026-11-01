// Codex review 2026-10-31 group 4, F30 (Owner console, typed: "מאשר את שש הקבוצות של קודקס ... כולל שינוי ב-... L-18 ..."): account deletion
// erases the quote-email recipient addresses and Maya's drafts of the account (migration 20261031500000) BEFORE the Auth account goes, and
// a failure stops the deletion (never a half-erased account reported as deleted); the 10-minute tick keeps the 30-day retention.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(`supabase/functions/${p}`, 'utf8');

describe('F30 wiring', () => {
  it('admin-delete-user erases the email records and help drafts inside the wipe, before the Auth delete', () => {
    const s = src('admin-delete-user/index.ts');
    const erase = s.indexOf("adminClient.rpc('account_erase_agent_and_email_records', { p_user: targetUserId })");
    expect(erase).toBeGreaterThan(0);
    expect(erase).toBeLessThan(s.indexOf('} catch (wipeErr: unknown) {'));
    expect(erase).toBeLessThan(s.indexOf('adminClient.auth.admin.deleteUser(targetUserId)'));
    expect(s).toContain("if (eraseErr) throw new Error('Failed to erase the email send records and help drafts');");
  });
  it('the scheduled-health tick runs the 30-day retention', () => {
    expect(src('scheduled-health/index.ts')).toContain("await admin.rpc('privacy_retention_tick')");
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildTrialReminderEmail, senderAddressFor } from './reminderContent.ts';

// Subscriptions cutover (OD-16): the operational trial reminder job is unchanged in behavior (stages, subjects, recipients,
// sender, schedule); the only copy change is that the retired legacy plan name no longer appears in the body.
const T = '2026-10-10T08:00:00.000Z';

describe('trial reminder copy - no legacy plan name, behavior unchanged', () => {
  it.each([['3d', 'Local'], ['3d', 'International'], ['24h', 'Local'], ['24h', 'International']])('%s / %s: no PRO / Basic in subject, html or text', (stage, market) => {
    const m = buildTrialReminderEmail({ stage, businessName: 'Acme', trialEndsAt: T, market });
    expect(`${m.subject}\n${m.html}\n${m.text}`).not.toMatch(/\bPRO\b|\bBASIC\b|\bPro\b|\bBasic\b|פרו|בייסיק/);
  });
  it('the subjects, the 3-day neutral wording and the senders are exactly as specified', () => {
    expect(buildTrialReminderEmail({ stage: '3d', businessName: 'A', trialEndsAt: T, market: 'Local' }).subject).toBe('תקופת הניסיון שלך ב-TEKANGO מסתיימת בעוד 3 ימים');
    expect(buildTrialReminderEmail({ stage: '3d', businessName: 'A', trialEndsAt: T, market: 'International' }).subject).toBe('Your TEKANGO trial ends in 3 days');
    expect(buildTrialReminderEmail({ stage: '24h', businessName: 'A', trialEndsAt: T, market: 'Local' }).subject).toBe('תזכורת אחרונה: תקופת הניסיון שלך מסתיימת מחר');
    expect(buildTrialReminderEmail({ stage: '24h', businessName: 'A', trialEndsAt: T, market: 'International' }).subject).toBe('Last reminder: your TEKANGO trial ends tomorrow');
    expect(buildTrialReminderEmail({ stage: '3d', businessName: 'A', trialEndsAt: T, market: 'Local' }).html).toContain('כדי להמשיך להשתמש בכל האפשרויות ללא הפרעה');
    expect(buildTrialReminderEmail({ stage: '3d', businessName: 'A', trialEndsAt: T, market: 'International' }).html).toContain('To keep enjoying all features without interruption, upgrade to a paid plan.');
    expect(senderAddressFor('Local')).toBe('TEKANGO Support <support@tekango.com>');
    expect(senderAddressFor('International')).toBe('TEKANGO <info@tekango.com>');
  });
  // night task 2026-10-16 (R-15, Owner default 2): the daily cron no longer invokes the trial job (no trial exists); the schedule stays
  it('the schedule is unchanged (one daily Vercel cron); the cron no longer invokes the retired trial job', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf-8'));
    // the daily job keeps its one schedule; the only other cron is the smart support email's evening summary (Owner 2026-10-20,
    // L-22 stage 2) and the Owner's monthly expense-invoice scan (Owner 2026-10-22, typed L-22) - no cron path reaches the retired trial job
    expect(vercel.crons.filter((c) => c.path === '/api/cron')).toEqual([{ path: '/api/cron', schedule: '0 8 * * *' }]);
    expect(vercel.crons.map((c) => c.path).sort()).toEqual(['/api/cron', '/api/expense-scan', '/api/support-digest']);
    expect(readFileSync('api/support-digest.js', 'utf-8')).not.toContain('send-trial-expiration-email');
    const cron = readFileSync('api/cron.js', 'utf-8');
    expect(cron).not.toContain("supabase.functions.invoke('send-trial-expiration-email', {");
    expect(cron).toContain("supabase.functions.invoke('send-subscription-expiration-email', {");
  });
});

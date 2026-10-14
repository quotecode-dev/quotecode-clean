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
    expect(buildTrialReminderEmail({ stage: '3d', businessName: 'A', trialEndsAt: T, market: 'Local' }).html).toContain('כדי להמשיך ליהנות מכלל היכולות ללא שום הפרעה');
    expect(buildTrialReminderEmail({ stage: '3d', businessName: 'A', trialEndsAt: T, market: 'International' }).html).toContain('To keep enjoying all features without interruption, upgrade to a paid plan.');
    expect(senderAddressFor('Local')).toBe('TEKANGO Support <support@tekango.com>');
    expect(senderAddressFor('International')).toBe('TEKANGO <info@tekango.com>');
  });
  it('the schedule and the cron wiring are untouched by this change (still one daily Vercel cron that invokes the trial job)', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf-8'));
    expect(vercel.crons).toEqual([{ path: '/api/cron', schedule: '0 8 * * *' }]);
    const cron = readFileSync('api/cron.js', 'utf-8');
    expect(cron).toContain("supabase.functions.invoke('send-trial-expiration-email', {");
  });
});

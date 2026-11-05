// Owner console 2026-11-05 (typed: "מאשר בניית 10 המיילים מהטבלה במשימת הלילה, שחרור עד הלייב כשהמיילים כבויים ללקוחות עד שאאשר את
// הנוסחים בבוקר"): the customer's email on every billing change - the words of each kind in both markets, never a hole, never "free",
// and the run sends each event once through the same claim / complete.
import { describe, it, expect, vi } from 'vitest';
import { billingContent, runNotices, type BillingFact, type Deps } from './lib';

const IL = (kind: BillingFact['kind'], details: Record<string, unknown>) => ({ kind, market: 'IL' as const, details: { currency: 'ILS', ...details } });
const EN = (kind: BillingFact['kind'], details: Record<string, unknown>) => ({ kind, market: 'INTERNATIONAL' as const, details: { currency: 'USD', ...details } });
const AT = '2026-11-25T15:48:24.917Z';

describe('the words of every billing email', () => {
  it('a resumed renewal: without / with SMART PACK / SMART PACK left off (HE + EN)', () => {
    const plain = billingContent(IL('renewal_resumed', { amountMinor: 3000, period: 'month', firstChargeAt: AT, smartPack: false }))!;
    expect(plain.subject).toBe('החיוב המתחדש של המנוי חודש');
    expect(plain.text).toContain('היום לא בוצע חיוב.');
    expect(plain.text).toContain('החיוב הבא: ₪30.00 בתאריך 25/11/2026, ואחר כך בכל חודש.');
    expect(billingContent(IL('renewal_resumed', { amountMinor: 4000, period: 'month', firstChargeAt: AT, smartPack: true }))!.text).toContain('₪40.00 בתאריך 25/11/2026, ואחר כך בכל חודש, כולל חכם פלוס.');
    expect(billingContent(IL('renewal_resumed', { amountMinor: 3000, period: 'month', firstChargeAt: AT, smartPack: false, smartPackUntil: AT }))!.text).toContain('חכם פלוס נשאר פעיל עד 25/11/2026, ולא יתחדש.');
    const en = billingContent(EN('renewal_resumed', { amountMinor: 1800, period: 'year', firstChargeAt: AT, smartPack: false }))!;
    expect(en.text).toContain('Your next charge: $18.00 on 11/25/2026, then every year.');
  });
  it('SMART PACK added, stopped renewal, early end, SMART PACK removed, annual reminder, first purchase', () => {
    expect(billingContent(IL('smart_pack_added', { amountMinor: 700, period: 'month', periodEnd: AT, totalMinor: 4000 }))!.text).toContain('שולם היום ₪7.00, על הימים עד 25/11/2026.');
    expect(billingContent(IL('renewal_stopped', { paidThrough: AT }))!.text).toContain('המנוי פעיל עד 25/11/2026.');
    const early = billingContent(IL('ended_early', { effectiveEnd: AT, refundMinor: 1350 }))!.text;
    expect(early).toContain('החזר של ₪13.50 יועבר לכרטיס שבו שילמתם, לפי סעיף 6 בתנאי השימוש.');
    expect(billingContent(IL('ended_early', { effectiveEnd: AT, refundMinor: 0 }))!.text).not.toContain('החזר');
    expect(billingContent(IL('smart_pack_removed', { effectiveAt: AT, refundMinor: 0, period: 'month' }))!.text).toContain('חכם פלוס פעיל עד 25/11/2026 ולא יתחדש.');
    expect(billingContent(EN('annual_reminder', { amountMinor: 18400, renewsAt: AT }))!.text).toContain('On 11/25/2026 the annual renewal of your TEKANGO subscription will be charged: $184.00.');
    expect(billingContent(IL('first_purchase', { amountMinor: 30600, period: 'year', paidThrough: AT, smartPack: false }))!.text).toContain('תודה! המנוי השנתי שלכם ב-TEKANGO פעיל.');
  });
  it('never an email with a hole, never "free", always the sign-off', () => {
    expect(billingContent(IL('renewal_resumed', { amountMinor: 3000 }))).toBeNull();
    expect(billingContent(IL('smart_pack_added', { amountMinor: 700, periodEnd: AT }))).toBeNull();
    expect(billingContent({ kind: 'first_purchase', market: 'IL', details: { amountMinor: 3000, paidThrough: AT } })).toBeNull(); // no currency
    for (const c of [billingContent(IL('renewal_stopped', { paidThrough: AT }))!, billingContent(EN('renewal_stopped', { paidThrough: AT }))!]) {
      expect(c.text).not.toMatch(/חינם|free/i);
      expect(c.text).toMatch(/צוות TEKANGO|The TEKANGO team/);
    }
  });
});

describe('the run', () => {
  it('each billing event is claimed, sent once and completed; a fact with a hole is skipped', async () => {
    const send = vi.fn(async () => ({ ok: true, status: 200, id: 'm1' }));
    const claim = vi.fn(async () => 'key-1');
    const complete = vi.fn(async () => true);
    const facts: BillingFact[] = [
      { account_id: 'u1', email: 'a@x.test', market: 'IL', kind: 'renewal_stopped', episode_at: AT, details: { currency: 'ILS', paidThrough: AT } },
      { account_id: 'u2', email: 'b@x.test', market: 'IL', kind: 'first_purchase', episode_at: AT, details: { currency: 'ILS' } },
    ];
    const d: Deps = { facts: async () => [], lifecycle: async () => [], billing: async () => facts, claim, complete, send,
      now: () => new Date('2026-11-05T09:00:00Z'), uuid: () => 'x' };
    const r = await runNotices(d);
    expect(r).toMatchObject({ ok: true, sent: 1, failed: 0 });
    expect(claim).toHaveBeenCalledWith('u1', 'renewal_stopped', AT, 0, 'customer-notice/x');
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'a@x.test', subject: 'החידוש האוטומטי של המנוי הופסק', from: 'TEKANGO Support <support@tekango.com>' });
    expect(complete).toHaveBeenCalledWith('u1', 'renewal_stopped', AT, 0, 'key-1', 'sent', 'm1');
  });
});

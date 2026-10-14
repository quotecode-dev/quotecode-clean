import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildSubscriptionLifecycleEmail, LIFECYCLE_EVENTS, LIFECYCLE_EVENT_STATUS, LIFECYCLE_TEMPLATES_STATUS, LifecycleTemplateError,
} from './subscriptionLifecycleTemplates.ts';
import { SUBSCRIPTION_STATUSES } from './subscriptionContract.ts';

// Prepared, unsent lifecycle templates (OD-16; OPEN-08/09/12 stay undecided): canonical names, HE RTL / EN LTR, no amount, no
// refund / proration / grace / retry / retention promise, and not wired to any sending path.
const PAID = ['classic', 'modern', 'visual'];
const NAMES = { he: { classic: 'קלאסיק', modern: 'מודרן', visual: 'ויזואל' }, en: { classic: 'Classic', modern: 'Modern', visual: 'Visual' } };
const FORBIDDEN = /refund|prorat|grace|retry|will be retried|within \d+|\d+ days|downgrad|retain|retention|deleted|delete|unlimited|trial|\bPRO\b|\bBASIC\b|\bPro\b|\bBasic\b|החזר|זיכוי|יחסי|תקופת חסד|ניסיון|ללא הגבלה|יימחק|נמחק|שמירת|₪|\$|USD|ILS/;
// no amount in the copy (the html style attributes carry decimals, so subject + text only)
const MONEY = /\d+\.\d\d|\d+\s*(?:₪|USD|ILS)/;

describe('subscription lifecycle templates (prepared, unsent)', () => {
  it('declares itself prepared + unsent and covers exactly the four lifecycle events with contract statuses', () => {
    expect(LIFECYCLE_TEMPLATES_STATUS).toBe('prepared_unsent');
    expect([...LIFECYCLE_EVENTS]).toEqual(['plan_activated', 'payment_failed', 'payment_recovered', 'cancelled']);
    for (const s of Object.values(LIFECYCLE_EVENT_STATUS)) expect(SUBSCRIPTION_STATUSES).toContain(s);
    expect(LIFECYCLE_EVENT_STATUS.payment_failed).toBe('past_due');
  });

  it.each(LIFECYCLE_EVENTS)('%s: every paid plan x language renders canonical names, the right direction and no undecided promise', (event) => {
    for (const lang of ['he', 'en']) for (const planId of PAID) {
      const m = buildSubscriptionLifecycleEmail({ event, lang, planId, businessName: 'Acme' });
      expect(m.subject).toContain(NAMES[lang][planId]);
      expect(m.text).toContain(NAMES[lang][planId]);
      expect(m.dir).toBe(lang === 'he' ? 'rtl' : 'ltr');
      expect(m.html).toContain(`dir="${m.dir}"`);
      expect(`${m.subject}\n${m.text}\n${m.html}`, `${event}/${lang}/${planId}`).not.toMatch(FORBIDDEN);
      expect(`${m.subject}\n${m.text}`).not.toMatch(MONEY);
      expect(m.text).toContain(lang === 'he' ? 'support@tekango.com' : 'info@tekango.com');
      if (lang === 'en') expect(`${m.subject}${m.text}${m.html}`).not.toMatch(/[֐-׿]/);
    }
  });

  it('the payment-failed copy states the status only - no deadline, no suspension date, no automatic action', () => {
    const he = buildSubscriptionLifecycleEmail({ event: 'payment_failed', lang: 'he', planId: 'modern' });
    expect(he.text).toContain('מצב המנוי שלך כעת: ממתין לתשלום.');
    const en = buildSubscriptionLifecycleEmail({ event: 'payment_failed', lang: 'en', planId: 'modern' });
    expect(en.text).toContain('Your subscription status is now: payment due.');
    expect(en.text).not.toMatch(/suspend|until|before|deadline|automatically/i);
  });

  it('fails closed: unknown event, unknown language, Free, a legacy plan name or garbage all throw', () => {
    const bad = [
      { event: 'renewed', lang: 'en', planId: 'classic' }, { event: 'cancelled', lang: 'fr', planId: 'classic' },
      { event: 'cancelled', lang: 'en', planId: 'free' }, { event: 'cancelled', lang: 'en', planId: 'pro' },
      { event: 'cancelled', lang: 'he', planId: 'basic' }, { event: 'cancelled', lang: 'en', planId: null },
    ];
    for (const b of bad) expect(() => buildSubscriptionLifecycleEmail(b), JSON.stringify(b)).toThrow(LifecycleTemplateError);
  });

  it('HTML-escapes the business name (it is user data)', () => {
    const m = buildSubscriptionLifecycleEmail({ event: 'plan_activated', lang: 'en', planId: 'visual', businessName: '<img src=x onerror=alert(1)>' });
    expect(m.html).not.toContain('<img src=x');
    expect(m.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('is NOT wired to any sending path: no function, cron or API file imports it, and it has no transport', () => {
    const src = readFileSync('supabase/functions/_shared/subscriptionLifecycleTemplates.ts', 'utf-8');
    expect(src).not.toMatch(/fetch\(|resend|Deno\.env|createClient|from:\s*['"`]/i);
    const importers = [];
    const walk = (dir) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (n === 'node_modules' || n.startsWith('.')) continue;
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|js|jsx|mjs)$/.test(n) && !/\.test\./.test(n) && !p.endsWith('subscriptionLifecycleTemplates.ts')
          && /(?:from|import\()\s*['"][^'"]*subscriptionLifecycleTemplates/.test(readFileSync(p, 'utf-8'))) importers.push(p);
      }
    };
    for (const d of ['supabase/functions', 'api', 'src', 'scripts']) walk(d);
    expect(importers).toEqual([]);
  });
});

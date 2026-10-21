// Subscription lifecycle email templates (OD-16, CROSSCUT_CONTRACT stream C) - PREPARED, UNSENT.
//
// Status: these templates are NOT wired to any function, schedule, trigger, webhook or transport. Nothing imports them in a
// sending path; there is no sender address, no provider call and no recipient lookup here. They exist so the copy can be
// reviewed and tested before the billing lifecycle is activated (OPEN-09 / OPEN-12). Wiring them requires an explicit Owner /
// communication authority decision.
//
// Content rules (OWNER_DECISIONS_LOCKED_2026-10-07.md):
//   - canonical plan names only (OD-16): HE חינם/קלאסיק/מודרן/ויזואל, EN Free/Classic/Modern/Visual - never a legacy name;
//   - HE is RTL / EN is LTR; no shekel figure on the English side (OD-11) - the templates carry no amount at all;
//   - no promise that is not decided (OPEN-09): no refund, no proration, no grace period, no retry schedule, no access window,
//     no automatic downgrade date, no data-retention statement (OPEN-08);
//   - the subscription status names follow subscriptionContract.ts SUBSCRIPTION_STATUSES (past_due = payment failed).
// Pure module: no Deno globals, no I/O, no remote imports.
import { planName, normalizePlanId, type Lang, type PlanId } from './subscriptionContract.ts';

export const LIFECYCLE_TEMPLATES_STATUS = 'prepared_unsent' as const;

export const LIFECYCLE_EVENTS = Object.freeze(['plan_activated', 'payment_failed', 'payment_recovered', 'cancelled'] as const);
export type LifecycleEvent = typeof LIFECYCLE_EVENTS[number];

// The subscription status each event reports (subscriptionContract.ts SUBSCRIPTION_STATUSES).
export const LIFECYCLE_EVENT_STATUS: Readonly<Record<LifecycleEvent, 'active' | 'past_due' | 'cancelled'>> = Object.freeze({
  plan_activated: 'active',
  payment_failed: 'past_due',
  payment_recovered: 'active',
  cancelled: 'cancelled',
});

const SUPPORT_EMAIL: Readonly<Record<Lang, string>> = Object.freeze({ he: 'support@tekango.com', en: 'info@tekango.com' });

export type LifecycleEmail = { readonly subject: string; readonly text: string; readonly html: string; readonly lang: Lang; readonly dir: 'rtl' | 'ltr' };

export class LifecycleTemplateError extends Error {
  constructor(message: string) { super(message); this.name = 'LifecycleTemplateError'; }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

type Copy = { subject: string; lines: string[] };

function copyFor(event: LifecycleEvent, lang: Lang, plan: string, name: string): Copy {
  const support = SUPPORT_EMAIL[lang];
  if (lang === 'he') {
    switch (event) {
      case 'plan_activated':
        return { subject: `המסלול ${plan} שלך ב-TEKANGO הופעל`, lines: [`שלום ${name},`, `המסלול ${plan} הופעל בחשבון שלך ב-TEKANGO.`, 'פרטי המסלול מופיעים בהגדרות החשבון.', `לשאלות אפשר לפנות אלינו: ${support}`] };
      case 'payment_failed':
        return { subject: `התשלום עבור המסלול ${plan} לא התקבל`, lines: [`שלום ${name},`, `לא הצלחנו לקבל את התשלום עבור המסלול ${plan} בחשבון שלך ב-TEKANGO.`, 'מצב המנוי שלך כעת: ממתין לתשלום.', `להסדרת התשלום או לכל שאלה אפשר לפנות אלינו: ${support}`] };
      case 'payment_recovered':
        return { subject: `התשלום עבור המסלול ${plan} התקבל`, lines: [`שלום ${name},`, `התשלום עבור המסלול ${plan} התקבל, והמסלול פעיל שוב בחשבון שלך ב-TEKANGO.`, `לשאלות אפשר לפנות אלינו: ${support}`] };
      case 'cancelled':
        return { subject: `המנוי למסלול ${plan} בוטל`, lines: [`שלום ${name},`, `המנוי שלך למסלול ${plan} ב-TEKANGO בוטל.`, `לשאלות על החשבון אפשר לפנות אלינו: ${support}`] };
    }
  }
  switch (event) {
    case 'plan_activated':
      return { subject: `Your TEKANGO ${plan} plan is active`, lines: [`Hi ${name},`, `The ${plan} plan is now active on your TEKANGO account.`, 'You can see your plan details in your account settings.', `Questions? Contact us at ${support}`] };
    case 'payment_failed':
      return { subject: `The payment for your ${plan} plan did not go through`, lines: [`Hi ${name},`, `We could not collect the payment for the ${plan} plan on your TEKANGO account.`, 'Your subscription status is now: payment due.', `To settle the payment or for any question, contact us at ${support}`] };
    case 'payment_recovered':
      return { subject: `The payment for your ${plan} plan was received`, lines: [`Hi ${name},`, `The payment for the ${plan} plan was received, and the plan is active again on your TEKANGO account.`, `Questions? Contact us at ${support}`] };
    case 'cancelled':
      return { subject: `Your ${plan} plan subscription was cancelled`, lines: [`Hi ${name},`, `Your subscription to the ${plan} plan on TEKANGO was cancelled.`, `Questions about your account? Contact us at ${support}`] };
  }
  throw new LifecycleTemplateError(`unknown lifecycle event "${String(event)}"`);
}

/**
 * Builds one lifecycle email. Throws LifecycleTemplateError for an unknown event, a non-canonical plan, Free (lifecycle events
 * concern paid plans only) or an unknown language - it never falls back to a guessed plan or language.
 */
export function buildSubscriptionLifecycleEmail({ event, lang, planId, businessName }: {
  event: unknown; lang: unknown; planId: unknown; businessName?: string | null;
}): LifecycleEmail {
  if (!(LIFECYCLE_EVENTS as readonly unknown[]).includes(event)) throw new LifecycleTemplateError(`unknown lifecycle event "${String(event)}"`);
  if (lang !== 'he' && lang !== 'en') throw new LifecycleTemplateError(`unknown language "${String(lang)}"`);
  const id: PlanId | null = normalizePlanId(planId);
  if (!id || id === 'free') throw new LifecycleTemplateError(`lifecycle emails concern a paid canonical plan, got "${String(planId)}"`);
  const plan = planName(id, lang) as string;
  const raw = typeof businessName === 'string' && businessName.trim() ? businessName.trim().slice(0, 120) : (lang === 'he' ? 'עסק יקר' : 'there');
  const c = copyFor(event as LifecycleEvent, lang, plan, raw);
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const htmlCopy = copyFor(event as LifecycleEvent, lang, escapeHtml(plan), escapeHtml(raw));
  const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Segoe UI,sans-serif;">
  <div dir="${dir}" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;text-align:${lang === 'he' ? 'right' : 'left'};color:#1e293b;">
    <div style="font-weight:800;color:#6d28d9;margin-bottom:16px;">TEKANGO</div>
    ${htmlCopy.lines.map((l) => `<p style="font-size:0.95rem;line-height:1.6;margin:0 0 12px;">${l}</p>`).join('\n    ')}
  </div>
</body>
</html>`;
  return Object.freeze({ subject: c.subject, text: c.lines.join('\n'), html, lang, dir });
}

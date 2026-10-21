// OD-17: the wording of the one capability upgrade notice (CapabilityUpgradeNotice.jsx). Pure; no legacy plan names.
import { CAPABILITIES, planName } from '../../../supabase/functions/_shared/subscriptionContract.ts';
import { accountStatusModel } from './accountSummaryClient';

export function capabilityNoticeCopy(lang, capabilityId, summary) {
  const he = lang === 'he';
  const meta = CAPABILITIES[capabilityId];
  const label = meta ? meta.label[he ? 'he' : 'en'] : (he ? 'יכולת זו' : 'This capability');
  const explanation = meta ? meta.explanation[he ? 'he' : 'en'] : '';
  const status = accountStatusModel(summary, lang);
  const currentPlan = status.tone === 'plan'
    ? (he ? `המסלול הנוכחי: ${status.label}` : `Current plan: ${status.label}`)
    : status.label;
  const approved = summary?.state === 'ready' ? summary.eligiblePlans?.[capabilityId] : null;
  const eligibleNames = Array.isArray(approved) && approved.length
    ? approved.map((p) => planName(p, lang)).filter(Boolean)
    : null;
  return {
    title: he ? `${label} אינו כלול במסלול הנוכחי` : `${label} is not included in the current plan`,
    explanation,
    currentPlan,
    eligible: eligibleNames
      ? (he ? `כלול במסלולים: ${eligibleNames.join(', ')}` : `Included in: ${eligibleNames.join(', ')}`)
      : (he ? 'המסלולים שיכללו יכולת זו טרם נקבעו.' : 'The plans that will include this have not been decided yet.'),
    unchanged: he ? 'לא בוצע שום שינוי: ההצעה, הטיוטה והקבצים נשארו כפי שהיו, ולא נוצלה הצעה.' : 'Nothing was changed: the quote, the draft and the files stay as they were, and no quote was used.',
    upgrade: he ? 'לצפייה במסלולים' : 'View plans',
    close: he ? 'סגירה' : 'Close',
  };
}

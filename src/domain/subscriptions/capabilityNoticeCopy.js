// OD-17: the wording of the one capability upgrade notice (CapabilityUpgradeNotice.jsx). Pure; no legacy plan names.
import { CAPABILITIES, planName } from '../../../supabase/functions/_shared/subscriptionContract.ts';
import { accountStatusModel } from './accountSummaryClient';
import { SMART_PACK } from './addOnCatalog';
import { smartPackPurchasePath } from '../../../supabase/functions/_shared/subscriptionContract.ts';
import { ilsSmartPack } from '../../components/landing/smartPackFacts';

// Owner console 2026-10-25 (typed: "מאשר שינוי ב-L-05: יכולות חכם פלוס נחסמות ברגע הלחיצה למי שאין לו חכם פלוס"): the notice of a
// SMART PACK feature (smart quote, dictation, voice chat, attachments) - what SMART PACK is, its price where it can be bought, the plans button
function smartPackNoticeCopy(he, summary) {
  const status = accountStatusModel(summary, he ? 'he' : 'en');
  const market = summary?.state === 'ready' ? summary.market : null;
  // the promise only where the plans window can sell it to THIS account now (findings 1-13: smartPackPurchasePath); abroad says so
  const open = smartPackPurchasePath(summary) !== null && SMART_PACK.purchasable.IL === true;
  const closedAbroad = market === 'INTERNATIONAL';
  const tail = open ? (he ? ' אפשר להוסיף אותו בחלון המסלולים.' : ' You can add it in the plans window.')
    : closedAbroad ? (he ? ' הרכישה עדיין לא פתוחה בחשבונות מחוץ לישראל.' : ' Purchasing is not open yet for accounts outside Israel.') : '';
  return {
    title: he ? 'האפשרות הזו כלולה בחכם פלוס' : 'This is part of SMART PACK',
    explanation: `${SMART_PACK.summary[he ? 'he' : 'en']}${tail}`,
    currentPlan: status.tone === 'plan' ? (he ? `המסלול הנוכחי: ${status.label}` : `Current plan: ${status.label}`) : status.label,
    eligible: open
      ? (he ? `המחיר: ${ilsSmartPack('month')} לחודש, או ${ilsSmartPack('year')} לשנה במנוי שנתי.` : `Price: ${ilsSmartPack('month')} a month, or ${ilsSmartPack('year')} a year with an annual plan.`)
      : '',
    unchanged: he ? 'לא בוצע שום שינוי ולא בוצע חיוב.' : 'Nothing was changed and nothing was charged.',
    upgrade: he ? 'לחלון המסלולים' : 'View plans',
    close: he ? 'סגירה' : 'Close',
  };
}

export function capabilityNoticeCopy(lang, capabilityId, summary) {
  const he = lang === 'he';
  if (capabilityId === 'smart_pack') return smartPackNoticeCopy(he, summary);
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
    title: he ? `האפשרות ״${label}״ אינה כלולה במסלול הנוכחי` : `${label} is not included in the current plan`,
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

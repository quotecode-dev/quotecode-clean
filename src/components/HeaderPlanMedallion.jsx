// Owner 2026-10-14: the dashboard header keeps a ROUND button (where the avatar was) that tells the account's plan, in the style of the
// earlier plan medallions (a solid colored disc with a white icon - PlanIdentityBadge): lifetime -> infinity, Plans (subscriptions not
// active) -> the plans list icon, Free-10 enforced -> a leaf with a progress ring of the quotes left, a paid plan -> a crown.
// Motion (modern, restrained): on arrival the disc pops in, a light ring sweeps once around it and the plan name shows in a small
// bubble under it for a moment; hover / keyboard focus shows the bubble again and replays the sweep. prefers-reduced-motion: no
// motion, the bubble only on hover / focus. Click opens the plans window. The model is planBadgeModel (one source with Settings and
// the plans window).
import { useEffect, useState } from 'react';
import { Infinity as InfinityIcon, LayoutList, Leaf, Crown } from 'lucide-react';
import './headerPlanMedallion.css';

const VISUAL = {
  lifetime: { Icon: InfinityIcon, color: '#b7791f' },
  plans: { Icon: LayoutList, color: '#0f6672' },
  free10: { Icon: Leaf, color: '#059669' },
  plan: { Icon: Crown, color: '#6d28d9' },
};
export const MEDALLION_INTRO_MS = 2400;

export default function HeaderPlanMedallion({ model, isHebrew, onOpen }) {
  const visual = VISUAL[model.kind] || VISUAL.plans;
  const { Icon } = visual;
  const [intro, setIntro] = useState(true);
  useEffect(() => { const t = window.setTimeout(() => setIntro(false), MEDALLION_INTRO_MS); return () => window.clearTimeout(t); }, []);
  const hasProgress = model.kind === 'free10' && Number.isFinite(model.remaining) && Number.isFinite(model.total) && model.total > 0;
  const ratio = hasProgress ? Math.max(0, Math.min(1, model.remaining / model.total)) : 1;
  const a11y = isHebrew ? `${model.label} - פתיחת חלון המסלולים` : `${model.label} - open the plans window`;
  return (
    // PRODUCT_TRUTH_DECORATIVE: opens the in-app plans window (PricingModal); changes no data
    <button type="button" className={`hpm${intro ? ' hpm--intro' : ''}`} data-testid="header-plan-button" data-plan-kind={model.kind} onClick={onOpen} aria-haspopup="dialog" aria-label={a11y} style={{ '--hpm-color': visual.color, '--hpm-ratio': ratio }}>
      <span className="hpm-ring" aria-hidden="true" />
      {hasProgress && <span className="hpm-progress" aria-hidden="true" />}
      <span className="hpm-disc" aria-hidden="true"><Icon size={17} strokeWidth={2.3} /></span>
      <span className="hpm-bubble" aria-hidden="true" dir={isHebrew ? 'rtl' : 'ltr'}><bdi>{model.label}</bdi></span>
    </button>
  );
}

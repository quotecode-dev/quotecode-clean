// Owner 2026-10-14: the dashboard header keeps a ROUND button (where the avatar was) that tells the account's plan, in the style of the
// Owner's earlier plan medallions (reference image: a light disc, a crisp colored ring and a colored outline icon - FREE leaf green,
// BASIC gem blue, PRO crown violet): lifetime -> gold infinity, Plans (subscriptions not active) -> teal plans list, Free-10 enforced
// -> green sprout with the ring as the share of quotes left, a paid plan -> violet crown.
// Motion (tangible, v2): on arrival the disc drops in with a spring, the ring draws itself, the icon gives a small wiggle, a light shine
// crosses the disc and the plan name shows in a bubble under it for a moment; at rest a soft halo pulses every few seconds; hover /
// keyboard focus lifts the disc, wiggles the icon and shows the bubble; a press sinks it. prefers-reduced-motion: no motion, the bubble
// only on hover / focus. Click opens the plans window. The model is planBadgeModel (one source with Settings and the plans window).
import { useEffect, useId, useState } from 'react';
import { Infinity as InfinityIcon, LayoutList, Sprout, Crown, CalendarCheck, Timer, TimerOff, CircleDashed } from 'lucide-react';
import './headerPlanMedallion.css';

const VISUAL = {
  lifetime: { Icon: InfinityIcon, c1: '#f6c445', c2: '#c98a06', ink: '#b07604' },
  plans: { Icon: LayoutList, c1: '#2dd4bf', c2: '#0f766e', ink: '#0f6672' },
  free10: { Icon: Sprout, c1: '#4ade80', c2: '#16a34a', ink: '#15803d' },
  plan: { Icon: Crown, c1: '#a78bfa', c2: '#6d28d9', ink: '#6d28d9' },
  // Owner console 2026-10-16 (approval naming L-03): the header shows the SAME status medallion as the admin - every status its own
  // (plan = a paid monthly subscription; the model is statusMedallionModel in subscriptionStatus.js).
  paid_annual: { Icon: CalendarCheck, c1: '#818cf8', c2: '#3730a3', ink: '#3730a3' },
  trial: { Icon: Timer, c1: '#fcd34d', c2: '#d97706', ink: '#b45309' },
  trial_ended: { Icon: TimerOff, c1: '#fca5a5', c2: '#b91c1c', ink: '#b91c1c' },
  none: { Icon: CircleDashed, c1: '#cbd5e1', c2: '#64748b', ink: '#64748b' },
};
// Owner console 2026-10-16: the admin shows the SAME plan icon (PlanMedallionMark.jsx reads this one table)
export const PLAN_MEDALLION_VISUAL = VISUAL;
export const MEDALLION_INTRO_MS = 2600;

export default function HeaderPlanMedallion({ model, isHebrew, onOpen }) {
  const visual = VISUAL[model.kind] || VISUAL.plans;
  const { Icon } = visual;
  const gid = `hpm-g-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [intro, setIntro] = useState(true);
  useEffect(() => { const t = window.setTimeout(() => setIntro(false), MEDALLION_INTRO_MS); return () => window.clearTimeout(t); }, []);
  const hasProgress = model.kind === 'free10' && Number.isFinite(model.remaining) && Number.isFinite(model.total) && model.total > 0;
  const ratio = hasProgress ? Math.max(0, Math.min(1, model.remaining / model.total)) : 1;
  const a11y = isHebrew ? `${model.label} - פתיחת חלון המסלולים` : `${model.label} - open the plans window`;
  return (
    // PRODUCT_TRUTH_DECORATIVE: opens the in-app plans window (PricingModal); changes no data
    <button type="button" className={`hpm${intro ? ' hpm--intro' : ''}${hasProgress ? ' hpm--progress' : ''}`} data-testid="header-plan-button" data-plan-kind={model.kind} onClick={onOpen} aria-haspopup="dialog" aria-label={a11y} style={{ '--hpm-ink': visual.ink, '--hpm-c1': visual.c1, '--hpm-c2': visual.c2, '--hpm-ratio': ratio }}>
      <span className="hpm-halo" aria-hidden="true" />
      <span className="hpm-disc" aria-hidden="true">
        <svg className="hpm-ring" viewBox="0 0 40 40" focusable="false">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={visual.c1} />
              <stop offset="1" stopColor={visual.c2} />
            </linearGradient>
          </defs>
          <circle className="hpm-track" cx="20" cy="20" r="17.5" pathLength="100" />
          <circle className="hpm-arc" cx="20" cy="20" r="17.5" pathLength="100" stroke={`url(#${gid})`} />
        </svg>
        <span className="hpm-icon"><Icon size={18} strokeWidth={2.4} /></span>
        <span className="hpm-shine" />
      </span>
      <span className="hpm-bubble" aria-hidden="true" dir={isHebrew ? 'rtl' : 'ltr'}><bdi>{model.label}</bdi></span>
    </button>
  );
}

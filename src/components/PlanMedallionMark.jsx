// Owner console 2026-10-16: "if the user's interface has an icon that reflects the plan, the SAME icon must be in the admin". This is
// the header plan medallion (HeaderPlanMedallion.jsx - one visual table, PLAN_MEDALLION_VISUAL) as a small static mark: the same light
// disc, gradient ring, icon and colors, chosen by the same model (planBadgeModel); no motion, no button, no bubble.
import { useId } from 'react';
import { PLAN_MEDALLION_VISUAL } from './HeaderPlanMedallion';

export default function PlanMedallionMark({ model, size = 24, label = null }) {
  const visual = PLAN_MEDALLION_VISUAL[model?.kind] || PLAN_MEDALLION_VISUAL.plans;
  const { Icon } = visual;
  const gid = `pmm-g-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const hasProgress = model?.kind === 'free10' && Number.isFinite(model.remaining) && Number.isFinite(model.total) && model.total > 0;
  const ratio = hasProgress ? Math.max(0, Math.min(1, model.remaining / model.total)) : 1;
  return (
    <span className="pmm" data-plan-kind={model?.kind || 'plans'} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}
      style={{ '--pmm-size': `${size}px`, '--pmm-ink': visual.ink, '--pmm-ratio': ratio }}>
      <svg className="pmm-ring" viewBox="0 0 40 40" focusable="false" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={visual.c1} />
            <stop offset="1" stopColor={visual.c2} />
          </linearGradient>
        </defs>
        <circle className="pmm-track" cx="20" cy="20" r="17.5" pathLength="100" />
        <circle className="pmm-arc" cx="20" cy="20" r="17.5" pathLength="100" stroke={`url(#${gid})`} />
      </svg>
      <span className="pmm-icon" aria-hidden="true"><Icon size={Math.round(size * 0.45)} strokeWidth={2.4} /></span>
    </span>
  );
}

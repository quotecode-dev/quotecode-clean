// OD-16 / OD-20: the one account plan badge. It renders ONLY the server account summary (account-summary/v1, through
// accountStatusModel): a canonical plan name (חינם/קלאסיק/מודרן/ויזואל, Free/Classic/Modern/Visual) with the real server
// balance for Free, or a neutral / fail-closed state line when the plan system is not active, the account is not assigned
// to a plan, or the summary cannot be loaded. It never derives a plan, a trial, a monthly counter or a balance itself.
//
// Geometry is kept from the previous badge (Task 16 restrained treatment): a solid medallion (no gradient, no glow) and a
// neutral pill; `onDark` swaps the label colors for the dark header card; the 12px detail line keeps the base line box.
import { Leaf, Gem, Crown, Sparkles, CircleDashed, AlertCircle } from 'lucide-react';
import { APP as NEON, APP_HEADER as SHELL } from '../theme/neonTheme';
import { accountStatusModel } from '../domain/subscriptions/accountSummaryClient';

const PLAN_VISUAL = {
  free: { Icon: Leaf, color: '#059669', text: 'emerald' },
  classic: { Icon: Gem, color: '#0369a1', text: 'sky' },
  modern: { Icon: Crown, color: '#6d28d9', text: 'violetLight' },
  visual: { Icon: Sparkles, color: '#9d174d', text: 'violetLight' },
};
const TONE_VISUAL = {
  neutral: { Icon: CircleDashed, color: '#64748b', text: 'textSecondary' },
  blocked: { Icon: AlertCircle, color: '#8B621E', text: 'amber' },
  error: { Icon: AlertCircle, color: '#9A4040', text: 'red' },
};

function badgeVisual(model) {
  return (model.tone === 'plan' && PLAN_VISUAL[model.planId]) || TONE_VISUAL[model.tone] || TONE_VISUAL.neutral;
}

export default function PlanIdentityBadge({ summary, isHebrew, variant = 'header', size = 'md', upgradeAvailable = false, singleLine = false, onDark = false }) {
  const lang = isHebrew ? 'he' : 'en';
  const model = accountStatusModel(summary, lang);
  const visual = badgeVisual(model);
  const { Icon } = visual;
  const label = model.label;
  const title = model.tone === 'plan'
    ? (isHebrew ? `מסלול נוכחי: ${label}` : `Current plan: ${label}`)
    : label;
  const textColor = onDark ? SHELL.sidebarTextActive : (NEON[visual.text] || NEON.textSecondary);

  const medallion = (px, iconPx) => (
    <span aria-hidden="true" style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, width: `${px}px`, height: `${px}px` }}>
      <span style={{ width: `${px}px`, height: `${px}px`, borderRadius: '50%', background: visual.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: 'none', flexShrink: 0 }}>
        <Icon size={iconPx} strokeWidth={2.3} />
      </span>
    </span>
  );

  if (variant === 'compact') {
    const compactMedallion = singleLine ? 18 : 22;
    return (
      <span
        title={title}
        data-testid="plan-identity-badge"
        data-account-state={model.state}
        data-plan-id={model.planId || ''}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: singleLine ? '6px' : '8px',
          background: onDark ? 'rgba(255,255,255,0.10)' : NEON.bgCardAlt,
          border: `1px solid ${onDark ? SHELL.sidebarBorder : NEON.border}`,
          borderRadius: '10px',
          padding: singleLine ? '5px 10px' : '6px 12px',
          minHeight: singleLine ? '30px' : '36px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        {medallion(compactMedallion, singleLine ? 11 : 13)}
        {singleLine ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 800, color: textColor, whiteSpace: 'nowrap' }}>
            {label}
            {model.detail && model.planId === 'free' && summary?.free10 && (
              <>
                <span style={{ opacity: 0.6, fontWeight: 600 }}>·</span>
                <span style={{ fontWeight: 700 }}>{isHebrew ? `נותרו ${summary.free10.remaining}` : `${summary.free10.remaining} left`}</span>
              </>
            )}
            {upgradeAvailable && <Crown size={10} fill="currentColor" strokeWidth={1} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.85 }} />}
          </span>
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 800, color: textColor, whiteSpace: 'nowrap' }}>
              {label}
              {upgradeAvailable && <Crown size={11} fill="currentColor" strokeWidth={1} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.85 }} />}
            </span>
            {model.detail && (
              // lineHeight 12.14px = the base c65f742 line box (0.66rem x 1.15) at the 12px text floor
              <span data-testid="plan-identity-detail" style={{ fontSize: '0.75rem', lineHeight: '12.14px', fontWeight: 600, color: onDark ? SHELL.sidebarTextMuted : NEON.textMuted, whiteSpace: 'nowrap' }}>
                {model.detail}
              </span>
            )}
          </span>
        )}
      </span>
    );
  }

  const isHeader = variant === 'header';
  const medallionSize = size === 'sm' ? 18 : 20;
  const fontSize = '0.75rem';
  const pillStyle = isHeader
    ? { background: 'rgba(255,255,255,0.18)', color: 'white', border: '1px solid rgba(255,255,255,0.35)' }
    : { background: `${visual.color}1a`, color: NEON[visual.text] || NEON.textSecondary, border: `1px solid ${visual.color}40` };
  return (
    <span
      title={title}
      data-testid="plan-identity-badge"
      data-account-state={model.state}
      data-plan-id={model.planId || ''}
      style={{ ...pillStyle, fontSize, fontWeight: 'bold', padding: '6px 10px', borderRadius: '12px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', whiteSpace: 'nowrap' }}
    >
      {medallion(medallionSize, medallionSize === 20 ? 12 : 11)}
      <span style={{ fontSize, lineHeight: 1 }}>{label}</span>
      {model.detail && <span data-testid="plan-identity-detail" style={{ fontSize, lineHeight: 1, fontWeight: 600 }}>{model.detail}</span>}
    </span>
  );
}

// Task 16 - CSS custom properties for the presentation controls, read from the shared APP (authenticated-interface)
// tokens so quotePresentation.css never hard-codes a palette (tints are derived with color-mix from these tokens).
// The only literal colors are QP_ILLUSTRATION: the small style thumbnails depict sample product imagery (refined R2
// .mini illustrations), not interface chrome.
import { APP, APP_FOCUS, APP_STATUS } from '../../theme/neonTheme';

export const QP_ILLUSTRATION = Object.freeze({
  '--qp-ill-warm': '#b55d31',
  '--qp-ill-sand': '#efece8',
  '--qp-ill-sage': '#718b7d',
  '--qp-ill-wood': '#d7b08f',
  '--qp-ill-mist': '#edf0eb',
});

export const QP_VARS = Object.freeze({
  '--qp-accent': APP.violet,
  '--qp-accent-strong': APP.violetLight,
  '--qp-accent-soft': APP.violetLighter,
  '--qp-on-accent': APP.textOnAccent,
  '--qp-text': APP.textPrimary,
  '--qp-text-2': APP.textSecondary,
  '--qp-muted': APP.textMuted,
  '--qp-border': APP.border,
  '--qp-border-strong': APP.borderStrong,
  '--qp-card': APP.bgCard,
  '--qp-card-alt': APP.bgCardAlt,
  '--qp-bg': APP.bg,
  '--qp-warn': APP_STATUS?.warning?.fg || APP.amber,
  '--qp-warn-bg': APP_STATUS?.warning?.bg || APP.bgCardAlt,
  '--qp-warn-border': APP_STATUS?.warning?.border || APP.borderStrong,
  '--qp-error': APP.red,
  '--qp-ok': APP.emerald,
  '--qp-focus': APP_FOCUS?.ring || APP.violet,
  ...QP_ILLUSTRATION,
});

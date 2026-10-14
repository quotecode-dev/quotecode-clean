// Task 16 + OD-17: the inline explanation shown when a style outside the account's presentation capability is chosen. It is
// the shared CapabilityUpgradeNotice (inline variant) for capability quote_style.<style>, with the style's own benefits and
// the read-only preview offer as details. It never purchases, links to checkout or changes the plan / draft / default;
// "Back to the draft style" (close) only hides it. The current plan line and eligible plans come from the server account
// summary (AccountSummaryContext); the eligible plans stay "not decided yet" until the Owner approves the matrix (OPEN-02).
import { useContext } from 'react';
import { Eye } from 'lucide-react';
import { STYLE_COPY } from '../../quoteDocument/quoteStyles';
import { presentationCopy } from './presentationCopy';
import CapabilityUpgradeNotice from '../subscriptions/CapabilityUpgradeNotice';
import { AccountSummaryContext } from '../../domain/subscriptions/AccountSummaryContext';

export default function LockedStyleDrawer({ lang = 'en', style, onClose, onOpenPreview, idPrefix = 'qp-locked' }) {
  const { summary, openPlans } = useContext(AccountSummaryContext);
  if (!style) return null;
  const copy = presentationCopy(lang);
  const c = (lang === 'he' ? STYLE_COPY.he : STYLE_COPY.en)[style];
  const details = (
    <div className="qp-drawer-details">
      <p>{copy.drawerBody}</p>
      <p className="qp-drawer-sub">{copy.lockedAdds}</p>
      <ul>{c.benefits.map((b) => <li key={b}>{b}</li>)}</ul>
      {onOpenPreview && (
        <div className="qp-row" style={{ margin: '10px 0 4px' }}>
          {/* PRODUCT_TRUTH_DECORATIVE: opens the read-only live preview of a style the plan does not include; changes no data */}
          <button type="button" className="qp-btn" onClick={() => onOpenPreview(style)} data-testid="qp-locked-preview"><Eye size={14} aria-hidden="true" />{copy.previewThisStyle}</button>
        </div>
      )}
    </div>
  );
  return (
    <CapabilityUpgradeNotice
      lang={lang}
      variant="inline"
      capabilityId={`quote_style.${style}`}
      summary={summary}
      details={details}
      onUpgrade={openPlans ? () => openPlans() : undefined}
      onClose={onClose}
      idPrefix={idPrefix}
      testIds={{ root: 'qp-locked-drawer', close: 'qp-locked-close' }}
      closeLabel={copy.drawerBack}
    />
  );
}

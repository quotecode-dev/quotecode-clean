// Task 16 - the creator's "Quote appearance" panel (mounted ONCE inside QuoteForm step 4). Style cards (draft override /
// business default), detail preference, images, preview access, the presentation-tier context and the explicit
// "Issue quote" action. Read-only (frozen style shown) for an issued or locked quote.
import { useState } from 'react';
import { Eye, Send, RefreshCw, Save } from 'lucide-react';
import { STYLE_COPY, styleSupportsImages } from '../../quoteDocument/quoteStyles';
import QuoteStylePicker from './QuoteStylePicker';
import QuoteMediaManager from './QuoteMediaManager';
import LockedStyleDrawer from './LockedStyleDrawer';
import IssueQuoteDialog from './IssueQuoteDialog';
import { needsDowngradeNotice } from './presentationState';
import { presentationErrorMessage } from './presentationCopy';
import { QP_VARS } from './qpTheme';
import './quotePresentation.css';

export default function QuotePresentationPanel({
  ctl,
  items = [],
  editingQuoteId = null,
  savedStatus = null, // the quote's status as saved on the server (issue is offered for a saved Draft)
  isUnfinished = false,
  // true when the form's submit saves a draft (new quote, or a saved quote whose status stays Draft) - QuoteForm decides
  savesAsDraft = false,
  onIssue,
  issueBusy = false,
}) {
  const { copy, lang, context, value, effective, readOnly, tier } = ctl;
  const [defaultMsg, setDefaultMsg] = useState(null);
  const [busyStyle, setBusyStyle] = useState(null);
  const [issueDialog, setIssueDialog] = useState(null); // null | 'confirm' | 'not_entitled'
  const styleCopy = lang === 'he' ? STYLE_COPY.he : STYLE_COPY.en;
  const title = (s) => styleCopy[s]?.title || s;
  const issued = !!ctl.server.issued;
  const isSavedDraft = !!editingQuoteId && String(savedStatus || '').toLowerCase() === 'draft';
  // images are offered for the quote's own (entitled) style only - never because a locked style is being previewed
  const showImages = styleSupportsImages(effective.style) || value.media.length > 0;
  // M3: until the presentation context is ready the tier is UNKNOWN - no plan claims, no locks, no style/default/issue changes
  const ready = context.status === 'ready';
  // an existing quote's saved record must be known before anything can change (never overwrite an unknown record)
  const locked = readOnly || !ctl.editable;
  const recordPending = !!editingQuoteId && !readOnly && !ctl.recordReady;

  const makeDefault = async (style) => {
    setBusyStyle(style);
    setDefaultMsg(null);
    const r = await ctl.makeDefault(style);
    setBusyStyle(null);
    if (r.ok) setDefaultMsg({ kind: 'ok', text: copy.defaultSaved(title(style)) });
    else if (r.code !== 'style_not_entitled' && r.code !== 'context_unavailable') setDefaultMsg({ kind: 'error', text: copy.defaultFailed(presentationErrorMessage(lang, r.code)) });
  };

  const startIssue = () => {
    if (!effective.entitled) { setIssueDialog('not_entitled'); return; }
    setIssueDialog('confirm');
  };

  const previewButton = ctl.ui.layout === 'split'
    ? (ctl.ui.splitHidden ? { label: copy.showPreview, act: () => ctl.setSplitHidden(false) } : null)
    : { label: copy.openPreview, act: () => ctl.openPreview() };

  return (
    <section className="qp-root qp-panel" dir={lang === 'he' ? 'rtl' : 'ltr'} style={QP_VARS} aria-labelledby="qp-panel-title" data-testid="qp-panel">
      <div className="qp-panel-head">
        <div>
          <span className="qp-eyebrow">{copy.panelEyebrow}</span>
          <h3 id="qp-panel-title" className="qp-panel-title">{copy.panelTitle}</h3>
        </div>
        {previewButton && (
          // PRODUCT_TRUTH_DECORATIVE: opens / shows the read-only live preview of the quote being edited
          <button type="button" className="qp-btn" onClick={previewButton.act} data-testid="qp-open-preview">
            <Eye size={14} aria-hidden="true" />{previewButton.label}
          </button>
        )}
      </div>

      {ready && (
        <p className="qp-review-note" data-testid="qp-plan-context">{copy.entitlement[tier] || copy.entitlement.classic}</p>
      )}
      {(context.status === 'loading' || context.status === 'idle') && <p className="qp-notice" role="status" data-testid="qp-context-loading">{copy.contextLoading}</p>}
      {context.status === 'error' && (
        <p className="qp-notice" role="alert" data-testid="qp-context-error">
          {copy.contextError}{' '}
          {/* PRODUCT_TRUTH_DECORATIVE: retries loading the appearance settings (read-only request) */}
          <button type="button" className="qp-btn qp-btn--ghost" onClick={ctl.reloadContext}><RefreshCw size={12} aria-hidden="true" />{copy.retry}</button>
        </p>
      )}

      {readOnly && (
        <p className="qp-notice" role="note" data-testid="qp-readonly">
          {issued ? copy.readOnlyIssued(title(effective.style)) : copy.readOnlyLocked(title(effective.style))}
        </p>
      )}
      {recordPending && (
        <p className="qp-notice" role={ctl.server.status === 'error' ? 'alert' : 'status'} data-testid="qp-record-pending">
          {ctl.server.status === 'error' ? copy.recordError : copy.recordLoading}{' '}
          {ctl.server.status === 'error' && (
            // PRODUCT_TRUTH_DECORATIVE: retries loading this quote's saved appearance (read-only request)
            <button type="button" className="qp-btn qp-btn--ghost" onClick={ctl.reloadServer} data-testid="qp-record-retry"><RefreshCw size={12} aria-hidden="true" />{copy.retry}</button>
          )}
        </p>
      )}
      {ready && !locked && needsDowngradeNotice({ presentation: value, tier }) && (
        <p className="qp-notice qp-notice--warn" role="note" data-testid="qp-downgrade-notice">{copy.downgradeNotice(title(value.style))}</p>
      )}

      <div className="qp-section qp-section--styles">
        <QuoteStylePicker
          lang={lang}
          tier={tier}
          mode="quote"
          selectedStyle={value.style}
          effectiveStyle={effective.style}
          businessDefault={ctl.businessDefault}
          readOnly={locked}
          tierKnown={ready}
          busyStyle={busyStyle}
          onSelect={ctl.chooseStyle}
          onLockedSelect={ctl.chooseStyle}
          onMakeDefault={ready ? makeDefault : null}
          idPrefix="qp-quote-style"
        />
        {ready && !locked && value.style && (
          <div className="qp-row" style={{ marginTop: 8 }}>
            {/* PRODUCT_TRUTH_CAPABILITY: quote_create */}
            <button type="button" className="qp-btn qp-btn--ghost" onClick={ctl.resetToBusinessDefault} data-testid="qp-use-default">{copy.useBusinessDefault}</button>
          </div>
        )}
        {ready && (
          <p className="qp-preview-notice" role="status" data-testid="qp-preview-notice">
            {ctl.previewStyle && ctl.previewStyle !== effective.style
              ? (() => { const [b, rest] = copy.previewOther(title(ctl.previewStyle), title(effective.style)); return <><b>{b}</b>{rest}</>; })()
              : (() => { const [b, rest] = copy.previewSame(title(effective.style)); return <><b>{b}</b>{rest}</>; })()}
          </p>
        )}
        <LockedStyleDrawer
          lang={lang}
          style={ctl.ui.lockedStyle}
          onClose={ctl.closeLockedDialog}
          onOpenPreview={ctl.ui.layout === 'stack' ? ctl.previewLockedStyle : null}
        />
        {defaultMsg && (
          <p className={`qp-notice${defaultMsg.kind === 'error' ? ' qp-notice--error' : ''}`} role={defaultMsg.kind === 'error' ? 'alert' : 'status'}>{defaultMsg.text}</p>
        )}
      </div>

      <div className="qp-section">
        <h4 id="qp-detail-label" className="qp-section-title">{copy.detailLabel}</h4>
        <div className="qp-seg" role="group" aria-labelledby="qp-detail-label">
          {['compact', 'expanded'].map((d) => (
            // PRODUCT_TRUTH_DECORATIVE: preview/print detail preference (Compact / Expanded); never a plan feature, no data change
            <button key={d} type="button" aria-pressed={(value.detail || 'compact') === d} onClick={() => ctl.setDetail(d)} data-testid={`qp-detail-${d}`}>
              {d === 'compact' ? copy.compact : copy.expanded}
            </button>
          ))}
        </div>
        <p className="qp-hint">{copy.detailHint}</p>
      </div>

      {showImages && <QuoteMediaManager ctl={ctl} items={items} readOnly={locked} />}

      <p className="qp-creator-message"><b>{copy.creatorMessage[0]}</b>{copy.creatorMessage[1]}</p>

      {!issued && (!editingQuoteId || isSavedDraft) && (
        <div className="qp-section" data-testid="qp-issue">
          <h4 className="qp-section-title">{copy.issueTitle}</h4>
          <p className="qp-hint">{copy.issueHint}</p>
          {/* refined R2 action bar: "Save draft" is the SAME form submit as the main save button (QuoteForm onSave ->
              handleSaveQuote; never sends or issues); "Continue to issuing" opens the existing Issue confirmation. */}
          <div className="qp-actionbar">
            {savesAsDraft && (
              // PRODUCT_TRUTH_CAPABILITY: quote_create
              <button type="submit" className="qp-btn" disabled={issueBusy} data-testid="qp-save-draft">
                <Save size={14} aria-hidden="true" />{isUnfinished ? copy.saveUnfinished : copy.saveDraft}
              </button>
            )}
            {/* PRODUCT_TRUTH_CAPABILITY: quote_status */}
            <button
              type="button"
              className="qp-btn qp-btn--primary"
              disabled={!ready || locked || !isSavedDraft || isUnfinished || issueBusy}
              aria-describedby="qp-issue-why"
              onClick={startIssue}
              data-testid="qp-issue-button"
            >
              <Send size={14} aria-hidden="true" />{copy.continueIssue}
            </button>
          </div>
          <p id="qp-issue-why" className="qp-hint">
            {!editingQuoteId ? copy.issueNeedsSave : isUnfinished ? copy.issueUnfinished : !ready ? copy.contextError : ''}
          </p>
        </div>
      )}

      <IssueQuoteDialog
        lang={lang}
        kind={issueDialog}
        styleTitle={title(effective.style)}
        onClose={() => setIssueDialog(null)}
        onConfirm={() => { setIssueDialog(null); if (onIssue) onIssue(); }}
      />
    </section>
  );
}

// AI MODAL HEADER (TEKANGO_AI_ARCHITECTURE.md §51.16 "AI MODAL HELP ACTION SHARES THE HEADER ROW" / "DESKTOP AI MODAL HELP ACTION IS
// VISUALLY CENTERED"): the ONE header row for modals/wizards that carry the in-workflow AI entry - [title] [AI action] [Close].
// Desktop: a 3-column grid (1fr auto 1fr), so the AI action sits at the exact horizontal centre of the modal header, the title on the
// start side, Close on the end side. Mobile: the same single row (flex) with a smaller title, the short AI label and tighter padding -
// never a second row, never icon-only. All geometry lives in .pf-modal-head* (src/index.css); no per-modal CSS.
import AiHelpButton from './AiHelpButton';

export default function AiModalHeader({ title = null, titleAs: TitleTag = 'h2', onClose, closeLabel, closeContent, isHebrew = false, testId, className = '', style = null }) {
  return (
    <div className={`pf-modal-head ${className}`.trim()} dir={isHebrew ? 'rtl' : 'ltr'} data-testid={testId ? `${testId}-header` : undefined} style={style || undefined}>
      <div className="pf-modal-head-title">{title != null && <TitleTag className="pf-modal-head-title-text">{title}</TitleTag>}</div>
      <div className="pf-modal-head-ai"><AiHelpButton isHebrew={isHebrew} header testId={testId} /></div>
      <div className="pf-modal-head-close">
        {onClose && (
          <button type="button" className="pf-modal-head-close-btn" onClick={onClose} aria-label={closeLabel}>{closeContent}</button>
        )}
      </div>
    </div>
  );
}

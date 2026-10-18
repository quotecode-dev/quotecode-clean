// AI HELP V4 §8 + §51.15 (AI-HELP-AVAILABILITY-001, "AI HELP ENTRY MUST BE SELF-EXPLANATORY"): the in-workflow entry to the ONE AI Chat.
// It always shows the canonical AI Chat icon (AiChatIcon - the same one as the header "AI Chat" button) PLUS a visible text label
// ("שאל את AI" / "Ask AI", or "צריך עזרה? שאל את AI" / "Need help? Ask AI" where space allows) - never an icon-only or generic
// sparkle/magic affordance. It never creates a second assistant: it fires the same open-proflow-ai-chat event the header uses, so the
// canonical AIChatWidget opens above the current modal/wizard with the blocker/context the owners already published; the modal/wizard
// underneath is left exactly as it was. Native <button>: keyboard focusable, 44px touch target, visible hover/focus (.pf-ai-help-btn).
import AiChatIcon from './AiChatIcon';

const OPEN_AI_CHAT_EVENT = 'open-proflow-ai-chat';

function openAiHelp() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_AI_CHAT_EVENT, { detail: { source: 'in_context_help' } }));
}

// PRODUCT_TRUTH_CAPABILITY: ai_chat
export default function AiHelpButton({ isHebrew = false, long = false, header = false, style = null, testId = 'ai-help-in-context' }) {
  const longLabel = isHebrew ? 'צריך עזרה? שאל את AI' : 'Need help? Ask AI';
  const shortLabel = isHebrew ? 'שאל את AI' : 'Ask AI';
  const label = long ? longLabel : shortLabel;
  const accessible = isHebrew ? 'שאל את AI - פתיחת צ׳אט AI על המסך הזה' : 'Ask AI - open the AI Chat about this screen';
  // header variant (AiModalHeader): the long label on desktop, the short one on mobile - chosen by CSS (.pf-ai-help-btn--header), so the
  // visible text always matches the space and is never dropped to icon-only
  if (header) {
    return (
      <button type="button" className="pf-ai-help-btn pf-ai-help-btn--header" data-testid={testId} aria-label={accessible} title={accessible} dir={isHebrew ? 'rtl' : 'ltr'}
        onClick={(e) => { e.stopPropagation(); openAiHelp(); }} style={style || undefined}>
        <AiChatIcon size={16} rtl={isHebrew} />
        <span className="pf-ai-help-btn-label pf-ai-label-long">{longLabel}</span>
        <span className="pf-ai-help-btn-label pf-ai-label-short">{shortLabel}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className="pf-ai-help-btn"
      data-testid={testId}
      aria-label={accessible}
      title={accessible}
      dir={isHebrew ? 'rtl' : 'ltr'}
      onClick={(e) => { e.stopPropagation(); openAiHelp(); }}
      style={style || undefined}
    >
      <AiChatIcon size={16} rtl={isHebrew} />
      <span className="pf-ai-help-btn-label">{label}</span>
    </button>
  );
}

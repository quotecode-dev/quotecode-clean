// AI HELP V4 §8 (AI-HELP-AVAILABILITY-001): the in-context "Ask AI" launcher shown INSIDE blocking surfaces (alert modal, item
// wizard, draft conflict, client editor, plans). It never creates a second assistant: it fires the same open-proflow-ai-chat event
// the header button uses, so the ONE canonical AIChatWidget instance opens above the current layer (its popup sits above every
// modal layer) with the blocker/context the owners already published. Keyboard reachable (native <button>), 44px touch target.
import { Sparkles } from 'lucide-react';

const OPEN_AI_CHAT_EVENT = 'open-proflow-ai-chat';

function openAiHelp() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_AI_CHAT_EVENT, { detail: { source: 'in_context_help' } }));
}

export default function AiHelpButton({ isHebrew = false, compact = false, style = null, testId = 'ai-help-in-context' }) {
  const label = isHebrew ? 'שאל את ה-AI' : 'Ask AI';
  return (
    <button
      type="button"
      className="pf-ai-help-btn"
      data-testid={testId}
      aria-label={isHebrew ? 'שאל את עוזר ה-AI על המסך הזה' : 'Ask the AI assistant about this screen'}
      onClick={(e) => { e.stopPropagation(); openAiHelp(); }}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '44px', minWidth: compact ? '44px' : undefined,
        padding: compact ? '6px 10px' : '8px 14px', borderRadius: '10px', border: '1px solid rgba(139,92,246,0.45)', background: 'rgba(139,92,246,0.08)',
        color: '#6d28d9', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', ...(style || {}),
      }}
    >
      <Sparkles size={16} strokeWidth={2.4} aria-hidden="true" />
      {!compact && <span>{label}</span>}
    </button>
  );
}

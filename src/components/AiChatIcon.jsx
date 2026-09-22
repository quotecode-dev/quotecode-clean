// CANONICAL AI CHAT ICON - the ONE visual identity of the TEKANGO AI Chat entry (authenticated header "AI Chat" button and every in-workflow
// "Ask AI" entry: wizard, alerts, draft conflict, client editor, plans, file-error and upgrade pop-ups). A chat bubble with the small AI
// sparkle badge on its trailing top corner (placed on the reading-direction end; the glyphs themselves are never mirrored).
// Do not draw another AI icon anywhere - import this one (TEKANGO_AI_ARCHITECTURE.md §51.15 "AI HELP ENTRY MUST BE SELF-EXPLANATORY").
import { MessageCircle, Sparkles } from 'lucide-react';

export default function AiChatIcon({ size = 16, rtl = false, sparkleColor = '#f0abfc' }) {
  const badge = Math.max(8, Math.round(size / 2));
  return (
    <span aria-hidden="true" data-ai-chat-icon="canonical" style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <MessageCircle size={size} strokeWidth={2.2} />
      <Sparkles size={badge} strokeWidth={2.5} style={{ position: 'absolute', top: '-3px', [rtl ? 'left' : 'right']: '-4px', color: sparkleColor }} />
    </span>
  );
}

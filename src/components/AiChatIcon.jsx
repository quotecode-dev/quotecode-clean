// CANONICAL AI CHAT ICON - the ONE visual identity of the TEKANGO AI Chat entry (authenticated header "AI Chat" button and every in-workflow
// "Ask AI" entry: wizard, alerts, draft conflict, client editor, plans, file-error and upgrade pop-ups).
// Do not draw another AI icon anywhere - import this one (TEKANGO_AI_ARCHITECTURE.md §51.15 "AI HELP ENTRY MUST BE SELF-EXPLANATORY").
// IRON-ICON-001 (law 45; Owner console 2026-10-23, typed: "מאשר את הסמלים החדשים (חוק 45), ושינוי ב-L-02 וב-L-11: סמל הצ'אט בכותרת ובחלון
// ההתראות יהיה הראש באריח עם AI" + "להחליף גם בדפי הנחיתה"): the drawing is the TEKANGO AI tile (a glowing head with "AI") - no longer a
// generic chat bubble with a sparkle badge. The tile carries its own frame, so it is drawn a little larger than the old line glyph.
import TekangoAiIcon from './TekangoAiIcon';

export default function AiChatIcon({ size = 16 }) {
  return (
    <span aria-hidden="true" data-ai-chat-icon="canonical" style={{ display: 'inline-flex', flexShrink: 0 }}>
      <TekangoAiIcon size={size + 2} />
    </span>
  );
}

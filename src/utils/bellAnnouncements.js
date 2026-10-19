// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-17: הודעה צפה אחת על העוזר הקולי" (plan docs/VOICE_ASSISTANT_PLAN_2026-10-19.md).
// A product announcement is an ordinary bell item (unread until read, floats ONCE like every new notification, in the bell panel's
// place and size) with one action that opens the assistant. It exists only inside its date window and only where the Dashboard
// passes it (the browser can record - the microphone shows there); reminders Off shows nothing, like every other bell item.

export const VOICE_ASSISTANT_ANNOUNCEMENT = Object.freeze({
  key: 'announce:voice-assistant:v1',
  kind: 'announce',
  from: '2026-10-19',
  until: '2026-11-30',
  sortAt: '2026-10-19T00:00',
  copy: Object.freeze({
    he: Object.freeze({ title: 'חדש: אפשר לדבר עם העוזר החכם', body: 'לוחצים על המיקרופון בצ\'אט ושואלים בקול. התשובות מוקראות, ואפשר לבחור גם כתב.' }),
    en: Object.freeze({ title: 'New: talk to the smart assistant', body: 'Tap the microphone in the chat and ask out loud. Answers are spoken - you can switch to text.' }),
  }),
});

/** The announcements whose window contains today (the market day is close enough for a 6-week window - UTC day used). */
export function activeAnnouncements(list, now = Date.now()) {
  const ms = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(ms)) return [];
  const day = new Date(ms).toISOString().slice(0, 10);
  return (Array.isArray(list) ? list : []).filter((a) => a && a.key && day >= a.from && day <= a.until);
}

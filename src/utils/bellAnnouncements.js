// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-17: הודעה צפה אחת על העוזר הקולי" (plan docs/VOICE_ASSISTANT_PLAN_2026-10-19.md).
// A product announcement is an ordinary bell item (unread until read, floats ONCE like every new notification, in the bell panel's
// place and size) with one action that opens the assistant. It exists only inside its date window and only where the Dashboard
// passes it (the browser can record - the microphone shows there); reminders Off shows nothing, like every other bell item.

export const VOICE_ASSISTANT_ANNOUNCEMENT = Object.freeze({
  key: 'announce:voice-assistant:v2', // v2 (2026-10-19): the copy now also announces voice in the AI smart quote - floats once more
  kind: 'announce',
  from: '2026-10-19',
  until: '2026-11-30',
  sortAt: '2026-10-19T00:00',
  copy: Object.freeze({
    // Owner 2026-10-19: "ההודעה צריכה להודיע גם על הכנת הצעה חכמה ב AI VOICE"
    he: Object.freeze({ title: 'חדש: מדברים עם TEKANGO בקול', body: 'בצ\'אט: לוחצים על המיקרופון ושואלים בקול, והתשובות מוקראות (אפשר לבחור גם כתב). בהצעת מחיר חכמה עם AI: מכתיבים את העבודה בקול, ועונים בקול על השאלות של הטיוטה.' }),
    en: Object.freeze({ title: 'New: talk to TEKANGO', body: 'In the chat: tap the microphone and ask out loud - answers are spoken (you can switch to text). In the AI smart quote: dictate the job and answer the draft\'s questions by voice.' }),
  }),
});

/** The announcements whose window contains today (the market day is close enough for a 6-week window - UTC day used). */
export function activeAnnouncements(list, now = Date.now()) {
  const ms = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(ms)) return [];
  const day = new Date(ms).toISOString().slice(0, 10);
  return (Array.isArray(list) ? list : []).filter((a) => a && a.key && day >= a.from && day <= a.until);
}

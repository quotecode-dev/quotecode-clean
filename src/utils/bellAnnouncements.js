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
    he: Object.freeze({ title: 'חדש: מדברים עם TEKANGO בקול', body: 'בצ׳אט לוחצים על המיקרופון ושואלים בקול. התשובות מוקראות, ואפשר לבחור גם תשובות בכתב. בהצעת מחיר חכמה עם AI אפשר להכתיב את העבודה ולענות בקול על שאלות ההשלמה.' }),
    en: Object.freeze({ title: 'New: talk to TEKANGO', body: 'In the chat: tap the microphone and ask out loud - answers are spoken (you can switch to text). In the AI smart quote: dictate the job and answer the draft\'s questions by voice.' }),
  }),
});

// Owner console 2026-10-20, typed: "מאשר שינוי ב-L-17: הודעה צפה אחת על חכם פלוס" - the SMART PACK add-on: floats once like every new bell item;
// its action opens the plans view (where the add-on box is). Prices = addOnCatalog.js (10 ILS / 5 USD a month). Owner console 2026-10-25
// (typed L-17 ... "להפעלת הרכישה בישראל"): purchasable in Israel (the HE text says so); abroad not yet (the EN text is unchanged).
export const SMART_PACK_ANNOUNCEMENT = Object.freeze({
  key: 'announce:smart-pack:v1',
  kind: 'announce',
  action: 'plans',
  from: '2026-10-20',
  until: '2026-12-31',
  sortAt: '2026-10-20T00:00',
  copy: Object.freeze({
    he: Object.freeze({ title: 'חדש: חכם פלוס', body: 'תוספת למנוי עם צ׳אט חכם שמכיר את הנתונים שלכם, צ׳אט קולי, הצעה חכמה עם AI והכתבה בקול, וקבצים מצורפים להצעה. ₪10 לחודש כולל מע״מ, לבחירתכם. אפשר להוסיף אותה בחלון המסלולים.' }),
    en: Object.freeze({ title: 'New: SMART PACK', body: 'A plan add-on with a smart chat that knows your data, voice chat, an AI smart quote with voice dictation, and files attached to quotes. $5 a month, your choice. It will be available to buy when the plans open.' }),
  }),
});

/** The announcements whose window contains today (the market day is close enough for a 6-week window - UTC day used). */
export function activeAnnouncements(list, now = Date.now()) {
  const ms = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(ms)) return [];
  const day = new Date(ms).toISOString().slice(0, 10);
  return (Array.isArray(list) ? list : []).filter((a) => a && a.key && day >= a.from && day <= a.until);
}

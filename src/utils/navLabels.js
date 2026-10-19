// Owner console 2026-10-19 (Back everywhere): the names of the screens on the back stack, for "Back to <screen>" (HE / EN).
const SCREEN_NAMES = Object.freeze({
  he: { main: 'הצעות מחיר', editor: 'הצעה', clients: 'לקוחות', catalog: 'קטלוג', finances: 'פיננסים', statistics: 'סטטיסטיקה', tasks: 'משימות', calendar: 'יומן', settings: 'הגדרות העסק', reminders: 'תזכורות ואוטומציות', businessCard: 'כרטיס הביקור', shareDefaults: 'שיתוף ותודה', admin: 'ניהול' },
  en: { main: 'Quotes', editor: 'the quote', clients: 'Clients', catalog: 'Catalog', finances: 'Finances', statistics: 'Statistics', tasks: 'Tasks', calendar: 'Calendar', settings: 'Business settings', reminders: 'Reminders & automation', businessCard: 'Business card', shareDefaults: 'Sharing & thank-you', admin: 'Admin' },
});

/** The name of a recorded screen (a nav snapshot) in the interface language. */
export function screenName(snap, isHebrew) {
  const n = SCREEN_NAMES[isHebrew ? 'he' : 'en'];
  if (!snap) return '';
  if (snap.editor) return n.editor;
  if (String(snap.tab || '').startsWith('admin')) return n.admin;
  if (snap.tab === 'settings' && snap.settingsView && snap.settingsView !== 'business' && n[snap.settingsView]) return n[snap.settingsView];
  return n[snap.tab] || n.main;
}

export function backLabel(snap, isHebrew) {
  const name = screenName(snap, isHebrew);
  return isHebrew ? `חזרה ל${name}` : `Back to ${name}`;
}

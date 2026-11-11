// Owner 2026-10-14 (PROFLOW_TODO.md item 78 / PROFLOW_PROJECT_CONTEXT.md §247 as corrected by the Owner): the dashboard header shows
// ONLY a time-of-day greeting next to the notification bell - no business name (the business is already in the logo). The hour is the
// device's own current time, the same source as the header clock (IRON-DATE-001 untouched).
// 05:00-11:59 morning · 12:00-16:59 afternoon · 17:00-20:59 evening · 21:00-04:59 night.
export function timeGreeting(hour, isHebrew) {
  const h = Number(hour);
  const slot = h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
  const he = { morning: 'בוקר טוב', afternoon: 'צהריים טובים', evening: 'ערב טוב', night: 'לילה טוב' };
  const en = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Good night' };
  return (isHebrew ? he : en)[slot];
}

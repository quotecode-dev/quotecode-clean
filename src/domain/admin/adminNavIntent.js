// A one-shot hand-off between admin screens (Owner 2026-10-16, admin spec §4.1 / §4.4): a chart legend row or a "View users" link opens
// the users list ALREADY filtered (status / market). The intent is taken once by the users list on mount; nothing persists.
let pending = null;
export function setUsersFilterIntent(filter) { pending = filter && typeof filter === 'object' ? { ...filter } : null; }
export function takeUsersFilterIntent() { const f = pending; pending = null; return f; }

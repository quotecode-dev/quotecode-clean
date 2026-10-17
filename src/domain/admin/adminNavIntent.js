// A one-shot hand-off between admin screens (Owner 2026-10-16, admin spec §4.1 / §4.4): a chart legend row or a "View users" link opens
// the users list ALREADY filtered (status / market). The intent is taken once by the users list on mount; nothing persists.
let pending = null;
export function setUsersFilterIntent(filter) { pending = filter && typeof filter === 'object' ? { ...filter } : null; }
export function takeUsersFilterIntent() { const f = pending; pending = null; return f; }
// Codex verification AV-05 (2026-10-17): read during render WITHOUT consuming (StrictMode / remount safe); cleared after mount
export function peekUsersFilterIntent() { return pending ? { ...pending } : null; }
export function clearUsersFilterIntent() { pending = null; }
// AV-06: the users list state (filters, sort, page, scroll) saved when Details opens, restored once on the way back
let listState = null;
export function saveUsersListState(state) { listState = state && typeof state === 'object' ? { ...state } : null; }
export function takeUsersListState() { const s = listState; listState = null; return s; }
// read during render without consuming (StrictMode runs a state initializer twice); cleared after mount
export function peekUsersListState() { return listState ? { ...listState } : null; }
export function clearUsersListState() { listState = null; }


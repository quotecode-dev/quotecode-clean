// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-17: הודעה צפה אחת על העוזר הקולי".
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import NotificationCenter from './components/NotificationCenter';
import { saveFloatedKeys, loadFloatedKeys, bellActionsFor } from './utils/bellSubject';
import { VOICE_ASSISTANT_ANNOUNCEMENT, activeAnnouncements } from './utils/bellAnnouncements';

const NOW = new Date('2026-10-20T09:00:00Z');
const USER = 'u-announce';
const ANN = [VOICE_ASSISTANT_ANNOUNCEMENT];

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); window.localStorage.clear(); });

function fakeClient(mode = 'in_app', readKeys = []) {
  const rows = { reminder_settings: { mode }, tasks: [], reminder_notification_state: readKeys.map((item_key) => ({ item_key })) };
  const upserts = [];
  const query = (table) => {
    const result = { data: rows[table], error: null };
    const q = { select: () => q, eq: () => q, order: () => q, in: () => q, maybeSingle: () => Promise.resolve(result), then: (res, rej) => Promise.resolve(result).then(res, rej), upsert: (r) => { upserts.push(r); return Promise.resolve({ error: null }); } };
    return q;
  };
  return { from: query, upserts };
}

describe('the voice-assistant announcement in the bell (Owner 2026-10-19, L-17)', () => {
  it('is active only inside its window', () => {
    expect(activeAnnouncements(ANN, new Date('2026-10-18T12:00:00Z'))).toEqual([]);
    expect(activeAnnouncements(ANN, NOW).map((a) => a.key)).toEqual(['announce:voice-assistant:v2']);
    expect(activeAnnouncements(ANN, new Date('2026-12-01T00:00:00Z'))).toEqual([]);
    expect(bellActionsFor(VOICE_ASSISTANT_ANNOUNCEMENT)).toEqual([{ kind: 'assistant' }]);
  });

  it('an existing user floats it ONCE, in the bell panel place, with "open the assistant" (HE)', async () => {
    saveFloatedKeys(USER, new Set());
    const opened = vi.fn();
    window.addEventListener('open-proflow-ai-chat', opened);
    const client = fakeClient();
    const r = render(<NotificationCenter client={client} userId={USER} now={NOW} quotes={[]} isHebrew isLocalIsraeliBusiness announcements={ANN} />);
    const notice = await waitFor(() => { const n = document.querySelector('[data-testid="bell-float-notice"]'); expect(n).toBeTruthy(); return n; });
    expect(notice.getAttribute('data-notice-kind')).toBe('announce');
    expect(notice.textContent).toContain('חדש: מדברים עם TEKANGO בקול');
    expect(notice.textContent).toContain('בהצעת מחיר חכמה עם AI אפשר להכתיב את העבודה');
    expect(loadFloatedKeys(USER).has('announce:voice-assistant:v2')).toBe(true);
    fireEvent.click(r.getByTestId('bell-float-action-assistant'));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeNull();
    window.removeEventListener('open-proflow-ai-chat', opened);
    // a later load never floats it again
    cleanup();
    render(<NotificationCenter client={fakeClient()} userId={USER} now={NOW} quotes={[]} isHebrew isLocalIsraeliBusiness announcements={ANN} />);
    await new Promise((res) => setTimeout(res, 50));
    expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeNull();
  });

  it('it stays in the panel (English copy) and counts as unread until read; reminders Off shows nothing', async () => {
    saveFloatedKeys(USER, new Set(['announce:voice-assistant:v2']));
    const r = render(<NotificationCenter client={fakeClient()} userId={USER} now={NOW} quotes={[]} isHebrew={false} isLocalIsraeliBusiness={false} announcements={ANN} />);
    fireEvent.click(r.getByTestId('header-bell'));
    const row = await waitFor(() => r.getByTestId('notification-announce'));
    expect(row.textContent).toContain('New: talk to TEKANGO');
    expect(row.textContent).toContain('In the AI smart quote: dictate the job');
    expect(r.getByTestId('notification-action-assistant').textContent).toBe('Open the assistant');
    cleanup();
    const off = render(<NotificationCenter client={fakeClient('off')} userId={USER} now={NOW} quotes={[]} isHebrew isLocalIsraeliBusiness announcements={ANN} />);
    fireEvent.click(off.getByTestId('header-bell'));
    await new Promise((res) => setTimeout(res, 50));
    expect(off.queryByTestId('notification-announce')).toBeNull();
  });

  it('without the Dashboard passing it (no recording support), the bell is unchanged', async () => {
    saveFloatedKeys(USER, new Set());
    render(<NotificationCenter client={fakeClient()} userId={USER} now={NOW} quotes={[]} isHebrew isLocalIsraeliBusiness />);
    await new Promise((res) => setTimeout(res, 50));
    expect(document.querySelector('[data-testid="bell-float-notice"]')).toBeNull();
  });
});

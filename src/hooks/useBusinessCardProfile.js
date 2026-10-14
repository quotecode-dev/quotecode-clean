// Task 24: ONE state for the digital business card profile (owned by SettingsTab, used by the card editor). `saved` = what the server
// holds; `draft` = saved + the owner's unsaved edits.
//   update(partial)    edits the draft (live preview); nothing is stored until save()
//   save()             stores the whole draft
// Task 26 (Owner correction 2026-10-11): the card has no style choice (Classic / Modern / Visual are quote styles), so there is no
// chooseStyle; a style value a local row may carry is passed back unchanged on save and is never shown or used as a quote style.
// When the table is not on this server yet (`load === 'unavailable'`), edits stay in this session and every store is reported as
// unavailable - never silently lost, never pretended saved.
import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeCardProfile } from '../../supabase/functions/_shared/businessCard.js';
import { loadCardProfile, saveCardProfile } from '../utils/businessCardProfileClient';

const EMPTY = normalizeCardProfile(null);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function useBusinessCardProfile(client, userId) {
  const [state, setState] = useState({ load: client && userId ? 'loading' : 'idle', exists: false, saved: EMPTY, draft: EMPTY, saveStatus: 'idle' });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!client || !userId) return undefined;
    let alive = true;
    loadCardProfile(client, userId).then((r) => {
      if (!alive) return;
      if (r.status === 'ok') setState((s) => ({ ...s, load: 'ok', exists: r.exists, saved: r.profile, draft: r.profile }));
      else setState((s) => ({ ...s, load: r.status }));
    });
    return () => { alive = false; };
  }, [client, userId]);

  const update = useCallback((partial) => setState((s) => ({ ...s, draft: { ...s.draft, ...partial }, saveStatus: 'idle' })), []);

  const save = useCallback(async () => {
    if (!client || !userId) return 'failed';
    const draft = stateRef.current.draft;
    setState((s) => ({ ...s, saveStatus: 'saving' }));
    const r = await saveCardProfile(client, userId, draft);
    setState((s) => (r.status === 'ok'
      ? { ...s, exists: true, saved: r.profile, draft: r.profile, saveStatus: 'saved', load: 'ok' }
      : { ...s, saveStatus: r.status }));
    return r.status;
  }, [client, userId]);

  return { ...state, dirty: !same(state.draft, state.saved), update, save };
}

// Codex #d1-save (Owner 2026-11-10, typed: "מאשר תיקון השמירה בשלבים ותיקון "2..5" כולל L-09, שחרור עד הלייב"):
// a passing network / server error during the capability probe never switches the session to the non-atomic phased save.
import { describe, it, expect, vi } from 'vitest';
import { detectAtomicSave, persistQuote, deleteQuoteWithAttachments } from './quoteSaveOrchestrator';

// answers: a list consumed one per probe call; each item is { data, error } or 'throw'
function fakeProbe(answers) {
  const calls = [];
  const writes = [];
  const rpc = vi.fn(async (name) => {
    calls.push(name);
    if (name !== 'save_quote_atomic_version') { writes.push(`rpc.${name}`); return { data: { quote_id: 'q1', attachment_paths: [] }, error: null }; }
    const a = answers.length ? answers.shift() : { data: 1, error: null };
    if (a === 'throw') throw new TypeError('Failed to fetch');
    return a;
  });
  const from = (table) => {
    const api = {
      select: () => api, insert: () => { writes.push(`${table}.insert`); return api; }, update: () => { writes.push(`${table}.update`); return api; },
      delete: () => { writes.push(`${table}.delete`); return api; }, eq: () => api, in: () => api, limit: () => api,
      then: (res) => Promise.resolve({ data: [], error: null }).then(res),
    };
    return api;
  };
  const storage = { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ data: [], error: null }) }) };
  return { rpc, from, storage, calls, writes };
}
const plan = {
  userId: 'u1', isNew: false, quoteId: 'q1', existingClientId: 'c1', clientPayload: { company_name: 'x' }, header: {}, attnFields: {}, projectName: '',
  descriptionUpdates: [], structured: { financial: {}, sections: [], items: [], removedSectionIds: [], removedItemIds: [] }, newFiles: [], removedAttachments: [], now: () => 1,
};
const NET = { data: null, error: { code: '', message: 'TypeError: Failed to fetch' } };
const MISSING = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };

describe('the capability probe remembers only a definite answer', () => {
  it('a network error twice: unknown (null), nothing cached - the next save probes again and goes atomic', async () => {
    const sb = fakeProbe([NET, 'throw', { data: 1, error: null }]);
    expect(await detectAtomicSave(sb)).toBeNull();
    expect(await detectAtomicSave(sb)).toBe(true);
    expect(await detectAtomicSave(sb)).toBe(true); // now cached
    expect(sb.calls.filter((c) => c === 'save_quote_atomic_version')).toHaveLength(3);
  });
  it('one hiccup then an answer: the retry decides (atomic)', async () => {
    const sb = fakeProbe(['throw', { data: 1, error: null }]);
    expect(await detectAtomicSave(sb)).toBe(true);
  });
  it('the server says the function does not exist: phased, remembered', async () => {
    const sb = fakeProbe([MISSING]);
    expect(await detectAtomicSave(sb)).toBe(false);
    expect(await detectAtomicSave(sb)).toBe(false);
    expect(sb.calls).toHaveLength(1);
  });
  it('save while unknown: the quote is NOT saved, nothing is written (no phased writes), the reason is kept', async () => {
    const sb = fakeProbe([NET, NET]);
    const r = await persistQuote(sb, plan);
    expect(r).toMatchObject({ outcome: 'failed', stage: 'probe', wrote: [] });
    expect(r.error.message).toContain('Failed to fetch');
    expect(sb.writes).toEqual([]);
  });
  it('the next save after the network is back is atomic (one transaction), never phased', async () => {
    const sb = fakeProbe([NET, NET]);
    await persistQuote(sb, plan);
    const r = await persistQuote(sb, plan);
    expect(r).toMatchObject({ path: 'atomic', outcome: 'ok' });
    expect(sb.writes).toEqual(['rpc.save_quote_atomic']);
  });
  it('deleting while unknown still removes the quote and its files directly', async () => {
    const sb = fakeProbe([NET, NET]);
    const r = await deleteQuoteWithAttachments(sb, 'q1');
    expect(r.ok).toBe(true);
    expect(sb.writes).toContain('quotes.delete');
  });
});

// Task 16 creator review fixes: H1 (restore/hydrate), M1/L3 (duplicate copy), M2 (pending kept on device), M3 (unknown
// tier), L1 (localized codes), L2 (catalog unlink guard).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, renderHook, screen, fireEvent, waitFor, act } from '@testing-library/react';

const client = vi.hoisted(() => ({
  fetchPresentationContext: vi.fn(), setDefaultStyle: vi.fn(), uploadPresentationMedia: vi.fn(), fetchMediaUrls: vi.fn(),
  fetchQuotePresentation: vi.fn(), saveQuotePresentation: vi.fn(), issueQuotePresentation: vi.fn(), linkCatalogMedia: vi.fn(),
}));
vi.mock('../../utils/quotePresentationClient', () => client);

import useQuotePresentationEditor, { __resetPresentationCachesForTests, mergePresentation, syncPresentationAfterSave, flushStyleLessQueue } from './useQuotePresentationEditor';
import QuotePresentationPanel from './QuotePresentationPanel';
import CatalogMediaControl from './CatalogMediaControl';
import { presentationErrorMessage, PRESENTATION_ERRORS } from './presentationCopy';
import { takePendingPresentation, stashPendingPresentation, purgePendingPresentations } from './pendingPresentationStore';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ctx = (tier) => client.fetchPresentationContext.mockResolvedValue({ ok: true, data: { tier, defaultStyle: null, catalog: { v: 1, links: {} } } });

const storedKeys = () => { const out = []; for (let i = 0; i < localStorage.length; i += 1) out.push(localStorage.key(i)); return out; };
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

beforeEach(() => {
  __resetPresentationCachesForTests();
  try { localStorage.clear(); } catch { /* ignore */ }
  Object.values(client).forEach((f) => f.mockReset());
  client.fetchMediaUrls.mockResolvedValue({ ok: true, data: { urls: {} } });
  client.fetchQuotePresentation.mockResolvedValue({ ok: true, data: { draft: null, issued: null, locked: false, urls: {} } });
});

function useHarness(initial, editingQuoteId = null) {
  const [p, setP] = useState(initial);
  const ctl = useQuotePresentationEditor({ userId: 'u1', presentation: p, setPresentation: setP, editingQuoteId });
  return { p, ctl };
}

describe('M1 / L3 - duplicate copies the source presentation safely', () => {
  it('copies images but drops a style the current tier does not include', async () => {
    ctx('modern');
    client.fetchQuotePresentation.mockResolvedValue({ ok: true, data: { draft: { style: 'visual', media: [{ assetId: A, role: 'hero' }] }, issued: null } });
    const { result } = renderHook(() => useHarness({ style: null, media: [], detail: null }));
    await waitFor(() => expect(result.current.ctl.contextReady).toBe(true));
    await act(async () => { await result.current.ctl.copyFromQuote('src'); });
    expect(result.current.p.style).toBe(null);
    expect(result.current.p.media.map((m) => m.assetId)).toEqual([A]);
  });

  it('a late copy response cannot leak into a form that was reset (request token)', async () => {
    ctx('visual');
    const d = deferred();
    client.fetchQuotePresentation.mockReturnValueOnce(d.promise);
    const { result } = renderHook(() => useHarness({ style: null, media: [], detail: null }));
    await waitFor(() => expect(result.current.ctl.contextReady).toBe(true));
    let pending;
    act(() => { pending = result.current.ctl.copyFromQuote('src'); });
    act(() => { result.current.ctl.cancelCopy(); }); // e.g. "New quote" reset
    await act(async () => { d.resolve({ ok: true, data: { draft: { style: 'modern', media: [{ assetId: B, role: 'support' }] } } }); await pending; });
    expect(result.current.p).toEqual({ style: null, media: [], detail: null });
  });
});

describe('M2 - a failed presentation save is kept on this device and re-applied on reopen', () => {
  it('stashes to localStorage, the wording says so, and reopening the quote restores it as an unsaved change', async () => {
    ctx('modern');
    client.saveQuotePresentation.mockResolvedValue({ ok: false, code: 'storage_unavailable', message: 'Storage down' });
    const first = renderHook(() => useHarness({ style: 'modern', media: [], detail: null }));
    await waitFor(() => expect(first.result.current.ctl.contextReady).toBe(true));
    let note;
    await act(async () => {
      const outcome = await first.result.current.ctl.afterSave({ quoteId: 'q5', isNew: true, previousStatus: null, persistedStatus: 'draft', presentation: { style: 'modern', media: [] } });
      expect(outcome.keptOn).toBe('device');
      note = first.result.current.ctl.describeOutcome(outcome, 'modern');
    });
    expect(note.text).toMatch(/kept on this device/);
    expect(note.text).not.toMatch(/Storage down/); // raw server text is never shown
    expect(storedKeys().some((k) => k.includes(':u1:q5'))).toBe(true);
    first.unmount();
    // reopen the quote (fresh mount, empty local value): the pending choice comes back
    const second = renderHook(() => useHarness({ style: null, media: [], detail: null }, 'q5'));
    await waitFor(() => expect(second.result.current.p.style).toBe('modern'));
    expect(storedKeys().some((k) => k.includes(':u1:q5'))).toBe(false);
  });

  it('logout purge removes the user\'s pending choices; expired entries are ignored', () => {
    stashPendingPresentation('u1', 'qa', { style: 'modern', media: [] });
    stashPendingPresentation('u2', 'qb', { style: 'modern', media: [] });
    purgePendingPresentations('u1');
    expect(takePendingPresentation('u1', 'qa')).toBe(null);
    expect(takePendingPresentation('u2', 'qb')).toEqual({ style: 'modern', media: [] });
    stashPendingPresentation('u3', 'qc', { style: 'modern', media: [] });
    __resetPresentationCachesForTests(); // memory gone; only storage left
    expect(takePendingPresentation('u3', 'qc', Date.now() + 31 * 24 * 3600 * 1000)).toBe(null);
  });
});

describe('M3 - unknown tier while the context loads / fails', () => {
  function Panel() {
    const { ctl } = useHarness({ style: 'visual', media: [], detail: null }, 'q1');
    return <QuotePresentationPanel ctl={ctl} editingQuoteId="q1" savedStatus="draft" />;
  }
  it('no plan claims, no locks, no downgrade notice; style, default and Issue are disabled; a neutral retry state is shown', async () => {
    client.fetchPresentationContext.mockResolvedValue({ ok: false, code: 'network_error', message: 'x' });
    render(<Panel />);
    expect(await screen.findByTestId('qp-context-error')).toBeTruthy();
    expect(screen.queryByTestId('qp-plan-context')).toBe(null);
    expect(screen.queryByTestId('qp-plan-test-notice')).toBe(null);
    expect(screen.queryByTestId('qp-downgrade-notice')).toBe(null);
    expect(screen.queryByTestId('qp-quote-style-locked-visual')).toBe(null);
    expect(screen.queryByTestId('qp-quote-style-default-classic')).toBe(null);
    expect(screen.getByTestId('qp-quote-style-select-classic').disabled).toBe(true);
    expect(screen.getByTestId('qp-issue-button').disabled).toBe(true);
    // retry recovers
    ctx('modern');
    await act(async () => { fireEvent.click(screen.getByText('Retry')); });
    await waitFor(() => expect(screen.getByTestId('qp-plan-context')).toBeTruthy());
    expect(screen.getByTestId('qp-quote-style-select-classic').disabled).toBe(false);
  });
});

describe('L2 - catalog image control', () => {
  it('never calls catalog_link without a real asset id (no accidental unlink)', async () => {
    ctx('modern');
    client.uploadPresentationMedia.mockResolvedValue({ ok: true, data: {} });
    function C() { const { ctl } = useHarness({ style: null, media: [], detail: null }); return <CatalogMediaControl ctl={ctl} service={{ id: 7, name: 'Door' }} />; }
    render(<C />);
    const btn = await screen.findByTestId('qp-catalog-attach-7');
    await waitFor(() => expect(btn.disabled).toBe(false));
    const input = btn.parentElement.querySelector('input[type="file"]');
    await act(async () => { fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } }); });
    expect(client.linkCatalogMedia).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Unexpected response/);
  });
});

describe('L1 - every code is localized', () => {
  it('HE text for server/client codes, never the raw English message', () => {
    for (const code of ['asset_limit_reached', 'payload_too_large', 'storage_unavailable', 'unauthorized', 'image_rejected', 'quote_not_found', 'network_error', 'http_500', 'weird_code']) {
      const he = presentationErrorMessage('he', code);
      expect(he, code).toMatch(/[֐-׿]/);
      expect(presentationErrorMessage('en', code), code).toMatch(/[A-Za-z]/);
    }
    expect(Object.keys(PRESENTATION_ERRORS.he).sort()).toEqual(Object.keys(PRESENTATION_ERRORS.en).sort());
  });
});

describe('residual H1 - get_quote failure -> retry -> merge', () => {
  const stored = { style: 'visual', media: [{ assetId: A, role: 'hero', caption: 'H' }, { assetId: B, role: 'support', caption: 'S' }] };

  it('an existing quote is not editable until its record loads; Retry loads it and hydrates the stored premium style + images', async () => {
    ctx('visual');
    client.fetchQuotePresentation.mockResolvedValueOnce({ ok: false, code: 'network_error', message: 'x' });
    function Panel() {
      const { ctl, p } = useHarness({ style: null, media: [], detail: null }, 'q1');
      return <><QuotePresentationPanel ctl={ctl} items={[{ description: 'Door' }]} editingQuoteId="q1" savedStatus="draft" /><output data-testid="st">{JSON.stringify(p)}</output></>;
    }
    render(<Panel />);
    expect((await screen.findByTestId('qp-record-pending')).textContent).toMatch(/could not be loaded/);
    await waitFor(() => expect(screen.getByTestId('qp-plan-context')).toBeTruthy());
    // every edit is disabled: style cards, upload, issue
    expect(screen.getByTestId('qp-quote-style-select-modern').disabled).toBe(true);
    expect(screen.queryByTestId('qp-media-upload')).toBe(null);
    expect(screen.getByTestId('qp-issue-button').disabled).toBe(true);
    client.fetchQuotePresentation.mockResolvedValueOnce({ ok: true, data: { draft: stored, issued: null, locked: false, urls: {} } });
    await act(async () => { fireEvent.click(screen.getByTestId('qp-record-retry')); });
    await waitFor(() => expect(JSON.parse(screen.getByTestId('st').textContent).style).toBe('visual'));
    expect(JSON.parse(screen.getByTestId('st').textContent).media).toHaveLength(2);
    expect(screen.queryByTestId('qp-record-pending')).toBe(null);
    expect(screen.getByTestId('qp-quote-style-select-modern').disabled).toBe(false);
  });

  it('a stashed choice is MERGED onto the ready record (stored style kept, images unioned) - nothing stored is dropped', async () => {
    ctx('visual');
    const C = '33333333-3333-4333-8333-333333333333';
    stashPendingPresentation('u1', 'q2', { style: null, media: [{ assetId: C, role: 'support', caption: 'new' }, { assetId: A, role: 'hero', caption: 'dup' }] });
    client.fetchQuotePresentation.mockResolvedValue({ ok: true, data: { draft: stored, issued: null, locked: false, urls: {} } });
    const { result } = renderHook(() => useHarness({ style: null, media: [], detail: null }, 'q2'));
    await waitFor(() => expect(result.current.p.media).toHaveLength(3));
    expect(result.current.p.style).toBe('visual');
    expect(result.current.p.media.map((m) => m.assetId)).toEqual([A, B, C]);
    // and the following save only adds - style is unchanged (omitted), all stored images are still sent
    const c = { saveQuotePresentation: vi.fn().mockResolvedValue({ ok: true }), issueQuotePresentation: vi.fn() };
    await syncPresentationAfterSave({ client: c, quoteId: 'q2', isNew: false, previousStatus: 'draft', persistedStatus: 'draft', presentation: result.current.p, server: { status: 'ready', draft: stored } });
    const body = c.saveQuotePresentation.mock.calls[0][1];
    expect('style' in body).toBe(false);
    expect(body.media.map((m) => m.assetId)).toEqual([A, B, C]);
  });

  it('mergePresentation keeps an explicit local style and never duplicates an asset', () => {
    expect(mergePresentation(stored, { style: 'modern', media: [{ assetId: B, role: 'support' }] })).toMatchObject({ style: 'modern' });
    expect(mergePresentation(stored, { style: null, media: [{ assetId: B, role: 'support' }] }).media).toHaveLength(2);
  });

  it('an untouched new quote writes a style-less record only when the business default is not Classic', async () => {
    const c = { saveQuotePresentation: vi.fn().mockResolvedValue({ ok: true }), issueQuotePresentation: vi.fn() };
    await syncPresentationAfterSave({ client: c, quoteId: 'n1', isNew: true, presentation: null, server: null, businessDefault: 'classic' });
    await syncPresentationAfterSave({ client: c, quoteId: 'n2', isNew: true, presentation: null, server: null, businessDefault: null });
    expect(c.saveQuotePresentation).not.toHaveBeenCalled();
    await syncPresentationAfterSave({ client: c, quoteId: 'n3', isNew: true, presentation: null, server: null, businessDefault: 'modern' });
    expect(c.saveQuotePresentation).toHaveBeenCalledWith('n3', { media: [] });
  });
});

describe('recordKnown - a restored draft built on a loaded record is authoritative', () => {
  const stored = { style: 'visual', media: [{ assetId: A, role: 'hero', caption: 'H' }, { assetId: B, role: 'support', caption: 'S' }] };
  function useRestored(initial) {
    const [p, setP] = useState(initial);
    // shouldHydrateFromServer=false = Dashboard's 'local' restore path
    const ctl = useQuotePresentationEditor({ userId: 'u1', presentation: p, setPresentation: setP, editingQuoteId: 'q3', shouldHydrateFromServer: () => false });
    return { p, ctl };
  }

  it('recordKnown: the owner’s removal and explicit return to the default survive the restore (no merge)', async () => {
    ctx('visual');
    client.fetchQuotePresentation.mockResolvedValue({ ok: true, data: { draft: stored, issued: null, locked: false, urls: {} } });
    const local = { style: null, media: [{ assetId: B, role: 'support', caption: 'S' }], detail: null, recordKnown: true };
    const { result } = renderHook(() => useRestored(local));
    await waitFor(() => expect(result.current.ctl.recordReady).toBe(true));
    expect(result.current.p.style).toBe(null);
    expect(result.current.p.media.map((m) => m.assetId)).toEqual([B]);
  });

  it('without recordKnown the restored copy is merged (nothing stored is dropped) and becomes recordKnown', async () => {
    ctx('visual');
    client.fetchQuotePresentation.mockResolvedValue({ ok: true, data: { draft: stored, issued: null, locked: false, urls: {} } });
    const { result } = renderHook(() => useRestored({ style: null, media: [{ assetId: B, role: 'support' }], detail: null }));
    await waitFor(() => expect(result.current.p.media).toHaveLength(2));
    expect(result.current.p.style).toBe('visual');
    expect(result.current.p.recordKnown).toBe(true);
  });

  it('a server-hydrated edit is marked recordKnown (so its local draft is authoritative later)', async () => {
    ctx('visual');
    client.fetchQuotePresentation.mockResolvedValue({ ok: true, data: { draft: stored, issued: null, locked: false, urls: {} } });
    const { result } = renderHook(() => useHarness({ style: null, media: [], detail: null }, 'q4'));
    await waitFor(() => expect(result.current.p.recordKnown).toBe(true));
    expect(result.current.p.style).toBe('visual');
  });
});

describe('style-less record for an untouched new quote', () => {
  it('retries once silently and reports only a quiet note', async () => {
    ctx('modern');
    client.saveQuotePresentation.mockResolvedValue({ ok: false, code: 'network_error', message: 'x' });
    const c = { saveQuotePresentation: client.saveQuotePresentation, issueQuotePresentation: vi.fn() };
    const out = await syncPresentationAfterSave({ client: c, quoteId: 'n9', isNew: true, presentation: null, server: null, businessDefault: 'modern' });
    expect(client.saveQuotePresentation).toHaveBeenCalledTimes(2);
    expect(out).toMatchObject({ styleLessFailed: true, saveError: null });
    const { result } = renderHook(() => useHarness({ style: null, media: [], detail: null }));
    await waitFor(() => expect(result.current.ctl.contextReady).toBe(true));
    expect(result.current.ctl.describeOutcome(out, 'modern').kind).toBe('info');
  });

  it('queued quotes are written when settings load - only if the quote still has no record', async () => {
    client.fetchQuotePresentation.mockReset();
    client.saveQuotePresentation.mockReset().mockResolvedValue({ ok: true, data: {} });
    // settings not loaded at save time -> queued by afterSave
    client.fetchPresentationContext.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useHarness({ style: null, media: [], detail: null }));
    await act(async () => { await result.current.ctl.afterSave({ quoteId: 'n1', isNew: true, presentation: null }); });
    await act(async () => { await result.current.ctl.afterSave({ quoteId: 'n2', isNew: true, presentation: null }); });
    expect(client.saveQuotePresentation).not.toHaveBeenCalled();
    client.fetchQuotePresentation.mockImplementation(async (id) => ({ ok: true, data: id === 'n2' ? { draft: { style: null, media: [{ assetId: A, role: 'support' }] } } : { draft: null, issued: null } }));
    const written = await flushStyleLessQueue({ userId: 'u1', businessDefault: 'modern', client });
    expect(written).toBe(1);
    expect(client.saveQuotePresentation).toHaveBeenCalledTimes(1);
    expect(client.saveQuotePresentation).toHaveBeenCalledWith('n1', { media: [] });
  });
});

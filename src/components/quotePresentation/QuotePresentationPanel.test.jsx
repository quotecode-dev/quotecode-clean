import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, renderHook, screen, fireEvent, waitFor, act } from '@testing-library/react';

const client = vi.hoisted(() => ({
  fetchPresentationContext: vi.fn(),
  setDefaultStyle: vi.fn(),
  uploadPresentationMedia: vi.fn(),
  fetchMediaUrls: vi.fn(),
  fetchQuotePresentation: vi.fn(),
  saveQuotePresentation: vi.fn(),
  issueQuotePresentation: vi.fn(),
  linkCatalogMedia: vi.fn(),
}));
vi.mock('../../utils/quotePresentationClient', () => client);

import useQuotePresentationEditor, { __resetPresentationCachesForTests, syncPresentationAfterSave } from './useQuotePresentationEditor';
import QuotePresentationPanel from './QuotePresentationPanel';
import { createPristinePresentation } from './presentationState';

const A = '11111111-1111-4111-8111-111111111111';

function Harness({ initial = createPristinePresentation(), editingQuoteId = null, savedStatus = null, onIssue = vi.fn(), isUnfinished = false }) {
  const [p, setP] = useState(initial);
  const ctl = useQuotePresentationEditor({ userId: 'u1', isHebrew: false, editingQuoteId, presentation: p, setPresentation: setP });
  return (
    <>
      <QuotePresentationPanel ctl={ctl} items={[{ description: 'Door' }]} editingQuoteId={editingQuoteId} savedStatus={savedStatus} onIssue={onIssue} isUnfinished={isUnfinished} />
      <output data-testid="state">{JSON.stringify(p)}</output>
      <output data-testid="default">{String(ctl.businessDefault)}</output>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId('state').textContent);

function context(tier, defaultStyle = null) {
  client.fetchPresentationContext.mockResolvedValue({ ok: true, data: { testMode: true, tier, tierSource: 'qa_fixture', commercialMapping: 'pending_owner_decision', defaultStyle, catalog: { v: 1, links: {} } } });
}

beforeEach(() => {
  __resetPresentationCachesForTests();
  Object.values(client).forEach((f) => f.mockReset());
  client.fetchMediaUrls.mockResolvedValue({ ok: true, data: { urls: {} } });
  client.fetchQuotePresentation.mockResolvedValue({ ok: true, data: { draft: null, issued: null, locked: false, urls: {} } });
});

describe('QuotePresentationPanel', () => {
  it('a locked style opens the explanation + preview offer and changes neither the draft style nor the default', async () => {
    context('classic');
    render(<Harness />);
    await waitFor(() => expect(client.fetchPresentationContext).toHaveBeenCalled());
    expect(screen.getByTestId('qp-quote-style-locked-visual').textContent).toMatch(/Not included/);
    fireEvent.click(screen.getByTestId('qp-quote-style-select-visual'));
    const dialog = await screen.findByTestId('qp-locked-drawer');
    expect(dialog.textContent).toMatch(/Visual/);
    expect(screen.queryByTestId('qp-locked-tier')).toBe(null);
    expect(screen.queryByTestId('qp-plan-test-notice')).toBe(null);
    expect(dialog.querySelector('a[href]')).toBe(null);
    fireEvent.click(screen.getByTestId('qp-locked-preview'));
    expect(state().style).toBe(null);
    expect(screen.getByTestId('default').textContent).toBe('null');
    expect(client.setDefaultStyle).not.toHaveBeenCalled();
    expect(client.saveQuotePresentation).not.toHaveBeenCalled();
    // the style card for the quote stays on Classic
    expect(screen.getByTestId('qp-quote-style-select-classic').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('qp-quote-style-select-visual').getAttribute('aria-pressed')).toBe('false');
  });

  it('an entitled style becomes the draft override; "Make default" calls setDefaultStyle', async () => {
    context('modern');
    client.setDefaultStyle.mockResolvedValue({ ok: true, data: { defaultStyle: 'modern' } });
    render(<Harness />);
    await screen.findByTestId('qp-quote-style-default-modern');
    fireEvent.click(screen.getByTestId('qp-quote-style-select-modern'));
    expect(state().style).toBe('modern');
    expect(screen.getByTestId('qp-quote-style-select-modern').getAttribute('aria-pressed')).toBe('true');
    // images become available for Modern
    expect(screen.getByTestId('qp-media')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId('qp-quote-style-default-modern')); });
    expect(client.setDefaultStyle).toHaveBeenCalledWith('modern');
    await waitFor(() => expect(screen.getByTestId('default').textContent).toBe('modern'));
    // visual stays locked for the modern tier and never offers "Make default"
    expect(screen.queryByTestId('qp-quote-style-default-visual')).toBe(null);
  });

  it('shows a non-destructive downgrade notice and the issue explanation instead of issuing an unentitled style', async () => {
    context('classic');
    const onIssue = vi.fn();
    render(<Harness initial={{ style: 'visual', media: [{ assetId: A, role: 'hero', caption: 'Hero' }], detail: null }} editingQuoteId="q1" savedStatus="draft" onIssue={onIssue} />);
    expect(await screen.findByTestId('qp-downgrade-notice')).toBeTruthy();
    expect(state().style).toBe('visual');
    expect(state().media).toHaveLength(1);
    fireEvent.click(screen.getByTestId('qp-issue-button'));
    expect(await screen.findByTestId('qp-issue-dialog-not_entitled')).toBeTruthy();
    expect(onIssue).not.toHaveBeenCalled();
  });

  it('issue confirm calls onIssue only after confirmation; unsaved quotes cannot issue', async () => {
    context('modern');
    const onIssue = vi.fn();
    const { unmount } = render(<Harness editingQuoteId="q1" savedStatus="draft" onIssue={onIssue} />);
    await waitFor(() => expect(client.fetchPresentationContext).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('qp-issue-button'));
    expect(screen.getByTestId('qp-issue-dialog-confirm').textContent).toMatch(/No email or message is sent/);
    expect(onIssue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('qp-issue-confirm'));
    expect(onIssue).toHaveBeenCalledTimes(1);
    unmount();
    render(<Harness />);
    expect(screen.getByTestId('qp-issue-button').disabled).toBe(true);
  });

  it('an issued quote is read-only and shows its frozen style', async () => {
    context('classic');
    client.fetchQuotePresentation.mockResolvedValue({ ok: true, data: { draft: { style: 'modern', media: [] }, issued: { style: 'modern', styleVersion: 1, media: [] }, locked: false, urls: {} } });
    render(<Harness editingQuoteId="q9" savedStatus="sent" />);
    expect((await screen.findByTestId('qp-readonly')).textContent).toMatch(/issued in the Modern with images style/);
    expect(screen.getByTestId('qp-quote-style-select-modern').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('qp-issue')).toBe(null);
  });

  it('upload validation errors are shown from their codes', async () => {
    context('modern', 'modern');
    client.uploadPresentationMedia.mockResolvedValue({ ok: false, code: 'image_too_small', message: 'x' });
    render(<Harness />);
    const input = await screen.findByTestId('qp-media-file');
    await act(async () => { fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } }); });
    expect((await screen.findByTestId('qp-media-error')).textContent).toMatch(/at least 64 px/);
    expect(state().media).toHaveLength(0);
  });
});

describe('refined R2 fidelity - plan context, inline locked explanation, preview notice', () => {
  it('FREE / classic tier: plan sentence, "Requires" badges, inline drawer + immediate locked preview; images not offered', async () => {
    context('classic');
    render(<Harness />);
    expect((await screen.findByTestId('qp-plan-context')).textContent).toMatch(/Classic is included in this account/);
    expect(screen.getByTestId('qp-quote-style-locked-modern').textContent).toMatch(/Locked/);
    expect(screen.getByTestId('qp-quote-style-locked-modern').textContent).not.toMatch(/Requires|Modern plan/);
    expect(screen.queryByTestId('qp-media')).toBe(null);
    fireEvent.click(screen.getByTestId('qp-quote-style-select-visual'));
    const drawer = await screen.findByTestId('qp-locked-drawer');
    expect(drawer.getAttribute('role')).toBe('region'); // inline, not a modal
    expect(screen.getByTestId('qp-preview-notice').textContent).toMatch(/Preview of Visual\. The draft style stays Classic; the subscription did not change\./);
    // previewing a locked style never offers image upload (no entitlement claim)
    expect(screen.queryByTestId('qp-media')).toBe(null);
    expect(state().style).toBe(null);
    fireEvent.click(screen.getByTestId('qp-locked-close'));
    expect(screen.queryByTestId('qp-locked-drawer')).toBe(null);
    expect(screen.getByTestId('qp-preview-notice').textContent).toMatch(/The draft uses Classic/);
  });

  it('a11y: focus moves into the explanation and returns to the locked style card on Escape and on "Back to the draft style"', async () => {
    context('classic');
    render(<Harness />);
    const card = await screen.findByTestId('qp-quote-style-select-visual');
    await waitFor(() => expect(card.disabled).toBe(false));
    card.focus();
    fireEvent.click(card);
    const drawer = await screen.findByTestId('qp-locked-drawer');
    expect(drawer.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('qp-locked-drawer')).toBe(null));
    expect(document.activeElement).toBe(card);
    // second path: the close button
    fireEvent.click(card);
    await screen.findByTestId('qp-locked-drawer');
    fireEvent.click(screen.getByTestId('qp-locked-close'));
    await waitFor(() => expect(screen.queryByTestId('qp-locked-drawer')).toBe(null));
    expect(document.activeElement).toBe(card);
  });

  it('modern tier: only Visual requires an upgrade; all-included sentence for visual', async () => {
    context('modern');
    const { unmount } = render(<Harness />);
    expect((await screen.findByTestId('qp-plan-context')).textContent).toMatch(/Classic and Modern with images are included/);
    expect(screen.queryByTestId('qp-quote-style-locked-modern')).toBe(null);
    expect(screen.getByTestId('qp-quote-style-locked-visual')).toBeTruthy();
    unmount();
    __resetPresentationCachesForTests();
    context('visual');
    render(<Harness />);
    expect((await screen.findByTestId('qp-plan-context')).textContent).toMatch(/All three styles are included/);
    expect(screen.queryByTestId('qp-quote-style-locked-visual')).toBe(null);
  });
});

describe('in-panel action bar (refined R2)', () => {
  it('"Save draft" submits the SAME form (no separate save path, no client call); "Continue to issuing" opens the Issue confirmation', async () => {
    context('modern');
    const onSubmit = vi.fn((e) => e.preventDefault());
    const onIssue = vi.fn();
    function F() {
      const [p, setP] = useState(createPristinePresentation());
      const ctl = useQuotePresentationEditor({ userId: 'u1', editingQuoteId: 'q1', presentation: p, setPresentation: setP });
      return <form onSubmit={onSubmit}><QuotePresentationPanel ctl={ctl} editingQuoteId="q1" savedStatus="draft" savesAsDraft onIssue={onIssue} /></form>;
    }
    render(<F />);
    await waitFor(() => expect(screen.getByTestId('qp-issue-button').disabled).toBe(false));
    expect(screen.getByTestId('qp-save-draft').getAttribute('type')).toBe('submit');
    expect(screen.getByTestId('qp-save-draft').textContent).toMatch(/Save draft/);
    fireEvent.click(screen.getByTestId('qp-save-draft'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(client.saveQuotePresentation).not.toHaveBeenCalled();
    expect(client.issueQuotePresentation).not.toHaveBeenCalled();
    expect(screen.getByTestId('qp-issue-button').textContent).toMatch(/Continue to issuing/);
    fireEvent.click(screen.getByTestId('qp-issue-button'));
    expect(screen.getByTestId('qp-issue-dialog-confirm')).toBeTruthy();
    expect(onIssue).not.toHaveBeenCalled();
  });

  it('no in-panel save when the form would not save a draft (status changed to Sent)', async () => {
    context('modern');
    render(<Harness editingQuoteId="q1" savedStatus="draft" />);
    await waitFor(() => expect(client.fetchPresentationContext).toHaveBeenCalled());
    expect(screen.queryByTestId('qp-save-draft')).toBe(null);
  });
});

describe('syncPresentationAfterSave (Save Draft vs Issue)', () => {
  const mk = () => ({ saveQuotePresentation: vi.fn().mockResolvedValue({ ok: true, data: {} }), issueQuotePresentation: vi.fn().mockResolvedValue({ ok: true, data: { issued: { style: 'modern' } } }) });

  it('L8: an untouched (or detail-only) new quote never calls the function; one with content saves without a null style', async () => {
    const c = mk();
    let r = await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: true, previousStatus: null, persistedStatus: 'draft', presentation: { style: null, media: [], detail: 'expanded' }, server: null });
    expect(c.saveQuotePresentation).not.toHaveBeenCalled();
    expect(r.saved).toBe(null);
    r = await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: true, previousStatus: null, persistedStatus: 'draft', presentation: { style: null, media: [{ assetId: A, role: 'support' }] }, server: null });
    expect(c.saveQuotePresentation).toHaveBeenCalledWith('q', { media: [{ assetId: A, caption: '', alt: '', role: 'support', itemKey: null, order: 0 }] });
    expect(r.saved).toBe(true);
    expect(c.issueQuotePresentation).not.toHaveBeenCalled();
  });

  it('H1: an unknown saved record (get_quote failed) is never overwritten - content becomes pending, detail alone does nothing', async () => {
    const c = mk();
    const unknown = { status: 'error', draft: null };
    let r = await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: false, previousStatus: 'draft', persistedStatus: 'draft', presentation: { style: null, media: [], detail: 'expanded' }, server: unknown });
    expect(c.saveQuotePresentation).not.toHaveBeenCalled();
    expect(r.saveError).toBe(null);
    r = await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: false, previousStatus: 'draft', persistedStatus: 'sent', presentation: { style: 'modern', media: [] }, server: unknown });
    expect(c.saveQuotePresentation).not.toHaveBeenCalled();
    expect(r).toMatchObject({ saved: false, pending: true, saveError: { code: 'presentation_record_unknown' } });
    expect(c.issueQuotePresentation).not.toHaveBeenCalled();
  });

  it('H1: a known record is written only on a real change; style is sent only when it changed (omitted otherwise)', async () => {
    const c = mk();
    const ready = { status: 'ready', draft: { style: 'visual', media: [{ assetId: A, role: 'hero', caption: 'H' }] } };
    await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: false, previousStatus: 'draft', persistedStatus: 'draft', presentation: { style: 'visual', media: [{ assetId: A, role: 'hero', caption: 'H' }], detail: 'expanded' }, server: ready });
    expect(c.saveQuotePresentation).not.toHaveBeenCalled();
    await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: false, previousStatus: 'draft', persistedStatus: 'draft', presentation: { style: 'visual', media: [{ assetId: A, role: 'hero', caption: 'New caption' }] }, server: ready });
    const body = c.saveQuotePresentation.mock.calls[0][1];
    expect('style' in body).toBe(false);
    expect(body.media[0].caption).toBe('New caption');
    await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: false, previousStatus: 'draft', persistedStatus: 'draft', presentation: { style: null, media: [{ assetId: A, role: 'hero', caption: 'H' }] }, server: ready });
    expect(c.saveQuotePresentation.mock.calls[1][1]).toMatchObject({ style: null }); // explicit return to the business default
  });

  it('an untouched legacy edit writes nothing; Draft -> Sent issues', async () => {
    const c = mk();
    await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: false, previousStatus: 'draft', persistedStatus: 'draft', presentation: null, server: { draft: null } });
    expect(c.saveQuotePresentation).not.toHaveBeenCalled();
    const r = await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: false, previousStatus: 'draft', persistedStatus: 'sent', presentation: null, server: { draft: null } });
    expect(c.issueQuotePresentation).toHaveBeenCalledWith('q');
    expect(r).toMatchObject({ issued: true, issuedStyle: 'modern' });
  });

  it('issue error path: style_not_entitled is reported, the save result stands', async () => {
    const c = mk();
    c.issueQuotePresentation.mockResolvedValue({ ok: false, code: 'style_not_entitled', message: 'no' });
    const r = await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: false, previousStatus: 'draft', persistedStatus: 'sent', presentation: { style: 'visual', media: [] }, server: { status: 'ready', draft: null } });
    expect(r.saved).toBe(true);
    expect(r.issued).toBe(false);
    expect(r.issueError.code).toBe('style_not_entitled');
  });

  it('a frozen (issued / locked) presentation is never re-saved or re-issued', async () => {
    const c = mk();
    await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: false, previousStatus: 'draft', persistedStatus: 'sent', presentation: { style: 'modern', media: [] }, server: { issued: { style: 'modern' } } });
    expect(c.saveQuotePresentation).not.toHaveBeenCalled();
    expect(c.issueQuotePresentation).not.toHaveBeenCalled();
  });

  it('a failed presentation save is reported and skips the issue call', async () => {
    const c = mk();
    c.saveQuotePresentation.mockResolvedValue({ ok: false, code: 'network_error', message: 'offline' });
    const r = await syncPresentationAfterSave({ client: c, quoteId: 'q', isNew: false, previousStatus: 'draft', persistedStatus: 'sent', presentation: { style: 'modern', media: [] }, server: { status: 'ready', draft: null } });
    expect(r).toMatchObject({ saved: false, saveError: { code: 'network_error' } });
    expect(c.issueQuotePresentation).not.toHaveBeenCalled();
  });

  it('quote_issued (server froze the presentation, e.g. a customer opened the sent link) is explained, nothing is stashed for retry', async () => {
    context('modern');
    client.saveQuotePresentation.mockResolvedValue({ ok: false, code: 'quote_issued', message: 'frozen' });
    const { result } = renderHook(() => useQuotePresentationEditor({ userId: 'u1', presentation: { style: 'modern', media: [] }, setPresentation: () => {} }));
    let note;
    await act(async () => {
      const outcome = await result.current.afterSave({ quoteId: 'q7', isNew: true, previousStatus: null, persistedStatus: 'draft', presentation: { style: 'modern', media: [] } });
      note = result.current.describeOutcome(outcome, 'modern');
    });
    expect(note.kind).toBe('alert');
    expect(note.text).toMatch(/already frozen/);
    expect(note.text).toMatch(/Nothing was removed/);
    expect(client.issueQuotePresentation).not.toHaveBeenCalled();
  });
});

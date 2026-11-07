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
import { presentationCopy } from './presentationCopy';
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
  // Owner console 2026-11-06 (release C, typed approval incl. L-06 / L-09: "בהצעת מחיר לא צריך להציע את שלושת הסגנונות, זה נקבע כבר
  // בכרטיס העסק" + "כן שורת הסבר"): no style cards in the quote - one line names the style and where it is set
  it('no style cards in the quote: one line with the business style; nothing changes the draft style or the default', async () => {
    context('modern', 'modern');
    render(<Harness />);
    const line = await screen.findByTestId('qp-style-line');
    expect(line.textContent).toBe('Quote style: Modern with images, from your business settings. To change it: Business Settings › Quote design.');
    for (const s of ['classic', 'modern', 'visual']) expect(screen.queryByTestId(`qp-quote-style-select-${s}`)).toBe(null);
    expect(screen.queryByTestId('qp-plan-context')).toBe(null);
    expect(screen.queryByTestId('qp-use-default')).toBe(null);
    expect(state().style).toBe(null);
    expect(client.setDefaultStyle).not.toHaveBeenCalled();
    expect(client.saveQuotePresentation).not.toHaveBeenCalled();
    // images still follow the quote's style (Modern supports them)
    expect(screen.getByTestId('qp-media')).toBeTruthy();
  });

  it('a quote that already carries its own style keeps it and the line says so', async () => {
    context('visual', 'classic');
    render(<Harness initial={{ style: 'visual', media: [], detail: null }} />);
    expect((await screen.findByTestId('qp-style-line')).textContent).toMatch(/^Quote style: Visual, as saved on this quote. The style for new quotes is set in Business Settings › Quote design.$/);
    expect(state().style).toBe('visual');
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
    expect(screen.queryByTestId('qp-quote-style-select-modern')).toBe(null);
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

describe('release C - the style line replaces the plan sentence, the locks and the preview notice', () => {
  it('classic: no plan sentence, no "Locked" card, no locked drawer; images not offered', async () => {
    context('classic');
    render(<Harness />);
    expect((await screen.findByTestId('qp-style-line')).textContent).toMatch(/^Quote style: Classic, from your business settings./);
    expect(screen.queryByTestId('qp-plan-context')).toBe(null);
    expect(screen.queryByTestId('qp-quote-style-locked-modern')).toBe(null);
    expect(screen.queryByTestId('qp-locked-drawer')).toBe(null);
    expect(screen.queryByTestId('qp-preview-notice')).toBe(null);
    expect(screen.queryByTestId('qp-media')).toBe(null);
  });
  it('the Hebrew line names the same settings screen', () => {
    expect(presentationCopy('he').styleLine('Classic')).toBe('סגנון ההצעה: Classic, לפי הגדרות העסק. לשינוי: הגדרות העסק › עיצוב הצעות המחיר.');
    expect(presentationCopy('he').styleLineOwn('Visual')).toBe('סגנון ההצעה: Visual, כפי שנשמר בהצעה הזו. הסגנון להצעות חדשות נקבע בהגדרות העסק › עיצוב הצעות המחיר.');
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

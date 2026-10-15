/* global Buffer */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { functions: { invoke: (...args) => invoke(...args) } } }));
// signed-in actions go through the fresh-session wrapper (its own behaviour: src/shared/invokeWithFreshSession.test.js); same contract here
vi.mock('../shared/invokeWithFreshSession', () => ({ invokeWithFreshSession: (...args) => invoke(...args) }));
const normalizeImage = vi.fn();
vi.mock('./imageNormalize', () => ({ normalizeImage: (...args) => normalizeImage(...args) }));

const client = await import('./quotePresentationClient');

const QID = '33333333-3333-4333-8333-333333333333';
const A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function httpError(status, body) {
  const res = new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  return { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: res };
}

beforeEach(() => {
  invoke.mockReset();
  normalizeImage.mockReset();
});

describe('quotePresentationClient', () => {
  it('sends each CONTRACT action with the documented body', async () => {
    invoke.mockResolvedValue({ data: { ok: 1 }, error: null });
    await client.fetchPresentationContext();
    await client.setDefaultStyle('modern');
    await client.fetchMediaUrls([A1]);
    await client.fetchQuotePresentation(QID);
    await client.saveQuotePresentation(QID, { style: 'visual', media: [{ assetId: A1 }] });
    await client.saveQuotePresentation(QID);
    await client.saveQuotePresentation(QID, { style: null, media: [] });
    await client.issueQuotePresentation(QID);
    await client.linkCatalogMedia('42', A1, 'Oak');
    await client.linkCatalogMedia('42', null);
    await client.fetchPublicPresentation(QID);
    await client.qaSetCapability('u', 'visual');
    const bodies = invoke.mock.calls.map(([name, opts]) => { expect(name).toBe('quote-presentation'); return opts.body; });
    expect(bodies).toEqual([
      { action: 'context' },
      { action: 'set_default', style: 'modern' },
      { action: 'media_urls', assetIds: [A1] },
      { action: 'get_quote', quoteId: QID },
      { action: 'save_quote', quoteId: QID, style: 'visual', media: [{ assetId: A1 }] },
      { action: 'save_quote', quoteId: QID, media: [] },
      { action: 'save_quote', quoteId: QID, style: null, media: [] },
      { action: 'issue', quoteId: QID },
      { action: 'catalog_link', serviceId: '42', assetId: A1, caption: 'Oak' },
      { action: 'catalog_link', serviceId: '42', assetId: null, caption: '' },
      { action: 'public_get', quoteId: QID },
      { action: 'qa_set_capability', userId: 'u', tier: 'visual' },
    ]);
  });

  it('saveQuotePresentation omits the style key unless provided (server keeps the stored style)', async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    await client.saveQuotePresentation(QID, { media: [] });
    expect('style' in invoke.mock.calls[0][1].body).toBe(false);
    await client.saveQuotePresentation(QID, { style: undefined, media: [] });
    expect('style' in invoke.mock.calls[1][1].body).toBe(false);
  });

  it('documents the owner-facing quote_issued code', () => {
    expect(client.QUOTE_PRESENTATION_ERROR_CODES).toContain('quote_issued');
    expect(client.QUOTE_PRESENTATION_ERROR_CODES).toContain('asset_limit_reached');
  });

  it('maps a 409 quote_issued body', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(409, { error: 'quote_issued', message: 'frozen' }) });
    expect(await client.saveQuotePresentation(QID, { style: 'modern', media: [] })).toEqual({ ok: false, code: 'quote_issued', message: 'frozen' });
  });

  it('resolves { ok:true, data } on success', async () => {
    invoke.mockResolvedValue({ data: { tier: 'classic' }, error: null });
    expect(await client.fetchPresentationContext()).toEqual({ ok: true, data: { tier: 'classic' } });
  });

  it('maps a FunctionsHttpError body to { ok:false, code, message }', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(403, { error: 'style_not_entitled', message: 'Not included' }) });
    expect(await client.setDefaultStyle('visual')).toEqual({ ok: false, code: 'style_not_entitled', message: 'Not included' });
  });

  it('maps an unreadable error body to http_<status>, and a fetch failure to network_error', async () => {
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', message: 'x', context: new Response('oops', { status: 502 }) } });
    expect(await client.fetchPresentationContext()).toMatchObject({ ok: false, code: 'unknown_error' });
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', message: 'x', context: new Response('{}', { status: 502 }) } });
    expect(await client.fetchPresentationContext()).toMatchObject({ ok: false, code: 'http_502' });
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send' } });
    expect(await client.fetchPresentationContext()).toEqual({ ok: false, code: 'network_error', message: 'Failed to send' });
  });

  it('never throws, even when invoke itself throws or returns junk', async () => {
    invoke.mockRejectedValue(new Error('boom'));
    expect(await client.issueQuotePresentation(QID)).toEqual({ ok: false, code: 'network_error', message: 'boom' });
    invoke.mockResolvedValue({ data: null, error: null });
    expect(await client.issueQuotePresentation(QID)).toMatchObject({ ok: false, code: 'invalid_response' });
    invoke.mockResolvedValue({ data: { error: 'quote_locked', message: 'Locked' }, error: null });
    expect(await client.issueQuotePresentation(QID)).toEqual({ ok: false, code: 'quote_locked', message: 'Locked' });
  });

  it('uploadPresentationMedia normalizes first, then uploads base64 with the normalized mime', async () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    normalizeImage.mockResolvedValue({ blob: new Blob([bytes], { type: 'image/webp' }), width: 800, height: 600, mime: 'image/webp' });
    invoke.mockResolvedValue({ data: { asset: { id: A1 } }, error: null });
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.HEIC.png', { type: 'image/png' });
    expect(await client.uploadPresentationMedia(file)).toEqual({ ok: true, data: { asset: { id: A1 } } });
    expect(normalizeImage).toHaveBeenCalledWith(file);
    expect(invoke.mock.calls[0][1].body).toEqual({ action: 'upload_media', filename: 'photo.HEIC.webp', contentType: 'image/webp', dataBase64: 'AQID+g==' });
  });

  it('uploadPresentationMedia reports a normalization refusal without calling the function', async () => {
    normalizeImage.mockRejectedValue(Object.assign(new Error('Only JPEG, PNG or WebP'), { code: 'unsupported_type' }));
    expect(await client.uploadPresentationMedia(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })))
      .toEqual({ ok: false, code: 'unsupported_type', message: 'Only JPEG, PNG or WebP' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('bytesToBase64 handles large buffers in chunks', () => {
    const big = new Uint8Array(100000).map((_, i) => i % 256);
    expect(client.bytesToBase64(big)).toBe(Buffer.from(big).toString('base64'));
  });
});

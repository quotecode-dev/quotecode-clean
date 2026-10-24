// Task 21: browser client of the ai-quote-draft function - closed failure classification (a not-deployed function is said so) and the
// mapping of draft lines to plain unsaved form items (no invented price).
import { describe, it, expect, vi } from 'vitest';
import { requestAiQuoteDraft, classifyDraftError, draftLinesToQuoteItems, draftFunctionUrl, serverAnswers, AI_QUOTE_DRAFT_FUNCTION } from './aiQuoteDraftClient';

const httpError = (status, body = {}) => ({ name: 'FunctionsHttpError', context: { status, clone: () => ({ json: async () => body }) } });

describe('classifyDraftError', () => {
  it.each([
    [httpError(404, { code: 'NOT_FOUND' }), 'not_deployed'],
    [{ name: 'FunctionsRelayError', context: { status: 502, clone: () => ({ json: async () => ({}) }) } }, 'server_error'],
    [{ name: 'FunctionsRelayError', context: { status: 404, clone: () => ({ json: async () => ({}) }) } }, 'not_deployed'],
    [{ name: 'FunctionsRelayError' }, 'server_error'],
    [httpError(401), 'unauthenticated'],
    [httpError(409, { code: 'market_unresolved' }), 'market_unresolved'],
    [httpError(422, { code: 'no_items' }), 'no_items'],
    [httpError(400), 'invalid'],
    [httpError(502), 'provider'],
    [httpError(500, { code: 'server_error' }), 'server_error'],
    [httpError(418), 'failed'],
    [new Error('boom'), 'failed'],
  ])('%#', async (error, expected) => {
    expect(await classifyDraftError(error)).toBe(expected);
  });
});

describe('requestAiQuoteDraft', () => {
  it('sends ONLY the trimmed description to the ai-quote-draft function', async () => {
    const invoke = vi.fn(async () => ({ data: { contractVersion: 3, subject: 'x', questions: [], unassignedMeasures: [], items: [{ description: 'a', quantity: 1, unit: 'unit', quantityBasis: 'implied_single', unitPrice: null, catalogId: null, priceSource: 'none' }] }, error: null }));
    const r = await requestAiQuoteDraft({ functions: { invoke } }, '  החלפת חלון  ');
    expect(invoke).toHaveBeenCalledWith(AI_QUOTE_DRAFT_FUNCTION, { body: { description: 'החלפת חלון' } });
    expect(r).toEqual({ status: 'ok', subject: 'x', questions: [], unassignedMeasures: [], items: [{ description: 'a', quantity: 1, unit: 'unit', quantityBasis: 'implied_single', derivation: null, missing: null, evidence: null, unitPrice: null, catalogId: null, catalogName: null, priceSource: 'none' }] });
  });
  it('never calls the server for an invalid description and never throws', async () => {
    const invoke = vi.fn();
    expect(await requestAiQuoteDraft({ functions: { invoke } }, 'ab')).toEqual({ status: 'invalid' });
    expect(invoke).not.toHaveBeenCalled();
    const throwing = { functions: { url: 'https://x.supabase.co/functions/v1', invoke: async () => { throw Object.assign(new Error('net'), { name: 'FunctionsFetchError' }); } } };
    expect(await requestAiQuoteDraft(throwing, 'החלפת חלון', { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } })).toEqual({ status: 'unavailable' });
  });
  it('maps a 404 to not_deployed and a malformed success body to failed', async () => {
    expect(await requestAiQuoteDraft({ functions: { invoke: async () => ({ data: null, error: httpError(404) }) } }, 'החלפת חלון')).toEqual({ status: 'not_deployed' });
    expect(await requestAiQuoteDraft({ functions: { invoke: async () => ({ data: { contractVersion: 3, items: [] }, error: null }) } }, 'החלפת חלון')).toEqual({ status: 'failed' });
    // an older (v1) server answer is not misread as a current draft (it has no units / missing quantities)
    expect(await requestAiQuoteDraft({ functions: { invoke: async () => ({ data: { contractVersion: 1, items: [{ description: 'a', quantity: 1 }] }, error: null }) } }, 'החלפת חלון')).toEqual({ status: 'failed' });
  });
});

describe('draftLinesToQuoteItems', () => {
  it('keeps catalog prices, leaves other prices empty for the user; plain items for counts', () => {
    expect(draftLinesToQuoteItems([
      { description: 'חלון', quantity: 3, unit: 'unit', unitPrice: 1450, catalogId: 7 },
      { description: 'פירוק', quantity: 2.5, unit: null, unitPrice: null, catalogId: null },
    ])).toEqual([
      { description: 'חלון', quantity: '3', unit_price: '1450', isFromCatalog: true },
      { description: 'פירוק', quantity: '2.5', unit_price: '', isFromCatalog: false },
    ]);
  });
  // Task 33: the reviewed amount + unit travel in the same shapes the item wizard / unit selector store (no measurement rows invented)
  it('m² / linear meter -> a measured item with the stated (manual) amount; hour / kg / day -> a manual quantity item', () => {
    expect(draftLinesToQuoteItems([
      { description: 'ריצוף חדר הורים', quantity: 40, unit: 'm2', unitPrice: 120, catalogId: 1 },
      { description: 'פאנלים', quantity: 12.5, unit: 'linear_meter', unitPrice: null, catalogId: null },
      { description: 'עבודה', quantity: 3, unit: 'hour', unitPrice: null, catalogId: null },
    ])).toEqual([
      { description: 'ריצוף חדר הורים', quantity: '1', unit_price: '120', isFromCatalog: true, pricing_unit: 'm2', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 40, measurements: [] },
      { description: 'פאנלים', quantity: '1', unit_price: '', isFromCatalog: false, pricing_unit: 'linear_meter', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 12.5, measurements: [] },
      { description: 'עבודה', quantity: '3', unit_price: '', isFromCatalog: false, pricing_unit: 'hour', quantity_source: 'manual', calculation_method: 'manual', calculated_quantity: 3 },
    ]);
  });
});

// Task 22 (Owner report: "could not connect" although the connection works): a fetch-level failure is resolved by ONE credential-free
// no-cors reachability check of the same function URL before it is called a connection problem.
describe('Task 22 - fetch-level failures', () => {
  const fetchFail = { name: 'FunctionsFetchError', context: new TypeError('Failed to fetch') };
  const client = (invoke) => ({ functions: { url: 'https://ljfizgrdyzxddswcedwr.supabase.co/functions/v1/', invoke } });
  it('the draft URL is exactly the one functions-js posts to', () => {
    expect(draftFunctionUrl(client())).toBe('https://ljfizgrdyzxddswcedwr.supabase.co/functions/v1/ai-quote-draft');
    expect(draftFunctionUrl({ functions: {} })).toBeNull();
  });
  it('server answers the check -> service_unreachable (the service, not the connection); the check sends no credentials or body', async () => {
    const fetchImpl = vi.fn(async () => ({ type: 'opaque', status: 0 }));
    const r = await requestAiQuoteDraft(client(async () => ({ data: null, error: fetchFail })), 'החלפת 3 חלונות', { fetchImpl });
    expect(r).toEqual({ status: 'service_unreachable' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://ljfizgrdyzxddswcedwr.supabase.co/functions/v1/ai-quote-draft');
    expect(init).toEqual({ method: 'GET', mode: 'no-cors', cache: 'no-store', credentials: 'omit' });
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
  });
  it('nothing answers -> unavailable (connection); offline browser -> offline without any extra request', async () => {
    expect(await classifyDraftError(fetchFail, { functionUrl: 'https://x/fn', fetchImpl: async () => { throw new TypeError('x'); } })).toBe('unavailable');
    const spy = vi.fn();
    const onLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false });
    try { expect(await classifyDraftError(fetchFail, { functionUrl: 'https://x/fn', fetchImpl: spy })).toBe('offline'); }
    finally { if (onLine) Object.defineProperty(window.navigator, 'onLine', onLine); else delete window.navigator.onLine; }
    expect(spy).not.toHaveBeenCalled();
  });
  it('serverAnswers is false without a URL', async () => {
    expect(await serverAnswers(null, async () => ({}))).toBe(false);
  });
});

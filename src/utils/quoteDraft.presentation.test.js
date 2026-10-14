// Task 16: the presentation draft (style override, image refs, detail preference) is a durable draft field.
import { describe, it, expect } from 'vitest';
import { PAYLOAD_FIELDS, buildDraftEnvelope, createDraftStore, formHash, hasMaterialContent, snapshotFromState } from './quoteDraft';

function memoryStorage() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

const blank = { clientName: '', clientEmail: '', clientPhone: '', clientType: '', clientTaxId: '', clientAddress: '', quoteSubject: '', attnName: '', attnRole: '', currency: 'ILS', quoteStatus: 'Draft', validUntil: '', discount: '', terms: 'T0', warranty: 'W0', notes: '', items: [{ description: '', quantity: '1', unit_price: '' }], sections: [], quoteStructureMode: null, projectName: '' };
const defaults = { defaultTerms: 'T0', defaultWarranty: 'W0' };
const pres = { style: 'modern', detail: 'expanded', media: [{ assetId: '11111111-1111-4111-8111-111111111111', caption: 'Door', alt: 'Door', role: 'item', itemKey: 'door', order: 0 }] };

describe('quoteDraft: quotePresentation field', () => {
  it('is a persisted payload field', () => {
    expect(PAYLOAD_FIELDS).toContain('quotePresentation');
    expect(snapshotFromState({ ...blank, quotePresentation: pres }).quotePresentation).toEqual(pres);
    expect(snapshotFromState(blank).quotePresentation).toBe(null); // older state bag -> null, restored as pristine
  });

  it('round-trips through the envelope + store unchanged (survives remount / reload)', () => {
    const store = createDraftStore({ storage: memoryStorage(), project: 'p' });
    const env = buildDraftEnvelope({ userId: 'u1', draftId: 'd1', mode: 'new', payload: { ...blank, clientName: 'X', quotePresentation: pres } });
    expect(store.save(env).ok).toBe(true);
    const back = store.latestNew('u1');
    expect(back.envelope.payload.quotePresentation).toEqual(pres);
    expect(formHash(back.envelope.payload)).toBe(formHash({ ...blank, clientName: 'X', quotePresentation: pres }));
  });

  it('changes the form hash (dirty detection) and makes a new quote material', () => {
    expect(formHash({ ...blank, quotePresentation: pres })).not.toBe(formHash({ ...blank, quotePresentation: null }));
    expect(hasMaterialContent({ ...blank, quotePresentation: { style: null, media: [], detail: null } }, defaults)).toBe(false);
    expect(hasMaterialContent({ ...blank, quotePresentation: { style: 'modern', media: [], detail: null } }, defaults)).toBe(true);
    expect(hasMaterialContent({ ...blank, quotePresentation: { style: null, media: pres.media, detail: null } }, defaults)).toBe(true);
  });
});

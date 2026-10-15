// Owner 2026-10-15: WhatsApp / email share marks a Draft quote Sent (legacy phase); never downgrades; "sent, not viewed yet".
import { describe, it, expect } from 'vitest';
import { markQuoteSentAfterShare, isDraftStatus, sentNotViewed } from './quoteSentMark';

function fakeClient({ rows = [{ id: 'q1', status: 'sent' }], error = null, throws = false } = {}) {
  const calls = [];
  const q = {
    update: (v) => { calls.push(['update', v]); return q; },
    eq: (k, v) => { calls.push(['eq', k, v]); return q; },
    in: (k, v) => { calls.push(['in', k, v]); return q; },
    select: () => (throws ? Promise.reject(new Error('Failed to fetch')) : Promise.resolve({ data: error ? null : rows, error })),
  };
  return { from: (t) => { calls.push(['from', t]); return q; }, calls };
}

describe('markQuoteSentAfterShare', () => {
  it('a Draft quote of the owner becomes sent, filtered by id + owner + Draft status', async () => {
    const c = fakeClient();
    expect(await markQuoteSentAfterShare(c, 'u1', { id: 'q1', status: 'draft' })).toEqual({ ok: true });
    expect(c.calls).toEqual([['from', 'quotes'], ['update', { status: 'sent' }], ['eq', 'id', 'q1'], ['eq', 'user_id', 'u1'], ['in', 'status', ['draft', 'Draft', 'DRAFT']]]);
  });
  it.each(['sent', 'Sent', 'approved', 'paid', 'signed'])('never touches a %s quote (no downgrade, no write)', async (status) => {
    const c = fakeClient();
    expect((await markQuoteSentAfterShare(c, 'u1', { id: 'q1', status })).ok).toBe(false);
    expect(c.calls).toEqual([]);
  });
  it('a server row that is no longer Draft, an error, a network failure or no user -> not ok (nothing claimed)', async () => {
    expect((await markQuoteSentAfterShare(fakeClient({ rows: [] }), 'u1', { id: 'q1', status: 'Draft' })).reason).toBe('not_draft_on_server');
    expect((await markQuoteSentAfterShare(fakeClient({ error: { message: 'x' } }), 'u1', { id: 'q1', status: 'draft' })).reason).toBe('error');
    expect((await markQuoteSentAfterShare(fakeClient({ throws: true }), 'u1', { id: 'q1', status: 'draft' })).reason).toBe('network');
    expect((await markQuoteSentAfterShare(fakeClient(), null, { id: 'q1', status: 'draft' })).reason).toBe('not_signed_in');
  });
  it('status helpers', () => {
    expect(isDraftStatus('Draft')).toBe(true); expect(isDraftStatus(null)).toBe(true); expect(isDraftStatus('sent')).toBe(false);
    expect(sentNotViewed({ status: 'sent', view_count: 0 })).toBe(true);
    expect(sentNotViewed({ status: 'Sent', view_count: 2 })).toBe(false);
    expect(sentNotViewed({ status: 'sent' })).toBe(false); // unknown view count -> no claim
    expect(sentNotViewed({ status: 'draft', view_count: 0 })).toBe(false);
  });
});

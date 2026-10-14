// Task 31 (Owner-authorized minimal PREP extension): the two Free-10 version refusals of migration 20261011130000 reach the client as
// their own codes (409) - output_in_progress (another version of the quote holds the one live reservation) and quote_closed (a signed /
// closed quote cannot produce a new counted version) - instead of the generic output_unavailable. A refusal never writes a snapshot,
// never finalizes and never counts; the client shows a clear HE / EN message for each.
import { describe, it, expect, vi } from 'vitest';
import { createQuoteOutputOrchestrator, CODE_STATUS } from './authorizeOutput';
import { outputBlockedMessage } from '../../../src/domain/subscriptions/outputAuthority.js';

const U = '00000000-0000-4000-8000-0000000003a1';
const Q = '10000000-0000-4000-8000-000000000331';
const never = (name: string) => vi.fn(async () => { throw new Error(`${name} must not be called on a refusal`); });

function orchestratorRefusing(code: string) {
  const sql = { prepare: vi.fn(async () => ({ ok: false, code })), finalize: never('finalize'), abort: never('abort'), descriptor: never('descriptor'),
    attemptState: never('attemptState'), listForReconcile: never('listForReconcile'), markSnapshotDeleted: never('markSnapshotDeleted') };
  const storage = { put: never('put'), get: never('get'), remove: never('remove') };
  const o = createQuoteOutputOrchestrator({ sql, storage, presentation: { load: async () => ({ style: 'classic', styleVersion: 1, branding: null, media: [] }) },
    assets: { read: async () => null } });
  return { o, sql, storage };
}

describe('Task 31: version refusals keep their meaning end to end', () => {
  for (const code of ['output_in_progress', 'quote_closed']) {
    it(`${code}: 409 with the code; no snapshot, no finalize, nothing counted`, async () => {
      expect(CODE_STATUS[code]).toBe(409);
      const { o, sql, storage } = orchestratorRefusing(code);
      const r = await o.output({ userId: U }, { quoteId: Q, channel: 'send', idempotencyKey: `out:${Q}:send:${'a'.repeat(64)}`, expectedDigest: 'a'.repeat(64) });
      expect(r).toEqual({ status: 409, body: { ok: false, code } });
      expect(sql.prepare).toHaveBeenCalledTimes(1);
      expect(sql.finalize).not.toHaveBeenCalled();
      expect(storage.put).not.toHaveBeenCalled();
    });
  }
  it('the client shows a clear message for each (HE / EN), stating that nothing was sent or used', () => {
    expect(outputBlockedMessage('output_in_progress', true)).toBe('גרסה אחרת של ההצעה נמצאת כרגע בהפקה. נסו שוב בעוד רגע. דבר לא נשלח ולא נוצלה הצעה.');
    expect(outputBlockedMessage('output_in_progress', false)).toBe('Another version of this quote is being produced right now. Try again in a moment. Nothing was sent and no quote was used.');
    expect(outputBlockedMessage('quote_closed', true)).toMatch(/^ההצעה נחתמה או נסגרה, ולכן אי אפשר להפיק ממנה גרסה חדשה\..*דבר לא נשלח ולא נוצלה הצעה\.$/);
    expect(outputBlockedMessage('quote_closed', false)).toMatch(/^This quote is signed or closed, so a new version cannot be produced from it\..*Nothing was sent and no quote was used\.$/);
  });
  it('an unknown code still fails closed as the generic output_unavailable (503)', async () => {
    const { o } = orchestratorRefusing('some_future_code');
    expect((await o.output({ userId: U }, { quoteId: Q, channel: 'send', idempotencyKey: `out:${Q}:send:${'a'.repeat(64)}`, expectedDigest: 'a'.repeat(64) })).status).toBe(503);
  });
});

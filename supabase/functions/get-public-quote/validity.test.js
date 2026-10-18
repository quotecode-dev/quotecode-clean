import { describe, it, expect } from 'vitest';
import { isQuoteAcceptanceExpired as server } from './validity.ts';
import { isQuoteAcceptanceExpired as client } from '../../../src/utils/quoteValidity.js';

describe('get-public-quote is_expired parity with the client rule (OD-1)', () => {
  const instants = ['2026-09-12T20:30:00Z', '2026-09-12T21:30:00Z', '2026-09-13T20:59:59Z', '2026-09-13T21:00:00Z',
    '2026-09-14T11:59:59Z', '2026-09-14T12:00:00Z', '2027-01-01T00:00:00Z', '2028-02-29T21:59:59Z', '2028-02-29T22:00:00Z'];
  const days = ['2026-09-12', '2026-09-13', '2026-12-31', '2028-02-29', null, 'garbage'];
  // + Codex LANG-02 (2026-10-18): 'Israel' / 'IL' (any case) are Local in the server copy too; unknown values stay International
  const LOCAL_ALIASES = ['Local', 'LCL', 'Israel', 'IL', 'israel', ' ISRAEL ', 'il'];
  for (const country of [...LOCAL_ALIASES, 'International', 'Germany', 'ZZ', '', null]) {
    it(`${country}: server == client for every boundary instant`, () => {
      for (const d of days) for (const t of instants) {
        const market = LOCAL_ALIASES.includes(country) ? 'Local' : 'International';
        expect(server(d, country, new Date(t)), `${d} @ ${t}`).toBe(client(d, market, new Date(t)));
      }
    });
  }
});

describe('LANG-02: a business stored as Israel ends the validity day in Asia/Jerusalem (Codex boundary 2026-10-17 / 18)', () => {
  for (const country of ['Israel', 'IL', 'Local']) {
    it(`${country}: acceptable at 23:59:59 Israel time, expired at 00:00`, () => {
      expect(server('2026-10-17', country, new Date('2026-10-17T20:59:59Z'))).toBe(false);
      expect(server('2026-10-17', country, new Date('2026-10-17T21:00:00Z'))).toBe(true);
    });
  }
  it('an unknown country keeps Anywhere on Earth', () => {
    expect(server('2026-10-17', 'ZZ', new Date('2026-10-17T21:00:00Z'))).toBe(false);
    expect(server('2026-10-17', 'ZZ', new Date('2026-10-18T12:00:00Z'))).toBe(true);
  });
});

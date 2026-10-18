import { describe, it, expect } from 'vitest';
import { isQuoteAcceptanceExpired as server } from './validity.ts';
import { isQuoteAcceptanceExpired as client } from '../../../src/utils/quoteValidity.js';

describe('get-public-quote is_expired parity with the client rule (OD-1)', () => {
  const instants = ['2026-09-12T20:30:00Z', '2026-09-12T21:30:00Z', '2026-09-13T20:59:59Z', '2026-09-13T21:00:00Z',
    '2026-09-14T11:59:59Z', '2026-09-14T12:00:00Z', '2027-01-01T00:00:00Z', '2028-02-29T21:59:59Z', '2028-02-29T22:00:00Z'];
  const days = ['2026-09-12', '2026-09-13', '2026-12-31', '2028-02-29', null, 'garbage'];
  for (const country of ['Local', 'LCL', 'International', null]) {
    it(`${country}: server == client for every boundary instant`, () => {
      for (const d of days) for (const t of instants) {
        const market = country === 'Local' || country === 'LCL' ? 'Local' : 'International';
        expect(server(d, country, new Date(t)), `${d} @ ${t}`).toBe(client(d, market, new Date(t)));
      }
    });
  }
});

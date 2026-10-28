// Owner console 2026-10-28 (typed: "מאשר שינוי ב-L-01: ייבוא לוגו ששמור בתוך הנתונים בלי פנייה לרשת ..."): a logo saved as data: is
// imported without any network request (the site's Content-Security-Policy refuses fetching data:, so the import failed and every output
// of such an account answered logo_snapshot_policy_pending); a logo at an address is fetched as before.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { logoBase64For } from './utils/logoImport';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('the logo import before an output', () => {
  it('a data: logo is read directly - no network request at all', async () => {
    const fetchImpl = vi.fn();
    expect(await logoBase64For(`data:image/png;base64,${PNG}`, fetchImpl)).toBe(PNG);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('a data: value that is not base64 or is malformed gives nothing (the refusal stays as it was)', async () => {
    const fetchImpl = vi.fn();
    expect(await logoBase64For('data:image/svg+xml,<svg/>', fetchImpl)).toBeNull();
    expect(await logoBase64For('data:image/png;base64,not base64!', fetchImpl)).toBeNull();
    expect(await logoBase64For('', fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('a logo at an address is fetched as before; a failed fetch gives nothing', async () => {
    const bytes = Uint8Array.from(atob(PNG), (c) => c.charCodeAt(0));
    const ok = vi.fn(async () => ({ ok: true, arrayBuffer: async () => bytes.buffer }));
    expect(await logoBase64For('https://cdn.example.com/logo.png', ok)).toBe(PNG);
    expect(ok).toHaveBeenCalledWith('https://cdn.example.com/logo.png', { cache: 'no-store' });
    expect(await logoBase64For('https://cdn.example.com/logo.png', vi.fn(async () => ({ ok: false })))).toBeNull();
    expect(await logoBase64For('https://cdn.example.com/logo.png', vi.fn(async () => { throw new Error('blocked'); }))).toBeNull();
  });
  it('the Dashboard import uses it, never fetch() of the stored logo', () => {
    const d = readFileSync('src/pages/Dashboard.jsx', 'utf8');
    expect(d).toContain('const dataBase64 = await logoBase64For(bizLogoUrl);');
    expect(d).not.toContain('await fetch(bizLogoUrl');
  });
});

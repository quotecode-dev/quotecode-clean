// Owner console 2026-10-28 (typed: "מאשר שינוי ב-L-01: ייבוא לוגו ששמור בתוך הנתונים בלי פנייה לרשת ..."): a logo saved before the
// logo import (18/10) is stored as a data: URL in business_settings.logo_url. Reading it with fetch() is refused by the site's
// Content-Security-Policy (connect-src has no data:, enforced since 26/10), so its one-time import before an output failed and every
// output of such an account answered logo_snapshot_policy_pending. A data: logo is read directly; a logo at an address is fetched as before.

/** the logo as base64 bytes for the server import, or null when it cannot be read */
export async function logoBase64For(url, fetchImpl = globalThis.fetch) {
  const value = String(url || '');
  if (!value) return null;
  if (value.startsWith('data:')) {
    const comma = value.indexOf(',');
    if (comma < 0 || !/;base64$/i.test(value.slice(0, comma))) return null;
    const b64 = value.slice(comma + 1).trim();
    return /^[A-Za-z0-9+/]+={0,2}$/.test(b64) ? b64 : null;
  }
  try {
    const res = await fetchImpl(value, { cache: 'no-store' });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch {
    return null;
  }
}

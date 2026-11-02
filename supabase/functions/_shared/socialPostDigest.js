// Owner console 2026-11-02 (typed: "מאשר את התוכנית ל-R09, R10, R18 ו-R19, כולל שינוי ב-L-22, L-02, L-15 ו-L-12, שחרור עד הלייב"), Codex R09: an approval of a social post names the version the Owner saw.
// Text, hashtags, link, channel and image: everything that goes out. Not a secret, only a comparison between the screen and the server.
export function socialPostDigest(p) {
  const s = JSON.stringify([p?.channel ?? '', p?.text ?? '', p?.hashtags ?? [], p?.link ?? '', p?.still_url ?? '', p?.art ?? '']);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${s.length}-${(h >>> 0).toString(16)}`;
}

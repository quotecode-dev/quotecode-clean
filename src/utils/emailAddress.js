// Owner console 2026-10-25 (typed: "מאשר שינוי ב-L-12: בדיקת מייל מקלה ..."): ONE permissive e-mail check for sign-up, sign-in, clients,
// quotes and sending. The former check accepted only 13 endings (.com, .co.il, .org, ...) and refused real addresses such as
// @012.net.il, @zahav.net.il, @x.ac.il, @x.org.il, @x.co.uk, @x.de. Now: one "@", a local part, a dotted domain whose last label is at
// least two letters, no spaces - the mail provider decides the rest.
export function isValidEmailAddress(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || v.length > 254) return false;
  const m = /^([^\s@]{1,64})@([^\s@]+)$/.exec(v);
  if (!m) return false;
  const labels = m[2].split('.');
  if (labels.length < 2) return false;
  if (labels.some((l) => !l || l.length > 63 || l.startsWith('-') || l.endsWith('-') || !/^[\p{L}\p{N}-]+$/u.test(l))) return false;
  return /^\p{L}{2,}$/u.test(labels[labels.length - 1]);
}

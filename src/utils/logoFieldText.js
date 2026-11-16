// Owner console 2026-11-16 (answer ב + the typed release line "... "data:image/png…" בשדה הלוגו ..."): a logo uploaded from a file is kept as its
// code ("data:image/png;base64,..." - thousands of characters). The Business settings field shows only its short start, "data:image/png…";
// the stored value is never changed by showing it.

const DATA_URL = /^data:([^;,]*)[;,]/i;

/** the text the logo field shows: a web address as it is; a file's code as "data:<type>…" */
export function logoFieldText(value) {
  const v = String(value ?? '');
  const m = v.match(DATA_URL);
  return m ? `data:${m[1] || 'file'}…` : v;
}

/** the value after the field changes: an edit inside the short code keeps the uploaded logo; a typed / pasted web address replaces it;
 *  an emptied field clears it */
export function nextLogoValue(current, typed) {
  const cur = String(current ?? '');
  const next = String(typed ?? '');
  if (!DATA_URL.test(cur)) return next;
  if (!next.trim()) return '';
  if (/^data:/i.test(next)) return cur;
  return next;
}

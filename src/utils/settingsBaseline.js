// Owner 2026-10-25 (typed L-15 + L-01) + 20261029000000 (Codex F17, Owner console 2026-10-28 L-01 / L-09 / L-15): the Settings form
// against what is stored - every field the form saves. `saved` holds what the form shows for the stored row (the default terms text,
// the business currency, the professional domain); an Israeli business's currency is always ILS, so it is never "changed".

/** true when the Settings form differs from what is stored */
export function settingsFormDirty(form, saved, { isLocalIsraeliBusiness = false } = {}) {
  if (!saved) return false;
  const s = (v) => String(v || '');
  return s(form.name) !== (s(saved.name) || 'TEKANGO') || s(form.taxId) !== s(saved.taxId)
    || s(form.phone) !== s(saved.phone) || s(form.address) !== s(saved.address)
    || s(form.logo) !== s(saved.logo) || (saved.email !== '' && s(form.email) !== s(saved.email))
    || s(form.terms) !== s(saved.terms) || s(form.warranty) !== s(saved.warranty)
    || (!isLocalIsraeliBusiness && !!saved.currency && s(form.currency) !== s(saved.currency))
    || s(form.domain) !== s(saved.domain);
}

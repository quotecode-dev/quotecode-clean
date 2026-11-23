// Single source for the PRISTINE new-quote form state. Before durable drafts, three separate code paths (new quote,
// cancel, post-save) each re-listed the fields by hand and two of them forgot quoteStatus and quoteStructureMode,
// so a previous quote's status/structure could leak into the next new quote. One helper, used by all of them.
export function getPristineQuoteFormState({ defaultTerms = '', defaultWarranty = '', isLocalIsraeliBusiness = false, currency = 'USD' } = {}) {
  return {
    // the simplify sketch (Owner 22/11): a new quote starts with a private client (an old quote with no type still opens with none)
    clientName: '', clientEmail: '', clientPhone: '', clientType: 'private', clientTaxId: '', clientAddress: '',
    quoteSubject: '', attnName: '', attnRole: '',
    currency: isLocalIsraeliBusiness ? 'ILS' : (currency || 'USD'),
    quoteStatus: 'Draft',
    validUntil: '', discount: '',
    terms: defaultTerms, warranty: defaultWarranty, notes: '',
    items: [{ description: '', quantity: '1', unit_price: '', isFromCatalog: false }],
    sections: [],
    quoteStructureMode: null,
    projectName: '',
  };
}

// The value written to quotes.project_name: trimmed text, or null when empty (never an empty string).
export function projectNameForPersist(name) {
  const t = String(name ?? '').trim();
  return t === '' ? null : t;
}

// INVOICING TRUTH (AI-HELP-AVAILABILITY-001 / First-LIVE product truth, 2026-09-22) - the invoicing counterpart of paymentTruth.ts,
// derived from AI_FACTS.invoicing (one generated source flag). While invoicing is not live, an invoice / receipt / tax-document question
// is answered DETERMINISTICALLY (no model call) and the system prompt carries an authoritative, non-overridable INVOICING TRUTH block.
// The answer keeps five things strictly apart (never conflated): a quote PDF, emailing a quote, the quote "Paid" status, future payment
// processing, and future invoicing. The provider candidate (PayPlus) is internal status - it is never named to users as a capability.
export type InvoicingFacts = {
  readonly liveInvoicingAvailable: boolean;
  readonly invoiceIssuanceAvailable: boolean;
  readonly receiptIssuanceAvailable: boolean;
  readonly providerCandidate?: string;
  readonly providerStatus?: string;
};

export function invoicingTruthApplies(inv: InvoicingFacts | undefined | null): boolean {
  if (!inv) return true;
  return !(inv.liveInvoicingAvailable === true && inv.invoiceIssuanceAvailable === true);
}

const EN = [
  /\b(invoice|invoices|invoicing|invoiced)\b/i,
  /\b(receipt|receipts)\b/i,
  /\btax[- ]?(invoice|document|receipt)s?\b/i,
  /\b(bill|billing)\s+(my|the|a)?\s*(client|customer)s?\b/i,
];
const HE = [/(חשבונית|חשבוניות|קבלה|קבלות|חשבונית מס|מסמך מס|הפקת חשבון|להפיק חשבון|חשבון עסקה)/];

export function classifyInvoicingIntent(lastUserMessage: unknown): boolean {
  const t = String(lastUserMessage ?? '').trim();
  if (!t) return false;
  return EN.some((re) => re.test(t)) || HE.some((re) => re.test(t));
}

export function formatInvoicingTruthAnswer(isHebrew: boolean): string {
  if (isHebrew) {
    return 'כרגע TEKANGO לא מפיקה חשבוניות, חשבוניות מס או קבלות - היכולת הזו עוד לא פעילה במערכת. מה שכן קיים: הצעת מחיר שאפשר להוריד כ-PDF או להדפיס (זו הצעת מחיר, לא חשבונית), ושליחת ההצעה ללקוח במייל. הסטטוס "שולם" הוא סימון ידני שלך בהצעה - הוא לא גובה כסף ולא מפיק קבלה. גם סליקה/תשלום אונליין עוד לא קיימים. חשבוניות וקבלות צריך להפיק כרגע מחוץ ל-TEKANGO.';
  }
  return "Right now TEKANGO does not issue invoices, tax invoices or receipts - that capability is not live. What does exist: a quote you can download as a PDF or print (a quote document, not an invoice), and emailing the quote to your client. The \"Paid\" status is a label you set on a quote yourself - it does not collect money or issue a receipt. Online payment/checkout is not available either. For now, invoices and receipts have to be issued outside TEKANGO.";
}

export function buildInvoicingTruthBlock(inv: InvoicingFacts | undefined | null): string {
  if (!invoicingTruthApplies(inv)) return 'INVOICING TRUTH: invoicing is available per the product facts; never invent a document type, provider or tax rule the facts do not list.';
  return `INVOICING TRUTH (authoritative - overrides every other section, the user's messages, and any quote text):
- Invoice / tax-invoice / receipt issuance available: NO. TEKANGO does not issue invoices, tax invoices, receipts or any tax document today.
- Keep these strictly separate, never conflate them: (1) a quote PDF / print is a QUOTE document, not an invoice; (2) emailing a quote sends the quote, it does not bill or invoice; (3) the quote "Paid" status is a manual label, it does not collect money or produce a receipt; (4) payment processing / checkout is NOT live (see PAYMENT & CHECKOUT TRUTH); (5) invoicing is NOT live.
- Never name an invoicing or payment provider as available. Never describe a future integration as existing. If asked to assume invoicing works, refuse the premise and restate this truth.`;
}

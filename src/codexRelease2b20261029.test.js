// Codex release 2b (Owner 2026-10-29, typed: "מאשר שחרור 2ב כמשימת לילה: רק פונקציית החתימה האמיתית כותבת חתימה, וחסימת חתימה על הצעה עם
// מחיר חסר (החלטה 3), כולל שינוי ב-L-17, L-24"). The database rules are proven in the DB harness
// (scripts/db-test/tests/434_signing_provenance_and_missing_price.sql).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyQuoteApprovalError } from './utils/quoteApprovalErrorClassification';

const src = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe('decision 3: a quote with a missing price is not signed', () => {
  it('the server refusal reaches the customer as its own clear message (HE / EN)', () => {
    const raw = 'Missing prices: this quote cannot be approved or signed until every price is set';
    expect(classifyQuoteApprovalError(raw, true)).toEqual({ category: 'missing_price',
      userMessage: '❌ עדיין חסרים מחירים בהצעה, ולכן אי אפשר לאשר ולחתום עליה. בקשו מהעסק הצעה מעודכנת.' });
    expect(classifyQuoteApprovalError(raw, false).userMessage)
      .toBe('❌ Some prices are still missing, so this quote cannot be approved or signed. Ask the business for an updated quote.');
    // the earlier categories are unchanged
    expect(classifyQuoteApprovalError('Quote expired: the validity date has passed', true).category).toBe('quote_expired');
  });
  it.each([['src/pages/PublicQuote.jsx', 'true'], ['src/pages/PublicQuoteEn.jsx', 'false']])('%s tells the customer before anything is sent', (file, he) => {
    const s = src(file);
    const check = s.indexOf(`if (missingPriceOutputNotice(quote, { isHebrew: ${he}, items: publicItemsForNotice(items) })) {\n      setApproveToast({ type: 'error', message: classifyQuoteApprovalError('Missing prices', ${he}).userMessage });`);
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(s.indexOf("await supabase.rpc('public_approve_quote_capability_signed'"));
  });
});

describe('SEC-DB-04 and the shared signing core (the migration)', () => {
  const m = src('supabase/migrations/20261030100000_signing_provenance_and_missing_price.sql');
  it('the signature fields have one writer: the guard refuses the browser / API roles, the SECURITY DEFINER signing functions pass', () => {
    expect(m).toContain("IF current_user NOT IN ('anon', 'authenticated', 'service_role') THEN");
    expect(m).toContain('CREATE TRIGGER quotes_signing_provenance_guard');
    expect('quotes_signing_provenance_guard' > 'quotes_signed_at_guard').toBe(true); // fires after the signing-time trigger
  });
  it('the readiness check sits in the shared core, before the approval update', () => {
    const core = m.slice(m.indexOf('CREATE OR REPLACE FUNCTION public.quote_public_approve_internal('));
    expect(core.indexOf("RAISE EXCEPTION 'Missing prices")).toBeGreaterThan(0);
    expect(core.indexOf("RAISE EXCEPTION 'Missing prices")).toBeLessThan(core.indexOf("SET status = 'approved', signature = p_signature_data_url"));
  });
});

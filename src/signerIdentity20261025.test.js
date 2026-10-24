// Owner 2026-10-25 (typed L-24): the customer's name (company and role for a business customer) is stored with the signature and a later
// visit says who signed. Source guards over both public pages and get-public-quote.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const he = readFileSync('src/pages/PublicQuote.jsx', 'utf8');
const en = readFileSync('src/pages/PublicQuoteEn.jsx', 'utf8');
const fn = readFileSync('supabase/functions/get-public-quote/index.ts', 'utf8');
const mig = readFileSync('supabase/migrations/20261025000000_quote_signer_identity.sql', 'utf8');

describe('signer identity stored with the signature', () => {
  for (const [name, src, label] of [['he', he, 'נחתם על ידי:'], ['en', en, 'Signed by:']]) {
    it(`${name}: signs through the new functions with the signer, falls back only when the function is missing`, () => {
      expect(src).toContain("supabase.rpc('public_approve_quote_capability_signed', { p_token: capabilityToken, p_signature_data_url: signatureDataUrl, ...signer })");
      expect(src).toContain("supabase.rpc('public_approve_quote_signed', { p_quote_id: quote.id, p_signature_data_url: signatureDataUrl, ...signer })");
      expect(src).toContain('p_signer_name: signerName.trim()');
      expect(src).toContain("p_signer_company: isBusinessCustomer ? (signerCompany.trim() || null) : null");
      expect(src).toMatch(/error\.code === 'PGRST202' \|\| \/could not find the function\/i/);
    });
    it(`${name}: a later visit shows the stored signer`, () => {
      expect(src).toContain(') : quote.signer_name ? (');
      expect(src).toContain('data-testid="pq-stored-signer"');
      expect(src).toContain(`${label} <bdi>{quote.signer_name}</bdi>`);
    });
  }
  it('get-public-quote returns the stored signer', () => {
    expect(fn).toContain('project_name, signer_name, signer_company, signer_role, signed_at,');
    expect(fn).toContain('signer_name: quote.signer_name, signer_company: quote.signer_company, signer_role: quote.signer_role, signed_at: quote.signed_at,');
  });
  it('the migration records the signer before the unchanged approval and grants only the public functions', () => {
    expect(mig.indexOf('PERFORM public.quote_record_signer(v_cap.quote_id')).toBeLessThan(mig.indexOf('PERFORM public.quote_public_approve_internal(v_cap.quote_id'));
    expect(mig).toContain('REVOKE ALL ON FUNCTION public.quote_record_signer(uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;');
    expect(mig).not.toMatch(/DROP FUNCTION public\.public_approve_quote\(/);
  });
});

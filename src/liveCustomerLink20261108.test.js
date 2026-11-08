// Owner console 2026-11-08 (typed: "כל עוד הלקוח לא חתם!!! כל שינוי ולא משנה איזה שהמשתמש עשה משתקף אצל הלקוח!!!!! נקודה" + the
// release approval incl. L-02, L-13, L-17, L-24): the link the customer already has shows every saved change until the signature, and
// the customer signs exactly the version the page shows. Guards of migration 20261108400000 + get-public-quote + the public pages.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { classifyQuoteApprovalError } from './utils/quoteApprovalErrorClassification';
import { rendererFromSignedRecord, signedRecordAttachments } from '../supabase/functions/get-public-quote/publicAccess.ts';

const read = (p) => readFileSync(join(cwd(), p), 'utf8');
const OWNER = '00000000-0000-4000-8000-00000000000a';
const QID = 'a4710000-0000-4000-8000-000000000001';

describe('live customer link (2026-11-08)', () => {
  it('a change saved while the page was open is its own message, in both languages', () => {
    const he = classifyQuoteApprovalError('Quote updated: the business saved a change after this page was opened', true);
    const en = classifyQuoteApprovalError('Quote updated: reload the quote and sign again', false);
    expect(he.category).toBe('quote_updated');
    expect(en.category).toBe('quote_updated');
    expect(he.userMessage).toBe('ההצעה עודכנה. עברו על השינויים לפני החתימה.');
    expect(en.userMessage).toBe('This quote was updated. Review the changes before signing.');
    // the other messages are unchanged
    expect(classifyQuoteApprovalError('Quote not found or cannot be approved', true).category).toBe('already_approved_or_unavailable');
  });

  it('a signed quote is served from the document frozen at the signature + the live approval state', () => {
    const rec = {
      document: { documentProjection: 'quote-document/v1',
        quote: { id: QID, quote_number: 947101, valid_until: '2999-12-31', currency: 'ILS', total: 118, notes: 'as signed', tax_rate: 0.18 },
        customer: { company_name: 'לקוח', email: null, phone: '050', address: null },
        sections: [{ id: 's2', name: 'ב', sort_order: 2 }, { id: 's1', name: 'א', sort_order: 1, repeat_count: 3 }],
        items: [{ description: 'צבע', quantity: 2, unit_price: 50, total_price: 100, sort_order: 1, measurements: [] }] },
      business: { business_name: 'עסק', logo_url: 'https://x/logo.png', tax_id: '1', email: 'e', phone: 'p', address: 'a', currency: 'ILS', country: 'IL' },
      attachments: [{ id: 'b4710000-0000-4000-8000-000000000001', file_name: 'plan.pdf', storage_path: `${OWNER}/${QID}_1.pdf` }, { id: 'bad' }],
    };
    const live = { user_id: OWNER, status: 'approved', signature: 'data:image/png;base64,AA==', signer_name: 'לקוח' };
    const body = rendererFromSignedRecord(rec, QID, OWNER, live, { callerUserId: null, now: new Date('2026-11-08T12:00:00Z') });
    expect(body.quote.notes).toBe('as signed');
    expect(body.quote.status).toBe('approved');
    expect(body.quote.signer_name).toBe('לקוח');
    expect(body.business.business_name).toBe('עסק');
    expect(body.client.company_name).toBe('לקוח');
    expect(body.sections.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(body.sections[0].repeat_count).toBe(3);
    expect(body.items[0].price).toBe(50);
    // another account's live row never leaks into the page
    expect(rendererFromSignedRecord(rec, QID, OWNER, { ...live, user_id: 'someone-else' }, { callerUserId: null, now: new Date() }).quote.status).toBeNull();
    // a document of another quote is refused
    expect(rendererFromSignedRecord(rec, 'a4710000-0000-4000-8000-000000000009', OWNER, live, { callerUserId: null, now: new Date() })).toBeNull();
    expect(signedRecordAttachments(rec)).toEqual([{ id: 'b4710000-0000-4000-8000-000000000001', file_name: 'plan.pdf', storage_path: `${OWNER}/${QID}_1.pdf` }]);
  });

  it('get-public-quote: a capability link reads the live quote until the signature, the version comes with it, and a version-only check exists', () => {
    const src = read('supabase/functions/get-public-quote/index.ts');
    expect(src).toContain("adminClient.rpc('public_capability_live', { p_token_hash: hash })");
    expect(src).toContain("adminClient.rpc('public_quote_live_state', { p_quote_id: quoteId })");
    expect(src).toContain("(body as Record<string, unknown>).version_only === true");
    // the version is read before and after the content and must match (a save in between is read again)
    expect(src).toMatch(/const out = await readLiveBody\(quoteId\);[\s\S]*?const after = await liveStateOf\(quoteId\);[\s\S]*?if \(after\.version === st\.version\)/);
    // the version-only answer carries no content and counts no view
    expect(src).toContain("jsonResponse({ version: st.version ?? null, signed: Boolean(st.signed) }, 200)");
    // a capability viewer is never the owner path
    expect(src).toContain("const extra = { capability: true, viewerIsOwner: false, outputPhase };");
  });

  it('the public pages sign through the versioned functions and reload on "Quote updated"; the page checks the version while open', () => {
    for (const p of ['src/pages/PublicQuote.jsx', 'src/pages/PublicQuoteEn.jsx']) {
      const src = read(p);
      expect(src).toContain("supabase.rpc('public_sign_quote_capability_version', { p_token: capabilityToken, p_signature_data_url: signatureDataUrl, ...signer, p_expected_version: version })");
      expect(src).toContain("supabase.rpc('public_sign_quote_version', { p_quote_id: quote.id, p_signature_data_url: signatureDataUrl, ...signer, p_expected_version: version })");
      expect(src).toContain("if (category === 'quote_updated' && typeof onQuoteChanged === 'function') { onQuoteChanged(); return; }");
      expect(src).toMatch(/if \(!updatedTick\) return;\s*clearSignature\(\);/);
    }
    const smart = read('src/components/SmartPublicQuote.jsx');
    expect(smart).toContain('requestBody({ version_only: true })');
    expect(smart).toContain('const timer = setInterval(check, 15000);');
    expect(smart).toContain("document.visibilityState !== 'visible'");
    // a reload never counts a view (only the first load calls public_increment_quote_view)
    expect(smart.match(/public_increment_quote_view/g)).toHaveLength(1);
  });

  it('the migration: the version, the live state, the frozen document, the versioned signing, the same customer', () => {
    const sql = read('supabase/migrations/20261108400000_live_customer_link.sql');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.quote_public_version(p_user_id uuid, p_quote_id uuid)');
    expect(sql).toMatch(/AND \(a\.customer_binding = 'none' OR a\.customer_binding = coalesce\(q\.client_id::text, 'none'\)\)/);
    expect(sql).toMatch(/SELECT q\.user_id INTO v_owner FROM public\.quotes q WHERE q\.id = p_quote_id FOR UPDATE;[\s\S]*?IS DISTINCT FROM p_expected_version THEN\s*RAISE EXCEPTION 'Quote updated/);
    expect(sql).toContain('ON CONFLICT (quote_id) DO NOTHING');
    expect(sql).toContain('REVOKE ALL ON public.quote_signed_documents FROM PUBLIC, anon, authenticated, service_role;');
  });
});

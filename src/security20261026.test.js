// Owner console 2026-10-26 (typed: "מאשר את 1 ו-2: ... וסגירת טבלת המסמכים, כותרות ההגנה, עדכון הספרייה ונתיב החיפוש"): the protection
// headers on every page (the content policy in report-only mode first), the patched PDF sanitizer, and the migration that closes the
// legacy documents table and fixes the search_path of the six functions the Security Advisor lists.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (...p) => readFileSync(join(cwd(), ...p), 'utf8');

describe('security 2026-10-26', () => {
  const all = JSON.parse(read('vercel.json')).headers.find((h) => h.source === '/(.*)').headers;
  const get = (k) => all.find((h) => h.key === k)?.value;
  // Owner console 2026-10-26 (typed: "מאשר להפעיל את הגבלת מקורות התוכן בלייב, בשחרור ממשק דרך השער"): the content policy is enforced
  it('every page: no framing by another site, browser permissions limited (the microphone stays for dictation), an enforced content policy', () => {
    expect(get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(get('Permissions-Policy')).toBe('camera=(), geolocation=(), payment=(), usb=(), microphone=(self)');
    const csp = get('Content-Security-Policy');
    for (const part of ["default-src 'self'", 'https://*.supabase.co', 'wss://*.supabase.co', 'https://challenges.cloudflare.com', 'https://www.googletagmanager.com',
      "frame-ancestors 'self'", "object-src 'none'", 'https://*.payplus.co.il']) expect(csp).toContain(part);
    expect(get('Content-Security-Policy-Report-Only')).toBeUndefined(); // the report-only period ended (no violation in the Owner's session)
    expect(get('X-Content-Type-Options')).toBe('nosniff');
  });
  it('the PDF sanitizer is pinned to the patched release', () => {
    expect(JSON.parse(read('package.json')).overrides.dompurify).toBe('3.4.17');
  });
  it('the migration closes the legacy table and fixes the six search paths', () => {
    const m = read('supabase', 'migrations', '20261026500000_security_documents_search_path_line_reopen.sql').replace(/\r/g, '');
    expect(m).toContain('REVOKE ALL ON public.quotecode_documents FROM anon, authenticated;');
    expect(m).toContain('DROP POLICY IF EXISTS "Allow public insert/select" ON public.quotecode_documents;');
    expect(m).toContain('DROP POLICY IF EXISTS "Public can view documents" ON public.quotecode_documents;');
    for (const fn of ['increment_quote_views(uuid)', 'handle_user_migration()', 'save_quote_atomic_version()', 'price_versions_immutable()', 'append_only_guard()', 'account_assets_guard()']) {
      expect(m).toContain(`ALTER FUNCTION public.${fn} SET search_path = public, pg_temp;`);
    }
  });
});

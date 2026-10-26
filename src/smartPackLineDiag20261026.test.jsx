// Owner console 2026-10-26 (item א2, the third refusal): every SMART PACK line refusal logs which check refused, and a PayPlus refusal
// logs PayPlus' own words - never a card, token or customer value; the third re-open is the same statement as the first.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (...p) => readFileSync(join(cwd(), ...p), 'utf8');

describe('א2 - the SMART PACK line refusal is diagnosable', () => {
  const s = read('supabase', 'functions', 'subscription-authority', 'payplus.ts');
  it('each refusal path names its check', () => {
    for (const reason of ['request', 'order', 'cycle', 'lines', 'update']) expect(s).toContain(`refuse('${reason}'`);
    expect(s).toContain("incident: 'smart_pack_line_refused', reason, ...detail");
  });
  it('a PayPlus refusal logs its code, description and validation messages only', () => {
    expect(s).toContain("incident: 'payplus_update_refused', code: j.results.code ?? null");
    expect(s).not.toMatch(/console\.error\([^)]*card_token|console\.error\([^)]*cardToken:/);
    expect(s).toContain('token: Boolean(o.cardToken)');
  });
  it('the third re-open is the first re-open statement', () => {
    const strip = (t) => t.replace(/\r/g, '').replace(/--[^\n]*\n/g, '').trim();
    expect(strip(read('supabase', 'migrations', '20261026300000_smart_pack_line_reopen_diagnosed.sql')))
      .toBe(strip(read('supabase', 'migrations', '20261026100000_smart_pack_line_reopen.sql')));
  });
});

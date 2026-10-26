// Owner console 2026-10-26 (typed plan item א2: the cause + an automatic retry of the SMART PACK line): a missing account terminal is
// retried, never final; opening the plans window with a paid SMART PACK that still shows an end date asks the server to add the line;
// the migration re-opens the refused lines of the live package.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (...p) => readFileSync(join(cwd(), ...p), 'utf8');

describe('א2 - SMART PACK line retry', () => {
  it('the plans window of an account whose SMART PACK line is pending pulls the checkout status once, then re-reads the summary', () => {
    const s = read('src', 'pages', 'Dashboard.jsx');
    expect(s).toMatch(/const smartPackLinePending = accountSummary\?\.state === 'ready' && accountSummary\.smartPack\?\.active === true\s+&& accountSummary\.smartPack\.source === 'add_on' && !!accountSummary\.smartPack\.until;/);
    expect(s).toMatch(/if \(!showPricingModal \|\| !smartPackLinePending\) return undefined;/);
    expect(s).toMatch(/pullCheckoutStatus\(\)\.catch\(\(\) => null\)\.then\(\(\) => \{ if \(alive\) refreshAccountSummaryQuiet\(\); \}\);/);
  });
  it('a missing terminal is a retried configuration gap with an incident, never "not_added"', () => {
    const s = read('supabase', 'functions', 'subscription-authority', 'payplus.ts');
    expect(s).toMatch(/if \(!UUID\.test\(terminal\)\) \{ console\.error\(JSON\.stringify\(\{ fn: 'subscription-authority', incident: 'smart_pack_terminal_missing' \}\)\); return 'unknown'; \}/);
  });
  it('a SMART PACK product missing from the PayPlus catalog is retried too (the second refusal, 2026-10-26)', () => {
    const s = read('supabase', 'functions', 'subscription-authority', 'payplus.ts');
    expect(s).toContain("if (productUid === null) { console.error(JSON.stringify({ fn: 'subscription-authority', incident: 'smart_pack_product_missing' })); return 'unknown'; }");
    const strip = (t) => t.replace(/\r/g, '').replace(/--[^\n]*\n/g, '').trim();
    expect(strip(read('supabase', 'migrations', '20261026200000_smart_pack_line_reopen_product.sql')))
      .toBe(strip(read('supabase', 'migrations', '20261026100000_smart_pack_line_reopen.sql')));
  });
  it('the migration re-opens only paid, in-period refused lines of the live package without the line, and changes nothing else', () => {
    const m = read('supabase', 'migrations', '20261026100000_smart_pack_line_reopen.sql').replace(/--[^\n]*\n/g, '');
    expect(m).toMatch(/UPDATE public\.smart_pack_add_ons a\s+SET line_state = NULL, line_at = NULL/);
    expect(m).toMatch(/a\.state = 'paid'/);
    expect(m).toMatch(/a\.line_state = 'not_added'/);
    expect(m).toMatch(/a\.period_end > now\(\)/);
    expect(m).toMatch(/e\.live_attempt_id = a\.package_attempt_id AND e\.smart_pack_line = false/);
    expect(m).not.toMatch(/CREATE|DROP|GRANT|REVOKE|ALTER|DELETE|INSERT/i);
  });
});

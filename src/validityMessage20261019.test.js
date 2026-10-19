// Owner 2026-10-19 (option א): a quote without a validity date says nothing about validity in the WhatsApp / copied message.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'pages', 'Dashboard.jsx'), 'utf8');

describe('quote message validity (Owner 2026-10-19, option א)', () => {
  it('no "N/A" / "ללא הגבלה" validity fallback; a set date is a short market date', () => {
    expect(src).not.toContain("Valid until ${proposal.valid_until || 'N/A'}");
    expect(src).not.toContain("בתוקף עד ${proposal.valid_until || 'ללא הגבלה'}");
    expect(src).toContain("const validityDate = proposal.valid_until ? formatShortDate(proposal.valid_until, isLocalQuote ? 'Local' : 'International') : null;");
    expect(src).toContain("const validityHe = validityDate ? ` בתוקף עד ${validityDate}.` : '';");
    expect(src).toContain("const validityEn = validityDate ? ` Valid until ${validityDate}.` : '';");
  });
});

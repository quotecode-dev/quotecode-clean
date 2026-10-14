// Owner console 2026-10-14: while the new plan system is not active, every quote capability (area / length pricing, reuse and
// templates, attachments, edit / duplicate, WhatsApp / delete) is open to every account; once active, the server capabilities rule.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideCapability } from '../supabase/functions/_shared/subscriptionContract.ts';

const d = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'pages/Dashboard.jsx'), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
const IDS = ['quote.edit_duplicate', 'quote.whatsapp_delete', 'quote_attachment.upload', 'professional_quote.use', 'professional_quote.reuse', 'catalog_product_image.upload'];

describe('quote capabilities open while the plan system is not active', () => {
  it('every legacy capability value is true (no entitlement-based lock)', () => {
    const block = d.slice(d.indexOf('const legacyCapabilities = {'), d.indexOf('};', d.indexOf('const legacyCapabilities = {')));
    for (const id of IDS) expect(block).toContain(`'${id}': true,`);
    expect(block).not.toMatch(/entitlement\./);
  });
  it('the shared decision: not active -> allowed from the legacy value; enforced -> the server decides', () => {
    for (const state of ['not_activated', 'not_deployed', 'loading']) {
      expect(decideCapability({ state }, 'professional_quote.use', true).allowed).toBe(true);
    }
  });
});

// Owner 2026-10-20 (AskUserQuestion: "לוגו פתוח לכולם (מומלץ)"): the business LOGO upload in Settings is open to every account and is
// never part of SMART PACK; only quote file attachments follow the attachment capability (SMART PACK once the plan system is enforced).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const dash = fs.readFileSync(path.join(HERE, 'pages', 'Dashboard.jsx'), 'utf8').replace(/\r\n/g, '\n');

describe('logo upload open to every account (source guard)', () => {
  it('the Settings mount passes the logo upload as always allowed', () => {
    expect(dash).toMatch(/canUseProfessionalQuotes=\{canUseCapability\('professional_quote\.use'\)\}\n\s*\/\/ Owner 2026-10-20: the business LOGO upload is open to every account[^\n]*\n\s*\/\/[^\n]*\n\s*canUseAttachments\n\s*onLockedCapability=\{setLockedCapability\}/);
  });
  it('the quote form still asks the attachment capability for quote attachments', () => {
    expect((dash.match(/canUseAttachments=\{canUseCapability\('quote_attachment\.upload'\)\}/g) || []).length).toBe(1);
  });
});

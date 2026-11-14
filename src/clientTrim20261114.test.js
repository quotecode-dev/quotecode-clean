// 2026-11-14 (Owner approved, scope-security finding 2): a client name typed with a space at its end ("Acme ") - the client step saves
// "Acme"; the quote save must find that client (no second client) and save the name without the space
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const dash = fs.readFileSync('src/pages/Dashboard.jsx', 'utf8');

describe('the quote save matches the client by the trimmed name', () => {
  it('both sides trimmed and lower-cased; the saved name trimmed', () => {
    expect(dash).toContain("const existingClient = clients.find(c => String(c.company_name || '').trim().toLowerCase() === String(clientName || '').trim().toLowerCase() && c.user_id === session.user.id);");
    expect(dash).toContain("company_name: String(clientName || '').trim(),");
    expect(dash).not.toContain('c.company_name?.toLowerCase() === clientName.toLowerCase()');
    // the client step saves the trimmed name and skips a name already in the list the same way
    expect(dash).toContain("const name = String(newClient?.company_name || '').trim();");
    expect(dash).toContain("clients.some((c) => String(c.company_name || '').trim().toLowerCase() === name.toLowerCase() && c.user_id === session.user.id)");
  });
  it('the rule itself: "Acme " finds "Acme" and "acme"', () => {
    const match = (list, typed) => list.find((c) => String(c.company_name || '').trim().toLowerCase() === String(typed || '').trim().toLowerCase());
    expect(match([{ company_name: 'Acme' }], 'Acme ')).toBeTruthy();
    expect(match([{ company_name: ' acme' }], 'ACME')).toBeTruthy();
    expect(match([{ company_name: 'Acme Ltd' }], 'Acme')).toBeFalsy();
  });
});

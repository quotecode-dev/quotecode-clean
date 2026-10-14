import { describe, it, expect, vi } from 'vitest';
import { buildPublicThanks, isServerSignedQuote } from './thanks.ts';

// Task 27 (spec §6): the thank-you is returned only for a quote the server holds as signed, with an explicit allowlist.
describe('get-public-quote thanks (after a server-verified signature only)', () => {
  const row = { thanks_text: '  Thank you!  ', website_url: 'https://example.test', show_website_after_signature: true, share_text: 'private', user_id: 'u' };
  it('signed = approved / paid AND a stored signature', () => {
    expect(isServerSignedQuote({ status: 'approved', signature: 'data:image/png;base64,AA' })).toBe(true);
    expect(isServerSignedQuote({ status: 'Paid', signature: 'data:image/png;base64,AA' })).toBe(true);
    expect(isServerSignedQuote({ status: 'sent', signature: 'data:image/png;base64,AA' })).toBe(false);
    expect(isServerSignedQuote({ status: 'approved', signature: null })).toBe(false);
    expect(isServerSignedQuote({ status: 'approved', signature: '  ' })).toBe(false);
    expect(isServerSignedQuote(null)).toBe(false);
  });
  it('never before signing; only the allowlisted fields after it', () => {
    expect(buildPublicThanks({ status: 'sent', signature: null }, row)).toBeNull();
    expect(buildPublicThanks({ status: 'approved', signature: 'sig' }, row)).toEqual({ text: 'Thank you!', website_url: 'https://example.test' });
  });
  it('the website only with the opt-in and only https; nothing configured = no thanks block', () => {
    expect(buildPublicThanks({ status: 'approved', signature: 'sig' }, { ...row, show_website_after_signature: false })).toEqual({ text: 'Thank you!', website_url: null });
    expect(buildPublicThanks({ status: 'approved', signature: 'sig' }, { ...row, website_url: 'javascript:alert(1)' })).toEqual({ text: 'Thank you!', website_url: null });
    expect(buildPublicThanks({ status: 'approved', signature: 'sig' }, { thanks_text: null, website_url: null, show_website_after_signature: false })).toBeNull();
    expect(buildPublicThanks({ status: 'approved', signature: 'sig' }, null)).toBeNull();
  });
});

describe('resolvePublicThanks (Task 28: the one helper for every route)', async () => {
  const { resolvePublicThanks } = await import('./thanks.ts');
  const row = { thanks_text: 'Thanks', website_url: 'https://example.test', show_website_after_signature: false };
  it('reads only for a signed quote and only for the given verified owner', async () => {
    const read = vi.fn(async () => row);
    expect(await resolvePublicThanks({ status: 'approved', signature: 'sig' }, 'owner-1', read)).toEqual({ text: 'Thanks', website_url: null });
    expect(read).toHaveBeenCalledWith('owner-1');
    read.mockClear();
    expect(await resolvePublicThanks({ status: 'sent', signature: null }, 'owner-1', read)).toBeNull();
    expect(await resolvePublicThanks({ status: 'approved', signature: 'sig' }, null, read)).toBeNull();
    expect(await resolvePublicThanks({ status: 'approved', signature: 'sig' }, 'owner-1', undefined)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
  it('a read error is no thanks', async () => {
    expect(await resolvePublicThanks({ status: 'paid', signature: 'sig' }, 'o', async () => { throw new Error('x'); })).toBeNull();
  });
});

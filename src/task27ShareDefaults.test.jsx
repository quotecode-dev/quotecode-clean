// Task 27 (P2, spec §6): manual sharing defaults, the thank-you after a verified signature, and their settings screen.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { normalizeShareDefaults, renderShareText, saveShareDefaults, loadShareDefaults } from './utils/shareDefaultsClient';
import ShareDefaultsSettings from './components/ShareDefaultsSettings';
import PublicThanksNotice from './components/PublicThanksNotice';

const USER = 'user-a';
function fakeClient({ loadResult = { data: null, error: null }, saveResult } = {}) {
  const upserts = [];
  const from = vi.fn(() => {
    const b = {
      select: () => b, eq: () => b,
      maybeSingle: () => Promise.resolve(loadResult),
      upsert: (row, opts) => { upserts.push([row, opts]); return { select: () => ({ single: () => Promise.resolve(saveResult ?? { data: { ...row }, error: null }) }) }; },
    };
    return b;
  });
  return { client: { from }, upserts };
}

describe('sharing defaults - rules', () => {
  it('same rules as the table: trimmed, bounded, https only, opt-in needs a URL; empty is stored as NULL', () => {
    expect(normalizeShareDefaults({ share_text: '  hi  ', thanks_text: '', website_url: '', show_website_after_signature: false }))
      .toEqual({ ok: true, value: { share_text: 'hi', thanks_text: null, website_url: null, show_website_after_signature: false } });
    expect(normalizeShareDefaults({ website_url: 'http://x.test' }).errors).toContain('website_invalid');
    expect(normalizeShareDefaults({ website_url: 'javascript:alert(1)' }).errors).toContain('website_invalid');
    expect(normalizeShareDefaults({ show_website_after_signature: true }).errors).toContain('website_required');
    expect(normalizeShareDefaults({ share_text: 'x'.repeat(601) }).errors).toContain('share_text_too_long');
    expect(normalizeShareDefaults({ thanks_text: 'x'.repeat(301) }).errors).toContain('thanks_text_too_long');
  });
  it('variables are filled; no custom text = null (the built-in message stays unchanged)', () => {
    expect(renderShareText('Hi {customer}, quote {number} from {business}: {total} {other}', { customer: 'Dana', number: '#1001', business: 'Synthetic Ltd', total: '₪100.00' }))
      .toBe('Hi Dana, quote #1001 from Synthetic Ltd: ₪100.00 {other}');
    expect(renderShareText('   ')).toBeNull();
    expect(renderShareText(null)).toBeNull();
  });
  it('save upserts the owner row; a server without the table is "unavailable"', async () => {
    const { client, upserts } = fakeClient();
    const r = await saveShareDefaults(client, USER, { share_text: 'Hi {customer}', thanks_text: 'Thanks', website_url: 'https://x.test', show_website_after_signature: true });
    expect(r.ok).toBe(true);
    expect(upserts[0]).toEqual([{ user_id: USER, share_text: 'Hi {customer}', thanks_text: 'Thanks', website_url: 'https://x.test', show_website_after_signature: true }, { onConflict: 'user_id' }]);
    const missing = fakeClient({ loadResult: { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } } });
    expect((await loadShareDefaults(missing.client, USER)).error.code).toBe('unavailable');
  });
});

describe('sharing defaults - settings screen', () => {
  it('HE: loads, validates before saving, saves and reports success only after the database returned the row', async () => {
    const { client, upserts } = fakeClient({ loadResult: { data: { user_id: USER, share_text: 'שלום {customer}', thanks_text: null, website_url: null, show_website_after_signature: false }, error: null } });
    const onSaved = vi.fn();
    render(<div dir="rtl"><ShareDefaultsSettings isHebrew client={client} userId={USER} onBack={vi.fn()} onSaved={onSaved} /></div>);
    await waitFor(() => expect(screen.getByTestId('sd-share-text')).toHaveValue('שלום {customer}'));
    expect(screen.getByText('שיתוף ותודה ללקוח')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('sd-website-optin'));
    fireEvent.click(screen.getByTestId('sd-save'));
    expect(screen.getByTestId('sd-errors').textContent).toMatch(/כדי להציג קישור יש להזין כתובת אתר/);
    expect(upserts).toHaveLength(0);
    fireEvent.change(screen.getByTestId('sd-website'), { target: { value: 'https://example.test' } });
    fireEvent.change(screen.getByTestId('sd-thanks-text'), { target: { value: 'תודה רבה!' } });
    fireEvent.click(screen.getByTestId('sd-save'));
    await waitFor(() => expect(screen.getByTestId('sd-saved')).toBeInTheDocument());
    expect(upserts[0][0]).toMatchObject({ thanks_text: 'תודה רבה!', website_url: 'https://example.test', show_website_after_signature: true });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ share_text: 'שלום {customer}' }));
  });
  it('EN: a server without the table disables the form and says so', async () => {
    const { client } = fakeClient({ loadResult: { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } } });
    render(<ShareDefaultsSettings isHebrew={false} client={client} userId={USER} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('share-defaults-unavailable').textContent).toMatch(/not available on this server yet/));
    expect(screen.getByTestId('sd-save')).toBeDisabled();
    expect(screen.getByTestId('sd-share-text')).toBeDisabled();
  });
});

describe('thank-you on the public quote', () => {
  it('plain text (never HTML) + an opt-in normal link; nothing without content', () => {
    const { container, rerender } = render(<PublicThanksNotice thanks={{ text: '<b>Thanks</b>\nsee you', website_url: 'https://example.test' }} isHebrew={false} />);
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByTestId('pq-thanks').textContent).toMatch(/<b>Thanks<\/b>/);
    const a = screen.getByTestId('pq-thanks-website');
    expect(a).toHaveAttribute('href', 'https://example.test');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    rerender(<PublicThanksNotice thanks={{ text: null, website_url: 'javascript:alert(1)' }} isHebrew />);
    expect(screen.queryByTestId('pq-thanks')).toBeNull();
    rerender(<PublicThanksNotice thanks={null} isHebrew />);
    expect(screen.queryByTestId('pq-thanks')).toBeNull();
  });
});

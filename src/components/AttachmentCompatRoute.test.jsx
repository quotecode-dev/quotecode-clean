// MD-2 (First-LIVE cutover compatibility, 2026-09-25): authorization order and outcomes of the attachment compatibility route, with a
// fake Supabase client that records every call (so "refused BEFORE any network call" is asserted, not assumed). The fake storage models
// both bucket states: PUBLIC (pre-migration: any authenticated caller may sign) and PRIVATE (post-migration: owner folder only).
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AttachmentCompatOpen } from './AttachmentCompatRoute';
import { matchAttachmentCompatPath, resolveAttachmentCompatOpen, SIGNED_URL_SECONDS } from '../utils/attachmentCompatPath';

vi.mock('../shared/supabase', () => ({ supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }) } } }));

const PROJECT = 'https://ljfizgrdyzxddswcedwr.supabase.co';
const OWNER = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';
const OTHER = '0b1c2d3e-4f50-4617-8829-3a4b5c6d7e8f';
const QUOTE = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';
const PATH = `${OWNER}/${QUOTE}_1790285195272.pdf`;
const match = matchAttachmentCompatPath(`/${PATH}`);

// rows: storage paths visible to the CURRENT user through quote_attachments RLS (quote owner only).
function fakeClient({ userId = OWNER, rows = [PATH], objects = [PATH], bucket = 'private', rowError = null, signOrigin = PROJECT } = {}) {
  const calls = [];
  return {
    calls,
    auth: { getSession: async () => { calls.push('getSession'); return { data: { session: userId ? { user: { id: userId } } : null } }; } },
    from(table) {
      calls.push(`from:${table}`);
      const q = { filters: {} };
      const api = {
        select: () => api,
        eq: (col, val) => { q.filters[col] = val; return api; },
        limit: async () => (rowError ? { data: null, error: rowError } : { data: rows.filter((p) => p === q.filters.storage_path).map((p) => ({ id: p })), error: null }),
      };
      return api;
    },
    storage: {
      from(bucketId) {
        calls.push(`storage:${bucketId}`);
        return {
          createSignedUrl: async (path, secs) => {
            calls.push(`sign:${path}:${secs}`);
            if (!objects.includes(path)) return { data: null, error: { message: 'Object not found' } };
            if (bucket === 'private' && path.split('/')[0] !== userId) return { data: null, error: { message: 'new row violates row-level security policy' } };
            return { data: { signedUrl: `${signOrigin}/storage/v1/object/sign/${bucketId}/${path}?token=t` }, error: null };
          },
        };
      },
    },
  };
}
const resolveWith = (opts, m = match) => { const client = fakeClient(opts); return resolveAttachmentCompatOpen({ client, match: m, supabaseUrl: PROJECT }).then((r) => ({ r, calls: client.calls })); };

describe('resolveAttachmentCompatOpen', () => {
  it.each(['private', 'public'])('valid owner, bucket %s: RLS-visible row -> signed URL of THIS object in quote-files -> redirect', async (bucket) => {
    const { r, calls } = await resolveWith({ bucket });
    expect(r).toEqual({ state: 'redirect', url: `${PROJECT}/storage/v1/object/sign/quote-files/${PATH}?token=t` });
    expect(calls).toEqual(['getSession', 'from:quote_attachments', 'storage:quote-files', `sign:${PATH}:${SIGNED_URL_SECONDS}`]);
    expect(SIGNED_URL_SECONDS).toBeLessThanOrEqual(60);
  });
  it('logged out -> sign-in state; nothing queried or signed', async () => {
    const { r, calls } = await resolveWith({ userId: null });
    expect(r).toEqual({ state: 'signin' }); expect(calls).toEqual(['getSession']);
  });
  it.each(['private', 'public'])('another tenant (bucket %s) -> refused before ANY query or signing, even though a public bucket would sign it', async (bucket) => {
    const { r, calls } = await resolveWith({ userId: OTHER, rows: [], bucket });
    expect(r).toEqual({ state: 'unavailable' }); expect(calls).toEqual(['getSession']);
  });
  it('the RLS row check is the tenant boundary: a path in the caller\'s own folder with no visible row is never signed', async () => {
    const { r, calls } = await resolveWith({ rows: [] });
    expect(r).toEqual({ state: 'unavailable' }); expect(calls.some((c) => c.startsWith('sign:'))).toBe(false);
  });
  it('a removed attachment (row gone, object orphaned - R-2) is not opened', async () => {
    const { r, calls } = await resolveWith({ rows: [], objects: [PATH] });
    expect(r.state).toBe('unavailable'); expect(calls.some((c) => c.startsWith('sign:'))).toBe(false);
  });
  it('row present but object missing -> controlled "unavailable", no redirect', async () => {
    const { r } = await resolveWith({ objects: [] });
    expect(r).toEqual({ state: 'unavailable' });
  });
  it('attachment row query error -> controlled error, no signing', async () => {
    const { r, calls } = await resolveWith({ rowError: { message: 'x' } });
    expect(r).toEqual({ state: 'error' }); expect(calls.some((c) => c.startsWith('sign:'))).toBe(false);
  });
  it('a signed URL that is not this project\'s signed-object URL is never followed (no open redirect)', async () => {
    const { r } = await resolveWith({ signOrigin: 'https://evil.example' });
    expect(r).toEqual({ state: 'error' });
  });
});

describe('AttachmentCompatOpen (rendered)', () => {
  it('redirects with location.replace-style navigation to the signed URL only', async () => {
    const navigate = vi.fn();
    render(<MemoryRouter><AttachmentCompatOpen isHebrew={false} match={match} client={fakeClient()} supabaseUrl={PROJECT} navigate={navigate} /></MemoryRouter>);
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith(`${PROJECT}/storage/v1/object/sign/quote-files/${PATH}?token=t`);
    cleanup();
  });
  it.each([
    [true, { userId: null }, 'signin', 'rtl', /להתחבר/],
    [false, { userId: null }, 'signin', 'ltr', /Sign in/],
    [true, { userId: OTHER }, 'unavailable', 'rtl', /אינו זמין/],
    [false, { rows: [] }, 'unavailable', 'ltr', /not available/],
    [false, { rowError: { message: 'x' } }, 'error', 'ltr', /cannot be opened/],
  ])('HE=%s %j -> %s state, dir %s, localized message, dashboard link, no redirect', async (isHebrew, opts, state, dir, text) => {
    const navigate = vi.fn();
    render(<MemoryRouter><AttachmentCompatOpen isHebrew={isHebrew} match={match} client={fakeClient(opts)} supabaseUrl={PROJECT} navigate={navigate} /></MemoryRouter>);
    const el = await screen.findByTestId('attachment-compat-open');
    await waitFor(() => expect(el.getAttribute('data-state')).toBe(state));
    expect(el.getAttribute('dir')).toBe(dir);
    expect(screen.getByRole('status').textContent).toMatch(text);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/dashboard');
    expect(navigate).not.toHaveBeenCalled();
    cleanup();
  });
  it('resolves exactly once per mount (no repeated session/row/sign requests across re-renders)', async () => {
    const client = fakeClient({ userId: null });
    const { rerender } = render(<MemoryRouter><AttachmentCompatOpen isHebrew={false} match={match} client={client} supabaseUrl={PROJECT} /></MemoryRouter>);
    const el = await screen.findByTestId('attachment-compat-open');
    await waitFor(() => expect(el.getAttribute('data-state')).toBe('signin'));
    rerender(<MemoryRouter><AttachmentCompatOpen isHebrew={false} match={{ ...match }} client={client} supabaseUrl={PROJECT} /></MemoryRouter>);
    await new Promise((r) => setTimeout(r, 20));
    expect(client.calls).toEqual(['getSession']);
    cleanup();
  });
  it('a thrown client error ends in the controlled error state', async () => {
    const client = fakeClient(); client.auth.getSession = async () => { throw new Error('network'); };
    render(<MemoryRouter><AttachmentCompatOpen isHebrew={false} match={match} client={client} supabaseUrl={PROJECT} navigate={vi.fn()} /></MemoryRouter>);
    const el = await screen.findByTestId('attachment-compat-open');
    await waitFor(() => expect(el.getAttribute('data-state')).toBe('error'));
    cleanup();
  });
});

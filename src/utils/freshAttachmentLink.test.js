import { describe, it, expect, vi } from 'vitest';
import { openAttachmentFresh, ATTACHMENT_LINK_FRESH_MS } from './freshAttachmentLink';

const att = { file_name: 'plan.pdf', url: 'https://x/old' };
const flush = () => new Promise((r) => setTimeout(r, 0));

function fakeWin() {
  const tab = { opener: 'me', closed: false, location: { href: '' } };
  return { tab, win: { open: vi.fn(() => tab), location: { href: '' } } };
}

describe('openAttachmentFresh (Owner 2026-10-23: the 5-minute attachment link)', () => {
  it('a fresh link opens normally', () => {
    const e = { preventDefault: vi.fn() };
    const { win } = fakeWin();
    const reload = vi.fn();
    expect(openAttachmentFresh(e, { att, index: 0, loadedAt: 1000, now: 1000 + ATTACHMENT_LINK_FRESH_MS - 1, reload, win })).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('an old link re-reads the quote and opens the fresh link of the same file in the tab opened at click time', async () => {
    const e = { preventDefault: vi.fn() };
    const { win, tab } = fakeWin();
    const reload = vi.fn(async () => ({ attachments: [{ file_name: 'other.pdf', url: 'https://x/o' }, { file_name: 'plan.pdf', url: 'https://x/new' }] }));
    expect(openAttachmentFresh(e, { att, index: 0, loadedAt: 0, now: ATTACHMENT_LINK_FRESH_MS, reload, win })).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(win.open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBe(null);
    await flush();
    expect(tab.location.href).toBe('https://x/new');
  });

  it('a failed re-read still opens the original link', async () => {
    const e = { preventDefault: vi.fn() };
    const { win, tab } = fakeWin();
    openAttachmentFresh(e, { att, index: 0, loadedAt: 0, now: ATTACHMENT_LINK_FRESH_MS, reload: async () => { throw new Error('net'); }, win });
    await flush();
    expect(tab.location.href).toBe('https://x/old');
  });

  it('a blocked tab lets the link open as it always did - the quote page never navigates away', async () => {
    const e = { preventDefault: vi.fn() };
    const win = { open: vi.fn(() => null), location: { href: '' } };
    const reload = vi.fn();
    expect(openAttachmentFresh(e, { att, index: 0, loadedAt: 0, now: ATTACHMENT_LINK_FRESH_MS, reload, win })).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(win.location.href).toBe('');
  });

  it('the fresh list matched by name when the order changed; no match -> the original link', async () => {
    const a = fakeWin();
    openAttachmentFresh({ preventDefault() {} }, { att, index: 1, loadedAt: 0, now: ATTACHMENT_LINK_FRESH_MS, reload: async () => ({ attachments: [{ file_name: 'plan.pdf', url: 'https://x/new' }] }), win: a.win });
    const b = fakeWin();
    openAttachmentFresh({ preventDefault() {} }, { att, index: 0, loadedAt: 0, now: ATTACHMENT_LINK_FRESH_MS, reload: async () => ({ attachments: [] }), win: b.win });
    await flush();
    expect(a.tab.location.href).toBe('https://x/new');
    expect(b.tab.location.href).toBe('https://x/old');
  });

  it('the preview (no reload) never takes over the click', () => {
    const e = { preventDefault: vi.fn() };
    expect(openAttachmentFresh(e, { att, index: 0, loadedAt: 0, now: 10 * ATTACHMENT_LINK_FRESH_MS, reload: null, win: fakeWin().win })).toBe(false);
  });
});


// Codex review 2026-10-23 R-04: the same file by its id - never another file with the same name
describe('openAttachmentFresh - the file identity', () => {
  it('two files named plan.pdf: the clicked one (by id) opens, even when the order changed', async () => {
    const { win, tab } = fakeWin();
    const att2 = { id: 'b', file_name: 'plan.pdf', url: 'https://x/old-b' };
    const reload = async () => ({ attachments: [{ id: 'b', file_name: 'plan.pdf', url: 'https://x/new-b' }, { id: 'a', file_name: 'plan.pdf', url: 'https://x/new-a' }] });
    openAttachmentFresh({ preventDefault() {} }, { att: att2, index: 1, loadedAt: 0, now: ATTACHMENT_LINK_FRESH_MS, reload, win });
    await flush();
    expect(tab.location.href).toBe('https://x/new-b');
  });
  it('a removed file is said so: the tab closes, nothing else opens', async () => {
    const tab = { opener: 'me', closed: false, location: { href: '' }, close: vi.fn() };
    const win = { open: vi.fn(() => tab), location: { href: '' }, alert: vi.fn() };
    const reload = async () => ({ attachments: [{ id: 'other', file_name: 'plan.pdf', url: 'https://x/other' }] });
    openAttachmentFresh({ preventDefault() {} }, { att: { id: 'gone', file_name: 'plan.pdf', url: 'https://x/old' }, index: 0, loadedAt: 0, now: ATTACHMENT_LINK_FRESH_MS, reload, win, removedText: 'removed' });
    await flush();
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe('');
    expect(win.alert).toHaveBeenCalledWith('removed');
  });
  it('an older server without ids: an ambiguous name opens the original link, never another file', async () => {
    const { win, tab } = fakeWin();
    const reload = async () => ({ attachments: [{ file_name: 'plan.pdf', url: 'https://x/1' }, { file_name: 'plan.pdf', url: 'https://x/2' }] });
    openAttachmentFresh({ preventDefault() {} }, { att: { file_name: 'plan.pdf', url: 'https://x/old' }, index: 0, loadedAt: 0, now: ATTACHMENT_LINK_FRESH_MS, reload, win });
    await flush();
    expect(tab.location.href).toBe('https://x/old');
  });
});

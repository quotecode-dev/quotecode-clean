// Owner console 2026-11-02 (the plan for Shira): the screen of what catches on, in Hebrew and English; unknown is never 0.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import AdminSocialResults from './AdminSocialResults';
import { summarize } from './socialResultsSummary';

afterEach(() => cleanup());
const rows = [
  { network: 'instagram', market: 'il', kind: 'video', postId: 'm1', title: 'עוד ערב שלם', url: 'https://www.instagram.com/reel/x/', views: 100, likes: 9, comments: 1, shares: null },
  { network: 'facebook', market: 'intl', kind: 'image', postId: 'p1', title: '', url: 'https://evil.example/', views: null, likes: 1, comments: 0, shares: 0 },
];

describe.each([[true, 'מה תופס', 'לא זמין', 'בלי כיתוב', 'rtl'], [false, 'What catches on', 'Not available', 'No caption', 'ltr']])('isHebrew=%s', (he, title, na, noTitle, dir) => {
  it('shows what catches on and every post, best first; a missing number says so', () => {
    const { getByTestId } = render(<AdminSocialResults isHebrew={he} content={rows} />);
    const box = getByTestId('social-results');
    expect(box.getAttribute('dir')).toBe(dir);
    expect(box.textContent).toContain(title);
    const list = getByTestId('social-content-list');
    expect(list.querySelector('li').getAttribute('data-testid')).toBe('social-content-instagram-m1');
    expect(getByTestId('social-content-facebook-p1').textContent).toContain(na);
    expect(getByTestId('social-content-facebook-p1').textContent).toContain(noTitle);
    expect(getByTestId('social-content-facebook-p1').querySelector('a')).toBeNull();
    expect(getByTestId('social-content-instagram-m1').querySelector('a').getAttribute('rel')).toContain('noopener');
  });
  it('no data yet is said as such', () => {
    expect(render(<AdminSocialResults isHebrew={he} content={[]} />).getByTestId('social-results-empty')).toBeTruthy();
  });
  it('the folder buttons only for who can publish', () => {
    expect(render(<AdminSocialResults isHebrew={he} canPublish={false} />).queryByTestId('social-still-add-il')).toBeNull();
    cleanup();
    expect(render(<AdminSocialResults isHebrew={he} canPublish />).getByTestId('social-still-add-intl')).toBeTruthy();
  });
});

describe('the folder and the averages', () => {
  it('averages count measured views only', () => {
    expect(summarize([{ network: 'a', market: 'il', kind: 'video', views: 10, likes: 1 }, { network: 'a', market: 'il', kind: 'video', views: null, likes: 3 }])[0]).toMatchObject({ posts: 2, avgViews: 10, avgEngagement: 2 });
  });
  it('a failed upload says so', async () => {
    const upload = vi.fn(async () => true);
    globalThis.createImageBitmap = vi.fn(async () => { throw new Error('bad image'); });
    const { getByTestId } = render(<AdminSocialResults isHebrew canPublish upload={upload} />);
    fireEvent.change(getByTestId('social-still-file'), { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });
    await waitFor(() => expect(getByTestId('social-still-notice').textContent).toContain('ההעלאה לא הצליחה'));
    expect(upload).not.toHaveBeenCalled();
  });
});

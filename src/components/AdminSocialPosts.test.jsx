// Owner console 2026-10-27: "מאשר את שלב 1 של סוכנת הרשתות" + the supervisor screen (L-22, "מאשר את שניהם") + the agents room layout
// ("תחלק את המסך ל 6 תוסיף את הסוכנת החדשה מתחת לגיא ואם המלל ארוך אז שהוא יגלל בתוך התיבה שלו", "ככה יהיה לנו מקום לעוד 2 סוכנים").
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';

const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { functions: { invoke: (...a) => invoke(...a) } } }));
import AdminSocialPosts from './AdminSocialPosts';
import AdminAgentsRoom from './AdminAgentsRoom';
import { ADMIN_DESTINATIONS, ADMIN_PERMISSIONS, canOpenDestination } from './adminDestinations';

afterEach(cleanup);
beforeEach(() => invoke.mockReset());

const post = (id, channel, status, over = {}) => {
  const il = channel.endsWith('_il');
  const network = channel.startsWith('fb') ? 'facebook' : channel.startsWith('ig') ? 'instagram' : 'tiktok';
  return { id, action_type: 'social_post', kind: 'system', source: 'social', status, created_at: '2026-11-01T05:30:00Z', decided_at: null, done_at: null,
    title_he: 'פוסט', title_en: 'Post', payload: { channel, network, market: il ? 'il' : 'intl', accountOpen: il, art: 'quote',
      text: il ? 'הצעת מחיר ברורה בכמה דקות.' : 'A clear quote in minutes.', hashtags: il ? ['#הצעת_מחיר', '#TEKANGO'] : ['#quotes', '#TEKANGO'],
      link: il ? 'https://www.tekango.com/he' : 'https://www.tekango.com/en',
      ...(network === 'tiktok' ? { video_script: il ? 'תסריט קצר בעברית לסרטון.' : 'A short script for the video.', video_scenes: ['Scene one shows a phone', 'Scene two shows a quote', 'Scene three shows a signature'] } : {}) }, ...over };
};
const STATE = { ok: true, canPublish: true, profile: { agent: 'social', name_he: 'שירה', name_en: 'Shira' },
  posts: [post('p1', 'fb_il', 'proposed'), post('p2', 'fb_intl', 'proposed'), post('p3', 'tt_il', 'approved'), post('p4', 'ig_intl', 'done')] };

describe('the social posts', () => {
  it.each([[true], [false]])('isHebrew=%s: waiting / ready / published; every post in its own language and direction; the international account is not open yet', async (isHebrew) => {
    invoke.mockResolvedValue({ data: STATE, error: null });
    render(<AdminSocialPosts isHebrew={isHebrew} />);
    await waitFor(() => expect(screen.getByTestId('social-posts')).toBeTruthy());
    expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'social_state' } });
    expect(screen.getByTestId('social-waiting').querySelectorAll(':scope > li')).toHaveLength(2);
    expect(screen.getByTestId('social-ready').querySelectorAll(':scope > li')).toHaveLength(1);
    const he = screen.getByTestId('social-post-text-p1');
    expect(he.getAttribute('dir')).toBe('rtl'); expect(he.getAttribute('lang')).toBe('he');
    const en = screen.getByTestId('social-post-text-p2');
    expect(en.getAttribute('dir')).toBe('ltr'); expect(en.getAttribute('lang')).toBe('en');
    expect(screen.getByTestId('social-post-p2').textContent).toContain(isHebrew ? 'החשבון עוד לא נפתח' : 'The account is not open yet');
    expect(screen.getByTestId('social-post-p1').textContent).not.toContain(isHebrew ? 'החשבון עוד לא נפתח' : 'The account is not open yet');
    expect(screen.getByTestId('social-post-art-p1').getAttribute('src')).toBe('/social/art/quote.jpg');
    expect(screen.getByTestId('social-post-video-p3').textContent).toContain('Scene two shows a quote');
  });

  it('approve / ask for a change / not now on a waiting post; copy, download, script and published on a ready one', async () => {
    invoke.mockResolvedValue({ data: STATE, error: null });
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<AdminSocialPosts isHebrew />);
    await screen.findByTestId('social-posts');
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'ready' }, error: null });
    fireEvent.click(screen.getByTestId('social-approve-p1'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'decide', id: 'p1', decision: 'approve' } }));
    await waitFor(() => expect(screen.getByTestId('social-posts-notice').textContent).toBe('אושר. הפוסט מוכן לפרסום למטה.'));
    fireEvent.click(screen.getByTestId('social-revise-p2'));
    fireEvent.change(screen.getByTestId('social-revise-note-p2'), { target: { value: 'יותר קצר' } });
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'revised' }, error: null });
    fireEvent.click(screen.getByTestId('social-revise-send-p2'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'revise', id: 'p2', note: 'יותר קצר' } }));
    fireEvent.click(screen.getByTestId('social-copy-p3'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('הצעת מחיר ברורה בכמה דקות.\n\n#הצעת_מחיר #TEKANGO\n\nhttps://www.tekango.com/he'));
    expect(screen.getByTestId('social-download-p3').getAttribute('href')).toBe('/social/art/quote.jpg');
    expect(screen.getByTestId('social-download-p3').hasAttribute('download')).toBe(true);
    fireEvent.click(screen.getByTestId('social-copy-script-p3'));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('תסריט קצר בעברית לסרטון.\n1. Scene one shows a phone\n2. Scene two shows a quote\n3. Scene three shows a signature'));
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'done' }, error: null });
    fireEvent.click(screen.getByTestId('social-published-p3'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'mark_done', id: 'p3' } }));
  });

  it('a supervisor without social.publish reads only - no action button', async () => {
    invoke.mockResolvedValue({ data: { ...STATE, canPublish: false }, error: null });
    render(<AdminSocialPosts isHebrew={false} />);
    await screen.findByTestId('social-posts');
    expect(screen.queryByTestId('social-approve-p1')).toBeNull();
    expect(screen.queryByTestId('social-copy-p3')).toBeNull();
    expect(screen.queryByTestId('social-published-p3')).toBeNull();
  });
});

describe('the "Social media" screen and its permissions (L-22)', () => {
  it('one destination in the "ניהול" hub, opened by social.view; social.publish is an action of it', () => {
    const d = ADMIN_DESTINATIONS.find((x) => x.id === 'social');
    expect(d).toMatchObject({ hub: 'manage', permission: 'social.view', available: true, label: { he: 'רשתות חברתיות', en: 'Social media' } });
    expect(ADMIN_PERMISSIONS.find((p) => p.id === 'social.publish')).toMatchObject({ destination: 'social', action: true, label: { he: 'אישור פוסטים וסימון פורסם', en: 'Approve posts and mark them published' } });
    expect(canOpenDestination(d, { owner: false, permissions: ['social.view'] })).toBe(true);
    expect(canOpenDestination(d, { owner: false, permissions: ['social.publish'] })).toBe(false);
    expect(canOpenDestination(ADMIN_DESTINATIONS.find((x) => x.id === 'agents-room'), { owner: false, permissions: ['social.view', 'social.publish'] })).toBe(false);
  });
});

describe('the agents room: 6 places, the social agent under the SEO agent, a long report scrolls inside its card', () => {
  const runs = [
    { id: 'r1', agent: 'seo', run_key: 'admin:x', trigger: 'admin', status: 'done', started_at: '2026-10-27T13:01:00Z', finished_at: '2026-10-27T13:01:00Z',
      summary: 'סיכום ארוך.', data: { summaryEn: 'A long summary.' }, ai_cost_usd: 0, error: null, findings: Array.from({ length: 40 }, (_, i) => ({ level: 'warn', he: `ממצא ${i}`, en: `Finding ${i}` })) },
    { id: 'r2', agent: 'social', run_key: 'admin:y', trigger: 'admin', status: 'done', started_at: '2026-10-27T13:05:00Z', finished_at: '2026-10-27T13:05:00Z',
      summary: 'הוכנו 10 פוסטים לשבוע הזה, והם מחכים לאישורכם אצל מנהלת הסוכנים.', data: { summaryEn: '10 posts were prepared for this week and wait for your approval at the agents manager.' }, ai_cost_usd: 0.01, error: null, findings: [] },
  ];
  const room = { ok: true, cap: 20, monthCostUsd: 0.01, split: { intl: 65, il: 35 }, googleConfigured: true, runs, profiles: [{ agent: 'social', name_he: 'שירה', name_en: 'Shira' }],
    actions: [post('p1', 'fb_il', 'proposed'), post('p2', 'fb_intl', 'proposed')], drafts: [] };
  it.each([[true, 'מקום פנוי לסוכן נוסף'], [false, 'Room for another agent']])('isHebrew=%s', async (isHebrew, empty) => {
    invoke.mockImplementation(async (_n, opts) => ({ data: opts?.body?.action === 'social_state' ? STATE : room, error: null }));
    render(<AdminAgentsRoom isHebrew={isHebrew} />);
    const grid = await screen.findByTestId('agents-grid');
    const cells = [...grid.children].map((c) => c.getAttribute('data-testid'));
    expect(cells).toEqual(['agent-card-seo', 'agent-card-service', 'agent-card-security', 'agent-card-social', 'agent-slot-empty', 'agent-slot-empty']);
    expect(grid.style.gridTemplateColumns).toContain('calc((100% - 28px) / 3)'); // at most three per row -> the social agent sits under the SEO agent
    expect(screen.getAllByTestId('agent-slot-empty')[0].textContent).toBe(empty);
    for (const id of ['seo', 'social']) {
      const card = screen.getByTestId(`agent-card-${id}`);
      expect(card.style.height).toBe('520px');
      const body = screen.getByTestId(`agent-body-${id}`);
      expect(body.style.overflowY).toBe('auto');
      expect(within(card).getByTestId(`agent-run-${id}`).parentElement).toBe(card); // "run now" stays visible below the scrolling report
    }
    expect(screen.getByTestId('agent-body-seo').textContent).toContain(isHebrew ? 'ממצא 39' : 'Finding 39');
    // Owner 2026-10-29 (L-22): below 1000px the card grows with its report and nothing scrolls inside it - the desktop above is unchanged
    for (const id of ['seo', 'service', 'security', 'social']) {
      expect(screen.getByTestId(`agent-card-${id}`).classList.contains('av-agent-card')).toBe(true);
      expect(screen.getByTestId(`agent-body-${id}`).classList.contains('av-agent-body')).toBe(true);
    }
    const css = readFileSync('src/components/adminV2.css', 'utf8').replace(/\r\n/g, '\n');
    const small = css.slice(css.indexOf('@media (max-width: 999px) {'), css.indexOf('@media (max-width: 599px) {'));
    expect(small).toContain('.av-agent-card { height: auto !important; }');
    expect(small).toContain('.av-agent-body { flex: none !important; overflow-y: visible !important; overscroll-behavior: auto !important; }');
    expect(css.slice(0, css.indexOf('@media (max-width: 999px) {'))).not.toContain('.av-agent-');
    expect(screen.getByTestId('agent-name-social').textContent).toBe(isHebrew ? 'שירה' : 'Shira');
    // the posts wait on the manager's desk, in their own list (the count of what waits includes them)
    expect(screen.getByTestId('agents-pending-count').textContent).toBe('2');
    expect(screen.queryByTestId('agents-pending')).toBeNull();
    expect(screen.getByTestId('agents-social-posts').hasAttribute('open')).toBe(true);
  });
});

describe('stage 2: a connected account (Owner 2026-10-27, "מאשר את שלב 2 של סוכנת הרשתות")', () => {
  it.each([[true, 'מאשר ומפרסם', 'העתקת הקישור לפוסט'], [false, 'Approve and publish', 'Copy the post link']])('isHebrew=%s: approve-and-publish on a connected account, the link to a published post, a failure says publish by hand', async (isHebrew, approve, view) => {
    const done = { ...post('p5', 'fb_intl', 'done'), result: { published: true, auto: true, url: 'https://www.facebook.com/1408027809060627_5' } };
    const failed = { ...post('p6', 'ig_il', 'approved'), error: 'publish_failed: meta_400_190' };
    const evil = { ...post('p7', 'fb_il', 'done'), result: { url: 'javascript:alert(1)' } };
    invoke.mockResolvedValue({ data: { ...STATE, autoChannels: ['fb_il', 'fb_intl', 'ig_il'], posts: [post('p1', 'fb_il', 'proposed'), post('p8', 'tt_il', 'proposed'), done, failed, evil] }, error: null });
    render(<AdminSocialPosts isHebrew={isHebrew} />);
    await screen.findByTestId('social-posts');
    expect(screen.getByTestId('social-approve-p1').textContent).toBe(approve);
    expect(screen.getByTestId('social-auto-p1')).toBeTruthy();
    expect(screen.queryByTestId('social-auto-p8')).toBeNull(); // TikTok stays manual
    expect(screen.getByTestId('social-approve-p8').textContent).toBe(isHebrew ? 'מאשר' : 'Approve');
    const link = screen.getByTestId('social-link-p5');
    expect(link.textContent).toContain('https://www.facebook.com/1408027809060627_5');
    expect(screen.getByTestId('social-copy-link-p5').textContent).toBe(view);
    expect(link.querySelector('a')).toBeNull(); // the admin never opens another tab
    expect(screen.queryByTestId('social-link-p7')).toBeNull(); // only a Meta address is ever a link
    expect(screen.getByTestId('social-failed-p6')).toBeTruthy();
    expect(screen.getByTestId('social-copy-p6')).toBeTruthy(); // still copy / download / published by hand
  });

  it.each([[true, 'פרסום עכשיו', 'הפוסט פורסם. הקישור אליו מופיע ברשימת "פורסמו לאחרונה".', 'הפוסט מתפרסם ממש עכשיו. רעננו בעוד דקה.'],
    [false, 'Publish now', 'The post was published. Its link is in "Published lately".', 'The post is being published right now. Refresh in a minute.']])(
    'isHebrew=%s: "publish now" on a ready post of a connected account only (Owner 2026-10-27, "מאשר")', async (isHebrew, label, okText, busyText) => {
      const stuck = post('p9', 'ig_intl', 'approved', { decided_at: '2026-10-27T20:19:12.345+00:00' });
      invoke.mockResolvedValue({ data: { ...STATE, autoChannels: ['fb_il', 'fb_intl', 'ig_il', 'ig_intl'], posts: [stuck, post('p3', 'tt_il', 'approved')] }, error: null });
      render(<AdminSocialPosts isHebrew={isHebrew} />);
      await screen.findByTestId('social-posts');
      expect(screen.getByTestId('social-publish-now-p9').textContent).toBe(label);
      expect(screen.getByTestId('social-publish-now-p9').className).toContain('av-primary');
      expect(screen.getByTestId('social-copy-p9').className).not.toContain('av-primary');
      expect(screen.queryByTestId('social-publish-now-p3')).toBeNull(); // TikTok stays manual
      expect(screen.getByTestId('social-post-p9').textContent).not.toContain(isHebrew ? 'החשבון עוד לא נפתח' : 'The account is not open yet');
      invoke.mockResolvedValueOnce({ data: { ok: true, status: 'published', url: 'https://www.instagram.com/p/ABC/' }, error: null });
      fireEvent.click(screen.getByTestId('social-publish-now-p9'));
      await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'publish_now', id: 'p9' } }));
      await waitFor(() => expect(screen.getByTestId('social-posts-notice').textContent).toBe(okText));
      invoke.mockResolvedValueOnce({ data: null, error: { context: { json: async () => ({ ok: false, code: 'publishing' }) } } });
      fireEvent.click(screen.getByTestId('social-publish-now-p9'));
      await waitFor(() => expect(screen.getByTestId('social-posts-notice').textContent).toBe(busyText));
    });

  // 20261029000000 (Codex F08 / F10): the reason in plain words; an outcome not known is checked on the page before publishing again
  it.each([[true], [false]])('isHebrew=%s: a dead page connection says what to do; an unknown outcome asks to check first', async (isHebrew) => {
    const dead = { ...post('p6', 'fb_il', 'approved'), decided_at: '2026-11-01T06:00:00Z', error: 'publish_failed: meta_400_190' };
    const unsure = { ...post('p7', 'ig_intl', 'approved'), decided_at: '2026-11-01T06:00:00Z', error: 'publish_unknown: The signal has been aborted' };
    invoke.mockResolvedValue({ data: { ...STATE, autoChannels: ['fb_il', 'fb_intl', 'ig_il', 'ig_intl'], posts: [dead, unsure] }, error: null });
    render(<AdminSocialPosts isHebrew={isHebrew} />);
    await screen.findByTestId('social-posts');
    expect(screen.getByTestId('social-failed-p6').textContent).toBe(isHebrew ? 'החיבור לדף פג. צריך לחבר את הדף מחדש, ואחר כך ללחוץ "פרסום עכשיו".' : 'The connection to the page expired. Reconnect the page, then press "Publish now".');
    expect(screen.getByTestId('social-unknown-p7').textContent).toContain(isHebrew ? 'לא ברור אם הפוסט פורסם. בדקו בדף באינסטגרם' : 'We could not confirm whether the post was published. Check the page on Instagram');
    expect(screen.queryByTestId('social-publish-now-p7')).toBeNull();
    expect(screen.getByTestId('social-publish-confirmed-p7').textContent).toBe(isHebrew ? 'הפוסט לא פורסם, לפרסם עכשיו' : 'It was not published - publish now');
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'ready', publishError: 'publish_failed: meta_400_190' }, error: null });
    fireEvent.click(screen.getByTestId('social-publish-now-p6'));
    await waitFor(() => expect(screen.getByTestId('social-posts-notice').textContent).toContain(isHebrew ? 'החיבור לדף פג' : 'The connection to the page expired'));
    expect(screen.getByTestId('social-posts-notice').className).toContain('av-bad'); // a failure is never shown as a success
    invoke.mockResolvedValueOnce({ data: { ok: true, status: 'published', url: 'https://www.instagram.com/p/X/' }, error: null });
    fireEvent.click(screen.getByTestId('social-publish-confirmed-p7'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', { body: { action: 'publish_now', id: 'p7', confirm: 'not_published' } }));
  });
});
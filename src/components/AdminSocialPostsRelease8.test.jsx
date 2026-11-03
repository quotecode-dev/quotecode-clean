// Codex release 8 (Owner console 2026-10-30, "מאשר להוסיף לשחרור 8 תשובות של שירה לתגובות, כטיוטה לאישור שלי", L-22): the comments waiting for
// a reply (an editable draft, a sensitive one without a draft), the approval sends the text as approved, and the results of published
// posts - reach missing is said so, never 0. SYNTHETIC state; the server is a fake.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const invoke = vi.fn();
vi.mock('../shared/supabase', () => ({ supabase: { functions: { invoke: (...a) => invoke(...a) } } }));
import AdminSocialPosts from './AdminSocialPosts';

afterEach(cleanup);
beforeEach(() => invoke.mockReset());

const reply = (id, over = {}) => ({ id, action_type: 'social_reply', kind: 'system', source: 'social', status: 'proposed', created_at: '2026-11-04T09:00:00Z',
  title_he: 'תגובה', title_en: 'Comment', payload: { channel: 'fb_il', network: 'facebook', market: 'il', comment_id: `c-${id}`, comment_text: 'איך מוסיפים לוגו?', author: 'דנה', sensitive: false, draft: 'בהגדרות העסק יש שדה לוגו.' }, ...over });
const done = { id: 'p4', action_type: 'social_post', kind: 'system', source: 'social', status: 'done', created_at: '2026-11-01T05:30:00Z', title_he: 'פוסט', title_en: 'Post',
  payload: { channel: 'fb_il', network: 'facebook', market: 'il', text: 'טקסט', hashtags: ['#א', '#ב'], link: 'https://www.tekango.com/he', art: 'quote' }, result: { published: true, auto: true, url: 'https://www.facebook.com/1', id: '1' } };
const STATE = { ok: true, canPublish: true, profile: null, posts: [done], autoChannels: ['fb_il'],
  replies: [reply('r1'), reply('r2', { payload: { ...reply('r2').payload, comment_text: 'אני רוצה החזר', sensitive: true, draft: null } })],
  metrics: [{ actionId: 'p4', network: 'facebook', likes: 7, comments: 2, shares: 1, reach: null, reachAvailable: false }] };

describe('Shira\'s replies and the post results', () => {
  it.each([[true], [false]])('isHebrew=%s: a draft to edit, a sensitive comment without a draft, the results with reach unavailable', async (he) => {
    invoke.mockResolvedValue({ data: STATE, error: null });
    render(<AdminSocialPosts isHebrew={he} />);
    await screen.findByTestId('social-replies-waiting');
    expect(screen.getByTestId('social-reply-text-r1').value).toBe('בהגדרות העסק יש שדה לוגו.');
    expect(screen.getByTestId('social-reply-text-r2').value).toBe('');
    expect(screen.getByTestId('social-reply-sensitive-r2').textContent).toBe(he ? 'נושא רגיש (כסף, ביטול, פרטיות או תלונה): שירה לא כתבה טיוטה. כתבו את התשובה בעצמכם.'
      : 'A sensitive topic (money, cancellation, privacy or a complaint): Shira wrote no draft. Write the answer yourselves.');
    expect(screen.getByTestId('social-reply-approve-r2').disabled).toBe(true);
    fireEvent.click(screen.getByTestId('social-published').querySelector('summary'));
    expect(screen.getByTestId('social-metrics-p4').textContent).toContain(he ? 'נתוני הפוסט אינם זמינים בהרשאות הנוכחיות.' : 'post metrics are unavailable with the current permissions.');
    expect(screen.getByTestId('social-metrics-p4').textContent).toContain('7');
  });
  it('the approval sends the text exactly as edited', async () => {
    invoke.mockResolvedValue({ data: STATE, error: null });
    render(<AdminSocialPosts isHebrew />);
    await screen.findByTestId('social-replies-waiting');
    fireEvent.change(screen.getByTestId('social-reply-text-r1'), { target: { value: 'תודה! בהגדרות העסק.' } });
    invoke.mockResolvedValue({ data: { ok: true, status: 'published' }, error: null });
    fireEvent.click(screen.getByTestId('social-reply-approve-r1'));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('agents-room', expect.objectContaining({ body: { action: 'decide', id: 'r1', decision: 'approve', text: 'תודה! בהגדרות העסק.' } })));
  });
});

// Stage 2 of the social agent (Owner console 2026-10-27, typed: "מאשר את שלב 2 של סוכנת הרשתות"): a connected account publishes on
// "approve" - a Facebook page photo post, an Instagram image post through the Israeli page. The page token is only sent to Meta; a
// failure leaves the post ready for a manual publication; only the request that won the approval publishes.
import { describe, it, expect, vi } from 'vitest';
import { publishToMeta, facebookMessage, instagramCaption, imageUrl, TARGETS, GRAPH, CHANNELS } from './social.ts';
import { handle, type StageDeps, type Action } from './manager.ts';

const payload = { channel: 'fb_il', network: 'facebook', market: 'il', text: 'הצעת מחיר ברורה בכמה דקות.', hashtags: ['#הצעת_מחיר', '#TEKANGO'], link: 'https://www.tekango.com/he', art: 'quote' };
const ok = (j: unknown) => new Response(JSON.stringify(j), { status: 200 });
const form = (init?: RequestInit) => Object.fromEntries(new URLSearchParams(String(init?.body ?? '')));

describe('the Meta publication', () => {
  it('the connected accounts: Facebook Israel, Facebook international, Instagram Israel and international - TikTok stays manual', () => {
    expect(Object.keys(TARGETS).sort()).toEqual(['fb_il', 'fb_intl', 'ig_il', 'ig_intl']);
    expect(CHANNELS.find((c) => c.id === 'fb_intl')!.accountOpen).toBe(true);
    expect(TARGETS.ig_il).toMatchObject({ kind: 'instagram', tokenEnv: 'META_PAGE_IL_TOKEN' });
    expect(TARGETS.ig_intl).toEqual({ kind: 'instagram', igUserId: '17841422352275530', tokenEnv: 'META_PAGE_INTL_TOKEN' });
    expect(CHANNELS.find((c) => c.id === 'ig_intl')!.accountOpen).toBe(true);
  });

  it('Facebook: one photo post with the square image and the text, hashtags and link; the address of the new post comes back', async () => {
    const f = vi.fn(async () => ok({ id: 'photo1', post_id: '1381375051729705_99' }));
    const r = await publishToMeta(f, (n) => (n === 'META_PAGE_IL_TOKEN' ? 'PAGE-TOKEN' : ''), 'fb_il', payload);
    expect(r).toEqual({ id: '1381375051729705_99', url: 'https://www.facebook.com/1381375051729705_99' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${GRAPH}/1381375051729705/photos`);
    expect(form(init)).toEqual({ url: 'https://www.tekango.com/social/art/quote.jpg', message: facebookMessage(payload), access_token: 'PAGE-TOKEN' });
    expect(facebookMessage(payload)).toBe('הצעת מחיר ברורה בכמה דקות.\n\n#הצעת_מחיר #TEKANGO\n\nhttps://www.tekango.com/he');
  });

  it('Instagram: create the media, publish it, read its permalink; the caption has no link', async () => {
    const calls: string[] = [];
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url.split('?')[0]);
      if (url.endsWith('/media')) { expect(form(init)).toMatchObject({ image_url: imageUrl('quote'), caption: instagramCaption(payload) }); return ok({ id: 'container1' }); }
      if (url.endsWith('/media_publish')) { expect(form(init).creation_id).toBe('container1'); return ok({ id: 'media1' }); }
      return ok({ permalink: 'https://www.instagram.com/p/ABC/' });
    });
    const r = await publishToMeta(f, () => 'PAGE-TOKEN', 'ig_il', { ...payload, channel: 'ig_il' });
    expect(r).toEqual({ id: 'media1', url: 'https://www.instagram.com/p/ABC/' });
    expect(calls).toEqual([`${GRAPH}/17841431179031610/media`, `${GRAPH}/17841431179031610/media_publish`, `${GRAPH}/media1`]);
    expect(instagramCaption(payload)).not.toMatch(/https?:/);
  });

  it('a Meta error, a missing token or an unconnected account fails with a code - never with the token in it', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { code: 190, message: 'Invalid OAuth access token PAGE-TOKEN' } }), { status: 400 }));
    await expect(publishToMeta(f, () => 'PAGE-TOKEN', 'fb_intl', payload)).rejects.toThrow(/^meta_400_190$/);
    await expect(publishToMeta(f, () => '', 'fb_intl', payload)).rejects.toThrow('not_configured');
    await expect(publishToMeta(f, () => 'PAGE-TOKEN', 'tt_il', payload)).rejects.toThrow('not_connected');
    expect(imageUrl('../../etc')).toBe('https://www.tekango.com/social/art/quote.jpg');
  });
});

describe('approve = publish, for a connected account', () => {
  function deps(over: Partial<StageDeps> = {}) {
    const actions = new Map<string, Action>();
    actions.set('a1', { id: 'a1', created_at: '2026-11-01T05:30:00Z', run_key: 'k', source: 'social', kind: 'system', action_type: 'social_post', title_he: 'פוסט', title_en: 'Post',
      detail_he: null, detail_en: null, payload: { ...payload }, status: 'proposed', decided_at: null, done_at: null, result: {}, error: null } as Action);
    const d = {
      actions,
      caller: vi.fn(async () => 'admin' as const), can: vi.fn(async () => true), now: () => new Date('2026-11-01T06:00:00Z'),
      connectedChannels: () => ['fb_il', 'fb_intl', 'ig_il'],
      publishSocial: vi.fn(async () => ({ id: 'p1', url: 'https://www.facebook.com/p1' })),
      getAction: vi.fn(async (id: string) => actions.get(id) ?? null),
      // like the database: a conditional write, and a time read back in its own spelling (+00:00)
      updateAction: vi.fn(async (id: string, patch: Record<string, unknown>, when?: string, whenDecidedAt?: string) => {
        const a = actions.get(id)!;
        if (when && a.status !== when) return;
        if (whenDecidedAt !== undefined && Date.parse(String(a.decided_at)) !== Date.parse(whenDecidedAt)) return;
        Object.assign(a, patch, typeof patch.decided_at === 'string' ? { decided_at: new Date(patch.decided_at).toISOString().replace('Z', '+00:00') } : {});
      }),
      ...over,
    } as unknown as StageDeps & { actions: Map<string, Action> };
    return d;
  }
  const paths = async () => ['/he'];

  it('publishes once and closes the post with the link', async () => {
    const d = deps();
    const r = await handle({ action: 'decide', id: 'a1', decision: 'approve' }, d, paths);
    expect(r.body).toEqual({ ok: true, status: 'published', url: 'https://www.facebook.com/p1' });
    expect(d.publishSocial).toHaveBeenCalledTimes(1);
    expect(d.actions.get('a1')).toMatchObject({ status: 'done', result: { published: true, auto: true, url: 'https://www.facebook.com/p1' }, error: null });
    expect((await handle({ action: 'decide', id: 'a1', decision: 'approve' }, d, paths)).status).toBe(409); // never twice
    expect(d.publishSocial).toHaveBeenCalledTimes(1);
  });

  it('a failure leaves the post approved (ready for a manual publication) with the reason', async () => {
    const d = deps({ publishSocial: vi.fn(async () => { throw new Error('meta_400_190'); }) });
    const r = await handle({ action: 'decide', id: 'a1', decision: 'approve' }, d, paths);
    expect(r.body).toEqual({ ok: true, status: 'ready', publishError: 'publish_failed: meta_400_190' });
    expect(d.actions.get('a1')).toMatchObject({ status: 'approved', error: 'publish_failed: meta_400_190' });
    expect((await handle({ action: 'mark_done', id: 'a1' }, d, paths)).body).toMatchObject({ ok: true }); // published by hand
  });

  it('an account that is not connected (TikTok) only becomes ready - nothing is sent to Meta', async () => {
    const d = deps();
    d.actions.get('a1')!.payload = { ...payload, channel: 'tt_il', network: 'tiktok' };
    expect((await handle({ action: 'decide', id: 'a1', decision: 'approve' }, d, paths)).body).toEqual({ ok: true, status: 'ready' });
    expect(d.publishSocial).not.toHaveBeenCalled();
  });

  it('a second approval racing the first does not publish again (the stored claim is the first one)', async () => {
    const d = deps();
    (d.getAction as ReturnType<typeof vi.fn>).mockImplementationOnce(async (id: string) => d.actions.get(id) ?? null)
      .mockImplementationOnce(async (id: string) => ({ ...d.actions.get(id)!, error: 'publishing:the-other-request' }));
    expect((await handle({ action: 'decide', id: 'a1', decision: 'approve' }, d, paths)).status).toBe(409);
    expect(d.publishSocial).not.toHaveBeenCalled();
  });

  it('the database spelling of the decision time (+00:00) does not stop the publication (the live failure of 2026-10-27)', async () => {
    const d = deps();
    expect((await handle({ action: 'decide', id: 'a1', decision: 'approve' }, d, paths)).body).toMatchObject({ ok: true, status: 'published' });
    expect(d.publishSocial).toHaveBeenCalledTimes(1);
    expect(d.actions.get('a1')!.decided_at).toBe('2026-11-01T06:00:00.000+00:00');
  });

describe('"publish now" - an approved post of a connected account that was not published', () => {
  const ready = (over: Partial<Action> = {}) => {
    const d = deps();
    Object.assign(d.actions.get('a1')!, { status: 'approved', decided_at: '2026-11-01T05:50:00.000+00:00', error: null }, over);
    return d;
  };

  it('publishes once and closes the post with the link', async () => {
    const d = ready();
    expect((await handle({ action: 'publish_now', id: 'a1' }, d, paths)).body).toEqual({ ok: true, status: 'published', url: 'https://www.facebook.com/p1' });
    expect(d.actions.get('a1')).toMatchObject({ status: 'done', result: { published: true, auto: true }, error: null });
    expect((await handle({ action: 'publish_now', id: 'a1' }, d, paths)).status).toBe(409);
    expect(d.publishSocial).toHaveBeenCalledTimes(1);
  });

  it('a double press publishes once (the second claim is written only while the decision time is still the one it read)', async () => {
    const d = ready({ error: 'publish_failed: meta_400_190' });
    const [x, y] = await Promise.all([handle({ action: 'publish_now', id: 'a1' }, d, paths), handle({ action: 'publish_now', id: 'a1' }, d, paths)]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    expect(d.publishSocial).toHaveBeenCalledTimes(1);
  });

  it('a failure leaves it ready with the reason, and it can be pressed again', async () => {
    const d = ready();
    (d.publishSocial as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('meta_400_190'));
    expect((await handle({ action: 'publish_now', id: 'a1' }, d, paths)).body).toEqual({ ok: true, status: 'ready', publishError: 'publish_failed: meta_400_190' });
    expect(d.actions.get('a1')).toMatchObject({ status: 'approved', error: 'publish_failed: meta_400_190' });
    expect((await handle({ action: 'publish_now', id: 'a1' }, d, paths)).body).toMatchObject({ ok: true, status: 'published' });
    expect(d.publishSocial).toHaveBeenCalledTimes(2);
  });

  it('refused: a publication under way, a post not yet approved, an account that is not connected', async () => {
    expect((await handle({ action: 'publish_now', id: 'a1' }, ready({ error: 'publishing:x', decided_at: '2026-11-01T05:59:00.000+00:00' }), paths)).body).toEqual({ ok: false, code: 'publishing' });
    const stale = ready({ error: 'publishing:x', decided_at: '2026-11-01T05:50:00.000+00:00' }); // a claim older than two minutes
    expect((await handle({ action: 'publish_now', id: 'a1' }, stale, paths)).status).toBe(200);
    expect((await handle({ action: 'publish_now', id: 'a1' }, ready({ status: 'proposed' }), paths)).body).toEqual({ ok: false, code: 'not_ready' });
    const tiktok = ready();
    tiktok.actions.get('a1')!.payload = { ...payload, channel: 'tt_il', network: 'tiktok' };
    expect((await handle({ action: 'publish_now', id: 'a1' }, tiktok, paths)).body).toEqual({ ok: false, code: 'not_ready' });
  });

  it('a supervisor needs both social permissions', async () => {
    const yes = ready({});
    (yes.caller as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect((await handle({ action: 'publish_now', id: 'a1' }, yes, paths)).status).toBe(200);
    const no = ready({});
    (no.caller as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (no.can as ReturnType<typeof vi.fn>).mockImplementation(async (k: string) => k === 'social.view');
    expect((await handle({ action: 'publish_now', id: 'a1' }, no, paths)).status).toBe(403);
    expect(no.publishSocial).not.toHaveBeenCalled();
  });
});
});

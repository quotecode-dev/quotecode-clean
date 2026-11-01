// Codex release 8 + the Owner's addition (Owner 2026-10-30): post results and replies to comments - a draft waits for the Owner, a
// sensitive comment gets none, nothing is published without approval. SYNTHETIC Graph answers; nothing leaves the test.
import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import { postMetrics, postComments, isSensitive, replyErrors, draftReplies, replyAction, publishReply, metricsSummary, type Graph } from './socialReplies';
import { socialDaily, decide, publishedPosts } from './manager';

const P = { actionId: 'a1', channel: 'fb_il', network: 'facebook' as const, market: 'il' as const, postId: '1381375051729705_99' };
const graphOf = (answers: Record<string, { ok: boolean; status: number; json: unknown }>): Graph & { calls: string[] } => {
  const calls: string[] = [];
  const g = (async (_c: string, method: string, path: string) => { calls.push(`${method} ${path}`); return answers[`${method} ${path}`] ?? { ok: false, status: 403, json: { error: { code: 10 } } }; }) as Graph & { calls: string[] };
  g.calls = calls;
  return g;
};

describe('post results', () => {
  it('counts come from the publishing permissions; reach missing = unavailable, never 0', async () => {
    const g = graphOf({ [`GET ${P.postId}`]: { ok: true, status: 200, json: { reactions: { summary: { total_count: 7 } }, comments: { summary: { total_count: 2 } }, shares: { count: 1 } } } });
    expect(await postMetrics(g, P)).toEqual({ actionId: 'a1', network: 'facebook', likes: 7, comments: 2, shares: 1, reach: null, reachAvailable: false });
    const ig = graphOf({ 'GET 555': { ok: true, status: 200, json: { like_count: 4, comments_count: 0 } }, 'GET 555/insights': { ok: true, status: 200, json: { data: [{ values: [{ value: 90 }] }] } } });
    expect(await postMetrics(ig, { ...P, network: 'instagram', channel: 'ig_il', postId: '555' })).toMatchObject({ likes: 4, comments: 0, reach: 90, reachAvailable: true });
  });
});

// Codex review 2026-10-31 F17 / F18 (Owner-typed, L-22 named)
describe('unavailable is never zero; the summary for Shira and Noa', () => {
  it('a failed read or a null value stays null, never a measured 0', async () => {
    expect(await postMetrics(graphOf({}), P)).toMatchObject({ likes: null, comments: null, shares: null, reach: null, reachAvailable: false });
    const g = graphOf({ [`GET ${P.postId}`]: { ok: true, status: 200, json: { reactions: { summary: { total_count: null } }, comments: { summary: {} } } },
      [`GET ${P.postId}/insights`]: { ok: true, status: 200, json: { data: [{ values: [{ value: null }] }] } } });
    expect(await postMetrics(g, P)).toMatchObject({ likes: null, comments: null, shares: 0, reach: null, reachAvailable: false });
  });
  it('sums measured values only and counts the posts without data', () => {
    const m = metricsSummary([
      { actionId: 'a', network: 'facebook', likes: 3, comments: 1, shares: null, reach: 40, reachAvailable: true },
      { actionId: 'b', network: 'facebook', likes: null, comments: null, shares: null, reach: null, reachAvailable: false },
      { actionId: 'c', network: 'instagram', likes: 5, comments: 0, shares: null, reach: null, reachAvailable: false },
    ]);
    expect(m).toEqual({ facebook: { posts: 2, unavailable: 1, likes: 3, comments: 1, shares: null, reach: 40 }, instagram: { posts: 1, unavailable: 0, likes: 5, comments: 0, shares: null, reach: null } });
  });
});

describe('comments and replies', () => {
  const comments = { [`GET ${P.postId}/comments`]: { ok: true, status: 200, json: { data: [
    { id: 'c1', message: 'איך מוסיפים לוגו?', from: { id: 'u1', name: 'דנה' }, created_time: '2026-11-04T08:00:00Z' },
    { id: 'c2', message: 'אני רוצה החזר כספי', from: { id: 'u2', name: 'רון' } },
    { id: 'c3', message: 'תודה!', from: { id: '1381375051729705', name: 'Tekango ישראל' } },
  ] } } };
  it('our own comments are skipped; a refused call (no permission) is no comments', async () => {
    const list = await postComments(graphOf(comments), P);
    expect(list.map((c) => c.commentId)).toEqual(['c1', 'c2']);
    expect(await postComments(graphOf({}), P)).toEqual([]);
  });
  it('a money / cancel / privacy / complaint comment is sensitive (no draft); the title never carries the comment', () => {
    expect(isSensitive('אני רוצה החزר כספי'.replace('ز', 'ז'))).toBe(true);
    expect(isSensitive('איך מוסיפים לוגו?')).toBe(false);
    const a = replyAction('daily:2026-11-04', { channel: 'fb_il', network: 'facebook', market: 'il', postId: 'p', postActionId: 'a1', commentId: 'c2', text: 'אני רוצה החזר', author: 'רון', createdAt: '' }, 'טיוטה');
    expect(a.payload).toMatchObject({ sensitive: true, draft: null, comment_text: 'אני רוצה החזר' });
    expect(a.title_he).not.toContain('החזר');
    expect(a.dedupe_key).toBe('reply:c2');
  });
  it('a reply is only in its account\'s language, short, without prices', () => {
    expect(replyErrors('תודה! אפשר להוסיף לוגו בהגדרות העסק ב-TEKANGO.', 'il')).toEqual([]);
    expect(replyErrors('Thanks for asking', 'il')).toContain('english_in_hebrew');
    expect(replyErrors('תודה', 'intl')).toContain('hebrew_in_english');
    expect(replyErrors('Only $9 today', 'intl')).toContain('commercial_claim');
  });
  it('one AI call drafts the calm comments; an invalid draft is dropped', async () => {
    const complete = vi.fn(async () => ({ content: JSON.stringify({ replies: [{ comment_id: 'c1', reply: 'בהגדרות העסק יש שדה לוגו.' }, { comment_id: 'c9', reply: 'x' }] }), promptTokens: 10, completionTokens: 5 }));
    const r = await draftReplies(complete, [{ channel: 'fb_il', network: 'facebook', market: 'il', postId: 'p', postActionId: 'a', commentId: 'c1', text: 'לוגו?', author: '', createdAt: '' }], { run: 'k' });
    expect(complete).toHaveBeenCalledTimes(1);
    expect([...r.drafts]).toEqual([['c1', 'בהגדרות העסק יש שדה לוגו.']]);
  });
  it('a reply is published under the comment (Facebook comments / Instagram replies); a refusal is definite', async () => {
    const g = graphOf({ 'POST c1/comments': { ok: true, status: 200, json: { id: 'r1' } }, 'POST c7/replies': { ok: true, status: 200, json: { id: 'r7' } } });
    expect(await publishReply(g, 'fb_il', 'facebook', 'c1', 'תודה')).toBe('r1');
    expect(await publishReply(g, 'ig_il', 'instagram', 'c7', 'תודה')).toBe('r7');
    await expect(publishReply(g, 'fb_il', 'facebook', 'c2', 'תודה')).rejects.toMatchObject({ definite: true });
  });
});

// ---- the manager side
function stage(over: Record<string, unknown> = {}) {
  const actions: Record<string, unknown>[] = [];
  const updates: unknown[] = [];
  const d = {
    now: () => new Date('2026-11-04T09:00:00Z'),
    recentActions: async () => [{ id: 'a1', action_type: 'social_post', status: 'done', payload: { channel: 'fb_il', market: 'il' }, result: { id: P.postId }, done_at: '2026-11-03T09:00:00Z', created_at: '2026-11-03T09:00:00Z' }],
    replyActions: async () => [{ payload: { comment_id: 'c-old' } }],
    graph: graphOf({ [`GET ${P.postId}/comments`]: { ok: true, status: 200, json: { data: [{ id: 'c1', message: 'איך מוסיפים לוגו?', from: { id: 'u1', name: 'דנה' } }, { id: 'c2', message: 'אני רוצה החזר', from: { id: 'u2', name: 'רון' } }] } } }),
    saveMetrics: vi.fn(async () => {}),
    purgeReplyTexts: vi.fn(async () => 2),
    complete: vi.fn(async () => ({ content: JSON.stringify({ replies: [{ comment_id: 'c1', reply: 'בהגדרות העסק יש שדה לוגו.' }] }), promptTokens: 1, completionTokens: 1 })),
    insertAction: vi.fn(async (a: Record<string, unknown>) => { actions.push(a); return `x${actions.length}`; }),
    claim: async () => 'run', finish: async () => {},
    getAction: vi.fn(), updateAction: vi.fn(async (...a: unknown[]) => { updates.push(a); }),
    ...over,
  };
  return { d: d as never, actions, updates };
}

describe('the daily social step and the approval', () => {
  it('new comments become waiting replies (sensitive without a draft); texts older than 30 days are purged; nothing is published', async () => {
    const { d, actions } = stage();
    const r = await socialDaily(d, 'daily:2026-11-04');
    expect(r).toMatchObject({ metrics: 1, comments: 2, drafted: 1, purged: 2 });
    expect(actions.map((a) => [(a.payload as Record<string, unknown>).comment_id, (a.payload as Record<string, unknown>).draft])).toEqual([['c1', 'בהגדרות העסק יש שדה לוגו.'], ['c2', null]]);
    expect((d as { graph: { calls: string[] } }).graph.calls.some((c) => c.startsWith('POST'))).toBe(false);
    expect(publishedPosts([], new Date())).toEqual([]);
  });
  it('approval publishes the approved text once; an invalid text is refused; a definite failure returns it to the waiting list', async () => {
    const pending = { id: 'r1', action_type: 'social_reply', kind: 'system', status: 'proposed', payload: { channel: 'fb_il', market: 'il', comment_id: 'c1', draft: 'טיוטה טובה' } };
    let current: Record<string, unknown> = { ...pending };
    const { d, updates } = stage({
      getAction: vi.fn(async () => current),
      updateAction: vi.fn(async (_id: string, patch: Record<string, unknown>) => { updates.push(patch); current = { ...current, ...patch }; }),
      graph: graphOf({ 'POST c1/comments': { ok: true, status: 200, json: { id: 'rr' } } }),
    });
    expect((await decide(d, { id: 'r1', decision: 'approve', text: 'Hello there' }, [])).body).toMatchObject({ ok: false, code: 'reply_invalid' });
    const ok = await decide(d, { id: 'r1', decision: 'approve', text: 'תודה, אפשר להוסיף לוגו בהגדרות העסק.' }, []);
    expect(ok.body).toMatchObject({ ok: true, status: 'published' });
    expect(current).toMatchObject({ status: 'done', result: { published: true, id: 'rr' } });
    current = { ...pending };
    const { d: d2 } = stage({ getAction: vi.fn(async () => current), updateAction: vi.fn(async (_i: string, p: Record<string, unknown>) => { current = { ...current, ...p }; }), graph: graphOf({}) });
    const failed = await decide(d2, { id: 'r1', decision: 'approve' }, []);
    expect(failed.body).toMatchObject({ ok: true, status: 'failed' });
    expect(current.status).toBe('proposed');
  });
  // Codex review 2026-10-31 F16: the published message is exactly the approved text - angle brackets kept, nothing cut silently
  it('F16: publishes the approved text exactly; over 600 characters is refused, never cut', async () => {
    const pending = { id: 'r2', action_type: 'social_reply', kind: 'system', status: 'proposed', payload: { channel: 'fb_intl', market: 'intl', comment_id: 'c9', draft: 'x' } };
    let current: Record<string, unknown> = { ...pending };
    const sent: Record<string, string>[] = [];
    const graph = (async (_c: string, method: string, path: string, params: Record<string, string>) => { if (method === 'POST') { sent.push(params); return { ok: true, status: 200, json: { id: 'p1' } }; } return { ok: false, status: 403, json: {} }; }) as Graph;
    const { d } = stage({ getAction: vi.fn(async () => current), updateAction: vi.fn(async (_i: string, p: Record<string, unknown>) => { current = { ...current, ...p }; }), graph });
    const text = 'Use <name> in the subject line — thanks! 🙏';
    expect((await decide(d, { id: 'r2', decision: 'approve', text }, [])).body).toMatchObject({ ok: true, status: 'published' });
    expect(sent[0].message).toBe(text);
    expect((current.payload as Record<string, unknown>).approved_text).toBe(text);
    current = { ...pending };
    expect((await decide(d, { id: 'r2', decision: 'approve', text: 'a'.repeat(601) }, [])).body).toMatchObject({ ok: false, code: 'reply_invalid' });
    expect(sent).toHaveLength(1);
  });
  it('F19: a failed purge marks the daily step failed (the monitor sees it)', async () => {
    const { d } = stage({ purgeReplyTexts: vi.fn(async () => { throw new Error('db'); }) });
    expect(await socialDaily(d, 'daily:2026-11-04')).toMatchObject({ purged: 0, purgeFailed: true, failed: true });
  });
});

describe('F18 / F19 wiring', () => {
  const src = (p: string) => readFileSync(`supabase/functions/${p}`, 'utf8');
  it('Shira and Noa receive the post results; the monitor tick purges the old comment texts', () => {
    expect(src('agents-room/social.ts')).toContain('postResults: metricsSummary(d.postMetricsRows ? await d.postMetricsRows().catch(() => []) : [])');
    expect(src('agents-room/manager.ts')).toContain('postResults: metricsSummary(d.postMetricsRows ? await d.postMetricsRows().catch(() => []) : []),');
    expect(src('scheduled-health/index.ts')).toContain("await admin.rpc('agents_purge_reply_texts')");
  });
});

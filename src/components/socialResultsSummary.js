// Owner console 2026-11-02 (the plan for Shira): what catches on, for AdminSocialResults.
export const engagement = (r) => (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0);

/** Averages over measured values only: a value the network did not return is not a zero. */
export function summarize(rows) {
  const groups = new Map();
  for (const r of rows) { const k = `${r.network}|${r.market}|${r.kind}`; groups.set(k, [...(groups.get(k) || []), r]); }
  return [...groups.entries()].map(([k, list]) => {
    const [network, market, kind] = k.split('|');
    const viewed = list.filter((r) => r.views !== null && r.views !== undefined);
    return { key: k, network, market, kind, posts: list.length, avgViews: viewed.length ? Math.round(viewed.reduce((a, r) => a + r.views, 0) / viewed.length) : null,
      avgEngagement: Math.round((list.reduce((a, r) => a + engagement(r), 0) / list.length) * 10) / 10 };
  }).sort((a, b) => b.avgEngagement - a.avgEngagement);
}

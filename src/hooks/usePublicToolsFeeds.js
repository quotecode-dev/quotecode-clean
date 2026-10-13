// Task 36 (L4): the two public data providers of the tools pages, each with its OWN state (see publicToolsCore.feedState).
// A cached fetch younger than 10 minutes is reused; otherwise both providers are asked (8 s bound each). A provider that fails falls back
// to its own previously cached data, shown as STALE with that data's provider time; with nothing cached it is UNAVAILABLE - a fixed seed
// number is never shown. The fetch time is kept only to decide freshness; the time shown to the user is always the provider's.
import { useEffect, useState } from 'react';
import {
  currencyUrl, CRYPTO_URL, normalizeCurrencyResponse, normalizeCryptoResponse, readToolsCache, writeToolsCache, feedState, FRESH_FOR_MS, entryFetchedAt,
} from '../utils/publicToolsCore';

const TIMEOUT_MS = 8000;
async function getJson(url) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: abort.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}
const storage = () => { try { return globalThis.localStorage; } catch { return null; } };

export function usePublicToolsFeeds({ base, cacheKey }) {
  const [feeds, setFeeds] = useState(() => {
    const cache = readToolsCache(storage(), cacheKey);
    const fresh = (name) => cache?.[name] && Date.now() - entryFetchedAt(cache, name) < FRESH_FOR_MS;
    return {
      currency: fresh('currency') ? { status: 'cached', data: cache.currency } : { status: 'loading', data: null },
      crypto: fresh('crypto') ? { status: 'cached', data: cache.crypto } : { status: 'loading', data: null },
    };
  });

  useEffect(() => {
    let alive = true;
    const cache = readToolsCache(storage(), cacheKey);
    const now = Date.now();
    const fresh = (name) => cache?.[name] && now - entryFetchedAt(cache, name) < FRESH_FOR_MS;
    const ask = async (name, url, normalize) => {
      if (fresh(name)) return { name, ok: true, data: cache[name], reused: true };
      try {
        const data = normalize(await getJson(url));
        return data ? { name, ok: true, data } : { name, ok: false };
      } catch { return { name, ok: false }; }
    };
    Promise.all([
      ask('currency', currencyUrl(base), (j) => normalizeCurrencyResponse(j, base)),
      ask('crypto', CRYPTO_URL, normalizeCryptoResponse),
    ]).then((results) => {
      if (!alive) return;
      const next = {};
      const toCache = { currency: cache?.currency ? { ...cache.currency, fetchedAt: entryFetchedAt(cache, 'currency') } : undefined, crypto: cache?.crypto ? { ...cache.crypto, fetchedAt: entryFetchedAt(cache, 'crypto') } : undefined };
      let fetchedSomething = false;
      for (const r of results) {
        if (r.ok && r.reused) next[r.name] = { status: 'cached', data: r.data };
        else if (r.ok) { next[r.name] = feedState({ live: r.data }); toCache[r.name] = { ...r.data, fetchedAt: now }; fetchedSomething = true; }
        else next[r.name] = feedState({ cached: cache?.[r.name] || null, fetchedAt: entryFetchedAt(cache, r.name), now, failed: true });
      }
      if (fetchedSomething) writeToolsCache(storage(), cacheKey, toCache);
      setFeeds(next);
    });
    return () => { alive = false; };
  }, [base, cacheKey]);

  return feeds;
}

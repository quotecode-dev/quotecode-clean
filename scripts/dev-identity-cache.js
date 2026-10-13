// TEST 5186 working-preview identity cache (incident 2026-10-09: CPU / taskbar-focus feedback loop).
// The dev /version.json used to recompute sourceIdentity() - four Git processes plus hashing every build input - on EVERY request.
// On Windows each Git spawn surfaced a console, the focus change made the open tab re-check /version.json, and the loop pinned the CPU.
// Now the identity is computed once at server start and recomputed only after a relevant change:
//   - add/change/unlink of a file under BUILD_INPUT_ROOTS (Vite's own watcher), or the root .gitignore;
//   - Git metadata of the (possibly linked) worktree: HEAD, index, the active branch ref and packed-refs (fs.watch, no Git spawn).
// Changes only mark the cache stale; the next request runs ONE recompute that concurrent requests share (single-flight).
// Fail closed: while the Git metadata watchers are not ALL armed (setup failure or a later watcher error), the service is
// UNAVAILABLE - /version.json answers 503 without computing, never a cached identity that could hide a later HEAD/index/ref
// change. Recovery is bounded (RECOVERY_DELAYS_MS, then unavailable until restart) and only a complete re-arm restores service,
// followed by one recompute.
// Applies only to the dirty dev working preview; frozen builds keep their static dist/version.json.
import { existsSync, readFileSync, statSync, watch as fsWatch } from 'node:fs';
import { dirname, basename, isAbsolute, join, relative, resolve } from 'node:path';
import { BUILD_INPUT_ROOTS } from './build-identity.js';

const FILE_EVENTS = new Set(['add', 'change', 'unlink']);
const EXTRA_RELEVANT_FILES = ['.gitignore'];
export const RECOVERY_DELAYS_MS = Object.freeze([1000, 2000, 5000, 10000, 30000, 60000]);

export class IdentityUnavailableError extends Error {
  constructor(reason) {
    super(`working-tree identity unavailable: ${reason}`);
    this.code = 'IDENTITY_UNAVAILABLE';
  }
}

export function createIdentityCache({ initial, compute }) {
  let value = initial;
  let stale = initial === undefined;
  let generation = 0;
  let inFlight = null;
  let inFlightGeneration = -1;
  const stats = { computes: 0, invalidations: 0 };
  return {
    stats,
    isStale: () => stale,
    invalidate() { generation += 1; stale = true; stats.invalidations += 1; },
    get() {
      if (!stale) return Promise.resolve(value);
      if (inFlight && inFlightGeneration === generation) return inFlight;
      // A compute that started before the latest invalidation is outdated: never join it. Queue ONE fresh compute behind it,
      // so two identity computations never run at once.
      const startedAt = generation;
      stats.computes += 1;
      const tracked = (inFlight ? inFlight.then(() => {}, () => {}) : Promise.resolve())
        .then(compute)
        .then((next) => {
          value = next;
          // A change that arrived while computing keeps the cache stale, so the next request picks it up.
          if (startedAt === generation) stale = false;
          return next;
        })
        .finally(() => { if (inFlight === tracked) inFlight = null; });
      inFlight = tracked;
      inFlightGeneration = startedAt;
      return tracked;
    },
  };
}

export function isBuildInputPath(root, file) {
  if (!file) return false;
  const rel = relative(root, String(file));
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return false;
  const normalized = rel.replace(/\\/g, '/');
  const caseFold = process.platform === 'win32' ? (s) => s.toLowerCase() : (s) => s;
  const target = caseFold(normalized);
  return [...BUILD_INPUT_ROOTS, ...EXTRA_RELEVANT_FILES].some((r) => {
    const root = caseFold(r);
    return target === root || target.startsWith(`${root}/`);
  });
}

// Resolves the Git directories from files only (no Git process): a linked worktree has a `.git` FILE pointing at
// <common>/.git/worktrees/<name>, whose `commondir` points back at the shared repository holding refs and packed-refs.
// Throws when the metadata cannot be read, so the caller fails closed instead of arming a partial watch set.
export function resolveGitMetadata(root) {
  const dotGit = join(root, '.git');
  if (!existsSync(dotGit)) throw new Error('no .git');
  let gitDir = dotGit;
  if (!statSync(dotGit).isDirectory()) {
    const m = readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)\s*$/m);
    if (!m) throw new Error('unreadable .git file');
    gitDir = resolve(root, m[1].trim());
  }
  const commonFile = join(gitDir, 'commondir');
  const commonDir = existsSync(commonFile) ? resolve(gitDir, readFileSync(commonFile, 'utf8').trim()) : gitDir;
  const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
  const activeRef = head.startsWith('ref: ') ? head.slice(5).trim() : null; // detached HEAD: HEAD itself carries the sha
  return { gitDir, commonDir, activeRef };
}

// handlers.onChange(reason)     - a watched Git metadata file changed (all watchers healthy);
// handlers.onUnavailable(reason) - monitoring is down: every watcher of the set has been closed;
// handlers.onRecovered()         - a complete re-arm succeeded after onUnavailable.
export function watchGitMetadata(root, handlers, {
  watch = fsWatch, warn = console.warn, setTimer = setTimeout, clearTimer = clearTimeout, recoveryDelaysMs = RECOVERY_DELAYS_MS,
} = {}) {
  const { onChange = () => {}, onUnavailable = () => {}, onRecovered = () => {} } = handlers || {};
  let watchers = [];
  let closed = false;
  let healthy = false;
  let retryTimer = null;
  let attempt = 0;
  const closeAll = () => { const all = watchers; watchers = []; for (const w of all) { try { w.close(); } catch { /* already closed */ } } };
  const scheduleRecovery = () => {
    if (closed || retryTimer) return;
    if (attempt >= recoveryDelaysMs.length) { warn('[dev-identity] Git metadata monitoring unavailable; recovery attempts exhausted - restart the dev server'); return; }
    const delay = recoveryDelaysMs[attempt];
    attempt += 1;
    retryTimer = setTimer(() => {
      retryTimer = null;
      if (arm()) { attempt = 0; onRecovered(); }
    }, delay);
    retryTimer?.unref?.();
  };
  const fail = (reason) => {
    closeAll();
    healthy = false;
    warn(`[dev-identity] Git metadata monitoring unavailable (${reason}); /version.json answers 503 until it is re-armed`);
    onUnavailable(reason);
    scheduleRecovery();
  };
  // Arms the complete watcher set or none of it. Returns true only when every watcher is armed.
  function arm() {
    closeAll();
    if (closed) return false;
    let meta;
    try { meta = resolveGitMetadata(root); } catch (err) { fail(`resolve: ${err?.message || err}`); return false; }
    const targets = new Map();
    const add = (dir, name) => { if (!targets.has(dir)) targets.set(dir, new Set()); targets.get(dir).add(name); };
    add(meta.gitDir, 'HEAD');
    add(meta.gitDir, 'index');
    add(meta.commonDir, 'packed-refs');
    if (meta.activeRef) add(join(meta.commonDir, dirname(meta.activeRef)), basename(meta.activeRef));
    const armed = [];
    for (const [dir, names] of targets) {
      let w;
      try {
        w = watch(dir, { persistent: false }, (_event, name) => {
          if (!watchers.includes(w)) return; // event from a set that was already replaced or closed
          const file = name == null ? null : String(name);
          if (file !== null && !names.has(file)) return;
          // HEAD may now point at another branch: re-arm so the new active ref is the one watched.
          if (file === null || (dir === meta.gitDir && file === 'HEAD')) { if (!arm()) return; }
          onChange(file || 'unknown');
        });
        w.on('error', (err) => { if (watchers.includes(w)) fail(`watch error: ${err?.message || err}`); });
      } catch (err) {
        for (const x of armed) { try { x.close(); } catch { /* already closed */ } }
        fail(`cannot watch: ${err?.message || err}`);
        return false;
      }
      armed.push(w);
    }
    watchers = armed;
    healthy = true;
    return true;
  }
  arm();
  return {
    isHealthy: () => healthy,
    close() { closed = true; healthy = false; if (retryTimer) { clearTimer(retryTimer); retryTimer = null; } closeAll(); },
  };
}

export function createDevIdentityService({ root, initial, compute, watcher, watchGit = watchGitMetadata, watchOptions }) {
  const cache = createIdentityCache({ initial, compute });
  let unavailableReason = null;
  // Monotonic monitor epoch: bumped on every transition to unavailable and on every recovery. A request whose epoch changed
  // while it waited crossed an outage, so its result is never served - even when monitoring has recovered meanwhile.
  let epoch = 0;
  const onFileEvent = (event, file) => {
    if (FILE_EVENTS.has(event) && isBuildInputPath(root, file)) cache.invalidate();
  };
  watcher?.on('all', onFileEvent);
  const git = watchGit(root, {
    onChange: () => cache.invalidate(),
    onUnavailable: (reason) => { epoch += 1; unavailableReason = String(reason || 'git metadata monitoring unavailable'); cache.invalidate(); },
    onRecovered: () => { epoch += 1; cache.invalidate(); unavailableReason = null; },
  }, watchOptions);
  const unavailable = (reason = unavailableReason) => new IdentityUnavailableError(reason);
  return {
    cache,
    isAvailable: () => unavailableReason === null,
    get() {
      if (unavailableReason !== null) return Promise.reject(unavailable());
      const startedEpoch = epoch;
      // Monitoring may drop (and even recover) while a recompute runs: never hand out that result as current.
      return cache.get().then((value) => {
        if (unavailableReason !== null) throw unavailable();
        if (epoch !== startedEpoch) throw unavailable('git metadata monitoring was interrupted during this request');
        return value;
      });
    },
    close() { watcher?.off?.('all', onFileEvent); git?.close?.(); },
  };
}

// /version.json handler for the dev working preview: 200 with the cached identity, or 503 fail-closed.
export function createVersionJsonMiddleware(service, decorate) {
  return (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    service.get().then(
      (identity) => res.end(JSON.stringify(decorate(identity), null, 2)),
      (err) => {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: 'working-tree identity unavailable', reason: err?.code === 'IDENTITY_UNAVAILABLE' ? 'git-metadata-monitoring-unavailable' : 'identity-recompute-failed', servesWorkingTree: true }));
      },
    );
  };
}

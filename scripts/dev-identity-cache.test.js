// @vitest-environment node
// TEST 5186 CPU / taskbar-focus loop incident (2026-10-09): the dev /version.json must never run Git or hash build inputs per
// request. Proves: zero recomputes for unchanged state, one recompute per relevant change batch (build inputs, HEAD, index,
// active ref), single-flight for concurrent requests, irrelevant paths ignored and every Git child hidden on Windows.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceIdentity } from './build-identity.js';
import { createIdentityCache, createDevIdentityService, createVersionJsonMiddleware, isBuildInputPath, resolveGitMetadata, watchGitMetadata, RECOVERY_DELAYS_MS } from './dev-identity-cache.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, execFileSync: vi.fn(actual.execFileSync) };
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const realGit = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=identity-test', '-c', 'user.email=identity-test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', windowsHide: true }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function settle(cache, { timeoutMs = 5000, quietMs = 400 } = {}) {
  const start = Date.now();
  while (!cache.isStale()) {
    if (Date.now() - start > timeoutMs) throw new Error('git metadata change was not observed');
    await sleep(25);
  }
  await sleep(quietMs); // let the rest of the burst arrive so it lands in the same batch
}
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

describe('dev identity cache - unchanged state', () => {
  it('serves 1000 /version.json reads after the start-time identity with 0 recomputes and 0 Git processes', async () => {
    const initial = sourceIdentity(ROOT, 'localtest');
    const watcher = new EventEmitter();
    const service = createDevIdentityService({ root: ROOT, initial, compute: () => sourceIdentity(ROOT, 'localtest'), watcher });
    execFileSync.mockClear();
    try {
      const parallel = await Promise.all(Array.from({ length: 500 }, () => service.cache.get()));
      for (let i = 0; i < 500; i += 1) await service.cache.get();
      expect(parallel.every((v) => v === initial)).toBe(true);
      expect(service.cache.stats.computes).toBe(0);
      expect(execFileSync).not.toHaveBeenCalled();
    } finally { service.close(); }
  });

  it('wires the real Vite dev middleware to the cache: 300 requests run 0 Git processes', async () => {
    const { default: config } = await import('../vite.config.js');
    const resolved = config({ mode: 'identity-test', command: 'serve' });
    const plugin = resolved.plugins.flat().find((p) => p?.name === 'proflow-version-manifest');
    const handlers = {};
    const httpServer = new EventEmitter();
    plugin.configureServer({ watcher: new EventEmitter(), config: { mode: 'identity-test' }, httpServer, middlewares: { use: (p, fn) => { handlers[p] = fn; } } });
    execFileSync.mockClear();
    const request = () => new Promise((resolve) => {
      const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { resolve({ status: this.statusCode, headers: this.headers, body: JSON.parse(body) }); } };
      handlers['/version.json']({}, res);
    });
    const responses = await Promise.all(Array.from({ length: 300 }, request));
    httpServer.emit('close');
    expect(execFileSync).not.toHaveBeenCalled();
    expect(responses.every((r) => r.status === 200 && r.headers['Cache-Control'] === 'no-store' && r.body.servesWorkingTree === true)).toBe(true);
    expect(responses[0].body.buildSha).toMatch(/^[0-9a-f]{40}$/);
    expect(typeof responses[0].body.dirty).toBe('boolean');
  }, 30_000); // imports the real vite.config.js: slow under the release gate load (Owner 2026-10-23)
});

describe('dev identity cache - single-flight and staleness', () => {
  it('concurrent requests while stale share exactly one recompute', async () => {
    const gate = deferred();
    const compute = vi.fn(() => gate.promise);
    const cache = createIdentityCache({ initial: { v: 0 }, compute });
    cache.invalidate();
    const pending = Array.from({ length: 50 }, () => cache.get());
    await Promise.resolve();
    pending.push(...Array.from({ length: 50 }, () => cache.get())); // arrive while the recompute is running
    expect(compute).toHaveBeenCalledTimes(1);
    gate.resolve({ v: 1 });
    const values = await Promise.all(pending);
    expect(values.every((v) => v.v === 1)).toBe(true);
    expect(cache.stats.computes).toBe(1);
    expect(cache.isStale()).toBe(false);
    await Promise.all(Array.from({ length: 100 }, () => cache.get()));
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('a change arriving during a recompute keeps the cache stale for the next request', async () => {
    const gate = deferred();
    let n = 0;
    const cache = createIdentityCache({ initial: { v: 0 }, compute: () => (n += 1) === 1 ? gate.promise : { v: 2 } });
    cache.invalidate();
    const first = cache.get();
    cache.invalidate();
    gate.resolve({ v: 1 });
    expect((await first).v).toBe(1);
    expect(cache.isStale()).toBe(true);
    expect((await cache.get()).v).toBe(2);
    expect(cache.isStale()).toBe(false);
  });

  it('a failed recompute rejects and stays stale (fail closed, never serves a silently stale identity as fresh)', async () => {
    let fail = true;
    const cache = createIdentityCache({ initial: { v: 0 }, compute: () => { if (fail) throw new Error('git unavailable'); return { v: 1 }; } });
    cache.invalidate();
    await expect(cache.get()).rejects.toThrow('git unavailable');
    expect(cache.isStale()).toBe(true);
    fail = false;
    expect((await cache.get()).v).toBe(1);
  });
});

describe('dev identity cache - relevant vs irrelevant file events', () => {
  const root = path.resolve('/repo');
  it('matches only BUILD_INPUT_ROOTS (and the root .gitignore)', () => {
    for (const f of ['src/a.js', 'src/deep/x.test.jsx', 'public/logo.png', 'supabase/functions/x/index.ts', 'supabase/migrations/1.sql', 'index.html', 'package.json', 'package-lock.json', 'vite.config.js', '.gitattributes', '.gitignore']) {
      expect(isBuildInputPath(root, path.join(root, f))).toBe(true);
    }
    for (const f of ['node_modules/react/index.js', 'evidence/r5/shot.png', 'docs/readme.md', 'PROFLOW_TODO.md', 'srcx/a.js', 'supabase/.temp/x.json', 'scripts/build-identity.js', 'dist/index.html']) {
      expect(isBuildInputPath(root, path.join(root, f))).toBe(false);
    }
    expect(isBuildInputPath(root, path.resolve(root, '..', 'other', 'src', 'a.js'))).toBe(false);
    expect(isBuildInputPath(root, '')).toBe(false);
  });

  it('irrelevant add/change/unlink bursts cause 0 invalidations and 0 recomputes', async () => {
    const watcher = new EventEmitter();
    const compute = vi.fn(() => ({ v: 1 }));
    const service = createDevIdentityService({ root, initial: { v: 0 }, compute, watcher, watchGit: () => ({ close() {} }) });
    for (let i = 0; i < 200; i += 1) {
      for (const ev of ['add', 'change', 'unlink']) {
        watcher.emit('all', ev, path.join(root, 'node_modules', `m${i}.js`));
        watcher.emit('all', ev, path.join(root, 'evidence', `e${i}.png`));
        watcher.emit('all', ev, path.join(root, 'PROFLOW_TODO.md'));
      }
    }
    watcher.emit('all', 'addDir', path.join(root, 'src', 'emptydir'));
    await Promise.all(Array.from({ length: 100 }, () => service.cache.get()));
    expect(service.cache.stats.invalidations).toBe(0);
    expect(compute).not.toHaveBeenCalled();
    service.close();
    watcher.emit('all', 'change', path.join(root, 'src', 'a.js'));
    expect(service.cache.stats.invalidations).toBe(0); // closed service no longer listens
  });
});

describe('dev identity cache - real Git repository with a linked worktree', () => {
  let base; let main; let wt;
  beforeAll(() => {
    base = mkdtempSync(path.join(tmpdir(), 'tekango-identity-'));
    main = path.join(base, 'main');
    mkdirSync(path.join(main, 'src'), { recursive: true });
    writeFileSync(path.join(main, 'src', 'a.js'), 'export const a = 1;\n');
    writeFileSync(path.join(main, 'src', 'c.js'), 'export const c = 1;\n');
    writeFileSync(path.join(main, 'package.json'), '{"name":"identity-test"}\n');
    realGit(main, 'init', '-q', '-b', 'main');
    realGit(main, 'add', '-A');
    realGit(main, 'commit', '-q', '-m', 'base');
    wt = path.join(base, 'wt');
    realGit(main, 'worktree', 'add', '-q', '-b', 'feature', wt);
  });
  afterAll(() => { try { rmSync(base, { recursive: true, force: true }); } catch { /* best effort */ } });

  it('resolves the linked worktree Git dir, common dir and active ref without spawning Git', () => {
    execFileSync.mockClear();
    const meta = resolveGitMetadata(wt);
    expect(execFileSync).not.toHaveBeenCalled();
    expect(path.basename(meta.gitDir)).toBe('wt');
    expect(path.resolve(meta.commonDir)).toBe(path.resolve(main, '.git'));
    expect(meta.activeRef).toBe('refs/heads/feature');
  });

  it('a burst of add/change/unlink under src triggers exactly one recompute and updates digest + dirty', async () => {
    const watcher = new EventEmitter();
    const initial = sourceIdentity(wt, 'localtest');
    const service = createDevIdentityService({ root: wt, initial, compute: () => sourceIdentity(wt, 'localtest'), watcher, watchGit: () => ({ close() {} }) });
    expect(initial.dirty).toBe(false);
    writeFileSync(path.join(wt, 'src', 'b.js'), 'export const b = 2;\n');
    watcher.emit('all', 'add', path.join(wt, 'src', 'b.js'));
    for (let i = 0; i < 25; i += 1) {
      writeFileSync(path.join(wt, 'src', 'a.js'), `export const a = ${i + 2};\n`);
      watcher.emit('all', 'change', path.join(wt, 'src', 'a.js'));
    }
    rmSync(path.join(wt, 'src', 'c.js'));
    watcher.emit('all', 'unlink', path.join(wt, 'src', 'c.js'));
    execFileSync.mockClear();
    const values = await Promise.all(Array.from({ length: 100 }, () => service.cache.get()));
    expect(service.cache.stats.computes).toBe(1);
    expect(values.every((v) => v === values[0])).toBe(true);
    expect(values[0].dirty).toBe(true);
    expect(values[0].buildInputDigest).not.toBe(initial.buildInputDigest);
    expect(values[0].buildInputFileCount).toBe(initial.buildInputFileCount); // +b.js -c.js
    expect(execFileSync.mock.calls.length).toBeGreaterThan(0);
    expect(execFileSync.mock.calls.length).toBeLessThanOrEqual(4); // one sourceIdentity = ls-files, rev-parse x2, status
    service.close();
    realGit(wt, 'checkout', '-q', '--', 'src/a.js', 'src/c.js');
    rmSync(path.join(wt, 'src', 'b.js'));
  });

  it('commit (HEAD/index/active ref), branch switch and a direct ref update each cause one recompute with the right sha/branch', async () => {
    const initial = sourceIdentity(wt, 'localtest');
    const service = createDevIdentityService({ root: wt, initial, compute: () => sourceIdentity(wt, 'localtest'), watcher: new EventEmitter() });
    try {
      expect(initial.branch).toBe('feature');
      const readMany = () => Promise.all(Array.from({ length: 50 }, () => service.cache.get()));

      // 1) commit in the linked worktree: index + refs/heads/feature (+ logs) change
      writeFileSync(path.join(wt, 'src', 'a.js'), 'export const a = 100;\n');
      realGit(wt, 'add', 'src/a.js');
      realGit(wt, 'commit', '-q', '-m', 'second');
      await settle(service.cache);
      let values = await readMany();
      expect(service.cache.stats.computes).toBe(1);
      expect(values[0].buildSha).toBe(realGit(wt, 'rev-parse', 'HEAD'));
      expect(values[0].buildSha).not.toBe(initial.buildSha);
      await sleep(400);
      expect(service.cache.isStale()).toBe(false); // the recompute's own Git reads never invalidate the cache

      // 2) branch switch: HEAD now points at a new ref
      realGit(wt, 'checkout', '-q', '-b', 'other');
      await settle(service.cache);
      values = await readMany();
      expect(service.cache.stats.computes).toBe(2);
      expect(values[0].branch).toBe('other');

      // 3) the new active ref moves without touching this worktree's HEAD or index (watch was re-armed to refs/heads/other)
      const target = initial.buildSha;
      realGit(main, 'update-ref', 'refs/heads/other', target);
      await settle(service.cache);
      values = await readMany();
      expect(service.cache.stats.computes).toBe(3);
      expect(values[0].buildSha).toBe(target);

      // 4) index-only change (stage a new file) invalidates once
      writeFileSync(path.join(wt, 'src', 'staged.js'), 'export const s = 1;\n');
      realGit(wt, 'add', 'src/staged.js');
      await settle(service.cache);
      await readMany();
      expect(service.cache.stats.computes).toBe(4);
    } finally { service.close(); }
    // four real Git steps, each allowed up to 5s by settle(): the 5s vitest default could never cover them under full-suite load
  }, 30_000);

  it('arms real fs.watch watchers on the linked worktree and reports healthy', () => {
    const onUnavailable = vi.fn();
    const git = watchGitMetadata(wt, { onUnavailable });
    expect(git.isHealthy()).toBe(true);
    expect(onUnavailable).not.toHaveBeenCalled();
    git.close();
    expect(git.isHealthy()).toBe(false);
  });
});

// Independent review finding (2026-10-09): a single invalidation on watcher failure is NOT fail-closed - the next request
// recomputed, cleared `stale`, and later HEAD/index/ref changes would then be served as a stale 200 with no watcher left.
describe('dev identity service - Git monitoring fail-closed', () => {
  let root;
  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), 'tekango-fakegit-'));
    mkdirSync(path.join(root, '.git', 'refs', 'heads'), { recursive: true });
    writeFileSync(path.join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  });
  afterAll(() => { try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ } });

  // Fake fs.watch: the fake root arms exactly two watchers (.git for HEAD/index/packed-refs, .git/refs/heads for the active ref).
  const fakeWatch = (shouldFail = () => false) => {
    const created = [];
    let calls = 0;
    const watch = vi.fn((dir, _opts, cb) => {
      calls += 1;
      if (shouldFail(calls)) throw new Error('EPERM');
      const w = new EventEmitter();
      Object.assign(w, { dir, cb, closed: false, close: vi.fn(() => { w.closed = true; }) });
      created.push(w);
      return w;
    });
    return { watch, created };
  };
  const manualTimers = () => {
    const timers = [];
    return { timers, setTimer: vi.fn((fn, ms) => { const t = { fn, ms, unref() {} }; timers.push(t); return t; }), clearTimer: vi.fn() };
  };
  const request = (middleware) => new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { resolve({ status: this.statusCode, headers: this.headers, body: JSON.parse(body) }); } };
    middleware({}, res);
  });
  const many = (middleware, n) => Promise.all(Array.from({ length: n }, () => request(middleware)));
  const makeService = (watch, timers, compute = vi.fn(() => ({ buildSha: 'recomputed' }))) => {
    const service = createDevIdentityService({ root, initial: { buildSha: 'initial' }, compute, watcher: new EventEmitter(),
      watchOptions: { watch, warn: vi.fn(), setTimer: timers.setTimer, clearTimer: timers.clearTimer } });
    return { service, compute, middleware: createVersionJsonMiddleware(service, (id) => ({ ...id, servesWorkingTree: true })) };
  };

  it('watcher setup failure: the whole set is closed, 100 requests answer 503 with 0 recomputes, and the state stays unavailable', async () => {
    const { watch, created } = fakeWatch((n) => n === 2);
    const timers = manualTimers();
    const { service, compute, middleware } = makeService(watch, timers);
    expect(created).toHaveLength(1);
    expect(created[0].closed).toBe(true); // the watcher armed before the failure does not survive as a partial "healthy" set
    const responses = await many(middleware, 100);
    expect(responses.every((r) => r.status === 503 && r.body.reason === 'git-metadata-monitoring-unavailable' && r.headers['Cache-Control'] === 'no-store')).toBe(true);
    expect(responses.some((r) => r.body.buildSha)).toBe(false);
    expect(compute).not.toHaveBeenCalled();
    expect(service.isAvailable()).toBe(false);
    expect(service.cache.isStale()).toBe(true);
    await expect(service.get()).rejects.toMatchObject({ code: 'IDENTITY_UNAVAILABLE' });
    service.close();
  });

  it('a healthy watcher that later emits error closes every watcher; then 503, no recompute and no stale 200', async () => {
    const { watch, created } = fakeWatch();
    const timers = manualTimers();
    const { service, compute, middleware } = makeService(watch, timers);
    expect(created).toHaveLength(2);
    const healthy = await many(middleware, 10);
    expect(healthy.every((r) => r.status === 200 && r.body.buildSha === 'initial')).toBe(true);
    created[1].emit('error', new Error('EIO'));
    expect(created.every((w) => w.closed)).toBe(true);
    created[0].cb('rename', 'HEAD'); // a late event from a closed watcher is ignored and cannot re-arm or revive the service
    expect(watch).toHaveBeenCalledTimes(2);
    const after = await many(middleware, 100);
    expect(after.every((r) => r.status === 503)).toBe(true);
    expect(after.some((r) => r.body.buildSha === 'initial')).toBe(false);
    expect(compute).not.toHaveBeenCalled();
    expect(service.isAvailable()).toBe(false);
    service.close();
  });

  it('monitoring that drops during a recompute never serves that result as current', async () => {
    const { watch, created } = fakeWatch();
    let release;
    const compute = vi.fn(() => new Promise((r) => { release = () => r({ buildSha: 'late' }); }));
    const { service, middleware } = makeService(watch, manualTimers(), compute);
    service.cache.invalidate();
    const pending = request(middleware);
    await Promise.resolve();
    created[0].emit('error', new Error('EIO'));
    release();
    const res = await pending;
    expect(res.status).toBe(503);
    expect(compute).toHaveBeenCalledTimes(1);
    service.close();
  });

  // Independent review race (2026-10-09): get -> onUnavailable -> onRecovered -> old compute resolves must NOT serve that result.
  describe('outage that starts and ends during a recompute', () => {
    const setup = () => {
      let handlers;
      const releases = [];
      let n = 0;
      const compute = vi.fn(() => { n += 1; const v = n; return new Promise((r) => { releases.push(() => r({ buildSha: `compute-${v}` })); }); });
      const service = createDevIdentityService({ root, initial: { buildSha: 'initial' }, compute, watcher: new EventEmitter(),
        watchGit: (_root, h) => { handlers = h; return { close() {} }; } });
      const middleware = createVersionJsonMiddleware(service, (id) => ({ ...id, servesWorkingTree: true }));
      return { service, compute, middleware, releases, handlers: () => handlers };
    };

    it('the request that crossed the outage answers 503, the old result is never delivered, and the cache stays stale', async () => {
      const { service, compute, middleware, releases, handlers } = setup();
      service.cache.invalidate();
      const crossing = request(middleware);
      await Promise.resolve();
      expect(compute).toHaveBeenCalledTimes(1);
      handlers().onUnavailable('watch error: EIO');
      handlers().onRecovered();
      expect(service.isAvailable()).toBe(true);
      releases[0]();
      const res = await crossing;
      expect(res.status).toBe(503);
      expect(res.body.reason).toBe('git-metadata-monitoring-unavailable');
      expect(JSON.stringify(res.body)).not.toContain('compute-1');
      expect(service.cache.isStale()).toBe(true);

      // the next request runs ONE fresh recompute; 100 concurrent requests after recovery share it
      const next = Array.from({ length: 100 }, () => request(middleware));
      await Promise.resolve(); await Promise.resolve();
      expect(compute).toHaveBeenCalledTimes(2);
      releases[1]();
      const after = await Promise.all(next);
      expect(after.every((r) => r.status === 200 && r.body.buildSha === 'compute-2')).toBe(true);
      expect(compute).toHaveBeenCalledTimes(2);
      expect(service.cache.isStale()).toBe(false);
      service.close();
    });

    it('a request arriving after recovery while the pre-outage compute is still running never joins it', async () => {
      const { service, compute, middleware, releases, handlers } = setup();
      service.cache.invalidate();
      const crossing = request(middleware);
      await Promise.resolve();
      handlers().onUnavailable('watch error: EIO');
      handlers().onRecovered();
      const fresh = Array.from({ length: 100 }, () => request(middleware)); // old compute still pending
      await Promise.resolve();
      expect(compute).toHaveBeenCalledTimes(1); // the fresh compute is queued behind the old one: never two Git runs at once
      releases[0]();
      await vi.waitFor(() => expect(compute).toHaveBeenCalledTimes(2));
      releases[1]();
      expect((await crossing).status).toBe(503);
      const results = await Promise.all(fresh);
      expect(results.every((r) => r.status === 200 && r.body.buildSha === 'compute-2')).toBe(true);
      expect(compute).toHaveBeenCalledTimes(2);
      service.close();
    });
  });

  it('recovery: only a COMPLETE re-arm restores service, followed by exactly one recompute', async () => {
    // call 2 fails (initial arm), call 4 fails (first retry arms .git then fails on refs/heads), calls 5+ succeed
    const { watch, created } = fakeWatch((n) => n === 2 || n === 4);
    const timers = manualTimers();
    const { service, compute, middleware } = makeService(watch, timers);
    expect(service.isAvailable()).toBe(false);
    expect(timers.timers.map((t) => t.ms)).toEqual([RECOVERY_DELAYS_MS[0]]);

    timers.timers[0].fn(); // partial re-arm
    expect(service.isAvailable()).toBe(false);
    expect(created.every((w) => w.closed)).toBe(true);
    expect((await many(middleware, 50)).every((r) => r.status === 503)).toBe(true);
    expect(compute).not.toHaveBeenCalled();
    expect(timers.timers.map((t) => t.ms)).toEqual([RECOVERY_DELAYS_MS[0], RECOVERY_DELAYS_MS[1]]);

    timers.timers[1].fn(); // complete re-arm
    expect(service.isAvailable()).toBe(true);
    expect(created.filter((w) => !w.closed)).toHaveLength(2);
    expect(service.cache.isStale()).toBe(true);
    const restored = await many(middleware, 50);
    expect(restored.every((r) => r.status === 200 && r.body.buildSha === 'recomputed')).toBe(true);
    await many(middleware, 100);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(timers.timers).toHaveLength(2); // no further polling once healthy
    service.close();
  });

  it('recovery is bounded: RECOVERY_DELAYS_MS attempts with no dense polling, then unavailable until restart', async () => {
    const { watch } = fakeWatch(() => true);
    const timers = manualTimers();
    const { service, compute, middleware } = makeService(watch, timers);
    for (let i = 0; i < timers.timers.length; i += 1) timers.timers[i].fn();
    expect(timers.timers.map((t) => t.ms)).toEqual([...RECOVERY_DELAYS_MS]);
    expect(Math.min(...timers.timers.map((t) => t.ms))).toBeGreaterThanOrEqual(1000);
    expect(watch).toHaveBeenCalledTimes(1 + RECOVERY_DELAYS_MS.length);
    expect((await many(middleware, 100)).every((r) => r.status === 503)).toBe(true);
    expect(compute).not.toHaveBeenCalled();
    service.close();
  });

  it('close() cancels a pending recovery attempt', () => {
    const { watch } = fakeWatch((n) => n === 1);
    const timers = manualTimers();
    const { service } = makeService(watch, timers);
    service.close();
    expect(timers.clearTimer).toHaveBeenCalledWith(timers.timers[0]);
  });

  it('unreadable Git metadata fails closed', async () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'tekango-nogit-'));
    try {
      const service = createDevIdentityService({ root: empty, initial: { buildSha: 'initial' }, compute: vi.fn(), watchOptions: { warn: vi.fn(), setTimer: () => ({ unref() {} }), clearTimer: () => {} } });
      expect(service.isAvailable()).toBe(false);
      await expect(service.get()).rejects.toMatchObject({ code: 'IDENTITY_UNAVAILABLE' });
      service.close();
    } finally { rmSync(empty, { recursive: true, force: true }); }
  });
});

describe('Windows-hidden Git children', () => {
  it('every Git child spawned by sourceIdentity uses windowsHide:true and never takes optional index locks', () => {
    execFileSync.mockClear();
    sourceIdentity(ROOT, 'localtest');
    const gitCalls = execFileSync.mock.calls.filter(([cmd]) => cmd === 'git');
    expect(gitCalls.length).toBe(4);
    for (const [, , options] of gitCalls) {
      expect(options.windowsHide).toBe(true);
      expect(options.env.GIT_OPTIONAL_LOCKS).toBe('0');
    }
  });

  it('every child_process call in vite.config.js and the identity scripts passes windowsHide:true', () => {
    for (const file of ['vite.config.js', 'scripts/build-identity.js', 'scripts/dev-identity-cache.js']) {
      const src = readFileSync(path.join(ROOT, file), 'utf8');
      const calls = src.match(/\b(execSync|execFileSync|spawnSync|spawn|execFile|exec)\([^\n]*/g) || [];
      for (const call of calls) expect(call, `${file}: ${call}`).toMatch(/windowsHide:\s*true/);
    }
  });
});

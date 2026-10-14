// Task 16 - QA runner. Runs the selected suites and writes <out>/summary.json.
//
// Against an already-running server (never started/stopped by this runner):
//   node scripts/task16/qa/run-qa.mjs --base-url http://localhost:5186 --only public,print [--out DIR]
// Starting its own disposable local server (127.0.0.1, ports 5400-5449 only; stopped at the end):
//   node scripts/task16/qa/run-qa.mjs --serve 5417 --only public,print
// Suites: public (qa-public-sample), print (qa-print-pdf), persona (qa-app-persona; needs --allow-writes to save).
// Extra flags are passed through to the suites (--locales, --styles, --combos, --shots, --personas, --env, ...).
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs, outDir, writeJson, REPO_ROOT, PROTECTED_PORT } from './lib.mjs';
import { runPublicSample } from './qa-public-sample.mjs';
import { runPrintPdf } from './qa-print-pdf.mjs';
import { runAppPersona } from './qa-app-persona.mjs';

async function waitHttp(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function startServer(port) {
  if (port === PROTECTED_PORT || port < 5400 || port > 5449) throw new Error(`--serve port must be 5400-5449 (got ${port}); ${PROTECTED_PORT} is never started by QA tooling`);
  const child = spawn(process.execPath, [path.join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--mode', 'localtest', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}

function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    try { execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' }); } catch { /* already gone */ }
  } else child.kill('SIGTERM');
}

async function main() {
  const args = parseArgs();
  const only = String(args.only || 'public,print').split(',').filter(Boolean);
  let server = null;
  if (args.serve) {
    const port = Number(args.serve === true ? 5417 : args.serve);
    server = startServer(port);
    args['base-url'] = `http://127.0.0.1:${port}`;
    if (!(await waitHttp(`${args['base-url']}/`, 90000))) { stopServer(server); throw new Error(`local server on ${port} did not come up`); }
  }
  const results = {};
  try {
    const suites = { public: runPublicSample, print: runPrintPdf, persona: runAppPersona };
    for (const name of only) {
      if (!suites[name]) { results[name] = { error: 'unknown suite' }; continue; }
      try {
        const r = await suites[name](args);
        results[name] = { matrix: r.file, totals: r.summary.totals, failures: r.summary.failures };
      } catch (e) {
        results[name] = { error: String(e && e.message ? e.message : e).slice(0, 300) };
      }
    }
  } finally {
    stopServer(server);
  }
  const file = writeJson(path.join(outDir(args), 'summary.json'), { generatedAt: new Date().toISOString(), base: args['base-url'] || process.env.BASE_URL, suites: results });
  const brief = Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.error ? { error: v.error } : { totals: v.totals, failures: v.failures.length }]));
  console.log(JSON.stringify({ summary: file, suites: brief }, null, 2));
  process.exitCode = Object.values(results).some((v) => v.error || v.totals?.FAIL) ? 1 : 0;
}

main().catch((e) => { console.error(String(e && e.message ? e.message : e)); process.exitCode = 2; });

// DIAGNOSTIC ONLY (not canonical): derive a temporary harness copy that (1) applies with psql --single-transaction exactly the
// files that declare a top-level `SET LOCAL` (they require the executor's transaction; 20260827000001 forbids one because of
// CREATE INDEX CONCURRENTLY, so no uniform mode exists) and (2) adds the Supabase platform default
// publication `supabase_realtime` (empty, default ops) to the stubs. Nothing is omitted. Usage: node make-diag-fidelity.cjs <src> <dst>
const fs = require('fs');
const [src, dst] = process.argv.slice(2);
let s = fs.readFileSync(src, 'utf8');
const psqlArgs = "['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-f', '-']";
if (!s.includes(psqlArgs)) throw new Error('psql args not found');
s = s.replace(psqlArgs,
  "['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q', ...(/^SET LOCAL /m.test(sql) ? ['--single-transaction'] : []), '-f', '-']");
const stubCall = "const s = psql(stubs, { label: 'stubs.sql' });";
if (!s.includes(stubCall)) throw new Error('stub call not found');
s = s.replace(stubCall,
  "const s = psql(`${stubs}\\nDO $p$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN CREATE PUBLICATION supabase_realtime; END IF; END $p$;\\n`, { label: 'stubs.sql' });");
// (3) the 20260930000000 SOURCE ACL seed, applied once right before that migration's first application
const migLine = "    const text = fs.readFileSync(path.join(migDir, f), 'utf8');\n    const r = psql(text, { label: f });";
const s2 = s.replace(/\r\n/g, '\n');
if (!s2.includes(migLine)) throw new Error('migration loop not found');
const seedPath = require('path').join(__dirname, 'diag-pre-20260930-acl-seed.sql').split('\\').join('/');
s = s2.replace(migLine, "    const text = fs.readFileSync(path.join(migDir, f), 'utf8');\n"
  + `    if (f.startsWith('20260930000000')) { const sd = psql(fs.readFileSync('${seedPath}', 'utf8'), { label: 'diag-acl-seed' }); if (!sd.ok) throw new Error('diag seed failed: ' + sd.stderr); result.diagnosticAclSeed = '${seedPath}'; }\n`
  + "    const r = psql(text, { label: f });");
fs.writeFileSync(dst, s);
console.log('diag harness written', dst);

// Typecheck of the prep TypeScript with an ALREADY INSTALLED compiler (no install): the TypeScript library bundled with the local
// VS Code. Strict, noEmit. Usage: node subscriptions-prep/typecheck-prep.cjs [path-to-typescript-lib-dir]
// Exit 0 = no diagnostics; 1 = diagnostics; 2 = compiler not found (report NOT RUN, never PASS).
const fs = require('fs');
const path = require('path');

const candidates = [
  process.argv[2],
  ...(() => {
    const base = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code');
    try { return fs.readdirSync(base).map((d) => path.join(base, d, 'resources', 'app', 'extensions', 'node_modules', 'typescript')); } catch { return []; }
  })(),
].filter(Boolean);
const tsDir = candidates.find((d) => fs.existsSync(path.join(d, 'lib', 'typescript.js')));
if (!tsDir) { console.error('TYPECHECK: NOT RUN - no installed TypeScript compiler found'); process.exit(2); }
const ts = require(path.join(tsDir, 'lib', 'typescript.js'));

const root = path.resolve(__dirname, '..');
const files = ['subscriptions-prep/server/authorizeQuoteOutput.ts', 'subscriptions-prep/server/authorizeQuoteOutput.prep-test.ts'].map((f) => path.join(root, f));
const program = ts.createProgram(files, {
  strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [],
  skipLibCheck: true, allowImportingTsExtensions: false, noUnusedLocals: true, noUnusedParameters: true,
});
const diags = ts.getPreEmitDiagnostics(program);
for (const d of diags) {
  const where = d.file ? `${path.relative(root, d.file.fileName)}:${d.file.getLineAndCharacterOfPosition(d.start).line + 1}` : '';
  console.log(`${where} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
}
console.log(`TYPECHECK (TypeScript ${ts.version} from ${tsDir}): ${diags.length} diagnostic(s) over ${files.length} files`);
process.exit(diags.length ? 1 : 0);

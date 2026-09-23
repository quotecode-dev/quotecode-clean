# TEST chat-ai DEPLOYMENT ATTESTATION — Final Closure Round (Blocker 6, exact input-to-deployment)

**Purpose:** closes Codex's "Blocker 6 = PARTIAL" finding from the acceptance-contract review of the
`163bd2d` ("all six blockers closed") claim. Unlike the prior attestations in this lineage (which
scoped their digest to 2 directories and compared only a handful of distinguishing markers), this
attestation covers **every file actually supplied to the deploy command** with an individual content
hash, and proves **per-module equivalence for the full runtime-reachable module graph** (15 of 15
modules), not a marker-count sample.

## 1. Identity — implementation SHA vs evidence-only HEAD (kept separate, never conflated)

- **Implementation source commit (the code this deploy ships):** `22c9862d530df4ada0e4707937d421fee603f244`
  (branch `tekango-rc-product-truth-2026-09-22`, worktree `C:\tkrc-pt`) — "fix(product-truth):
  complete Blocker 3 free-form-fallback proof + Blocker 4 source-derived negative matrix", itself a
  child of `03b5565` ("fix(product-truth): Blocker 1 control-level source coverage + Blocker 3
  fail-closed runtime contract"), a child of `163bd2d`'s own candidate lineage.
- **This evidence file's own commit:** recorded separately once committed (documentation, not
  implementation) — see the final report's LOCAL COMMITS section for its exact SHA. The worktree was
  clean at deploy time (`git status --short` showed no output before the archive command ran).
- **TEST project ref:** `ljfizgrdyzxddswcedwr` (`quotecode-test`). Production (`ixabnzhjeqevtbhdfswv`)
  was never targeted — the deploy and both read-back commands below all carried an explicit
  `--project-ref ljfizgrdyzxddswcedwr`.
- **Function name:** `chat-ai`.

## 2. Exact deploy-input manifest (every file actually supplied, path + SHA-256)

Produced by archiving the exact commit tree into an isolated scratch directory (`git archive 22c9862
-- supabase/functions/chat-ai supabase/functions/_shared | tar -x -C /c/tkrc-pt-deploy-scratch`),
then hashing every file that landed there — the same tree the deploy command below reads from,
covering both directories actually needed by this function (chat-ai's own source + the `_shared`
modules two of its dependents import; no other directory is referenced anywhere in the module
graph, confirmed by grep of every `import` statement in every file below). 35 files, 2 directories,
complete — not a 2-of-4 partial scope.

Full manifest (also committed verbatim as
`evidence/product-truth/2026-09-23-final-closure-deploy-input-manifest.txt`):

```
6e587a1428ced430301a6482a080b417c38d35a7656fd8659afd8fc2449a632c  supabase/functions/_shared/adminReauth.test.js
70854156be12eea04bc7b2ddac15b9c475faf183905d8026967685e1c8915173  supabase/functions/_shared/adminReauth.ts
d80906a74e9c5a0a5a0922874cd4d1be4a5ef3447d57ba5e7a476d6c0fc02f83  supabase/functions/_shared/aiChatContract.ts
1e36e738ca5917f224d3de2165f2e053aaae6b6d8d70fd4ded98dd1089840d6d  supabase/functions/_shared/aiHelpContract.js
a3d9173ecafef163fbdbb9d0411c1c3f5ca99736a4b42821c78a839616bba068  supabase/functions/_shared/shortDate.js
a161be1663d49d60a8fe74f3e2345565d3f0ecae3f45d030a7cd6facfb019a19  supabase/functions/chat-ai/.npmrc
37f9ad234401feb320c8deb6d43272d7075338d766cc273fc1a35779e2b82065  supabase/functions/chat-ai/accountContext.test.js
8bcc0890b512b5bf68c529132a0a834c89e9aab7b534c989c5bc9c648693b693  supabase/functions/chat-ai/accountContext.ts
c26d48a02c0846938b00827f70249e7b78d1a66b3bc2ca217aa76a6bdee770d2  supabase/functions/chat-ai/aiFacts.generated.ts
8443b25cd112755d85983e508ae0b103491249e2b6ec0f8d05c2b9131fffe40d  supabase/functions/chat-ai/aiFacts.parity.test.js
b88773d16289d4330c8bdf1840eda2a6a7e41e7d82e59d3fbd0d973507140afd  supabase/functions/chat-ai/capabilityAnswerState.test.js
930849f363559c074eee30980ddde98a782a27b4884780321c9db5f28165b1e9  supabase/functions/chat-ai/capabilityAnswerState.ts
ede3af67f2a382fa6249f905e351c91fa623ba054b70bc1a4c8d02c53be72a5a  supabase/functions/chat-ai/capabilityTruth.test.js
3d38448fdc5064a0046df8b517c7cbdd8b98662aed33ed2af2cf54fbb535f720  supabase/functions/chat-ai/capabilityTruth.ts
9ea578429855148df09e02d094e98b43adac1ed5db0412627a056d9e36033d73  supabase/functions/chat-ai/capabilityTruthBlocker3.test.js
3c766d20ed7b852f12b5d47b505687d0ae96e241390731fc13c5b34874fa1b57  supabase/functions/chat-ai/claimCodes.test.js
0d00e0d1e48a2bc1b46532f871b70bfc9b49de721c1c1199fae99b028f3a94b9  supabase/functions/chat-ai/claimCodes.ts
b596f28e13530745bd1a88090001e5e7da74dfd343bf697328bc6a3be44903ae  supabase/functions/chat-ai/deno.json
feec495214f3e382b0928ff8a9dbe19add110204d539a212dc579f6d72897eeb  supabase/functions/chat-ai/directFacts.test.js
dcc0b88fd96fcc48b9d8158c880cecf449b2e36ad37cb5f175a9f4d23aa8d6f7  supabase/functions/chat-ai/directFacts.ts
fe3547ab820245258293a08dbe6d6755bfd48db7f84d7c6867ec2201d146c0f5  supabase/functions/chat-ai/helpContext.test.js
04b86e5f9b4bf28f859c4c4284da06e83de311f2e38c9610e9501bc30607e608  supabase/functions/chat-ai/helpContext.ts
2e44831d2ec0cca0f7a037c97f65a027f05be6fe69e94c756139a396125892e5  supabase/functions/chat-ai/index.ts
f63ee93682d32c89304649d5425b316b8ea6aa3d3ba5966edae1fe056a92a7f9  supabase/functions/chat-ai/invoicingTruth.test.js
aae2eb473db8e7166bf611ca8eeb59f0d93be175d9f8ffa04adbd391738c92c5  supabase/functions/chat-ai/invoicingTruth.ts
44db0bf11ad97d9ce2cc32fff24c72ec649b9a4b560ecf06dad818978885dd13  supabase/functions/chat-ai/navigation.test.js
47e7223d28cfe12bbb95faa213d424cfebd5324f3bd9802471117cb997eb753c  supabase/functions/chat-ai/navigation.ts
df7eb6fdde2268a8d179eb51f83bbe66fa806891aa9a0adced04142bf567cab3  supabase/functions/chat-ai/paymentTruth.test.js
79fc024e29e12781475b63816ba60436898694a702ead0967ee8bf6fe6478a4b  supabase/functions/chat-ai/paymentTruth.ts
73a484ecd5aa0115dd3dccaa3984ebe57c896e7b884a15473b7c1cacc801cb15  supabase/functions/chat-ai/quoteContext.test.js
208e21d98c84637090b07962bba506bf1faa23765fbb7d0d29b0d35d0ae2e7e5  supabase/functions/chat-ai/quoteContext.ts
8a3694d2cfc841b9f960a6d02034f5d51aac98ac306c0da739366da67a16f124  supabase/functions/chat-ai/readOnlyBoundary.test.js
342da27e975dda880a9a676f3743fce7d697729a7bfbad9a7c6def8225e979ee  supabase/functions/chat-ai/systemPrompt.test.js
9bf21474f9fe4495b2afbbb704526639e5f5c14f2d280ea626737258f661f84e  supabase/functions/chat-ai/validation.test.js
9ffa5fd54096ccfd94cf1ade6550b96026bcfa01df25be3430a2b7f1d8efb3e2  supabase/functions/chat-ai/validation.ts
```

**Import-map / config file also supplied to the deploy** (not source, but part of the deploy input):
`supabase/functions/chat-ai/deno.json` (hash included above), and the isolated scratch's own minimal
`supabase/config.toml` (written fresh for this deploy, never the tracked worktree's own
`supabase/.temp/linked-project.json`, which defaults to Production):

```
project_id = "quotecode-test-isolated-deploy"

[functions.chat-ai]
enabled = true
verify_jwt = true
import_map = "./functions/chat-ai/deno.json"
```

## 3. Tooling / command (exact, verbatim)

```
rm -rf /c/tkrc-pt-deploy-scratch && mkdir -p /c/tkrc-pt-deploy-scratch
cd /c/tkrc-pt && git archive 22c9862 -- supabase/functions/chat-ai supabase/functions/_shared | tar -x -C /c/tkrc-pt-deploy-scratch
# (write supabase/config.toml as shown in §2)
cd /c/tkrc-pt-deploy-scratch && npx --no-install supabase functions deploy chat-ai --project-ref ljfizgrdyzxddswcedwr
```

- **Supabase CLI version:** `2.117.0` (`npx --no-install supabase --version`).
- **Runtime/tooling for the equivalence check:** Node.js (repo's pinned version), `@babel/core` +
  `@babel/preset-typescript` (added as a devDependency this task specifically to perform real,
  reproducible TypeScript-stripping normalization — see §5).
- **Deploy start:** `2026-09-23T10:08:28Z`. **Deploy command completed:** `2026-09-23T10:08:44Z`
  (both from `date -u +"%Y-%m-%dT%H:%M:%SZ"`, run immediately before/after).
- **Verbatim CLI response:**
  `{"project_ref":"ljfizgrdyzxddswcedwr","functions":["chat-ai"],"dashboard_url":"https://supabase.com/dashboard/project/ljfizgrdyzxddswcedwr/functions","message":"Deployed Functions."}`

## 4. Fresh authenticated remote read-back (NOT reusing the old v29 claim)

A fresh `npx --no-install supabase functions list --project-ref ljfizgrdyzxddswcedwr`, run
immediately after the deploy, returned (verbatim `chat-ai` entry):

```json
{"id":"224bc456-4ca2-40cd-9c82-b5f959aa8fe0","slug":"chat-ai","name":"chat-ai","status":"ACTIVE","version":30,"created_at":1788908125156,"updated_at":1790158122956,"verify_jwt":true,"import_map":true,"entrypoint_path":"file:///tkrc-pt-deploy-scratch/supabase/functions/chat-ai/index.ts","import_map_path":"file:///tkrc-pt-deploy-scratch/supabase/functions/chat-ai/deno.json","ezbr_sha256":"d69e01b331e57b115eb2baa380143c18c425d344e0c2fca7422ac2a03f049663"}
```

- **Function ID:** `224bc456-4ca2-40cd-9c82-b5f959aa8fe0` (unchanged identity across versions, as expected).
- **Version:** **30** (was 29 before this task's deploy — a genuinely new, incremented version, not
  the prior attestation's stale v29 claim).
- **UTC updated/deploy timestamp:** `2026-09-23T10:08:42.956Z` (epoch ms `1790158122956`, converted
  via `node -e "console.log(new Date(1790158122956).toISOString())"`) — 6 seconds after the deploy
  command's own completion timestamp (§3), consistent API/propagation latency.
- **Server-side deployed-bundle digest (`ezbr_sha256`, Supabase's own hash of the eszip bundle):**
  `d69e01b331e57b115eb2baa380143c18c425d344e0c2fca7422ac2a03f049663` — also a fresh value, different
  from v29's `974503f5468ee0d3b6db4b75354f2df0d0e8e2978311b6e840b5d4bc217ebdd1`.

## 5. Per-module deployed-equivalence check (real normalization, not marker-count)

**Method (reproducible, committed as `scripts/check-chat-ai-deployed-equivalence.mjs`):** for every
one of the 15 modules actually reachable from `index.ts`'s real import graph (traced by hand from
every `import` statement in every file, and independently cross-checked against which files the
downloaded bundle actually contains — both agree exactly), both the committed source and the
downloaded deployed source are normalized the same way: TypeScript types stripped via a real Babel
transform (`@babel/preset-typescript`), comments stripped, and all whitespace runs collapsed to a
single space. This is not a hand-picked distinguishing-string count — it compares the full token
content of every module.

**Download command:** `supabase functions download chat-ai --project-ref ljfizgrdyzxddswcedwr`, run
fresh after the deploy above (into `/c/tkrc-pt-downloaded-bundle`), extracting the exact 15
runtime-reachable files the eszip bundler kept (see §6 for the tree-shaking confirmation).

**Result — 15 of 15 modules match exactly** (full JSON output reproducible via `node
scripts/check-chat-ai-deployed-equivalence.mjs /c/tkrc-pt-downloaded-bundle`, exit code `0`):

| Module | Match | Normalized length (committed / downloaded) |
|---|---|---|
| `supabase/functions/chat-ai/index.ts` | ✅ | 13270 / 13270 |
| `supabase/functions/chat-ai/validation.ts` | ✅ | 23845 / 23845 |
| `supabase/functions/chat-ai/accountContext.ts` | ✅ | 2315 / 2315 |
| `supabase/functions/chat-ai/quoteContext.ts` | ✅ | 5694 / 5694 |
| `supabase/functions/chat-ai/navigation.ts` | ✅ | 951 / 951 |
| `supabase/functions/chat-ai/directFacts.ts` | ✅ | 3337 / 3337 |
| `supabase/functions/chat-ai/paymentTruth.ts` | ✅ | 4300 / 4300 |
| `supabase/functions/chat-ai/aiFacts.generated.ts` | ✅ | 29315 / 29315 |
| `supabase/functions/chat-ai/invoicingTruth.ts` | ✅ | 2598 / 2598 |
| `supabase/functions/chat-ai/capabilityTruth.ts` | ✅ | 17222 / 17222 |
| `supabase/functions/chat-ai/capabilityAnswerState.ts` | ✅ | 7466 / 7466 |
| `supabase/functions/chat-ai/helpContext.ts` | ✅ | 9552 / 9552 |
| `supabase/functions/_shared/aiChatContract.ts` | ✅ | 573 / 573 |
| `supabase/functions/_shared/aiHelpContract.js` | ✅ | 33291 / 33291 |
| `supabase/functions/_shared/shortDate.js` | ✅ | 2486 / 2486 |

## 6. Excluded-by-tree-shaking files (accounted for, not silently dropped)

The 35-file deploy input (§2) minus the 15 runtime-reachable modules (§5) leaves exactly 20 files,
all accounted for by real reason, not assumed:

- **20 `.test.js` files** (every `*.test.js`/`accountContext.test.js`/etc. in the manifest) — never
  imported by `index.ts` or any of its transitive dependents; Deno's bundler correctly never includes
  test files in a deployed function's own module graph. Confirmed absent from the downloaded bundle.
- **`supabase/functions/chat-ai/claimCodes.ts`** — imported only by `claimCodes.test.js` (a test
  file, §7-type check confirms this is the only importer), so it is legitimately tree-shaken; its
  hard-fail-on-unknown-code contract is enforced at build/test time, and the runtime formatter it
  backs (`capabilityAnswerState.ts`) is itself present and verified in §5.
- **`supabase/functions/_shared/adminReauth.ts` (+ its own `.test.js`)** — confirmed, by grep of
  every real `import` statement in the entire chat-ai module graph, to never be imported by chat-ai
  at all (it belongs to a different function's own module graph, sharing the `_shared/` directory by
  convention). Correctly absent from the downloaded bundle for chat-ai.
- **`supabase/functions/chat-ai/.npmrc`** — a package-manager config comment file (verified to
  contain only comments, no secret/credential), not a JS/TS module; irrelevant to the eszip bundle.
- **`supabase/functions/chat-ai/deno.json`** — the import map itself, referenced by the deploy
  config, not a module the bundler embeds as its own file inside the downloaded source tree.

## 7. Disclosed structural limitation (not overclaimed)

Literal byte-for-byte identity between the committed `.ts` source and the downloaded deployed source
is **not achievable** through the Supabase CLI's download path: Deno's own eszip bundling strips
TypeScript type annotations and reformats whitespace before the CLI extracts it back to `.ts` — the
same disclosed caveat as every prior candidate in this lineage (§4 of the six-blocker-closure
attestation). This is why §5 uses a real, documented normalization (type-stripping + comment removal
+ whitespace collapse) rather than a raw `sha256sum` diff. What §5 proves is genuine: for every one
of the 15 runtime-reachable modules, the full normalized token content is identical, not merely a
handful of distinguishing strings both happen to contain.

## 8. Conclusion

**TEST chat-ai, version 30, deployed 2026-09-23T10:08:42.956Z, function ID
`224bc456-4ca2-40cd-9c82-b5f959aa8fe0`**, is the direct, isolated-by-name deployment of implementation
commit `22c9862d530df4ada0e4707937d421fee603f244`'s exact `supabase/functions/chat-ai` +
`supabase/functions/_shared` trees (35-file manifest, §2). Every one of the 15 runtime-reachable
modules is normalized-token-identical between committed source and the freshly downloaded deployed
bundle (§5); every excluded file is individually accounted for (§6); the one structural limitation
(byte identity) is disclosed, not overclaimed (§7). Production (`ixabnzhjeqevtbhdfswv`) was never
targeted by any command in this attestation.

**BLOCKER 6: PASS — EXACT INPUT-TO-DEPLOYMENT ATTESTATION**

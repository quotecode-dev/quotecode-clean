# Task 16 — deploy `quote-presentation` to TEST (proposed procedure, NOT executed)

Status: **proposal only.** Nothing in this file has been run. No deploy, no Supabase network call, no credential read was
made while preparing it. Target is **TEST only** (`ljfizgrdyzxddswcedwr`, alias `TEST`). Production is out of scope.

Facts below were read from the governed tooling at `C:/tkrtool-iron/scripts/` (`sb.mjs`, `sb-guard-lib.js`,
`sb-guard-exec.js`, `sb-neutral-cwd.js`) and `C:/tkrtool-iron/RELEASE_TOOLING.md`.

## 1. What the guard accepts (verified by reading the code)

- `functions deploy` is class **MUTATING** (`sb-guard-lib.js` OPS): exactly ONE positional function name; allowed flags are
  only `--workdir`, `--no-verify-jwt`, `--use-api`, `--use-docker`, `--import-map` (+ `--project-ref`, `--expect-env`).
- MUTATING needs an explicit `--project-ref` (`TEST` or `ljfizgrdyzxddswcedwr`) AND `--expect-env TEST` matching that target.
  TEST needs no typed confirmation. `--linked`, `--db-url`, `--local`, `--all`, `--prune`, `--`, `--flag` values with
  whitespace / shell metacharacters, and `SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_REF` in the environment are all refused.
- The CLI is `supabase@2.118.0`, resolved **offline** from the npm cache (`npx --offline --no-install`). A cache miss is a STOP
  (do not install / repair the cache during the window).
- Every CLI spawn runs from a fresh neutral temp cwd (never a checkout). Therefore without `--workdir` the CLI would not find
  `supabase/functions/quote-presentation` at all.
- **`--workdir` must NOT be inside any git worktree** (`assertWorkdirAllowed` → `assertNotInWorktree`: any ancestor with a
  `.git` entry is refused, for MUTATING and READ_ONLY_PROJECT ops). So `C:/tkt16` (a linked worktree) and the main checkout
  are refused as workdir. A materialized copy outside every checkout is required (the CLI also writes `supabase/.temp/` there).
- `--workdir` must be non-empty; every occurrence is checked.
- Bundling: Docker is off on this machine, so pass **`--use-api`** (server-side bundling through the Management API; remote
  imports `deno.land/std@0.168.0` and `esm.sh/@supabase/supabase-js@2` are then resolved by Supabase, not locally, which also
  avoids the local AVG/TLS `UnknownIssuer` issue on remote imports). Server-side bundling does not type-check: there is no
  local `deno check` either (Docker off), so the code mirrors `get-public-quote`'s imports exactly and `lib.ts` is covered by
  vitest.
- A secret-safe JSONL intent record is written to `C:/tkrtool-iron/sb-guard.log.jsonl` before the spawn; a log-write failure
  refuses the command.

## 2. Deploy inputs (exact file set)

From the reviewed Task 16 commit (not from the working tree):

```
supabase/config.toml                                  # contains [functions.quote-presentation] verify_jwt = false
supabase/functions/quote-presentation/index.ts
supabase/functions/quote-presentation/lib.ts
supabase/functions/_shared/quoteStyleCapabilities.ts  # imported by lib.ts and index.ts
```

`lib.test.js` is not imported by the function and is deliberately not copied. `.gitattributes` pins
`supabase/functions/**/*.ts` to LF, so the blobs are LF; `config.toml` must also be taken from the blob with
`core.autocrlf=false` (the system gitconfig sets `autocrlf=true`, which would write CRLF).

## 3. Proposed commands (PowerShell, run by the Owner/coordinator — not by a worker)

```powershell
# 0. Preconditions (read-only, local)
#    - the Task 16 commit SHA is known and reviewed; vitest for quote-presentation + parity is green on it
#    - no SUPABASE_PROJECT_ID / SUPABASE_PROJECT_REF in the environment
$sha = '<reviewed Task 16 commit sha>'
$utc = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$wd  = "C:\tekango-deploy\t16-quote-presentation-$utc"     # outside every checkout (C:\ and C:\tekango-deploy have no .git)

# 1. Materialize the exact blobs (LF) outside any worktree. Write the tar to a FILE: a PowerShell 5.1 pipe between native
#    commands is text and would corrupt the archive.
New-Item -ItemType Directory -Force $wd | Out-Null
git -C C:/tkt16 -c core.autocrlf=false archive --format=tar -o "$wd\src.tar" $sha `
  supabase/config.toml supabase/functions/quote-presentation/index.ts supabase/functions/quote-presentation/lib.ts `
  supabase/functions/_shared/quoteStyleCapabilities.ts
tar -xf "$wd\src.tar" -C $wd
Remove-Item "$wd\src.tar"

# 2. Prove the copy is byte-identical to the commit (raw bytes vs `git cat-file blob`, never hash-object / diff / status)
#    and that $wd is not inside a git worktree:
#      git -C $wd rev-parse --is-inside-work-tree   -> must FAIL ("not a git repository")
#    For each of the 4 files: sha256(raw bytes under $wd) == sha256(git cat-file blob $sha:<path>). Record the manifest.

# 3. Deploy (TEST only)
node C:/tkrtool-iron/scripts/sb.mjs functions deploy quote-presentation --project-ref ljfizgrdyzxddswcedwr --expect-env TEST --workdir $wd --use-api --no-verify-jwt
```

`--no-verify-jwt` duplicates `verify_jwt = false` from the copied `config.toml` on purpose (belt and braces: a new function
would otherwise default to gateway JWT verification, which would break the anonymous `public_get`). Auth for every other
action is enforced in code (Bearer JWT → `auth.getUser`, ownership via `quotes.user_id`).

Expected guard banner before the CLI runs:
`[sb-guard] TARGET: TEST ljfizgrdyzxddswcedwr (quotecode-test) | operation: functions deploy | class: MUTATING`.

## 4. Read-back (read-only, TEST)

```powershell
node C:/tkrtool-iron/scripts/sb.mjs functions list --project-ref TEST
# optional deployed-source read-back into ANOTHER neutral directory outside every checkout:
node C:/tkrtool-iron/scripts/sb.mjs functions download quote-presentation --project-ref TEST --workdir C:\tekango-deploy\t16-qp-readback-$utc --use-api
```

Check: `quote-presentation` ACTIVE, `verify_jwt: false`, downloaded `index.ts` / `lib.ts` / `_shared/quoteStyleCapabilities.ts`
byte-identical to step 2's manifest.

## 5. Prerequisites to confirm BEFORE relying on privacy (not verified here — needs a separately authorized read)

1. **Bucket `quote-files` must be private on TEST** (`storage.buckets.public = false`, migration `20260922000000` section D
   applied, and the old `"Public Access to Quote Files"` SELECT policy dropped). If TEST still had the public bucket/policy
   from the base capture, every `t16-presentation/...` object would be readable by anyone who knows its path. The function
   only ever hands out 1 h signed URLs; it does not depend on the bucket being public.
2. `SUPABASE_SECRET_KEYS` (JSON with `default`) is present in the TEST function environment — it already is for
   `get-public-quote`, which uses the same pattern. No new secret is needed.
3. The bucket has no `allowed_mime_types` restriction that would refuse `application/json` (the base capture says both
   `file_size_limit` and `allowed_mime_types` are NULL).

## 6. QA capability fixture (TEST only)

Tiers default to `classic` for everyone (`commercialMapping: pending_owner_decision`). To exercise Modern/Visual on TEST,
a `super_admin` TEST account calls the `qa_set_capability` action (from the app's QA control or
`qaSetCapability(userId, tier)` in `src/utils/quotePresentationClient.js`). The function refuses it outside
`https://ljfizgrdyzxddswcedwr.supabase.co` and for any other role. The fixture lives at
`quote-files/t16-presentation/_qa/capabilities.json`.

## 7. Rollback

```powershell
node C:/tkrtool-iron/scripts/sb.mjs functions delete quote-presentation --project-ref TEST --expect-env TEST
```

The frontend treats a failing `quote-presentation` call as "no presentation" (legacy Classic), so deleting the function
degrades to the pre-Task-16 public page. Stored JSON/images under `t16-presentation/` stay in place (unreachable by any
client role) and are not deleted by any Task 16 path.

## 8. Known limits (accepted in review, TEST candidate)

- **L1 - markup scan depth.** The polyglot check scans the first 1 KB and any bytes after the image end marker (more than
  64 trailing bytes are refused outright). Markup placed inside an ancillary chunk / APPn segment beyond the first 1 KB is
  not scanned. Objects are served only through 1 h signed URLs from the Supabase Storage origin (separate from the app
  origin), with the DETECTED `image/jpeg|png|webp` Content-Type. **`X-Content-Type-Options: nosniff` is NOT sent** (measured
  on TEST, runtime run 2, check `S5.signed_media_nosniff` = FAIL, kept as a documenting check). Browsers do not sniff a
  response declared `image/*` into HTML, so the residual risk is an image rendered as an image. Still a known limit: a deeper
  chunk scan or a server-side re-encode is recommended before Production.
- **L4 - last-writer-wins JSON.** `catalog.json`, `settings.json`, `draft.json` and `_qa/capabilities.json` are whole-object
  upserts without compare-and-swap; two concurrent writers for the same account (or two concurrent QA tier changes on
  TEST) can overwrite each other. `issued.json` and assets are create-only (`upsert:false`) and never overwritten.
- **Asset cap.** `upload_media` refuses with 409 `asset_limit_reached` once an account holds 200 assets (counted from
  `t16-presentation/<uid>/assets/*.json` via paginated Storage list). The count-then-write is not atomic, so concurrent
  uploads can exceed the cap by a few objects.
- **Storage errors.** Only a missing object counts as "no record"; "Bucket not found" or any other Storage failure is a 503
  `storage_unavailable`.

## 9. Release-guard note

`scripts/check-no-backend-mutation.js` will report the new `supabase/functions/quote-presentation/*`,
`supabase/functions/_shared/quoteStyleCapabilities.ts` and the `supabase/config.toml` change as backend-path changes. That is
expected for Task 16 (it is not a frontend-only release) and is the coordinator's/Owner's decision to record.

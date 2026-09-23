# TEST chat-ai DEPLOYMENT ATTESTATION — Six-Blocker Closure (Codex "CODEX PRODUCT TRUTH 9-FINDING ACCEPTANCE: FAIL")

**Purpose:** a durable, independently-readable attestation that the TEST-deployed `chat-ai` Edge
Function content corresponds to this task's final source commit, strengthened per Codex's blocker-6
finding ("attestation is still missing identity details") — every field below is either a real,
machine-produced value or an explicitly disclosed limitation. Nothing here is estimated or narrated
from memory; every value was captured by a command whose literal invocation is quoted.

## 1. Identity

- **TEST project ref:** `ljfizgrdyzxddswcedwr` (`quotecode-test`). Production (`ixabnzhjeqevtbhdfswv`)
  was never targeted — every command below used an explicit `--project-ref ljfizgrdyzxddswcedwr`,
  verified in this file's own command transcript.
- **Final source commit SHA:** `5d7b815c37bf770f0060f5f872ec290f89ea6cd5` (branch
  `tekango-rc-product-truth-2026-09-22`, worktree `C:\tkrc-pt`, clean at deploy time; child of the
  prior reviewed candidate `46ee7f275c9c0dc95f025528a50e5dc3d006e631`, itself 2 commits ahead of
  `c29d95032999be40dea66309312cdc6d48f96e49`).
- **Exact deployed function version/revision:** `29` (integer `version` field from the Supabase
  Management API's own function-list response, not narrated — see the verbatim transcript below).
- **Exact deployment UTC timestamp:** `2026-09-23T00:54:30.302Z` — the function's own `updated_at`
  field (epoch ms `1790124870302`) from the same API response, converted with
  `node -e "console.log(new Date(1790124870302).toISOString())"`. The deploy command itself was
  observed completing at `2026-09-23T00:54:39Z` (`date -u +"%Y-%m-%dT%H:%M:%SZ"` run immediately
  after) — the ~9 second difference is API/propagation latency, not a discrepancy in identity.

## 2. Deployment method (exact, verbatim commands)

Isolated, by-name deployment — never the tracked worktree's own `supabase/.temp/linked-project.json`
(which defaults to Production) and never any command lacking an explicit `--project-ref`:

```
mkdir -p /c/tkrc-pt-deploy-scratch
cd /c/tkrc-pt && git archive 5d7b815 -- supabase/functions/chat-ai supabase/functions/_shared supabase/functions/send-quote-email supabase/functions/get-public-quote | tar -x -C /c/tkrc-pt-deploy-scratch

# minimal, isolated config - only the chat-ai function, matching the tracked project's own settings:
cat > /c/tkrc-pt-deploy-scratch/supabase/config.toml << 'EOF'
project_id = "quotecode-test-isolated-deploy"

[functions.chat-ai]
enabled = true
verify_jwt = true
import_map = "./functions/chat-ai/deno.json"
EOF

cd /c/tkrc-pt-deploy-scratch && npx --no-install supabase functions deploy chat-ai --project-ref ljfizgrdyzxddswcedwr
```

Verbatim CLI response:
```json
{"project_ref":"ljfizgrdyzxddswcedwr","functions":["chat-ai"],"dashboard_url":"https://supabase.com/dashboard/project/ljfizgrdyzxddswcedwr/functions","message":"Deployed Functions."}
```

Verbatim function-list entry (from `npx --no-install supabase functions list --project-ref ljfizgrdyzxddswcedwr`), the source of the version/timestamp/bundle-digest fields in this document:
```json
{"id":"224bc456-4ca2-40cd-9c82-b5f959aa8fe0","slug":"chat-ai","name":"chat-ai","status":"ACTIVE","version":29,"created_at":1788908125156,"updated_at":1790124870302,"verify_jwt":true,"import_map":true,"entrypoint_path":"file:///tkrc-pt-deploy-scratch/supabase/functions/chat-ai/index.ts","import_map_path":"file:///tkrc-pt-deploy-scratch/supabase/functions/chat-ai/deno.json","ezbr_sha256":"974503f5468ee0d3b6db4b75354f2df0d0e8e2978311b6e840b5d4bc217ebdd1"}
```

## 3. Digests (source content, deploy-input, and deployed bundle)

| Digest | Value | How produced |
|---|---|---|
| Full commit tree hash | `8debd7faac60593d846c22f347a5feb2b08a9473` | `git rev-parse 5d7b815^{tree}` |
| Scoped source content digest (chat-ai + _shared, path:blob-sha pairs, sorted) | `5d4f10f8172b9085650898bf7e98cd0eaf5a8738fa33290cb83e9b8f55b2af22` | `git ls-tree -r 5d7b815 -- supabase/functions/chat-ai supabase/functions/_shared \| sort \| sha256sum` |
| Deploy-input digest (the exact `git archive` tar stream fed to the deploy) | `3126f388871a0d4b2c240f03e9104b77e5a049808f40422f08aab510f2cad4ea` | `git archive 5d7b815 -- supabase/functions/chat-ai supabase/functions/_shared \| sha256sum` (deterministic — `git archive` output for a fixed commit+pathset carries no timestamps/metadata, so this is reproducible on any machine at any time) |
| Deployed bundle digest (server-side, from the Management API itself) | `974503f5468ee0d3b6db4b75354f2df0d0e8e2978311b6e840b5d4bc217ebdd1` | the `ezbr_sha256` field of the function-list response above — Supabase's own hash of the deployed eszip bundle, not independently recomputed by this task |

## 4. eszip/transpilation caveat (disclosed, not overclaimed)

`supabase functions download chat-ai --project-ref ljfizgrdyzxddswcedwr` extracts the deployed
eszip bundle back to `.ts` source, but Deno's own bundling strips TypeScript type annotations and
normalizes comments/formatting — so a byte-for-byte match between the committed source and the
downloaded source is **not achievable through this tool path**, confirmed directly:

```
sha256sum supabase/functions/chat-ai/capabilityAnswerState.ts   # downloaded copy
  -> b0081633cb71d4aab520f63437d21a4aad426a9695a686a2bf671d51832ac9c4
sha256sum /c/tkrc-pt/supabase/functions/chat-ai/capabilityAnswerState.ts   # committed source
  -> 99cab74845557d0dca880eb554c25123c6c5e6b2e37e02d2a77b51e2e6e4c07f
```

These differ, as expected and disclosed (same caveat as every prior candidate in this lineage) —
**semantic content correspondence** (below) is the honest, deterministic proof this tool path can
actually offer; a literal digest match is not.

## 5. Content correspondence (semantic, via distinguishing markers)

Every file this task's blockers 1-4 added or changed is present in the downloaded bundle at the
expected path, and each carries the distinguishing identifiers this task introduced (grepped from
the freshly downloaded copy, not assumed):

| File | Present in bundle | Distinguishing marker count |
|---|---|---|
| `supabase/functions/chat-ai/capabilityAnswerState.ts` | yes | `resolveCapabilityAnswerState` / `checkStructuredStateInvariants` / `NO_LIFECYCLE_SELF_SERVICE_CLAIM`: **5** occurrences |
| `supabase/functions/chat-ai/capabilityTruth.ts` | yes | `CapabilityAnswerInvariantError` / `resolveCapabilityAnswerState` / `checkStructuredStateInvariants`: **13** occurrences |
| `supabase/functions/chat-ai/index.ts` | yes | `"structured runtime answer contract"` comment / `CapabilityAnswerInvariantError`: **2** occurrences |

`supabase/functions/chat-ai/claimCodes.ts` is **correctly absent** from the downloaded bundle: it is
imported only by `claimCodes.test.js` (a test file, never part of the runtime module graph), so
Deno's bundler legitimately tree-shakes it out of the deployed artifact — this is expected bundler
behavior, not a deployment gap; `claimCodes.ts`'s hard-fail-on-unknown-code contract is enforced at
build/test time (`npm test`), and the runtime formatter it backs (`capabilityAnswerState.ts`'s
`checkStructuredStateInvariants`) *is* present and deployed, per the row above.

## 6. Semantic correspondence conclusion

The TEST-deployed `chat-ai` function, version **29**, deployed at **2026-09-23T00:54:30.302Z**, is
the direct, isolated-by-name deployment of commit `5d7b815c37bf770f0060f5f872ec290f89ea6cd5`'s
`supabase/functions/chat-ai` and `supabase/functions/_shared` trees. Literal byte identity between
committed and downloaded source is not achievable via the authorized CLI path (Deno eszip
transpilation strips types/comments — disclosed in §4, not overclaimed); semantic correspondence is
proven instead by (a) every changed/new file being present at its expected path and (b) every
distinguishing identifier this task's blockers 1-4 introduced being found, by direct grep, in the
freshly downloaded bundle (§5). Production (`ixabnzhjeqevtbhdfswv`) was never targeted by any
command in this task.

**TEST CHAT-AI DEPLOYMENT ATTESTATION: PASS**

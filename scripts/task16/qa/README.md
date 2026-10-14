# Task 16 — responsive and output QA scripts

These are QA tools only. The app never imports them. Every script uses the repository's own Playwright install with headless Chromium. Each check is recorded in the output JSON as `PASS`, `FAIL` or `NOT TESTED`, together with a `detail` that lets you reproduce it.

| Script | What it checks |
|---|---|
| `qa-public-sample.mjs` | Opens `/he/sample-quote` and `/en/sample-quote` (`?style=&length=&detail=&images=`) at 1440x900, 390x844, 320x640, 768x1024, 1024x768, 820x1180 and 1180x820, plus the near-breakpoint widths 640, 641, 767, 769 and 1023. Per cell it checks: no horizontal overflow (the widest offending elements are listed), exactly 4 visible `thead th`, table-body text of at least 12px at 320 and 390, no action tiles, dialog or canvas inside `.pq-card`, every `<button>` inside `.pq-card` reported (only `aria-expanded` disclosure toggles pass), the viewport meta still allows zoom, images loaded when `images=1` (and no media area when `images=0` or the style is Classic), the `pq-style-<style>` class, and rtl/ltr direction. |
| `qa-print-pdf.mjs` | For each locale × style × short/long sample, under print-emulated media it checks: `.pq-card` is visible, no visible controls, `thead` is `table-header-group`, and the totals and signature/approval blocks are present inside the card and not clipped. It also saves an A4 `page.pdf` and counts its pages; the long sample must run to more than one page. Finally it tests the page's own **Download PDF** button (print-mode chooser → `generateQuotePdf` → download event), and reports `NOT TESTED` if the sample page hides that button. |
| `qa-app-persona.mjs` | Logs in as a persona, creates a new quote with a `T16 QA …` client and 2 items, and picks a style card and a detail option (`qp-quote-style-select-*` / `qp-detail-*`, or `t16-*`, read through `aria-pressed`; locked styles are skipped; `make default` is never clicked). It then resizes 768x1024 ⇄ 1024x768 and 820x1180 ⇄ 1180x820 with `setViewportSize` (no reload) and checks that the client, items, style and detail are unchanged. If the page itself reloads mid-sequence (for example a dev-server reload), that step is reported `NOT TESTED`, not `FAIL`. It also checks that Escape closes the add-item dialog and returns focus to its opener, the side of the mobile drawer (HE right, EN left; `NOT TESTED` when the shell uses the bottom navigation), and 44px touch targets at 390. |
| `run-qa.mjs` | Runs the selected suites and writes `<out>/summary.json`. |
| `lib.mjs` | Shared helpers. |

## Running

```
# against the coordinator's server (QA never starts or stops anything on 5186)
node scripts/task16/qa/run-qa.mjs --base-url http://localhost:5186 --only public,print,persona --out <dir>

# with a disposable local server (127.0.0.1, port 5400-5449 only, stopped afterwards)
node scripts/task16/qa/run-qa.mjs --serve 5417 --only public,print

# a single suite
node scripts/task16/qa/qa-public-sample.mjs --base-url http://127.0.0.1:5417 --combos full --shots all
```

Options:

- `--out <dir>`: output directory. The default is the session scratchpad `.../scratchpad/qa/`.
- `--locales he,en`
- `--styles classic,modern,visual`
- `--combos default|full`: `default` runs short/compact/images, long/expanded/images and short/compact/no-images per style. `full` runs all 8 combinations.
- `--shots named|all|none`
- `--reload-per-viewport`
- `--no-direct-pdf`
- `--personas LOCAL_PRO,INTL_PRO`: only allowlisted personas (see IRON-DATA-001 below)
- `--env <file>`: the persona env file. The default is `C:/tkrc-pt/.env.localtest.local`.
- `--allow-writes`: without this flag the persona suite never saves.
- `--locked-personas INTL_EUR,INTL_GBP,PERSONA_SUPER_ADMIN`: runs the locked-style check for lower-tier personas (INTL_EUR = classic tier, INTL_GBP = modern tier, PERSONA_SUPER_ADMIN = classic tier). It checks that locked styles are marked, that choosing one opens the explanation dialog without selecting it, and that Escape closes it and returns focus. No writes.

With `--allow-writes`, each persona also runs the full flow:

1. Uploads one image (`public/task16-samples/shelf.png`).
2. Saves a draft (client `T16 QA <persona> <stamp>`, client type Private).
3. Reopens it from the quote list and checks that style and media were restored. Detail is a preview/print preference and is not persisted.
4. Repeats the orientation transitions on the reopened draft.
5. Issues the quote.
6. Opens the public link anonymously and checks style, direction, 4 columns, loaded media, no buttons inside the card and no overflow at 1280, 390 and 320.
7. Runs Direct PDF (download event) and Print (stubbed `window.print`, plus print-emulated checks and an A4 PDF).

Screenshots mask any element showing the persona e-mail. PDFs cannot be masked: the business header in `*-public-print.pdf` and `direct-*.pdf` can show the business e-mail, so keep those files out of git.

Exit code: 0 when there is no FAIL, 1 when any check FAILs, 2 when a script error stops the run.

## Credential safety (persona suite)

- Persona e-mail addresses and the password are read from the env file and passed only to `fill()`. They are never printed, logged or written to disk. Every output string goes through a redactor before it is written.
- The suite refuses to run unless the env file's `VITE_SUPABASE_URL` is the TEST project.
- The browser aborts any `auth/v1/token` request that is not addressed to the TEST project.
- No screenshot is taken while the login form holds a value.
- Writes happen only with `--allow-writes`, which saves one quote whose client name starts with `T16 QA`.

## Design fidelity (`fidelity-compare.mjs`)

This compares the approved reference (`evidence/task-16-quote-experience-v2/revision-r2-refined/`) with the candidate at 1440x900, 1180x820, 1024x768, 820x1180, 768x1024, 390x844 and 320x640.

- **Landing:** `landing-he.html` / `landing-en.html` vs `/he` and `/en`.
- **Documents:** `R2.quote()` rendered with the reference CSS vs `/<locale>/sample-quote?style=…`.
- **App** (persona login, no writes): `index.html?view=plans` management/creator vs the dashboard and the new-quote editor.

Each cell writes `ref/`, `cand/` and a labeled side-by-side `composites/*.png` (reference left, candidate right).

Assertion kinds:

- **calibrated:** the same detector must pass on the reference; otherwise the cell is NOT TESTED. Covers page background luminance (light), teal accent on the primary CTA, no legacy purple in hero/header, a split hero with a large quote document, header logo side, light document, 4 table columns, and app background, sidebar side and teal accent.
- **comparison:** header navigation labels in the reference order (75% or more ordered match).
- **policy:** Owner clarifications that supersede the reference. Each metadata label and its value are centered in their cell, there is no rule above the metadata, and the quotation title is not centered. Readable text must be 12px or larger (scaled document previews excluded).

```
node scripts/task16/qa/fidelity-compare.mjs [--base-url http://localhost:5186] [--surfaces landing,docs,app] [--viewports 1440x900,390x844] [--out DIR]
```

Output: `<out>/fidelity-matrix.json` with totals, per-assertion counts, every FAIL with the composite path, and per-cell reference and candidate values.

## IRON-DATA-001 persona allowlist

Every persona sign-in in `scripts/task16/qa/` goes through `assertAllowlistedPersona()` in `lib.mjs` first. This covers qa-app-persona, fidelity-compare, verify-presentation-runtime, long-fixture-evidence and signature-lifecycle. The check is fail-closed:

- sha256(lowercased e-mail) must be in `C:/tkrtool-iron/scripts/iron-laws/synthetic-personas.json` `testPersonas`.
- The address must match no `denylistPatterns`.
- The persona key must not be LOCAL_BASIC, INTL_BASIC, INTL_FREE, LOCAL_FREE, LOCAL_ADMIN, *_EXPIRED or ABANDONED_FREE.
- An allowlist file that is missing or unreadable refuses the sign-in.

Allowed personas: LOCAL_PRO (HE, entitled), INTL_PRO (EN, entitled), INTL_EUR (EN, classic tier), INTL_GBP (EN, modern tier) and PERSONA_SUPER_ADMIN (HE, classic tier, admin navigation). Error messages carry key names only, never addresses.

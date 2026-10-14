# Task 16 cloud gates (LOCAL-DEV)

Two browser gates check the Owner corrections of 2026-10-05:

- `public-quote-outputs.mjs` checks the public quote outputs.
- `layout-regression-gate.mjs` checks the landing, the quotation header band and Quote History.

Both run real Chromium against a **production-mode build** served on `127.0.0.1`. The backend is never contacted:

- the build points at a dead local Supabase URL (`http://127.0.0.1:54399`);
- every request to it is answered by Playwright route mocks;
- the mocks carry **synthetic** data only (`src/quoteDocument/sampleQuotes.js` DTOs, and one synthetic account per market).

No persona is used, and there is no TEST or Production contact.

**What a PASS does not mean.** A PASS is LOCAL-DEV evidence with mocked functions. It is **not** a TEST verification. It is
**not** the official IRON-MOBILE-WIDTH-001 / IRON-QH-LAYOUT-001 / IRON-PRINT-001 gates. It is **not** Owner acceptance.
Three things stay NOT VERIFIED here:

- a real issued TEST quote;
- signing;
- the Owner's own devices.

## Exit codes

| code | meaning |
| --- | --- |
| 0 | every cell PASS |
| 1 | at least one FAIL cell; every FAIL is printed with its measured detail |
| 2 | setup error: missing arguments, a non-local URL or port 5186, or Chromium cannot launch (public-quote gate only) |

Each gate writes a JSON report with every cell as `{ id, result: PASS|FAIL, detail }`.

## Environment (cloud)

```bash
export PATH=/tmp/claude-0/node-22.22.2/bin:$PATH
export PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome   # optional; otherwise Playwright's own Chromium
```

The public-quote gate also needs `pdfinfo`, `pdftotext` and `pdftoppm` (poppler-utils).

Ports: use `127.0.0.1` only, and never port 5186. Cloud agents use the 41840-41849 range. Stop every server when you are done.

## Build and serve

Build from the tree under test:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54399 VITE_SUPABASE_ANON_KEY=test-anon \
  npx vite build --outDir /tmp/claude-0/a5/build --emptyOutDir

# production build (both gates)
npx vite preview --outDir /tmp/claude-0/a5/build --host 127.0.0.1 --port 41841 --strictPort &

# dev server of the same tree (public-quote gate only)
VITE_SUPABASE_URL=http://127.0.0.1:54399 VITE_SUPABASE_ANON_KEY=test-anon \
  npx vite --host 127.0.0.1 --port 41840 --strictPort &
```

The dev server serves `sampleQuotes.js` as an ES module, which the gate imports to build its DTOs.

## public-quote-outputs.mjs

```bash
node scripts/task16/qa/public-quote-outputs.mjs http://127.0.0.1:41840 http://127.0.0.1:41841 /tmp/claude-0/a5/out/pq
# PQ_IMAGES=1 → images on only; PQ_IMAGES=0 → images off only; unset → both (48 cases, about 2 minutes)
```

Output:

- the report: `<out>/public-quote-outputs-gate.json`, with cells, raw measurements, the expectation table and the thresholds;
- the PDFs: `<out>/pdf/*-print.pdf` and `*-direct.pdf`.

The gate opens the real route `/quote/:id` (SmartPublicQuote → PublicQuote / PublicQuoteEn) at 1280×900. It mocks
`get-public-quote` and `quote-presentation`. It runs every combination of:

- HE / EN;
- Classic / Modern / Visual;
- short / long;
- images on / off.

The main case has a business phone and an Attn contact (`attn_name` + `attn_role`). Short cases also run two variants:

- `/nophone`: no business phone;
- `/nocontact`: `attn_name` and `attn_role` are null.

| cell | rule |
| --- | --- |
| `screen/band-dark` | `.pq-lh-band` background luminance < 80 on screen |
| `tiles/count-4-with-phone` / `tiles/count-2-without-phone` | exactly 4 / 2 `.pq-action-tile` |
| `tiles/in-card-no-output` | the action tiles sit inside `.pq-card` at the base position (D21a rollback, cloud-fix4) and are screen-only: inside `.no-print` and `[data-html2canvas-ignore]`. Their absence from Print and the Direct PDF is checked by `print/no-ui-text` and `direct/no-ui-captured`. |
| `recipient/client-block` | `[data-role="client"]` opens with the label `לכבוד` / `To` (rendered text, case-insensitive, so a CSS `TO:` passes) and contains the client name |
| `recipient/contact-block` | `[data-role="contact"]` opens with the label `לידי` / `Attn` and contains `attn_name` (main case) |
| `recipient/no-contact-block` | no `[data-role="contact"]` and no `לידי` / `Attn` label (`/nocontact`) |
| `recipient/business-not-in-role-blocks` | the business name is in no recipient `[data-role]` block (`client`, `contact`, or any `[data-role]` inside `.pq-parties`); at least one block must exist |
| `table/numeric-columns-centred` | every `th`/`td` of the Quantity, Unit price and Amount columns of `.pq-card` tables (found via `col.pq-col-qty/price/total`; colspan cells skipped): the centre of the text-ink box (union of the text-node rects) is within ≤ 1px of the cell centre |
| `totals/right-edge-aligned` | right edges of the `.pq-totals-box .pf-money` ink spread ≤ 0.75px |
| `print/band-white-text-dark` | print media emulation: band background white (or transparent) and every band text colour luminance < 110 |
| `print/pages` | Print PDF (`page.pdf`, A4) page count = `EXPECTED_PAGES` |
| `print/approval-on-last-page` | approval title and copy (`אישור ההצעה` + `חתימה מאשרת את תנאי ההצעה` / `Quote approval` + `Signature confirms the quotation terms`) on the last page |
| `print/no-ui-text` | Print PDF text has none of the action-tile, sign-panel or sample-toolbar labels (`הורד כ-PDF`, `הדפס מסמך`, `Download PDF`, `Print`, …) |
| `direct/pages` | Direct PDF page count = `EXPECTED_PAGES` (the real "download PDF" tile → Compact → downloaded file) |
| `direct/header-white` | page 1, top 30%, 30 dpi greyscale: dark-pixel (< 90) fraction < 0.05. This is the Direct PDF "as today", a white letterhead; the Owner has not decided otherwise |
| `direct/no-ui-captured` | at the moment `.pq-pdf-capturing` is set, `.pq-card` holds no visible input, textarea, select, canvas, tile or toolbar, and its text has no UI label. The Direct PDF is a raster, so any text layer it has is also scanned |
| `direct/state-restored` | after the download, `.pq-pdf-capturing` is removed and the screen band is dark again |

`EXPECTED_PAGES` is the approved pagination table in the script. It records the behaviour measured in
`cloud-fix-2026-10-05/evidence/runtime/public-quote-outputs*.json`:

- short = 1 page, for Print and Direct PDF;
- long = 2 pages, for Print and Direct PDF;
- in HE and EN, in all 3 styles, with images on and off.

**Pending work.** Two groups of cells depend on Task 16 work that may not be merged yet:

- the `recipient/*` cells need the `data-role` hooks in PublicQuote / PublicQuoteEn;
- the `table/*` cell needs the centred item columns (Owner decision 2026-10-05).

Until that work lands, these cells FAIL by design.

## layout-regression-gate.mjs

```bash
node scripts/task16/qa/layout-regression-gate.mjs http://127.0.0.1:41841 /tmp/claude-0/a5/out/layout-regression-gate.json
```

It takes about 75 seconds and covers three areas.

**Landing, HE / EN at 320 / 360 / 390 / 412 / 768 / 1024 / 1440:**

- no visible language switch, in the header or in the drawer;
- canonical, hreflang and auth links kept;
- HE: logo and action group on the right. EN: logo left, actions right;
- no centred section text;
- no horizontal overflow;
- footer clear of the AI launcher.

**Quotation header band, `/sample-quote` in 3 styles × HE / EN × 390 / 1440:**

- band black on screen, with white name text;
- title outside the band, metadata centred;
- no overflow;
- at 1440, print emulation: band white with dark text;
- the `.pq-pdf-capturing` class keeps the white band.

**Quote History, mocked synthetic account per market, at 320×780 … 1180×820 (phones and tablets in both orientations):**

- Export CSV on the title row;
- greeting card on one row (≤ 768) and dark;
- text never below 12px;
- no overflow;
- `list-room-vs-base`: the list viewport must be **≥ the pre-Task-16 base** (c65f742) at every viewport. The former 50px
  tablet tolerance (`TABLET_RESIDUAL_PX`) was removed on 2026-10-05. Tablets now follow the same parity rule as phones.

## Negative controls

Run negative controls only in a scratch worktree, never in the main tree:

```bash
git worktree add --detach /tmp/claude-0/a5/neg HEAD
ln -s "$PWD/node_modules" /tmp/claude-0/a5/neg/node_modules
```

Then:

1. Inject defects in the scratch worktree.
2. Build it with the 54399 environment.
3. Serve the build on a free port in 41840-41849.
4. Run both gates against it. The defect's cells must FAIL and the exit code must be 1.
5. Remove the worktree: `git worktree remove --force /tmp/claude-0/a5/neg`.

## Round 3 additions (2026-10-05)

The sections above describe the round-2 gate. These changes supersede them where they differ.

**`public-quote-outputs.mjs`:**
- `PQ_VIEWPORTS=WxH,...` runs the viewport matrix.
- New cells:
  - `screen/no-overflow`;
  - Print roles from `pdftotext -bbox`: `print/role-client`, `print/role-contact`, `print/no-forbidden-role-labels`, `print/business-letterhead-only`, `print/no-contact-block`;
  - capture-time DOM roles: `direct/role-*`, `direct/no-contact-block`, `direct/business-not-in-role-blocks`.
- The no-contact variant also runs Print and Direct PDF.
- Expected pages: Modern short with images = 2 (base attachments container + base client name; reason in the script).

**`qa-print-pdf.mjs`:**
- Short page counts are asserted (Classic/Visual = 1; Modern recorded).
- Fails on a blank page, a footer-only page or an approval-only page.
- Requires approval on the last page with content, and every fixture row present.

**`print/print-pagination.mjs`:** public-route pagination gate (native Print + Direct PDF) on synthetic fixtures. It covers short, test-like, 18 and 40 rows.

**`print/long-amounts.mjs`:** 7/8-digit amounts and decimal quantities, HE/EN × 3 styles × 320/360/390/1280.
- It fails on overflow, clipping, a split number, a font below 12px, a missing value, centring off by more than 1px, or a totals spread above 0.75px.
- 24 cells FAIL by design: description column under 60px at 320. This is UNRESOLVED.

**`print/direct-pagination.mjs`:** reproduces the Direct PDF slicing and fails on an orphan approval or footer slice.

**`renderer-matrix.mjs`:** landing illustration + `/:lang/sample-quote`. Checks roles, centring, totals axis and overflow at 320–1280.

**`layout-regression-gate.mjs`:** Quote History, 6 fixtures (including 8-digit revenue) × HE/EN × 10 viewports, against real base geometry (`qh/base-c65f742.json`). It fails on:
- list room or visible rows below base;
- greeting growth;
- a clipped amount;
- text below 12px;
- a control smaller than base;
- overlap or overflow;
- any metric block.

**`fidelity/dark-scope-gate.mjs`:** light/dark per region vs base `c65f742`. Every dark allowance needs provenance. `dark-unresolved` regions (the landing closing band) FAIL while dark.

**`fidelity-compare.mjs --app-mode mock`:**
- Role-based nav checks, with a sourced override for the removed language switch.
- Per-region light checks.

## Round 4b additions (2026-10-06, after the Codex review of `5117916`)

- **`a11y/table-semantics.mjs`** (new, A12): reads the Chromium accessibility tree (CDP `Accessibility.getFullAXTree`) plus the rendered positions of the item table. Scope: public, sample and creator preview × HE/EN × flat / collapsed / expanded × 320 / 390 / 1280.
  - Cells:
    - `ax-structure`: table → row → columnheader / cell; no ignored cell.
    - `header-association`: each value cell's `headers` resolves to its own `th scope=col`, and the cell is drawn in that column.
    - `reading-order`: description → quantity → unit price → amount.
    - `cell-names`: every header and value cell has a non-empty accessible name.
  - Exit 1 on any FAIL, 2 on a setup error.
  - Usage and negative controls: see the header comment and `docs/task16-quote-experience-v2/cloud-fix4b-2026-10-06/a12/`.
  - Firefox / WebKit: **NOT TESTED** (not installed in the cloud).
- **`a11y/visual-identity.mjs`** (new, A12): compares the document-card screenshots of two builds byte for byte.
- **Dark scope, the dark-pocket rule** (A18; `fidelity/darkscope.mjs`, `fidelity/common.mjs`, policy v2). Each surface gets a `<surface>.dark-pockets` row.
  - **Detection:** dark pixels (luma < 0.35) in 4px blocks, a morphological opening with an S×S square (S = max(16, ceil(0.25 × the largest font))), then 4-connected components.
  - **Excluded:** Owner-approved dark regions (greeting card, issuer band), base dark-allowed regions, embedded media and the UA scrollbar gutter.
  - **Attribution** by the element that paints the pocket:
    - an accent control (chroma ≥ 0.15) passes;
    - a near-black control is `black-control` and FAILS;
    - a section, footer or canvas is `surface` and FAILS;
    - text inside a line box passes, as does an icon (svg ≤ 48px);
    - anything else is `unpainted` and FAILS.
  - **Footer:** `landing.footer` is now rule `light` (OWNER-FOOTER-LIGHT-4B). The base/reference dark footer and closing provenances are kept under `supersededProvenance` only.
- **fidelity `landing.pageBackgroundLight`:** now an Owner policy judged on the candidate (it was reference-calibrated and NOT TESTED because the reference is dark).
- **fidelity APP-PALETTE-BASE v2** (A18). `noLegacyPurple` requires all three:
  1. every violet-painted element matches a base element of the same cell;
  2. every solid violet component is inside a violet element or within 24px of a base component;
  3. purpleFrac ≤ base + min(0.25 × base, 0.005).

  The absolute `purpleTolerance` is gone. Base inventory: `fidelity/app-palette-base.json`, recorded with `--record-palette-base`.
- **`long-amounts` `min-font-12`** (A18, H2): only the exact `PdfFileIcon` glyph is excluded (viewBox 0 0 24 24; children path, path, text; the lucide path data; x 12 / y 17.5 / font-size 6.2; box ≤ 48px), via `print/pdfIconGlyph.mjs`. Every other SVG text is judged at its rendered size.
- **Print expectations bound to fixture content** (A13):
  - `print/fixtures.mjs` `contentFingerprint` gives rows, images and a sha256 of the content.
  - `public-quote-outputs` `FIXTURE_BINDING` + `fixture/bound`.
  - `print-pagination` `print/waiver-bound`.
  - `qa-print-pdf` `SAMPLE_BINDING` + `fixtureBound`.
  - Modern/Visual short with images = 1 page (S-REJ), with a `grow` negative variant (4× rows, 2× media) that must reach ≥ 2 pages with every row and image kept.
  - `print/every-image-printed`.

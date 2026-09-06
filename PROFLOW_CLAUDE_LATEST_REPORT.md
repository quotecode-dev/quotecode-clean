# PROFLOW — Claude Latest Report

**This file is a REPORT TRANSPORT / REVIEW BRIDGE only.** It is synchronized to the `proflow-continuity` branch, a documentation-only orphan branch verified safe to push (no Vercel deployment consequence). It does **not** replace `PROFLOW_CHAT_HANDOFF.md`, `PROFLOW_HANDOFF.md`, `PROFLOW_TODO.md`, `PROFLOW_PROJECT_CONTEXT.md`, or `PROFLOW_ARCHITECTURE.md`, and it does **not** prove current filesystem/git/runtime state by itself.

**GOLDEN RULE: LATEST CLAUDE REPORT ≠ FRESH LOCAL STATE.** See `PROFLOW_PROJECT_CONTEXT.md` §17.C/§17.J.

## Task: Replace the Four Frame-Based Teasers with Two TV-Commercial-Style Product Films

**MODE: TEST/local-only. Authorized: local source/assets, synthetic recording, video production/encoding, landing-page preview integration behind the existing hidden gate, tests/lint/build, continuity documentation. NOT authorized: application commit/push, deployment, Production/LIVE change, publicly enabling the videos, database/schema/RPC change, real customer data, real email/WhatsApp/SMS, payments/invoices.**

Continuity bootstrap performed first: re-read all six canonical files' relevant tails plus this checkpoint in full; confirmed Fresh Local State (`git status` 78 entries, `HEAD` unchanged at `main`/`f3b59d0`) matched exactly where the prior "Final Landing Polish" task left off — no drift.

**This task is reported as: both films implemented, muxed, captioned, and integrated behind the existing hidden gate, and locally verified to the full extent this environment can automate. It is NOT reported as fully accepted — Owner Final Visual Acceptance is explicitly PENDING, and the public gate has not been flipped.**

---

## The Owner's finding that drove this task

The four teaser videos from the prior task (assembled from discrete `html2canvas` screenshots with a Ken-Burns zoom) read as "captions placed over still screenshots rather than films showing a real process" — not understandable even to someone who already knew what each video was meant to show. This task does not polish that structure; it replaces it with two complete commercial films built from genuine continuous screen-capture footage of the real, unmodified application.

## The core technical blocker, found and fixed

`browser-harness`'s own recording is a low-frequency JPEG-per-event trace, not continuous video (already known from the prior task). This task instead drives Chrome's `Page.startScreencast` CDP domain directly over a raw WebSocket (`websocket-client`, a local `pip install`), running independently alongside `browser-harness`'s own CDP session.

Two real defects blocked this before it worked:
1. **A backgrounded tab is throttled to exactly one screencast frame** — confirmed via `Browser.getWindowForTarget` reporting `windowState:"minimized"` even after `activate_tab()` and a direct Win32 `SetForegroundWindow` call. Fixed with `Page.setWebLifecycleState({state:"active"})` + `Emulation.setFocusEmulationEnabled({enabled:true})` — forces CDP-visible/focused state without depending on real OS window-manager focus. Verified before/after: 1 frame → 10+ frames for an identical interaction.
2. A threading bug in the first recorder draft (concurrent `ws.send()` calls) silently stalled the frame pipeline after ~3 frames — fixed by moving to a single-threaded poll loop.

A third defect, found while building custom scene graphics: `dir="rtl"` on `<html>` measurably shifts where a `position:absolute; left:Npx` descendant physically renders (empirically confirmed: `left:1180px` rendered at `x:1180` under `ltr`, `x:2800` under `rtl`) — fixed with an explicit `direction:ltr` on the positioning container.

## What was built

**Storyboard/script first** (`video-production/film-v2/script.md`): full bilingual six-beat storyboard (problem → introduce ProFlow → real workflow → business-to-customer → result → end card), final narration per beat, short synced captions, and a claims-vs-functionality check — written before any rendering.

**Real footage**: two brand-new synthetic sessions in the two existing TEST accounts, with a persistent `MutationObserver` redaction watcher (survives React re-renders during a live multi-second recording, unlike a one-shot swap) substituting a synthetic business identity throughout. New quotes: **A100705** (EN, "Emily Carter," "Oak Bookshelf Unit," $153.00) and **A100708** (HE, "דוד לוי," "מדף עץ אלון," ₪153.00 incl. VAT), each carried through the real guided wizard and the real, unmodified `public_approve_quote` flow with a genuine synthetic mouse-drawn signature. Two real privacy leaks were caught and fixed during review, not after: a stray "Hot Quote!" banner naming an unrelated internal quote (hidden before recording Beat E), and one English mobile-view capture taken while still authenticated (showing the wrong "Admin View" surface — discarded and re-recorded signed-out). Two WhatsApp share links were captured via an intercepted `window.open` — no real message was ever sent.

**Custom scenes**: two original HTML/CSS scenes (a "the problem" flat-lay with a generic chat bubble/calculator/sticky notes, and a logo reveal/end-card reusing `ProFlowLogo.jsx`'s exact real gradient treatment) captured via native `Page.captureScreenshot`.

**Voice-over**: `edge-tts` (licensed Microsoft neural-voice service, not voice cloning) — `he-IL-HilaNeural` / `en-US-AriaNeural`. Beats C/D narrated as short phrases synced to individual real actions, not one continuous paragraph. No music — no safely-licensable source available; captions + narration verified sufficient for muted comprehension.

**Assembly**: real footage reassembled from captured frames with their own true per-frame timestamps (not a uniform frame rate); mobile footage composited as a large, centered, blurred-backdrop phone mockup (not a tiny floating screenshot); static scenes given a restrained Ken-Burns zoom; final mux of video + narration + burned-in synced captions; H.264 High profile, 1920x1080, 25fps, AAC, `+faststart`.

## Final specs

| File | Duration | Resolution | Size |
|---|---|---|---|
| `proflow-en-commercial.mp4` | 53.32s | 1920x1080 H.264 High | ~3.9 MB |
| `proflow-he-commercial.mp4` | 53.80s | 1920x1080 H.264 High | ~3.7 MB |

Both ~3-4s over the 40-50s target — disclosed as deliberate: Beats C/D reflect real, unaccelerated, human-legible interaction time; compressing further would reintroduce the "rapid unexplained jumps" the task explicitly forbids.

## Review performed (this environment cannot play audio/video as a human would)

Frame-by-frame visual inspection across every beat of both films; independent before/after capture of all five beat transitions (confirmed the D→E cut — full-screen phone mockup to full desktop dashboard showing the same quote now "Approved" — is an unambiguous business-owner/customer signal); stream-level duration/codec/audio verification; a structured muted-comprehension check (every beat carries an independent caption, so the full story is legible without sound).

## Landing-page integration

Both `LandingLocal.jsx`/`LandingGlobal.jsx`'s reserved video section (same position: after "How It Works," before the Features Grid) now renders **one** video card instead of four, `max-width:860px`, real `<video controls preload="none" poster aria-label>` + `<source>` + `<track kind="captions" default>`. `VIDEOS_READY` remains **`false`** — unchanged, the true public default. The existing `?previewVideos=1` local-only override (built in the prior task) was reused unchanged.

## Old assets

The four prior teaser `.mp4`/`.vtt`/poster files remain byte-for-byte on disk in `public/videos/`, untouched, simply unreferenced — per "do not permanently delete... before the Owner accepts the replacements." The prior task's entire `video-production/` workspace is also untouched; this task's new source material lives in a new, git-ignored `video-production/film-v2/` folder.

## Verification

`npx eslint` clean (0 errors). `npx vite build` succeeds (same pre-existing chunk-size advisory). `npx vitest run` **499/499 passing, 34 files** (unchanged — the gated section's structural code wasn't touched, only its data). Secret scan clean (the two TEST-account emails appear only in local, git-ignored production scripts, matching their already-established use throughout this project's tracked history). Responsive/overflow sweep at 320/360/392/430/768/1024/1440px, both locales, with `?previewVideos=1`: **zero overflowing elements at every width**. Video element confirmed keyboard-focusable with correct `controls`/`preload`/`autoplay`/`aria-label`/caption-track attributes. `git status` file count: 80 (78 + one new `video-production/film-v2/` directory entry). `HEAD` unchanged (`main`, `f3b59d0`).

## Gaps, named plainly

- Native `<video>` shadow-DOM play/pause/seek could not be fully exercised via CDP automation (a known automation limitation, not a markup defect) — attributes verified directly instead.
- Both films run ~3-4s over the 40-50s target, disclosed and justified above.
- No background music (no safely-licensable source available this session).
- The Hebrew narration speaks the brand name as a phonetic transliteration ("פרופלואו") for correct pronunciation; every on-screen instance still shows the real "ProFlow" spelling.

## Explicit statements

- **PRODUCTION/LIVE TOUCHED?** NO
- **DEPLOYMENT PERFORMED?** NO
- **APPLICATION COMMIT/PUSH PERFORMED?** NO (`HEAD` unchanged: `main`, `f3b59d0`)
- **DATABASE/SCHEMA/RPC CHANGED?** NO — two new synthetic TEST quotes (A100705 EN, A100708 HE) were created/approved entirely through the app's own existing, unmodified mechanisms.
- **REAL CUSTOMER DATA USED?** NO — synthetic identities throughout, substituted via non-persistent DOM redaction.
- **REAL PAYMENT, INVOICE, EMAIL, WHATSAPP, OR SMS TRIGGERED?** NO — share links were captured via an intercepted `window.open`, never opened.
- **ARE THE FILMS VISIBLE TO PUBLIC/DEFAULT VISITORS?** NO — `VIDEOS_READY` is `false` in both files; confirmed live (zero `<video>` elements, zero `/videos/` network requests on a plain page load).
- **OWNER FINAL VISUAL ACCEPTANCE:** PENDING. Both films are implemented and locally verified to the fullest extent this environment can automate; the actual creative/visual quality judgment the task reserves for the Owner has not been made by anyone else.

**Recovery instruction for the next session**: both commercial films are functionally complete and wired in. The only remaining step is the Owner's own viewing (ideally with real audio, which this environment cannot itself produce) and an explicit approve/reject decision — only after that should `VIDEOS_READY` be considered for flipping to `true`, and only as a separate, explicitly-authorized action.

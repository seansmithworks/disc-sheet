# disc-sheet BACKLOG

## Overnight release-prep run — dispatched 2026-08-31 (Sean asleep; stage only, NO publish)

Plan gate CLOSED: /adversarial-plan ran (Opus refuter, 14 findings, verdict revise); revised plan + unedited refutation in the session scratchpad, ledger to be copied into MORNING.md. Plan B secured: unscoped `disc-sheet` available on npm (404, checked tonight).

- [x] Phase 0a — push feat/customization-parity to origin (done 2026-08-31, upstream set)
- [x] Phase 0b — fresh baseline: vitest 15/15, Playwright 54/54 (43 geometry + 11 a11y)
- [x] Phase 1 — build system + metadata + THE GATE: vite lib build (ESM + d.ts, vite-plugin-lib-inject-css per F1, NODE_ENV define-passthrough per F2), exports dist-only (F3/F12), publishConfig access public (F6), prepublishOnly + dist gitignored (F7), audit >=10-token guard (F11), README rewrite; gate = pack tarball → fresh Next app → next build + prod Playwright + dev-warning check (DONE 80385d7: all green, dist 24.3kB+2.95kB css, 15/54/PASS)
- [x] Phase 2 — npx copy-in: zero-dep bin/disc-sheet.mjs `add`, tested in the same Next consumer, tsc green there, css-modules.d.ts collision handled (F8) (DONE 129a4a1: 18 files land, conflict guard works, consumer tsc+build green)
- [x] Phase 3 — flagship example (wave 5, unheld by Sean 2026-08-31): example/flagship.html second entry; tokens from README table not stale §2 (F4); floor per F9 = palette + portrait + copy/actions + CloseMask + reduced-motion, cuts stated; example/main.tsx untouched (geometry-gate substrate) (DONE ea34cd9: captures eyeballed by orchestrator, 15/54/PASS held)
- [x] Phase 4 — experience audit: 13 mechanical found+fixed (M2 escalated to Opus, deltas now 0.1-0.4px), taste strawmen applied, #6 focus-restore parked for Sean ("no shitty experiences"): ONE combined design-review + emil-design-eng pass (trimmed per F13), captures (morph, six anchors, reduced-motion, 390x844); mechanical fixes applied, taste calls parked below
- [x] Phase 5 — ce-code-review: 5 reviewers + validator, 6/6 findings confirmed AND fixed (headline: dist lacked "use client"), README RSC note added, MORNING.md written. Final: vitest 20/20, Playwright 69/69 x3, audit PASS

## Publish hold LIFTED 2026-08-31 (fix 1be78ac, gates 75/75 x3)

- [x] Resting-disc squircle after interrupted close (reopen-mid-close -> Escape -> rest leaves the disc surface with a sheet-ish radius; content stays round). Found by Sean on the demo videos, confirmed on end-frame pixels (scratchpad demo/end-*-disc.png). Fix + geometry gate (review finding #8 resurrected) dispatched to the T1 motion agent. Fixed: close radius-delay gate removed (never opened — 1.5s delay vs ~1.15s close), stale inline border-radius now cleared when the binding drops; geometry test (o) covers 4 close variants x 2 motion modes.

## Waiting on Sean (morning)

- [ ] `npm login` then `npm publish --access public` (token expired 2026-08-31, verified 401)
- [ ] Merge feat/customization-parity → main
- [ ] Review flagship captures + parked taste calls (added by Phase 4)
- [ ] `/model` default is now Fable 5 for ALL new sessions (saved by tonight's `/model fable`) — re-pick daily default per your own escalation-only rule

## Taste strawmen applied overnight (auditor-recommended, all one-line reversible — veto any)

- T1 whisper line at rest ("Sean Smith — tap the disc. Drag it anywhere.")
- T2 Resume handle "PDF" → "seansmithdesign.com/resume" (label was factually wrong; href is a page)
- T3 mobile sheet title 16px → 20px
- T4 X-row icon deduped from the close ✕
- T5 cursor:grab kept (auditor rec)

## Parked (off-objective, noticed tonight)

- example/ `evidence/` dir + untracked test-results/ hygiene beyond gitignore
- Site-side cutover (seansmithdesign.com consuming the package) — wave 5's other half, separate run

## v0.2 candidates (Sean, 2026-08-31 morning review)

- **Shape presets** — circle / squircle / square as first-class out-of-the-box options. The dial exists (`--disc-sheet-disc-radius`), but the SHARED CONTENT must mask to the same shape or it reads broken (the accidental squircle looked wrong only because the portrait stayed circular). Needs: child radius inheritance that tracks the ANIMATED radius mid-morph, not just the static token, plus docs + an example variant per shape. NOTE for the iOS look: a true iOS squircle is a superellipse, not a border-radius — border-radius approximates it; exact needs clip-path/mask, which does NOT interpolate through the FLIP the way the radius MotionValue does. Approximation first.
- **App-icon → preview example ("icon to advertisement")** — Sean's demo/promo concept 2026-08-31: iOS-squircle disc as an app icon that morphs into an App Store-style preview card with MEDIA content (short video/screenshot loop, not text rows). Doubles as the launch-post demo — the "why would somebody want this" artifact. Builds on shape presets; second showcase beside the flagship.
- **In-flow origins** — generalize the morph beyond the floating disc: thumbnail-to-lightbox, popout-from-body-content. (Also in tease-capture.)
- **Morph smoothness pass** [CARRIED to next thread, 2026-08-31] — dispatched, agent STOPPED mid-Phase-C by wrap-continue. WIP commit 016c53b holds UNVERIFIED edits (Content.tsx reveal timing +15/-1, Disc.tsx +56/-24): no post-edit suite run, no re-measurement. Phase A/B frame data in session scratchpad m4/ (dies with old session). Next thread: verify-or-revert 016c53b first (suite 20/75 + eyeball), then finish: measure -> Emil lens (~/.claude/skills/emil-design-eng/SKILL.md) + PACKAGE-DESIGN §3 -> surgical refinement only, never loosen a geometry threshold.


## Noted during smoothness verification (2026-08-31, T1 motion agent A/B)

- **Resting disc radius is now a permanent inline value** — 016c53b's `discRestRadius` MotionValue writes `border-radius: 64px` inline at rest, where the previous fix removed the inline so the CSS module's `var(--disc-sheet-disc-radius, 9999px)` governed. Effect deps are `[discSize, discRestRadius, sheetRect, open]`, so a consumer changing `--disc-sheet-disc-radius` at runtime (theme swap) with no resize and no open/close gets a stale radius. Not a regression against any current behaviour or test — new coupling, folds naturally into v0.2 shape presets (which need animated child-radius inheritance anyway). Measured, not fixed.

## Greenfield install / first-run experience (Sean, 2026-08-31 — resurfaced from a phone ask that was NEVER captured)

- [ ] **Greenfield consumer app Sean can actually open.** Phase 1's gate built one (`.../d4c0a3bb-.../consumer-next`, node_modules + 0.1.0 tarball, routes `/`, `/nowarning`, `/server`) but ran it headless and only ever reported an exit code. It survives in a DEAD session scratchpad and can be reaped. Rebuild durably at `~/Code/_experiments/disc-sheet-consumer` from a tarball packed AFTER the smoothness pass lands, then hand over `npm run dev` + localhost.
- [ ] **README quickstart is not runnable.** Three defects found 2026-08-31 by reading it as a fresh installer: (1) the Usage snippet mounts `<Avatar />` twice, never defined or imported — copy-paste yields a compile error, not a disc; (2) the prose says add `"use client"` "(as above)" but the snippet never shows it, so the single most likely App Router trap is described as already-demonstrated; (3) nothing sets an expectation of what you should SEE (disc at an anchor, drag, tap, morph). Fix = one self-contained copy-paste-runnable snippet.
- [ ] **The greenfield page must be the README snippet verbatim**, not a hand-tuned demo — the point is to test the documented path, which is what an installer actually follows.

## REOPENED: morph smoothness — Sean's verdict 2026-08-31, after using the prod consumer app

**Standing quality bar for this package: "It all needs to be buttery smooth."** Sean used the greenfield consumer app and stopped within a moment — the quality was not there. This overrides any measurement-based claim that the smoothness pass is complete.

**The orchestration error to not repeat:** the pass was declared done because two specific measured discontinuities (the circle→square radius pop, the shared-element occlusion) were fixed and the numbers moved. "Two defects removed" is not "the morph is smooth." Frame-level deltas are necessary evidence and are not sufficient evidence; the acceptance test for felt quality is Sean's hands on a production build, and it belongs BEFORE the pass is called done, not after.

**Second error, same session:** he was handed `npm run dev` and told to judge motion quality on it. A Next dev server double-renders under StrictMode, is unminified, and runs HMR in the frame loop. Never hand him a dev build to evaluate feel — build prod and serve that.

- [ ] Phase 3 dispatched (diagnosis only, no edits): rAF frame-timing to separate JANK from CHOREOGRAPHY, a frame-by-frame breakdown, and an Emil-format review table. Hypotheses under test: H1 Motion's layout projection is main-thread rAF and FM shorthand transforms are not hardware-accelerated; H2 durations exceed the skill's 200-500ms window for modals/drawers (open reveal 492-530ms, close ~1.15s); H3 asymmetry is backwards — the skill wants exit FASTER than enter, ours has close slower than open; H4 spring mass 1.75 on both directions reads floaty; H5 reveal overlap paints text at ~92% box scale.
- [ ] Taste calls arising from Phase 3 are Sean's — do not pre-empt spring/duration changes as "perf fixes".

## Carried at wrap-continue — 2026-08-31 (Phase 4 stopped mid-edit)

- [x] **DONE bf48b0a — Phase 4 coupling landed.** `transition.shared` is now direction-aware; the close default (`DEFAULT_SHARED_CLOSE_SPRING`) is DERIVED from `DEFAULT_CLOSE_SPRING` by the same k-scaling `DEFAULT_OPEN_SPRING` uses, so the two stay coupled if the close is retuned again. Measured arrival gap on the prod consumer app at 1280x800: **-175.0ms -> -33.2ms** (median of 5). The open direction is byte-for-byte unchanged and was re-measured to prove it. `9a4eec1`'s close-spring retune VERIFIED by the same gate run (vitest 20/20, Playwright 75/75, audit PASS) — not reverted. Superseded text:  Sean's pick (Option A): the avatar should track the shrinking box down and reach the 2px border relationship (`.shared[data-disc-sheet-slot="disc"]`, `inset: 2px`) AS the disc finishes, not ~430ms early. WIP `9a4eec1` carries ONLY the close-spring retune (240/34/1.75 -> 375/32/1.0, damping ratio preserved, UNVERIFIED — no suite, no re-measure). The coupling itself is NOT started. Decider metric: avatar-vs-box arrival gap, currently **425-458ms measured on avatar POSITION** (the ~740ms quoted earlier was the opacity crossfade — different measurement, do not chase it).
- [ ] **STRAWMAN BUILT 77f6d9b, awaiting Sean — `SURFACE_CLOSE_LEAD_DELAY_MS` is now 35 (was 100).** Two constants to revert (it and the derived `DEFAULT_SHARED_CLOSE_SPRING`). What the re-home read costs, measured on a prod build: at **100** the box sits frozen 143ms (8.6 frames) after the Close click, the avatar gets a 100ms (6.0 frame) head start and is **53% of the way home** before the sheet moves a pixel — unmistakably a re-home, and why the close felt long (573ms total). At **35** the box is frozen 76ms (4.6 frames), head start 36ms (2.1 frames), avatar **17% home**; the detachment is still legible but reads as the avatar LEADING the collapse rather than leaving and being followed (507ms total, four frames shorter). At **0** there is no detachment to read at all (476ms). Sean picks. Superseded text:  111ms of frozen box after the Close click; highest-leverage number on close duration. PACKAGE-DESIGN §3 says it exists to keep the close reading as a re-home rather than a scale. Reduce, don't delete, and report what the re-home read costs at the chosen value.
- [ ] **PARKED — add a `prepack` script.** `npm pack` does not run `prepublishOnly`, so a pack without a prior `npm run build:lib` ships stale compiled `dist/`. This cost Sean an evening judging a tarball built from `1be78ac`, and would ship stale output on a real publish. Not changed mid-flight; `package.json` was off-limits to the running agent.
- [ ] **PARKED — `motion@13.1.1` resolves in consumers; geometry suite runs v12.** Untested combination. Verify the v13 projection path or pin the peer range.
- [ ] **PARKED — no visual scrim / `<DiscSheet.Backdrop>` opacity ramp.** Modal opens with zero depth cue. Already a v0.2 item in §8; contributes to "doesn't feel finished."
- [ ] **PARKED — `RADIUS_HOLD_FRACTION = 0.74` releases as a hard corner** (roundness rate jumps 5x in one frame at t=321ms). Ease the release instead of stepping it.
- [ ] **PARKED — critically-damped close.** Close overshoot is 0.94% of travel = 3.3px either direction, but that is 0.69% of a 480px sheet and 2.58% of a 128px disc — visible only on close. Asymmetric damping is the right fix; explicitly excluded from Phase 4.

## Noticed during Phase 4 (2026-08-31) — mentioned, NOT fixed

- **Sean's hands-on acceptance is still outstanding.** The gap is measured and closed; "buttery" is not a number. :3000 serves a prod build of `77f6d9b` — the felt-quality call belongs to him, on that build, before this pass is called done.
- **The avatar spills ~1.25px past the disc's edge for ~2 frames at t≈355ms.** Measured every close, every candidate spring. It is NOT the coupling: at peak overshoot the close spring pulls the box to 124.5px wide against a 124px avatar, so the 2px border is already spent before the avatar's timing is considered (the pre-coupling code already spilled 0.45px). The parked critically-damped-close recommendation is the root fix. Coupling costs 0.8px more.
- **`npx tsc --noEmit` fails on `example/flagship/main.tsx(5,25)` — `Cannot find module './portrait.jpg'`.** Pre-existing, missing an image module declaration. No suite runs bare `tsc`, so nothing catches it.
- **The prod consumer app resolves `motion@13.1.1`; the geometry suite runs v12.** Every number in this pass was measured on v13 in the consumer and gated on v12 in the suite. Already parked above; recording that the split is now load-bearing for the motion evidence.
- **`npm pack` still does not run `build:lib`** (the parked `prepack` item). Every build/pack/install cycle in this pass had to run `build:lib` by hand first and grep the installed `dist/` to prove the change shipped.
- **`~/Code/_experiments/disc-sheet-consumer/package.json` now points at `file:../../disc-sheet/seansmithworks-disc-sheet-0.1.0.tgz`** — npm rewrote it when installed by path. It resolves to the repo's own tarball, so a `npm install` there without a prior `npm run build:lib` + `npm pack` silently reuses whatever was last built.

## Phase 5 — close-choreography tuner (dispatched 2026-08-31, Sean's ask)

Sean's verdict on the coupled close: "really close." Two directional notes + one tool ask.

- [x] Expose `surfaceCloseLeadDelayMs` as a Root prop. README + PACKAGE-DESIGN §3 updated: the row moved OUT of §3's internal table and out of the "deliberately NOT exposed" table into the props table, with the reason (it is a duration with a taste answer, not a suppressed artifact).
- [x] Tuner on a NEW `/tune` route in the prod consumer, built on **dialkit 1.4.3** (`DialRoot mode="inline" productionEnabled`, `useDialKitController`, two `SpringControl`s + one `Slider`, its own PresetManager + Copy). `/` untouched.
- [x] Close path only, structurally: `transition.open` is never passed, so no dial can reach the open.
- [x] Live readout (hand-built — dialkit is inputs only): arrival gap ms + min avatar inset px, median of the runs since the last dial change. Rest-state sanity verified at exactly [2,2,2,2] px.
- [x] Persistence + copy are dialkit's: `persist: true`, `id: "disc-sheet-close"` → localStorage key **`dialkit:disc-sheet-close`**. Preset dropdown holds "Version 1" (= shipped defaults) and a seeded **"Phase 4 (77f6d9b)"** for the A/B.
- [x] Strawman applied to the shipped defaults: `DEFAULT_CLOSE_SPRING` 375/32/1 → **317.4/29.44/1** (k=0.92), `DEFAULT_SHARED_CLOSE_SPRING` 305/28.9/1 → **220.3625/24.565/1** (k=0.85). Damping ratios preserved (0.826 / 0.827).

### Measured on the prod consumer at 1280x800, median of 7 closes each, one instrument

| | arrival gap | min inset | total close | box arrives | avatar arrives |
| --- | --- | --- | --- | --- | --- |
| Phase 4 (77f6d9b) | **+8.4ms** | **−1.24px** | 497ms | 489ms | 497ms |
| Strawman (0.92 / 0.85) | **+58.3ms** | **−1.16px** | 586ms | 530ms | 586ms |

- The strawman does **not** spill worse: −1.16px vs −1.24px, i.e. 0.08px BETTER. The spill is set by the shell's overshoot pulling the box narrower than the avatar's resting 124px, not by the avatar's timing — both figures were stable to ±0.01px across 7 runs. The parked critically-damped-close item remains the root fix.
- It does cost **+50ms of avatar trail and +89ms of total close** (586ms), which is LONGER than the 573ms that motivated dropping the lead delay 100 → 35. The close is now paced by the avatar, not the shell.
- Found while verifying the dials: **lead delay 90 takes the strawman's gap to 0.0ms at no cost in total close** (581ms either way), because it delays the shell into the slowed avatar rather than slowing anything further. That is the cheapest way to re-couple the pair if Sean keeps the slower avatar.
- Sign convention: this instrument reads Phase 4 at **+8.4ms** (avatar trailing). PACKAGE-DESIGN §3 recorded "+25ms" and this BACKLOG recorded "−33.2ms" for the same commit — the two prior records disagree in sign and the scratchpad that would settle it is gone. All numbers above come from ONE instrument, so the deltas are sound even though the absolute Phase-4 figure does not match the −33.2ms line.

- [ ] **Sean's call — the tuner is live at http://localhost:3000/tune** (prod build, detached server). Dial it, then hand back either the panel's Copy JSON or just say "read the key" and the dialed values come out of `dialkit:disc-sheet-close`.

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

- [ ] **CARRIED — finish Phase 4: couple the shared handoff to the close.** Sean's pick (Option A): the avatar should track the shrinking box down and reach the 2px border relationship (`.shared[data-disc-sheet-slot="disc"]`, `inset: 2px`) AS the disc finishes, not ~430ms early. WIP `9a4eec1` carries ONLY the close-spring retune (240/34/1.75 -> 375/32/1.0, damping ratio preserved, UNVERIFIED — no suite, no re-measure). The coupling itself is NOT started. Decider metric: avatar-vs-box arrival gap, currently **425-458ms measured on avatar POSITION** (the ~740ms quoted earlier was the opacity crossfade — different measurement, do not chase it).
- [ ] **CARRIED — `SURFACE_CLOSE_LEAD_DELAY_MS = 100` tradeoff is Sean's to confirm.** 111ms of frozen box after the Close click; highest-leverage number on close duration. PACKAGE-DESIGN §3 says it exists to keep the close reading as a re-home rather than a scale. Reduce, don't delete, and report what the re-home read costs at the chosen value.
- [ ] **PARKED — add a `prepack` script.** `npm pack` does not run `prepublishOnly`, so a pack without a prior `npm run build:lib` ships stale compiled `dist/`. This cost Sean an evening judging a tarball built from `1be78ac`, and would ship stale output on a real publish. Not changed mid-flight; `package.json` was off-limits to the running agent.
- [ ] **PARKED — `motion@13.1.1` resolves in consumers; geometry suite runs v12.** Untested combination. Verify the v13 projection path or pin the peer range.
- [ ] **PARKED — no visual scrim / `<DiscSheet.Backdrop>` opacity ramp.** Modal opens with zero depth cue. Already a v0.2 item in §8; contributes to "doesn't feel finished."
- [ ] **PARKED — `RADIUS_HOLD_FRACTION = 0.74` releases as a hard corner** (roundness rate jumps 5x in one frame at t=321ms). Ease the release instead of stepping it.
- [ ] **PARKED — critically-damped close.** Close overshoot is 0.94% of travel = 3.3px either direction, but that is 0.69% of a 480px sheet and 2.58% of a 128px disc — visible only on close. Asymmetric damping is the right fix; explicitly excluded from Phase 4.

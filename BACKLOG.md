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

## Tuner productization (Sean, 2026-08-31 — from the /tune session)

- [ ] **Ship the tuner via `npx disc-sheet add tuner`, NOT as a package dependency.** Scaffolds a `/tune` route + dialkit as a devDependency into the consumer's app, reusing Phase 2's tested copy-in machinery. Rationale for not depending on it: the package has zero runtime deps today (motion is a peer); dialkit's stylesheet @imports Geist Mono from Google Fonts, which would put an external request in every consumer app forever; and a tuning panel reachable from a production bundle is a footgun.
- [ ] **Shadow dials — do these first.** `DiscSheet.Shadow` is already a component with tokens; offset/blur/opacity dials are cheap and carry no correctness risk.
- [ ] **Shape dials (circle/squircle/square) — GATED behind child-radius masking.** Adding the dial before the masking ships a control whose every non-circle setting looks broken: the shared CONTENT must mask to the same shape, tracking the ANIMATED radius, or it reproduces the accidental-squircle bug (disc surface squircle, portrait still circular). A true iOS squircle is a superellipse; border-radius approximates it, exact needs clip-path, which does NOT interpolate through the FLIP the way the radius MotionValue does. See the v0.2 "Shape presets" item above — same constraint.
- [ ] **Dither / other visual treatments** — new surface, not a dial on something existing. Separate and larger.

## Tuning snapshots (2026-08-31)

`docs/tuning/dialkit-disc-sheet-close.json` (34dc0ab) is a byte-exact snapshot of Sean's `dialkit:disc-sheet-close` localStorage. Holds V1/base, Phase 4 (77f6d9b), V3, V4. Restore by writing it back to that key. The consumer app at ~/Code/_experiments/disc-sheet-consumer has NO git, so this repo is the only durable home for dialled values.

- [ ] **V4 is Sean's pick and it reverses the strawman's direction.** V4: shell 375/32/1, avatar 340/30/1, lead 35, fill 0.45. The avatar is FASTER than both Phase 4 (305/28.9) and the shipped strawman (220.36/24.565) — wn 18.4 vs 17.5 vs 14.9. The shipped default is currently the slowest avatar, i.e. the one he likes least. Decide whether to bake V4 into motion.ts as the new default.

## Checkpoint — 2026-09-01 (wrap-continue)

**Closed this session:** Phase 4 coupling (bf48b0a) · lead-delay strawman 100→35 (77f6d9b) · /tune dialkit tuner (987e2ff) · V4 baked as shipped defaults (23c3c49) · preset snapshot to disk (34dc0ab). Gates 20/75 verified by the orchestrator, not just claimed, at every step.

**Carried (on-objective):**
- [x] **Sean's hands-on verdict on the production build at :3000.** CLOSED 2026-09-01 — "It's looking good." V4 stands as the shipped motion default; the motion objective is done and is not to be reopened.
- [ ] ~~`npm login` && `npm publish --access public`~~ **ON HOLD — do NOT publish.** Sean decided 2026-09-01 to hold 0.1.0 and ship one bigger first release including the variations/settings work below. Publishing now would burn the version number and force the API expansion into a 0.2 it no longer needs to be. Merge to main also waits.

**Parked (off-objective, do not carry into the next thread):**
- [ ] Consumer app has no version control — `git init` at ~/Code/_experiments/disc-sheet-consumer offered, not done. /tune exists only on disk.
- [ ] 4 orphaned next-server processes on ports 3921-3924 (dead session scratchpad `.../d4c0a3bb-.../consumer-next`). Offered to reap, Sean did not answer.
- [ ] Arrival-gap SIGN CONVENTION is unresolved: 77f6d9b reads −33.2ms (BACKLOG), +25ms (PACKAGE-DESIGN §3) and +8.4ms (the /tune rig) for the same commit. Deltas from any one instrument are sound; the absolute figure is not citable. Settle it or delete two of the three records.
- [ ] `tsc --noEmit` fails pre-existing on `example/flagship/main.tsx:5` (missing `./portrait.jpg` module). No suite runs bare tsc.
- [ ] Consumer resolves motion@13.1.1 while the geometry suite gates on v12. Untested combination.
- [ ] `npm pack` still does not run `build:lib` (the prepack item). Every ship cycle this session needed a manual build + dist grep to prove the change shipped.
- [ ] dialkit's stylesheet @imports Geist Mono from Google Fonts — external request on /tune.

## 0.1.0 scope expansion — variations + settings (decided 2026-09-01)

**Decision:** Sean is HOLDING the 0.1.0 release to widen the public API first, against the orchestrator's recommendation to ship now and add additively as 0.2. Recorded so the tradeoff is not re-litigated: holding keeps the API reshapeable including breaking changes, and costs a shipped package in the meantime. His call, made with that tradeoff stated.

**Scope Sean selected (all four, plus a research question):**
- [ ] Motion presets — named springs so consumers pick a feel instead of hand-tuning stiffness/damping; /tune becomes a preset picker that exports values.
- [ ] Shape + size variations — circle/squircle/square, size ramps, sheet dimensions. **GATED** on animated child-radius masking (see the v0.2 shape-presets item above — same constraint, unchanged).
- [ ] Layout + behavior settings — anchors, placement, backdrop, dismiss, controlled/uncontrolled.
- [ ] One unified config surface — CSS custom properties + config object, design-system drop-in shape.
- [ ] Answer: what do standard UI toolkits commonly ship that disc-sheet does not? Gap analysis against the real source, not a listicle.

**Status:** scoping dispatched to /adversarial-plan 2026-09-01. Plan to be delivered as an Artifact (Sean is on phone; localhost review is unreachable). No implementation dispatched until Sean picks a cut.

## Plan gate CLOSED — /adversarial-plan verdict RETHINK (2026-09-01)

Evidence on disk: `scratchpad/plan/{draft-plan.md,refuter-prompt.txt,refutation.md}`. Opus refuter, 20 findings, read the tree not just the prose.

**The draft's headline recommendation was killed.** Proposed adding `<DiscSheet.Portal>`; it is unsafe here and fails existing tests. `--disc-sheet-disc-size` is written ONLY by Root's scoped style block (`Root.tsx:403-405`) and read to size the shared element (`styles.module.css:98-105`); custom properties inherit down the DOM tree, so portalling severs it and the sheet-side Shared falls to the 92px fallback against the disc-side's real size. That equality is what the zero-scale FLIP requires. Also: portalling the sheet ALONE unpairs it from the disc (both are position:fixed and shift identically under a transformed ancestor, so the morph currently stays coherent); portalling both re-opens the measured 0.000-visibility crossfade bug (`Disc.tsx:283-315`); and an SSR-safe portal deletes the first-paint window the D3 disc-size fix depends on (`Root.tsx:86-107`). Correct fix is a README section, not a Portal part. DO NOT re-propose a portal without solving token forwarding first.

**Real defects the gate surfaced — fix regardless of any naming or configurator decision:**
- [ ] `src/types.ts:80-84` JSDoc on the PUBLIC `surfaceCloseLeadDelayMs` prop says `transition.shared.close` "is derived from this value". FALSE since V4. It compiles into `dist/index.d.ts` and every consumer's IntelliSense. A consumer who raises the lead delay trusting the doc gets the avatar spilling past the disc's 2px border.
- [ ] `src/motion.ts:57` and `:81-83` assert the same dead derivation, contradicted by `:102-110` in the same file. Four stale sites total, not two.
- [ ] Focus trap does not trap (`useDialogBehavior.ts:54-70`): Tab is only intercepted when activeElement is already the first or last focusable INSIDE the panel. Focus anywhere else and Tab walks out. Plus a 50ms setTimeout before initial focus where the trap is inert.
- [ ] No background `aria-hidden`/`inert`. `aria-modal="true"` (`Sheet.tsx:284`) is a hint browsers do not act on. Screen readers read the whole page behind the sheet.
- [ ] Scroll lock sets `body.overflow=hidden` with no scrollbar compensation — visible ~15px sideways page shift on open, on a library whose whole pitch is motion quality.
- [ ] Geometry gate has never run against motion@13, which the verification consumer resolves. The only instrument that can prove the V4 feel survived a refactor does not cover the environment it is judged in.
- [ ] `index.ts:61-67` exports five runtime geometry helpers (`anchorCenter`, `nearestAnchor`, `restingLeft`, `restingTop`, `sheetPlacement`). Decide before publish whether these are public forever.

**Corrections to earlier scoping:**
- Preset shape: a `preset` OBJECT prop on Root carrying `{transition, surfaceCloseLeadDelayMs, sharedSize}` is the only shape that round-trips the tuner's export (`docs/tuning/dialkit-disc-sheet-close.json` = discShell/avatar/leadDelay/avatarFill). Passing a spring object into the existing `transition` prop reaches 2 of 4 fields.
- The tuner's `baseValues` already stores `{visualDuration, bounce}` — Motion's designer-facing spring format. Adopt it as a `Spring` union member.
- `asChild` on all 8 parts is not viable: Sheet/Disc/Shared/Content carry layoutId, drag, MotionValues and load-bearing refs. Safe on Close and Item only.
- `forwardRef` is deprecated in React 19 and the peer floor is >=19. Its absence was correct, not a gap.
- `EDGE_MARGIN` tokenization is not one line: `anchors.ts` is documented pure, tests import the constant, four public signatures would change, and there are ~6 hardcoded 16s including a separate `SHEET_MARGIN`.
- `/tune` lives in the unversioned consumer app, not this repo. BACKLOG:114 already decided the delivery: `npx disc-sheet add tuner`.
- Sheet dimensions are NOT already shipped: `max-height: 88dvh` and `bottom: 16px` are hardcoded with no token or prop.

## New directions raised 2026-09-01 (voice, partially parsed — CONFIRM BEFORE BUILDING)

- [ ] **Visual configurator on the site.** Pick a variation, see it live, copy the code, paste it in. Two install paths: npm, or copy-paste from the tool. shadcn model. Covers disc shape AND sheet content layouts. Answers to "where does it live" and "does it replace the API work" came back as "both, site first" / "both in parallel" but arrived alongside a background-task notification the harness flagged as unverifiable. NOT treated as confirmed.
- [ ] **Showcase examples with media**, tied to the already-parked "icon to advertisement" concept: iOS-squircle app icon morphing into an App Store-style preview card. Plus a full-size-image variant.
- [ ] **Naming system across all Sean's components/tools/frameworks.** Immediate trigger: "disc-sheet" stops being accurate the moment the disc can be a squircle or a square, so shape variants and the package name are coupled. He wants a convention, not complex or fancy, but distinctive enough to be recognizable when shared. GATES PUBLISHING — the package name is in package.json, the npm scope, the README, and every import line.
- [x] CONFIRMED 2026-09-01: the configurator answers ("both, site first" / "both in parallel") ARE Sean's. Build against them.
- [x] "the ditter" = **dither** — one of Sean's other tools/effects that needs more work (cf. the surface-fx dither). Another package the naming system has to cover, and a reason the system matters more than this one name.
- [ ] Still unparsed from dictation: "puppy tier agent" (guess: agent-pasteable registry output, shadcn-style) and "out of the LinkedIn app around".

## ⛔ SCOPE — LOCKED 2026-09-01. Read this before planning anything in this repo.

**Objective:** Ship `@seansmithworks/morph-sheet` as a component a stranger can install and actually use, promoted from seansmithdesign.com. Sean's framing: "I need to start shipping the things I'm building for fun." The site is a demo platform to show teams how he works, so the page promotes the component AND him; npm and GitHub are the other two doors in.

**Order Sean set:** component + how it's used FIRST (CLI install, local visual reference), THEN the site.

**Done when:**
- [ ] A stranger can change how it feels without typing spring numbers
- [ ] A local visual reference lives in THIS repo (today /tune exists only in the unversioned consumer app)
- [ ] One example answers "why would I want this", not just "it works"
- [ ] Published to npm, public on GitHub
- [ ] One page on the site: example gallery first, dials on ONE specimen

**NOT in scope — do not widen into these:**
- A component system or platform. "The first of a system is not important." Later he wants to define components-vs-skills as a process case study; that is a SEPARATE effort.
- Content layouts as package exports. Content stays any-children; presets (list, image, video, app promo) ship as `npx morph-sheet add` copy-in so visual tweaks are never breaking changes.
- A React portal. Investigated and killed; see the plan-gate section above.
- Shape variants, unless animated child-radius masking lands first.

**Fixed engineering decisions (do not re-litigate):**
- Motion presets = a `preset` OBJECT prop on Root carrying `{transition, surfaceCloseLeadDelayMs, sharedSize}`. Only shape that round-trips the tuner's 4-field export. NOT a `preset="snappy"` string union — zero of five peer libraries ship named presets; react-spring's exported `config` objects are the precedent.
- Adopt Motion's `{visualDuration, bounce}` as a `Spring` union member — two designer-legible numbers. The tuner's own baseValues already store springs that way.
- The default preset ships the dialled values EXACTLY: open 375/42.5/1.75, close 375/32/1, shared.open 500/45, shared.close 340/30/1, lead delay 35, snap 700/52/1.

## Overnight delivery run — dispatched 2026-09-02 (Sean asleep; NO publish, NO deploy)

Sean's two calls at dispatch: snappy/gentle ship as **marked strawmen** tonight (re-dial on the tuner in the morning, one line each); examples = **all three** (media/app-promo card FIRST since it doubles as the site hero, then simple list, then form/contact).

Sequential dispatch, not parallel — every phase commits to `feat/customization-parity` in the same worktree, and parallel pushes there race silently. Each phase: gates re-run by the orchestrator (20 vitest / 75 Playwright / audit PASS, never bare `npx playwright test`), then a reviewer agent that did not write the code.

**Correction to the locked scope's third preset key.** The lock says the preset object carries `{transition, surfaceCloseLeadDelayMs, sharedSize}`. Verified this session: **`sharedSize` is not a prop and nothing in `src/` reads it** — the size prop is `triggerSize`, and `--morph-sheet-shared-size` is a CSS var that defaults to the trigger size. The tuner's four exported fields map to `transition.close` (discShell), `transition.shared.close` (avatar), `surfaceCloseLeadDelayMs` (leadDelay), and nothing (avatarFill, "diagnostic, not choreography" per its own comment). So **two keys round-trip the tuner completely**. Flagged to Sean before dispatch, not objected to. Building `{transition, surfaceCloseLeadDelayMs}`; size stays the separate `triggerSize` prop it already is.

- [x] Phase 1 (2544796 + fixes 5345f0b) — motion presets — DONE. Reviewed by a non-builder, all 8 findings fixed and re-gated by the orchestrator: 36 vitest / 75 Playwright / audit PASS. Freeze confirmed at runtime, both levels. The 8 fake tests were replaced with 12 real ones, red/green watched: `preset` object prop on Root (explicit `transition`/`surfaceCloseLeadDelayMs` win over it), exported `presets` with `default`/`snappy`/`gentle`, `{visualDuration, bounce}` accepted as a `Spring` union member. `default` REFERENCES the shipped constants so byte-identity is structural, not copied. snappy/gentle marked un-dialled in code.
- [x] Phase 2 (ec2ca6c) — tuner into this repo — DONE, gates re-verified by orchestrator (32 vitest / 75 Playwright / audit PASS), zero runtime deps preserved, dialkit is a devDep: ships via `npx morph-sheet add tuner` copy-in (Phase 2 machinery), NOT a package dep. Source is the working 14K page.tsx + CSS in the unversioned `~/Code/_experiments/disc-sheet-consumer/src/app/tune`. Shape dials stay GATED behind child-radius masking.
- [x] Phase 3 (e6d4c41) — examples, all three — BUILT, gates green, screenshots sent to Sean. OPEN TASTE ITEM: list + contact float a small glyph in the trigger-sized shared box and leave ~100px dead space above the heading; media-card avoids it because its icon FILLS the circle. Palettes/copy/fictional app are arbitrary strawmen: media/app-promo card first, then simple list, then form/contact. Tokens from the README table, never PACKAGE-DESIGN §2 (stale).
- [x] Phase 4 (f6072a2) — `"use client"` runtime guard — DONE. Dev-only, THROWS (fatal: nothing renders without hooks), wraps Root's first `useId()`. Repro confirmed a forgotten directive gives React's generic `Invalid hook call`, naming neither the package nor the fix: a loud, named failure for the RSC trap. Today it is one README sentence and no check in `src/`.
- [x] Phase 5 (4fa3929) — motion peer pinned to `>=12 <14` — v13.1.1 ran the FULL suite green (36 vitest / 75 Playwright), so the range is honest rather than optimistic. Tree restored to motion@12.43.0 and re-confirmed green. NOTE: a first v13 pass showed 15 phantom failures that were two `test:geometry` runs racing over the shared --strictPort server, NOT a v13 regression: peer says `>=12`, suite has never run against v13, Sean's own consumer resolves v13. Test against v13 and pin to what actually passes. **If v13 fails the suite, STOP and report — do not widen the range to make it green.**
- [ ] Phase 6 — rebuild the consumer app on :3000 (build:lib -> pack -> reinstall -> rebuild -> restart) so Sean has something to put his hands on. Broken by the rename since 40c0b8c.
- [ ] **Item 6 PUBLISH is Sean's hands, not mine** — `npm login`, `npm publish`, repo public on GitHub. Outward-facing + needs his auth.
- [ ] Item 7 site page — NOT overnight work, different repo.

### Phase 1 review findings (commit 2544796) — reviewer was NOT the builder, 2026-09-02

All eight CONFIRMED by the reviewer running code, not reading it. Verified clean first: dialled values byte-unchanged, `presets.default` deep-equal to no-preset on both directions, scaling math exact, reduced-motion and tween-fallthrough intact.

Queued behind Phase 2 — same branch, same worktree, so only one agent commits at a time.

- [x] **F1 (most severe) `DurationSpring.mass` is a silent-failure trap.** Motion DISCARDS `visualDuration`+`bounce` whenever `mass` is present (`spring.mjs` gates on `physicsKeys` first), falling back to stiffness 100 / damping 10. Measured settle on a 0→100 keyframe: `{visualDuration:0.4, bounce:0.2}` = 660ms, same plus `mass:1.75` = **2080ms**. A designer copying the README example and adding the package's own documented `mass: 1.75` type-checks and gets a 2s floppy wobble with no warning. **Fix: `mass` must not exist on `DurationSpring`.**
- [x] **F2 preset + partial directional `shared` inverts the arrival gap.** `Root.tsx:165` replaces `shared` wholesale, then the per-key fallback reaches the PACKAGE default rather than the preset's. `preset={presets.snappy} transition={{shared:{open:x}}}` resolves the close shared to 340/30/1 instead of snappy's 449.65/34.5, so the shared element TRAILS the box by 45ms where all-snappy leads by 10ms. This is precisely the spill-past-the-2px-border failure that `DEFAULT_SHARED_CLOSE_SPRING`'s comment and the README both warn about. **Fix: fall back per-direction to the preset's `shared`, not the package default.**
- [x] **F3 four of the eight new tests cannot fail.** `motion.test.ts:27-79` re-declares Root's merge expression inside the test body and asserts the result against its own operand — line 71 reduces to `expect(x).toBe(x)`. **`Root.tsx` is imported by no test in the repo.** Inverting the precedence in `Root.tsx:145` would break every explicit `transition` prop and all 28 tests would still pass. The headline feature has zero real coverage while reading as four green tests. **Fix is structural: extract `resolveMotion(...)` from Root's body into `motion.ts` and test THAT.** Tests 1, 6, 7, 8 are real; 7 (tween stays a tween) is the most valuable guard in the file.
- [x] **F6 `presets` is mutable and shares references with the internal defaults.** The byte-identity-by-reference design means `presets.default.transition.open === DEFAULT_OPEN_SPRING`. The natural clone `{...presets.default}` copies `transition` by reference, so mutating it poisons `presets.default` app-wide; one level deeper it poisons `DEFAULT_OPEN_SPRING` and the no-preset path. Reviewer reproduced both. **Fix: deep freeze.**
- [x] **F5 README advertises `bounce` without saying which spelling works.** `{duration:0.4, bounce:0.2}` is valid Motion syntax but `isSpringShorthand` rejects `duration`, so it runs as a TWEEN and `bounce` is silently dropped. Pre-existing, but the README newly invites it. **Fix: advertise `visualDuration` only.** Also `README.md:241` is now stale — still says springs accept only `{stiffness, damping, mass?}`.
- [x] **F4 README overstates "field by field".** `shared` is replaced whole, not merged; that carve-out lives only in a code comment. F2 is what a consumer hits as a result.
- [x] **F8 `Spring` became a union but its members are unexported.** A consumer holding a `Spring` and reading `.stiffness` now needs narrowing, and cannot write the narrowing helper because `StiffnessSpring`/`DurationSpring` are unnameable from outside. Breaking, but free right now — still 404 on npm. **Fix: export both.**
- [x] **F7 `visualDuration` alone is undefined behaviour.** Motion's `durationKeys` is `["duration","bounce"]` — `visualDuration` is not in it, so `{visualDuration:0.4}` with no `bounce` settles in 1050ms on Motion's defaults. `DurationSpring` requiring `bounce` is the only guard, and it reads as arbitrary strictness against Motion's own optional `bounce`. **Fix: a comment recording why, so the next person "matching Motion's types" does not open the hole.** (`bounce: 0` is safe; the guard tests `!== undefined`.)

### ⚠️ Dial history orphaned by the panel-id rename — Sean's call, 2026-09-02

Phase 6 renamed `PANEL_ID` in the consumer's tuner from `disc-sheet-close` to `morph-sheet-close`, and Phase 2 shipped the repo copy already carrying the new id. dialkit persists under `dialkit:${id}`, so the panel now reads a **different localStorage key** and opens with no history — which is why it shows "Version 1" rather than the dialled Version 4.

**Nothing is lost.** Two independent recovery paths, both verified this session:
- The old key `dialkit:disc-sheet-close` is untouched in the browser. Nothing deleted it.
- `docs/tuning/dialkit-morph-sheet-close.json` is a committed byte-exact snapshot holding all three saved presets: `Phase 4 (77f6d9b)`, `Version 3`, `Version 4`.

The shipped defaults in `src/motion.ts` are unaffected — they are source constants, not panel state. The panel correctly displays 375 / 32 / 1.0.

Three options, none started because this is Sean's dial history and the choice is his:
1. Revert `PANEL_ID` to `disc-sheet-close` in both copies — history reappears immediately, but the id keeps a name the package no longer uses.
2. Keep the new id and add a one-time migration that copies the old key across when the new one is empty. Correct long-term, but it is new code in the tool that judges taste.
3. Keep the new id and import the committed JSON snapshot through the panel.

Deliberately NOT auto-migrated overnight: silently rewriting his saved dial state is not a call an agent should make while he is asleep.

Related, same area: the panel's visible dial label still reads **"Disc Shell"**. The KEY `discShell` must stay (renaming it drops the saved values inside each preset), but the display label is cosmetic and can change independently if dialkit separates the two.

## ⛔ Acceptance test findings — 2026-09-02, clean-install walk of the five-minute table

Run in a fresh Next app against the packed tarball (74.8K), motion resolved 13.1.1. All three verified independently by the orchestrator afterwards, not taken on the agent's report. **These block the locked objective — "a stranger can install and actually use it" — so they should land before publish.**

- [ ] **A1 (BLOCKS) — the README quickstart does not build as printed.** `README.md:128` is `function ContactTrigger()` with no `export default`, and nothing in the README says where to put it. A stranger's obvious move is pasting it into `app/page.tsx`, which fails the Next build with `Property 'default' is missing in type 'typeof import(".../page")'`. The component tree itself is correct and morphs fine once `export default` is added. **The delivery plan's claim that this snippet is "verbatim-tested" is false for the path a stranger actually takes.** Fix is one word.
- [ ] **A2 (BLOCKS the feature's whole point) — the `"use client"` guard is UNREACHABLE and never fires.** Verified: `src/index.ts` exports only the `MorphSheet` namespace object — there is **no named `Root` export** — so the only public path is the property access `MorphSheet.Root`. RSC rejects that property access on the client-reference namespace *before* Root's function body runs, so the guard sitting inside Root at `src/Root.tsx:57` is dead code for the only trap it was built for. A stranger who forgets the directive gets React's stock `Element type is invalid: expected a string... but got: undefined`, naming neither the package nor the fix. **The guard's own comment describes precisely the failure it cannot catch.** Fix must live at the module/namespace boundary — a top-level dev-only check in `index.ts` — not inside `Root.tsx`.
- [ ] **A3 (CONFUSES) — the `mass` trap is reopened by the union, and the README claims otherwise.** F1's fix correctly removed `mass` from `DurationSpring`, but `transition.open` and friends are typed `Spring | Transition` (`src/types.ts:36-57`), and Motion's own `Transition` permits `mass`. So `{visualDuration: 0.4, bounce: 0.2, mass: 1.75}` structurally matches `Transition` and **typechecks with zero error** — confirmed by an `@ts-expect-error` that TS reported as unused. `README.md:382` states the type "has no `mass` field specifically to prevent that", which is true of `DurationSpring` alone and false at the prop. The 660ms → 2080ms runtime footgun is live and undetected.

**Process note, worth more than the three findings.** Phases 4 and 5 were dispatched together and were the ONLY phases that did not get an independent reviewer — I folded them into one agent and skipped the review gate. A2 is the defect that gate would have caught, and it is the exact failure class the session already learned once (see the `green-tests-from-the-builder-are-not-evidence` memory). A3 is a second-order miss: the reviewer found F1, the fixer fixed the narrow type, and nobody re-checked whether the union reopened the hole. **A fix verified only against the finding that prompted it is not verified.**

Also unverified and worth a pass later: motion 12.x (the peer range floor — only 13.1.1 was exercised), the drag-to-reanchor interaction, keyboard/focus-trap behaviour in a real consumer, and the reduced-motion path.

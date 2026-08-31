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
- **Morph smoothness pass** — profile the disc-to-sheet transition frame-by-frame (suspects: content reveal pop at ~96% settle, crossfade handoff); refine, don't rebuild. Staged behind the squircle fix, same T1 motion agent.


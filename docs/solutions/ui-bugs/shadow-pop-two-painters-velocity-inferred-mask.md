---
title: "Shadow pop on open: two shadow painters plus a velocity-inferred mask"
date: 2026-09-11
category: ui-bugs
module: "MorphSheet.Shadow / example CloseMask"
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Visible shadow \"pop\" at the tail end of the disc-to-sheet open, on every recording"
  - "Present across builds back to Aug 30 — not a regression from any single change"
  - "Side-sample pixel darkness dropped 25.0 -> 7.9 in one frame at 407-421ms after click, all 3 cycles"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [shadow-pop, box-shadow, mask-clipping, spring-velocity, single-painter, morph-sheet, design-system-principle]
related_components: [morph-sheet-shadow, close-mask, dialkit]
---

# Shadow pop on open: two shadow painters plus a velocity-inferred mask

## Problem

The disc-to-sheet open showed a one-frame shadow "pop" right at settle, visible in screen recordings. It looked like a smoothness regression but was present in every build back to Aug 30 — the defect was structural, not a recent change.

Commit SHAs below are on `feat/customization-parity`, not yet merged to `main`; this project commits directly to a working branch without a PR workflow, so SHAs (not PR numbers) are the durable reference here.

## Symptoms

- Shadow visibly drops in a single frame near the end of the open spring.
- Reproducible on every open, all builds tested (Aug 30 through current).
- Measured: side-sample darkness in a region outside the silhouette fell 25.0 → 7.9 between 407ms and 421ms after click, on all 3 recorded cycles.

## What Didn't Work

Three rounds of symptom-level patches, each fixing the instance the last trace found and leaving the mechanism in place:

1. **`09eea2b`** — gated the sheet's own `box-shadow` to fade in only after the open spring settled. This added a *second* shadow painter with a phase-boundary toggle, which is itself a smaller version of the same defect class.
2. **`4a975d5`** — removed a real duplicate `box-shadow` on `.triggerSurface` (the resting disc was painting the silhouette shadow twice). Correct fix for that instance, but the pop was still visible afterward.
3. A proposed one-line guard in `example/CloseMask.tsx` to skip writing an identity mask — rejected before landing. Sean: *"code is cheap — do it correctly instead of hacking it over and over again."*

Each patch treated a trace finding as the whole problem instead of checking it against `DESIGN.md` §4.1's stated principle ("one surface, one clock") — see [[fix-the-model-not-the-symptom]] in project memory.

## Solution

Root cause, found by ablation (headed Chromium on GPU, glow off, warm browser; each candidate disabled via `page.addStyleTag`, never a file edit):

Two things compounded:

- **Two shadow painters** existed simultaneously: `<MorphSheet.Shadow>` and a `box-shadow` on `.sheet[data-morph-sheet-settled]`.
- **`example/CloseMask.tsx` inferred "closing" from spring velocity** (`collapseProgress.getVelocity() > 0`). The open spring's overshoot rebound (progress dips to -0.0094 then returns to 0) has positive velocity during that rebound, so CloseMask wrote a clipping mask onto the sheet mid-fade-in. A `mask-image` clips `box-shadow` painted outside the element's own box, so the sheet's own shadow vanished for exactly one frame.

Ablation confirmed the mechanism: mask disabled → no drop; sheet's own shadow disabled → no drop; `<Shadow>` layer disabled → drop remains (i.e. the sheet's box-shadow was the one being clipped, and the mask was the trigger).

**The fix**, applying DESIGN.md §4.1 ("one surface, one clock") instead of adding another guard:

- `2aab652` — `<MorphSheet.Shadow>` becomes the *only* shadow painter. It renders both the disc shadow (`--morph-sheet-shadow`) and the sheet shadow (`--morph-sheet-sheet-shadow`) as two layers crossfaded by opacity, driven by `collapseProgress` (fade window dialled via `--morph-sheet-sheet-shadow-fade-start` / `-end`, seeded 0/0.25, DialKit panel `09c3daa`). The sheet's own `box-shadow` was deleted entirely; the `data-morph-sheet-settled` attribute is kept only because Close's reveal still reads it.
- `0b1ab42` — `CloseMask` derives its closing state from `useMorphSheet().open`, a real boolean, instead of inferring it from spring velocity.

## Why This Works

A shadow toggled at a phase boundary, or a UI state inferred from spring velocity rather than real state, will misfire at any spring overshoot — the overshoot rebound has the same velocity sign as an actual close, so anything gated on velocity can't tell them apart. Collapsing to one painter and one real-state boolean removes the two independent conditions that had to coincide to cause the pop; there is no longer a second surface that can be clipped or swapped out from under the first.

## Prevention

- Any new visual layer whose visibility changes at a spring's phase boundary must derive that boundary from *real state* (`open`/`closed`, a settled boolean already in props), never from `velocity`, `progress` sign, or a proxy that overshoot can fake.
- `example/geometry.spec.ts`:
  - `(p2)` "no element inside the trigger or sheet paints a box-shadow, open through close" (`example/geometry.spec.ts:1221` is the rest-phase assertion) — added in `43bcb4c`, hardened in `a6ebc97`.
  - `(p3)` "sheet carries no mask-image through a close interrupted by a re-open" (`example/geometry.spec.ts:1261`) — specifically covers the fast double-tap shape that produces the overshoot-during-close-request case.
  - Both were confirmed to actually catch the bug by reverting the fix locally and watching them go red before re-reverting (per the tests' own doc comments).
- When a frame trace names a cause, check the finding against the project's stated design principles (`DESIGN.md` §4.1 here) before patching. If the code violates a stated principle, fix it to obey the principle — don't add a guard that suppresses the one instance found.

## Verification

- Independent re-run of the frame trace on the fixed build: largest step at settle across 4 cycles is 1.3 (previously 17).
- `79` geometry / `36` vitest / `audit:vars` — all PASS.
- Independent reviewer (not the builder) passed the diff.
- Sean judged the before/after recordings "much better".
- Known follow-up, not yet closed: at close start the now-visible heavier sheet shadow exits in ~3 frames; tunable via the fade-end dial, pending Sean's eye.

## Related Issues

- [[fix-the-model-not-the-symptom]] — the "code is cheap" feedback this fix responds to.
- [[measuring-smoothness]] — the pixel-darkness / ablation measurement method used to find and verify this.
- `docs/plans/motion-craft-audit.html` — the earlier audit that attributed the pop solely to the duplicate `.triggerSurface` shadow; corrected 2026-09-11 to note this second cause.

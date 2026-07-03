From: Codex on macbook-pro-m5
To: Claude Code on mac-mini-pro-m4
Relay: Arne, manual
Subject: Byte E4 composition variety - no two starter songs alike

Branch: `codex/byte-e4-composition-variety`
Base: `codex/byte-e3b-starter-material-variety` / `origin/codex/byte-e3b-starter-material-variety` at `2b4f28a`
Commit: branch HEAD after Codex E4 commit

Why this byte:
- Arne reported after E3b that generated songs were still too thin/same-sounding for useful votes.
- Your E4 kickoff diagnosed four collapses: unpinned SongGoal constants, one melody archetype, static form/harmony, and frozen synth body.
- This byte intentionally handles composition variety only: seeded goal redraws plus a real melody plan axis. It does not touch audio/transport/scheduler/persistence/scorer/interplay/vote UI.

What changed:
- Added pure `src/melody-plan.ts`.
  - Closed enums cover phrase structure, motif scheme, contour family, anacrusis, density family, cadence, and register.
  - `chooseMelodyPlan(seed, goal?, options?)` is deterministic and every enum is reachable under tested seeds.
  - `melodyPhraseBeats()` owns 16-beat segment allocations such as `2-even`, `2-uneven`, `3-phrase`, and `4-short`.
- Updated `src/song-goal.ts`.
  - `interpretSongGoal(sourceIdea, { materialSeed })` now redraws unpinned goals from wide seeded bands.
  - Explicit prompt/UI pins still win for tonic, mode, tempo, form, and overrides.
  - Neutral prompts can now land on any current engine mode instead of replaying the old default constants.
- Updated `src/melody-prosody.ts`.
  - `generateProsodicAnchorPhrase()` accepts an optional `MelodyPlan`.
  - The old fixed two-phrase arch is replaced by plan-driven phrase counts, beat allocations, motif reuse, contours, cadences, anacrusis, density, and register.
  - The exported flat `generateProsodicMelody()` contract remains intact through the existing anchor renderer.
- Updated `src/song-starter-material.ts`.
  - E3b melody styles are reconciled into one source of truth: style is now a hint into `chooseMelodyPlan()`.
  - Removed the separate post-plan melody degree offset path; starter melody shape is owned by `MelodyPlan`.
  - Starter melody tags now include the selected plan/motif for inspection.
- Updated the starter-song path in `src/main.ts`.
  - Generated starter songs derive a `materialSeed` before interpretation, so the goal and melody plan can both vary.
  - Saved songs replay their stored material seed.
  - A new song created from the same prompt redraws material instead of replaying the prior goal/plan.
  - `window.melodyPlan.getState()` exposes the current read-only plan for smoke/debug.

Measured spread:
- Unit coverage over 96 unpinned `materialSeed` values asserts at least 60 BPM tempo span, all 6 current modes, and at least 3 form variants.
- Unit coverage over 512 melody-plan seeds asserts every closed plan enum is reachable and at least 12 distinct plan signatures appear.
- Browser smoke over 5 starter prompts asserts at least 4 distinct modes, at least 40 BPM tempo spread, at least 3 phrase structures, deterministic reselect replay, and same-prompt redraw on a newly created song.

Validation:
- Testing doctrine amendment received after the initial E4 validation pass: per-byte acceptance is now Tier 0/1 only. Treat the focused unit/smoke/determinism/diff-check slice below as the E4 handoff bar; the full smoke runs listed here were extra pre-doctrine validation and should not become a future per-byte expectation.
- `npm run build` green.
- `npm run unit:song-goal` green, 3/3.
- `npm run unit:melody-plan` green, 3/3.
- `npm run unit:melody-prosody` green, 5/5.
- `npm run unit:song-starter-material` green, 3/3.
- Focused prosody-area regression slice green, 3/3.
- Focused song-goal/song-library/E4 UI regression smoke green, 4/4.
- Focused E4 starter-generation smoke green after the final seed-zero guard fix, 1/1.
- Determinism/replay checks are covered by unit spread tests and browser smoke: same seed/material reselect reproduces; same prompt/new song redraws.
- `git diff --check` green.
- Extra pre-doctrine sweep already run: full `npm run smoke` green three times, 80/80, 80/80 on the same non-clean store, then a final current-tree 80/80.
- `git status --short --branch` and `git ls-files --cached --others --exclude-standard | sort` were run before commit.
- `npm audit` is still red on the existing Vite/esbuild advisories. I did not move dependencies in this musical byte because the Vite fix requires changing the exact declared `vite` version.

Review focus:
- Confirm `src/melody-plan.ts` is pure, bounded, deterministic, and owns melody shape.
- Confirm explicit SongGoal pins and UI overrides retain precedence over seeded redraws.
- Confirm the starter path replays saved songs exactly but redraws a same-prompt new song.
- Confirm E3b style reconciliation: style biases plan selection but no second independent melody-shape system remains.
- Confirm no transport/audio/scheduler/persistence/scorer/interplay/vote UI path moved.

Listening focus:
- I cannot honestly claim a human-ear pass from this Codex session.
- Most different pair to audition first: `slow paper lantern by the river at midnight` vs `urgent restless engine under streetlights`, then compare against `crystal roof patterns in quick rain`.
- The bar for approval is still Arne's/your ear: do the generated songs now sound like different musical propositions without opening Inspect? If yes, E5 can decide whether to resume ear votes; if not, I would move next to form/harmony/instrument identity rather than widening more note-profile knobs.

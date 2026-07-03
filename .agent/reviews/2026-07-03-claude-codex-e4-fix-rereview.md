# Claude Re-review: Byte E4 fix — selection replays the saved proposition (Codex)

**From:** Claude Code (architect/listening lead) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-07-03
**Reviewed commit:** `8451d6e` on `origin/codex/byte-e4-composition-variety` (fix on `50edd3c`)
**Supersedes:** the request-changes verdict in `2026-07-03-claude-codex-e4-composition-variety-code-review.md`.

## Verdict

**Approved — merge `codex/byte-e4-composition-variety`.** The fix is exactly the requested shape and it
holds under my original repro and a wider live sweep. E4 is done at the byte bar; the **E4 milestone review**
(full sweep + Arne's hum-test listening session) runs on merge.

## Fix confirmed (code + slice + live)

- **Shared apply path.** `applySongGoalSetupState(goal)` extracted from the create path (tonal context,
  tempo, form, `appliedSongGoal`); library select builds a **validated** interpretation from the entry's
  stored `starter.goal` and applies it through that same function; legacy entries without a starter goal
  no-op. Relational readout-level smoke assertions added. ✓
- **Byte slice green:** build 0 · unit song-goal 3/3, song-starter-material 3/3 · focused
  song-library/E4 smoke 2/2 (10.2s) · diff clean. ✓
- **Live — original repro passes:** selecting the saved "Slow Paper Lantern" now applies **G♭ mixolydian
  75** (was stuck at G♭ ionian 105); round-trip away-and-back reproduces it exactly. ✓
- **Live — sweep:** 10/10 library selections apply their stored goal (readout `data-mode-classical` + BPM
  match per entry; legacy untitled no-ops). ✓

## What the library now sounds like (one sweep, dirty store)

G♭ mixolydian 75 · E aeolian 120 · G♭ mixolydian 125 · A♭ mixolydian 100 · B♭ aeolian 120 · G♭ ionian 105 ·
A♭ phrygian 75 · G phrygian 120 · G lydian 130 — **five modes, tempos 75–130, seven tonics**, and
same-prompt redraw visible live (the two "Slow Paper Lantern" entries drew G♭ mixolydian 75 and A♭ phrygian
75; the two "Urgent Restless Engine" entries E aeolian 120 and G phrygian 120). Selection now *plays* each
proposition. The earlier mode-leaning observation also softened in this larger sample.

## Next

Merge, then the **E4 milestone review**: the Tier-2 sweep (full smoke on the dirty store, all units,
db:smoke, audit) + **Arne's listening session** — five prompts, no overrides, the hum test. That ear verdict
decides whether votes resume (E3 ear checks) or we proceed straight to E5 (form/harmonic motion) first.

# Kickoff: Byte UI-2 — high-level control bar + the "written ↔ evolving" dial (a real control)

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual (copy-paste)
**Date:** 2026-06-14
**Builds on:** UI-1 (the shell + inspect drawer).

---

## Goal

Make the top control bar a clean, calm set of high-level controls, and turn the **"written ↔ evolving" dial**
into a **real master control** — one slider that takes the band from playing the written page, through
letting the line speak, to letting it evolve. It does this by **orchestrating the layers we already built and
verified** — not by adding any new audio/scoring/scheduling path.

**Prerequisite (Arne):** merge `codex/byte-ui1-instrument-shell` to `main`. Then:
```sh
git fetch origin && git checkout main && git pull
git checkout -b codex/byte-ui2-control-dial
```

## What changes
1. **High-level control bar** (refine UI-1's shell): transport play/stop, session mode, tempo, key/mode
   readout — laid out cleanly as the always-visible top controls.
2. **The written ↔ evolving dial** — a prominent slider (0 → 1) whose position selects a regime by driving
   the *existing* controls. Recommended mapping (your thresholds to tune):
   - **written** (low): `prosody off` + evolving performance stopped → the song's written material as-is.
     **This is the default position, and it must reproduce today's default behavior.**
   - **expressive** (mid): `prosody on` (the melody speaks) + evolving stopped → still the written song,
     phrased.
   - **evolving** (high): start the D5 evolving performance on the current song → the band performs its
     evolving best. (Audition takes precedence over prosody in `getActiveMelodyPhrasing`, so the evolving
     regime overrides cleanly; leaving it stops + restores the lower regime.)
   - Show the **current regime label** ("written" / "speaking" / "evolving") next to the dial.

## How it must be wired (the safety discipline)
- The dial **only calls existing, approved functions** — `setProsodyEnabled(...)`,
  `performEvolvingElite(...)`, `stopEvolvingElite()` — which already route through the safe
  `refreshLookaheadSchedule` audition path. **Introduce no new scheduling/audio/scoring path.** This is
  orchestration + UI, not new behavior.
- Therefore the dial is safe by construction: in-scale (inherited), monotonic evolving (inherited from D5's
  strictly-better swaps), clean transitions (the approved refresh).
- **Default = written ⇒ behavior-preserving.** At the default dial position, prosody is off and nothing is
  evolving, so playback == today. Smoke stays green.
- Sliding *down* out of a regime must **cleanly tear down** what it started (`stopEvolvingElite` on leaving
  evolving; `setProsodyEnabled(false)` on returning to written), restoring the lower regime.

## Open design choices (propose in your handoff)
- The exact thresholds, and whether the evolving regime's upper range scales *intensity* (e.g. exploration
  pressure / re-audition rate) — a nice-to-have, not required for UI-2.
- The seed/branch the evolving regime uses (e.g. a deterministic `dial-<songId>` branch + derived seed) so
  the dial's evolution is reproducible per song.
- State sync: the dial is the user-facing source of truth; the `window.prosody.*` dev harnesses stay (in the
  drawer/console). Keep them consistent enough that the dial reflects/drives the canonical state.

## Acceptance tests
1. The control bar shows transport + mode + tempo + the dial, visible without opening the inspect drawer.
2. **Default dial position = written**, and playback behavior is identical to today (prosody off, nothing
   evolving) — full smoke green unchanged from UI-1.
3. Dial → **expressive** enables prosody (melody phrases); dial → **written** disables it (restored).
4. Dial → **evolving** starts the evolving performance (performed melody = the evolving elite); dial back
   stops it and restores the lower regime (audition override cleared).
5. The regime label reflects the dial position.
6. Orchestration only — no new audio/scheduling/scoring path; `git diff` shows the dial calling the existing
   `setProsodyEnabled` / `performEvolvingElite` / `stopEvolvingElite` (no transport/cycle/scoring internals
   changed).

(Test the regime→action mapping deterministically; I'll verify the audible transitions live in review —
slide written→speaking→evolving and confirm the melody changes accordingly, in-scale, with a clean teardown.)

## Finish
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
# don't leave a dev/preview server running against data/ during smoke (it corrupts the candidate tests)
git add -A && git commit -m "Byte UI-2: high-level control bar + written-to-evolving dial"
git show --stat HEAD
git push -u origin codex/byte-ui2-control-dial
git rev-parse origin/codex/byte-ui2-control-dial   # include this sha in the handoff
```
Handoff with branch + commit sha, the threshold/seed/branch choices you made, and validation results.

**Next after UI-2:** UI-3 (prompt front door — surface the SongGoal idea entry), UI-4 (song-picker gallery
with evolution sparklines), UI-5 (reactive stage).

— Claude

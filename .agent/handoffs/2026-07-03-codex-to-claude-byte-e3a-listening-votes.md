From: Codex on macbook-pro-m5
To: Claude Code on mac-mini-pro-m4
Relay: Arne, manual
Subject: Byte E3a listening votes - A/B color comparison surface

Branch: `codex/byte-e3a-listening-votes`
Base: stacked on `codex/byte-e2-tension-color`
Commit: branch HEAD after Codex commit

What changed:
- Added a small E3a vote layer to the existing Ear Check overlay.
- The main experiment now has deterministic takes:
  - `A color off`: bass answers melody, chromatic answer color muted.
  - `B color on`: bass answers melody, chromatic answer color enabled.
- Added vote buttons: `Prefer A`, `Prefer B`, `No difference`.
- After Arne reported the vote felt too subtle, added a visible progress strip (`A pass`, `B pass`, `Vote`), a high-contrast status banner, stronger `Vote recorded: ... A/B comparison complete` copy, and `aria-pressed` selected states on the buttons.
- Moved the older quick feedback buttons under a `Diagnostics` lid so the main UI is the current listening experiment rather than another debug panel.
- Added `window.interplay.applyTake(takeId)` and `window.interplay.vote(value)`.
- Extended `window.interplay.getExperiment()` with `takes`, `activeTakeId`, `votes`, `voteMessage`, and progress state.
- Persisted A/B votes as `song.interplay_vote` with song identity, active/selected take ids, take definitions, answer count, color/enabled state, and last-answer summary.

Important boundaries:
- This is UI/instrumentation only on top of E1/E2.
- No new transport, scheduler, audio, harmony/chord, scorer, model, or evolution path.
- A/B take arming uses the existing override/reset/`refreshLookaheadSchedule()` path.
- The A/B buttons do not seek the transport; the instructions deliberately ask the listener to stop/restart the same short passage because the app does not yet have a clean passage-replay primitive.

Validation:
- `npm run build` green.
- Focused E3a/interplay smoke: `npx playwright test tests/grow.smoke.spec.ts -g "interplay bass answers"` green, 1/1 in 42.9s.
- First full `npm run smoke`: 76/79; failures were unrelated older cases (anchor save count, song-goal apply, form-variant timeout).
- Focused rerun of those 3 failed cases: 3/3 green.
- Confirmation full `npm run smoke`: 79/79 green in 3.7m.
- After the stronger-feedback follow-up: `npm run build` green; focused interplay smoke 1/1 green in 42.8s; full `npm run smoke` 79/79 green in 3.9m.
- `git diff --check` green.
- `npm audit` still red on the known esbuild low and Vite high Windows advisories; no dependency movement in this byte.

Review focus:
- Confirm the A/B surface is usable enough for repeated listening without relying on memory, and that A -> B -> vote has an unmistakable completion moment.
- Verify `A` and `B` keep the same bass-answer system and only change color enabled/disabled.
- Verify `song.interplay_vote` is sufficient raw material for E3/ELO-style human-ear aggregation later.
- Listen for whether color-on is preferred, too sour, or context-dependent; this byte is meant to collect that signal, not decide it.

Ear note:
- I did not do a fresh human listening pass in this commit; the focused smoke proves the rendered event difference and vote persistence. The intended review action is an actual A/B listen through the new controls.

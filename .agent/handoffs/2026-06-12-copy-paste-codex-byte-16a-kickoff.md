# Copy/Paste Handoff: Codex Byte 16a Kickoff

**From:** Claude (Cowork session with Arne)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual

Codex, Grow has a course adjustment. Pull `main` first — the direction is recorded in the repo:

```sh
git pull --ff-only origin main
```

Then read, in order:

1. `.agent/handoffs/2026-06-12-claude-musicality-course-adjustment.md` — the full rationale.
2. `docs/vision-and-plan.md` — new section "Course Adjustment: Musicality First (2026-06-12)".
3. `docs/implementation-plan.md` — new "Byte 16 Arc: Musicality First" with bytes 16a-16d.
4. `.agent/PROJECT_LOG.md` and `.agent/REVIEW_QUEUE.md` 2026-06-12 entries.

The short version: stop deepening chorus take selection. Bytes 15a-15c-a proved the safety architecture, but four bytes refined one 8-bar decision. Arne wants movement toward musicality — harmonic motion, key changes, band conventions arriving as proposals. The planned standalone remember-good byte is folded into this arc and retargeted at band-level outcomes.

## Your next byte: 16a, Audible Harmonic Motion

Make the `SongSketch` chord/root plan audible. Bass and accompaniment should follow the per-section chord plan instead of a static tonal center, committed through the existing song-form/lookahead material path.

Hard scope boundaries for 16a:

- Deterministic only. No model involvement in this byte — isolate the musical change from any protocol change.
- Commit chord changes through the lookahead material path at section boundaries, not at fire time.
- Keep the existing tonal context as the trivial fallback; if a section has no chord plan, behavior is unchanged.
- Do not touch consensus, the critic, proposal text, or persistence schemas beyond what recording the change requires.

What success sounds like: verses, choruses, and bridge become harmonically distinct by ear, and melody material stays coherent over a moving root. If melody coherence needs chord-aware scoring, note it as the follow-up rather than expanding this byte.

Known interactions to watch:

- Byte 14/15 chorus material is committed against the current tonal context; verify the developed chorus and repair candidates still validate when the root moves.
- The validators reject out-of-scale pitches; decide explicitly whether a chord plan changes the active scale, recolors degrees within the existing mode, or both, and document the choice.
- Smoke must stay green across start/stop cycles and song switches; chord-plan state needs the same lifecycle cleanup discipline as lookahead slots.

After 16a, the arc continues: 16b band-proposed bridge modulation (reusing `SongSketchProposal` + 15c consensus, with disposition-derived affinities folded in), 16c model-authored phrase as a validator-gated candidate, 16d mark-a-moment (small, parallelizable). Details in the implementation plan.

When 16a is pushed, prepare the usual copy-paste review handoff for Claude Code on `mac-mini-pro-m4`.

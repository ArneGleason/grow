# Review Queue

Use this file for known risks, open questions, and review focus. Keep entries short enough that a fresh reviewer will read them.

## Open Questions

- Should the GitHub repo be public or private?
- Should the local checkout move to `/Users/arnegleason/code/github.com/arnegleason/grow` before the first commit?
- Will the product need GitHub as a repository remote only, or also as an app/API integration?
- If an app/API integration is needed, should it use a GitHub App, OAuth app, or temporary local token?
- Confirm exact Ollama model tags per machine before real-model work. Current known tags: MacBook target `gemma4:31b`; Mac Mini review machine `gemma4:26b`.
- What should the first capture rolling window length be?
- Should first best-moment detection be heuristic-only, human-marked-only, or include an observer player?
- How should player resistance to producer requests be bounded so it feels alive without getting annoying?
- Should the terrarium keep ambient memory between sessions or start fresh by default?
- Should producer movement be keyboard-based, click-to-move, or another input model?
- What should the producer proxy's first visual identity be: dot with halo, ring, cursor-like marker, or another simple sign?
- What first lookahead target feels right: 4 bars, 8 bars, or about 20 seconds?
- What should the user see when the lookahead buffer runs thin: pause, visible rehearsing, fallback groove, or a mix?
- What should a saved piece contain first: motifs, role assignments, cue points, mode/key/tempo, or all of these?

## Initial Review Focus

- Confirm that no credentials are committed.
- Confirm project structure once the runtime stack is selected.
- Confirm least-privilege GitHub scopes before any GitHub integration work.
- Review `docs/vision-and-plan.md` for scope discipline before implementation begins.
- Review the capture/replay approach before media export work starts.
- Claude Code/Mac Mini first assignment: read `CLAUDE.md` and `.agent/handoffs/2026-05-30-claude-planning-review.md`, then produce critique, strengths, creative drift ideas, and concrete next-step recommendations.
- Review `docs/persistence-checkpoints.md` before implementation: validate SQLite/event-log/snapshot/fork strategy and identify what should stay JSON versus relational.
- Current Claude Code/Mac Mini assignment: use `.agent/handoffs/2026-05-30-claude-review-and-creative-drift.md` as the primary prompt.
- Current Codex implementation guidance from Claude review: start with the smallest rule-based playable terrarium before adding Ollama, SQLite, producer avatar, or fork/capture UI.
- Time-model guidance from Arne: Grow can use a delayed-now/lookahead buffer; players may think non-real-time and commit upcoming material rather than producing every audible moment on the sample clock.
- Session-mode guidance from Arne: Grow is not a nonstop ambience generator; it should support breaks, solo practice, rehearsals, bounded performances, reflection, constructed pieces, and meaningful silence.
- Producer-proxy guidance from Arne: the human should be able to type natural-language prompts, and an interpreter should carry them into the world as movement, speech, cues, and negotiated requests rather than requiring structured controls.
- Scope guidance from Arne: keep Grow solo for now, but leave a future hook for multiple terrariums/bands that can observe, inspire, or react to each other.
- Claude reviewed `docs/implementation-plan.md`; current Byte 1 guidance is stationary pulse player + percussive beat + explicit Tone.js lifecycle cleanup before adding movement or more players.
- First implementation review should pay special attention to repeated start/stop cycles and whether scheduled Tone.js objects are disposed rather than stacked.
- Byte 6c is approved. Forward note: when richer mode behavior arrives, grow `SessionModePolicy` explicitly; if it gains several fields, consider passing the whole policy object rather than one transport handler per policy field.
- Planning review focus after Byte 9b: deterministic aliveness now precedes automatic model-driven music. Review whether the next arc is small enough: reproducible-aliveness principle -> velocity modulation -> performed offset model -> audible microtiming/physical difficulty -> agitation/contagion -> backend/prompt tuning -> one slow-thinking player.
- Byte 6b feel note: posture lags the audible silence by up to the 8-beat recent-activity window during a sustained break. This is correct now; revisit only if the break should read visually faster.
- Byte 6b smoke waits through an 8-beat drain and is intentionally longer. If it gets flaky, prefer probing latest recorded beat/dwell gaps over shortening the behavioral window.
- Byte 5 naming cleanup is implemented. Future review should check that `lookahead.pendingSlotCount`, visible `Pending`, and listening `Heard` labels stay distinct as Byte 6 adds more state.
- Byte 5 forward risk to keep visible: the lookahead refill uses wall-clock `setInterval`, so background tabs may drain the queue safely but drop newly scheduled notes until foregrounded.
- Byte 5 commitment boundary to keep visible: pitch/timing are committed into the lookahead queue, while rest/velocity taste decisions still happen at fire time.
- Byte 9a is approved. Claude verified validator hardening catches model-like bad output: `scaleDegree >= scale.length`, out-of-scale pitch classes, pitch/degree disagreement, and `musicalIdea.durationBeats > maxDurationBeats`.
- Byte 9b is approved. Claude verified a real Mac Mini `gemma4:26b` call safely returned invalid/empty content after about 22 seconds, with parse/validation errors visible and deterministic mock fallback valid.
- Byte 10a review focus: the reproducible-aliveness principle should clearly protect replayability while making room for deterministic heat, expressive mistakes, and bounded micro-variation.
- Byte 10b is approved. Claude verified deterministic replay across two runs, bounded role ranges, audible variation, unchanged grid timing, clean rests, and 4/4 smoke.
- Byte 10c review focus: performed-offset data should be computed at schedule/commit time, surfaced for debug only, and keep `MusicalEvent.absoluteBeat` as grid/replay/listening truth.
- Byte 10c design guard: choose one canonical per-player event index at schedule time so future velocity and timing expression do not desync during break drains.
- Byte 10c implementation review focus: confirm offsets are data-only, synth fire time remains grid-scheduled, `eventIndex` is shared by `expression` and `performedTiming`, break drains do not duplicate or desync committed indexes, and stop clears timing debug state.
- Forward notes for Byte 10d/persistence: consider injecting expression through a transport handler before expression gains multiple dimensions, checkpoint per-player expression counters when seek-and-continue lands, and drive audible offsets partly from musical difficulty plus disposition.
- Before the automatic slow-thinking loop, add a local backend/proxy, handle reasoning-model output such as `message.thinking`, trim the prompt projection, add mocked invalid/unavailable Ollama tests, and surface available models as a picker.

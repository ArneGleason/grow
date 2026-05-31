# Review Queue

Use this file for known risks, open questions, and review focus. Keep entries short enough that a fresh reviewer will read them.

## Open Questions

- Should the GitHub repo be public or private?
- Should the local checkout move to `/Users/arnegleason/code/github.com/arnegleason/grow` before the first commit?
- Will the product need GitHub as a repository remote only, or also as an app/API integration?
- If an app/API integration is needed, should it use a GitHub App, OAuth app, or temporary local token?
- What exact local Ollama model tag should map to "Gemma 4 31B"?
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
- Planning review focus after Byte 6c: player thinking now precedes producer work. Review whether the new Byte 7-12 arc is small enough: profiles/backstory -> musical-excerpt thought protocol -> Ollama health/primer -> one slow-thinking player -> song sketch/piece construction -> thought memory/persistence prep.
- Byte 6b feel note: posture lags the audible silence by up to the 8-beat recent-activity window during a sustained break. This is correct now; revisit only if the break should read visually faster.
- Byte 6b smoke waits through an 8-beat drain and is intentionally longer. If it gets flaky, prefer probing latest recorded beat/dwell gaps over shortening the behavioral window.
- Byte 5 naming cleanup is implemented. Future review should check that `lookahead.pendingSlotCount`, visible `Pending`, and listening `Heard` labels stay distinct as Byte 6 adds more state.
- Byte 5 forward risk to keep visible: the lookahead refill uses wall-clock `setInterval`, so background tabs may drain the queue safely but drop newly scheduled notes until foregrounded.
- Byte 5 commitment boundary to keep visible: pitch/timing are committed into the lookahead queue, while rest/velocity taste decisions still happen at fire time.
- Byte 8 review focus: validate `MusicalExcerpt` structure, especially phrase-relative positions across bar boundaries, step ordering, scale-degree/pitch fields, and whether `sourceStartBeat` should remain protocol metadata or become debug-only.
- Byte 8 behavior guard: thought requests and mock intents are inspection-only. They should not change transport, lookahead refill, taste decisions, session modes, event ledger semantics, or sound.
- Byte 8 forward question: is the deterministic mock responder too musical too soon, or just enough to test protocol validity before Ollama? Byte 9 should add Ollama health/session primer only, not schedule model output into music.

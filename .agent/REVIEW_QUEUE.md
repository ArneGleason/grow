# Review Queue

Use this file for known risks, open questions, and review focus. Keep entries short enough that a fresh reviewer will read them.

## Open Questions

- Should the GitHub repo be public or private?
- Should the local checkout move to `/Users/arnegleason/code/github.com/arnegleason/grow` before the first commit?
- Will the product need GitHub as a repository remote only, or also as an app/API integration?
- If an app/API integration is needed, should it use a GitHub App, OAuth app, or temporary local token?
- Confirm exact Ollama model tags per machine before automatic real-model work. Current known useful tags include MacBook `gemma4:31b`, Mac Mini `gemma4:26b`, and fast instruct candidate `qwen3:4b-instruct-2507-q4_K_M`.
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
- Byte 10c is approved. Claude verified the shared schedule-time event index, deterministic bounded offsets, data-only playback, clean break/drain behavior, and 5/5 smoke.
- Byte 10d is approved. Claude verified audible offsets are scheduled off-grid while `absoluteBeat` stays grid truth, no per-player reorder occurs, offsets replay deterministically, break drain remains clean, and lifecycle stress is leak-free.
- Forward notes after Byte 10d: decide whether difficult material should baseline push/rush or drag/carefully slow, label `Dynamics` as just-heard versus `Offset` as next-committed, capture `latestCommittedPitchByPlayer` in future seek-and-continue generator state, and consolidate duplicated pitch parsers into a shared music-theory utility.
- Arne live-preview timing note: current audible microtiming can read as perpetual stumble. Hypothesis to review before more timing behavior: add a hierarchy of shared tempo drift, shared groove pocket, per-player pocket, material pressure, and rare stumble/recovery, rather than driving most feel from per-note offsets.
- Byte 10e is approved. Claude verified agitation/contagion is bounded, inspectable, read-only, playback-neutral, and genuinely disposition-differentiated: steady pulse damps heat while melody catches/amplifies it.
- Forward notes after Byte 10e: before contagion drives behavior, add a build/release governor with ceiling plus slow decay for the closed loop; current agitation is density/velocity-led because microtiming is subtle; agitation and contagion are natural terrarium visual-intensity signals before they become audible behavior.
- Byte 10f-a is approved. Live Mac Mini qwen3 verification returned valid projected-JSON intents for pulse, bass, and melody in about 4-5 seconds each, with clean parsing, zero validation errors, system-owned `sourceStartBeat`, and character-grounded rationales.
- Byte 10f-b1 is approved. Claude verified the Vite proxy is transport-only, localhost-scoped, and that browser code uses same-origin `/api/ollama/*` instead of direct Ollama fetches.
- Byte 10f-b2 is approved. Claude verified pitch is removed from the model schema, system-side pitch derivation does not mask bad degrees, proxy abort propagation works, and real qwen3 returned 6/6 valid manual thought tests.
- Pre-Byte-11 invalid-200 smoke fixture is implemented. A mocked HTTP 200 with validator-failing JSON yields `invalid`, provider `ollama`, valid mock fallback, and stopped transport.
- Byte 11a is approved. Claude verified no surprise calls before health check, playing+rehearsal+ready gating, one request at a time, thinking posture cleanup, non-blocking transport, clean discard on gate loss/stop, and real qwen3 pending-to-accepted cycles.
- Byte 11b is approved and merged. Claude verified the first audible bridge is bounded, melody-only, bar-snapped, rest/thin only, validator/fallback-gated, lifecycle-clean, live-qwen3 compatible, and smoke-covered against accepted-but-inert output.
- Byte 11b accepted-queue cleanup is implemented: `src/slow-thinking.ts` now has one accepted-intent handoff path, `onAccepted`.
- Byte 11c-a is approved and merged. Claude verified the first pitch-changing slow thought stays inside the safety envelope: melody-only, +/-1 octave, <=4-beat bar-snapped window, only existing scheduled notes, pulse/bass untouched, no slot changes, smoke 15/15, and live qwen3 compiling bounded `shift_register` windows.
- Byte 11c-a forward notes: the rescue behavior is acceptable but should be named as slow-thought precedence over taste rests; add explicit `registerDelta` so the model can state direction and choose no-op; when replay/event logging lands, record grid pitch versus performed pitch structurally.
- Byte 11c-b is approved and merged. Claude verified explicit `registerDelta` resolves the 11c-a implicitness note, strict validator coverage is complete, `registerDelta: 0` remains valid restraint, and the old `AcceptedSlowThought.request` should be pruned.
- Byte 11c-b live finding: real qwen currently selects `shift_register` but omits `registerDelta`, so the valid strict path rejects to deterministic fallback. Next compliance slice should try conditional structured-output schema support and/or a compact concrete example; do not reintroduce inference/defaulting.
- Byte 11c-c is approved and merged. Claude verified live qwen3 compliance improved to accepted `shift_register` intents with valid `registerDelta`; keep treating prompt wording plus validator/fallback as the durable guard because the schema conditional is mostly self-documenting with current local grammar support.
- Byte 11d is approved and merged. Claude verified two controllers, per-player playback windows, global one-pending serialization, lifecycle cleanup across both lanes, and smoke 16/16.
- Byte 11e is approved and merged. Claude confirmed bass/non-shift formats omit `registerDelta`/`shift_register`, melody shift formats still include the property and conditional, validator behavior is unchanged, and no playback/scheduling behavior moved.
- Byte 12a is approved and merged. Claude verified the inspect-only `SongSketch` is pure, band-level, playback-neutral, and that the folded prompt cleanup removes `registerDelta` from non-shift system/user/schema while preserving melody shift guidance.
- Byte 12b-a is approved and merged. Claude confirmed the roman-root `chordPlan` plus structured `rootDegrees` split, per-song density/root derivation, memoized content boundary, and inspect-only/no-playback line.
- Byte 12b-b is approved and merged. Claude confirmed the deterministic proposal/response surface is the right first band-level coordination shape and remains strictly inspect-only.
- Next proposal review focus: model-authored proposal text should use the existing validator + deterministic mock fallback, while kind/stance/provenance stay deterministic; do not fold persistence or proposal-to-playback into that small slice.
- Byte 12b-c is approved and merged. Claude verified the model is only a proposal-text copywriter, invalid/failed/stale output falls back to deterministic mock text, the model-facing schema omits structural fields, and playback/transport/slow-thinking/scheduling are untouched.
- Carry-forward principle from Byte 12b-c: model-authored prose is data, not instruction. When proposal-to-playback eventually lands, act only on deterministic structured fields such as kind, stance, chord/root plan, target section, and bounded validation output; never parse model prose as commands.
- Byte 13b-c1 is approved and merged. Claude's only minor notes were cosmetic/recovery polish: bfcache restore after pagehide can leave the visible status at `flushing` until the next record, transient retrying shows `lastError`, and `nextRetryAt` is tracked but not displayed.
- Byte 13b-c should persist `musical.event_recorded` behind a preallocated/high-frequency ring buffer plus separate timer/idle batch flusher. Review focus: no fetch/timer work inside Tone scheduler callbacks, ordering/seq under load, deliberate stop/cleanup flush-or-discard behavior, bounded back-pressure such as drop-oldest or coalesce surfaced in the inspector, and whether grid-vs-performed pitch split lands before or alongside the event record.
- Future material-injecting actions still need the commit/lookahead path; the current pitch override should not become a backdoor for adding notes or changing motif shape.
- Future band-level changes such as key, mode, chord sequence, or song section changes should use a coordinated band proposal/song-sketch path, not private per-player intent.
- Model picker is convenience, not a pre-Byte-11 blocker; env/input/`window.ollama.setConfig()` already cover model selection.
- The current Ollama proxy is a Vite dev middleware. When SQLite/persistence or a durable backend lands, re-host the same proxy protocol in a standalone local server rather than changing the thought contract.
- Ollama API note: for `gemma4:31b`, include `think: false` in short structured `/api/chat` calls or the response may put reasoning in `message.thinking` and leave `message.content` empty.

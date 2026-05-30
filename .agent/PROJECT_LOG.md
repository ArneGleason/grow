# Project Log

Use this file for durable decisions and meaningful project events. Keep entries short and chronological.

## 2026-05-30

- Adopted the Studio Pattern from `the-studio-pattern`.
- Source version/date/commit: `2026-05-30 initial scaffold`, `dbbe3e9`.
- Local adaptation: early Grow project scaffold with GitHub connection notes; product scope and runtime stack are still TBD.
- Initial review focus: define product scope, choose runtime stack, confirm GitHub repo visibility and integration model.
- Captured the first product intention in `docs/vision-and-plan.md`: a local Ollama-powered musical terrarium with top-down agents, human avatar interaction, shared listening, instrument invention, and phased band-session behavior.
- Added initial Studio Pattern collaboration intent: Codex as implementation lead, Antigravity and Claude as possible review or creative-drift participants.
- Confirmed browser-first prototype, tonal/modal-plus-rhythm musical language, producer-like human avatar, Gemma 4 31B Ollama target, effects-agent role, and rolling best-moments capture/replay/export direction.
- Added `CLAUDE.md` and `.agent/handoffs/2026-05-30-claude-planning-review.md` so Claude Code on the Mac Mini has a clear review/creative-collaboration entry point.
- Created private GitHub repository `ArneGleason/grow`, configured it as `origin`, and pushed `main`.
- Added initial persistence recommendation in `docs/persistence-checkpoints.md`: SQLite via the local backend, using an append-only event log plus periodic snapshots for rewind, best-moment replay, and branch/fork support.
- Added `.agent/handoffs/2026-05-30-claude-review-and-creative-drift.md` as the next Claude Code/Mac Mini assignment: critique risks, suggest what to change/remove, identify what to protect, propose synergistic creative ideas, and recommend the smallest implementation slice.
- Added `.agent/handoffs/2026-05-30-copy-paste-claude-kickoff.md` so Arne can manually paste a concise Claude Code kickoff prompt while preserving the human-mediated relay step.
- Added explicit `From`, `To`, and `Relay` fields to handoffs so manually copied text preserves authorship, intended recipient, machine context, and Arne's human-routing role.
- Added a standing rule to route reusable Grow learnings back into the canonical Studio Pattern and captured the first cross-project feedback note: addressed handoffs with explicit `From`, `To`, and `Relay` metadata.
- Received Claude Code planning review via Arne's manual relay and preserved the intake in `.agent/reviews/2026-05-30-claude-planning-pass.md`.
- Adopted Claude's scope cuts into `docs/vision-and-plan.md` and `docs/persistence-checkpoints.md`: first build becomes a rule-based PixiJS/Tone.js terrarium; Ollama, SQLite, producer avatar, forks, instrument invention, effects routing, and automatic capture move later.
- Captured Arne's latency direction in `docs/time-and-lookahead.md`: Grow should use a delayed-now/lookahead model where players can listen, think, rehearse, commit future material, and perform later in sync instead of needing hard real-time LLM decisions.
- Captured Arne's session-mode direction in `docs/session-modes.md`: Grow should avoid nonstop generative ambience and instead support breaks, solo practice, rehearsal, performance, reflection, constructed pieces, opt-in participation, and meaningful silence.
- Captured Arne's producer-avatar direction in `docs/producer-proxy.md`: the human should type natural-language prompts, and a producer proxy/interpreter should move, speak, cue, and negotiate in-world on the human's behalf.
- Captured Arne's scope direction in `docs/future-multi-terrarium.md`: Grow remains a solo local instrument for now, but future architecture may allow banking between terrariums/bands and having one group observe or react to another.
- Added `docs/implementation-plan.md` and a Claude review handoff for the first build byte. Proposed Byte 1: Vite/TypeScript + PixiJS/Tone.js page with bounded terrarium, one visible player, one simple sound, start/stop, and status readout.
- Received Claude's Byte 1 implementation-plan review and preserved it in `.agent/reviews/2026-05-30-claude-byte-1-plan-review.md`. Adopted revisions: stationary pulse player, percussive 90 BPM beat, explicit Tone.js lifecycle module, stable test hooks, HMR cleanup, no React, and movement deferred to Byte 2.

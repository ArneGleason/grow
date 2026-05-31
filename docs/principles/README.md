# Grow Interaction Principles

This folder holds foundational design principles for Grow's interactive system.

Use these docs for ideas that shape several implementation phases. Keep feature plans in `docs/implementation-plan.md`, and keep specific feature detail in the feature docs under `docs/`.

## Doc Sizing

- One principle per file.
- Prefer short, reusable guidance over exhaustive theory.
- If a doc starts mixing multiple ideas, split it.
- If a principle implies near-term work, link it back to the byte sequence in `docs/implementation-plan.md`.
- Keep speculative long-term ideas clearly marked so they do not accidentally become current scope.

## Current Principles

- `listening-model.md`: players hear structured musical behavior first, raw audio features second.
- `inner-music.md`: players can privately imagine, revise, and later commit musical material.
- `subjective-taste.md`: judgments like good, bad, boring, or neat come from player temperaments applied to shared listening frames.
- `player-thinking.md`: local LLM reasoning should produce compact, inspectable, future musical intents for players rather than live audio or hidden narration.

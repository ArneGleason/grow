# Copy/Paste Handoff: Byte 9b Code Review

**From:** Codex on `macbook-pro-m5`  
**To:** Claude Code on `mac-mini-pro-m4`  
**Relay:** Arne, manual  
**Date:** 2026-05-31  
**Project:** Grow  
**Repo:** `https://github.com/ArneGleason/grow`

Claude, please review Grow Byte 9b on `main` after pulling the latest GitHub state.

## Setup

```sh
cd /path/to/your/grow/checkout
git fetch origin
git switch main
git pull --ff-only origin main
git status --short --branch
```

Expected latest implementation commit should be titled:

```txt
Implement Byte 9b Ollama manual thought probe
```

## Expected Byte

- Byte 9b: Ollama health and manual thought probe.
- Main goal: connect the browser prototype to local Ollama as an inspectable/manual surface without letting model output drive music yet.

## What Changed

- Added `src/ollama.ts` as the local Ollama boundary for `GET /api/tags` and `POST /api/chat`.
- Added configurable base/model settings with defaults:
  - `VITE_GROW_OLLAMA_BASE_URL=http://127.0.0.1:11434`
  - `VITE_GROW_OLLAMA_MODEL=gemma4:31b`
- Added an Ollama inspector section with base/model inputs, Check, Send thought, health, model, latency, parse result, validation result, fallback status, validator errors, primer summary, and raw response.
- Added `window.ollama` hooks:
  - `getConfig()`
  - `setConfig(config)`
  - `getHealth()`
  - `checkHealth()`
  - `getLastThoughtTest()`
  - `runManualThoughtTest(playerId?)`
  - `getSessionPrimer()`
  - `getInfluenceProbePrompt(playerId?)`
  - `parseThoughtResponse(rawResponse, playerId?)`
- Added a JSON-only session primer that defines `MusicalExcerpt.steps[].scaleDegree` as a pitch-class index `0..scale.length - 1`, with separate `octave`, and says the system owns `sourceStartBeat`/placement.
- Added response parsing/normalization so model-authored `sourceStartBeat` is overwritten by system state.
- Kept deterministic mock intent fallback visible and valid.
- Added an `influence_probe` prompt fixture that asks for abstract transferable technique, not direct style imitation/copying.
- Added the small Byte 9a forward-note validator check for pitch-embedded octave versus explicit `octave`.
- Updated smoke coverage with a mocked local Ollama endpoint. No real Ollama server is required for tests.

Intentionally not implemented:

- no automatic player thinking loop,
- no compiling model output into scheduled audio,
- no producer proxy,
- no SQLite or thought persistence,
- no new session-mode behavior,
- no real-model requirement in automated tests.

## Please Validate

```sh
npm audit
npm run build
npm run smoke
git diff --check
git ls-files --cached --others --exclude-standard | sort
```

## Review Focus

1. Confirm Byte 9b did not change transport, lookahead, taste, session-mode behavior, or audio scheduling.
2. Confirm the Ollama API boundary is small enough and failure-safe enough for a browser-first prototype.
3. Confirm the primer is clear and likely to produce parseable, bounded JSON within a small response.
4. Confirm scale-degree, octave, `sourceStartBeat`, and `intent.target` ownership are unambiguous.
5. Confirm manual display surfaces parse/validation failures without swallowing important errors.
6. Confirm deterministic mock fallback remains available and valid when Ollama is unavailable or invalid.
7. Confirm the mocked endpoint smoke test is meaningful and does not depend on a real local model.
8. Assess whether the default model tag `gemma4:31b` is acceptable as a configurable placeholder, or whether the repo should avoid guessing the exact tag until Arne confirms `ollama list`.
9. Review whether direct browser-to-Ollama fetch is okay for now, or whether Byte 10 should move this behind a tiny local backend/proxy before slow-thinking loops.

Please report:

- Verdict: approved or required fixes.
- Required fixes with file/line references.
- Non-blocking forward notes for Byte 10.
- Commands/tests you ran.
- Whether you pushed a durable review artifact branch, and if so the branch name/commit.

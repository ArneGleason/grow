# Claude Review: Grow Byte 10f-a (Projected JSON Thought Prompts)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-05-31
**Reviewed commit:** `2c8729b Implement Byte 10f projected JSON prompts` (head `009e109`) on `main`
**Review branch:** `claude/byte-10f-a-code-review`

## Verdict

**Approved.** No required fixes. This is the clean realization of the Ollama steer that has been
pending since Byte 9b: a small instruct model (`qwen3:4b-instruct-2507-q4_K_M`) with `think: false`, a
trimmed projected prompt, and a JSON-schema `format`. `projected-json` is a thin model-facing adapter,
not a second contract; the canonical request -> projected prompt -> PlayerThoughtIntent -> existing
validator -> mock fallback path is intact; and it remains manual-probe-only. Best of all, I verified
the new pipeline produces a **valid** intent end-to-end against a real installed instruct model -
exactly the thing that returned empty content from the gemma4 reasoning model in Byte 9b.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **8/8 passed**; `git diff --check` -> clean.
- Live probe:
  - **Config wired:** default model `qwen3:4b-instruct-2507-q4_K_M`, protocol `projected-json`;
    `setConfig({ model })` changed the model and **preserved the protocol**.
  - **Target model not yet pulled here:** health correctly reports `model-missing`
    ("Ollama is reachable, but qwen3:4b-instruct-2507-q4_K_M was not listed"; available:
    gemma4:26b / llama3.2 / qwen2.5-coder:32b / qwen3-coder:30b). So the target needs an `ollama pull`;
    the default-falls-back behavior is correct in the meantime.
  - **New pipeline verified end-to-end against a real instruct model** (`llama3.2:latest` as a proxy,
    ~14.7 s): `status: valid`, `provider: ollama`, parse ok, **validation valid**, in-bounds intent
    (`vary_motif`, responseLevel `influence_note`, 2 steps, durationBeats 2). The model **copied
    requestId/playerId exactly** (schema enum-locked) and **omitted sourceStartBeat**, which the system
    then inserted via coercion (`hasSourceStartBeat: true` on the final intent). This is precisely the
    Byte 9b failure (empty content from a reasoning model) now resolved.
  - **Manual-probe-only confirmed:** playback intact while probing (`playing`, `healthy`, `pending 25`,
    0 off-grid); nothing schedules the intent.

## Findings

No required fixes. Observations / forward notes.

### Verified-working (the headline)
The structured-output approach works: projected prompt + JSON-schema `format` + `think: false` + a real
instruct model produced a valid, in-bounds, validator-passing intent through the unchanged canonical
path, with the system correctly owning `sourceStartBeat`/placement. The exact target
`qwen3:4b-instruct-2507-q4_K_M` still needs `ollama pull` on this machine to confirm; the `think: false`
flag specifically matters for qwen3 (which has a thinking mode), and llama3.2 has none - so the proxy
under-tests that one flag, but the flag is present and correct, and the pipeline is sound.

### Observation - the bounds are now encoded twice (schema + validator)
The JSON schema (`createThoughtIntentJsonSchema`) and `validatePlayerThoughtIntent` both encode the same
rules (action enum = allowedActions, scaleDegree max = scale.length-1, durationBeats/steps caps, target
bounds). They serve different consumers - the schema constrains model decoding, the validator is the
runtime authority - so the duplication is acceptable, but they can drift. Consider deriving both from one
source eventually, or a small test asserting the schema's numeric bounds match the validator's. If they
drift, worst case is stale model guidance; the validator still rejects bad output, so it is not a
correctness risk.

### Observation - the schema can't express the conditional note rule
The step schema marks `pitch`/`scaleDegree` optional, so it accepts a `note` step with neither - but
`validateMusicalExcerpt` requires a note to carry pitch or scaleDegree. JSON schema can express this
(if/then or oneOf), but it is omitted for simplicity. So a schema-valid note could still be
validator-rejected and fall to the mock. Fine (the validator backstops, and a structured-output model
rarely omits the pitch it just chose), just noting the schema is necessarily a looser guide than the
validator on conditionals.

### Nit - confirm a real qwen3 run once pulled
When `qwen3:4b-instruct-2507-q4_K_M` is pulled, do one real run to confirm (it is the model the
`think: false` flag is for). Until then, the `model-missing` health state + `availableModels` list +
env/input/`setConfig` override handle the gap gracefully (and a model picker is correctly out of scope
for 10f-a).

## Answers to the review focus

1. **Still manual-probe-only?** Yes - verified playback intact (0 off-grid, healthy/25); the diff touches
   only `ollama.ts` / `main.ts` / the new `thought-prompt-protocols.ts` + tests/docs; nothing schedules
   the intent.
2. **`projected-json` a thin adapter, not a second contract?** Yes - `ProjectedThoughtRequest` is a
   compact *view* of `PlayerThoughtRequest` (prompt input only, via `CompactMotifStep` tuples); the
   response is still `PlayerThoughtIntent`; the schema mirrors the existing validator. No second contract.
3. **Canonical path preserved?** Yes - request -> projected prompt -> model -> coerce ->
   `validatePlayerThoughtIntent` -> mock fallback if invalid. Verified end-to-end (a real model's output
   passed through to `valid`).
4. **`ollama.ts` defaults?** Confirmed: model `qwen3:4b-instruct-2507-q4_K_M`, `think: false`,
   `num_predict: 512`, `format` is the schema object (not bare `"json"`); the old verbose prompt
   (full Request JSON, serialized seed, sourceStartBeat example) is removed.
5. **Machine override works?** Yes - verified `setConfig({ model })` switches the model and preserves the
   protocol; `VITE_GROW_OLLAMA_MODEL` / `VITE_GROW_THOUGHT_PROMPT_PROTOCOL` env and the model input still
   apply.
6. **Schema strictness balance?** Good. Strict on structure/bounds (which constrained decoding turns into
   guidance, not brittleness), `additionalProperties: false` excludes system-owned fields (sourceStartBeat
   can't be emitted), and it is necessarily looser than the validator only on conditionals (note-needs-
   pitch). Verified a real model produced schema-valid + validator-valid output.
7. **Smoke assertions meaningful, not brittle?** Yes - asserts model qwen3, `think: false`,
   `num_predict <= 512`, `format` has `additionalProperties: false`, the prompt contains the projection
   (`Request projection:`, `"v":"grow.thought/1"`, `"motif"`) and does **not** contain `Request JSON:`,
   `"seed"`, or `"sourceStartBeat"`. Structure/presence based, not exact-prompt based.
8. **Docs separation?** Yes - the implementation plan and notes describe 10f-a and explicitly hold back
   backend proxy, model picker, calibration harness, and the slow-thinking loop as later work. Properly
   separated.

## Open questions / forward notes

- `ollama pull qwen3:4b-instruct-2507-q4_K_M` on the mac mini, then confirm one real run (validates the
  `think: false` path specifically).
- Consider a single source of truth (or a parity test) for the schema bounds vs the validator bounds.
- Out of scope and correctly deferred: backend proxy (still the right move before an automatic loop, for
  CORS/latency/SQLite), model picker (the `availableModels` list is already fetched), calibration
  harness, and scheduling Ollama-authored intents (which will need the canonical-path + the lookahead
  commit point + a governor if it ever drives behavior).

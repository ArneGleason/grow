# Claude Review: Grow Byte 9b (Ollama Health + Manual Thought Probe)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-05-31
**Reviewed commit:** `58bdfc7 Implement Byte 9b Ollama manual thought probe` on `main`
**Review branch:** `claude/byte-9b-code-review`

## Verdict

**Approve.** No required fixes. The Ollama boundary is small, failure-safe, and never lets model
output near the music. It connects the prototype to a real local model as a manual, inspectable
surface - exactly the stated goal - and I verified that goal end-to-end against the **real** local
`gemma4:26b` on this mac mini. Scope is clean (no transport/taste/lookahead/session/audio changes).
The most valuable thing this byte did is reveal, via a real probe, that the current prompt/settings
don't yet elicit valid JSON from a reasoning model - which is precisely what a manual probe is for.
Those are forward notes for Byte 10, not defects in 9b.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **3/3 passed**; `git diff --check` -> clean.
- `git ls-files` - no secret-like files tracked; `.env.example` documents only non-secret Ollama vars.
- **Real local Ollama on this machine (mac mini):**
  - `checkHealth()` with `gemma4:26b` -> `ready`, 4 ms, and `availableModels` listed the real installed
    set: `["gemma4:26b","llama3.2:latest","qwen2.5-coder:32b","qwen3-coder:30b"]`. So the browser fetch
    reached Ollama - **CORS did not block here** (see forward note).
  - `runManualThoughtTest("melody")` against the real model -> `provider: ollama`, `status: invalid`,
    **empty rawResponse**, parse error "response did not contain a JSON object", **mock fallback stayed
    valid**, real latency **~21.7 s**, nothing threw. The failure-safety works against a real model.
  - Direct `/api/chat` probe with a short prompt -> `message.content` = `{"action":"vary_motif",
    "confidence":0.5}` in ~3.2 s. So the boundary reads `message.content` correctly; the empty response
    in the full test is a prompt/model issue, not a parsing bug (diagnosis below).
  - Inspector surfaced all fields distinctly (health, model, latency, parse error(1), valid invalid(1),
    fallback "mock fallback valid (change_density)", errors, primer summary, raw none). Errors not swallowed.
  - Playback intact while probing: `playing / healthy / pending 25 / rehearsal`.

## Findings

No required fixes. Forward notes for Byte 10, ordered by usefulness.

### Forward (real-model diagnosis) - `gemma4:26b` is a reasoning model; the probe returns empty content
The live `/api/chat` response has `message: { role, content, thinking }` - `gemma4:26b` emits a
`thinking` field. `ollama.ts` reads only `payload.message?.content ?? payload.response` (`:258`). With
the *full* thought prompt (which embeds the entire request JSON) plus `num_predict: 700`, the reasoning
phase appears to consume the budget and `content` comes back empty (~22 s), while a short prompt returns
clean JSON in ~3 s. So the real probe correctly produced invalid -> fallback. To make the real model
useful in Byte 10: (a) handle reasoning output (read/strip `message.thinking`, or set options to
suppress thinking, or raise/separate `num_predict`), and (b) **shrink the prompt** - `createOllamaThoughtPrompt`
sends `JSON.stringify(request)`, i.e. the whole seed (disposition, fragments, full excerpt with every
step). Send a trimmed projection (allowedActions, constraints, a compact excerpt) so a small local model
isn't wading through a large object before answering. None of this blocks 9b; the probe exists to find it.

### Forward (architecture, answers Q9) - real latency ~22 s argues for the backend proxy and confirms delayed-now
The real call took ~22 s. Two consequences: (1) the future slow-thinking loop must be fully async and
must never block the transport - which is exactly what the Byte 5 lookahead/delayed-now design is for;
this is strong real-world validation of that architecture. (2) Direct browser->Ollama is fine for a
manual probe, but **Byte 10 should move model calls behind the small local backend the original
`vision-and-plan.md` always specified** before the automatic loop: it centralizes the slow calls, avoids
per-environment CORS surprises, and is where SQLite/persistence will live anyway.

### Forward (answers Q9, downgraded) - CORS worked here but is environment-dependent and undocumented
I expected the cross-origin browser fetch (`:5173` -> `:11434`) to be CORS-blocked, but on this mac mini
it reached Ollama fine (health `ready`). So this is not a blocker. But it depends on the local Ollama
version / `OLLAMA_ORIGINS` / loopback handling, and nothing in `LOCAL_DEV_NOTES`/`.env.example` documents
the requirement - the only acknowledgement is that the smoke mock supplies CORS headers and handles the
OPTIONS preflight. Recommend a one-line note ("if Check reports unavailable from the browser, launch
Ollama with `OLLAMA_ORIGINS` allowing the dev origin, or use the Byte 10 backend proxy"). The backend
proxy makes this moot.

### Forward (answers Q8) - default model tag, and surface `availableModels` for selection
`gemma4:26b`/`gemma4:31b` are real tags Arne has, per machine - so the default `gemma4:31b` is a
reasonable *configurable placeholder*, and the `.env.example` comment already says to set it to your
`ollama list` value. The `model-missing` state plus the `availableModels` list handle a mismatch
gracefully (verified: with `gemma4:31b` it reported model-missing; with `gemma4:26b`, ready). Small
enhancement: the health state already fetches `availableModels` - surface them in the inspector as a
picker (or at least display them) so the user can choose from what is actually installed instead of
typing a tag. The data is in hand; only the UI affordance is missing.

### Nits
- The "Latency" row appears to show the last *thought-test* latency (21708 ms) even right after a fast
  *health* check (4 ms) - the two latencies are different concepts sharing one label. Consider labeling
  or separating health-latency vs thought-latency.
- The coercion casts (`as ThoughtAction`, `as ThoughtResponseLevel`) produce a structurally-typed intent
  from arbitrary JSON; this is safe *only because* `validatePlayerThoughtIntent` always runs afterward.
  Worth a code comment so no future caller consumes a parsed intent without validating it first.

## Answers to the nine review questions

1. **Transport/lookahead/taste/session/audio unchanged?** Yes. The diff touches `ollama.ts` (new),
   `main.ts` (UI + hooks), `style.css`, `thought-protocol.ts` (+3 validator checks), `world-state.ts`
   (accessors), and tests. Verified live that playback stayed `playing/healthy/25/rehearsal` while
   probing, and no model output is compiled to audio.
2. **API boundary small and failure-safe?** Yes. Two endpoints, `fetchWithTimeout` (AbortController),
   every call try/caught into a structured fallback result, mock fallback computed before the fetch so
   it is always present. Verified against a real failing model: invalid -> fallback, nothing thrown.
3. **Primer clear and likely to yield parseable bounded JSON?** Clear and well-constructed (JSON-only,
   one action, scaleDegree convention, system-owned placement, <=160-char rationale, `format: "json"`,
   low temp). It produced clean JSON for a short prompt; for the full prompt it needs the reasoning-model
   + prompt-size handling above. So: right intent, needs one tuning pass for this specific model.
4. **scaleDegree/octave/sourceStartBeat/target ownership unambiguous?** Yes, and enforced, not just
   documented: the primer states the conventions, coercion overwrites `sourceStartBeat` with system
   state (smoke asserts the model's `999` is discarded), and the validators reject out-of-range degree,
   out-of-scale pitch, pitch/degree disagreement, and now pitch/octave disagreement.
5. **Manual display surfaces failures without swallowing?** Yes - verified live: parse error, validation
   invalid (with counts), explicit error text, fallback status, and raw response are all shown as
   distinct fields.
6. **Deterministic mock fallback available and valid when Ollama fails/invalid?** Yes - verified the
   fallback intent is computed first and validated; on the real failed call it stayed valid
   (`change_density`).
7. **Mocked smoke meaningful, no real model needed?** Yes - it routes `/api/tags` and `/api/chat`, runs a
   crafted response through the real parse->coerce->validate pipeline, and asserts the `sourceStartBeat`
   overwrite and transport non-interference. Gap: it only covers the happy path - add a mocked
   invalid-response case (garbage / out-of-scale) and an unavailable case (`route.abort()`) so the
   failure-safety I verified by hand is locked down by a test.
8. **Is `gemma4:31b` acceptable as a placeholder?** Yes as a *configurable* placeholder, given the
   model-missing state + availableModels + `.env` guidance. Surface availableModels as a picker (forward
   note). Real installed tag here is `gemma4:26b`.
9. **Browser->Ollama fetch okay, or move behind a backend?** Okay for the manual probe (it worked here),
   but Byte 10 should move it behind the planned local backend before the slow-thinking loop - for the
   ~22 s latency, CORS portability, and SQLite locality reasons above.

## Required fixes before Byte 10

None.

## Creative / aliveness lens

- The `influence_probe` guardrail - "abstract transferable technique, not a copied melody/lyric/
  signature passage" - is both a sound safety choice and squarely on-theme: it pushes the model toward
  *character and technique* rather than mimicry, which is the same "musical agency, not imitation" spirit
  as the taste layer. Keep it; it is one of the more quietly important design decisions in this byte.
- The measured ~22 s latency reinforces the earlier advice: let the **deterministic expressive layer**
  (breathing dynamics, micro-timing, the disposition-governed agitation loop) carry most of the felt
  aliveness, so the slow model can be an occasional weather change rather than a per-moment dependency.
  A model that thinks for 22 s is perfect as the thing that shifts the forecast now and then; the
  deterministic layer is the wind that never stops blowing. Byte 10's loop should schedule model
  thoughts as lookahead commitments (the delayed-now buffer), never as blocking calls.

## Non-blocking forward notes for Byte 10

- Move model calls behind the small local backend proxy; schedule thoughts via the lookahead buffer.
- Handle reasoning-model output and trim the prompt so the real model returns valid JSON.
- Add mocked invalid + unavailable smoke cases.
- Surface `availableModels` as a selectable list in the inspector.
- Keep the deterministic mock as the offline fallback (and as the always-on expressive baseline).

# Claude Review: Grow Byte 11c-b (Explicit Register Delta)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-01
**Reviewed commit:** `3d10ee0 Add explicit register delta` on branch `codex/byte-11c-b`
**Base:** `main` at `ea7cbb6`
**Review branch:** `claude/byte-11c-b-code-review`

## Verdict

**Approved - merge `codex/byte-11c-b`.** No required fixes. This is the clean cleanup it set out to be and
it implements my 11c-a forward note precisely: the averaged-octave inference and its forced one-octave
fallback are gone, replaced by a model-authored `registerDelta` that the system reads verbatim
(`clampInteger(accepted.intent.registerDelta ?? 0, -1, 1)`). The validation is strict and well-tested
(required for `shift_register`, rejected on other actions, bounded to -1/0/1), and the audible behavior for
`registerDelta: 1` is byte-for-byte preserved. The dead inference helpers were removed. Build/audit/diff
green; smoke **15/15**.

There is one genuinely important **live finding** (not a blocker, but it changes how this feature behaves
in practice with the real model), plus answers to all five of your focus questions and a couple of small
forward notes.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **15/15 passed**; `git diff --check`
  -> clean.
- **Validator strictness covered by smoke (`thought-protocol` unit cases):** missing `registerDelta` on
  `shift_register` -> error; `registerDelta: 2` -> "must be -1, 0, or 1"; `registerDelta: 0` -> valid; stray
  `registerDelta` on `rest` -> "only allowed for shift_register". The full matrix you asked about in focus
  #2 is locked down.
- **Live, real `qwen3:4b-instruct-2507-q4_K_M` (preview MCP):**
  - Health `ready`. Manual probe (full action set): 3/3 `vary_motif`, **no `registerDelta`** present, all
    valid - confirms non-shift actions correctly omit the field and pass.
  - **The key finding:** the narrowed slow loop selected `shift_register` and the real intent was
    **rejected** with exactly `"shift_register requires registerDelta"` - twice in a row, across a loop
    reset. The model picked the action but **omitted `registerDelta`** even with the new primer/prompt
    instruction. In every case `fallbackValid: true` (the mock fallback supplies a +/-1 delta and stays
    valid), so the band is safe - but the real shift intent did not land. I did not catch a *valid* real
    `shift_register` in this session.

## Findings

No required fixes. One important live finding + two small forward notes.

### Finding (live, important - not a blocker) - real qwen3 selects `shift_register` but omits `registerDelta`, so real shift intents are now discarded -> fallback
This is the 10f-b1 pattern again: a field the validator now *requires* is one the model does not reliably
emit. Concretely, the JSON schema lists `registerDelta` as an **optional** property
(`thought-prompt-protocols.ts:157`), so the structured-output grammar permits the model to omit it; the
primer/prompt *ask* for it but cannot force it; and the validator now **requires** it for `shift_register`.
Result against the real model: `shift_register` is chosen, `registerDelta` is missing, the intent is
rejected, and the deterministic mock takes over. That is the **designed, safe** path (verified:
`fallbackValid: true` throughout) and 11c-b is arguably *more correct* than 11c-a (it no longer fabricates
a direction the model never stated) - but it is worth stating plainly: **the explicit-delta change trades
land-rate for fidelity.** 11c-a always produced an audible shift from a real `shift_register` (inferred,
possibly wrong, never a no-op); 11c-b only shifts when the model explicitly says so, and *this model
currently doesn't*, so live shift_register thoughts are being discarded. The smoke proves the path works
with a compliant intent; the real model is not yet compliant.

Recommended follow-up (a small 11c-c, not part of this merge), in order of preference:
1. **Enforce `registerDelta` for `shift_register` in the structured-output schema** via a conditional
   (`allOf: [{ if: { properties: { action: { const: "shift_register" } } }, then: { required:
   ["registerDelta"] } }]`). This is the clean fix - it forces the model to emit the field without
   reintroducing inference. **Caveat to verify:** Ollama/llama.cpp's json-schema -> GBNF conversion has
   limited `if/then`/conditional support, so test that the grammar actually honors it against real qwen3
   before relying on it. (This is the same JSON-schema-can't-express-conditionals limitation we hit with
   pitch/scaleDegree in 10f-a - the validator remains the real guard either way.)
2. If the grammar won't enforce conditionals, **strengthen the primer with a concrete `shift_register`
   example** that includes `registerDelta`, and accept discard-to-fallback as the safe default until
   compliance rises.
3. **Do NOT reintroduce inference or default a missing `registerDelta`.** That would mask invalid model
   output and undo this byte (and it violates the 10f-b2 "don't paper over invalid output" principle). The
   discard-to-fallback behavior is the right safety posture; the goal is to raise model compliance, not to
   guess.

### Forward (your focus #4) - prune `AcceptedSlowThought.request`; it is now dead
`AcceptedSlowThought.request` was added in 11c-a solely for the octave inference
(`accepted.request.excerpts`). With the inference gone, **nothing reads it** - `main.ts` consumes only
`requestId`, `intent`, `id`, `committedStartBeat`, `acceptedAtBeat`, and `retargeted`; the full `request`
object is set on the handoff (`slow-thinking.ts:235`) but never read. Consistent with the stance I took on
the 11b `acceptedQueue` nit: **prune speculative dead state now.** "Likely upcoming decisions" is exactly
the kind of speculative retention worth avoiding - the request is reconstructable and re-addable in the
byte that actually needs it. (Low priority, but it is genuinely unused today.)

### Forward (your focus #1) - top-level field is right now; switch to an action-modifier shape when a second one lands
`registerDelta` as a top-level optional on `PlayerThoughtIntent` is the simplest correct choice for a
single scalar tied to a single action. The thing to watch: it brings **three** parallel validator rules
(required-here / forbidden-there / range) for **one** action-specific field. When a *second* action-specific
modifier appears (a transpose amount, a density target, a motif reference), a flat bag of optionals plus
N-times-three validator rules will get noisy and the "valid only for action X" associations will be
implicit. At that point move to a discriminated **action-modifier object** (per-action sub-shape) so the
type system and a single rule express the association. Not now - just the trigger to watch for.

## Answers to your five review-focus questions

1. **Top-level field or action-specific modifier object?** Top-level for now (one scalar, one action).
   Switch to a discriminated modifier object when a second action-specific modifier lands (forward note).
2. **Validation strict enough?** Yes - required for `shift_register`, rejected on other actions, integer
   bounded to -1/0/1, all four cases unit-tested. `getOptionalNumber` correctly yields `undefined` when the
   field is absent (so the "requires" rule fires) and ignores non-numbers. The one structural gap is that
   the *schema* can't conditionally require the field (finding above) - the validator is the real guard,
   and it is strict.
3. **Should `registerDelta: 0` stay valid?** Keep it valid - it is harmless and is legitimate model
   restraint. Two caveats: (a) it is currently **moot against this model**, which *omits* the field rather
   than emitting 0; and (b) a delta-0 `shift_register` still *compiles a playback window* that does nothing
   audible yet **occupies the no-overwrite slot and the 8-beat rate-limit** for up to 4 beats - so a no-op
   thought can suppress a subsequent meaningful one. If you want 0 to mean "never mind," have
   `compileAcceptedSlowThought` return `undefined` for a shift with delta 0 (don't park a dead window);
   otherwise it is a minor wasted slot. Either way, not blocking. (No new test exercises the *compiled*
   delta-0 no-op path - only the validator accepts it - worth one if you keep parking the window.)
4. **Prune `AcceptedSlowThought.request` now?** Yes - prune it; it is unused after removing the inference
   (forward note above).
5. **Is this protocol-cleanup-only, no new behavior?** Almost entirely yes - no transport changes, no added
   note slots, identical audible result for `registerDelta: 1` (smoke 15/15). The honest exceptions, both
   intended consequences of making the field explicit: (a) `shift_register` can now be **discarded** when
   the model omits `registerDelta` (the live finding - previously the fallback always forced a direction),
   and (b) a real model can now request `registerDelta: 0` (a no-op shift), which 11c-a's forced fallback
   made impossible. Both are correct; just not literally "no behavior change."

## Merge + next slice

- **Merge `codex/byte-11c-b`.** Correct cleanup, strict + well-tested validation, resolves the 11c-a
  implicitness note, and is more faithful to model intent than 11c-a was.
- **Suggested small 11c-c:** raise `shift_register` compliance (schema `if/then` to require `registerDelta`,
  verified against real qwen3's grammar; or a concrete primer example) so real shift intents stop being
  discarded - the feature works but currently rarely fires with the live model. Bundle the
  `AcceptedSlowThought.request` prune and (optionally) the delta-0-no-compile tweak into the same slice.
- **Still open from prior bytes:** a second thinking player (bass) to exercise the
  `activeSlowThoughtPlayback` -> `Map<playerId, window>` generalization; record grid-vs-performed pitch
  structurally for the replay byte (11c-a note); fold the rehearsal gate into `SESSION_MODE_POLICIES`; and
  the larger material-injection slice must move application to the commit/lookahead path. Validator + mock
  fallback stay in front of all.

## Blockers before the next byte

None.

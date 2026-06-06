# Claude Review: Grow Byte 11e (Gate registerDelta Schema by Action Set)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-06
**Reviewed commit:** `a7f6f1f Gate register delta schema by action set` on branch `codex/byte-11e`
**Base:** `main` at `3a34efd`
**Review branch:** `claude/byte-11e-code-review`

## Verdict

**Approved - merge `codex/byte-11e`.** No required fixes. This is exactly the structural fix I recommended
in the 11d review, implemented minimally and correctly: `registerDelta` (both the schema *property* and the
`allOf` conditional) is now emitted only when `shift_register` is in `allowedActions`, so non-shift lanes
(bass) get a `format` with `additionalProperties:false` and **no** `registerDelta` - making the leak I found
live in 11d **structurally impossible** rather than rejected after the fact (the 10f-b2 pattern: eliminate
the failure mode in the schema, don't just validate it away). Only `thought-prompt-protocols.ts` changed in
`src/`; validator, parser, playback, and scheduling are untouched. Build/audit/diff green; smoke **16/16**,
with a new assertion that the bass `format` contains neither `registerDelta` nor `shift_register`.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **16/16**; `git diff --check` -> clean.
- **Verification approach (noted for transparency):** this byte changes *only* the generated JSON-schema
  string for non-shift lanes - there is no runtime, audio, scheduling, or playback behavior to observe. So I
  leaned on the smoke's **format-level assertions, which run against the real app in Playwright**, rather
  than a redundant preview-MCP session (which would only re-eyeball the same schema and adds nothing here,
  especially given the flaky audio clock). The relevant assertions:
  - **Bass omits both (focus #1):** the independent-lanes test now asserts
    `JSON.stringify(format)` for the bass chat request contains neither `"registerDelta"` nor
    `"shift_register"` - verified live in the real browser, passing.
  - **Melody still includes them (focus #2):** the existing "manual Ollama thought probe" schema test (full
    action set, so `shift_register` is allowed) still asserts the `registerDelta` property **and** the
    `allOf` if/then conditional are present - passing.

## Sanity-check focus - confirmations

1. **Bass/non-shift formats contain neither `registerDelta` nor `shift_register`?** Confirmed. `action.enum`
   is `request.allowedActions` (bass: `rest`/`simplify`/`change_density`), the `registerDelta` property is
   spread in only `...(allowsRegisterShift ? {...} : {})`, and `additionalProperties:false` closes the shape.
   Verified by the new smoke assertion on the real bass request `format`.
2. **Melody shift-register formats still include `registerDelta` + the conditional requirement?** Confirmed.
   When `allowsRegisterShift` is true, both the `registerDelta` property (`enum:[-1,0,1]` + description) and
   `allOf:[createRegisterDeltaConditionalSchema()]` (`if action==shift_register then required:[registerDelta]`)
   are emitted - unchanged from 11c-c. Covered by the existing probe schema test.
3. **Validator not weakened (stray `registerDelta` on non-shift still invalid)?** Confirmed - `thought-protocol.ts`
   is untouched. The "registerDelta is only allowed for shift_register" / "shift_register requires
   registerDelta" / "must be -1, 0, or 1" rules and their unit tests are intact. The schema gating and the
   validator are now correctly layered: the schema makes the leak structurally impossible for non-shift
   lanes, **and** the validator remains as defense-in-depth if a stray delta ever appears by any other path.
4. **No playback / slow-thinking scheduling / musical behavior changed?** Confirmed - `src/` diff is
   `thought-prompt-protocols.ts` only (the schema generator). `main.ts`, `slow-thinking.ts`, `transport.ts`,
   `taste.ts`, `ollama.ts` are all unchanged. Nothing in the audible path, the per-player playback map, the
   one-pending gate, or the bass action set moved.
5. **Merge?** Yes - merge.

## Findings

No required fixes. One small forward note that this byte makes newly relevant.

### Forward (small, follows directly from this byte) - gate the registerDelta *prompt sentence* on the same condition
Now that the *schema* is action-gated, the *prompt* is slightly out of step: the heavy registerDelta
instruction ("For shift_register, the JSON object is invalid unless it includes top-level registerDelta ...
Omit registerDelta for every other action.") is still emitted **unconditionally** - it lives as a static
string in both the projected protocol's `instructions` and the session primer (`ollama.ts`). So a bass
request now ships a prompt that talks about a `shift_register`/`registerDelta` contract its own schema no
longer contains. Harmless (bass can't pick `shift_register`, and the validator still guards), but it is dead
prompt weight for non-shift lanes and mildly incongruent for a small model. Gating that sentence on
`allowsRegisterShift` (only include it when `shift_register` is allowed) would (a) make the prompt match the
schema per lane, (b) trim bass's prompt, and (c) finally retire my standing 11c-c note about that sentence
being duplicated verbatim across the primer and the projected protocol (a shared, conditionally-included
constant would handle both). Not blocking; a clean candidate for the "one more tiny pre-Byte-12 cleanup" you
mentioned, or to fold into Byte 12 prep.

## Merge + next slice

- **Merge `codex/byte-11e`.** Minimal, correct, well-scoped; closes the 11d live finding structurally.
- **Optional last tiny cleanup before Byte 12:** the prompt-sentence gating above (pairs the prompt with the
  now-gated schema and de-duplicates the 11c-c sentence). Worth it only if you want the prompt to read
  cleanly per lane; otherwise go straight to Byte 12.
- **Byte 12 (song-sketch / piece-construction stubs)** is the right next conceptual step.
- **Still open from prior bytes:** record grid-vs-performed pitch structurally for the eventual replay byte
  (11c-a); fold the rehearsal gate into `SESSION_MODE_POLICIES`; true material injection must move
  application to the commit/lookahead path. Validator + mock fallback stay in front of all.

## Blockers before the next byte

None.

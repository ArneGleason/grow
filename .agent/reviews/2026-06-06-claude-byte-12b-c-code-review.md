# Claude Review: Grow Byte 12b-c (Model-Authored Proposal Text, Inspect-Only)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-06
**Reviewed commit:** `68f28e2 Add model proposal text probe` on branch `codex/byte-12b-c`
**Base:** `main` at `7b6da72`
**Review branch:** `claude/byte-12b-c-code-review`

## Verdict

**Approved - merge `codex/byte-12b-c`.** **No required fixes.** This is the model-as-copywriter byte done
with the right paranoia: the trust boundary is enforced at **three independent layers** - the model-facing
schema omits every structural field, the validator is strict on players/length/structure (so it is the real
guard even if the structured-output grammar is not fully honored), and the apply function preserves
structure *by construction* (it spreads the deterministic proposal and maps over its responses, overriding
only prose). Invalid / failed / stale model text all fall back to the deterministic mock, and the runner is
manual-probe-only with no background calls. Verified end-to-end against the real qwen3. Build/audit/diff
green; smoke **18/18** with strong valid + invalid coverage. Findings below are all forward notes.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **18/18**; `git diff --check` -> clean.
- **Manual-only confirmed (focus #5):** `runOllamaProposalTextTest` is called only by
  `runManualOllamaProposalTextTest`, which is called only by the "Send proposal" button and the
  `window.ollama.runManualProposalTextTest` debug hook - no tick/loop/render/health-check caller.
- **Protected subsystems untouched (focus #6):** `transport.ts`, `slow-thinking.ts`, `thought-protocol.ts`
  (player-thought validators), and `listening.ts` are not in the diff. The only change to the existing
  thought path is a cosmetic refactor of `SHORT_RESPONSE_RULE` into `COMPACT_JSON_RULE + "..."`, which
  reproduces the identical string. No scheduling/persistence touched (no persistence module exists yet).
- **Live, real `qwen3:4b-instruct-2507-q4_K_M`:**
  - Send proposal -> `status valid`, `provider ollama`, proposalId matched, `fallbackValid true`; applied
    `status` went `mock -> model` with **every structural field preserved** (id, kind, targetSectionId,
    proposedByPlayerId, chordPlan, rootDegrees, response playerIds, **and stances** all identical). (This
    run the model returned near-identical wording at temp 0.45; the smoke's mocked fixture proves genuinely
    *different* text applies and still preserves structure.)
  - **Reset on song change verified live:** after a valid Lantern send (`model`), switching to Glass reset
    the proposal to `mock` and the text test to `idle`; switching back to Lantern stayed `mock` (a full
    reset, not a stale per-song cache).

## Answers to your seven review-focus questions

1. **Model is only a copywriter for inspect-only text?** Yes. The model authors only `summary`,
   `requestedAction`, and per-response `reason`/`requestedChange`. Enforced by the schema (omits structure),
   the validator (no structural fields accepted), and `applySongSketchProposalText` (overrides only prose).
2. **Invalid/failed/stale cannot replace the deterministic mock?** Confirmed. `getSongSketchProposalForSketch`
   applies model text only when `status === "valid" && proposalTextTest.proposalId === baseProposal.id &&
   text`. `invalid`/`failed`/`running`/`idle` and any id mismatch all return the deterministic base. Verified
   live (reset/stale) and by the invalid-text smoke (duplicate + missing player -> stays `mock`).
3. **Schema omits structural fields?** Yes. `createSongSketchProposalTextResponseFormat` exposes only
   `summary`/`requestedAction`/`responses[playerId(enum), reason, requestedChange?]` with
   `additionalProperties:false` at both levels; `kind`/`stance`/`role`/`chordPlan`/`rootDegrees`/
   `targetSectionId`/`proposedByPlayerId`/`status` are absent, and the prompt repeats the prohibition. The
   smoke asserts the format JSON excludes `kind`/`stance`/`chordPlan`/`rootDegrees`.
4. **Applying valid text preserves structure?** Yes - `applySongSketchProposalText` spreads `...proposal`,
   re-copies `chordPlan`/`rootDegrees` from the proposal, and maps over **`proposal.responses`** (not the
   text's), looking up prose by `playerId` and falling back to the deterministic reason if absent. So id,
   kind, target, proposer, provenance, player ids, and stances are structurally guaranteed. Verified live
   (all-same) and by smoke.
5. **Manual-probe-only, no surprise calls?** Yes - see Validation (only the button + debug hook reach the
   runner).
6. **Playback/transport/slow-thinking/player-thought-validators/persistence/scheduling untouched?** Yes -
   see Validation (those files are not in the diff; the one thought-path edit is a no-op string refactor).
7. **Should the result be reset anywhere besides song/config changes?** **The resets are sufficient** - and
   the reason is worth stating: the real correctness mechanism is the **id-match guard**, not the resets.
   Because the proposal id encodes the sketch id (`sketch-<song>-<tonic>-<mode>`) plus target section and
   kind, any change to song *or tonal context* changes the id and the guard alone already suppresses stale
   text. The explicit `applySongId` / `setOllamaConfig` resets are therefore display hygiene (so the
   readout does not show "model text valid" for a stale draft), which is good to have. Two latent items, both
   **not reachable today** (no required action):
   - **Roster change** alters `proposal.responses` *without* changing the proposal id (the id does not encode
     the roster). Today the roster is static at runtime, and even if it changed, `applySongSketchProposalText`
     degrades safely (it maps over the new responses and falls back to deterministic prose for any player
     without matching text). If the roster ever becomes runtime-mutable, either encode it in the proposal id
     or reset on roster change.
   - **Timing-feel change** correctly does *not* reset the text (the proposal is timing-independent) - right
     call, no change needed.

## Findings (no required fixes; forward notes)

### Forward (principle worth banking) - model prose is unconstrained in *content*; keep it data, never instruction
The validator checks prose for presence/length/player-matching but not meaning, so a model could write a
`summary`/`reason` that contradicts the fixed plan (e.g. "let's switch to D dorian" or "drop the bass").
Today that is harmless: the text is inspect-only, nothing routes or interprets it, and the structural fields
are protected. But this is the moment to bank the rule for later bytes: **the model's proposal prose is
data, not a command** - when proposals ever influence behavior (a proposal-to-playback bridge), the bridge
must act on the *structured, deterministic* fields (kind/stance/chord/roots), never parse the model's prose
as instructions. The current design already points the right way (structure is deterministic, prose is
cosmetic); just hold that line.

### Forward (minor, carry-forward) - proposal is rebuilt and text-applied every render frame
`renderSongSketch` builds the base proposal and applies model text on every render; combined with the 12b-b
per-frame deep sketch clone, this is a bit of per-frame work. Cheap today (small objects), but if this
surface grows, memoize the base proposal (and the applied result) on the sketch cache key + the active
proposal-text id, rather than recomputing each rAF.

### Observation (good) - the validator, not the schema, is the real guard
The schema constrains the model, but the implementation correctly does **not** trust it: every structural
risk (unknown/duplicate/missing player, over-length, missing reason) is independently caught by
`validateSongSketchProposalText` and routed to the deterministic fallback. That is exactly the lesson from
the registerDelta grammar-enforcement caveat applied well here.

## Note on your environment observation (eventCount 0 in unrelated playback tests)

I agree it is environmental, not this diff. Nothing in 12b-c touches boot timing or transport callbacks -
`transport.ts` and the render/boot loop are unchanged, and the only hot-path addition is the synchronous,
allocation-light proposal build inside `renderSongSketch` (no async, no timers, no transport coupling); the
proposal-text fetch only runs on a manual button click. The "several unrelated playback tests see
eventCount 0" symptom matches the headless/preview **AudioContext-clock flakiness** I have independently hit
and documented across prior bytes (the audio clock pins at ~0 when the page/audio context is parked - e.g.
display sleep or a wedged context), which is exactly your suspicion. Restarting with a clean Playwright
server clearing it is consistent with that. Worth keeping the documented note in `LOCAL_DEV_NOTES.md`.

## Merge + next slice

- **Merge `codex/byte-12b-c`.** Correct, layered, manual-only, inspect-only, verified live and by smoke.
- **Next:** of the remaining options, **persistence prep** is the natural low-risk follow-up if you want the
  storage shape settled, but it does not move the experience. The **proposal-to-playback bridge** remains the
  big step and should be its own carefully-gated byte (bounded, reversible, acting only on the deterministic
  structured fields, validator + fallback in front, never a wrong note - the slow-thinking-audible-bridge
  treatment), and it is where the "prose is data, not instruction" rule above becomes load-bearing.
- **Still open from prior bytes:** record grid-vs-performed pitch structurally for the eventual replay byte
  (11c-a); fold the rehearsal gate into `SESSION_MODE_POLICIES`; true material injection must move
  application to the commit/lookahead path.

## Blockers before the next byte

None.

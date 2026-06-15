# Claude Review: Track D1b — Develop Children with B2 Prosody Operators (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `825f727` on `origin/codex/byte-d1b-prosody-development` (sha confirmed)
**Base:** `main` (current — verified ancestor)
**Review branch:** `claude/codex-d1b-prosody-development-code-review`

## Verdict

**Approved — merge `codex/byte-d1b-prosody-development`.** D1b swaps child development from the generic
`phrase.nudge` to the **musical B2 operators** (my D1/A4 recommendation), via a new closed `phrase.replace`
mutation. The replacement genome is still server-validated/bounded/in-scale, A4 still owns the elite/branch/
lineage/audit checks, the develop step is deterministic (idempotent), and it's inspect-only. The client-
computes / server-validates-but-doesn't-recompute trust split is **acceptable for this dev-only bridge** —
with a clear line for when it must change (below). Build/db:smoke/diff green; smoke **58/58** fresh DB; audit
unchanged.

## Focus-point confirmations

1. **Uses B2 operators, not `phrase.nudge`.** `runCandidateCycle` imports `reFoot`/`varyContour`/
   `alterCadence`/`shiftAnacrusis` and picks one deterministically via `hashText(elite.id:seed:generation:
   d1b-prosody)`, applies it to the parent phrase, and packages `{type:"phrase.replace", operator, genome}`
   (with a `varyContour('transposeUp')` fallback). ✓
2. **`phrase.replace` is bounded.** Server `normalizeCandidateDevelopmentMutation` validates `operator`
   against a **closed allow-list** (reFoot + bounded seed; varyContour/alterCadence/shiftAnacrusis with
   closed action enums) and runs the supplied `genome` through `normalizePhraseGenome` — so the replacement
   is bounds-clamped and in-scale server-side regardless of the client. ✓
3. **A4 still owns persistence/audit/lineage.** `developCandidate` is unchanged — the elite-parent,
   same-branch, and "did not change the genome" guards are all present; child id/lineage/status and the
   `candidate.created` + `reason:"development"` audit are unchanged. Only `applyCandidateDevelopmentMutation`
   + the mutation normalizer gained the `phrase.replace` branch. ✓
4. **Idempotence holds.** The operator choice + genome are deterministic functions of the elite, so the child
   genome → child content-hash id is stable → `developCandidate` dedups (no duplicate row/audit). The
   `shouldSelect` / `needsFitnessUpdate` guards from D1 are unchanged. Smoke asserts it. ✓
5. **No audio/model/playback consumer.** `grep` shows `runCandidateCycle` referenced only by the
   `window.persistence` wiring + type decl. ✓
6. **Trust split** — judgment below.

## Focus 6 — the trust split: acceptable for D1b, with a clear boundary

For `phrase.replace`, the client computes the B2 transform and the server **validates + persists the
replacement genome but does not recompute it**. My judgment:

- **Safety holds.** The replacement genome is run through `normalizePhraseGenome` server-side (scaleDegree/
  octave/velocity clamps, event cap, in-scale via `noteFromScaleDegree` downstream), and `operator` is a
  closed allow-list. A buggy/hostile client cannot inject an out-of-bounds or out-of-key genome — the
  bounded-by-construction safety floor is unchanged.
- **What's unverified is provenance, not safety.** The server takes it on faith that `genome ==
  operator(parent)` — i.e., the `operator` label and the parent→child *derivation* are client claims it
  doesn't recompute. (In practice the trusted dev client computes them correctly.)
- **Why that's fine for D1b.** The persistence layer is dev-only, the cycle is inspect-only, and candidates
  are judged on **content** (`scoreProsody` on the genome), not on which operator claims to have produced
  them — so a wrong provenance label wouldn't corrupt selection or scoring. The cost is purely that lineage/
  operator metadata is an unverified claim.
- **When it must change.** Before the persistence layer ever leaves dev-only / faces an untrusted client, or
  before anything *trusts* the `operator`/lineage as ground truth (lineage analysis, deterministic replay of
  development from operator+parent). At that point, **recompute server-side** — but **don't duplicate** the
  561-line B2 operator set into `server/persistence.mjs`. Extract the B2 operators into a module importable by
  *both* the client and the server, so the server can recompute the transform from `(operator, parent)`. That
  resolves the duplication concern *and* the trust gap in one move. Recommend it as the follow-up before D2
  makes children consequential, not as a D1b blocker.

## Findings (non-blocking)

- **No-op operator edge.** If a chosen B2 operator *and* the `varyContour('transposeUp')` fallback both
  produce a genome identical to the parent, `developCandidate` throws "did not change the genome," and the
  cycle doesn't catch it → the whole cycle errors. Very unlikely (the operators are real transforms; the
  fallback almost always changes), but the fallback isn't *guaranteed* non-no-op (e.g. a phrase already at the
  degree-clamp ceiling). Consider catching/skipping a no-op development for that elite rather than letting it
  throw, or guaranteeing a changing fallback.
- Carry-forward from D1 (still open, not D1b's job): children are developed but **still unscored** (fitness
  0), so the loop doesn't close generationally yet — score the children before the next selection to make
  lineages compete. And the candidate-id-omits-branchId collision (D1 finding 2).

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None.

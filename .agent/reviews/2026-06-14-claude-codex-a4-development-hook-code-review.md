# Claude Review: Track A4 — Candidate Development Hook (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `d7eadcf` on `origin/codex/byte-a4-development-hook` (sha confirmed)
**Base:** `main` at `d65e17a` (current — verified an ancestor)
**Review branch:** `claude/codex-a4-development-hook-code-review`

## Verdict

**Approved — merge `codex/byte-a4-development-hook`.** A4 is the last engine piece, and it lands the
guardrail I flagged across A2/A3: the parent genome is genuinely deep-cloned and elite rows are never mutated
in place. Development is elite + same-branch + phrase-only, the `phrase.nudge` operator is closed and bounded,
children get correct lineage/identity, repeated development is idempotent with no duplicate row/audit, and the
audit reuses `candidate.created` + `reason:"development"`. Inspect-only; transactional; on current main.
Build/db:smoke/diff green; smoke **43/43** on a fresh DB; audit unchanged.

## Focus-point confirmations

1. **Deep-clone, no in-place parent mutation.** `applyCandidateDevelopmentMutation` does
   `deepCloneJson(genome)` (`JSON.parse(JSON.stringify(...))` — valid for the pure-JSON genome) first, then
   maps events to **new** objects (`{...event, …}`) into a **new** array via `rotateArray`, and returns a
   fresh `normalizePhraseGenome(...)`. The parent's events/array/scalars are never written; `developCandidate`
   only `INSERT`s the child and never `UPDATE`s the parent row. The smoke pins "parent genome remains
   unchanged." ✓
2. **Elite + same-branch + phrase only.** `developCandidate` throws on missing parent, cross-branch parent,
   non-`elite` status, and non-`phrase` kind. ✓
3. **`phrase.nudge` is closed + bounded.** `normalizeCandidateDevelopmentMutation` rejects any type other than
   `phrase.nudge`, clamps `scaleDegreeDelta` [-7,7], `octaveDelta` [-2,2], `velocityMultiplier` [0.25,2],
   `rotateSteps` [-128,128], and rejects an all-no-op mutation. The applied result re-clamps child
   scaleDegree [-28,28] / octave [0,8] / velocity [0,1], then `normalizePhraseGenome` re-bounds the whole
   genome. In-scale is preserved (degrees wrap via `noteFromScaleDegree` downstream). ✓
4. **Child identity + lineage.** Built via `normalizeCandidateInput`: new content-hash id, `parentId`,
   `generation + 1`, `status:"alive"`, `scores:{}`, `fitness:0`, deterministic seed (caller-clamped or
   `deriveChildSeed(parent, mutation)`). ✓
5. **Idempotent.** The child id is a content hash; identical parent+mutation → identical childGenome → same
   id → `existingChild` is found and returned with **no** INSERT and **no** audit event. (Holds even if the
   child was later promoted, since the recomputed id uses the creation-time `alive`/0/{} values.) ✓
6. **Audit shape.** `candidate.created` with `reason:"development"`, `parentId`, normalized `mutation` — reuses
   the existing family, no new event type. ✓
7. **No consumer.** `grep` shows `developCandidate` referenced only by the `window.persistence` wiring + type
   decl + the `persistence.ts` client — nothing in transport/playback/scoring. ✓
8. **Helper location** — addressed below.

## Findings (non-blocking)

### Focus 8 — keep the mutation helper local for now, extract before the second operator
`normalizeCandidateDevelopmentMutation` / `applyCandidateDevelopmentMutation` in `server/persistence.mjs` are
fine for this one closed operator (~60 lines). Extract them to a dedicated module (e.g.
`candidate-mutation.mjs`) the moment a **second** operator or genome kind (groove/harmony/form) lands, so
`persistence.mjs` doesn't become the mutation grab-bag.

### Architectural seam to decide before the loop — two parallel phrase-mutation vocabularies
A4's server-side `phrase.nudge` (`scaleDegreeDelta`/`octaveDelta`/`velocityMultiplier`/`rotateSteps`) is a
*separate* mutation language from the client-side **B2 prosody operators** (`varyContour`/`reFoot`/
`shiftAnacrusis`/`alterCadence` in `src/prosody-development.ts`). Both mutate phrase genomes; neither shares
code. That's fine for A4 in isolation, but the loop (Track D) must decide which vocabulary *develops* phrase
candidates — the simple server nudge, or the richer musically-grounded B2 operators (which is where the
prosodic "development" intent actually lives). Worth resolving before the loop calls A4, or you'll have two
divergent mutation languages on the same genome. (Leaning: have development call the B2 operators so children
are *musical* developments, with `phrase.nudge` as the minimal/fallback.)

### Trivial
- `deriveChildSeed` = `parseInt(stableHash(...), 36)` can exceed 2^53 before the `normalizeCandidateInput`
  seed clamp to 32-bit — deterministic and clamped, so harmless; `>>> 0` would be tidier.

## On "expected next" (your question: tiny end-to-end loop vs diversity lever first)

I'd build the **minimal end-to-end loop first** (produce → score → store → select → develop), then add the
diversity lever. You can't tune diversity you can't yet observe — running the loop is what will *show* the
strict-elitism convergence I flagged in the A3 review, and it's the first audible self-curated payoff. Bake a
TODO/seam for diversity into the loop (so it's easy to add a novelty reservoir / fitness+novelty blend), but
don't tune it speculatively before the pipeline runs once. And resolve the mutation-vocabulary seam above as
part of wiring the develop step.

## Handoff back to Codex

> Track A4 (`d7eadcf`, on current main) reviewed: **approved — merge it.** The development hook lands the
> deep-clone guarantee I'd flagged: `deepCloneJson` + map-to-new-event-objects means the parent genome is
> never mutated and only the child is INSERTed. Elite + same-branch + phrase-only; `phrase.nudge` is closed
> (rejects other types) and bounded (knobs clamped, results clamped, final `normalizePhraseGenome`); child has
> new content-hash id + `parentId` + `generation+1` + `alive` + empty scores + `fitness:0` + deterministic
> seed; idempotent (same parent+mutation → same id → returns existing child, no dup INSERT/audit); audit reuses
> `candidate.created` + `reason:"development"`. Inspect-only; transactional. build/db:smoke/diff green; smoke
> 43/43 fresh DB. **Non-blocking:** (8) keep the mutation helper in persistence.mjs for now but extract to a
> `candidate-mutation` module before the second operator/kind; and resolve the **two-vocabulary seam** — A4's
> server `phrase.nudge` vs the client B2 prosody operators (`varyContour`/etc.) — before the loop's develop
> step (lean: develop via the B2 operators so children are *musical*, nudge as fallback); `deriveChildSeed`'s
> `parseInt(...,36)` could use `>>> 0`. **With A1–A4 the engine is complete.** On next: build the **minimal
> end-to-end loop first** (it'll reveal the A3 strict-elitism convergence), bake in a diversity seam, then add
> the lever once you can observe it.

## Blockers before the next byte

None.

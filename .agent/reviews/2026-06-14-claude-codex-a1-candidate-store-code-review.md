# Claude Review: Track A1 — Candidate Store Persistence Shell (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `524bca3` on `origin/codex/byte-a1-candidate-store`
**Base:** `main` at `428c187`
**Review branch:** `claude/codex-a1-candidate-store-code-review`

## Verdict

**Approved — merge `codex/byte-a1-candidate-store`.** This is the backbone of the evolutionary loop, built
with the right discipline: a single new mutable `candidates` table alongside the existing append-only
event log; the server re-validates and bounds every input independently (the client validator is *not* the
authority); phrase genomes are structured `PlayerPatternSource` (never raw audio/freeform); cap is
deterministic by fitness and marks overflow `purged` with an audit; and nothing in the playback/model path
consumes candidates yet. Build green; db:smoke green at **schema v3**; smoke **40/40**; diff clean; audit
unchanged (known 2-high). All seven focus points confirmed.

## Focus-point confirmations

1. **`candidates` is the only new mutable table, justified.** `events`/`sessions` stay append-only; the
   mutable population table is the one allowed addition (status/scores/fitness mutate, rows are capped) —
   exactly what the plan sanctioned for the "retain best, purge rest" use case. Indexed
   `(branch_id, kind, status, fitness DESC)` to serve the cap/selection query.
2. **Every meaningful mutation appends an audit event.** `created` (writeCandidate), `scored`
   (scoreCandidate), `retained`/`purged` (setCandidateStatus), and cap-`purged` (capCandidates, with
   `reason:"cap"` + `limit`). All status changes + the cap run inside `withImmediateTransaction`, so the
   row update and the audit append are atomic. The only non-auditing path is the dedup no-op on re-write of
   an existing id — correct (nothing changed).
3. **Phrase genomes are bounded `PlayerPatternSource`, both client and server.** Client `readPhraseGenome`
   and server `normalizePhraseGenome` both structure the genome: subdivisionBeats clamped, events ≤128,
   each note's scaleDegree/octave/durationBeats/velocity clamped, playerId/duration string-capped. Pitch
   still resolves through `noteFromScaleDegree` downstream, so a phrase genome can never be raw notes,
   audio, or freeform instructions. Non-phrase kinds use bounded JSON (depth ≤8, arrays ≤256, keys ≤64,
   strings ≤1000, total ≤20000 chars) — size-safe (see finding 1 for the schema follow-up).
4. **Scalars bounded or rejected, server-authoritative.** `normalizeCandidateInput` independently clamps
   fitness [0,1], generation [0,10000], seed [0,2³²-1], createdAtBeat [0,1e6], validates kind/status
   against enums, regex-guards ids, caps scores (≤32 keys, [0,1] each), and throws on a >20000-char genome.
   A direct POST to the dev API cannot bypass the client validator.
5. **Cap is deterministic by fitness and purges overflow.** `capCandidates` orders alive candidates
   `fitness DESC, generation ASC, created_at ASC, id ASC` (fully deterministic tiebreak), keeps the top
   `limit`, sets the rest to `purged`, and audits each — all transactional.
6. **A1 is inspect-only.** `grep` confirms no candidate consumer in `transport.ts` / `world-state.ts` /
   `taste.ts` (the `taste.ts` "candidate" hits are an unrelated local variable). `main.ts` only adds
   `window.persistence.{writeCandidate,listCandidates,scoreCandidate,...}` debug methods. No row drives
   playback, transport, model behavior, or material generation.
7. **Schema v3 migration is additive + idempotent.** `CREATE TABLE IF NOT EXISTS candidates` +
   `migrateGrowDatabase` (addColumnIfMissing for sessions/events/candidates, with event backfill from
   `bar`/`scheduled_bar`); `schema_meta` upserts version 3. Query shapes (`listCandidates` fitness/updated
   orderings, `parseCandidateRow`, `dumpGrowDatabase` including candidates) are consistent and ready for
   A2/A3 to build on. The candidate id (`stableHash` of content) is assigned at creation and never
   recomputed by score/retain/purge (they update by id) — so ids stay stable across mutation.

## Findings (all non-blocking; forward-looking for A2/A3)

1. **Non-phrase genomes are size-bounded but not schema-validated.** song/groove/harmony/form go through
   `normalizeBoundedJson` (caps depth/size) but have no per-kind structural validator. Fine now (nothing
   consumes them), but each kind needs its own typed validator (like `normalizePhraseGenome`) when its
   generator/consumer lands — otherwise a malformed groove/song genome could reach a consumer intact.
   Codex already flagged this as "for now." Track it as a prerequisite for Track C and the song genome.
2. **Cap is bounded by `MAX_CANDIDATE_LIMIT` (500).** `capCandidates` reads up to 500 alive per
   (branch, kind), then purges beyond `limit`. If an alive population exceeds 500, the overflow past 500
   escapes the cap pass. Keep alive-per-kind under 500 in A3's loop, or paginate the cap, before the
   population can grow large.
3. **`write` is create-only, not upsert** (returns the existing row unchanged on id collision). Intended
   (write=create; score/retain/purge=mutate), but worth documenting so A2/A3 don't expect `write` to update
   a genome. Relatedly, the id is a creation-time content hash — never recompute it for an existing
   candidate; a developed child is a *new* candidate with its own id + `parentId`.

## Handoff back to Codex

> Track A1 (`524bca3`) reviewed: **approved — merge it.** The candidate-store backbone is exactly right:
> one new mutable `candidates` table beside the append-only log; the **server** independently re-validates
> + bounds every field (client validator isn't trusted); phrase genomes are structured `PlayerPatternSource`
> on both sides (never raw audio/freeform); cap is deterministic (`fitness DESC, generation ASC, created_at
> ASC, id ASC`) and purges overflow with a `reason:"cap"` audit; every mutation (created/scored/retained/
> purged + cap) appends an audit event in a transaction; ids are creation-time content hashes that score/
> retain/purge update by id (stable). Inspect-only confirmed (no transport/taste/playback consumer; only
> `window.persistence` debug). build/db:smoke(v3)/diff green; smoke 40/40; audit unchanged. **Non-blocking,
> for A2/A3:** (1) non-phrase genomes are size-bounded but not schema-validated — add a per-kind typed
> validator when groove/song/harmony/form generators land; (2) cap only sees up to MAX_CANDIDATE_LIMIT=500
> alive per kind — keep populations under that or paginate; (3) `write` is create-only (not upsert), and the
> id is a creation-time hash — mutate via score/retain/purge, and treat a developed child as a new id +
> parentId. Great foundation for **A2 (fitness aggregation)** and **A3 (selection/purge loop)**.

## Blockers before the next byte

None.

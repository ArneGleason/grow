# Kickoff: branch-scoped candidate id (unblock matched diversity A/B)

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual (copy-paste)
**Date:** 2026-06-14

---

## Why now

D4's diversity engine is correct and safe, but we **can't yet measure whether it beats strict elitism**,
because the only fair test — diversity-on vs -off at the *same seed* in one store — collides: candidate ids
omit `branchId`, so same-seed runs on different branches dedup to each other's rows on the global id PK (I hit
this live in the D4 review — had to A/B at different, unmatched seeds). This byte makes candidate identity
branch-scoped so matched experiments (and parallel populations generally) work. Small, surgical.

**Prerequisite (Arne):** merge `codex/byte-d4-diversity-reservoir` to `main`. Then:
```sh
git fetch origin && git checkout main && git pull
git checkout -b codex/byte-branch-scoped-candidate-id
```

## Goal

Same-content candidates on **different branches** must be **distinct rows**; same-content candidates on the
**same branch** must keep their **stable, deterministic id** (so the D1–D4 idempotent dedup still holds).

## Recommended approach (you choose the mechanism)

**Branch-scope the candidate id** — include `branchId` in the id derivation so the id is globally unique per
branch, keeping the single-column `id` PK (no schema migration, all `WHERE id = ?` lookups unchanged). E.g.
the content hash incorporates `branchId`, and B4's explicit ids (`phrase_<seed>_base`) become branch-qualified
at write time. Touch points: client `createCandidateId` / `validateCandidate`, server
`normalizeCandidateInput`, B4's explicit id construction, and ensure `parentId` references + audition/develop/
select by-id all use the branch-scoped id within the correct branch.

*(Alternative, if you prefer clean content-only ids: a composite `(branch_id, id)` primary key + `readCandidate
(branch, id)` lookups. Correct but more invasive — schema rebuild + every candidate lookup gains a branch arg.
Propose whichever you think is cleaner for the existing code; the outcome below is what matters, not the
mechanism.)*

## Invariants (must hold)
1. **Cross-branch isolation:** same content on different branches → distinct rows; each branch's queries/
   selection see only its own candidates.
2. **Within-branch idempotence preserved:** re-running the same `(seed, branch)` is still idempotent — no
   duplicate rows or audit events (D1–D4 behavior unchanged).
3. **Deterministic:** id derivation is a deterministic function of `(branchId, content)`.
4. **Lineage consistent:** a child's `parentId` references its branch-scoped parent; develop/audition/select
   by id resolve within the right branch.
5. **Existing dev data is regenerable** — no need to migrate old candidate rows; if you go composite-PK, the
   migration may rebuild/clear the `candidates` table (leave the append-only `events` log intact). Bump the
   schema version if the table changes.

## Acceptance tests (deterministic — fresh DB)
1. **Cross-branch isolation (the fix):** in ONE store, `runEvolution({seed: S, branchId: "a"})` and
   `runEvolution({seed: S, branchId: "b"})` produce **independent** populations — branch "b" does not dedup
   into branch "a"'s rows, and each branch's elite/reserved/purged reflect only its own run.
2. **Matched A/B now possible:** diversity-**off** `{seed: S, branchId: "off"}` and diversity-**on**
   `{seed: S, branchId: "on"}` in one store both run cleanly and independently (this is what unblocks
   measuring D4).
3. **Within-branch idempotence:** re-running `{seed: S, branchId: "a"}` adds no duplicate candidate rows or
   audit events.
4. **Determinism:** same `(seed, branchId)` + fresh store → identical ids + results.
5. **Existing D1–D4 smoke stays green** (single-branch behavior unchanged).

## Optional fold-in (only if cheap) — surface per-gen elite diversity
D4's `runEvolution` per-generation summary exposes `reservedCount` but `s.diversity` is `null` per generation
(elite mean-pairwise-distance is only at cycle level). If it's a small add, surface **elite
mean-pairwise-distance per generation** in the summary — it's the number that shows diversity holding across a
run, and we'll want it for the A/B. If it's not trivial, leave it for a follow-up; don't bloat this byte.

## Finish
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
# smoke's candidate tests need a fresh DB — rm -rf data between repeated smoke runs
git add -A && git commit -m "Branch-scope candidate id (cross-branch isolation)"
git show --stat HEAD
git push -u origin codex/byte-branch-scoped-candidate-id
git rev-parse origin/codex/byte-branch-scoped-candidate-id   # include this sha in the handoff
```
Handoff with **branch + commit sha**, the mechanism you chose (branch-scoped id vs composite PK), and
validation results.

**After this:** the matched, long-run diversity A/B (on vs off, same seed) to actually measure whether D4's
reservoir earns its keep — and the shared client/server B2 operator module remains the other open
carry-forward.

— Claude

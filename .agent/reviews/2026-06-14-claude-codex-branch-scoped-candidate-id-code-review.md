# Claude Review: Branch-scoped Candidate Id (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `8be9b68` on `origin/codex/byte-branch-scoped-candidate-id` (sha confirmed)
**Base:** `main` (current — verified ancestor)
**Review branch:** `claude/codex-branch-scoped-candidate-id-code-review`

## Verdict

**Approved — merge `codex/byte-branch-scoped-candidate-id`.** The branch-scoped id is correct, idempotent,
deterministic, and server-authoritative, and it does exactly what it set out to do: **it unblocked the matched
diversity A/B**, which I then ran live. All six focus points verified. Build/db:smoke/diff green; **smoke
66/66 on a fresh DB** (one transient failure in my first run was my own concurrent preview server sharing
`data/`+port 5173 — confirmed gone on a clean re-run; Codex's 66/66 was right). 

## Focus-point confirmations

1. **Cross-branch isolation — verified live.** Same seed (4242) on branches `iso-a`/`iso-b` in one store →
   **zero overlapping candidate ids** (distinct prefixes `bsrwdew:` vs `btlv6ht:`). The collision is gone.
2. **Same-branch idempotence preserved.** `scopeCandidateIdForBranch` is **idempotent** —
   `if (candidateId.startsWith(prefix)) return candidateId` — so re-scoping is a no-op; same `(seed, branch)`
   → same scoped id → dedup, no duplicate rows/audits.
3. **Explicit + generated ids both scoped.** Server `normalizeCandidateInput(input, branchId)` scopes the id
   whether provided (B4's `phrase_<seed>_base`) or content-hash-generated — `scopeCandidateIdForBranch(id ??
   generated, branchId)`. Scoped at the write boundary, not at production. ✓
4. **parentId lineage scoped + consistent.** parentId is scoped with the same function; because scoping is
   idempotent, a child's `parentId = scope(parent.id, branch)` resolves to the parent's already-scoped id —
   lineage matches. ✓
5. **Cross-branch ops rejected.** score (`existingCandidate.branchId !== branchId → throw`), develop
   (`parent.branchId !== branchId → throw`); branch-scoped ids mean a foreign id isn't found in a branch's
   queries anyway. ✓
6. **Matched diversity A/B unblocked — and run** (below). ✓

The mechanism (branch-prefix the id, keep the single-column PK) was the right low-risk call — no migration, all
`WHERE id = ?` lookups unchanged, prefix is `b<hash(branchId)>:` (deterministic), length-guarded to the 120-char
id bound.

## The payoff this unblocked — matched diversity A/B (live)

Same seed, diversity-off vs -on, in one store, 10 generations:
- **seed 4242:** strict elitism plateaus at **0.8199**; diversity-on reaches **0.8654** (+0.0455). A real,
  same-seed win — the first evidence the reservoir earns its keep.
- **seeds 11 / 777 / 30303 / 91234:** diversity-on peak **== off peak** (delta 0) on all four.

**Honest read across 5 matched seeds:** diversity-on is **≥ strict elitism on 5/5** (it never does worse —
the elitism invariant holds, as designed) and **strictly better on 1/5**. So the lever **never costs** and
**sometimes helps** on these short (10-gen) runs. That's the expected character of quality-diversity: it can't
lose the best, and it occasionally escapes a local peak the greedy path gets stuck on. To know whether the
advantage is *systematic* (not sporadic), the next experiments want **longer runs**, **more seeds**, and
likely **more exploration pressure** (bigger reservoir / lower minDistance / more reserved breeding) — all
bounded knobs. Encouraging signal, not yet a decisive verdict.

## Findings (non-blocking)

- **`scopeCandidateIdForBranch` is duplicated** (client TS + server `.mjs`, line ~951) — same client/server
  drift risk as the other re-implemented validators (`normalizePhraseGenome`, etc.). The standing shared-module
  carry-forward (extract the bounded helpers into code both import / the server can recompute) would dedupe all
  of these at once. Worth doing before the surface grows further.
- **Per-gen elite diversity** — Codex pinned `eliteMeanDistance` in the matched A/B smoke (good); if it's also
  surfaced in the `runEvolution` summary it makes long-run A/B observation easier (the gap I noted in D4).

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. The evolutionary machine is now **measurable**. Next: the longer/more-seeds diversity A/B (with more
exploration pressure) to see if the reservoir's advantage is systematic; and the shared client/server helper
module remains the standing carry-forward.

# Claude Review: Byte UI-2 — Control Bar + Written↔Evolving Dial (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-14
**Reviewed commit:** `287473a` on `origin/codex/byte-ui2-control-dial` (sha confirmed)
**Base:** `main` (current — verified ancestor)
**Review branch:** `claude/codex-ui2-control-dial-code-review`

## Verdict

**Approved — merge `codex/byte-ui2-control-dial`.** The "Line" dial is a genuine master control — one slider
from written → speaking → evolving — and it is **orchestration only**: it drives the existing approved paths
(`setProsodyEnabled`, `startEvolvingElitePerformance`/`stopEvolvingElitePerformance`) and adds no
transport/candidate/scoring/audio internals. Default = written = today's behavior, so it can't regress and is
safe by construction. I verified the full written→speaking→evolving→written cycle live by ear. Build/db:smoke/
diff green; **smoke 70/70 fresh DB**; audit unchanged.

## Focus-point confirmations

1. **Orchestration only.** `git diff --name-only` shows only `main.ts`, `style.css`, smoke (+ `.agent`) — no
   transport/candidate-store/cycle/fitness/scoring/prosody-internals/persistence/server/taste/song-form/
   evolving-performance file touched. `applyWrittenEvolvingDialValue` calls only `setProsodyEnabled` /
   `startEvolvingElitePerformance` / `stopEvolvingElitePerformance`. ✓
2. **Default = written = behavior-preserving.** Dial default 0 → regime "written" → prosody off + evolving
   idle. Live: heard melody = 9 notes all `dur 0.5` (the written eighths), in-scale. Smoke 70/70 unchanged. ✓
3. **Transitions clean + churn-guarded** (verified live, in order):
   - **written (0):** prosody off, evolving idle, melody = written eighths.
   - **speaking (0.5):** prosody on, evolving idle, melody phrased (`dur 0.25/0.5/2`), in-scale.
   - **evolving (0.8):** D5 running — reached **generation 34**, performed fitness climbed to **0.863** via 4
     swaps, melody in-scale.
   - **back to written (0):** evolving `status: idle` (stopped), prosody off, regime written; after the
     rolling window flushed, melody = pure written eighths (`dur 0.5`) again — clean teardown.
   The handler only `startEvolvingElitePerformance` when `previousRegime !== "evolving"` (so dragging *within*
   the evolving zone doesn't restart evolution every input tick), `stopEvolvingElitePerformance` on leaving,
   and `setProsodyEnabled` is idempotent — no churn while dragging. ✓
4. **Regime mapping** `<0.34 written / 0.34–0.67 speaking / ≥0.68 evolving`; deterministic per-song evolving
   branch (`dial-<songId>`) + derived seed. ✓
5. **Control bar calm + visible** with the inspect drawer closed (smoke + UI-1 verified). ✓

Throughout the whole cycle, every heard melody stayed **in-scale** — the dial inherits the safety of the
layers it composes (in-scale materialization, D5's monotonic strictly-better swaps, the `refreshLookahead`
swap path). No new scheduling/audio path slipped in.

## Findings (non-blocking)

- **`getAudition()` `.candidate` field reads falsy even while actively auditioning** (my probe saw
  `auditioning: false` during the evolving regime despite 4 swaps + a non-written melody playing). The dial's
  *behavior* is correct (evolving ran, fitness climbed, melody played, teardown clean) — this is a
  pre-existing harness state-shape quirk (noted since D2), not a UI-2 issue. Worth tidying the `getAudition`
  return shape for anyone reading it programmatically.
- Evolving regime's upper slider range doesn't scale intensity yet — Codex flagged it; fine to defer.
- Carry-forward (unchanged): shared client/server helper module (duplicated scope/validate functions).

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. The master dial works end to end, audibly and safely. Cleared for **UI-3** (prompt front door).

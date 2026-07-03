# Claude Review: Byte E4 — composition variety (Codex)

**From:** Claude Code (architect/listening lead) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-07-03
**Reviewed commit:** `50edd3c` on `origin/codex/byte-e4-composition-variety` (sha confirmed)
**Base:** `2b4f28a` (E3b tip; main is an ancestor)
**Review branch:** `claude/codex-e4-composition-variety-code-review`
**Doctrine note:** first review under the byte-scoped testing doctrine — Tier 0/1 slice + the musical claim
verified live; Codex's three full 80/80 runs were extra pre-doctrine validation, not a new expectation.

## Verdict

**Request changes — one surgical fix, then approve.** The generator work is right: unpinned goals genuinely
redraw across wide bands, melody plans genuinely replace the single archetype, E3b styles are reconciled to
one source of truth, and the boundary held. But live listening review found that **selecting a saved song
does not re-apply its stored goal** — the material/plan switch, the tonal context/tempo/form do not. The
variety E4 creates is *stored but not replayed*, which audibly fails E4's own acceptance #3 and blocks the
hum test across the library. Small fix; everything else stands.

## What's confirmed good (code + live)

1. **Redraw works and spreads.** Stored per-song goals from five neutral-ish prompts: G♭ mixolydian 75
   wide-return · E aeolian 120 classic-arc · G♭ mixolydian 125 early-hook · A♭ mixolydian 100 wide-return ·
   B♭ aeolian 120 early-hook; a sixth prompt drew **G♭ ionian 105** and applied on create. Tonics, tempos,
   forms, modes all moving. Unit spread (96 seeds): ≥60 BPM span, all 6 modes, ≥3 forms. ✓
2. **Plans replace the archetype.** Live, five songs drew: ABA/2-even/zigzag+climb/open-on-2/reg-5/sparse ·
   ABAB′/4-short/busy/open-on-5 · call-echo/4-short/final-3/reg-3 · through/4-short/sparse/reg-3 ·
   ABAB′/4-short/busy/final-1. Melody note counts 8→32, heads all different. `melody-prosody` is genuinely
   plan-driven (per-phrase beats/contour/cadence, motif roles, register). 512-seed unit: every enum reachable,
   ≥12 signatures. ✓
3. **One source of truth for melody shape.** E3b styles are weights into `chooseMelodyPlan` (verified in
   `melody-plan.ts`); the separate post-plan degree-offset path is gone. ✓
4. **Pins retained.** Keyword detection overwrites the seeded draft; UI overrides pin (unit-covered). ✓
5. **Boundary held.** E4 delta touches goal/plan/prosody/starter/main-wiring/tests only — no
   transport/audio/scheduler/persistence/scorer/interplay/vote path (grep-verified on the delta). ✓
6. **Determinism.** Reselect replays identical plan/goal *state* (live `reselectDeterministic: true`);
   same-prompt new song redraws (fresh materialSeed). ✓
7. **Tier 0/1 green in seconds:** build 0 · unit song-goal 3/3, melody-plan 3/3, melody-prosody 5/5,
   song-starter-material 3/3 · focused smoke slice 8/8 (15.7s) · diff clean.

## The blocker (live-reproduced, precise)

**Library selection does not apply the saved proposition.** Repro: create "slow paper lantern…" (stored goal
**G♭ mixolydian 75**), then create another song (applies **G♭ ionian 105**), then **select** the lantern song:
the plan/material switch to the lantern's, but `getAppliedGoal()` and the key/tempo readouts remain
**G♭ ionian 105** — `mismatch: true`. Every saved song plays in whatever context the last *create* left
behind: the 75-BPM lantern song audibly runs at 105 BPM in the wrong mode. Consequences:
- E4 acceptance #3 ("re-open a song → same song every time") fails *audibly* even though state-level
  determinism passes — the smoke asserted stored/derived state, not the applied context, which is how it
  slipped through.
- Arne cannot run the hum test across the library: switching songs doesn't switch tempo/key, so the
  between-song variety E4 built is muted in the toy's core browse-and-listen loop.

**Required fix (small):** on library select, apply the selected entry's stored starter goal through the same
apply path Create uses (tonal context via the goal's tonic/mode, transport BPM, form) — with the usual
guards (no-op for songs without a starter goal: keep current/default behavior). Add a **relational** smoke
assertion at the readout level: after selecting an entry, `data-mode-classical` and the tempo readout equal
*that entry's stored goal* (asserts the byte's own contract — no golden literal).

## Observations (non-blocking)

- My 6 live draws leaned mixolydian (3/6) and `4-short` (4/6). Unit reachability + the fixture smoke's ≥4
  modes cover the floor, but consider flattening weights slightly when cues are weak — worth an eye at the
  milestone listening session, not a change request.
- `npm audit` unchanged (known Vite/esbuild advisories; correctly left out of a musical byte).
- The final ear verdict — do these now *feel* like different propositions — is Arne's at the **E4 milestone
  review** (full sweep + hum-test listening session), once the fix lands.

## Handoff back to Codex — provided as a copy-paste block in chat.

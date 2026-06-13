# Claude Review: Grow Byte 16a-c (Inspect-Only Form Scoring)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-12
**Reviewed commit:** `24f24e8 Add inspect-only form scoring` on branch `codex/byte-16a-c`
**Base:** `main` at `302d93a`
**Review branch:** `claude/byte-16a-c-code-review`

## Verdict

**Approved - merge `codex/byte-16a-c`.** This is a well-built, inspect-only judge of whether the whole
Verse/Chorus/Bridge arc *goes somewhere*: it materializes a full form pass through the real arrangement path
(harmonic recolor + chorus development + section dynamics + the consensus-selected chorus), then scores
harmonic motion / energy arc / melodic coherence / cadence. The subscores are musically meaningful, they
generalize across all three songs with honest discrimination, and the score cannot touch playback. Build/
db:smoke/diff green; smoke **29/29**. One maintainability finding (duplicated section-dynamics policy) and a
couple of observations - none blocking.

## Focus-point confirmations

1. **Grounded in materialized notes, not static metadata?** Yes. `collectArrangedFormNotes` runs the actual
   `arrangeSongFormPatternEvent` path per section/pattern/step (so it gets the harmonic-recolored pulse/bass
   and the developed chorus), and `applySectionEnergyEstimate` applies the section dynamics, then scores over
   the resulting notes. `getCurrentFormScore` passes `getCurrentChorusDevelopment()`, so it reflects the
   **consensus-selected** chorus. Live, the per-section data is concrete and real (e.g. lantern verse 36
   melody notes / energy 0.67 vs bridge 16 / 0.177 - sparsity and dynamics are visible in the score).
2. **Four subscores musically useful?** Yes. Harmonic motion (distinct roots + adjacent section change +
   bridge contrast), energy arc (chorus lifts above verse, bridge dips, final chorus returns), melodic
   coherence (verse/chorus motif overlap scored as an **inverted-U band** - penalizing both too-unrelated and
   too-exact, i.e. the "developed but recognizable" sweet spot), and cadence (section-entry/exit melody on
   the active chord tone, low support states the root). These map cleanly onto real form qualities and would
   give a later variant-chooser a sensible signal.
3. **Too Lantern-tailored, or generalizes?** Generalizes - the metrics are relative/ratio-based, and live all
   three songs scored distinctly and honestly: lantern 0.926, switchback 0.923 (harmony **1.0** - it moves
   through the most roots), glass 0.881 (verse roots `[0]`, sparser - lowest total, correctly judged as the
   most harmonically static arc). Not tied to Lantern's absolute values.
4. **Is the weakened-chorus smoke a real contrast?** Adequate - it builds a degraded chorus and asserts
   `score.cadence > weakChorus.cadence`, proving the cadence metric discriminates when arrivals stop landing
   on chord tones. Slightly synthetic (a hand-built bad chorus), but that is a valid way to prove the metric
   is not constant/rubber-stamping. (Could be strengthened by also asserting the *total* drops, not only
   cadence - minor.)
5. **Inspect-only, cannot affect scheduling/playback?** Confirmed. `form-scoring.ts` is pure
   (read-only materialization). `getCurrentFormScore` is called only from `renderWorld` (DOM) and
   `window.formScore.getScore()`; nothing in `noteDecision`/transport/lookahead consumes it.

## Findings

### Forward (the one real maintainability issue) - duplicated section-dynamics policy
`applySectionEnergyEstimate` (form-scoring) re-implements the per-section velocity multipliers + bridge
gating that `applySongSectionDecision` (main.ts) applies at fire-time (chorus 1.18/1.14/1.08, bridge
0.72/0.78/0.82 + downbeat/alternate-bar gating, verse melody x0.94). The two copies match today, but they
**will drift** the moment the section policy changes in one place. Extract the section-dynamics policy into a
single shared function consumed by both the transport `noteDecision` path and the form scorer, so the score
provably reflects the policy that actually plays. Worth doing before any variant-chooser makes this policy
load-bearing in two places.

### Observation (not a flaw) - energy arc currently reflects the song-invariant policy
`energyArc.score` is `1.0` for all three songs, because the section dynamics that create the arc
(chorus-louder, bridge-sparser) are the *same policy* regardless of song. So energy arc currently confirms
"the arrangement policy produces a verse->chorus->bridge->return shape" rather than discriminating between
songs (harmony/cadence/motif do the song-level discrimination). That is fine for now; it will become
song/variant-sensitive once section dynamics vary per song or per chosen variant.

### Minor
- The weakened-chorus smoke asserts only `cadence` drops; also asserting `total` drops would prove the
  form-level aggregate responds, not just the one subscore.
- Carry-forward (unchanged): fallback `status` check + dev-flag gating (16a); Vite 8 / esbuild advisory; dead
  `MusicalEventRecordBuffer`; consensus-affinity-from-disposition.

## Merge + next slice

- **Merge `codex/byte-16a-c`.** Inspect-only, grounded, generalizing, and playback-safe.
- **On your suggested next step (a tiny audible variant chooser using this score):** good direction, with the
  same discipline that has carried the 15/16 arc - the chooser should select among **app-owned, deterministic,
  in-scale** variants (e.g. which chorus development / section-dynamics shape yields the best *arc*), with the
  deterministic form score as the ground-truth ruler, and ideally *measure before it drives* (log form scores
  across variants first, like the `melody_critic_selection` harness). **Land the shared-section-policy
  extraction first or alongside it** - a chooser that optimizes the form score makes the duplicated policy a
  real liability. Keep it inspect-then-audible gated, never a wrong note.
- **Still open:** verse/bridge chord-aware melody scoring; the human/remember-good loop on the proposal/
  consensus/feedback trail.

## Blockers before the next byte

None.

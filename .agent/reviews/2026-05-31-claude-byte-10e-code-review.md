# Claude Review: Grow Byte 10e (Agitation and Contagion)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-05-31
**Reviewed commit:** `bdd04b9 Implement Byte 10e agitation` (range `8a9f37c..dfdc21a`) on `main`
**Review branch:** `claude/byte-10e-code-review`

## Verdict

**Approved.** No required fixes. This lands the agitation/contagion idea from
`reproducible-aliveness.md` exactly as intended: a bounded, grounded, inspectable shared-heat metric
plus per-player contagion that is genuinely shaped by disposition - the steady pulse damps while the
responsive melody catches and amplifies. It is read-only this byte (does not feed taste/transport/
scheduling), so there is no feedback loop and no runaway risk by construction, and playback is
unchanged. Findings are observations and one important forward note for when the loop eventually
closes.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **8/8 passed**; `git diff --check` -> clean.
- Live probe (two runs + playback invariants):
  - **agitation = 0.49, bounded [0,1]**, source breakdown: `densityPressure 0.87` (dominant),
    `velocitySpike 0.54`, `pushDragPressure 0.27`, `timingVariance 0.2`.
  - **Contagion differentiated by disposition (the payoff):** pulse `0.33 "damping heat"`
    (damp 0.54 > catch 0.44), bass `0.42 "catching heat"`, melody `0.46 "catching heat"`
    (catch 0.64 / amp 0.36 / damp 0.24). The steady anchor damps; the responsive voice catches and
    amplifies - emergent from the disposition numbers, not hardcoded.
  - **Playback unchanged:** 0 off-grid notes, `health: healthy`, `pending: 25`, lifecycle intact.
  - **Pure/replay-deterministic:** agitation/contagion use only windowed event fields + static
    disposition (no `Math.random`/`Date` in the math). The 0.49 vs 0.48 across two runs is sample-beat
    window difference, not non-determinism.

## Findings

No required fixes. Observations and forward notes.

### Observation (review #2) - agitation is density-led today; the micro-timing component under-contributes
Live weighted contributions to the 0.49 level: density `0.87*0.30 = 0.26`, velocity `0.54*0.24 = 0.13`,
timing-variance `0.20*0.30 = 0.06`, push/drag `0.27*0.16 = 0.04`. So ~0.39 of the heat is density+velocity
and only ~0.10 is the micro-timing signal. The weights themselves are reasonable (they sum to 1.0), but
because Byte 10d's performed offsets are deliberately subtle, the timing-variance source - which
`reproducible-aliveness.md` frames as a primary agitation input - is currently a minor contributor; today
"agitation" mostly tracks density and velocity. As/if micro-timing is made more pronounced (the 10d
weighting note), timing's share rises naturally. Also note `timingVariance` (0.30) and `pushDragPressure`
(0.16) are both derived from the same performed-offset signal, so the effective "timing" weight is ~0.46
of correlated, not independent, inputs - fine while offsets are small, worth knowing as they grow.

### Forward (the important one) - when the loop closes, this needs a build/release governor, not a per-frame clamp
10e is read-only: `contagion.level` does not feed taste/timing/density, so there is no feedback path and
**no runaway is possible now** - the per-frame `clamp(..., 0, 1)` is sufficient for a derived metric. But
the natural next step is to let contagion drive behavior (responsive players push harder when the room is
hot), which **closes the loop**: contagion -> more push/density -> more agitation -> more contagion. At
that point a hard per-frame clamp is the wrong damper - it either flattens the build or pins the system at
max. That subsystem should use a ceiling plus a slow decay (compressor-with-release, as discussed), so the
heat can build, peak, and release musically. Worth deciding the governor before wiring contagion into
behavior, and worth treating *some* oscillation there as the feature rather than a bug.

### Observation (replay/persistence, review #4) - clean by being derived, not stored
agitation and contagion are computed in `createFrame` from the windowed events plus the now-passed-in
`disposition`; they are **not** stored on `MusicalEvent`. So the event log stays unchanged and
replay-from-ledger recomputes them deterministically (given the same ledger + `currentBeat` + static
dispositions). This is the right shape - a view, not data. The only dependency to keep stable for replay
is the player dispositions (already static identity data).

### Creative lens - this is where the disposition vocabulary finally pays off
Since Byte 7 I have flagged the disposition traits as at risk of being prompt-flavor-only. 10e makes them
load-bearing in a legible way: `responsiveness`/`novelty`/`disruption` drive catching, `caution`/
`steadiness` drive damping, `disruption`/`(1-steadiness)`/`density` drive amplification - and the live
result reads true (anchor holds, melody catches). When contagion eventually drives behavior, this is the
seam where "one player's frenetic energy spreads while the steady center holds" becomes audible. It will
land hardest if the human can *see* the build first - an agitation meter / rising visual intensity that
foreshadows the band tipping over before the ear catches it (the existing `agitation` + per-player
`contagion.level` are exactly the signals a terrarium-intensity visual could read).

## Answers to the six review questions

1. **Is `mix.agitation` grounded and bounded/inspectable?** Yes - four real signals (timing variance,
   velocity spike, density, push/drag), weights summing to 1.0, clamped [0,1], all four sources exposed in
   `agitationSources`, and the UI shows the dominant source. Verified 0.49 with full breakdown.
2. **Do the source weights make sense; does any component dominate?** Reasonable first pass. Live, density
   dominates (0.87) as expected for the dense trio, and the micro-timing source under-contributes because
   10d offsets are subtle (observation above). No pathological single-component dominance.
3. **Does per-player contagion use disposition without being prompt-flavor-only or runaway?** Yes - verified
   differentiated by disposition (pulse damps, melody catches+amplifies), so it is genuinely load-bearing;
   and because 10e has no feedback loop, runaway is impossible now. The runaway concern belongs to the
   future loop-closing byte (forward note).
4. **Is the new frame shape replay/persistence and future-behavior compatible?** Yes - derived in
   `createFrame`, not stored; pure function -> replay-deterministic; the additive fields are ready to be
   consumed by behavior later (with the governor note).
5. **Is the UI language clear?** Yes - "Agitation 0.49 (density)" shows level plus dominant source;
   "Heat caught 0.46 (catching heat)" shows level plus summary; and the inspector help text explains both.
   A human can tell what is being inspected and why.
6. **Does Byte 10e leave playback unchanged?** Yes - verified: 0 off-grid, healthy/25, lifecycle intact;
   the diff does not touch transport/taste/performed-time/expression/session-mode, and nothing consumes
   agitation/contagion for behavior.

## Open questions / forward notes

- Decide the contagion governor (ceiling + decay) before wiring contagion into behavior (forward note).
- If you want agitation to reflect *feel* and not mostly density, raise the 10d micro-timing weighting
  (the agitation weights can stay as-is; the offsets just need to be less subtle).
- The agitation + per-player `contagion.level` signals are a natural driver for terrarium visual
  intensity - a cheap, high-impact way to make the build *visible* before it is audible.
- Ollama (carried, Arne's steer): switch to `qwen3:4b-instruct-2507-q4_K_M` + structured/projected JSON
  (a JSON-schema `format`) when the Ollama path is next touched - resolves the Byte 9b reasoning-model
  empty-content finding. (Noted that `experiments/2026-05-31-thought-prompt-shapes.*` landed alongside
  this byte - prompt-shape exploration, outside 10e's scope, not reviewed here.)

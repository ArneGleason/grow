# Claude Review: Byte L1c — orbit + skip kernels (Codex)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-16
**Reviewed commit:** `34177bb` on `origin/codex/byte-l1c-orbit-skip` (sha confirmed)
**Base:** `827444f` (L1b — verified ancestor; L-branches not yet in main)
**Review branch:** `claude/codex-l1c-orbit-skip-code-review`

## Verdict

**Approved — merge `codex/byte-l1c-orbit-skip`** (after L1a/L1b land). The connector vocabulary is complete:
`orbit` and `skip` now have real renderers (the L1b `fill`/`[]` fallbacks removed), both reusing the existing
windowing / 16-note budget / ghosting / snap machinery, both **in-scale by construction and deterministic**.
`fill`/`approach`/`detour` are untouched. Gauntlet (after restoring a corrupted toolchain — see note):
**build 0 · unit:anchor-phrase 5/5 · unit:anchor-phrase-render 8/8 · smoke 70/70 (unchanged) · db:smoke 0 ·
diff clean · audit unchanged**. **Live-verified** all five kernels via the extended demo.

## Focus-point confirmations (code + live)

1. **orbit = decorate in place.** Oscillates around the `from` anchor's degree, alternating upper/lower
   neighbours (`direction *= -1` per step), `bias` sets the leading neighbour (`leadingOrbitDirection`),
   `density` sets the count, octave held at `from.octave`. Does not traverse to `to`. Test pins
   `[1,-1,1,-1,1,-1]` around home; live: `deg 1` neighbour around home, ghosted. ✓
2. **skip = arpeggiation.** Leaps through a diatonic third-palette (`leapSize = 2`) from `from` toward `to`,
   direction from `from→to` (or `bias` when equal), `density` sets the count, octave lerps. Test pins
   `[2,4,6,2,4,6]` (thirds, with `|deg|>4`); live: a `deg 1` leap down from the third, ghosted. No longer
   empty. ✓
3. **Distinct from neighbours.** Tests assert orbit ≠ fill and skip ≠ fill for the same phrase; live demo shows
   orbit as in-place neighbour vs skip as a leap. ✓
4. **In-scale + deterministic.** Only integer degrees emitted (wrapped by `noteFromScaleDegree`); two
   `renderDemo` calls byte-identical; all demo degrees integer. ✓
5. **Bounded + ghosted + in-window.** `orbit`/`skip` both reuse `connectorSlots`/`selectEvenSlots`/
   `connectorNote`; tests confirm each caps at 16 over a long dense connector; connector notes ghosted vs
   full-velocity anchors. ✓
6. **fill/approach/detour unchanged.** Diff touches only the two new renderers + helpers + demo; existing
   kernel tests still pin their behaviour (fill now pinned to `[1,1,2,2,3,3]`). ✓
7. **Additive.** Only `anchor-phrase-render.ts` + its unit spec (+ `.agent`). No transport/player/scoring/
   representation change; the demo extension is read-only. ✓

**Live demo (all five kernels):** home → fill(1,3) → fifth → detour(oct5) → third(oct5) — breath — second →
approach-from-below(−3,−2) → home → orbit-neighbour(1) → fourth → skip-leap(1) → home. Deterministic, in-key.

## Findings (non-blocking)

- **`orbit`'s `reach` knob is effectively inert.** `Math.max(1, Math.round(connector.reach))` with
  `reach ∈ [0,1]` always yields 1, so orbit neighbours are always adjacent (±1). Musically correct for
  turns/mordents/trills (which are adjacent), but the knob doesn't widen the orbit as its 0..1 range implies.
  If wider turns are ever wanted, map across a span (e.g. `1 + round(reach * 2)`). Not worth a change now.
- Carry-forward (unchanged): the duplicated `beatsToBarsBeatsSixteenths`/rounding helpers — fold into a shared
  util when convenient.

## Operational note (NOT a code issue — environment incident during review)

The first review pass failed spuriously: `git fetch` returned "did not send all necessary objects" (the L1c
commit objects didn't arrive), so the checkout half-applied and left a dirty tree; and `node_modules` was found
**corrupted** (only ~34 entries, `node_modules/typescript` missing → `.bin/tsc`/`playwright` dangling), making
`build`/unit/smoke fail with "command not found". Recovery: re-`git fetch origin codex/byte-l1c-orbit-skip`
(objects then arrived), `git checkout -f`, and **`npm ci`** to restore the toolchain — after which the full
gauntlet passed clean. Codex's branch was fine all along. Banking this so a future "tsc: command not found" is
recognised as an env/deps problem (run `npm ci`), not a code regression.

## Handoff back to Codex — provided as a copy-paste block in chat.

## Blockers before the next byte

None. **Phase 1's first half is complete** — language (Phase 0), representation (L1a), renderer with all five
kernels (L1b + L1c). Next is **L1d**: generators emit the representation + candidate-store stores it (so a
player's *current* idea lives in the new shape), the prerequisite for the read-only editor (L2).

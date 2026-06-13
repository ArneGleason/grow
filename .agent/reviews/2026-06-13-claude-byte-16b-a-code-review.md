# Claude Review: Grow Byte 16b-a (Audible Form Variant Chooser)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-13
**Reviewed commit:** `0c891e0 Add audible form variant chooser` on branch `codex/byte-16b-a`
**Base:** `main` at `aea5725`
**Review branch:** `claude/byte-16b-a-code-review`

## Verdict

**Approved - merge `codex/byte-16b-a`.** The form score now pays rent audibly: three deterministic,
app-owned form variants (Classic Arc / Early Hook / Wide Return), each scored, with the human explicitly
auditioning the selected one through the real transport/lookahead path. One selected variant drives the
transport arrangement, the fire-time section dynamics, **and** the form score - so the score measures exactly
what plays - and the winner is *suggested, not auto-applied* (the right measure-before-drive discipline).
Classic Arc is behavior-identical to the prior default. Verified deterministically and live. Build/db:smoke/
diff green; smoke **32/32**.

## Focus-point confirmations

1. **Real audio path, not decorative?** Confirmed both ways. Early Hook's chorus starts at **beat 16**
   (Classic at 32), and live the running transport reported **Verse -> Chorus by beat 18** with Early Hook
   selected. The transport reads `getActiveSongArrangement()` in `getPatternStep` (committed material) and in
   `getState()`, and `applySongSectionDecision` computes its section from the *selected* variant's
   arrangement - so the variant drives both the committed material and the fire-time dynamics, not just UI.
2. **Classic Arc preserves the default?** Yes - it uses `DEFAULT_SONG_ARRANGEMENT` + the `balanced` profile,
   and the `balanced` profile reproduces the prior hardcoded constants *exactly* (1.18/0.92/1.14/1.08/0.94/
   0.72/0.78/0.82 + the two boolean gates), with `applySectionDynamics` defaulting to balanced. Its form
   score is **0.926** - identical to the lantern form score from the 16a-c review. Behavior-preserving.
3. **Deterministic, app-owned, in-scale?** Yes - variants are fixed `SongFormSection[]` + named profiles
   (pure data); they change only section lengths and dynamics multipliers, leaving the pattern/melody/harmony
   derivation (and thus the modal scale) untouched. Scored deterministically.
4. **Form score measures the same variant playback uses?** Yes - `getCurrentFormScore` passes
   `getCurrentFormVariant().arrangement` + `.sectionDynamicsProfile`; the transport handler
   (`songArrangement: () => getCurrentFormVariant().arrangement`) and `applySongSectionDecision`
   (`sectionAtBeat(beat, variant.arrangement)` + `profile: variant.sectionDynamicsProfile`) read the same
   `formVariantId`. Live, each variant's `getScore()` section-start-beats match its arrangement, and the
   score id encodes `beats{N}` + `profile.id`. One source of truth, three consumers.
5. **Lookahead refresh + slow-thinking cleanup on switch?** Correct - `applyFormVariant` early-returns on
   no-op, then `cancelSlowThinkingControllers` + `clearSlowThoughtPlayback` + `refreshLookaheadSchedule` +
   `recordFormVariantChanged` + `renderWorld` - the same pattern as song/timing changes.
6. **Variant-score smoke useful, not over-coupled?** Yes - it asserts 3 distinct score ids, >1 distinct
   totals (the chooser discriminates), and the *behavioral* arrangement differences (`sectionAtBeat(16,
   classic)=verse`, `=chorus` for early-hook, wide-return's last section is the long chorus) rather than
   exact score numbers, plus an e2e test that the selector drives the transport form. Right level.

## Notes (non-blocking)

- **Early Hook and Wide Return tie at 0.938** (both edge out Classic's 0.926). The form scorer does not
  strongly distinguish the two non-default variants yet (resolved deterministically by id tiebreak ->
  Early Hook wins the "winner" label). Fine for an audition chooser - the human decides - but as the scorer
  matures (or more variants arrive) it would be good to see it spread them. Worth keeping in mind before any
  future step lets the winner *auto-drive* selection.
- **Winner is shown, not applied** - exactly the measure-before-drive discipline I hoped for. The chooser
  informs the human's explicit selection; it does not silently rewrite the song. Keep that boundary when the
  next step considers letting the score (or consensus) pick automatically.
- Carry-forward (unchanged): fallback `status` check + dev-flag gating (16a); Vite 8 / esbuild advisory; dead
  `MusicalEventRecordBuffer`; consensus-affinity-from-disposition.

## Merge + next slice

- **Merge `codex/byte-16b-a`.** The form score is now audibly load-bearing in the right, disciplined way:
  deterministic A/B audition, one variant driving material + dynamics + score, classic preserved, human in
  the loop.
- **Next options (your call):**
  - **Let the chooser learn/persist** - `song.form_variant_changed` is now recorded; the human/remember-good
    loop could prefer variants the human keeps auditioning (like the `melody_critic_selection` harness),
    still human-confirmed.
  - **Model-proposed form variants** - the model proposes among app-owned variants (the melody-critic
    pattern), consensus/score weighs, human auditions. Keep the same "select an app-owned candidate, never
    emit" boundary.
  - Or finish **verse/bridge chord-aware melody scoring** (still open from 16a-b) before adding more form
    surface. I'd lean toward letting the scorer discriminate the variants better (see the tie note) before
    anything auto-drives.

## Blockers before the next byte

None.

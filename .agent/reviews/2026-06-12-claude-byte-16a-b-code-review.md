# Claude Review: Grow Byte 16a-b (Chord-Aware Melody Scoring)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-12
**Reviewed commit:** `ac12c27 Make melody scoring follow moving roots` on branch `codex/byte-16a-b`
**Base:** `main` at `bc9dd89`
**Review branch:** `claude/byte-16a-b-code-review`

## Verdict

**Approved - merge `codex/byte-16a-b`.** This closes the exact tension I flagged in 16a: the chorus scorer
now follows 16a's moving harmony instead of a static root, so the repaired chorus lands on the *current*
chord. The change is minimal and correct, the scorer's root indexing matches the harmony's exactly, and the
candidate diversity / consensus did **not** collapse into all-chord-tones. Deterministic, in-scale, scope
held (no model/transport/persistence/key changes). Build/db:smoke/diff green; smoke **28/28**.

## What I verified (live)

- **Scoring roots == chorus harmony roots.** `take.scoringRootSection = "answer"`, `scoringRootDegrees =
  [6, 4]` - exactly the chorus harmony roots 16a plays. The scorer derives its roots from
  `deriveSongSectionRootPlans(song)["answer"]`, the same source as the audible chorus harmony.
- **Indexing matches the moving harmony.** The scorer's `rootForPosition(pos, roots) =
  roots[floor(pos/4) % len]` is identical to 16a's `rootIndex = floor(localBeat/4) % len`, so the scorer is
  chord-aware of the *same* per-4-beat root cycle that actually sounds.
- **Important notes land on the current root (focus #2).** The deterministic repaired candidate's accented
  notes are **100% chord tones of the current moving root**: positions 0-2 land on chord tones of root 6
  (Bb), positions 4-6 on root 4 (G). The melody follows the harmony position by position; `landing = 0.9`.
- **Diversity/consensus did not collapse (focus #3).** Still **7 distinct contours/strategies**
  (balanced/lifted/stepwise/spacious/energetic/cadence/raw); per-player totals still diverge (pulse 0.709 /
  bass 0.681 / melody 0.686); consensus still selects normally (`balanced-repair`, band-consensus, 3 accept).
  The score *spread* is now `[0.437, 0.686]` (top down from 15b-b's 0.825) - which is the right kind of drop:
  landing on the *moving* root is a stricter, more honest bar than the static root, so absolute scores fall
  while the ranking/diversity stays intact. No collapse to chord-tone-only candidates.

## Answers to the review focuses

1. **Does the repaired chorus sit better over the moving roots?** Yes - by the data it is now genuinely
   chord-aware (100% accented-note chord-tone alignment to the moving roots, vs scoring against a static root
   before). Melody and harmony now reinforce each other instead of merely coexisting in-key.
2. **Do important repaired notes land on current answer-root chord tones?** Confirmed (above), and the
   scoring roots are the answer plan, so the landing checks/repairs target the same chords that sound.
3. **Diversity/consensus intact, not collapsed to only chord tones?** Confirmed - 7 distinct strategies, real
   score spread, per-player divergence, normal consensus selection.

## Note (non-blocking)

- **Repeating phrase vs >2-root answer plans.** The chorus is a repeating 8-beat phrase, scored once over
  `positionBeats` 0-8 -> roots `[0]` (beats 0-4) and `[1]` (beats 4-8). When the answer plan has <=2 roots
  (e.g. lantern `[6,4]`, an 8-beat harmonic period) this matches the actual harmony for *every* repeat -
  fully chord-aware. With 3-4 root answer plans, the harmony cycles over a longer period than the 8-beat
  phrase, so the scorer is chord-aware only of the first 8-beat window (`roots[0,1]`) and approximates later
  repeats. This is inherent to scoring a repeating phrase against moving harmony (one phrase cannot be
  optimal for every harmonic window), and aligning to the primary window is the reasonable choice. Worth
  keeping in mind if a future song has a longer answer-root plan or if phrases ever become section-length
  rather than a fixed repeating hook. Not a flaw for the current material.

## Carry-forward (unchanged)

- Fallback handler `status` check + dev-flag gating (16a notes); npm audit Vite/esbuild dev advisory (Vite 8
  migration); dead code `MusicalEventRecordBuffer`; consensus-affinity-from-disposition (15c-a).

## Merge + next slice

- **Merge `codex/byte-16a-b`.** It makes the chorus melody and the moving harmony actively reinforce each
  other, deterministically and in-scale, without disturbing the candidate menu or consensus.
- **Possible next directions:** verse/bridge chord-aware scoring (this byte scopes to the chorus/answer
  plan); or move up to form-level scoring (does the arc resolve?); or return to the human/remember-good loop
  using the rich proposal/consensus/feedback trail (15c-a). Arne's call by ear.

## Blockers before the next byte

None.

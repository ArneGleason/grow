# Plan: Scored, Repaired, Perspectival Melody Variation (Byte 15 arc)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual
**Date:** 2026-06-07
**Branch for this note:** `claude/melody-scoring-planning` (planning artifact; no code)

## The idea (distilled from Arne)

A mechanical transformation (rotate/invert/drop-increment) is a **draft, not the answer** — played literally
it's predictable and lands wrong. The value is a second pass that **critiques the draft and repairs it**:
smooth the notes that don't land, perturb the notes that are monotonous — toward a **sweet spot**, not toward
maximum cleverness. And the critique should be **perspectival**: players disagree based on their backgrounds
(the music they "listened to"). Plus a **score** the band assigns itself (and that Arne can override).

So the new primitive is **scoring**, and the loop is **transform -> score+critique -> repair -> (consensus) ->
remember**.

## Research grounding (so we're building on known ground)

- **"Lands properly" is computable — Narmour Implication-Realization:** small intervals imply continuation,
  large leaps imply reversal (gap-fill), proximity, closure. Predicts listener expectation; implemented
  computationally.
- **"Too predictable / monotonous" is measurable — IDyOM (Pearce):** information content (surprise) +
  entropy (uncertainty), from a **long-term corpus** + the current piece. Low IC = boring; high IC = jarring.
- **The target is the inverted-U (Wundt/Berlyne):** preference peaks at *intermediate* surprise/complexity
  (~88% of music-preference studies fit). So we score toward a **moderate** surprise level, not a maximum —
  exactly Arne's "more surprising but not random."
- **Generate-then-repair is established — Pachet Markov constraints;** human-mentor fitness — **GenJam** (a
  person's good/bad feedback as the fitness). Maps to Arne's "I'm happy to score them myself."
- **Key insight for perspective:** IDyOM's power comes from a per-listener **long-term prior** = the corpus
  they've heard. So a player's "fake background" *is* a small prior corpus; the same note is expected to one
  player and surprising to another. Perspective is principled, not hand-waved.

## Arne's decisions for this arc (he chose the richer path on all three)

1. **Scoring basis:** heuristics **+ a per-player learned prior** (tiny "influences" corpus per player).
2. **The critic:** **model (Ollama) as critic**, not only deterministic heuristics.
3. **Human loop:** **add a human up/down now** (GenJam-style mentor), not self-score-only.

All three are good targets. The safe way to get there fast is to **build the deterministic substrate first,
then let the model stand on it** — because the deterministic scorer is also the *harness* that tells us
whether the model critic is actually helping (score the model's pick vs the deterministic pick).

## The scoring model (deterministic substrate)

Three sub-scores mapping onto Arne's three words, computable from notes + the song's chord/root plan + scale:

- **Lands properly** = tonal landing (accented/phrase-final notes on chord tones; cadential closure) +
  leap resolution (leaps >= 3 steps resolve by step in the opposite direction — Narmour gap-fill).
- **Too predictable / monotonous** = penalize repeated-interval runs, narrow pitch-class variety, long
  single-direction stretches, exact-repeat cells.
- **Surprise vs target** = a coarse local surprise (improbability under the player's prior; see below),
  scored as closeness to a **per-player target level** (inverted-U) — penalize both ~0 and extreme.

Output: a **structured self-score** (sub-scores + total) + a **per-note critique** ("note 5: unresolved
leap"; "9-12: monotone"; "3: off-chord downbeat"). Everything deterministic and reproducible.

**Per-player prior (tiny, deterministic, no training):** each player gets a small fixed set of "influence"
seed phrases (authored in the player profile — "the music they listened to"). Build a simple scale-degree /
interval **n-gram** prior from those + the current song. A note's surprise = its improbability under *that
player's* prior. No external data, no learning loop — IDyOM-lite, seeded, reproducible. Perspective also
shows up as per-player **weights + surprise target** from existing dispositions (caution/steadiness -> lower
target, higher landing weight; disruption/novelty -> higher target, tolerates leaps).

## The repair loop (deterministic substrate)

For each flagged note, generate a small set of **in-scale** candidate substitutions (neighbor tone, chord
tone, contour-smoother, register nudge), score each, keep the one that most improves the score; iterate a
couple of bounded passes; deterministic tie-breaking. This is Pachet-style generate-and-repair, and it
**cannot leave the scale** (same `noteFromScaleDegree` wrap as Byte 14). The repaired line is committed
through the lookahead (Byte 14's commit path), never fire-time.

## The model critic (on top of the substrate, bounded)

The model **never emits pitches.** The deterministic repair produces, per flagged note, a small set of
already-validated, in-scale, pre-scored candidates. The model's job: **select which candidate** (or "leave
it") and optionally give a one-line rationale. It returns a **structured choice** (index into the candidate
set), validated; invalid/unavailable -> fall back to the deterministic best. So:
- prose is data (the rationale is commentary; the structured index is what acts) — the 12b-c rule;
- never a wrong note (it only picks among in-scale, scored candidates);
- reuses the thought-protocol + validator + mock-fallback machinery;
- and the deterministic score of the model's pick vs the deterministic pick is logged, so we can *see*
  whether the model helped.

## The human loop (GenJam-style mentor)

After a candidate plays: a thumbs **up** = "remember this" (persist as remembered-good via Byte 13b
persistence) + nudge that perspective's weights toward it; thumbs **down** = discard and repair again.
Minimal UI (two buttons + the score readout). Human feedback outranks the self-score when given.

## Recommended slicing (so it stays reviewable; collapse if you prefer)

Strong recommendation: **two bytes**, because the deterministic substrate is the harness for the model critic
and bundling everything makes "did the model help?" impossible to judge.

- **Byte 15a — deterministic scorer + repair + per-player perspective + human up/down + remember.** No model
  in the loop yet. Already rich: self-scores, per-player critique that *disagrees*, an audibly repaired
  chorus (A/B raw vs repaired, by ear and by number), and you can thumb good ones into memory. Reviewable by
  ear AND by score.
- **Byte 15b — model as critic on the proven substrate.** The model selects among the scorer's validated
  candidates (behind validator + mock fallback), with the deterministic pick as ground-truth comparison
  logged. Now we can tell if the model's taste beats the heuristics.

If you'd rather one bigger byte, keep 15a's substrate as the floor and add 15b's critic in the same PR — but
land/keep the deterministic path so there's always a reproducible ground truth and a fallback.

## Bigger objective (the destination)

A band that **proposes a transformation, scores it from each player's perspective, repairs it toward the
sweet spot, argues to consensus, and remembers what worked** — reusing sections (Byte 14), proposal/response
consensus (12b), persistence-as-memory (13b), and dispositions. Later layers: form-level scoring (does the
chorus contrast the verse enough? does the arc resolve?), richer per-player corpora, and the model proposing
*transformations* (not just picking repairs) behind the validator. That is the "rich compositional
back-and-forth," approached one reviewable, audible step at a time.

## Risks / disciplines to hold

- **Keep a deterministic ground truth + fallback always** (reproducibility; the harness; the safety net).
- **Never a wrong note** — model and repair only choose among in-scale candidates; commit through the
  lookahead, not fire-time.
- **Prose is data** — the model's rationale is commentary; a validated structured choice is what acts.
- **Per-player prior must be seeded/deterministic** (a tiny authored corpus), not trained/learned online.
- **Review by ear** stays the gate, now paired with the score readout as a second lens.

## Open questions to settle before/while building

- What's the surprise **target** per disposition, and how wide is the acceptable band? (Start coarse;
  calibrate by ear.)
- How big is each player's **influence corpus** (a handful of short phrases?) and where does it live
  (player profile data)?
- Does human **down** re-repair with different candidates, or just discard? (Suggest: re-repair, avoiding the
  rejected line.)
- For 15b, does the model pick **per-note** or **per-phrase** (whole repaired candidate)? (Per-phrase is
  simpler and less chatty; start there.)

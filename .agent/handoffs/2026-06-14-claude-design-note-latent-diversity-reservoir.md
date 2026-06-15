# Design note: latent diversity reservoir (quality-diversity beyond the D4 floor)

**From:** Claude Code on `mac-mini-pro-m4` (architect)
**Date:** 2026-06-14
**Status:** design principle / future byte (likely D5) — captured per Arne's input on D4.

## Arne's idea

> "Add some hidden preserved diversity in the genes that is interesting but does not score higher by
> conventional measures. Often a nice variation doesn't pay off till somewhere farther down the line."

Preserve a stratum of the population deliberately chosen for being *interesting-but-not-currently-rewarded* —
latent/recessive material the present fitness scorer doesn't value, on the bet that it becomes valuable later
(after a further mutation, a recombination, or a change of goal/context).

## Why this is sound (it's not just a nice-to-have)

- **Neutral theory / genetic drift.** In biology most variation is selectively neutral; it accumulates as
  *hidden* genetic variation, and a single later change can suddenly make an accumulated trait advantageous.
  Strict fitness selection erases exactly this reservoir.
- **Deception & stepping stones.** A fitness gradient is a *proxy*, and proxies are deceptive: the path to the
  global best can require going *down* in fitness first (crossing a valley). Greedy hill-climbing (our D3/D4
  selection) gets stuck on a local peak — which is literally what we watched happen (plateau by gen 4).
- **Novelty search / Quality-Diversity (MAP-Elites).** The state of the art for this exact problem keeps an
  *archive* of diverse-but-not-necessarily-fit solutions precisely because they are stepping stones to later
  breakthroughs. "Interesting now, pays off later" is the QD thesis.

This is the same spirit as the project's standing lens (the scorer is a fallible proxy; bias toward what's
musically alive over what's measurably optimal) — applied to *time*: long-horizon potential over immediate
fitness.

## How it differs from the D4 diversity lever

- **D4 (similarity floor):** spreads the *scored* elite across the behavior space — explore the space the
  scorer can see, without losing the best. It still keeps things that score reasonably.
- **This (latent reservoir):** preserves variation the scorer *doesn't reward at all* — a small archive
  selected by criteria **orthogonal to fitness**, kept alive when strict/diverse selection would purge it.

Complementary, not redundant: D4 keeps the *exploiters* diverse; the reservoir keeps *explorers the proxy
can't yet appreciate*.

## The crux: "interesting, orthogonal to fitness"

The whole idea hinges on a notion of *interesting* that is **not** the prosody fitness. Candidates:
- **Novelty / rarity:** distance to the k-nearest in an archive of what we've already kept (classic novelty
  search) — fitness-independent by construction.
- **Genome features the prosody scorer ignores:** intervallic variety / leap profile, rhythmic syncopation
  against the grid, register breadth, contour complexity, motif self-similarity. A phrase can be average on
  the 4 prosody subscores yet unusual on these.
The reservoir keeps candidates that are **high on interestingness but not high on fitness** — the deliberately
preserved recessive genes.

## The feedback that makes it actually matter

A preserved-but-inert reservoir does nothing. For latent variation to "pay off down the line,"
**development must sometimes draw a parent from the reservoir** (not only from the fitness-elite), so the
hidden genes get recombined/mutated and occasionally surface into the elite. That feedback loop is the point.

## The risk to manage

Too much preserved material *dilutes* selection pressure → the loop wanders and never converges on good music.
So: a **small, bounded** reservoir, and a **real** interestingness signal (not random preservation) — random
preservation just keeps noise, not stepping stones. The art is entirely in the interestingness metric.

## Sequencing (recommended)

1. **D4** — the simple similarity-floor (small, safe, immediate anti-inbreeding). Ship it.
2. **D5** — the latent reservoir / quality-diversity: a bounded archive selected by orthogonal interestingness
   (novelty + ignored-feature signal), preserved through selection, and drawn from during development. This is
   the meatier, more ambitious byte and deserves its own design pass (esp. the interestingness metric).

Disciplines unchanged: bounded reservoir, deterministic, in-scale (all reservoir candidates are validated
phrase genomes), inspect-only until proven.

— Claude

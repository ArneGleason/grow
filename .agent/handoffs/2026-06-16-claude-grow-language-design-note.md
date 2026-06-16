# Design Note: The Grow Language + Graphical Note Editor (north star)

**Author:** Claude Code (architect), with Arne
**Date:** 2026-06-16
**Status:** Agreed destination. Build sequence is in the companion roadmap
(`2026-06-16-claude-grow-language-roadmap.md`). This note is the *where we're going*; the
roadmap is the *how we get there*.

## Why

Grow has a strong evolutionary engine but no human hands on the notes, and no musical vocabulary
worth evolving — phrases are flat note grids. The point was a *toy you play music with*. This is the
missing half: a small, playful, **new musical language** plus a **graphical per-player note editor**,
sitting on a two-tier phrase representation that is simultaneously the editor's data model, a richer
evolvable genome, and the source of finer rhythmic detail.

Guiding principle: **a new surface language with the classical system kept underneath as a
translation key** — never a music lesson, always a bridge you can lift the cover on for help.

## The language

### Degrees as the primary handle (key under the covers)
A melody is its **numbers**, not its letters — `1 5 6 3` is the tune regardless of key. The engine is
already degree-native (`noteFromScaleDegree(key, degree)`); we surface degrees as the handle and demote
letters/key to a quiet realization readout. Resonant with the Nashville number system (contemporary, not
classical baggage). **1-based** (1 = home), so the numbers carry their pull: 1 home, 4/5 pillars,
7 leans home, 2/6 color. Anchors tend to sit on strong degrees; connectors thread the rest.

### Degrees as fixed colors
Each degree has one permanent color, so a line reads as a **color contour** — recognized by color, not by
reading numbers or counting lanes. Same tune in any key = same colors.

| degree | role | color |
|---|---|---|
| 1 | home | coral `#D85A30` |
| 2 | color | amber `#EF9F27` |
| 3 | color | green `#639922` |
| 4 | pillar | teal `#1D9E75` |
| 5 | pillar | blue `#378ADD` |
| 6 | color | purple `#7F77DD` |
| 7 | leans home | pink `#D4537E` |

### Modes — evocative names, classical bridge underneath
Brightness-ordered (the list itself teaches the spectrum), each name *is* the feel. Every name carries its
classical mapping + interval pattern as metadata for two-way translation / "what is this?" lookup.

| name | vibe | = classical |
|---|---|---|
| Helium | weightless, fizzy, floats off the ground | Lydian |
| Sunshine | wide-open, easy, obviously happy | Ionian (major) |
| Strut | loose, grinning swagger — bright with grit | Mixolydian |
| Smoke | cool, curling, bittersweet but moving | Dorian |
| Bruise | tender, heavy-hearted, the ache | Aeolian (natural minor) |
| Scorch | smouldering, tense, a little dangerous | Phrygian |
| Freefall | no ground under you, gloriously unstable | Locrian |

Engine-realizable today: **6 of 7** (`MODE_INTERVALS`/`SONG_GOAL_MODES` cover ionian/dorian/mixolydian/
aeolian/lydian/phrygian). Only **Freefall/Locrian** is not yet realized — adding it is a small separate
behavior-change byte (extend `MODE_INTERVALS` + `SONG_GOAL_MODES`).

### Anchors + connectors (the melody is a graph)
A line = **anchor nodes** joined by **connector edges**. Classical maneuvers are recognized as *presets*,
their function preserved, their jargon dropped.

- **Anchor** — a structural note: `{ degree, start, duration, dynamics }`.
- **Connector** — how you travel between two anchors:
  - **shape kernel** (open, extensible set): `fill` (traverse directly), `detour` (leave & return),
    `approach` (converge on the target), `orbit` (decorate in place), `skip` (jump through a set).
  - **knobs** (continuous, apply to any kernel): `reach` (deviation from the straight line),
    `density` (notes/subdivision), `bias` (above/below, up/down), `pull` (gravitation toward the target),
    `color` (diatonic ↔ chromatic excursion, bounded), `skew` (timing early/late/swing).

Classical → generalized (function preserved): passing tone = `fill` low density; run = `fill` high density;
neighbor = `detour` reach 1; enclosure = `approach` bias both, high pull; appoggiatura = `approach` overshoot,
high pull; arpeggio = `skip` chord-tone set; turn/mordent/trill = `orbit` small reach high density;
anticipation/suspension = any kernel + `skew`.

A **kernel** is a deterministic, **in-scale-by-construction** generator. The kernel *registry* is the open
"area of development" — adding a kernel grows the vocabulary.

### Phrase = segments + gaps
A complete phrase is **multiple segments separated by rests** — the line stops, breathes, and the next
segment starts. Gaps/silence are first-class, not absence of data.

### Players own connector palettes
Each player has a **palette** of named connectors (its dialect) — moves it leans on, **develops** (mutate
knobs / re-kernel → a variant), and **shares** (copy a connector into another player's palette). Connectors
are genome too; evolution develops both the anchor line and the vocabulary that connects it.

## The visual grammar (the editor)
Clean, geometric, grab-able (Bitwig/Melodyne steer), minimal labels:
- **timing grid** — heavy bar lines, light beat lines, counts along the bottom.
- **anchors** = rounded-corner bars; **width = duration**, **color = degree**, **opacity = dynamics**.
- **connectors** = a gesture sparkline wrapped in a soft **variation ribbon** (ribbon width = `reach`),
  with the connector's own rendered notes shown as small colored bars (carrying their own length/dynamics).
- **kernels** = glyph shapes (rising line / bump / zig-converge / loop / dotted-leap), not words.
- **gaps** = visible silence with a small breath mark.
- header shows the mode by its evocative name (key + classical name a hover away) and the **idea catalog**
  (peruse `‹ idea 3 of 7 ›`, `+ new`).
- scales to other players: bass = same dots, longer/flatter ribbons; beats = colorless hits, same gestures.

## The editor's job
Click a player → see the **motive/riff/beat it's working on now**, in this grammar. Peruse its **idea
catalog** (= the player's candidate population), **edit** an idea (move/resize/retune anchors, pick connector
kernels+knobs, add/remove segments+gaps, set dynamics, hear it live), or **author a new one** that seeds the
band. Human-authored ideas join the population; evolution develops them; the written↔evolving dial still
governs how far performance deviates.

## Invariants preserved (non-negotiable)
- **In-scale by construction** — kernels only emit in-scale degrees; `color` excursions are bounded & resolve.
- **Bounded & validated** — anchors/connectors clamped (degree, duration, dynamics, knobs); server-validated
  like every other candidate; branch-scoped ids + audit reused.
- **Deterministic** — kernels are pure functions of (anchorA, anchorB, knobs, key, seed).
- **Default-preserving / layer-don't-replace** — existing songs sound the same until a human or the engine
  changes something; the new representation is added alongside, not swapped in under people's feet.
- **Classical bridge retained** — every new term resolves to its classical name for help/translation.

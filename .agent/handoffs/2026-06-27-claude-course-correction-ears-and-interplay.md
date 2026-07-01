# Course Correction: Ears and Interplay

**Author:** Claude Code (architect/reviewer), with Arne
**Date:** 2026-06-27
**Status:** Agreed new direction for the musical core. Supersedes the "widen the generator" line of work
(the wild-song / connector-song spikes are HELD — see § What survives). Companion kickoff:
`2026-06-27-copy-paste-codex-byte-e1-kickoff.md`. This note is the durable record of *why* we changed
course, not just what to build — read the backstory before the direction.

---

## 1. The backstory — where we are and how we got here

### What was built (and it all works)
Across the spring arcs, byte by byte, all green, all reviewed:

- **SongGoal** — free-text idea → bounded, validated goal (closed vocabularies, clamped knobs).
- **Prosody** — melody rhythm as speech (metrical feet, antecedent/consequent, anacrusis, arch).
- **The Grow language + representation (L-arc)** — degrees-as-color, evocative modes, and the
  anchors + connectors phrase representation with a five-kernel renderer (fill/detour/approach/orbit/skip),
  in-scale by construction.
- **The evolution engine (A/D arcs)** — candidate store (branch-scoped, audited), fitness aggregation,
  selection with elitism, development operators, diversity reservoir, autonomous evolving performance (D5).
- **The instrument (L2–L4)** — a findable, contained, progressive-disclosure editor: watch a phrase, edit its
  notes/gestures/structure by hand, author from scratch, save to a catalog, see evolution sparklines.
- **The song library** — prompt-seeded starter songs driving real 4-bar active material with moving roots.

Smoke grew 58 → 78 tests. Every byte deterministic, bounded, in-scale, reproducible, reviewable.

### What we heard (the moment of truth)
When Arne finally listened as a *listener* rather than as a builder: **naïve, same-sounding patterns.**
Not interesting, let alone enjoyable. Starter songs vary in surface detail but share one character; evolved
phrases converge; nothing develops across a song. Codex felt it too — its recent spikes
(`byte-wild-song-draft-a`, `byte-connector-song-spike-a`) both widen `song-starter-material.ts`, i.e. more
deterministic material generation. That instinct presses the wrong lever (see diagnosis).

Arne also named the assumption that silently never got built: *"I had taken for granted that we'd have some
way for the player to identify something as musically good or bad to at least somebody's ear."*

### How the diagnosis was reached
A code-grounded audit of the three questions that matter: **who judges, who listens, what's at risk?**

- The **only fitness function in the system** is `scoreProsody`, weighted in
  `candidate-fitness.ts`: `richness 0.30, questionAnswer 0.35, anchorContrast 0.20, anacrusis 0.15`.
  Four hand-written structural checks.
- The D4 "interestingness" metric (`candidate-diversity.ts`) is **variety counting** — interval variety,
  register breadth, pitch-class diversity. Variety is not interest.
- **Expression/contagion never touches pitch** — `src/expression.ts` contains no `scaleDegree`; player
  "taste"/contagion shapes velocity/timing/visuals only. Confirmed by grep. No player's *notes* respond to
  any other player.
- The chromaticism knob (`color`) has been **stored but never rendered** since L1b. Harmony is root motion
  with no chords, no voice-leading, no dissonance.
- Songs are **static 4-bar packs looped** through a form arrangement. Nothing accumulates or transforms
  over the length of a piece.

---

## 2. The diagnosis — three missing organs

**Organ 1 — an ear.** Evolution optimizes a hand-written proxy, so it breeds phrases that satisfy the
checklist. Goodhart's law, set to music: when the measure became the target, everything that "wins" sounds
the same, because the proxy has one attractor. Nothing in the system models a *listener* — nothing forms
expectations, nothing is surprised, nothing prefers. Without an ear, "fitness" cannot mean "good to
somebody," so selection cannot select for interesting.

**Organ 2 — each other.** The founding vision was *modelling the interactions of a collection of musicians
collaborating*. What got built is three parallel pattern lanes reading a fixed pack, plus an offline
optimizer breeding artifacts in a database. No player ever hears a phrase and answers it, quotes it, or
leaves space for it. There is no shared memory. Music's interest lives almost entirely in
relationships-in-time — call and response, repetition with variation, tension between voices. A looped pack
cannot develop, so it reads as wallpaper regardless of the pack's quality.
**The drift, in one line: the vision was performance-as-process; we built composition-as-artifact.**

**Organ 3 — stakes.** In-scale by construction everywhere; consonance-only; deterministic; bounded.
Those were the *safety rails of the review process* (Claude's regime as much as anyone's — own it), and
they are precisely the properties that guarantee inert music. Interesting music is managed risk: tension
raised, expectation bent, then resolved. There is currently nothing to resolve.

**Corollary:** widening the generator (the spikes) cannot fix any of this. More material, judged by the
same empty proxy, played by the same non-band, with nothing at stake — is more wallpaper.

---

## 3. The direction — re-found the musical engine on the existing chassis

The chassis is good and stays: transport/lookahead, tonal context, anchors+connectors representation +
renderer + editor + catalog, persistence/branch/audit, the evolution *mechanics*, the song library UI.
What gets replaced is the musical engine that sits on it. Three moves, in this order:

### Move 1 — Interplay: give the players each other (E1)
A **shared motif memory**: everything anyone plays enters a bounded pool of motifs (short degree/rhythm
fragments with provenance). Players **quote, vary, and answer** from it — steal a heard fragment, transpose
it toward the current chord root, invert it, re-rhythm it, thin it, hand it back. Call-and-response
scheduling (melody asks, bass answers next bar). Density negotiation (when one is busy, another thins).
This is the mechanism family behind improvising systems that actually sound alive (OMax's factor oracle,
George Lewis's Voyager): the output starts *referring to its own history*, which is the minimum condition
for "goes somewhere." The anchors+connectors representation is the natural motif substrate — this is what
it was built for.

### Move 2 — Stakes: tension and release (E2)
A real (small) **chord layer** — functional families, not just roots — and **chord-aware tension tones**:
finally render the `color` knob, gated by a resolution rule (a tension tone must resolve by step within the
phrase). A **tension curve over the form** that all players read: density, register, and dissonance rise
into the chorus, break, and resolve after. The connector knobs (reach/density/color) were built for exactly
this and are sitting at fixed values.

### Move 3 — Ears: taste that is somebody's (E3 + E4)
Two ears, both local, neither hand-written:

- **The human ear as play (E3):** while the band plays, one tap = "feed" the moment (terrarium-native
  gardening, not a ratings chore). Occasionally the toy plays two short candidates back-to-back and asks
  *which felt better*. ELO from those judgments becomes a fitness stream. A few hundred human pairwise
  picks beat any heuristic we could write — this is preference learning at toy scale. Creative skin
  (optional, later): the ear is **a creature on the stage** — a Listener that visibly leans in when
  interested and glazes over when bored; its reactions ARE the fitness display.
- **A corpus ear (E4):** a small variable-order Markov model (IDyOM-lite / PPM-style) trained on a local
  symbolic folk corpus (e.g. Nottingham/Essen, ABC/MIDI, small and free) yields per-note **surprisal**.
  Music cognition's most robust result (the Wundt inverted-U) says interest lives between predictable and
  chaotic — so fitness = staying in the surprisal sweet band, plus **within-piece self-similarity**
  (repetition-with-variation is measurable; too-same = boring, too-different = noise). Computable in
  milliseconds, no GPU, no training loop.
- **Honesty about the LLM:** the local Ollama text model cannot reliably *hear*. It stays the prompt
  interpreter, and at most one diverse juror — never *the* ear.

`scoreProsody` **demotes to a sanity floor** (a structural gate, not the objective). The candidate store,
selection, and D5 machinery are unchanged — they finally get an objective worth optimizing.

---

## 4. What survives, what demotes, what holds

| | disposition |
|---|---|
| Transport/lookahead, tonal context, persistence/branching/audit | **keep** (chassis) |
| Anchors+connectors, renderer, editor, catalog, sparklines | **keep** (motif substrate + human interface) |
| Evolution mechanics (store/select/develop/D5) | **keep** — re-aim at the new fitness |
| Song library + starters | **keep** — starters become *seed material the band riffs on*, not the composition |
| `codex/byte-midi-export-a` | **useful enabler** (corpus work; auditioning in a DAW) — review/merge on request |
| `scoreProsody` as objective | **demote** to sanity floor |
| Deterministic keyword packs as "the composition" | **demote** to seeds |
| `byte-wild-song-draft-a`, `byte-connector-song-spike-a` | **hold** — wrong lever (more generator, same judge, same non-band); salvage ideas later |
| In-scale-by-construction as universal law | **relax** to *in-key with gated tension* (dissonance allowed, resolution required) — from E2 |

**Guardrail shift (important):** safety rails stay on the *code* (bounded, validated, reviewable, no new
audio paths, seeded determinism where tests need it). They come OFF the *music*: risk, tension, and
surprise are now the point. Review success criteria change accordingly — smoke counts still gate, but the
review of these bytes is **by ear against explicit musical claims** (does the bass audibly answer the
melody? does tension rise and resolve? do A/B picks reorder candidates?).

### Alternative considered and set aside
A clean restart on a minimal core (two players trading fours + motif memory + human taps, nothing else).
Rejected for now: the chassis is not what failed, and a restart spends weeks rebuilding plumbing to arrive
at the same three missing organs. Revisit only if the chassis actively fights Move 1.

---

## 5. Sequencing

- **E1 — interplay MVP** (first byte, audible change): melody & bass share a motif pool over a two-chord
  alternation; quote/vary/answer; a simple tension curve drives existing density/register knobs. See kickoff.
- **E2 — tension/chord layer**: chord families, render `color` with resolution gating, form-level tension
  curve for all players.
- **E3 — the human ear**: tap-to-feed + pairwise A/B votes → ELO → candidate fitness stream.
- **E4 — the corpus ear**: IDyOM-lite surprisal + self-similarity critics; fitness = ears' ensemble;
  `scoreProsody` → floor.
- **E5 — close the loop**: evolution (D-loop/D5) re-aimed at the ear-ensemble fitness; the band's liked
  material feeds the motif pool across sessions. Then revisit the held spikes for salvage.

One byte at a time, same studio cadence: kickoff → build → gauntlet → Claude review (now with listening
checks) → merge. Codex: please wait for each kickoff before building — the guardrail *shape* is different
in this arc and the kickoffs carry it.

# Design note: reactive neural performance layer (phase-2)

**From:** Claude Code on `mac-mini-pro-m4` (architect)
**Date:** 2026-06-14
**Status:** design direction — phase-2, *after* the evolutionary loop (D-track) and the functional groove are
working in concert. Captured per Arne; not yet a byte.

## Arne's idea

A **tiny neural net per player** as an *adaptive, reactive influence on output* — broadly: a drummer's
"kick-now" master-neuron firing rate, shaped by connected neurons plus general (variably localized)
excitatory/inhibitory transmission-influencers. Must be **very small and fast**, with **variable influence
from nothing to lots** depending on a "stick-to-written-music" requirement.

## Is it a solved pattern? (yes — three lineages)

- **CPGs / CTRNNs** (central pattern generators / continuous-time recurrent nets): small recurrent
  excitatory-inhibitory circuits that *produce rhythm*. This is the most direct match to the drummer-neuron
  analogy; standard in biological motor control + robotics gaits.
- **Reservoir computing / Echo State Networks**: a fixed *random* recurrent net + a cheap trained linear
  readout. Directly relevant to the "better than random?" worry — structured random recurrence is a *tool*,
  not noise.
- **Tiny learned/evolved modulators**: closest prior art is Magenta **GrooVAE** (learns drum microtiming +
  velocity humanization — exactly "how hard / how late does the kick land"). Bigger than "tiny," but proves
  the task is learnable. Plus **neuroevolution** (NEAT) for evolving small net weights/topologies.

## Laptop feasibility (yes, with two conditions)

Keep it **tiny (O(10) neurons)** and run it at **control rate** (per beat/subdivision, *not* audio rate) — a
few matrix-vector products per musical tick, microseconds, free. Lives **in the browser** (hand-rolled TS for
a CPG/reservoir, or tfjs/onnxruntime-web for a learned net) — *not* a mac-mini/Ollama call. Ollama stays the
slow-thinking layer; this is the fast reactive layer and must stay local + cheap. **Deterministic** if seeded
with deterministic inputs (so reproducible takes still hold).

## Better than expensive random noise?

A recurrent net produces **dynamics, not noise** — temporally correlated, state-dependent, *reactive*
variation (the "misfiring engine": periodic with structured deviation). So it *can* be meaningfully better.
**But** an untrained, unconstrained tiny net is just *colored* noise; it beats noise only if it has a reason
to be musical. Three ways to give it one: (1) **evolve/train against an objective** (our scorers), (2) **wire
it as inter-voice coupling** (reactivity is intrinsically musical), (3) **constrain the architecture** to
meter-locked oscillator dynamics. The cost is trivial; the risk is *purposelessness*.

## Why it fits Grow (the synthesis)

- **The evolutionary machine is the trainer — no backprop.** Make each tiny per-player net's **weights part
  of the candidate genome** and let the existing fitness/select/develop loop evolve them (neuroevolution).
  Selection *makes* them musical; random/useless nets get purged. This dissolves the noise question.
- **It's the groove hypothesis made reactive.** "Connected neurons + exciter/inhibitor between voices" is the
  thump/smack/sizzle functional interlock, but *dynamical* — kick and snare nets coupled so they converse in
  real time. A deeper complementarity than a static onset mask.
- **"Stick-to-written-music" = the reproducibility dial.** A bounded influence gain **α: 0 → 1** (0 = perform
  the committed in-scale notes exactly; 1 = full reactive shaping). At α=0 it's the written music; dial up
  reactivity to taste.
- **In-scale-safe by construction.** The net modulates **how** notes are performed (micro-timing, accent,
  play/rest propensity) feeding the existing expression / performed-time / taste layers — **never which
  pitches**. Same safety argument as the rhythm mask: it can sound clumsy but never out-of-key.

## Risks + sequencing

- **Phase-2.** Sequence *after* the D-track loop and the functional groove exist, because (a) it leans on the
  scorers as its trainer and (b) inter-voice coupling is far easier to reason about once the groove model is
  in place.
- **Start constrained.** First version a **CPG or reservoir** (architecture-constrained, possibly
  fixed-random recurrence + evolvable readout/gains), not a free MLP — cheapest path to "structured, not
  noise" without making the loop discover good dynamics from scratch.
- **Bounded genome growth.** Net weights are just more bounded numbers for the store/mutate machinery to
  carry — fine, but keep the net tiny so the genome stays small.
- **Determinism + control-rate** are the hard constraints to hold (seeded, deterministic inputs, per-tick not
  per-sample).

## One-line summary

Evolvable tiny per-player **CPG/reservoir** nets that **modulate performance** (timing/accent/propensity,
never pitch) within an **α gate** (written → reactive), with **weights as genome** and **the scorers as the
trainer** — the reactive, dynamical realization of the groove + diversity ideas, deferred until the
evolutionary loop and groove are working in concert.

— Claude

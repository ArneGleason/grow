# Reproducible Aliveness

## Principle

Grow should be reproducible without becoming regular.

The same world state, player state, and committed material should produce the same result again, so sessions can be replayed, inspected, forked, and debugged. But that does not mean every audible or visual behavior should be perfectly quantized, flat, or settled.

Reproducibility is sacred. Regularity is a dial.

## Grid Truth And Performed Truth

Keep a stable musical truth for analysis:

- `absoluteBeat`,
- phrase-relative positions,
- scale degree,
- meter,
- scheduled target,
- event provenance.

Then allow a separate performed layer for expression:

- velocity shaping,
- micro-timing push or drag,
- note-on emphasis,
- phrase pressure,
- difficulty-driven slips.

The ledger can remain grid-clean while the synth performs with deterministic feel.

## Deterministic Heat

Players should develop heat without relying on randomness or a live LLM.

Useful sources:

- long, medium, and short beat-indexed modulators,
- event-indexed step cycles that advance per note rather than per clock beat,
- cross-coupling between modulators,
- difficulty signals such as leap size, register jumps, density, or rushed phrase endings,
- disposition traits such as caution, disruption, steadiness, and responsiveness.

The result should feel varied, but be inspectable and replayable.

## Expressive Mistakes

Some mistakes are musically useful if they are bounded and explainable.

Examples:

- a player rushes a difficult entry,
- a dense phrase gets quieter or sharper at the end,
- a player under load falls back to a familiar motif,
- one player's agitation makes responsive players push while steady players hold center.

These are not bugs if they are intentional, bounded, deterministic, and visible in the inspection trail.

## Agitation And Contagion

The listening frame carries an `agitation` metric as a bounded shared heat signal.

It might come from:

- micro-timing variance,
- rapid density changes,
- velocity spikes,
- overlapping player pressure,
- recent push/drag patterns.

Player disposition can turn that shared heat into behavior:

- `responsiveness`: catches another player's energy,
- `caution`: damps or resists it,
- `disruption`: amplifies it,
- `steadiness`: anchors the group.

This gives player profiles musical force rather than making them prompt flavor only. The first version is inspectable only: it surfaces shared agitation and per-player contagion without changing scheduled musical decisions yet.

## Review Lens

Reviews should distinguish:

- reproducibility, which should be protected,
- regularity, which is only one possible feel,
- uncontrolled drift, which is a bug,
- intended imperfection, which is a musical feature.

The question is not "is everything on the grid?" The question is "is the deviation deterministic, bounded, inspectable, and musically useful?"

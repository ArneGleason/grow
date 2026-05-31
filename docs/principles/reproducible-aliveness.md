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

## Timing Feel Hierarchy

Timing expression should not read as perpetual stumbling.

The current performed-offset layer proves that notes can move deterministically off the grid, but note-by-note offsets are only the smallest layer of feel. A more musical timing model should separate:

- ensemble tempo drift: slow, shared movement of the whole session's pulse,
- shared groove: a repeating pocket for bar or phrase positions,
- player groove: role-specific placement relative to the shared pocket,
- material pressure: deterministic push or drag from density, leaps, register, or phrase endings,
- occasional stumble: rare, bounded, explainable mistakes or recovery gestures.

When these layers are collapsed into one per-note offset, the ear can hear constant correction instead of a band agreeing on a pocket. Verification can still assert deterministic offsets, but the musical target should be that most notes belong to a coherent groove and only a few notes sound like slips.

Future timing work should make the default offset mostly groove-shaped and persistent across several bars, then add small player-specific deviations and very occasional stumbles. Tempo and groove should be stateful musical surfaces that players can notice, negotiate, and eventually ask the slow-thinking model to revise.

## Groove Maps

Arne's Bitwig tempo-mapping heuristic is a useful design model for Grow timing.

When matching a human performance, a single tempo per bar was not enough. The working method was:

- pin the bar downbeats first,
- divide each bar into eighth-note control points,
- adjust the local tempo between neighboring points so important attacks line up,
- keep the next downbeat pinned so corrections cannot wobble out of control,
- look for repeated or slowly morphing control-point shapes across later bars.

That suggests a better Grow model than independent per-note offsets. A future groove map should describe the shared performed grid as a small set of anchored control points, probably eight per 4/4 bar to start. Notes then schedule against this interpolated performed grid. Player-specific pocket can sit relative to the map, and rare stumbles can sit on top of that, but most timing should feel like a coherent tempo surface rather than many unrelated note delays.

This also gives the players something musical to perceive and discuss:

- "the middle of the bar leans forward,"
- "the last eighth relaxes into the downbeat,"
- "bass is behind the groove map while melody sits ahead,"
- "the map tightens during performance and loosens during rehearsal."

Groove maps should be replayable, inspectable, and eventually storable as part of song or session state.

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

The first behavioral use of this heat should be visual, not musical: room warmth and player halos can make the ensemble's energy legible while the audio/taste loop remains unchanged.

When contagion eventually drives behavior, the loop closes: contagion can create more push, density, or accent, which can create more agitation, which can create more contagion. That future loop should use a musical build/release governor, such as a ceiling with slow decay, rather than relying only on a hard per-frame clamp. Some oscillation is desirable there if it is bounded, visible, and replayable.

## Review Lens

Reviews should distinguish:

- reproducibility, which should be protected,
- regularity, which is only one possible feel,
- uncontrolled drift, which is a bug,
- intended imperfection, which is a musical feature.

The question is not "is everything on the grid?" The question is "is the deviation deterministic, bounded, inspectable, and musically useful?"

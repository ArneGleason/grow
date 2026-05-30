# Session Modes and Breaks

## Core Principle

Grow is not a nonstop music generator.

The point is not to fill every second with pleasant output. The point is to let players move through rounds of constructed, directed, improvised, rehearsed, paused, and performed musical activity.

Silence, breaks, disagreement, solo practice, waiting, and re-entry are part of the musical world.

## Session Types

### Idle / Ambient Between Sessions

The terrarium can be alive without producing constant music.

Players may:

- wander,
- listen,
- rest,
- think,
- inspect instruments,
- remember recent material,
- prepare privately,
- gather near other players.

This is not meant to be a wind-chime mode. If sound happens here, it should be sparse, local, and purposeful.

### Solo Practice

A player can break away and work independently.

This can include:

- testing a phrase,
- practicing a rhythm,
- shaping a tone,
- trying a variation,
- developing a motif,
- preparing for a future session.

Solo practice should be allowed to happen away from the main group and should not automatically become part of the shared performance.

### Working Session / Rehearsal

Players deliberately try to work something out together.

This can include:

- choosing or negotiating tempo,
- trying roles,
- repeating a section,
- simplifying a part,
- stopping to revise,
- letting one player demonstrate something,
- building a shared motif or form.

The rehearsal mode can stop and restart often. It should not pretend to be a polished performance.

### Performance Session

Players attempt to perform an organized work.

The work may be:

- fully improvised around a theme,
- partly structured,
- a known saved piece,
- a recently rehearsed form,
- a loose agreement such as "three players perform song X for its intended duration."

Not every player needs to agree or participate. Some may sit out, join late, resist, or continue solo practice elsewhere.

### Reflection / Cooldown

After a rehearsal or performance, players can stop and process what happened.

This can include:

- short reactions,
- deciding what to keep,
- marking a best moment,
- saving a motif,
- choosing whether to rehearse again,
- dispersing into break or solo practice.

## Breaks Inside Music

Breaks can happen within rehearsals and performances.

A player may need to stop playing to:

- think of an improvisation,
- prepare a difficult entrance,
- rest,
- listen more carefully,
- wait for a cue,
- avoid overcrowding the texture,
- return at a better musical moment.

The system should not treat absence as a failure. A player who is silent may still be active in the world.

## Pieces and Future Playback

Players can eventually construct reusable works.

A piece can be:

- a saved motif,
- a role plan,
- a chord/mode/rhythm framework,
- a phrase collection,
- a performance arrangement,
- a set of cue points and improvisation rules.

"Let's play song X" means players attempt a known structure for an intended duration, with room for improvisation and individual agreement/disagreement.

## Temperature

Grow can move between temperatures:

- Low temperature: resting, listening, wandering, sparse solo practice.
- Medium temperature: rehearsal, negotiation, motif development.
- High temperature: focused performance, dense improvisation, coordinated experiment.

Temperature is not just volume or density. It describes how directed, socially engaged, and musically active the space is.

## Design Implications

- The app should have explicit session state, not just a global play button.
- Continuous fallback grooves should be optional and bounded.
- The producer should be able to start, stop, pause, resume, rehearse, perform, or let players disperse.
- Lookahead buffers can drain or refill during breaks.
- Best-moment capture should prefer bounded sessions and marked moments, not endless ambient history.
- Persistence should record session boundaries, mode changes, and piece/performance attempts.

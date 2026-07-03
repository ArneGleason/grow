# Musical Direction Reset: Real Variation Before Feedback

Date: 2026-07-03

Arne's current listening read is that the material is still too thin and same-sounding for feedback to be useful. E1 made the bass answer the melody, E2 added audible answer color, E3a made voting clearer, and E3b widened deterministic starter-material profiles. Those are useful pieces, but the listening experiment still lacks a strong enough musical search space: new songs do not yet feel like genuinely different musical propositions.

That means the next useful move is not another voting or scoring byte. Pause feedback aggregation until the generator can create alternatives a listener can distinguish without hunting in the inspector.

## Working Diagnosis

- The current player roles still occupy a narrow palette: pulse, bass, and melody remain close cousins in sound and behavior.
- Starter-material profiles change rhythm, contour, and register, but they do not yet create enough contrast in form, harmonic rhythm, timbre, texture, or instrumental identity.
- Human-ear votes become noisy if each "new" song is a small variation on the same loop grammar.
- Musical expression is currently mostly note choice, velocity, timing, chromatic answer color, and a few UI-level switches. The players do not yet have expressive instruments that let them phrase differently.

## Direction To Ask Claude For

Ask Claude to act as architect/listening lead before the next implementation byte. The desired output is not a code patch; it is a short musical architecture recommendation that can become the next small byte.

The recommendation should answer:

- What is the smallest next change that would make generated songs feel meaningfully different by ear?
- Should the next byte focus on expressive instruments, richer song/form variation, player roster/role variation, or a combined minimum slice?
- What instrument surfaces should the players get first so they can express more than pitch and velocity?
- Which musical safety rails should stay on the code, and which musical rails should come off so the output can become more interesting?
- What should Arne listen for as the acceptance test?

## Expressive Instrument Questions

Claude should consider instrument identity as part of the next architecture, not cosmetic sound replacement.

Possible first-class instrument controls:

- Melody: attack/release shape, legato versus pluck, glide/portamento, vibrato depth, brightness, breath/noise, occasional bends.
- Bass: mute/open articulation, slide into notes, pluck strength, round versus growl tone, sustain length, ghost notes.
- Pulse: kick/snare/hat-like layers, open/closed ticks, accent pattern, sparse versus busy subdivisions, small fills.
- Shared: player-specific timbre palettes, phrase-level articulation, per-section energy, and deterministic expressive gestures that route through existing lookahead/event metadata.

The question is not "which synth preset sounds nicer?" The question is how player expression becomes audible enough that pulse, bass, and melody feel like different participants with different bodies.

## Constraints For The Next Byte

- Keep the existing scheduler/lookahead path unless Claude explicitly identifies a blocker.
- Keep deterministic replay and inspectable state.
- Do not resume vote training until generated alternatives are musically distinct by ear.
- Avoid broad model-authored note generation as the next step unless the architecture explains the validator/scorer/listening boundary.
- It is acceptable for music to become riskier: timbre, dissonance, roughness, silence, density changes, and imperfect phrases are allowed if the code path stays bounded and reviewable.

## Listening Acceptance

The next implementation should pass an ear test before it is called done:

> Create or switch between several generated songs and hear distinct musical identities without opening Inspect.

If the difference is only visible in tags, scores, or logs, the byte has not solved the current problem.

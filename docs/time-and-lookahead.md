# Time, Lookahead, and Player Thinking

## Core Idea

Grow does not need to be a hard real-time agent system.

The musical performance should be real-time once it is playing, but the thinking that creates upcoming material can happen ahead of the audible moment. Players can observe, deliberate, prepare, commit musical material, and then perform it later against the shared transport.

This turns Ollama latency into part of the musical world instead of treating it as a bug.

## Clocks

Use three different notions of time:

- Wall-clock time: what the app and user interface are doing right now.
- Playback time: the musical transport position currently being heard and seen.
- Planning time: the future window players are preparing.

Playback time can intentionally trail planning time. The user watches and hears a committed performance window, while players think about upcoming bars.

## Delayed Now

The terrarium's "now" can be slightly delayed relative to raw computation.

For example:

- The visible/audible performance is playing bars 17-24.
- Players are observing bars 13-20 and preparing bars 25-32.
- Ollama calls, rule decisions, validations, and synchronization all happen before the prepared material becomes audible.

This resembles a streaming buffer, rehearsal buffer, or lookahead sequencer more than a live low-latency instrument.

## Lookahead Buffer

Start with a modest musical lookahead:

- Rule-based prototype: 1-2 bars of scheduled material.
- Ollama-assisted prototype: 4-8 bars of scheduled material.
- Slow-model mode: 10-20 seconds of planned material, depending on tempo and model latency.

The system should track buffer health:

- Healthy: enough committed bars are ready to play.
- Thin: playback continues, but players should prepare simpler material or rule-based fallback patterns.
- Empty: the terrarium can pause, show a "thinking" or "rehearsing" state, and resume when the lookahead refills.

Pauses are acceptable if they are presented as part of the experience rather than as a frozen app.

## Player Thinking

Visible participants should be called players or musicians in the product language. "Agent" can remain an implementation term for the reasoning layer.

Players can have explicit non-playing states:

- listening,
- thinking,
- rehearsing,
- practicing alone,
- waiting for a cue,
- resting,
- committing a phrase,
- performing.

This gives local reasoning latency a musical interpretation. A player can stop, listen for a few bars, prepare something, then re-enter in time.

## Scheduling Rule

Players should not directly play raw model output into the current audio frame.

Instead:

1. Observe a recent history window.
2. Propose a future intent, phrase, role change, or response.
3. Validate and quantize the proposal.
4. Commit it into the lookahead buffer.
5. Tone.js schedules the committed material at musical boundaries.

If an LLM response arrives too late for its target bar, retarget it to a later bar or discard it. Never let late reasoning break the transport.

## Fallbacks

Rule-based material is not only a prototype scaffold. It should remain a fallback behavior:

- Keep a pulse going while players think.
- Let bass or texture continue a safe pattern while a new phrase is pending.
- Use silence/rest as a deliberate musical choice, not as an error state.
- Let players re-enter on bar boundaries.

## Implications

- Ollama decisions can be slow and still musically useful.
- The first prototype should prove stable scheduling and stop/restart behavior before LLM calls exist.
- Persistence should record both when a decision was made and when it was scheduled to perform.
- Best-moment replay should replay committed musical events, not attempt to reproduce raw inference timing.
- Producer instructions can land as future cues: "next section, get sparser" rather than "change this millisecond."
- Breaks between sessions can refill lookahead and let players work independently instead of forcing continuous output.

# Producer Proxy

## Core Idea

The human does not need to operate Grow only through structured controls.

The human can type ordinary language, and a producer proxy interprets that instruction as an in-world participant. The proxy moves, addresses players, negotiates, cues, interrupts, or reframes on the human's behalf.

This keeps the producer on more equal footing with the players: the instruction enters the terrarium as a participant action rather than as an omnipotent external setting.

Example instruction:

```txt
Go over to player X and tell them to stop making that terrible racket and find something that fits better with player Y.
```

The producer proxy might turn that into:

- move near player X,
- address player X,
- refer to player Y's current role or motif,
- ask for less density or a different register,
- schedule the request as a future cue,
- wait for player X's response,
- report back or adjust if player X resists.

## Visual Form

Start simple.

First representation:

- a distinct dot or small marker,
- a clear producer color,
- a subtle ring or halo so it reads differently from players,
- visible movement through the same top-down space,
- text or intent bubble when carrying an instruction.

Over time, the producer proxy can gain more character:

- color modulation based on urgency or mood,
- pulse animation while interpreting a prompt,
- trail or attention line toward a target player,
- icon/shape changes for listening, speaking, cueing, or waiting,
- visual signs of the current instruction being carried.

The first version should not spend too much design effort on character. It should be legible and clearly distinct.

## Interpreter Role

The producer proxy needs an interpreter agent.

Input:

- human natural-language prompt,
- current session mode,
- player positions and roles,
- recent musical events,
- current tempo/key/mode,
- known player tendencies and recent responses,
- lookahead buffer state.

Output should be declarative and validated:

- target player or group,
- movement goal,
- message or cue,
- intended musical effect,
- urgency,
- scheduled time window,
- fallback if ignored or resisted.

The interpreter should not directly control audio or arbitrary state. It proposes actions in the same safe-action style as player reasoning.

## Equal-Footing Constraint

The producer proxy should influence, not magically override.

It can:

- ask,
- suggest,
- cue,
- nudge,
- conduct,
- mark a moment,
- propose a session mode,
- request a piece or motif,
- tell a player to stop, simplify, or fit another player better.

Players can:

- comply,
- partially comply,
- ask for clarification,
- resist visibly and musically,
- delay until the next section,
- ignore once,
- propose an alternative.

Resistance must remain bounded and legible. It should produce visible or audible behavior rather than feeling like the app ignored the human.

## Prompt-To-Action Flow

1. Human types a prompt.
2. Producer proxy enters an interpreting/thinking state.
3. Interpreter turns the prompt into one or more proposed world actions.
4. The app validates the actions.
5. The proxy moves or speaks in the world.
6. Players perceive the cue according to distance, attention, session mode, and role.
7. Responses are scheduled into future bars through the lookahead model.
8. The event log records the prompt, interpreted action, player reactions, and outcome.

## First Implementation

Do not add the producer proxy in the very first playable slice.

Add it after the rule-based terrarium can already show and sound like three players in a bounded space.

First producer milestone:

- Type a prompt in a text box.
- Producer marker appears or moves to a target player.
- Prompt is shown as a world event.
- A simple rule-based interpreter maps a few commands to visible cues.
- No LLM required yet.

Later:

- Use Ollama to interpret open-ended producer prompts.
- Let the proxy decide target, tone, and timing.
- Let players respond through the same delayed-now lookahead model.

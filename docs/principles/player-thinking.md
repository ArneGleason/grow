# Player Thinking

## Principle

Players should be able to form musical intentions before the producer exists.

The local LLM should act like a slow creative planning layer, not a live instrument and not a general-purpose narrator. It receives compact, structured requests from players and returns small, validated musical intentions that the app can translate into future material.

## Layers

### Disposition

Each player should have stable traits that affect how it listens and what it tends to try.

Examples:

- sparse vs dense,
- steady vs restless,
- supportive vs disruptive,
- simple vs ornate,
- cautious vs risk-seeking,
- repetition-loving vs novelty-seeking.

These can begin as ordinary numeric or tagged profiles and should be persisted once persistence exists.

### Backstory Fragments

Players can carry small evocative memory fragments that color their choices.

These are not full simulated biographies. They are prompt ingredients that make musical decisions feel less generic:

- "worked as a machinist in a hot-water fabrication plant",
- "learned melody from broken elevator chimes",
- "likes storms because they hide uneven rhythm",
- "trusts bass more than bright sounds."

The system should select only a few fragments per thought so prompts stay small.

### Subconscious Context Blender

Before asking the LLM, deterministic code should assemble a compact thought request.

It can choose:

- the recent listening-frame facts,
- the player's current taste evaluation,
- one or two relevant backstory fragments,
- a recent motif or rhythmic cell,
- a target horizon, such as "next 4 bars",
- allowed action types,
- a random seed or temperature hint.

This step is heuristic and reviewable. It is where player disposition becomes a prompt without needing the LLM to remember the entire world.

### LLM Creative Planner

The LLM returns a bounded musical intent, not raw audio and not arbitrary code.

The intent should be small enough to validate:

- rest or enter,
- simplify,
- vary a motif,
- answer another player,
- shift density,
- change register,
- propose a rhythm cell,
- propose scale-degree material,
- disrupt for a bounded duration.

The app validates and compiles this intent into scheduled material. If the response is late, invalid, or too expensive, the player keeps rule-based fallback behavior.

## Protocol Shape

Prompt the LLM with a session primer and short player thought requests.

The primer should define:

- the output schema,
- the allowed action vocabulary,
- the current musical primitives,
- the rule that responses must be short and actionable,
- the rule that the app may reject or retarget anything late.

Each request should include:

- player id and role,
- disposition summary,
- selected backstory fragments,
- recent listening-frame summary,
- current or recent motif,
- desired planning horizon,
- constraints such as scale, meter, density, and allowed actions.

The response should be structured JSON or another strict parseable format.

## Timing

Assume a thought can take 10-60 seconds.

That is acceptable if:

- playback does not block,
- the player can appear to be listening, thinking, resting, or practicing,
- returned material targets a future bar,
- late material is retargeted or discarded,
- rule-based fallback continues to work.

The first target should be modest: make one player occasionally produce one useful future variation within roughly 10-15 seconds on the local Ollama model, while still behaving acceptably if it takes longer.

## Reviewability

Every LLM thought should leave an inspectable trail:

- request summary,
- selected memory fragments,
- raw model response or parse failure,
- validated intent,
- scheduled result,
- latency and target beat,
- reason if discarded.

This keeps player creativity from becoming invisible magic.

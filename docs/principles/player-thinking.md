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

## Prompt Protocol Adapters

Grow should keep one canonical internal thought contract while allowing multiple model-facing prompt protocols.

The stable contract is:

```text
PlayerThoughtRequest -> PlayerThoughtIntent -> validator -> scheduler/fallback
```

Prompt protocols are adapters around that contract. A protocol can present the same request as projected JSON, a compact music card, split protocol/request cards, or another future shape, but it must return something that normalizes into the same `PlayerThoughtIntent` validator.

This matters because local models vary in what they tolerate. A compact card may be fastest for one model, while another model may need a clearer JSON projection to preserve required fields. The model landscape will keep changing, so Grow should be able to test and cache model/protocol pairings without changing musical behavior.

First adapter set:

- `projected-json`: default safe protocol with only validation-critical request fields. Implemented first for the manual Ollama probe.
- `music-card`: compact musical line protocol, useful when a model preserves required fields.
- `split-cards`: protocol card plus request card, experimental.
- `full-json`: debug/reference only, not a production default.

Protocol selection should be calibrated outside the performance loop. A small bakeoff can run fixed thought fixtures across installed models and protocols, score parse success, validation success, latency, and compactness, then remember the best model/protocol pairing. During playback, Grow should use the cached pairing and keep deterministic fallback active.

## Musical Exchange Markup

Players need a compact way to include what they are playing or hearing.

Do not pass raw audio to the LLM in the first version. Pass symbolic excerpts:

```ts
type MusicalExcerpt = {
  label: string;
  origin: "self" | "heard" | "imagined" | "group";
  bars: number;
  meter: [number, number];
  mode: string;
  events: Array<{
    beat: number;
    durationBeats: number;
    scaleDegree?: number;
    octave?: number;
    velocity?: number;
    kind: "note" | "rest" | "accent" | "gesture";
  }>;
  tags: string[];
};
```

This markup should be dense enough for the LLM to reason about contour, rhythm, repetition, density, and role, but small enough to fit inside a quick thought request.

Players can send:

- a current self excerpt,
- a heard excerpt from another player,
- a group excerpt from the listening frame,
- an imagined draft they want help developing.

## Request Levels

Not every thought should ask for the same depth of reasoning.

### In-Song Short Thought

Use while playback is active.

Target:

- 1-4 bars,
- small variations,
- rests,
- register shifts,
- density changes,
- short answers to another player.

Response should be very small and quickly actionable.

### Influence Or Reference Probe

Use when a player wants to draw on an influence, genre, remembered piece, or personal association.

Example request shape:

> Given this phrase and my taste for jagged low patterns, is there a technique from early dub, gamelan interlock, or my "hot-water fabrication plant" memory that suggests a usable move?

The response should describe a transferable technique, not copy a melody or directly imitate a specific living artist. Good answers are things like:

- use staggered echoes,
- thin the downbeat and answer on the offbeat,
- turn a contour into a call-and-response cell,
- borrow a rhythmic density idea,
- make the bass imply the missing pulse.

The app still receives a bounded intent that it can validate.

### Songcraft Or Piece Planning

Use during a songwriting or rehearsal-planning phase.

A player can bring a song idea to the group:

- a motif,
- a role plan,
- a section idea,
- a cue structure,
- a suggested form,
- a question for other players.

Other players can respond with their own excerpts, objections, support parts, or variations. This is slower than in-song thinking and may produce reusable piece data rather than immediate playback.

### Reflection Or Memory Digest

Use after a rehearsal or performance.

The goal is not to generate new notes immediately. It is to decide what to keep:

- a motif worth preserving,
- a best moment candidate,
- a failed idea to avoid,
- a relationship between players,
- a future prompt seed.

## Response Levels

The LLM can return different intent classes, but each must stay actionable.

Examples:

- `play_intent`: a short future musical action.
- `variation_intent`: transform an excerpt.
- `influence_note`: an abstract technique plus a small musical application.
- `song_sketch`: a candidate motif/form/role plan for group work.
- `memory_note`: a compact memory fragment to preserve for future thoughts.

Every response should include enough rationale to inspect, but not enough prose to become the product.

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

# Subjective Taste

## Principle

Judgments like good, bad, boring, neat, crowded, or exciting should come from player temperaments applied to shared listening frames.

They should not come directly from a raw FFT, and they should not be globally objective.

## Why

Two players can hear the same performance differently:

- one likes repetition, another wants novelty,
- one likes sparse space, another likes density,
- one likes bright transient sounds, another prefers soft low movement,
- one likes following the pulse, another likes disrupting it.

This creates musical personality without requiring heavy human psychology.

## MVP Taste Profile

A first player taste profile can be simple:

```ts
type TasteProfile = {
  likesDensity: number;
  likesRepetition: number;
  likesBrightness: number;
  likesConsonance: number;
  likesRhythmicStability: number;
  likesNovelty: number;
  spacePreference: number;
};
```

Values can begin as `0..1` numbers and stay deterministic. Randomness can come later.

## First Uses

Taste should first influence small choices:

- rest or play,
- sparse or dense pattern,
- low or high register,
- support or contrast another player,
- keep repeating or introduce variation,
- simplify after the mix becomes crowded.

Taste should not initially create long essays, social drama, or hidden mood systems.

## Reviewability

Every subjective judgment should be inspectable enough to debug.

For example:

```ts
type PlayerEvaluation = {
  playerId: string;
  frameId: string;
  summary: "too crowded" | "stable" | "boring" | "interesting";
  reasons: string[];
  nextBias: "rest" | "support" | "contrast" | "simplify" | "vary";
};
```

The exact labels can change. The important rule is that the system should be able to explain why a player reacted.


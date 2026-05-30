# Listening Model

## Principle

Players should hear structured musical behavior before raw audio features.

Grow controls the instruments, scheduler, transport, and world events. That means the system does not need to infer all musical meaning from raw sound. It can carry intent and performance metadata alongside the audio, then use lightweight audio analysis as a reality check.

This avoids starting with a brittle timbre-classification problem where frequency buckets approximate a source but miss the musical gesture, role, or intention.

## Hearing Layers

### 1. Intent Layer

What a player meant to do before sound happens:

- role,
- phrase or pattern,
- target register,
- density,
- tension level,
- instrument or effect choice,
- intended relationship to another player.

This is the closest thing to a player's musical thought becoming shareable.

### 2. Performance Layer

What actually gets committed to the shared timeline:

- notes,
- rests,
- effect gestures,
- phrase start and end,
- velocity,
- scheduled beat or bar,
- player id,
- instrument id.

This layer should be the first durable source for listening, replay, and later persistence.

### 3. Audio Feature Layer

What the rendered sound seems to be doing in the mix:

- loudness,
- silence ratio,
- low/mid/high energy,
- brightness,
- transient density,
- rough pitch or chroma later,
- clipping or overload warnings.

This layer should start small. It should help players notice "too loud", "too dense", "bright", "thin", or "silent" before it tries to recognize complex sources like guitar, voice, or room tone.

## MVP Listening Frame

A first listening frame can summarize recent musical time without pretending to understand every waveform detail:

```ts
type ListeningFrame = {
  timeWindow: {
    fromBeat: number;
    toBeat: number;
  };
  tempo: number;
  meter: [number, number];
  mix: {
    loudness: number;
    silenceRatio: number;
    lowEnergy: number;
    midEnergy: number;
    highEnergy: number;
    brightness: number;
    transientDensity: number;
  };
  players: Array<{
    id: string;
    role: string;
    state: "silent" | "playing" | "thinking";
    recentEvents: MusicalEvent[];
    density: number;
    register: "low" | "mid" | "high";
    tags: string[];
  }>;
};
```

The first implementation can leave `mix` as measured zeros or a tiny placeholder until Web Audio analysis is added. The important early foundation is that musical events exist and can be summarized.

## Early Implementation Implication

Before adding many players, Grow should add:

- a shared `MusicalEvent` type,
- an in-memory recent-event ledger,
- a summarizer that can produce a listening frame for the last 1-2 bars,
- a dev hook or debug panel that exposes the current listening frame.

This should happen before players become complicated. It gives future players something explicit to listen to.

## Deferred

Defer these until the event and listening-frame model is useful:

- source separation,
- raw audio instrument recognition,
- guitar-like timbre reconstruction,
- harmonic partial tracking,
- machine-learning audio classification,
- expensive long-window spectral analysis.

Those may become useful later, but they are not the first path to musical understanding in Grow.


# Inner Music

## Principle

Players should eventually distinguish between imagined music, committed music, and heard music.

A player can have a tune "in its head" before it makes sound. In Grow, that should begin as private symbolic material, not as private rendered audio.

## Three States

### Imagined

The player is privately drafting a phrase, rhythm, role change, or effect gesture.

This can be represented as symbolic data:

- notes or scale degrees,
- rhythm cells,
- rests,
- target density,
- intended register,
- relationship to another player.

### Committed

The player has chosen to perform the material and scheduled it into the future timeline.

Committed material becomes visible to the world through musical events and the lookahead buffer.

### Heard

The player receives the shared listening frame after material is performed.

This lets the player compare:

- what it imagined,
- what it committed,
- what the world sounded like after everyone else played too.

## MVP

The first version does not need private audio audition.

Start with symbolic drafts and commitments:

```ts
type PhraseDraft = {
  playerId: string;
  role: string;
  beats: number;
  events: MusicalEvent[];
  tags: string[];
};
```

Later, a player can audition a draft through the same synth engine before committing it, but that should wait until the visible shared loop is fun.

## Design Risk

Do not make inner music invisible magic.

If a player is thinking or drafting, the UI should eventually show a simple state, such as `thinking`, `practicing`, or `auditioning`, and the dev tools should expose enough draft metadata for review.


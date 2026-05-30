# Future Multi-Terrarium / Band Exchange

## Current Decision

Grow starts as a solo local instrument.

Do not build multi-user collaboration or multiple active terrariums in the first implementation phases.

## Future Direction

Leave architectural room for more than one terrarium space, or more than one "band," to exist in the same local project.

Possible future behavior:

- Switch between two terrariums or bands.
- Let one band become an audience for another.
- Let a band observe another band's performance.
- Let players draw inspiration from another group.
- Let groups respond with applause, critique, imitation, heckling, or musical counterpoints.
- Bring two spaces into temporary contact for a shared session.

This should be treated as a later experiment, not a core requirement.

## Design Constraints

- The first implementation should remain one active terrarium.
- Avoid coupling player logic to a global singleton world.
- Prefer IDs such as `space_id`, `world_id`, or `band_id` in future persistence where cheap.
- Keep session artifacts portable enough that one session could later be shown to another group.
- Do not add UI for banking between bands until the single-terrarium loop is fun.

## Possible Data Concepts

Future persistence may distinguish:

- `space`: a bounded terrarium environment.
- `band`: a group of players with shared history.
- `session`: a bounded rehearsal, performance, solo practice, or reflection period.
- `exchange`: an interaction where one space/band observes or responds to another.

The current SQLite target already has `worlds`; that can become the eventual container for one or more spaces if needed. The first implementation can ignore this.

## Why Keep It In Mind

This direction could affect:

- event ownership,
- session export format,
- audience reactions,
- replay of another group's performance,
- future inspiration/cross-pollination mechanics.

For now, just avoid assumptions that there can only ever be one terrarium in all saved data.

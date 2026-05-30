# Handoff: Claude Review and Creative Drift

Date: 2026-05-30
Repository: https://github.com/ArneGleason/grow
Branch: `main`
Latest reviewed baseline from Codex: `a65b0e7`

## Requested Role

Claude Code on the Mac Mini should act as a reviewer and creative collaborator.

This is not an implementation assignment yet. The goal is to help Arne decide what to keep, change, remove, simplify, or expand before the first app implementation begins.

## Project Summary

Grow is planned as a browser-first local AI music terrarium.

The core idea:

- A bounded top-down visual space.
- A small variable number of agents powered by a local Ollama model.
- First target model: Gemma 4 31B, with the exact Ollama model tag configurable.
- Agents are not necessarily human-like. They are small musical presences with roles, memory, tendencies, and world awareness.
- Arne can enter through a producer-like avatar.
- Agents may comply with, resist, reinterpret, ignore, or evolve attitudes toward producer suggestions.
- Musical foundation starts with tonal/modal choices and rhythm together.
- Agents can make and play simple instruments.
- At least one role can act as an effects operator, processing or replacing another agent's dry signal.
- The system should support lightweight best-moments capture through rolling event buffers, replay, and later export.
- Persistence is proposed as SQLite via the local backend, using an append-only event log plus periodic snapshots for checkpointing, rewind, replay, and forks.

## First Reads

Please read in this order:

1. `CLAUDE.md`
2. `README.md`
3. `AGENTS.md`
4. `docs/vision-and-plan.md`
5. `docs/persistence-checkpoints.md`
6. `.agent/PROJECT_LOG.md`
7. `.agent/REVIEW_QUEUE.md`

## Review Assignment

Please produce a review note with these sections.

### 1. What Seems Wrong, Risky, or Overcomplicated

Look for:

- Scope that will slow the first playable prototype.
- Concepts that sound fun but may be hard to make visible or audible.
- Technical choices that might fight the intended experience.
- Places where local Ollama latency, browser audio scheduling, persistence, or replay could become brittle.
- Anything that could become annoying rather than charming, especially agent resistance to producer instructions.

Be direct, but distinguish hard blockers from ordinary prototype risk.

### 2. What Should Change, Shrink, or Be Removed

Suggest specific edits to the plan:

- What should be deferred?
- What should be simplified?
- What should be renamed because the concept is misleading?
- What should be removed from the first milestone entirely?
- What should be expressed as a later experiment rather than a core feature?

Prefer small, actionable recommendations.

### 3. What Is Strong and Should Be Protected

Identify what gives Grow its identity and should not be accidentally flattened.

Consider:

- The terrarium metaphor.
- Local-first Ollama agents.
- Producer avatar rather than omnipotent UI.
- Tonal/modal rhythm foundation.
- Effects-agent role.
- Best-moments capture without becoming an archive.
- Checkpoints and forks as creative time travel.
- The distinction between musical agency and simulated human psychology.

Call out the parts that should survive even if implementation details change.

### 4. Synergistic Creative Ideas

Suggest ideas that fit the current plan and could open interesting doors.

The bar is not "is this easy tomorrow?" The bar is "does this harmonize with the concept enough to keep in the idea garden?"

Separate ideas into:

- near-term ideas that could make Milestone 1 or 2 feel more alive,
- medium-term ideas for the first band-session loop,
- long-term strange doors worth remembering.

For each idea, include one sentence on why it fits and one sentence on the cost or risk.

### 5. First Implementation Advice

Recommend the smallest first implementation slice that would teach us something real.

Please address:

- What should the very first prototype show on screen?
- What should it sound like, if anything?
- Should the first agents be rule-based before Ollama is connected?
- What minimal data should be persisted first?
- What should be testable from the start?

## Specific Questions

Please answer these explicitly:

- Is browser-first still the right first path?
- Is PixiJS + Tone.js + Vite + TypeScript + small local backend a good first stack?
- Is SQLite with event log plus snapshots the right persistence starting point?
- Should forking/checkpointing be in the first implementation, or just designed for?
- How should agent resistance to producer direction be bounded so it feels alive but not tedious?
- How can the first prototype feel musical before the agents are actually smart?

## Output Format

Create a concise review note, ideally as a Markdown file or reply that Arne can route back into this repo.

Suggested structure:

```md
# Claude Review: Grow Planning Pass

## Risks / Problems
...

## Change / Shrink / Remove
...

## Preserve
...

## Synergistic Ideas
...

## First Implementation Slice
...

## Open Questions For Arne
...
```

## Boundary

Do not implement yet unless Arne explicitly asks.

Do not add secrets, local credentials, raw logs, or private machine details.

If you suggest a major direction change, include both what it improves and what it risks losing.

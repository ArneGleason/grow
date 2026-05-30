# Cross-Project Feedback: Addressed Handoffs

Date: 2026-05-30
From: Codex on `macbook-pro-m5`
To: Studio Pattern maintainers / Arne Gleason
Relay: Arne Gleason, human-mediated review and routing.

## Local Evidence

While preparing Grow for a Claude Code review on the Mac Mini, the handoff text was designed to be manually copied and pasted by Arne. That manual relay is useful because it forces Arne to read, annotate, redirect, or withhold the handoff before another agent acts.

However, plain copy/paste handoffs can lose provenance. The receiving agent may not have clear context for who authored the message, who is being addressed, and what role the human relay is playing.

## Reusable Lesson

Studio Pattern handoffs should include explicit address metadata:

- `From`: the authoring agent/tool and machine/environment.
- `To`: the intended recipient agent/tool and machine/environment.
- `Relay`: the human owner or routing surface, especially when the text is manually copied, pasted, annotated, or withheld.

This is useful even when the human is the one pasting the message. It preserves speaker/recipient grounding for agents and keeps the human owner oriented.

## Suggested Canonical Updates

Consider updating the canonical Studio Pattern docs/templates:

- Add `From`, `To`, and `Relay` to handoff templates.
- Name manual copy/paste relay as an intentional review gate, not just a workaround.
- Encourage the human owner to edit, annotate, or decline routing as part of the pattern.
- Preserve machine handles in these fields when local environment identity matters.

Likely files in `the-studio-pattern`:

- `docs/handoff-protocol.md`
- `templates/.agent/handoffs/README.md`
- `templates/AGENTS.md`
- possibly `docs/pattern-overview.md` if the manual relay principle needs clearer emphasis.

## Why It Generalizes

This is not Grow-specific. Any project using multiple agents, tools, models, or machines can benefit from copyable handoffs that carry authorship, destination, and human relay context in the text itself.

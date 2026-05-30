# Suspend Workflow

Use this before pausing work or handing the repo to another participant.

1. Run the project's validation commands.
2. Check `git status --short --branch`.
3. Inspect the intended diff scope.
4. Update `LOCAL_DEV_NOTES.md`, `.agent/PROJECT_LOG.md`, and `.agent/REVIEW_QUEUE.md` as needed.
5. Update `.agent/session.json`.
6. Create a handoff in `.agent/handoffs/` when another participant needs context.

# Resume Workflow

Use this when resuming work in Grow.

1. Read `README.md`, `AGENTS.md`, and `LOCAL_DEV_NOTES.md`.
2. Read `.agent/session.json`.
3. Check `.agent/PROJECT_LOG.md` and `.agent/REVIEW_QUEUE.md`.
4. Read the latest handoff in `.agent/handoffs/`, if one exists.
5. Run:

```sh
git status --short --branch
find . -path ./.git -prune -o -maxdepth 3 -type f -print | sort
```

6. Update `.agent/session.json` when the resumed task meaningfully changes state.

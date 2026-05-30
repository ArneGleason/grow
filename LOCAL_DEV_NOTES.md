# Local Developer Notes

This is the living memory file for local workflows. Add commands, ports, setup notes, deployment details, and gotchas when they become useful more than once.

## Studio Pattern Source

- Version/date: `2026-05-30 initial scaffold`
- Source repository: `https://github.com/ArneGleason/the-studio-pattern`
- Source commit: `dbbe3e9`
- License: `CC BY-SA 4.0`
- Local adaptation: early Grow project scaffold with GitHub connection notes; product scope and runtime stack are still TBD.

## Local Environment

- Machine handle: `macbook-pro-m5`
- Primary agent/tool here: `Codex`
- Local checkout: `/Users/arnegleason/Documents/Grow`
- Possible standard repo home: `/Users/arnegleason/code/github.com/arnegleason/grow`, if the human owner chooses to move this checkout later.

Machine handles are assigned by the human owner. Do not treat OS hostname, username, serial number, or network name as canonical unless the human explicitly maps it here.

## Setup

No runtime stack has been selected yet.

```sh
# TBD
```

## Run

```sh
# TBD
```

Default URL:

```txt
TBD
```

## Validate

```sh
git status --short
find . -path ./.git -prune -o -maxdepth 3 -type f -print | sort
```

## Test

```sh
# TBD
```

## GitHub Repo Setup

Remote:

```txt
origin https://github.com/ArneGleason/grow.git
```

Check local GitHub CLI authentication:

```sh
gh auth status
```

After the human owner confirms slug and visibility, create and connect the remote. Example:

```sh
gh repo create arnegleason/grow --source=. --remote=origin --private
git push -u origin main
```

Use `--public` instead of `--private` only after visibility is confirmed.

## GitHub App/API Connection

See `docs/github-setup.md` before adding tokens, OAuth credentials, webhook secrets, or GitHub App keys.

## Testability Standards

For software projects, record the testing conventions that future agents should preserve:

- Stable selectors or test IDs: TBD.
- E2E state setup and teardown: TBD.
- Page readiness and realtime waits: TBD.
- Shared fixtures/helpers: TBD.
- Visual regression entry points: TBD.

## Studio Pattern Commands

Show current state:

```sh
git status --short --branch
```

Create a handoff:

```sh
# TBD
```

Suspend work:

```sh
# TBD
```

Resume work:

```sh
# TBD
```

## Operational Notes

- GitHub remote is configured as `origin` and tracks `main`.
- No committed secrets should be added. Use `.env.local` for local-only credentials.

## Known Gotchas

- Runtime stack, package manager, ports, deployment target, and GitHub integration model are still undecided.

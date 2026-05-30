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

Install pinned dependencies:

```sh
npm install
```

## Run

```sh
npm run dev
```

Default URL:

```txt
http://127.0.0.1:5173
```

## Validate

```sh
npm audit
npm run build
npm run smoke
git status --short --branch
git ls-files --cached --others --exclude-standard | sort
```

## Test

```sh
npm run build
npm run smoke
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

- Stable selectors or test IDs: Byte 3 exposes `transport-toggle`, `transport-status`, `terrarium-container`, `terrarium-canvas`, `player-list`, `player-pulse-*`, `player-bass-*`, `player-melody-*`, `listening-event-count`, `listening-window`, and `listening-latest-event`.
- E2E state setup and teardown: TBD.
- E2E smoke command: `npm run smoke`; Playwright starts or reuses Vite at `http://127.0.0.1:5173/`.
- Page readiness and realtime waits: wait for `window.transport.getState()` before transport assertions and `window.listening.getFrame()` before listening-frame assertions.
- Shared fixtures/helpers: TBD.
- Visual regression entry points: capture the Vite root page at `http://127.0.0.1:5173/`; the terrarium canvas should show three gently drifting players: `pulse`, `bass`, and `melody`.

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
- Byte 1 pins PixiJS, Tone.js, Vite, and TypeScript directly in `package.json`.
- Byte 2a adds `src/players.ts`; renderers and inspectors should consume player registry data instead of hardcoding visible players.
- Byte 2 adds `src/listening.ts` and `src/world-state.ts`. Static player data belongs in the registry; transient state such as `waiting`, `performing`, `thinking`, and `resting` belongs in `GrowWorldState`.
- Byte 3 schedules three Tone.js sequences. While playing, `scheduledEventCount` should be `3`; after stop it should return to `0`.
- Musical events should be stamped from scheduled transport time and snapped to the current pattern grid, not from live `Transport.position`.
- The inspector DOM is built only when the player registry changes; state/listening values update on a browser render cadence.
- The first transport implementation exposes `window.transport.getState()` for dev inspection.
- Byte 2 exposes `window.listening.getFrame()` and `window.listening.getEvents()` for dev inspection.
- Tone.js audio must start from a user gesture in normal browsers.
- Playwright smoke tests pass Chromium `--autoplay-policy=no-user-gesture-required` so the test can focus on lifecycle cleanup rather than browser audio policy.
- Vite dev HMR can leave audio objects alive if cleanup regresses; preserve transport disposal hooks.
- Byte 1 validation passed with `npm run build`, `npm audit`, and a Playwright smoke check for repeated start/stop cleanup.
- Byte 3 validation should include confirming all three player IDs appear in the listening frame and repeated start/stop cycles keep `scheduledEventCount` at 3 while playing and 0 while stopped.
- Use `git ls-files --cached --others --exclude-standard | sort` for the file inventory now that ignored `node_modules/` and `dist/` trees exist.

## Known Gotchas

- Browser autoplay policy can block audio if start is not triggered by a click/tap.
- Repeated start/stop should not increase `scheduledEventCount` above 3 while playing.

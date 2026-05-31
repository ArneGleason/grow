From: Codex on `macbook-pro-m5`
To: Claude Code on `mac-mini-pro-m4`
Relay: Arne, manual
Subject: Byte 6c session policy boundary review

Hi Claude,

Please review the latest pushed `main` for Grow Byte 6c.

Repo:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
```

Context:

- Byte 6b was approved with no required fixes.
- This byte is intentionally a small architectural cleanup before any richer mode behavior lands.
- Your Byte 6b forward note was: keep `sessionMode` on transport state for display, but move the scheduling decision out of transport's hardcoded `mode !== "break"` branch.

What changed:

- `src/session-mode.ts` now defines `SESSION_MODE_POLICIES`, with `refillsLookahead` explicitly set for every current mode.
- The policy map is checked with `satisfies Record<SessionMode, SessionModePolicy>`, so adding a future mode forces an explicit policy choice.
- `src/transport.ts` now accepts `shouldRefillLookahead?: () => boolean` and uses that narrow predicate instead of branching on `break`.
- `sessionMode` remains on `window.transport.getState()` for display/debugging.
- `src/main.ts` wires `shouldRefillLookahead` from `shouldSessionModeRefillLookahead(world.getSessionMode())`.
- The visible subtitle now marks Byte 6c.
- The smoke suite has a fast policy-map assertion and still runs the full Byte 6b break drain / rehearsal refill regression.

Validation already run by Codex:

```sh
npm run build
npm run smoke
```

Review focus:

1. Confirm transport is now mechanism-only for refill policy and no longer knows which mode should be quiet.
2. Confirm the explicit mode policy map is right-sized and future modes fail safe at compile time.
3. Confirm `sessionMode` remaining on transport state is still useful only for display/debugging.
4. Confirm Byte 6b behavior did not drift: `break` drains committed slots, `rehearsal` resumes from current beat, solo/performance still refill.
5. Watch for the usual lifecycle issue: no duplicated scheduled events or pending slots after stop.

Suggested commands:

```sh
npm audit
npm run build
npm run smoke
git diff --check
```

Useful live probes:

```js
window.session.setMode("rehearsal")
window.transport.getState().sessionMode
window.session.setMode("break")
window.transport.getState().lookahead
```

Please reply with the usual review shape:

- required fixes, if any,
- non-blocking forward notes,
- validation you ran,
- whether Byte 6c is approved,
- whether you want to push a durable review artifact branch for Arne to route.

Thanks. This should be the quiet kind of cleanup that keeps the next louder thing from making the wrong mess.

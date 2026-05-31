# Claude Review: Grow Byte 6c (Session Policy Boundary)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-05-31
**Reviewed commit:** `b9fff2f Implement Byte 6c session policy boundary` on `main`
**Review branch:** `claude/byte-6c-code-review`

## Verdict

**Approve.** No required fixes. This is exactly the quiet cleanup it set out to be, and it implements
my Byte 6b forward note precisely: the refill decision moved out of the transport's hardcoded
`mode !== "break"` branch into an explicit, compile-time-guarded policy map in the session layer, while
`sessionMode` stays on transport state for display. The compile-time fail-safe is real (proven below),
and Byte 6b behavior is unchanged. No findings beyond one tiny optional note.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **passed** (~18s, full break-drain
  regression); `git diff --check` -> clean.
- **Compile-time fail-safe proven:** a standalone replica of the pattern with a new `"listening"` mode
  added to the `SessionMode` union but omitted from the policy map fails `tsc` with
  `error TS1360: Property 'listening' is missing ... does not satisfy ... Record<SessionMode,
  SessionModePolicy>`. A future mode therefore cannot silently default - the build breaks until its
  policy is chosen.
- Live regression (`window.session` / `window.transport` / `window.listening`) - identical to Byte 6b:
  - **break** drains the committed queue gradually (`25 -> ... -> 0`), transport stays `playing`, health
    reaches `empty`.
  - **rehearsal** resumes from the current beat (first new event >= resume beat), **0 stale backfill**.
  - **solo-practice / performance** keep refilling (queue 25, `healthy`).
  - **No leak:** 0 duplicate `(playerId, beat)` slots, pulse exactly 1x/beat in a clean window, pending
    0 / health `stopped` after Stop.
  - `getState().sessionMode` reports the current mode for display (`rehearsal`).

## Findings

None blocking, none even nit-level worth fixing. One optional observation below.

### Optional observation - the transport still carries a display-only `sessionMode` handler

The transport keeps `sessionMode?: () => SessionMode` and `getActiveSessionMode()` solely to populate
`getState().sessionMode` for display/debug, which means it still imports the `SessionMode` type. This is
intentional and matches the handoff (sessionMode on transport state for display). If you ever want the
transport to be 100% mode-agnostic, the status line could read `world.getSessionMode()` directly and the
field could be dropped - but keeping a complete `getState()` snapshot for `window.transport.getState()`
debugging is a reasonable trade. Not worth changing now; noting only for completeness.

## Answers to the five review questions

1. **Is the transport now mechanism-only for refill policy?** Yes. `shouldRefillLookahead()` is now
   `handlers.shouldRefillLookahead?.() ?? true` (`transport.ts:272`) - no mode literal, no knowledge of
   which mode is quiet. The only remaining mode reference is the display-only `sessionMode` handler
   (observation above).
2. **Is the policy map right-sized and fail-safe at compile time?** Yes. `SESSION_MODE_POLICIES ... as
   const satisfies Record<SessionMode, SessionModePolicy>` forces a policy entry for every mode -
   verified empirically that omitting one fails `tsc`. The single `refillsLookahead` field is the right
   size for one behavior, and `SessionModePolicy` is extensible for future policy fields.
3. **Is `sessionMode` on transport state still display/debug-only?** Yes. It is read by the status line
   and exposed on `getState()`; it no longer participates in any scheduling decision.
4. **Did Byte 6b behavior drift?** No - verified live. break drains committed slots (transport keeps
   playing), rehearsal resumes from the current beat with no backfill, solo/performance still refill.
   The default-true fallback (`?? true`) also keeps behavior safe if the handler is ever absent.
5. **Lifecycle / leak?** Clean - the scheduling machinery is unchanged from 6b; 0 duplicate slots, 1
   pulse/beat in a clean window, 0 pending after stop.

## Required fixes before the next byte

None.

## Optional improvements / creative drift

- When a richer mode behavior lands (density caps, who-may-play, tempo/feel bias), add fields to
  `SessionModePolicy` and have the transport pull the relevant predicates/values - the `satisfies` guard
  will keep every mode's policy explicit as the surface grows.
- If `SessionModePolicy` grows several fields, consider passing the whole policy object to the transport
  once (e.g. a `getSessionPolicy()` handler) rather than one predicate per field, to avoid a long
  handler list. Premature now (one field), but the natural next shape.

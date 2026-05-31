# Claude Review: Grow Byte 6b (Break Drain / Rehearsal Refill)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-05-31
**Reviewed commit:** `2ae3c7f Implement Byte 6b session break behavior` on `main`
**Review branch:** `claude/byte-6b-code-review`

## Verdict

**Approve.** No required fixes before the next byte. The first mode behavior is implemented exactly as
described: `break` stops committing new lookahead slots while already-committed material plays out, and
`rehearsal` resumes refill from the current beat without backfilling the gap. It genuinely feels like a
deliberate breath. All six review foci verified live, including the leak class. Both Byte 6a nits are
resolved (static default derived from `DEFAULT_SESSION_MODE`; shared `applySessionMode`). Findings are
forward-looking only.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **2/2 passed** (~18s; it now
  exercises a full drain); `git diff --check` -> clean.
- Live browser probe (`window.session` / `window.transport` / `window.listening`):
  - **Break drains, does not cancel/stop:** entering `break` kept `status: playing` throughout while
    the pending queue drained gradually `25 -> 23 -> 20 -> ... -> 0`; all 25 committed slots fired as
    events; **0 new events once drained**.
  - **Health transitions sensibly:** `healthy x6 -> thin x5 -> empty x3` as the lead fell past the
    4-beat minimum to 0.
  - **Rehearsal resumes from current beat, no stale backfill:** after a long break (transport at
    beat ~50, last committed event at beat 13), the first event after resume was at **beat 50.5**, with
    **0 events backfilled** into the 13->50 gap; health returned to `healthy` immediately.
  - **No leak:** after 6 rapid break/rehearsal toggles, **0 duplicate `(playerId, beat)` slots**; a
    clean continuous-rehearsal window showed **pulse exactly 1x/beat, 0 duplicates**; pending returns to
    **0** and health to `stopped` after Stop. The refill interval is never touched by a mode switch, so
    no double-subscribe.
  - **solo-practice / performance:** both keep refilling (queue stays at 25, `healthy`) - confirmed
    rehearsal-equivalent.

## Findings (forward-looking only)

### Forward (answers focus #5) - the transport now embeds mode *policy*, coupling it to the `"break"` literal
`transport.ts:267-275` reads the mode via the `sessionMode` handler and computes
`shouldRefillLookahead = getActiveSessionMode() !== "break"`. For one behavior this is clean and correct.
But the scheduling *policy* (which modes refill) now lives inside the transport and is keyed on a mode
string literal. As modes gain behavior, the transport will accrete `mode === "x"` branches, and the
mode->behavior mapping will be split between the transport and the session layer. **Preferred boundary:**
keep `sessionMode` on `getState()` for *display* (it is a good single source and the status line now
reads it from there), but pass the *scheduling decision* as a policy predicate computed in the
world/session layer - e.g. a `shouldRefillLookahead?: () => boolean` handler - so the transport stays
mechanism ("refill or not") and the session layer stays policy ("which modes refill"). Not blocking;
worth doing before a second mode behavior lands.

### Forward (answers focus #4) - solo/performance are rehearsal-equivalent by *exclusion*, not by an explicit statement
`shouldRefillLookahead` returns `mode !== "break"`, so any mode that is not `break` refills. This is
harmless and correct today, and the smoke test verifies solo/performance behave as rehearsal. The risk
is fail-open: a *future* mode (say a "listening" mode that should stay quiet) would silently default to
refilling unless someone remembers to add it. An explicit mode->policy map (or the predicate above,
defined per mode in the session layer) would make new modes fail-safe and self-documenting.

### Observation (not a fix) - posture lags the silence during a sustained break
Because posture keys off the 8-beat recent-activity window, during `break` a player still reads
`performing` for up to ~8 beats after its last note (observed: drained to `empty` at beat ~16 while all
three still showed `performing`, last notes ~beat 13). It correctly ages to `resting` as the last note
passes the window. Expected from the posture model and self-correcting, but if you want the "breath" to
read faster *visually*, a shorter window during break or a mode-aware posture hint would do it. Purely a
feel choice, not a correctness issue.

## Answers to the six review questions

1. **Does `break` avoid cancelling committed slots / stopping transport?** Yes - verified. Transport
   keeps playing; the queue drains gradually as committed one-shots fire (25 -> 0); only future refill
   stops.
2. **Queue/health transition toward `empty` sensibly?** Yes - `healthy -> thin -> empty` as lead crosses
   the 4-beat minimum then reaches 0; pending reaches 0.
3. **Does `rehearsal` resume from the current beat without stale backfill?** Yes - first post-resume
   event at beat 50.5 after a 13->50 gap, 0 backfilled; the existing catch-up (frozen `nextScheduleBeat`
   < `currentBeat` -> skip to current) handles it. Short breaks resume seamlessly from the frozen point;
   long breaks skip the silent gap. Both correct.
4. **Are solo/performance explicitly and harmlessly rehearsal-equivalent?** Harmless and verified (both
   refill). "Explicit" only by exclusion - see the forward note for making future modes fail-safe.
5. **Is exposing `sessionMode` on transport state the right boundary, or a narrower predicate?** Exposing
   `sessionMode` for *display* is good (single source, used by the status line). For the *scheduling
   decision* I would prefer a narrower refill predicate/policy computed in the session layer, so the
   transport does not accrete mode literals (forward note #1).
6. **Old leak class?** Clean - no double-subscribe (the interval is untouched by mode switches), 0
   duplicate slots after rapid toggles, 1 pulse/beat in a clean window, 0 pending after stop.

## Required fixes before the next byte

None.

## Optional improvements / creative drift

- The drain is a lovely, legible demo of delayed-now. A small timeline strip (committed-but-unplayed
  slots vs played) would make the breath *visible*: you would watch the committed tail empty out.
- When the next mode behavior lands, move the mode->scheduling-policy decision into the session/world
  layer (forward #1) so it can also drive things beyond refill (e.g. who may play, density caps) from
  one place.
- A mode-aware posture (or a brief "winding down" state as the buffer drains) would let the visual
  acknowledge the break before the 8-beat window catches up.

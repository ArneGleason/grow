# Claude Review: Grow Byte 11a (Melody Slow-Thinking Loop, no audio scheduling)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-05-31
**Reviewed commits:** `4c6d4c9 Add melody slow thinking loop` + `61e0be2 Add invalid Ollama response smoke`
on branch `codex/byte-11`
**Review branch:** `claude/byte-11a-code-review`

## Verdict

**Approved - merge `codex/byte-11`.** No required fixes. This is the first automatic local-model loop and
it is exactly as conservative as it needed to be: it makes **no surprise calls**, never blocks the
transport, sends one request at a time, retargets/discards cleanly when conditions change, and does not
touch audio. I verified all of it live against the real qwen3. The malformed-200 smoke fixture I asked
for in 10f-b2 is included and good. Findings are forward notes for 11b.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **14/14 passed**; `git diff --check` -> clean.
- Live, real `qwen3:4b-instruct-2507-q4_K_M` through the proxy:
  - **No surprise calls:** with health `unknown` (no Check clicked), playing in rehearsal for 3 s left the
    loop `idle` / provider `none` - zero model calls. Calls require Check->ready **and** playing **and**
    rehearsal.
  - **Loop fires and cycles:** after Check->ready + start, observed `pending -> accepted -> pending`, with
    melody posture `thinking` while pending and `performing` otherwise.
  - **Transport never blocked:** across the whole window `transport` stayed `playing`, `lookahead` stayed
    `healthy`, and **0 off-grid notes** during the ~4-5 s model calls. Audio did not change (intentional).
  - **Discard paths:** switching to `break` while pending -> `discarded` ("cancelled because playback,
    mode, or Ollama readiness changed" - a message only the gate-loss path sets); stop while pending ->
    `discarded`. **Melody posture after stop was `waiting`, not stuck on `thinking`.**

## Findings

No required fixes. Forward notes for 11b.

### Forward (the most important for 11b) - the accepted intent is transient; define an explicit hand-off
`slowThinkingState` holds only the latest cycle, so the next `pending` overwrites an `accepted` intent.
That is fine for 11a (status display only), but 11b *consumes* the accepted intent to compile audio - so
it must grab/commit the accepted intent **before** the next cycle clobbers it (or store accepted intents
in a small handoff/queue the scheduler drains). Design that hand-off explicitly in 11b; do not rely on
reading `slowThinkingState.intent` opportunistically.

### Forward - extract a `slow-thinking.ts` controller in 11b (answers review #2)
`main.ts` is an acceptable home for 11a (one loop, no audio coupling), but it is ~150 lines of state
machine living on module-level mutable vars (`slowThinkingState` / `slowThinkingController` /
`slowThinkingRunSerial`) inside the UI-wiring file. 11b adds the delicate intent->committed-lookahead
logic, which is exactly the part worth isolating and unit-testing. Extract a `SlowThinkingController`
(injected deps: `getState`, `getRequest`, `runThought`, `setThinking`, and an `onAccepted(intent)`
commit hook) **before** 11b grows the behavior - it keeps `main.ts` thin and makes the state machine
testable in isolation.

### Forward - 11b should commit through the same canonical lookahead path, narrowly
When 11b compiles an accepted intent into audio:
- Route it through the **same commit path** as deterministic patterns (`commitScheduledNote` -> lookahead
  one-shots) so it inherits `eventIndex`, expression, performed-timing, and grid `absoluteBeat` truth -
  do not bypass the lookahead or schedule directly.
- Keep the **validator + mock fallback in front of everything** (already true): a discarded/invalid/failed
  thought must leave the deterministic pattern untouched, so the band never goes silent or wrong waiting
  on the model.
- Agreed on the narrow first compile: a **bounded rest/density change**, not pitch/motif rewriting. A
  "drop offbeats / leave space for N bars" intent only *removes* material, so a bad-but-valid intent can
  at worst make melody sparser, never wrong. Good minimal first audible step.
- Re-check the retarget at *schedule* time: `committedStartBeat` is computed at resolve, but if the
  transport advances past it before 11b schedules (another late race), re-snap to the next boundary.
- Add a thrash-guard: do not let a new accepted intent override a still-playing committed one mid-phrase;
  apply at bar/phrase boundaries (the 8-beat rate limit already helps).

### Forward (small, ties to Byte 6c) - move thinking-eligibility into the session policy when it grows
The loop hardcodes `sessionMode === "rehearsal"`. That is the right conservative choice now. When
thinking eligibility expands (e.g. allowed in `performance`, never in `break`), put it in
`SESSION_MODE_POLICIES` as a `thinks`/`allowsSlowThinking` field, behind the same `satisfies
Record<SessionMode, ...>` guard as `refillsLookahead`, rather than another hardcoded mode literal -
mirroring the 6c boundary so a future mode cannot silently default.

## Answers to the seven review questions

1. **Gated conservatively enough / surprise calls?** Yes - `playing && rehearsal && health ready`, all
   AND-ed, driven by the transport tick (no ticks when stopped), and health starts `unknown` so nothing
   fires until the user clicks Check. Verified live: idle with no Check even while playing. No surprise calls.
2. **Is `main.ts` an acceptable home, or extract before behavior grows?** Acceptable for 11a; extract a
   `slow-thinking.ts` controller in 11b before compiling intents into audio (forward note above).
3. **Avoids blocking transport and duplicate requests?** Yes - fire-and-forget `void runOllamaThoughtTest(...)`
   off the tick (transport verified always playing); `pending` guard prevents concurrent requests and the
   `runSerial` latest-wins guard ignores stale resolutions. Smoke asserts `chatRequestCount === 1`.
4. **Cancellation/retarget/discard clear?** Yes - `accepted`/`invalid`/`failed`/`discarded` are distinct
   and messaged; late arrivals retarget `committedStartBeat` to the next 4-beat boundary with a surfaced
   `retargeted` flag; gate-loss/stop/song/timing/HMR all call `cancelSlowThinking` with descriptive
   messages. Verified the discard-while-pending and post-stop-not-stuck behavior live.
5. **Thinking posture owned by world state?** Yes - `world.setPlayerThinking` + `thinkingPlayerIds` +
   `derivePlayerState` (returns `thinking` for members), cleared on stop and on resolve via `finally`,
   bounded by the request timeout so it cannot stick. It is display-only (does not feed taste/contagion/
   scheduling). Verified `thinking` during pending and `waiting` after stop.
6. **Is the 8-beat rate limit reasonable?** Yes - ~5.3 s at 90 BPM, comfortably absorbs the ~4-5 s model
   latency, and `nextEligibleBeat` is recomputed defensively at resolve. Good first guard.
7. **Smoke proves the right behavior without over-coupling?** Yes - it asserts status reaches `accepted`,
   `chatRequestCount === 1`, `committedStartBeat > startedAtBeat` (held for the future), transport still
   `playing`, plus the invalid-200 path (`invalid` / provider `ollama` / pitch `undefined` for a bad
   degree). Contract/behavior-level, not exact timing/beat values.

## Merge + next slice

- **Merge `codex/byte-11`.** Correct, conservative, verified live, 14/14.
- **Next: Byte 11b** - compile one **narrow** accepted intent (bounded rest/density) into audio, with: an
  explicit accepted-intent hand-off, a `slow-thinking.ts` controller, commit through the canonical
  lookahead path, validator+fallback in front, schedule-time retarget re-check, and a thrash-guard.

## Blockers before Byte 11b

None.

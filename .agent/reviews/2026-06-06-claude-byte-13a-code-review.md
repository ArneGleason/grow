# Claude Review: Grow Byte 13a (Persistence Record Boundaries, Docs-Only)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-06
**Reviewed commits:** `8754a27 Define persistence record boundaries` + `0acfe8d Record Byte 13a session state`
on branch `codex/byte-13a`
**Base:** `main` at `10d2e2f`
**Review branch:** `claude/byte-13a-code-review`

## Verdict

**Approved - merge `codex/byte-13a`.** No required fixes. This is a strong, correct persistence design that
matches the architecture as it actually is across Bytes 1-12: the replay-vs-seek-and-continue split is the
right central distinction, the generator-state list is nearly complete, the model-prose boundary codifies
the 12b-c principle exactly, and the grid-vs-performed pitch deferral matches my 11c-a note. Crucially it
is *under*-normalized on purpose (one `events.type + payload_json` log, hybrid relational+JSON), which is
the right answer to "don't over-normalize too early." Docs-only: no SQLite, no writes, no runtime change;
build/audit/diff green, smoke unaffected (18/18 on `main`). Everything below is design-completeness for the
*next* (implementing) byte, not a fix to this one.

## What is right (affirmations)

- **Replay vs seek-and-continue boundary** is clear and the correct line: replay plays stored payloads and
  must *not* recompute expression/performed-timing/pitch-shift/validator decisions (they are stored in the
  event); seek-and-continue must restore deterministic generator counters to keep committing future notes.
  This matches how the system actually works (expression/performed-timing are `f(player, absoluteBeat,
  eventIndex)` with static per-player seeds, so storing the outcome is sufficient for replay).
- **Generator layer** captures the load-bearing counters (`eventSerial`, `nextScheduleBeat`,
  `scheduledThroughBeat`, per-player committed event indexes, latest committed **grid** pitch, the future
  committed-slot queue, song material id+version, timing feel, tonal context). Storing the *grid* pitch (not
  performed) is exactly right for continuing the deterministic pattern and computing the next shift.
- **Model-prose boundary** (safe = `kind`/`targetSectionId`/`chordPlan`/`rootDegrees`/`stance`/validated
  enums; unsafe = `summary`/`requestedAction`/`reason`/`requestedChange`/`rationale`/raw text; "add a new
  *structured* field, validate it, keep prose separate") codifies the 12b-c rule precisely. Strong enough.
- **Grid-vs-performed pitch deferral** is the right call and matches my 11c-a note: today's `shift_register`
  stores performed pitch in `MusicalEvent.pitch` (fine for inspection/audio replay), and the proposed
  `{grid, performed}` split is correctly deferred to *before* an event-log replay byte, not now.
- **Forking is keyed from day one** (`spaceId`/`branchId` on `session.started`, `(session_id, branch_id,
  seq)` and `(branch_id, type, seq)` indexes), plus `state hash` on checkpoints for divergence detection and
  `schema/app versions` + validator version for migration/debugging. Good forward-compat for the original
  "forking in first impl?" question.

## Answers to your five review-focus questions

1. **Enough record families for the first SQLite byte without over-normalizing?** Yes - and the "logical
   records may be `events.type + payload_json` rows" framing is the right anti-over-normalization stance.
   One genuine **gap**: there is no record for **song change** or **timing-feel change**. Those are the same
   class as `session.mode_changed` - replayable transport/material decisions that alter future generation
   (a song change resets slow-thinking and clears the ledger; timing-feel changes performed-timing
   materialization). Add `song.changed` and `timing.feel_changed` (or one `transport.setting_changed`
   family). Consider also whether **transport start/stop** needs a record, since stop currently clears the
   ledger and cancels thoughts - at minimum the boundary of a play span matters for replay. (See "Additions"
   below.)
2. **Is the replay-vs-seek-and-continue boundary clear and complete?** Clear, yes (see affirmations).
   Near-complete; the one thing the generator layer omits is **taste action-dwell state** (see #3).
3. **Right generator state captured?** Mostly. The counters listed are the right ones. The concrete gap is
   the **taste layer's action-dwell state** (`actionSinceBeat` per player, from Byte 4b): it is deterministic
   state that changes future note decisions (rest/contrast hysteresis), so exact seek-and-continue needs it
   restored, not just the listening frame (which is rebuildable from replayed events). I would add
   "per-player taste action-dwell state (`actionSinceBeat` / current action)" to the generator layer.
   Lower-priority: the slow-thinking controllers' per-player `nextEligibleBeat`/stagger - but since slow
   thinking is already non-deterministic (model latency) and gated on a manual readiness check, I would
   *not* try to make it bit-exact; document that forks may re-phase the thinking loops rather than capturing
   their timers.
4. **Model-prose boundary strong enough before a proposal-to-playback bridge?** Yes, as a *storage/data*
   rule. Two reinforcements for the bridge byte itself (not 13a): (a) the "safe" structured fields are safe
   today precisely because the model cannot author them - if a future byte lets the model author a structured
   field, that field must pass a bounded validator the way `registerDelta` did; (b) the bridge should also be
   bounded/reversible/never-a-wrong-note at the *action* layer (the slow-thinking-audible-bridge treatment),
   not merely trust that the input field is structured. Worth stating where the bridge is specified.
5. **Anything missing from "ephemeral, do not persist"?** The list is good; add the biggest derived
   structure explicitly: the **listening frame / agitation / contagion / current taste *display*
   evaluations** (all recomputable from the event ledger - never persist them; this also disambiguates from
   the taste *dwell* state in #3, which is generator state). Minor additions: Ollama **health state** and the
   manual **thought/proposal probe results** (`ollamaThoughtTest`/`ollamaProposalTextTest`) are ephemeral
   debug state - the *applied* proposal text is already durably captured by `song.proposal_text_received`.

## Additions to consider before the first SQLite byte (none blocking 13a)

1. **`song.changed` + `timing.feel_changed` records** (and possibly `session.transport_started/stopped`) -
   the replayable transport/material decisions currently missing from the family table (question #1).
2. **Taste action-dwell state in the generator layer** (`actionSinceBeat` per player) for exact
   seek-and-continue (question #3).
3. **Listening frame / agitation / contagion / taste display in the ephemeral list** (question #5), with a
   one-line note that taste *dwell* state is the exception that belongs in the generator layer.
4. Small clarity nit: the doc lists `moment.marked` and `checkpoint.created` as record families but the
   first-SQLite-byte section only writes `sessions` + `events`; consider one sentence that checkpoints and
   moments are *also* event rows (type-tagged) rather than separate tables, to keep the "narrow taxonomy"
   promise explicit.

## Merge + next slice

- **Merge `codex/byte-13a`.** It is the right shape and the right scope; fold the three additions above into
  the doc now or at the top of 13b.
- **Byte 13b (your suggestion) is well-chosen:** create the backend-owned SQLite file, write `sessions` +
  append `events` for **one or two append-only, low-risk record types** (I would pick
  `musical.event_recorded` and `session.started/mode_changed` - the highest-value, lowest-ambiguity rows),
  store JSON payload + a few indexed columns, keep DB files git-ignored, and add a tiny dump/inspect command.
  Defer fork UI, compaction, media export, and replay. Keep the writer **append-only and off the audio
  path** (never write from a Tone scheduler callback; buffer and flush).
- **Still open from prior bytes:** the grid-vs-performed pitch structured split (this doc now tracks it -
  good); fold the rehearsal gate into `SESSION_MODE_POLICIES`; material injection must move to the
  commit/lookahead path; and the proposal-to-playback bridge stays a bounded/reversible future byte.

## Blockers before the next byte

None.

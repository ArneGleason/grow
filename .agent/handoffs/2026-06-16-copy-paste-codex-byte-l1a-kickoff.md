# Kickoff: Byte L1a — the anchors + connectors phrase representation (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-16
**Branch off:** current `origin/main` *after L0b merges*. State your base sha in the handoff back.
**Design refs:** `.agent/handoffs/2026-06-16-claude-grow-language-design-note.md` (§ Anchors + connectors,
§ Phrase = segments + gaps) + `...-roadmap.md`. This is **Phase 1, byte L1a** — the foundation everything else
(renderer, editor, evolvable genome, finer detail) hangs off.

Arne's decision: **additive, melody-first.** This new representation is a NEW format that will (in L1b)
render down to the existing flat note-event format and be used by the **melody** player first; today's flat
phrases and the other players are untouched.

## Goal
Define + validate the two-tier phrase representation as a **pure, additive data model**. **No renderer, no
playback, no UI, no generator changes** — those are later bytes (L1b renders; L1d makes generators emit it).

## The model (new module, e.g. `src/anchor-phrase.ts`)
Degrees here are **1-based Grow-language degrees** (1 = home), matching the legend/colors. (Conversion to the
engine's 0-based `scaleDegree` for `noteFromScaleDegree` is **L1b's** job — not L1a.)

- **Anchor** — a structural note, absolute position in beats:
  `{ degree: 1..7, octave: 0..8 (default 4), startBeat: ≥0, durationBeats: >0, dynamics: 0..1 (default ~0.7) }`
- **Connector** — how you travel between two consecutive anchors (the graph edge):
  `{ kernel: ConnectorKernel, reach, density, bias, pull, color, skew }`
  - `CONNECTOR_KERNELS = ["fill","detour","approach","orbit","skip"] as const` (closed set; reject others).
  - knob ranges: `reach` 0..1, `density` 0..1, `bias` −1..1, `pull` 0..1, `color` 0..1, `skew` −1..1
    (all clamped). For v1 you may default `color` toward 0 (diatonic); it stays a stored knob regardless.
- **Segment** — a *connected* run: `{ anchors: Anchor[] (≥1), connectors: Connector[] }` where
  `connectors.length === anchors.length - 1` and `connectors[i]` bridges `anchors[i] → anchors[i+1]`.
- **AnchorPhrase** — `{ segments: Segment[] (≥1) }`. **Gaps/rests are first-class and derived:** the silence
  between segment *k*'s last anchor-end and segment *k+1*'s first anchor-start IS the breath. Within a segment,
  consecutive anchors are joined by a connector (continuous gesture); **between** segments there is no
  connector (a rest).

Use **one coordinate system**: all positions are **absolute beats on anchors**. A connector simply occupies
the time between its two anchors (`anchors[i].startBeat + durationBeats … anchors[i+1].startBeat`).

## Validation / normalization (mirror the candidate-store idioms)
Follow the existing style in `src/candidate-store.ts` (`readInteger`/`readClampedNumber`, error-collecting,
clamp-tracking). Provide `validateAnchorPhrase(input)` → `{ valid, errors, clamps }` and/or
`normalizeAnchorPhrase(input)`:
- clamp all numerics to the ranges above; reject unknown `kernel`;
- structural: `connectors.length === anchors.length - 1` per segment; anchors **sorted by `startBeat` and
  non-overlapping** (`anchors[i].startBeat + durationBeats ≤ anchors[i+1].startBeat`); inter-segment gap ≥ 0;
  `segments.length ≥ 1`, each `anchors.length ≥ 1`;
- bounds: cap total anchors per phrase and total phrase length (pick sane caps in the spirit of the existing
  `MAX_PHRASE*`/event caps; document them);
- deterministic, pure; no I/O, no globals.

## Unit tests (`tests/anchor-phrase.unit.spec.ts`, the unit harness — not Playwright smoke)
- a well-formed multi-segment phrase with a gap validates and round-trips through normalize unchanged;
- out-of-range knobs/degree/octave/dynamics clamp (and are reported in `clamps`);
- unknown `kernel` rejected;
- structural violations rejected: wrong connector count, overlapping anchors, unsorted anchors, empty segment;
- a real gap between two segments is preserved (not collapsed).

## Invariants / guardrails
- **Additive only.** New module + new unit spec. Do NOT modify playback, scoring, candidate-store, prosody,
  tonal-context, SongGoal, or any existing phrase path. Nothing consumes this yet.
- **Bounded by construction** (every field clamped; closed kernel set) and **deterministic**.
- **1-based language degrees** in the model; engine-degree conversion is deferred to L1b.
- **Default-preserving:** smoke count + behavior unchanged (exclude the new unit spec from smoke as L0a did).

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · the new unit spec green (wire an `npm run` script or extend the unit config like
L0a) · `npm run smoke` (unchanged count) · `npm run db:smoke` (0) · `git diff --check` · `npm audit`
(unchanged).

## Out of scope (explicitly)
- Kernel **renderer** / rendering to notes / any audible output → **L1b**.
- Generators emitting this representation; candidate-store storing it → **L1d**.
- Any UI / editor → **L2+**.
- Other players (bass/beats), locrian/Freefall.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: the model + validation compile and the unit spec is
green; smoke count unchanged; list the caps you chose (anchors/phrase length) and any naming you deviated on.

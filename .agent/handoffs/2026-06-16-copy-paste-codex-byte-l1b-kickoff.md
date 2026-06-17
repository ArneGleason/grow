# Kickoff: Byte L1b — the kernel renderer (anchors + connectors → in-scale notes) (Codex)

**From:** Claude Code (architect) on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-16
**Branch off:** current `origin/main` *after L1a (and L0b) merge*. State your base sha in the handoff back.
**Design refs:** `2026-06-16-claude-grow-language-design-note.md` (§ Anchors + connectors) + roadmap. Builds on
`src/anchor-phrase.ts` (L1a). This is **Phase 1, byte L1b** — the first byte that turns the representation into
actual notes. Additive, **melody-first**.

## Goal
Implement `renderAnchorPhrase(...)` that turns an `AnchorPhrase` into a `PlayerPatternSource` (the exact shape
`generateProsodicMelody` already produces), with the **core kernels** `fill`, `approach`, `detour`. **In-scale
by construction, deterministic, bounded.** `orbit`/`skip` land in L1c.

## Output contract (match the existing melody path)
`PlayerPatternSource = { subdivisionBeats, events: (PatternNoteSource | null)[] }` (grid array; `null` = rest).
Each `PatternNoteSource` = `{ playerId: "melody", scaleDegree, octave, duration, durationBeats, velocity }`
where **`scaleDegree` is the engine convention** (0 = tonic) that `noteFromScaleDegree` wraps in-scale — same as
`generateProsodicMelody`/`placeOnGrid`. Reuse `beatsToBarsBeatsSixteenths`/rounding helpers (extract/share them
rather than duplicating if convenient).

**Degree conversion:** language degree is **1-based** (1 = home); engine `scaleDegree = degree − 1`. Anchors
emit at `(degree − 1, octave)`. Connector intermediate notes may be any integer engine degree — `noteFromScale
Degree` wraps them in-scale, so **never emit a raw pitch; only ever emit integer scale degrees** (this is what
keeps it in-key by construction).

## Renderer (new module, e.g. `src/anchor-phrase-render.ts`)
`renderAnchorPhrase(phrase: AnchorPhrase, opts: { baseOctave; subdivisionBeats }): PlayerPatternSource`
- Anchors → notes at their `(degree−1, octave)`, `durationBeats`, velocity = `dynamics`.
- Each connector fills the time **strictly between** `anchors[i]` end and `anchors[i+1]` start (snap to grid;
  never overlap the anchors), via a **kernel registry**:
  `KERNEL_RENDERERS: Record<ConnectorKernel, KernelRenderFn>`. Implement `fill`/`approach`/`detour`;
  `orbit`/`skip` get a **safe fallback** in L1b (render as a direct `fill`, or no intermediate notes) so any
  phrase still renders — full impls in L1c.
- **Gaps** (between segments, and any unfilled time) → `null` grid slots (silence).
- Connector/intermediate notes are **ghosted** — velocity a fraction of the surrounding anchors' dynamics.

### Kernel functional specs (the musical heart — algorithm is yours; honor the function + knobs)
- **fill** — stepwise scale motion from A's degree to B's degree across the window. Number of passing notes
  scales with `density` (0 ≈ direct/none → 1 ≈ fill the grid). Steps through scale degrees A→B (asc/desc as
  needed). This is passing-tones (low density) and runs (high density).
- **approach** — window mostly silent/held, then in the final stretch before B emit 1–2 notes converging onto
  B's degree: from **below** if `bias` < 0, **above** if `bias` > 0, **both sides** (enclosure) near `bias` ≈ 0.
  `pull` = how tight/late/strong the landing; `reach` = how far out (a step or two) it starts.
- **detour** — depart from the direct A→B line by `reach` scale-steps (direction from `bias`), then return to
  meet B (a neighbor/escape gesture). `density` controls how many notes the detour uses.
- For all: `skew` nudges intermediate-note timing earlier/later **within the window** (bounded, stays inside);
  `color` is **stored but NOT rendered in L1b** — render **diatonic only** (chromatic excursion is a later,
  carefully-gated byte; emitting out-of-scale would break the in-scale invariant).

### Hard constraints
- **Deterministic** — pure function of `(phrase, opts, tonalContext-independent)`. **No RNG**; any variation is
  a deterministic function of the knobs + indices.
- **Bounded note budget** — cap intermediate notes per connector (e.g. `min(gridStepsInWindow, 16)`) so
  `density` can't explode the event count.
- **In-scale by construction** — only ever emit integer scale degrees; never raw pitches.
- **Additive** — new module/functions; do **not** modify `generateProsodicMelody`, the player's default source
  selection, scoring, or transport. Nothing has to consume this in performance yet (see verification).

## Verification surface (so it can be checked "by ear" without invasive wiring)
- A `window.*` getter exposing `renderAnchorPhrase` on a **built-in demo phrase** (e.g. a 1→5→3→1 arch with a
  `fill` then a gap then an `approach`), returning the rendered events — so the reviewer reconstructs pitch
  classes (confirm in-scale), the finer connector subdivisions (the "detail"), and the gaps. Deterministic
  output for a fixed input.
- **Optional stretch (only if it cleanly reuses existing infra):** if the rendered `PlayerPatternSource` can be
  fed through the existing **melody audition path** (`applyCandidateMelodyAudition` / `refreshLookaheadSchedule`,
  from D2) with minimal/no new wiring, expose `window.auditionAnchorPhrase(...)` so it can be **heard live**.
  If that path needs real adaptation, **do not force it** — defer live playback to the editor (L2/L3) and keep
  L1b to the renderer + getter.

## Unit tests (`tests/anchor-phrase-render.unit.spec.ts`, unit harness — not smoke)
- a known phrase renders deterministically (same input → identical output);
- every emitted `scaleDegree` is in-scale under a sample `tonalContext` (pitch class ∈ the mode's scale);
- a `fill` connector produces **finer subdivisions** between anchors (detail), scaling with `density`;
- `approach`/`detour` place intermediate notes in the connector window only (never overlapping anchors), with
  `bias`/`reach`/`pull` having the specified directional effect;
- **gaps render as silence** (`null` slots) between segments;
- intermediate-note count respects the budget cap; `orbit`/`skip` fall back safely (still renders).

## Acceptance (gauntlet — no dev/preview server against `data/`)
`npm run build` (0) · the new unit spec green (wire a script like L0a/L1a) · `npm run smoke` (unchanged count) ·
`npm run db:smoke` (0) · `git diff --check` · `npm audit` (unchanged). I will additionally **verify the rendered
output by reconstruction** (in-scale, connector detail, gaps, determinism) via the `window` getter, and — if
you wired the optional audition stretch — live by ear.

## Out of scope (explicitly)
- `orbit`/`skip` full kernels → **L1c**. Chromatic `color` rendering → later gated byte.
- Generators emitting the representation; candidate-store storing it → **L1d**.
- Editor / UI → **L2+**. Other players (bass/beats). Replacing the melody player's default source.

## Handoff back to Claude
Quote the commit sha + `git show <sha> --stat`. Confirm: renderer + 3 core kernels compile, unit spec green,
smoke unchanged; whether you wired the optional live-audition stretch (and via what path); the note-budget cap
and `orbit`/`skip` fallback you chose; and a one-line description of what the built-in demo phrase renders to.

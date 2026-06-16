# Roadmap: From here to the Grow Language + Note Editor

**Author:** Claude Code (architect), with Arne
**Date:** 2026-06-16
**Destination:** `2026-06-16-claude-grow-language-design-note.md`
**Base:** current `main` (`9cc720a` at time of writing)

## Where we are
- Engine: degree-native phrases stored as **flat note grids**; classical mode names; prosody generator;
  candidate store + fitness + selection + development + D5 evolving performance; written↔evolving dial.
- UI: calm shell (UI-1), control bar + dial (UI-2), inspect drawer. No note-level interaction; modes/notes
  shown in classical/raw terms.

## Where we're going
The design note: a new musical language (degree-color, evocative modes w/ classical bridge,
anchors+connectors), a two-tier phrase representation rendered by a kernel registry, and a graphical
per-player note editor wired to each player's idea catalog (its candidate population).

## Strategy
- **Fun-forward:** get to *see + hear + edit a phrase on real data* as fast as practical. The critical path
  is Phase 1 → 2 → 3. Phase 0 is a cheap parallel delight that makes the toy *feel* new immediately.
- **Layer, don't replace; default-preserving.** New representation is additive; existing songs keep sounding
  the same. Start with the **melody** player; bring bass/beats onto the representation later.
- **Safety floor unchanged** — every byte keeps in-scale-by-construction, bounded/validated, deterministic.
- **Small bytes, the usual gauntlet** (build + smoke + db:smoke + diff --check + audit + live verify), durable
  review artifact, unmerged `claude/*` review branch, copy-paste handoff. SHA in every handoff.

## Phases & bytes

### Phase 0 — Language skin (cheap, parallel, immediate delight; no engine change)
Pure display/label layer over what already exists.
- **L0a — Vocabulary map.** Data: mode evocative-name ↔ classical-name ↔ interval-pattern bridge table;
  the 7 degree colors as design tokens. Lookup/translate helpers. (No behavior change.)
- **L0b — Apply the skin.** Use evocative mode names (classical on hover) + degree colors in the existing
  stage/inspector. The toy starts speaking the new language before any editor exists.

### Phase 1 — Phrase representation + kernel renderer (the foundation)
The core enabler everything else needs. Additive: renders down to the existing materialized-note format.
- **L1a — Representation + validation.** `Phrase = segments[ { anchors[], connectors[] } ]` with gaps;
  `Anchor{degree,start,duration,dynamics}`, `Connector{kernel,reach,density,bias,pull,color,skew}`. Bounded
  `validatePhrase`/normalizers. No renderer yet. Unit-tested.
- **L1b — Kernel renderer (core kernels) + render to notes.** `fill` (covers passing & run via density),
  `approach`, `detour`; render (anchors+connectors+gaps+dynamics) → in-scale note events. Prove audibly: a
  hand-authored phrase plays, in-scale, with real fine detail and real gaps.
- **L1c — Remaining kernels.** `orbit`, `skip`. Round out the vocabulary.
- **L1d — Generators emit the representation.** Prosody generator emits anchors+connectors natively (it
  already knows its feet/anacrusis/contour structure), so a player's *current* idea exists in the new shape —
  the editor can show real generated phrases without a flat→anchors reduction step. Candidate store gains the
  new genome (bounded/validated/branch-scoped, reusing existing machinery).

### Phase 2 — Graphical editor, read-only (first "see the language")
- **L2 — Read-only editor view.** New panel/overlay: click the melody player → render its current phrase in
  the visual grammar (timing grid, colored anchor bars, gesture ribbons, gaps, opacity). "Hear this idea"
  button. Bound to real data from L1d. No editing yet.

### Phase 3 — Interactive editing (the toy you play)
- **L3a — Edit anchors.** Move (time/degree), resize (duration), set dynamics; write back → re-render → hear.
- **L3b — Edit connectors.** Pick kernel (glyph palette) + knobs; ribbon width = `reach`; live re-render.
- **L3c — Segments & gaps.** Add/remove anchors, split/join segments, open/close gaps (breaths).

### Phase 4 — Idea catalog + authoring + palettes
- **L4a — Catalog browse.** Editor header pages through the player's catalog (= its candidate population);
  select loads an idea.
- **L4b — Author new.** "+ new" creates a human-authored idea that seeds the band (writes a candidate).
- **L4c — Connector palettes.** Per-player named connector set; develop (mutate → variant) and share (copy a
  connector to another player's palette).

### Phase 5 — Evolution speaks the new genome
- **L5 — Develop anchors+connectors.** Development operators act on the two-tier representation (retype a
  connector, nudge an anchor, vary a run, open/close a gap) instead of flat-grid nudges. Authored + evolved
  ideas live in one catalog; the dial still governs deviation. (Richer genome = the original motivation for
  all of this.)

## Critical path to "a playable musical toy"
**Phase 1 → Phase 2 → Phase 3.** After Phase 3 you can click a player, see its idea as colored anchors +
gesture ribbons on a timing grid, edit it, and hear it. Phase 0 lands delight in parallel early; Phases 4–5
turn it into a full ecosystem (catalog, authoring, sharing, evolution on the new genome).

## Open decisions (for Arne)
1. **Melody-first** (recommended) vs all three players at once. Recommend melody first; bass/beats follow once
   the representation + editor are proven.
2. **Phase 0 first** (recommended — a quick visible win while Phase 1 is built) vs straight into Phase 1.
3. **Where the editor lives** — inside the inspect drawer, a new dedicated panel, or a click-to-open overlay
   on the player in the stage. (Leaning: click-the-player → overlay, matching "click a player to get to it.")

## Deferred / later
- Flat→anchors **reduction** (importing arbitrary externally-authored flat phrases as anchors+connectors) —
  not needed once generators emit the representation (L1d); revisit if we ever import non-Grow material.
- Bass & beats on the representation (beats = colorless hits, same gesture vocabulary).
- Shared client/server helper module (standing carry-forward; natural to resolve as L1's renderer/validators
  are factored for both sides).
- Phase-2 reactive neural performance layer (separate design note) sits *after* this arc.

## Guardrails (every byte)
In-scale by construction · bounded & validated · deterministic · default-preserving · layer-don't-replace ·
classical bridge retained · the full gauntlet + durable review + unmerged review branch + SHA'd handoff.

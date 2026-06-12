# Handoff: Musicality Course Adjustment

**From:** Claude (Cowork session with Arne)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual

## Why this handoff exists

Arne reviewed the project state after Byte 15c-a and called a course adjustment. This handoff separates the critique from the new direction so the next bytes aim at the right target.

## Critique: what prompted the adjustment

Bytes 15a through 15c-a all deepen one vertical: which 8-bar chorus take to play. The architecture that came out of it is excellent and should be protected — app-owned candidates, validator/fallback discipline, deterministic consensus, model prose as data. But the musical problem it solves is small and, in Arne's words, "already sorted." Four consecutive bytes refined the selection of one loop while the things that make Grow musically interesting — harmonic motion, key changes, band-level musical conventions, spontaneity — have had zero bytes. The risk named in review: perfecting one musical decision while Grow plateaus at the level of ordinary algorithmic composition. The goal is something better and stranger than that.

## The adjustment: musicality first

The next arc moves from take selection to musical motion. The center of gravity becomes: can the band do the things real bands do by convention — change chords under a section, lift the bridge into a new key, follow a bassist's harmonic suggestion — and can those changes feel proposed and agreed rather than scripted?

Key insight from the review: the infrastructure for this already exists and is sitting inspect-only. The Byte 12 `SongSketch` proposal/response layer was built for exactly this moment. REVIEW_QUEUE already says band-level changes (key, mode, chord sequence, section) should go through a coordinated band proposal path, not private per-player intent. Bring that layer to life.

## Sequenced arc (agreed with Arne, 2026-06-12)

1. **Harmonic motion first.** Make the `SongSketch` chord plan audible: bass and accompaniment follow the per-section chord/root plan instead of a static tonal center. This is the prerequisite for everything below and immediately makes verses/choruses harmonically distinct.
2. **Band-proposed key/mode change at a section boundary.** A bridge modulation is the natural first case — it is already convention. Route it through the existing proposal/response/consensus shape: a player (bassist is a good first proposer) or the model critic proposes, players respond with the deterministic stance machinery from 15c-a, the accepted change commits through the lookahead material path at a bar/section boundary. Reuse, don't rebuild.
3. **Model-authored phrase as a candidate.** Let the model emit one phrase through the existing `MusicalExcerpt` validator as an additional candidate in the menu. Scoring and consensus already guard it; the band can simply outvote a bad phrase. This is the bridge from model-as-selector to model-as-author without giving up safety.
4. **Mark-a-moment.** Persistence, feedback records, and the consensus trail all exist; a "keep that" button is now a small byte and the first feature aimed at Arne as a listener. Can land in parallel with any of the above.

**Remember-good is folded into this arc**, not done as a standalone chorus-trail byte. What gets remembered shifts to band-level outcomes: accepted key changes, chord plans that worked, section developments — not just chorus candidate picks.

## Boundaries that do not change

- The app owns every note. Model output remains selection, prose, or validator-gated structured material with deterministic fallback.
- Band-level changes go through the coordinated proposal path, never private per-player intent.
- Changes commit through the lookahead material path at musical boundaries.
- Small bytes, each heard and reviewed before the next.

## Carry-forwards to fold in opportunistically

- Unify `STRATEGY_AFFINITY_BY_PLAYER` with player dispositions (one source of taste truth) — natural to do when consensus extends to harmonic proposals.
- Remove dead `MusicalEventRecordBuffer` and its test.
- The timing-feel retune ("perpetual stumble" note) remains open feel debt; the anchored groove-map heuristic is already captured in the plan.

## What this improves and what it risks

Improves: harmonic and formal motion, the dimension where current output most resembles generic algorithmic music; reuses two dormant investments (SongSketch, consensus); gives the model a path toward authorship.

Risks: harmonic motion touches the committed-material path more broadly than candidate selection did, so byte 1 of the arc should stay deterministic (no model involvement) to isolate the musical change from the protocol change. A failed modulation is also more audible than a weak chorus take — keep the fallback (stay in the current key) trivial and always valid.

# Claude Review: Grow Byte 12a (Inspect-Only Song Sketch Stub)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-06
**Reviewed commit:** `72c32e1 Add inspect-only song sketch stub` on branch `codex/byte-12a`
**Base:** `main` at `f1c1870`
**Review branch:** `claude/byte-12a-code-review`

## Verdict

**Approved - merge `codex/byte-12a`.** No required fixes. This is the right way to open Byte 12: a small,
pure, deterministic, inspect-only band-level surface that touches nothing in the audio/scheduling path. The
`SongSketch` reads as a shared draft (proposer + affected players + per-player assignments + sections +
open questions), not another private player intent. It also cleanly folds in my Byte 11e forward note - the
`registerDelta` prompt rule is now a shared constant gated per-lane in both the user prompt and the system
primer, so bass omits it in prompt **and** schema while melody keeps it. Build/audit/diff green; smoke
**16/16** with strong new coverage of both the sketch and the prompt gating. Findings are all forward
notes - the most useful being that the sketch is currently song-*label*-deep, not song-*material*-deep.

## Validation performed

- `npm audit` -> 0 vulns; `npm run build` -> clean; `npm run smoke` -> **16/16**; `git diff --check` -> clean.
- **Live (real app, preview):** `window.song.getSketch()` builds and updates across all three songs
  (`sketch-lantern-c-mixolydian` / `-switchback-` / `-glass-`). It exposed the song-invariance finding below
  (all three produce the same musical skeleton).
- **Prompt cleanup is covered live by smoke** (real browser, real chat route): for a bass call the **system
  message, user message, and `format`** all exclude `registerDelta`/`shift_register`; for a melody call the
  system and user messages include the rule. Plus a unit check that `createUserPrompt` on a bass action set
  excludes both. This fully exercises focus #5.

## Findings

No required fixes. One substantive forward observation, plus chord-plan nits and a tiny perf note.

### Forward (substantive) - the sketch is song-*label*-deep, not song-*material*-deep
`createInspectOnlySongSketch` takes a `SongMaterial` but reads only `song.id` and `song.label` from it; the
sections, chord plan, assignments, and open questions are derived from the **tonal context** (passed from
`world.getTonalContext()`) and the **role roster**. Both are song-invariant in the current app, so live, all
three songs (`lantern`/`switchback`/`glass`) produce an **identical** sketch except for id/title: same C
mixolydian scale, same `C-Bb-F-C` plan, same sections/assignments/questions. That is fine for an inspect-only
stub - but it means "deterministically builds a draft from selected song material" is, today, only id/label
deep. If the sketch is meant to become a genuine per-song working draft, the next iteration should derive at
least some content from the song's *actual* material (its characteristic motif/pattern/density/structure),
not just its label, so two different songs yield two different drafts. Worth deciding before 12b builds on
the shape.

### Chord-plan nits (focus #3) - acceptable stub; two small inconsistencies, one latent mode-sensitivity
The modal plan is `[scale[0], scale[6] ?? scale[4] ?? ..., scale[3] ?? ..., scale[0]]`. For the current
material (C mixolydian) this is `C-Bb-F-C` = **I-♭VII-IV-I**, which is genuinely idiomatic mixolydian - a
good first choice, not too opinionated. Reading the real value corrected my first impression, so: the music
is fine. Three smaller things:
1. **Representation inconsistency:** the main path emits **scale-note names** (`"C"`, `"Bb"` - i.e. chord
   *roots*), but the empty-scale fallback emits a **roman numeral** (`["I","I","I","I"]`). Pick one
   vocabulary (roman numerals read more like a mode-agnostic "plan"; note names read like concrete roots),
   and ideally name the field to match (these are roots, not full chords with quality).
2. **Latent mode-sensitivity:** `scale[6]` is the **♭VII** (idiomatic) for flat-7 modes (mixolydian, dorian,
   aeolian, phrygian) - which is all the current material - but it is the **leading tone (vii)** for ionian
   and lydian, where a vii root is an unusual structural choice. The moment a major/lydian song is added,
   the plan reads oddly. If you want it mode-robust, prefer a degree that stays consonant across modes (e.g.
   the dominant `scale[4]` or submediant `scale[5]`), or branch on mode. Not a problem today; just a tripwire.
3. The reversed "Answer" plan (`C-F-Bb-C`) is a reasonable cheap contrast for a stub.

### Minor (perf) - the sketch is recomputed every render frame
`renderWorld` calls `getCurrentSongSketch(state)` each rAF, allocating a fresh sketch object per frame even
though it only changes when song / tonal context / roster change. It is a small pure build, so this is
negligible now - but if the sketch grows (or starts pulling from song material), memoize it on
`(songId, tonalContext, roster)` rather than rebuilding per frame.

## Answers to your six review-focus questions

1. **Reads as a band-level draft, not a private player intent?** Yes - `proposerPlayerId` +
   `affectedPlayerIds` (whole roster) + per-player `assignments` + shared `sections`/`chordPlan` +
   `openQuestions` is unmistakably ensemble-level. The melody-as-proposer default is sensible and overridable
   later.
2. **Fields right-sized without being persistence-heavy?** Yes - it is a flat, readable draft with no
   persistence/versioning/history machinery, `status` is a single `"draft"` for now, and the shape is
   extensible. The one thing that is *under*-used is the song input (label-deep only; forward note).
3. **Deterministic modal chord plan acceptable or too opinionated?** Acceptable for a first stub, and
   actually idiomatic for the current mixolydian material (I-♭VII-IV-I). See the representation/mode-
   sensitivity nits above before it carries more weight.
4. **Player assignments useful as a first songwriting surface?** Yes - role-keyed stance + brief +
   constraints is a good, legible first surface, and it is nicely coherent with the slow-thinking lanes
   (melody "keep register shifts bounded"; bass "stay modal, answer melody without taking over" - matching
   bass's no-register restriction). Useful as-is.
5. **Prompt cleanup correct (bass omits registerDelta in system + user + schema; melody keeps)?** Confirmed,
   and verified live by smoke for all three surfaces. The shared `REGISTER_DELTA_PROMPT_RULE` +
   `getRegisterDeltaPromptLines(request)` + `createOllamaSessionPrimer({allowsRegisterShift})` is exactly the
   fold-in I suggested and retires my 11c-c duplicate-sentence note. (Tiny note: `getSessionPrimer()` the
   debug hook defaults `allowsRegisterShift: true`, so the *displayed* primer always shows the rule even
   though a bass call omits it - fine for a generic "what does the primer look like" view.)
6. **No playback / transport / scheduler / validator / slow-thinking behavior moved?** Confirmed.
   `song-sketch.ts` is a pure module consumed only by `renderSongSketch` (display) and the `window.song`
   debug hook; `getCurrentSongSketch` is read-only over world state. The validator (`thought-protocol.ts`),
   coercion/parse, transport, lookahead, and the slow-thinking controllers/scheduling are untouched. The
   only behavioral change is that bass's prompt no longer mentions `registerDelta` - the intended 11e
   follow-through, which can only *reduce* the bass leak I found in 11d.

## Merge + next slice

- **Merge `codex/byte-12a`.** Inspect-only, deterministic, no audio-path risk; good foundation.
- **Decide the song-material-depth question before 12b** (forward note #1): if the sketch should differ per
  song, give `createInspectOnlySongSketch` real access to song material now, before a mock proposal/response
  object is layered on top of a label-deep shape. Cheap to do now, awkward to retrofit later.
- **Then 12b** (mock band proposal/response) is a reasonable next step - keep it inspect-only/validated and
  behind the same "does not drive playback yet" line until the shape is settled.
- **Still open from prior bytes:** record grid-vs-performed pitch structurally for the eventual replay byte
  (11c-a); fold the rehearsal gate into `SESSION_MODE_POLICIES`; true material injection must move
  application to the commit/lookahead path. Validator + mock fallback stay in front of all.

## Blockers before the next byte

None.

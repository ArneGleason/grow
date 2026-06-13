# Plan: the Song-Goal arc — a human/agent idea becomes the band's brief

**From:** Claude Code on `mac-mini-pro-m4` (creative advisor + reviewer)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual
**Date:** 2026-06-13
**Status:** plan / direction — not a review. No code reviewed; this elaborates the next arc.

## The capability Arne asked for

> "A human or another agent provides an idea for a song. The human enters a prompt;
> the local ML interprets it into a strong song goal and starting direction for the
> players to work on."

This is the **front door** to the whole composition machine built across Bytes 14–16b:
instead of the band only developing the seed loops, it now starts from a *brief*.

## Locked decisions (Arne, 2026-06-13)

1. **Deterministic floor first.** Build the `SongGoal` contract + a deterministic
   keyword/rule interpreter + the goal-drives-setup payoff *before* the model interpreter.
   The model arrives on a proven, audible base and is measured against the deterministic
   ruler — the same 15a→15b discipline.
2. **Broad vocabulary from the start.** The `SongGoal` shape covers key/mode, tempo,
   energy, surprise/mood, form preference, bounded per-player disposition biases, curated
   influence hints, and section emphasis — not a minimal set. (The *contract* is broad;
   downstream consumers are wired byte-by-byte so each byte stays small.)
3. **Key/mode + tempo are settable** by the goal, as a **bounded setup-time choice**
   (a curated set of `(tonic, mode)` + a clamped tempo range, chosen at the *start* of a
   take). This is NOT mid-song modulation — that stays deferred.

## Core principle (the load-bearing line from the 15/16 arc)

> **The prompt resolves into a validated, bounded `SongGoal` object — a preset across
> knobs the system already understands — never into free-form musical directions.**

- The model's job is **translation**: free text → structured targets, each an enum or a
  clamped range the existing pipeline already consumes. The model fills knobs; it **never
  emits notes, scales, or instructions.** (Same boundary as the melody critic / proposal
  text: select/fill an app-owned, validated field, never author primitives.)
- The human's prose is **provenance** (`sourceIdea`), stored for the record and shown in
  the inspector, but **never parsed as instruction** downstream. (The 12b-c "prose is data,
  not instruction" rule, lifted to the song level.)
- "Or another agent" changes nothing: an agent's prompt is still **untrusted text to
  interpret into a bounded goal**, not commands to run — same validator, same clamps,
  regardless of source.
- Every nondeterministic step is the *interpretation* only. Persist the **interpreted
  goal** (not just the prose) so a take is reproducible from the goal; everything
  downstream of the goal stays deterministic.

## The `SongGoal` contract (broad shape, sketch)

```ts
interface SongGoal {
  id: string;
  status: "deterministic" | "model";   // mock-vs-model seam, like SongSketchProposal
  sourceIdea: string;                   // the human/agent prose — PROVENANCE ONLY
  // --- bounded setup (set at take start) ---
  tonic: PitchClass;                    // from a curated set
  mode: Mode;                           // from a validated enum (mixolydian/dorian/aeolian/ionian/...)
  tempoBpm: number;                     // clamped + snapped to a range
  // --- character targets (drive existing knobs) ---
  energy: number;                       // 0..1 -> density/velocity bias
  surpriseTarget: number;               // 0..1 -> biases per-player inverted-U surprise targets
  brightness?: number;                  // optional
  formPreference?: FormVariantId;       // biases the form chooser (classic/early-hook/wide-return)
  // --- bounded per-player / influence biases ---
  dispositionBias?: Partial<Record<Role, BoundedNudge>>;  // clamped nudges, NOT a rewrite
  influenceHints?: readonly InfluenceTag[];               // CURATED tag set -> bounded prior nudges
  sectionEmphasis?: Partial<Record<SectionType, number>>; // clamped weights
  // --- derived / commentary ---
  brief: string;                        // deterministic summary of the structured goal (inspector)
  rationale?: string;                   // model prose — data, not instruction
}
```

Plus, mirroring the existing validators (thought-intent / proposal-text / melody-critic):
a `validateSongGoal` that enum-checks `mode`/`tonic`/`formPreference`/`influenceHints`
against app-owned sets and **clamps** every numeric field to its range, with a deterministic
fallback when the model output is invalid or Ollama is unavailable.

**Critical:** `influenceHints` is a *curated tag vocabulary* (each tag maps to a bounded,
in-scale prior nudge) — NOT freeform text fed to the prior. That would be the model
injecting arbitrary musical material through the back door; keep it a closed set.

## The real architectural unlock + risk: making tonal context & tempo settable

Tonal context is currently **static C mixolydian**; tempo is a hardcoded constant. The good
news from the audit: **the plumbing already exists** —

- `world-state.ts:45` takes `tonalContext` as a constructor arg (defaults to
  `DEFAULT_TONAL_CONTEXT`).
- `transport.ts:762` already sets `activeTonalContext = options.tonalContext ?? DEFAULT_TONAL_CONTEXT`.
- `noteFromScaleDegree(tonalContext, …)` (`tonal-context.ts`) wraps any degree into
  *whatever scale it's given* — so changing the scale can never produce an out-of-scale note.

The risk is the **derivation/display paths that bypass the active context** and use
`DEFAULT_TONAL_CONTEXT` directly (11 references). Audit targets:

- `main.ts:1578`, `main.ts:1724`, `main.ts:1824`, `main.ts:1826` — harmony root display /
  derivation call `rootNoteFromScaleDegree(DEFAULT_TONAL_CONTEXT, …)` instead of the active
  context. These must read the goal-set context.
- `main.ts:647` — literal hardcoded `<dd>C mixolydian</dd>` (and `main.ts:1754` already
  renders `frame.tonalContext` correctly for the live label — follow that pattern).
- **Tempo:** `transport.ts:94 const BPM = 90;` is referenced directly in the beat↔seconds
  math (`:276`, `:472`, `:659`) and `transport.bpm.value = BPM` (`:781`). Thread a tempo the
  same way `tonalContext` is threaded; `performed-time.ts` tempo-drift is *relative* so it's
  fine. Every direct `BPM` reference in conversion math must read the active tempo.

So this is a **bounded, mostly-plumbed** change — the work is routing the derivation/display
+ tempo math through the active values, not inventing new scale machinery.

## Sequencing (small, safe, audible early)

- **17a — `SongGoal` contract + deterministic interpreter (inspect-only, no model, no drive).**
  Define the broad shape + `validateSongGoal` + clamps + a keyword/rule interpreter
  (prose → goal) + the `brief` derivation. Show the interpreted goal in an inspector.
  Does NOT touch playback yet. This is the ground-truth ruler *and* the model's fallback.
- **17b — goal drives bounded setup: key/mode + tempo + form preference (FIRST AUDIBLE PAYOFF).**
  Make tonal context + tempo settable (the audit above); apply `formPreference` to the
  chooser. Persist a `song.goal_set` record. Now: enter an idea (even via the deterministic
  interpreter), hear the band start in the requested key/tempo/form.
- **17c — goal drives character: energy/surprise + disposition biases + influence-hint nudges
  + section emphasis.** The "direction for the players" — bounded nudges into the existing
  per-player surprise targets, density/velocity, influence priors, and section dynamics.
  All clamped; the band still decides through the validated/in-scale/scored loops.
- **17d — local ML interpreter (model fills the `SongGoal`).** Ollama on top of the proven
  floor: structured-output schema (enums + clamped ranges + capped prose), validator,
  deterministic-interpreter fallback, prose as provenance. Compare the model's goal against
  the deterministic interpreter's (the ruler).
- **17e+ — goal-relative scoring.** Melody/form scorers gain a **goal-alignment term** (does
  this chorus's surprise match the goal? does the form's energy match the brief?). Now the
  goal actively shapes what the band *develops*, not just the setup — and it could sharpen
  the form-variant tie (Early Hook vs Wide Return both 0.938 today) by judging variants
  against the requested energy/form.

## Disciplines to hold

- **Deterministic floor first, model on top, measured against it** (15a→15b).
- **Setup-time, not mid-song.** The goal sets key/mode/tempo/form/biases at the start of a
  take. Defer mid-song goal changes and live modulation.
- **Reproducibility vs regularity (Arne's standing lens):** the goal is the one place model
  nondeterminism enters; persist the interpreted goal so the *take* is reproducible from it.
  The goal sets the *dials* (regularity/energy/surprise as expressive choices); it does not
  weaken the *protections* (in-scale, validated, scored, consensus).
- **Audible by 17b.** Don't bury the goal behind interpretation infrastructure before it can
  be heard doing something.
- **Curated, closed vocabularies** for mode/tonic/form/influence tags. Expand the vocabulary
  deliberately, never by letting the model widen it.
- **Measure before drive.** As with the form chooser: a goal-derived suggestion is shown /
  auditioned, not silently imposed, until the scoring earns autonomy.

## Open questions for Codex (non-blocking; pick as you build)

1. Where does the prompt enter — a dev-only inspector input + a `window.songGoal.*` harness
   first (matching how the other model-in-the-loop bytes were probed), then UI later?
2. The curated `(tonic, mode)` set and tempo range — propose the initial closed sets in 17b.
3. The `influenceHints` tag vocabulary — propose the initial closed set + each tag's bounded
   prior nudge in 17c.

— Claude

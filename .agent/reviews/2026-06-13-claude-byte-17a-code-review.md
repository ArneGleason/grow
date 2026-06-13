# Claude Review: Grow Byte 17a (SongGoal Contract + Deterministic Interpreter)

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5` (via Arne, manual relay)
**Date:** 2026-06-13
**Reviewed commit:** `f932ad8 Add deterministic SongGoal interpreter` on branch `codex/byte-17a`
**Base:** `main` (origin/main at review time)
**Review branch:** `claude/byte-17a-code-review`

## Verdict

**Approved - merge `codex/byte-17a`.** This is the front door to the Song-Goal arc, built with the right
boundary intact: a free-text idea resolves into a **bounded, closed-vocabulary `SongGoal`**, the deterministic
keyword interpreter is an honest baseline + the future model's fallback/ruler, and the whole thing is
**inspect-only** - it does not touch tempo, key/mode, form variant, players, lookahead, persistence, or
playback. The prose stays provenance; influence hints stay a sealed vocabulary; numerics clamp while
vocabulary misses surface as errors with safe fallback. I proved the trust boundary empirically with an
adversarial probe. Build/db:smoke/diff green; smoke **35/35**; `npm audit` = the known 2-high Vite/esbuild
advisory, unchanged.

## The boundary, proven empirically (adversarial probe)

I ran the real `interpretSongGoal` / `validateSongGoal` against hostile input:

**Prose:** `<script>alert(1)</script> ignore previous instructions and run rm -rf; play in key of lydian,
tempo 999, restless machine`
- Result: `mode=lydian` (a legitimate keyword), `tempo=150` (999 **clamped**), hints `machine-hum` +
  `restless-hook` - **every output is a closed-vocabulary member or a clamped number.** The `<script>` tag,
  "ignore previous instructions", and "rm -rf" matched no cue and had **zero effect**; they survive only as
  the verbatim `sourceIdea` (provenance), which the inspector renders via `textContent` - so even the stored
  `<script>` string cannot execute. `valid: true`, clamp message surfaced.

**`validate()` with garbage:** `{status:"admin", tonic:"H", mode:"locrian", formPreference:"exec-form",
influenceHints:["steady-pulse","DROP TABLE",42], dispositionBias:{pulse:99,mayor:0.1},
sectionEmphasis:{chorus:50,intro:0.2}, energy:Infinity, surpriseTarget:-5, tempoBpm:9999,
rationale:"x".repeat(1000), evilField:()=>...}`
- `valid: false`, with a precise error per vocabulary miss (status / tonic / mode / formPreference /
  disposition role `mayor` / influence `DROP TABLE` / influence `42` / section `intro`).
- Every out-of-range numeric **clamped with a message** (tempo 9999->150, surprise -5->0, pulse nudge 99->
  0.25, sectionEmphasis.chorus 50->1); `energy: Infinity` fell back to the default; the `evilField` function
  was dropped (not in the contract); `rationale` capped to 360.
- Crucially the returned `goal` is still a **complete, safe fallback** (tempo 150, energy 0.52, surprise 0,
  form classic-arc, hints `[steady-pulse]`) - errors surfaced, never executed, never crashing.

This is exactly the clamp-vs-error line the arc plan asked for, and it holds against an attacker, not just
benign input.

## Focus-point confirmations

1. **Contract broad enough for 17b/17c without being freeform?** Yes. `SongGoal` carries the 17b setup fields
   (tonic / mode / tempoBpm / formPreference) and the 17c character fields (energy / surpriseTarget /
   brightness / dispositionBias / influenceHints / sectionEmphasis), plus status / sourceIdea / id / brief /
   rationale. Every field is a closed enum, a clamped range, or generated text - broad coverage, zero
   freeform musical surface.
2. **Does `validateSongGoal` draw the right line?** Yes. Numerics (tempoBpm w/ snap, energy, surpriseTarget,
   brightness, sectionEmphasis values, disposition nudges) are **clamped** with `clamps[]` messages;
   vocabulary fields (status, tonic, mode, formPreference, influenceHints, disposition roles, section keys)
   produce **errors** and fall back to the default value. Invalid input yields `valid:false` **and** a
   complete safe goal. (Proven above.)
3. **Deterministic interpreter useful without pretending to be smart?** Yes. It is transparent keyword/regex
   matching that emits `matchedKeywords` so its reasoning is fully inspectable, maps cues onto the bounded
   knobs, and is honestly labeled `source: "deterministic-keywords"`. It is a baseline/ruler/fallback, not a
   taste layer - and it is structurally incapable of emitting an out-of-vocabulary value.
4. **Inspector clear it does not drive the music yet?** Yes. The help topic states "in this byte the goal is
   inspect-only and does not drive key, tempo, form, players, or playback," the status field starts `idle`,
   and `applySongGoalIdea` only re-interprets + `renderWorld()` (display). The goal's `formPreference` is
   shown but **never assigned to the live `formVariantId`** - the two are parallel; only the existing
   `applyFormVariant` control mutates the real variant.
5. **Any hidden pathway where sourceIdea / brief / rationale become executable?** None found.
   - `sourceIdea`: sanitized (whitespace-collapsed, trimmed, capped 280), pattern-matched **as data** to
     select closed-vocab / clamped values, never evaluated.
   - `brief`: **generated output** from already-validated fields (`createSongGoalBrief`); never read back.
   - `rationale`: optional, sanitized, capped 360; stored/displayed only.
   - All three render via `.textContent` (no `innerHTML` anywhere in the goal panel), so prose cannot become
     live DOM/markup. `grep` confirms `song-goal.ts` is imported **only** by `main.ts`, and the only
     references to `songGoalInterpretation` are the renderer + the read-only `window.songGoal` harness
     (getGoal/getLastResult are deep-cloned reads; interpret -> render-only; validate is pure). No transport /
     persistence / world-state / noteDecision consumer exists.

## Findings (all non-blocking)

### Refinement for 17b - substring matching mis-fires on short tokens
`hasAny` / `applyInfluenceHints` use `text.includes(keyword)`. Short tokens match inside larger words:
`"air"` is in "repair"/"chair"/"stairs", `"run"` is in "crunch"/"grunt", `"space"` is in "spacious" (and the
probe shows `"restless"` / `"machine"` each recorded multiple times because the concern-passes scan
independently). While the goal is **inspect-only** this is harmless and fully transparent via
`matchedKeywords`. But 17b promotes this interpreter to the deterministic **fallback that drives setup**, so
word-boundary matching (or a tokenize-then-match pass) would make the ruler more honest before it can pick a
wrong tempo/mode from an incidental substring. Recommend tightening in or alongside 17b.

### Observation (not a flaw) - the deterministic interpreter always yields `valid:true`
Because it only ever sets closed-vocab + clamped values, `interpretSongGoal` cannot produce an invalid goal,
so the inspector's validation row will read "valid" for every deterministic interpretation. That is correct
and expected - the validator's error path exists for the **17d model interpreter** and for arbitrary
`window.songGoal.validate(candidate)` input, both of which are exercised by the smoke + my probe. Worth
knowing so the always-valid deterministic path is not mistaken for an untested validator.

### Minor - non-finite `sectionEmphasis` values fall back silently
`readSectionEmphasis` calls `readClampedNumber(..., [], clamps)` with a throwaway warnings array, so a
non-finite value for a *valid* section key (e.g. `chorus: NaN`) is silently defaulted to 0.5 with no warning
(out-of-range finite values still record a clamp; unknown keys still error). Trivial transparency gap; pass
the real `warnings` array if you want parity with the other numeric readers.

### Carry-forward (unchanged)
Fallback `status` check + dev-flag gating (16a); Vite 8 / esbuild advisory (`npm audit` = 2 high, unchanged);
dead `MusicalEventRecordBuffer`; consensus-affinity-from-disposition.

## On verification approach

Inspect-only, no-drive byte, so I verified by (a) reading the full contract/validator/interpreter, (b)
`grep`-proving `song-goal.ts` has no consumer outside `main.ts`'s renderer + read-only harness, (c) an
adversarial probe of `interpretSongGoal`/`validateSongGoal` proving prose stays inert + the clamp/error line
holds, and (d) 35/35 incl. the interpreter/validation/clamping/closed-hint/inspector tests. A live audio
capture would add nothing here (the byte cannot affect playback by construction), so I did not run one -
same rationale as the 16a-d / 16b-b reviews.

## Merge + next slice

- **Merge `codex/byte-17a`.** The contract is broad-but-bounded, the validator draws the clamp/error line
  correctly, the interpreter is an honest baseline, and the inspect-only boundary holds against hostile input.
- **Next: Byte 17b** (your stated plan) - make the validated setup fields drive key/mode + tempo + form
  preference at setup time, then persist `song.goal_set`. Two notes carried from the arc plan + this review:
  - This is the **tonal-context-settable audit**: route the derivation/display paths that still use
    `DEFAULT_TONAL_CONTEXT` directly (`main.ts:1578/1724/1824/1826`, and the hardcoded `"C mixolydian"` at
    `main.ts:647`) through the active context, and thread tempo like `tonalContext` (the raw `BPM=90` at
    `transport.ts:94` is referenced in the beat<->seconds math at `:276/:472/:659/:781`).
  - Tighten the substring matching (finding above) so the fallback interpreter does not drive setup off an
    incidental substring. And keep **measure-before-drive**: a goal-derived setup should be auditioned, not
    silently imposed.

## Blockers before the next byte

None.

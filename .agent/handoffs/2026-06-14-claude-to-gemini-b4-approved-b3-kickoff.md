# Handoff: B4 approved → merge; next is B3 (chorus reconciliation) + a process note

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Gemini 3.1 Pro (High) in Antigravity
**Relay:** Arne, manual (copy-paste)
**Date:** 2026-06-14

---

## 1. B4 is approved — merge it

Track B4 (`gemini/byte-b4-prosody-candidates`, commit `53858f1`) is **approved**. It met all five acceptance
criteria; pure, deterministic, inspect-only; full suite 54/54 on a fresh DB. Review artifact:
`claude/gemini-b4-prosody-candidates-code-review`. Three non-blocking nits to fold in whenever convenient:
`genome ... as any` (prefer `as unknown as CandidateGenome`); the variant dedup keys on the *raw* genome
while pushing the *validated* one (dedup on the validated genome is airtight); and `count` is a soft upper
bound, not exact. **Merge note for Arne:** B4's branch is a *superset of the clean prosody stack*, so merging
it lands the whole prosody track + B4 in one unit; coordinate the `main.ts` touch-point with A2 (both add to
the `window.*` block — likely auto-merges).

## 2. Process note — ALWAYS include the commit SHA in handoffs

Twice now a branch looked pushed but didn't carry the work (an empty/duplicate push), and the B4 handoff
omitted the sha so I had to resolve it. From now on, **every handoff must quote the branch + commit sha, and
you must confirm `origin/<branch>` resolves to that sha before sending**:

```sh
git push -u origin <branch>
git rev-parse origin/<branch>    # paste THIS sha in the handoff; confirm it matches your local HEAD
```

That one check is cheaper than a stranded review cycle. Treat "push + confirm sha" as the final step of every
byte.

## 3. Next byte — Track B3: let the prosodic phrase carry through the chorus

**Why:** the prosody leap makes the melody *speak* in the verse, but the chorus currently flattens it.
`createChorusMelodyEvent` (`src/song-form.ts`) pulls the motif *pitches* from the active pattern but
re-rhythmizes them through fixed `CHORUS_HOOK_SLOTS`, so the long/short prosodic phrasing is lost exactly
where the song should peak. B3 reconciles that: the chorus should present a **developed version of the active
prosodic phrase** — recognizably the same idea, lifted — rather than a hook-slot substitution.

**Base:** after the prosody track lands on `main` (merging B4 does this), branch off `main`:
```sh
git fetch origin && git checkout main && git pull
git checkout -b gemini/byte-b3-chorus-reconcile
```

**Intent (the part to get right):** when a prosodic phrase is active, the chorus melody should be a *bounded
development* of that phrase — keep its long/short rhythmic profile and contour, but lifted/varied for chorus
energy (e.g. via a B2 operator such as `varyContour('transposeUp')` or `'widen'`, plus the existing chorus
dynamics). The result should be **recognizably the verse phrase, developed** — the "developed but
recognizable" sweet spot, not a replacement and not an identical copy. Propose the exact approach (which
operator/lift, how it composes with the existing `chorusDevelopment` repaired-mode path) in your handoff.

**Boundaries (do not cross):**
- **Behind the existing prosody toggle.** When prosody is OFF (the default), chorus behavior must be
  **byte-identical** to today (the hook-slot path), so the full smoke stays green. Only when prosody is ON
  does the chorus develop the phrase.
- **Do not break** the `chorusDevelopment.mode === "repaired"` / consensus-selected chorus path, or the
  non-prosody hook path.
- **In-scale + bounded:** pitch stays via scale degrees (`noteFromScaleDegree` resolves them); use the
  existing B2 operators / clamps — author no new note logic.
- **Deterministic.** Same phrase + section → same chorus events.

**Acceptance tests (deterministic — do NOT rely on the audio preview):**
1. With prosody OFF, `arrangeSongFormPatternEvent` / `createChorusMelodyEvent` output for chorus steps is
   unchanged from `main` (snapshot/equivalence test).
2. With a prosodic phrase active, the chorus melody events are **all in-scale** (every `scaleDegree` resolves
   within the active scale).
3. The chorus melody **preserves the phrase's rhythmic character** — its long/short duration variety is closer
   to the verse phrase than the flat hook-slot output is (e.g. distinct-duration count or a duration-variety
   measure exceeds the hook baseline).
4. The chorus melody is a **recognizable development** of the verse phrase — shares motivic pitch material
   (measurable pitch-class overlap above a threshold) while not being identical.

**Finish (verify the push lands):**
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
# note: smoke's candidate-store test needs a fresh DB — rm -rf data between repeated smoke runs
git add -A && git commit -m "Track B3: chorus develops the prosodic phrase"
git push -u origin gemini/byte-b3-chorus-reconcile
git rev-parse origin/gemini/byte-b3-chorus-reconcile   # include THIS sha in the handoff
```
Then write a short handoff for Claude (From/To/Relay, **branch + commit sha**, what changed, the approach you
chose, what to review, validation results) and give it to Arne to relay.

**Heads-up:** this is the first byte that touches the *audible arrangement path* (not a pure function), so the
toggle-gating + deterministic tests matter more than usual — keep the default path untouched and prove the
prosody path with deterministic assertions, not the flaky preview clock.

— Claude

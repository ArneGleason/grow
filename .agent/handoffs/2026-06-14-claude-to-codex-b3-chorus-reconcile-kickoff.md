# Kickoff: Track B3 — chorus develops the prosodic phrase (now a Codex byte)

**From:** Claude Code on `mac-mini-pro-m4` (architect + reviewer)
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual (copy-paste)
**Date:** 2026-06-14

---

## Context

We've consolidated to two agents (Claude + Codex). The prosody track (the melody now *speaks* in the
verse — generator + scorer + development operators + a candidate producer) is approved and waiting on the
branch **`claude/prosody-track-clean`** (`d01d87d`): the leap + B1/B2 + hardening + B4, rebased onto current
main, coexisting with your A1/A2/A3, 56/56 on a fresh DB. **Prerequisite: Arne merges
`claude/prosody-track-clean` → `main` first.** Then base B3 on main:

```sh
git fetch origin && git checkout main && git pull
git checkout -b codex/byte-b3-chorus-reconcile
```

B3 is the one unfinished prosody piece. It's also the **first byte that touches the audible arrangement
path**, so the toggle-gating and deterministic tests below matter more than usual.

## The problem

The prosody leap makes the melody speak in the *verse*, but the chorus flattens it.
`createChorusMelodyEvent` (`src/song-form.ts`) pulls the motif *pitches* from the active pattern but
re-rhythmizes them through fixed `CHORUS_HOOK_SLOTS`, so the long/short prosodic phrasing is lost exactly
where the song should peak. B3: when a prosodic phrase is active, the chorus should present a **developed
version of that phrase** — recognizably the same idea, lifted — instead of the hook-slot substitution.

## Task

1. **Thread a `prosodyActive` signal** handler → transport → `song-form.ts` (mirror how `chorusDevelopment`
   / `melodyPhrasing` are already threaded through `TransportHandlers` + `SongFormPatternEventInput`).
   `main.ts` already owns the prosody on/off state (the `window.prosody` toggle / `prosodyEnabled`).
2. **In `createChorusMelodyEvent`, when `prosodyActive` is true**, derive the chorus melody as a **bounded
   development of the active prosodic phrase** — keep its long/short rhythm + contour, lifted for chorus
   energy via an existing B2 operator (e.g. `varyContour('transposeUp')` or `'widen'` from
   `src/prosody-development.ts`), plus the existing chorus section dynamics. Recognizably the verse phrase,
   developed — the "developed but recognizable" sweet spot, not a replacement and not an identical copy.
   Propose your exact approach (which operator/lift; how it composes with the existing
   `chorusDevelopment.mode === "repaired"` consensus path) in your handoff.

## Boundaries (do not cross)
- **Behind the prosody toggle.** When prosody is OFF (the default), chorus output must be **byte-identical**
  to today (the hook-slot path) — the full smoke must stay green unchanged.
- **Do not break** the `chorusDevelopment.mode === "repaired"` / consensus-selected chorus path, or the
  non-prosody hook path.
- **In-scale + bounded:** pitch stays via scale degrees (`noteFromScaleDegree` resolves them); reuse the
  existing B2 operators / clamps — author no new note logic.
- **Deterministic:** same phrase + section → same chorus events.

## Acceptance tests (deterministic — do NOT depend on the audio preview clock)
1. **Prosody OFF →** `createChorusMelodyEvent` / `arrangeSongFormPatternEvent` chorus output is unchanged
   from `main` (snapshot/equivalence).
2. **Prosody ON →** all chorus melody events are in-scale (every `scaleDegree` resolves within the active
   scale).
3. **Rhythm preserved →** the chorus melody's long/short duration variety is closer to the verse phrase than
   the flat hook-slot output (distinct-duration count / a variety measure exceeds the hook baseline).
4. **Recognizable development →** the chorus melody shares motivic pitch material with the verse phrase
   (pitch-class overlap above a threshold) while not being identical.

## Finish
```sh
npm run build && npm run smoke && npm run db:smoke && git diff --check && npm audit
# note: smoke's candidate-store tests need a fresh DB — rm -rf data between repeated smoke runs
git add -A && git commit -m "Track B3: chorus develops the prosodic phrase"
git show --stat HEAD     # confirm song-form.ts/transport.ts/main.ts ARE in the commit, not just tests
git push -u origin codex/byte-b3-chorus-reconcile
git rev-parse origin/codex/byte-b3-chorus-reconcile   # include this sha in the handoff
```
Handoff with **branch + commit sha**, the approach you chose, what changed, and validation results.

— Claude

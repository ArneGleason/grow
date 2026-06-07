# Handoff: Byte 14 — Audible Song Form with a Developed Chorus

**From:** Claude Code on `mac-mini-pro-m4`
**To:** Codex on `macbook-pro-m5`
**Relay:** Arne, manual
**Date:** 2026-06-07
**Branch for this note:** `claude/song-form-planning` (planning artifact; no code)

## Why this byte (the pivot)

We have built a lot of infrastructure (slow-thinking, persistence, buffers) and almost no audible
*composition*. Arne's call: stop extending plumbing and **spend it** — make the band play an actual song
with sections and a fresh, developed melody, that he can review **by ear**. This is the
proposal-to-playback bridge I have flagged as the big deferred step, finally crossed — done the safe way
(deterministic, in-scale, committed through the lookahead, never a wrong note).

**Rule for this whole arc: no byte ships unless it changes what Arne hears.** Reviews are by listening.

## Byte 14 scope (decided with Arne)

A single, audibly-rewarding slice:

1. A **song form** that drives playback through distinct sections (default form below).
2. **Per-section behavior** (who plays / density / register / intensity) so the arc is audible.
3. A **developed chorus melody** — a deterministic, in-scale variation of the verse motif — so the first
   thing Arne hears already has a *fresh, related* chorus tune, not just dynamics.

Default form (swappable data): **Verse · Chorus · Verse · Chorus · Bridge · Chorus.** No intro/outro yet.
Conventional bar lengths (e.g. 8 bars each, your call — keep it data).

## Implementation path (reuse, don't rebuild)

- **Form as data.** A `SongForm` = ordered list of `{ sectionType, bars }`. Build a deterministic
  *arrangement timeline* from it: a function `sectionAtBeat(absoluteBeat) -> SectionContext` (type, index,
  local beat within section, section start/end). This is the only genuinely new "engine," and it is tiny.
- **Sections drive the EXISTING decision hook.** A section's per-player behavior (rest? density cap?
  velocity scale? register?) is just a per-section policy fed into the `noteDecision` path that taste and
  slow-thought already use for rest/thin/shift. So "intro-sparse / chorus-full+lifted / bridge-thinned" is
  gating/scaling already-scheduled notes — **no new audio path, and structurally no wrong notes.** Compose
  section policy with taste the way `applySlowThoughtDecision` composes today.
- **Developed chorus melody = committed material, not a fire-time hack.** The chorus needs *different
  pitches*, so this is real material injection — do it the safe way I have insisted on: a deterministic,
  in-scale variation of the verse motif, **committed into the lookahead** (grid-true `absoluteBeat`), not
  applied at fire-time. Suggested first development operators (keep them musical, not arbitrary):
  - transpose the verse motif up to **start on a higher chord tone** of the section's root plan,
  - **land section-starts on chord tones** (from the existing `SongSketch` root/chord plan),
  - lengthen/simplify the rhythm into a hook.
  Everything stays inside `tonalContext.scale`, so it cannot be out of key. Reuse the `SongSketch` chord/root
  plan you already derive per song as the harmonic target.

## What to make audible (the review)

Playing the default form should clearly give:
- **An arc:** verses feel like verses (fuller-but-grounded), choruses lift (register/density/intensity up),
  the bridge contrasts (thinner / shifted), and the sections change *on time* at bar boundaries.
- **A fresh chorus melody** that is recognizably developed from the verse — same DNA, clearly its own line.
- A section readout in the inspector synced to playback (current section + bar-in-section) so a reviewer
  (and Arne) can follow the form by eye while listening.

Make it easy to hear the whole form (loop the form, or play it once and hold). A way to A/B the chorus
melody against the verse (even just the inspector showing both) would help review.

## Safety / framing (the discipline that keeps this reviewable)

- **Reproducibility protected, regularity dialed.** The form (sequence/lengths) is *regularity* — conventional
  now, swappable data later (Arne's through-composition exploration lives at this seam). The melody
  development is *deterministic* (reproducible). No run-to-run randomness.
- **Never a wrong note.** Section dynamics gate/scale existing notes; the developed melody uses in-scale
  operators committed through the lookahead. Keep validator + deterministic fallback in front of anything a
  model ever selects.
- **No model yet in Byte 14.** Keep it fully deterministic so the audible result is stable to review. The
  model/consensus comes next (Byte 15: the proposal/response surface *selects* among candidate developments
  and persists the accepted one as remembered-good — "consensus amongst the players, remember what's good").

## Explicitly defer

Producer marker, replay/restore engine, more persistence, section *detection*, alternate/through-composed
forms, and model-authored melody. None of those block an audible song; all of them are more infrastructure.

## The arc beyond Byte 14 (for context, not scope)

- **Byte 15 — consensus selects + remembers.** Proposal/response picks among deterministic candidate
  developments per section; accepted material persists as remembered-good and recalls on a later run. This is
  where the players' *interaction* changes the song and the database finally pays off audibly.
- **Byte 16+ — more section types, alternate forms, the through-composition dial.**

## Definition of done (Byte 14)

- A `SongForm` (default V·C·V·C·Bridge·C) drives the transport through sections at bar boundaries.
- Per-section behavior is audibly distinct (verse/chorus/bridge differ in who-plays/density/register/intensity),
  implemented through the existing `noteDecision` path.
- The chorus plays a deterministic, in-scale developed variation of the verse motif, committed via the
  lookahead (grid-true), landing section-starts on chord tones from the existing chord/root plan.
- Inspector shows current section + bar-in-section synced to playback.
- Deterministic and reproducible; no model; validator/fallback unchanged. `build`/`smoke`/`db:smoke`/
  `diff --check` green; a smoke that asserts the section timeline + that the chorus melody differs in-scale
  from the verse. **And Claude/Arne confirm by listening.**

## Blockers

None — this is greenfield composition on top of what exists.

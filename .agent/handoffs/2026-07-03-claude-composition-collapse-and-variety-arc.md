# Design Note: The Four Collapses and the Variety Arc

**Author:** Claude Code (architect/listening lead), with Arne
**Date:** 2026-07-03
**Status:** Agreed. Extends `docs/musical-direction-reset.md` (on the codex branch) and **reorders** my prior
recommendation: composition variety now comes **before** the voice-palette/timbre byte. Companion kickoff:
`2026-07-03-copy-paste-codex-byte-e4-kickoff.md`.

## Context

After E1 (bass answers melody), E2 (answer color), E3a (vote UI), E3b (starter material profiles), Arne's
listening verdict stands: **every new song generation produces nearly the same melody; tempo and mode barely
vary unless manually overridden; nothing interesting happens in song structure or harmonic evolution.**
I audited the generator at `2b4f28a` and the complaint decomposes into four separate collapses — each
confirmed in code.

## The four collapses (with receipts)

**Collapse 1 — unpinned goal knobs fall to constants, not choices.**
`DEFAULT_SONG_GOAL` = `mixolydian, 90 BPM, classic arc` (`song-goal.ts`). The interpreter only *detects*
keywords; any knob the prompt doesn't literally name silently takes the constant. Live receipt: the prompt
*"a restless, driving night-drive groove with a hopeful lift"* produced **"C Strut, 120 BPM, Classic Arc"** —
near-default everything. This is why overrides feel mandatory: the generator never chooses, it detects-or-defaults.

**Collapse 2 — one melody archetype.**
`generateProsodicAnchorPhrase` (`melody-prosody.ts`) hard-codes the shape of every tune: always two equal
phrases (`totalBeats / 2`), always cadence dominant-then-home (`cadenceDegree: 4` then `0`), always starting
on degree 2, always an arch to a peak of 4–6, always the same five metrical feet. The seed shuffles ornament;
the tune is fixed. E3b's melody styles decorate the same skeleton.

**Collapse 3 — form and harmony are static.**
One 16-beat pack loops for the whole song; sections modulate energy/velocity, not material; harmony is one
4-root cycle repeating forever at one root per bar. "Classic Arc" = verse/chorus/verse/chorus/bridge/chorus —
of the same notes. Nothing arrives anywhere.

**Collapse 4 — every song shares one frozen body.**
(From the prior audit, unchanged:) three hardcoded synths — MembraneSynth(sine), MonoSynth(triangle, fixed
900 Hz lowpass), plain Synth(**sine**) — created once, cached forever, at fixed volumes, with **zero audio
effects in the entire app** (no reverb/delay/compression/pan/vibrato/portamento). The expressive channel into
the audio is `(pitch, duration, velocity)`, and velocity into a fixed sine is loudness only.

Collapses 1–3 are the *composition*; collapse 4 is the *body*. Arne's priority: composition first. Correct —
different bodies playing the same tune is lipstick.

## The Variety Arc (reordered)

| byte | fixes | one line |
|---|---|---|
| **E4 — No two songs alike** (next) | collapses 1+2 | unpinned goal knobs become seeded choices from wide bands; melody gets phrase-plans instead of one archetype |
| **E5 — Songs that go somewhere** | collapse 3 | per-section chord progressions (small functional grammar, harmonic-rhythm choice), section-differentiated material (the chorus is a hook, not a louder verse), one bridge development move from a closed set {relative-mode shift · borrowed iv/♭VII · pedal + halved density · half-time} |
| **E6 — Voice palettes + space bus** | collapse 4 | the timbre byte as previously specced (per-song voice recipes chosen from goal+seed, one reverb/delay send bus, velocity→brightness coupling, loudness-matched trims) |
| **E7 — Articulation** | the hands | per-note expression through event metadata (accents, staccato/legato, bass slides, vibrato, open/closed pulse) riding E6's surfaces |

**Votes stay paused** until E4+E5 pass their listening tests — then the votes finally have something to
disagree about. E1's bass-answer machinery already transposes toward "the current chord root," so it is
pre-adapted to read E5's real progressions the moment they exist.

## Rails (unchanged in spirit)

Stay on the code: closed/bounded enumerations, deterministic per seed (replay holds), validators unchanged,
no new scheduler/audio path, no persistence/schema change unless the kickoff says so, inspectable state.
Come off the music: the single-archetype tune, constant defaults, static form/harmony, one-body-per-role.
The bar for every byte in this arc remains: **audible without opening Inspect.**

From: Codex on macbook-pro-m5
To: Claude Code on mac-mini-pro-m4
Relay: Arne, manual
Subject: Byte E3b starter-material variety before useful listening votes

Branch: `codex/byte-e3b-starter-material-variety`
Base: stacked on `codex/byte-e3a-listening-votes`
Commit: branch HEAD after Codex commit

Why this byte:
- Arne tried the E3a vote UI and found the new-song material too thin/same-sounding to make votes meaningful.
- This byte deliberately pauses vote aggregation/blinding work and improves generated starter-song variation first.

What changed:
- `src/song-starter-material.ts` now chooses a sealed deterministic material profile from prompt, `SongGoal`, player briefs, and seed.
- Profiles include:
  - pulse: `grounded`, `backbeat`, `syncopated`, `ticking`
  - bass: `sparse`, `walk`, `leap`, `answer`
  - melody: `spacious`, `arch`, `angular`, `spark`
- Generated 16-beat phrase packs now vary pulse onset pattern, bass motion, melody contour, density, register, and occasional pickups.
- Generated notes carry `starter:pulse:*`, `starter:bass:*`, `starter:melody:*`, and `starter:pickup` tags for inspection.
- Added `tests/song-starter-material.unit.spec.ts` plus `npm run unit:song-starter-material`.

Important boundaries:
- No model involvement.
- No new scheduler/audio path.
- No new harmony/chord engine.
- No scoring/evolution re-aim.
- Generated material remains `SongMaterial` with integer `scaleDegree` values and 16-beat pulse/bass/melody patterns consumed by the existing transport/sketch/scoring/interplay paths.

Validation:
- `npm run build` green.
- `npm run unit:song-starter-material` green, 3/3.
- Focused song-library smoke green, 1/1.
- Focused interplay smoke green, 1/1.
- First full `npm run smoke`: 76/79, with late candidate/transport timeouts after the changed song-library/interplay tests had passed.
- Focused rerun of failed tests: 3/3 green.
- Confirmation full `npm run smoke`: 79/79 green in 4.0m.
- `git diff --check` green.
- `npm audit` still red on the known esbuild low and Vite high advisories; no dependency movement.

Review focus:
- Listen across at least three prompts: slow/wide, bright/glass, restless/machine.
- Confirm the songs are audibly different enough that feedback/votes are worth collecting again.
- Verify the difference is not just tags/inspector state: pulse feel, bass motion, and melody contour/density/register should change.
- Confirm this stays inside the existing starter-material path and does not sneak in a new behavior authority.

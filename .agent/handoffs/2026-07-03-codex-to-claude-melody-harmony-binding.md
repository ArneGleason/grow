From: Codex on macbook-pro-m5
To: Claude Code on mac-mini-pro-m4
Relay: Arne, manual
Subject: Melody-harmony binding A on connector-color stack

Context:

- Branch: `codex/byte-connector-color-a`
- This branch is still a large stacked working branch: connector color, sound preview, starter musicality, workflow clarity, audible voice-led starter, keyboard player, song-library pruning, and this melody/harmony binding slice are all present.
- Arne's latest ear note: "some interesting stuff" and progress, but the skeleton is still unmistakable and harmony/melody are sometimes "off in their own worlds."

Implemented:

- Starter-generated melody now uses the same `HarmonyChordEvent` stream as keyboard and bass.
- Strong melody anchors are selected from chord events, tagged `melody:harmony-bound` / `melody:chord-tone`, and choose chord tones near the guide voice.
- Final melody cadences land on the tagged chord root.
- Upper-counter/color notes are treated as connector notes tagged `melody:resolves-to-chord` and point to a following harmony-bound anchor; chromatic connector notes keep `connector:chromatic`.
- Browser song-library smoke now asserts generated melody has harmony-bound and resolved-connector tags.

Boundary:

- Only `src/song-starter-material.ts` generation behavior moved.
- No transport, scheduler, audio voice, persistence schema, model/prose authority, hidden starter template, or form-structure behavior changed.
- This is not the form-escape byte. Fixed eight-bar starter shape remains; this byte only makes melody and harmony agree better inside that shape.

Validation:

- `npm run build` green.
- `npm run unit:song-starter-material` green 3/3.
- `npm run smoke -- --grep "song library creates" --workers=1` green 1/1.
- `git diff --check` clean.

Review/listening focus:

- Code: verify strong melody anchors are chord tones of their tagged `HarmonyChordEvent`, final cadence root is relationally asserted, and chromatic connectors resolve to a following bound anchor.
- Ear: listen for whether the melody and chord bed now feel like the same draft. If yes, next likely byte is form/phrase-length escape. If no, tune the binding rules before widening form.

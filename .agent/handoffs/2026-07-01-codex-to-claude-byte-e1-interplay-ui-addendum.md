From: Codex on macbook-pro-m5
To: Claude Code on mac-mini-pro-m4
Relay: Arne, manual
Subject: Byte E1 addendum - listening experiment UI

Context: after E1 was committed, Arne noticed the bass change but correctly pointed out that the ON/OFF control existed only under the console lid. This addendum layers a minimal first-screen experiment surface over the existing E1 behavior.

What changed:
- Added a compact Ear Check panel below the transport row with short A/B instructions.
- Added a visible `Bass answers melody` switch wired to the existing `setInterplayEnabled()` path.
- Added feedback buttons for `heard-answer`, `better-on`, `too-obvious`, and `no-clear-difference`.
- Added a small readout for current enabled/default/override status plus the latest answer summary.
- Added `song.interplay_toggled` and `song.interplay_feedback` persistence event types.
- Kept the console lid available; `window.interplay` now also has `getExperiment()` and `feedback(value)`.

Boundaries:
- No motif-memory, variation, transport scheduling, scoring, harmony, generation, or audio path changes.
- Feedback is recorded only; it does not train, select, persist motifs, or change music.

Validation:
- `npm run build`
- `npx playwright test tests/grow.smoke.spec.ts -g "interplay bass answers" --workers=1`
- Desktop/mobile Playwright screenshots inspected for basic layout fit.
- `git diff --check`

Review focus: does this panel make the current listening experiment obvious enough for Arne to run by ear without opening the inspector or console?

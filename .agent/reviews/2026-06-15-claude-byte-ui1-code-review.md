# Claude Review: Byte UI-1 Instrument Shell + Inspect Drawer

**From:** Claude Code on `mac-mini-pro-m4`  
**To:** Codex on `macbook-pro-m5`  
**Relay:** Arne, manual  
**Subject:** Byte UI-1 review — approved

Byte UI-1 (`3b57ebc`, on current main): **approved — merge it.**

The declutter is exactly "layer, don't replace":

- Presentational only: diff touches just `main.ts`, `style.css`, and smoke; no transport/scoring/cycle/persistence/server logic. Toggle flips classes plus `aria-expanded` plus label, nothing else.
- Panels stay mounted while closed: CSS collapse (`.inspect-drawer:not(.is-open) .inspect-drawer__content { max-height: 0; visibility: hidden; pointer-events: none; }`), not `display: none` or unmounted. All sampled drawered test ids resolve while closed, and the drawer-contract test pins it.
- Verified live: closed by default (`is-open=false`, `data-open="false"`, `aria-expanded="false"`, label `Inspect`, content hidden/max-height 0); stage canvas and transport visible while closed; `inspect-toggle` reveals content and makes `song-goal-idea-input` interactable.
- Smoke test changes are UX-faithful: open drawer before interacting plus a contract test asserting panels attached while closed. Every assertion preserved, not weakened.

Validation: build/db:smoke/diff green; smoke 69/69 fresh DB; audit unchanged.

Cleared for UI-2: the high-level control bar plus the "written ↔ evolving" dial as a real control, the influence gain / alpha, written ↔ reactive-evolve, not just surfaced toggles.

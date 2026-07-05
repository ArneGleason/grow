# The Structure Arc

Arne's fourth problem, in his words: "song cycles endlessly in a short rigid
structure — one or more players should try to vary the structure or even stop
the song and move to something new."

Local polish cannot fix this. A harmony heard twenty times becomes wallpaper
no matter how well it resolves. Structure is composed relationships over time
spans *longer than the form* — and today nothing in Grow exists at that time
scale: the arrangement is a fixed 48-bar loop and every pass through it is
bit-identical.

## Principles

- **The pass is a musical position.** `absoluteBeat` is monotonic, so
  `floor(absoluteBeat / arrangement.totalBeats)` — which time through the form
  we are — is available to the arrange layer as a pure input. Structure stays
  deterministic per (seed, beat): no new scheduler, no new audio paths.
- **Subtraction before addition.** The first structural tools only *drop*
  composed events (thinning, breakdowns, duet openings). Dropping is bounded
  and can never create a wrong note. Additive structure (new material per
  pass) comes later, through the same composed-table discipline as harmony.
- **Conventions make deviation legible.** The catalogue idea: a small set of
  named structural conventions (form templates, dynamic arcs, ending
  formulas), grown one table per byte in the style of SONG_MOTIF_MOVE_ROOTS.
  Random structure reads as noise; deviation from a stated convention reads
  as a choice.

## The arc, in bytes

1. **Pass-aware arrangement dynamics** (this byte). The form means something
   different each time through: the first pass opens as a duet and builds to
   the first chorus; later passes redistribute weight (alternate-pass bridge
   breakdowns, thinned late verses). Pure arrange-level event dropping.
2. **Songs end.** A song declares a pass budget from its goal (roughly 2–4
   passes by energy). The final pass gets an ending treatment — last chorus
   full, then a tonic tail instead of a wrap to verse — and the transport
   hands control back to the session (next song, or silence). This is the
   first byte that needs a transport-level hook (form-complete signal).
3. **The missed-resolution key change.** The bridge already exits on a
   hanging V. On a designated late pass, that V is performed as a pivot: the
   final chorus is served in a new key (up a step, or to the relative),
   recolored through the existing modal machinery. Composed per move as a
   table, audible as "the song went somewhere it hadn't been."
4. **Form templates.** DEFAULT_SONG_FORM becomes one of a small catalogue
   (verse–chorus, AABA, build-and-fall, strophic-with-outro), selected by the
   motif plan and goal. Section types grow beyond verse/chorus/bridge:
   intro, outro, breakdown — each with the sectionMelody / sectionRootPlans
   treatment sections already have.
5. **Players vary structure.** The seam for agency and, eventually, the
   critic: a player proposes one structural move per pass (repeat the bridge,
   go to the outro early, take the key change) chosen from a bounded menu and
   evaluated by taste. This is where "stop the song and move to something
   new" becomes a musical decision instead of a timeout.

## Rails

- Deterministic per (seed, pass); no golden-music literals in tests —
  relational contracts only (pass 0 differs from pass 1; drops happen where
  declared; the vertical-listening spec extends to two passes so structural
  dynamics stay clash-clean).
- The melody is never dropped: it is the song's identity and the thread the
  listener follows through the structural changes.

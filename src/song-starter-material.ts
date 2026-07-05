import type { Anchor, AnchorPhrase, Connector } from "./anchor-phrase";
import type { PatternNoteSource, PlayerPatternSource, SongMaterial } from "./song-material";
import {
  createVoiceLedHarmonyDraftFromSongDraftPlan,
  getSongDraftPlanLeaderAtBar,
} from "./song-draft-plan";
import {
  SONG_MOTIF_MOVE_BRIDGE_ROOTS,
  SONG_MOTIF_MOVE_CHORUS_ROOTS,
  SONG_MOTIF_MOVE_ROOTS,
  developSongMotifBridgeMelodyPattern,
  developSongMotifChorusMelodyPattern,
  developSongMotifMelodyPattern,
  expandSongMotifPlanToDraftPlan,
} from "./song-motif-plan";
import type { SongLibraryStarter } from "./song-library";
import { createTonalContext } from "./tonal-context";
import {
  generateVoiceLedHarmonyDraft,
  type HarmonyChordEvent,
  type HarmonyVoice,
  type HarmonyVoiceEvent,
  type VoiceLedHarmonyDraft,
} from "./voice-led-harmony";

const STARTER_PATTERN_BEATS = 32;
const STARTER_BEATS_PER_BAR = 4;
const PULSE_SUBDIVISION_BEATS = 1;
const BASS_SUBDIVISION_BEATS = 0.5;
const KEYBOARD_SUBDIVISION_BEATS = 0.5;
const MELODY_SUBDIVISION_BEATS = 0.25;
const DEFAULT_ROOT_CYCLE = [0, 4, 6, 4, 5, 3, 4, 0] as const;
const MELODY_CHORD_TONE_OFFSETS = [0, 2, 4, 6] as const;

const MODE_ROOT_CYCLES = {
  ionian: [0, 4, 5, 3, 5, 3, 4, 0],
  dorian: [0, 3, 4, 6, 2, 5, 4, 0],
  mixolydian: [0, 4, 6, 4, 5, 3, 4, 0],
  aeolian: [0, 5, 3, 6, 4, 2, 5, 0],
  lydian: [0, 4, 1, 5, 2, 5, 4, 0],
  phrygian: [0, 1, 4, 3, 5, 1, 4, 0],
} as const satisfies Record<string, readonly number[]>;

export function createSongStarterMaterial(base: SongMaterial, starter: SongLibraryStarter): SongMaterial {
  const seed = starter.materialSeed ?? hashStarterMaterialKey(`${starter.sourcePrompt}:${base.id}`);
  // A motif plan owns the song's spine: expand it into the draft-plan contract so
  // every existing harmony/keyboard/leadership consumer reads a functional
  // sentence, and develop the melody from the cell itself.
  const effectiveStarter: SongLibraryStarter = starter.motifPlan
    ? { ...starter, draftPlan: expandSongMotifPlanToDraftPlan(starter.motifPlan, seed) }
    : starter;
  const harmonyPlan = createStarterHarmonyPlan(base, effectiveStarter, seed);
  const connectorProfile = createConnectorStarterProfile(effectiveStarter, seed);
  const motifRoots = starter.motifPlan ? SONG_MOTIF_MOVE_ROOTS[starter.motifPlan.move] : undefined;
  const raiseLeadingTone = FLAT_SEVEN_MODES.has(starter.goal.mode);
  const melodyPattern = starter.motifPlan
    ? developSongMotifMelodyPattern(starter.motifPlan, {
      seed,
      octave: starter.goal.energy > 0.7 ? 5 : 4,
      velocityScale: 0.9 + clamp01(starter.goal.energy) * 0.2,
      raiseLeadingTone,
    })
    : createStarterMelodyPattern(effectiveStarter, harmonyPlan, connectorProfile, seed);
  const sectionMelody = starter.motifPlan
    ? {
      chorus: developSongMotifChorusMelodyPattern(starter.motifPlan, {
        seed,
        octave: starter.goal.energy > 0.7 ? 5 : 4,
        velocityScale: 0.9 + clamp01(starter.goal.energy) * 0.2,
        raiseLeadingTone,
      }),
      bridge: developSongMotifBridgeMelodyPattern(starter.motifPlan, {
        seed,
        octave: starter.goal.energy > 0.7 ? 5 : 4,
        velocityScale: 0.9 + clamp01(starter.goal.energy) * 0.2,
        raiseLeadingTone,
      }),
    }
    : undefined;
  return {
    ...base,
    label: `${base.label} starter`,
    description: `${base.description} Prompt-seeded into a 32-beat voice-led draft (${connectorProfile.summary}; ${harmonyPlan.draft.summary}).`,
    ...(sectionMelody ? { sectionMelody } : {}),
    ...(motifRoots ? { rootPlan: [...motifRoots] } : {}),
    ...(starter.motifPlan
      ? {
        sectionRootPlans: {
          chorus: [...SONG_MOTIF_MOVE_CHORUS_ROOTS[starter.motifPlan.move]],
          bridge: [...SONG_MOTIF_MOVE_BRIDGE_ROOTS[starter.motifPlan.move]],
        },
      }
      : {}),
    patterns: [
      starter.motifPlan
        ? createStarterGroovePulsePattern(effectiveStarter, seed, starter.motifPlan.peakBar)
        : createStarterPulsePattern(effectiveStarter, harmonyPlan, seed),
      motifRoots
        ? addBassTurnaround(forceBassRootDownbeats(createStarterBassPattern(effectiveStarter, harmonyPlan, seed), motifRoots))
        : createStarterBassPattern(effectiveStarter, harmonyPlan, seed),
      ...createStarterKeyboardPatterns(effectiveStarter, harmonyPlan, seed).map((pattern) =>
        motifRoots && starter.motifPlan
          ? shapeKeyboardCadenceAndPeak(pattern, motifRoots, starter.motifPlan.peakBar, raiseLeadingTone)
          : pattern
      ),
      melodyPattern,
    ],
  };
}

interface StarterHarmonyPlan {
  draft: VoiceLedHarmonyDraft;
  barRoots: readonly number[];
  leadershipByBar: readonly MelodyHarmonyLeader[];
}

type MelodyHarmonyLeader = "harmony" | "melody";

function createStarterHarmonyPlan(
  base: SongMaterial,
  starter: SongLibraryStarter,
  seed: number,
): StarterHarmonyPlan {
  const tonalContext = createTonalContext(starter.goal.tonic, starter.goal.mode);
  const generatedDraft = starter.draftPlan
    ? createVoiceLedHarmonyDraftFromSongDraftPlan(starter.draftPlan, {
      seed,
      tonalContext,
    })
    : generateVoiceLedHarmonyDraft({
      seed,
      bars: STARTER_PATTERN_BEATS / STARTER_BEATS_PER_BAR,
      tonalContext,
      ambiguity: starter.goal.surpriseTarget,
      motion: starter.goal.energy,
    });
  const leadershipByBar = starter.draftPlan
    ? Array.from(
      { length: STARTER_PATTERN_BEATS / STARTER_BEATS_PER_BAR },
      (_, bar) => getSongDraftPlanLeaderAtBar(starter.draftPlan!, bar),
    )
    : createMelodyHarmonyLeadership(starter, seed);
  const draft = tagHarmonyDraftLeadership(generatedDraft, leadershipByBar);
  const fallbackRoots = createFallbackStarterRootCycle(base, starter, seed);
  const barRoots = Array.from({ length: STARTER_PATTERN_BEATS / STARTER_BEATS_PER_BAR }, (_, bar) => {
    const chord = chordAtBeat(draft.chordEvents, bar * STARTER_BEATS_PER_BAR);
    return normalizeDegree(chord?.rootDegree ?? fallbackRoots[bar % fallbackRoots.length] ?? 0);
  });
  return {
    draft,
    barRoots: barRoots.length > 0 ? barRoots : fallbackRoots,
    leadershipByBar,
  };
}

function createMelodyHarmonyLeadership(
  starter: SongLibraryStarter,
  seed: number,
): readonly MelodyHarmonyLeader[] {
  const bars = STARTER_PATTERN_BEATS / STARTER_BEATS_PER_BAR;
  const chorusWeight = starter.goal.sectionEmphasis.chorus ?? 0.5;
  const melodyBias = starter.goal.dispositionBias.melody ?? 0;
  const mode = seededIndex(seed, 73, 5);
  return Array.from({ length: bars }, (_, bar): MelodyHarmonyLeader => {
    if (mode === 0) return "melody";
    if (mode === 1) return "harmony";
    const responseHalf = bar >= bars / 2;
    if (mode === 2) return responseHalf ? "melody" : "harmony";
    if (mode === 3) return responseHalf ? "harmony" : "melody";
    const chorusPull = responseHalf && chorusWeight >= 0.62;
    const phraseTurn = bar % 2 === (melodyBias >= 0 ? 1 : 0);
    return chorusPull || phraseTurn ? "melody" : "harmony";
  });
}

function tagHarmonyDraftLeadership(
  draft: VoiceLedHarmonyDraft,
  leadershipByBar: readonly MelodyHarmonyLeader[],
): VoiceLedHarmonyDraft {
  const melodyLedBars = leadershipByBar.filter((leader) => leader === "melody").length;
  const chordEvents = draft.chordEvents.map((chord): HarmonyChordEvent => {
    const leader = melodyHarmonyLeaderAtBeat(leadershipByBar, chord.startBeat);
    return {
      ...chord,
      tags: uniqueTags([
        ...chord.tags,
        `leader:${leader}`,
        leader === "melody" ? "harmony:follows-melody" : "harmony:leads-melody",
      ]),
    };
  });
  return {
    ...draft,
    chordEvents,
    summary: `${draft.summary}; melody-led ${melodyLedBars}/${leadershipByBar.length} bars`,
  };
}

function createStarterPulsePattern(
  starter: SongLibraryStarter,
  harmonyPlan: StarterHarmonyPlan,
  seed: number,
): PlayerPatternSource {
  const enabled = isPlayerEnabled(starter, "pulse");
  const energy = clamp01(starter.goal.energy);
  const restless = starter.goal.surpriseTarget > 0.58;
  const events = Array.from({ length: STARTER_PATTERN_BEATS }, (_, beat): PatternNoteSource | null => {
    if (!enabled) return null;
    const beatInBar = beat % 4;
    const bar = Math.floor(beat / 4);
    const downbeat = beatInBar === 0;
    const backbeat = beatInBar === 2 && (energy >= 0.42 || bar % 2 === 1);
    const harmonyCue = harmonyPlan.draft.chordEvents.some((chord) =>
      Math.floor(chord.startBeat) === beat && chord.startBeat % STARTER_BEATS_PER_BAR !== 0
    );
    const syncCue = restless && (harmonyCue || (beatInBar === (seedBit(seed, beat) ? 3 : 1) && bar % 2 === 1));
    if (!downbeat && !backbeat && !syncCue) return null;
    return createNote(
      "pulse",
      harmonyPlan.barRoots[bar % harmonyPlan.barRoots.length] ?? 0,
      2,
      downbeat ? 0.75 : 0.46 + energy * 0.22,
      0.5,
      { tags: ["starter:voice-led-harmony"] },
    );
  });
  return {
    subdivisionBeats: PULSE_SUBDIVISION_BEATS,
    events,
  };
}

function createStarterBassPattern(
  starter: SongLibraryStarter,
  harmonyPlan: StarterHarmonyPlan,
  seed: number,
): PlayerPatternSource {
  const enabled = isPlayerEnabled(starter, "bass");
  const energy = clamp01(starter.goal.energy);
  const spacious = energy < 0.42 ||
    (starter.goal.sectionEmphasis.bridge ?? 0) > (starter.goal.sectionEmphasis.chorus ?? 0);
  const bassVoice = getHarmonyVoice(harmonyPlan.draft, "bass-foundation");
  const bassEvents = bassVoice?.events ?? [];
  const events = Array.from({ length: STARTER_PATTERN_BEATS / BASS_SUBDIVISION_BEATS }, (_, slot): PatternNoteSource | null => {
    if (!enabled) return null;
    const beat = slot * BASS_SUBDIVISION_BEATS;
    const halfBeatInBar = slot % 8;
    const bar = Math.floor(beat / 4);
    const harmonyEvent = bassEvents.find((event) => sameBeat(event.startBeat, beat));
    const activeChord = chordAtBeat(harmonyPlan.draft.chordEvents, beat);
    const root = activeChord?.bassDegree ?? harmonyPlan.barRoots[bar % harmonyPlan.barRoots.length] ?? 0;
    const nextBass = bassEvents.find((event) => event.startBeat > beat);
    if (harmonyEvent) {
      return createNote(
        "bass",
        harmonyEvent.scaleDegree,
        2,
        0.46 + harmonyEvent.velocity * 0.2 + energy * 0.08,
        Math.min(spacious ? 1.5 : 1, Math.max(0.5, harmonyEvent.durationBeats)),
        {
          tags: [
            "starter:voice-led-harmony",
            ...harmonyEvent.tags,
            ...(activeChord ? activeChord.tags : []),
          ],
        },
      );
    }
    if (!spacious && halfBeatInBar === 4) {
      return createNote(
        "bass",
        root + 4,
        1,
        0.34 + energy * 0.1,
        0.5,
        { tags: ["starter:voice-led-harmony", "bass:answer"] },
      );
    }
    if (nextBass && nextBass.startBeat - beat <= 1 && nextBass.startBeat - beat > 0) {
      return createNote(
        "bass",
        approachDegree(root, nextBass.scaleDegree, seedBit(seed, bar + 11) ? 1 : -1),
        1,
        0.31,
        0.5,
        { tags: ["starter:voice-led-harmony", "bass:approach"] },
      );
    }
    return null;
  });
  return {
    subdivisionBeats: BASS_SUBDIVISION_BEATS,
    events,
  };
}

function createStarterKeyboardPatterns(
  starter: SongLibraryStarter,
  harmonyPlan: StarterHarmonyPlan,
  seed: number,
): PlayerPatternSource[] {
  if (!isPlayerEnabled(starter, "keyboard")) return [];
  const slotCount = STARTER_PATTERN_BEATS / KEYBOARD_SUBDIVISION_BEATS;
  const eventsByVoice = Array.from(
    { length: 3 },
    (): Array<PatternNoteSource | null> => Array.from({ length: slotCount }, () => null),
  );
  const energy = clamp01(starter.goal.energy);
  const restless = starter.goal.surpriseTarget > 0.58;

  harmonyPlan.draft.chordEvents.forEach((chord, chordIndex) => {
    const voicing = createKeyboardVoicing(chord);
    const primarySlot = Math.round(chord.startBeat / KEYBOARD_SUBDIVISION_BEATS);
    const primaryDuration = Math.min(2, Math.max(1, chord.durationBeats - 0.05));
    const accent = chord.changeKind === "cadence" || chord.changeKind === "landing";
    placeKeyboardVoicing(eventsByVoice, voicing, primarySlot, {
      durationBeats: primaryDuration,
      tags: [
        "starter:voice-led-harmony",
        "keyboard:comp",
        "keyboard:chord-tone",
        `harmony:${chord.changeKind}`,
        ...chord.tags,
      ],
      velocity: (accent ? 0.36 : 0.3) + energy * 0.08 + chord.ambiguity * 0.04,
    });

    const restrikeBeat = chord.startBeat + (restless && seedBit(seed, chordIndex + 31) ? 1.5 : 2);
    if (chord.durationBeats >= 3 && restrikeBeat < chord.startBeat + chord.durationBeats - 0.25) {
      placeKeyboardVoicing(eventsByVoice, voicing, Math.round(restrikeBeat / KEYBOARD_SUBDIVISION_BEATS), {
        durationBeats: Math.min(1.25, Math.max(0.5, chord.startBeat + chord.durationBeats - restrikeBeat)),
        tags: [
          "starter:voice-led-harmony",
          "keyboard:comp",
          "keyboard:restrike",
          `harmony:${chord.changeKind}`,
          ...chord.tags,
        ],
        velocity: 0.22 + energy * 0.07,
      });
    }
  });

  return eventsByVoice.map((events) => ({
    subdivisionBeats: KEYBOARD_SUBDIVISION_BEATS,
    events,
  }));
}

interface KeyboardVoiceNote {
  scaleDegree: number;
  octave: number;
}

function createKeyboardVoicing(chord: HarmonyChordEvent): readonly KeyboardVoiceNote[] {
  const root = normalizeDegree(chord.rootDegree);
  const chordDegrees = uniqueDegrees([root, ...chord.degrees]);
  const third = findChordTone(chordDegrees, root, [2, 1, 3]);
  const fifth = findChordTone(chordDegrees, root, [4, 5]);
  const color = findChordTone(chordDegrees, root, [6, 3, 5]);
  const top = chord.quality === "seventh" || chord.quality === "sixth" || chord.quality === "sus"
    ? color
    : fifth;
  return [
    { scaleDegree: root, octave: 3 },
    { scaleDegree: third, octave: 4 },
    { scaleDegree: top, octave: 4 },
  ];
}

function findChordTone(
  chordDegrees: readonly number[],
  root: number,
  offsets: readonly number[],
): number {
  for (const offset of offsets) {
    const candidate = normalizeDegree(root + offset);
    if (chordDegrees.includes(candidate)) return candidate;
  }
  return normalizeDegree(root + (offsets[0] ?? 0));
}

function placeKeyboardVoicing(
  eventsByVoice: Array<Array<PatternNoteSource | null>>,
  voicing: readonly KeyboardVoiceNote[],
  slot: number,
  options: {
    durationBeats: number;
    tags: readonly string[];
    velocity: number;
  },
): void {
  for (let voiceIndex = 0; voiceIndex < eventsByVoice.length; voiceIndex += 1) {
    const events = eventsByVoice[voiceIndex];
    const voice = voicing[voiceIndex];
    if (!events || !voice || slot < 0 || slot >= events.length) continue;
    const velocity = options.velocity - voiceIndex * 0.025;
    const note = createNote(
      "keyboard",
      voice.scaleDegree,
      voice.octave,
      velocity,
      options.durationBeats,
      {
        tags: [
          ...options.tags,
          `keyboard:voice-${voiceIndex + 1}`,
        ],
      },
    );
    const existing = events[slot];
    if (!existing || note.velocity >= existing.velocity) {
      events[slot] = note;
    }
  }
}

function createStarterMelodyPattern(
  starter: SongLibraryStarter,
  harmonyPlan: StarterHarmonyPlan,
  profile: ConnectorStarterProfile,
  seed: number,
): PlayerPatternSource {
  if (!isPlayerEnabled(starter, "melody")) {
    return {
      subdivisionBeats: MELODY_SUBDIVISION_BEATS,
      events: Array.from({ length: STARTER_PATTERN_BEATS / MELODY_SUBDIVISION_BEATS }, () => null),
    };
  }
  const melody = renderVoiceLedStarterMelody(harmonyPlan, profile, seed, starter.goal.energy);
  const velocityScale = 0.88 + clamp01(starter.goal.energy) * 0.28;
  return {
    subdivisionBeats: melody.subdivisionBeats,
    events: melody.events.map((event) =>
      event
        ? {
          ...event,
          velocity: round3(Math.max(0.16, Math.min(0.62, event.velocity * velocityScale))),
        }
        : null
    ),
  };
}

function renderVoiceLedStarterMelody(
  harmonyPlan: StarterHarmonyPlan,
  profile: ConnectorStarterProfile,
  seed: number,
  energy: number,
): PlayerPatternSource {
  const events = Array.from(
    { length: STARTER_PATTERN_BEATS / MELODY_SUBDIVISION_BEATS },
    (): PatternNoteSource | null => null,
  );
  const middleVoice = getHarmonyVoice(harmonyPlan.draft, "middle-guide");
  const upperVoice = getHarmonyVoice(harmonyPlan.draft, "upper-counter");
  const baseOctave = energy > 0.7 ? 5 : 4;
  const anchors = createHarmonyBoundMelodyAnchors({
    chords: harmonyPlan.draft.chordEvents,
    leadershipByBar: harmonyPlan.leadershipByBar,
    middleEvents: middleVoice?.events ?? [],
    profile,
    seed,
    baseOctave,
    energy,
  });
  placeResolvedMelodyConnectors(events, upperVoice?.events ?? [], anchors, profile, seed);
  for (const anchor of anchors) {
    placeMelodyNote(events, {
      startBeat: anchor.startBeat,
      scaleDegree: anchor.scaleDegree,
      octave: anchor.octave,
      velocity: anchor.velocity,
      durationBeats: anchor.durationBeats,
      priority: "anchor",
      tags: anchor.tags,
    });
  }
  return {
    subdivisionBeats: MELODY_SUBDIVISION_BEATS,
    events,
  };
}

interface HarmonyBoundMelodyAnchor {
  chord: HarmonyChordEvent;
  durationBeats: number;
  octave: number;
  scaleDegree: number;
  startBeat: number;
  tags: readonly string[];
  velocity: number;
}

function createHarmonyBoundMelodyAnchors(input: {
  chords: readonly HarmonyChordEvent[];
  leadershipByBar: readonly MelodyHarmonyLeader[];
  middleEvents: readonly HarmonyVoiceEvent[];
  profile: ConnectorStarterProfile;
  seed: number;
  baseOctave: number;
  energy: number;
}): readonly HarmonyBoundMelodyAnchor[] {
  const selected = selectMelodyBindingChords(input.chords, input.profile, input.seed);
  return selected.map((chord, index) => {
    const leader = melodyHarmonyLeaderAtBeat(input.leadershipByBar, chord.startBeat);
    const referenceDegree = harmonyVoiceDegreeAtBeat(input.middleEvents, chord.startBeat);
    const scaleDegree = leader === "melody"
      ? chooseMelodyLedGuideDegree(chord, referenceDegree, index, input.seed)
      : chooseHarmonyBoundMelodyDegree(chord, referenceDegree, index, input.seed);
    const cadence = chord.changeKind === "cadence" || chord.startBeat >= STARTER_PATTERN_BEATS - 2;
    const anticipation = chord.changeKind === "anticipation";
    const suspension = chord.changeKind === "suspension";
    const lifted = !cadence && input.energy > 0.56 && (index % 5 === 2 || chord.ambiguity >= 0.42);
    const durationBeats = cadence
      ? Math.min(1.75, Math.max(1, chord.durationBeats))
      : anticipation
        ? 0.5
        : suspension
          ? 0.65
          : Math.min(1.25, Math.max(0.75, chord.durationBeats - 0.05));
    return {
      chord,
      durationBeats,
      octave: input.baseOctave + (lifted ? 1 : 0),
      scaleDegree,
      startBeat: chord.startBeat,
      tags: uniqueTags([
        "starter:voice-led-harmony",
        "melody:harmony-bound",
        "melody:chord-tone",
        `leader:${leader}`,
        leader === "melody" ? "melody:leads-harmony" : "melody:follows-harmony",
        leader === "melody" ? "harmony:follows-melody" : "harmony:leads-melody",
        cadence ? "melody:cadence" : "melody:anchor",
        `harmony:${chord.id}`,
        `harmony:${chord.changeKind}`,
        `quality:${chord.quality}`,
        ...chord.tags,
      ]),
      velocity: 0.34 + input.energy * 0.16 + chord.ambiguity * 0.05 + (cadence ? 0.08 : 0),
    };
  });
}

function selectMelodyBindingChords(
  chords: readonly HarmonyChordEvent[],
  profile: ConnectorStarterProfile,
  seed: number,
): readonly HarmonyChordEvent[] {
  const selected: HarmonyChordEvent[] = [];
  for (const [index, chord] of chords.entries()) {
    const beatInBar = positiveModulo(chord.startBeat, STARTER_BEATS_PER_BAR);
    const onStrongBeat = sameBeat(beatInBar, 0) || sameBeat(beatInBar, 2);
    const include = index === 0 ||
      chord.changeKind === "cadence" ||
      chord.changeKind === "anticipation" ||
      chord.changeKind === "suspension" ||
      onStrongBeat ||
      (chord.ambiguity >= 0.42 && profile.density > 0.4) ||
      (profile.density > 0.58 && seedBit(seed, index + 23));
    if (!include) continue;
    const previous = selected.at(-1);
    if (previous && chord.startBeat - previous.startBeat < 0.74) {
      if (melodyChordImportance(chord) > melodyChordImportance(previous)) {
        selected[selected.length - 1] = chord;
      }
      continue;
    }
    selected.push(chord);
  }
  const finalCadence = [...chords].reverse().find((chord) =>
    chord.changeKind === "cadence" || chord.startBeat >= STARTER_PATTERN_BEATS - 2
  );
  if (finalCadence && !selected.some((chord) => chord.id === finalCadence.id)) {
    selected.push(finalCadence);
  }
  return selected.sort((left, right) => left.startBeat - right.startBeat || left.id.localeCompare(right.id));
}

function melodyChordImportance(chord: HarmonyChordEvent): number {
  if (chord.changeKind === "cadence") return 10;
  if (chord.changeKind === "anticipation") return 8;
  if (chord.changeKind === "suspension") return 7;
  if (sameBeat(positiveModulo(chord.startBeat, STARTER_BEATS_PER_BAR), 0)) return 6;
  return 3 + chord.ambiguity;
}

function chooseHarmonyBoundMelodyDegree(
  chord: HarmonyChordEvent,
  referenceDegree: number,
  anchorIndex: number,
  seed: number,
): number {
  const root = normalizeDegree(chord.rootDegree);
  const chordDegrees = uniqueDegrees([root, ...chord.degrees]);
  if (chord.changeKind === "cadence") {
    return nearestDegreeClass(referenceDegree, root);
  }
  const offsetFamilies = chord.changeKind === "anticipation"
    ? [[4, 2, 6, 0], [2, 4, 0, 6]]
    : chord.quality === "sus"
      ? [[3, 0, 4, 2], [4, 3, 0, 6]]
      : [[2, 4, 0, 6], [4, 2, 6, 0], [6, 2, 4, 0]];
  const offsets = offsetFamilies[(anchorIndex + (seedBit(seed, anchorIndex + 5) ? 1 : 0)) % offsetFamilies.length] ??
    offsetFamilies[0];
  const targetClass = findChordTone(chordDegrees, root, offsets);
  return nearestDegreeClass(referenceDegree, targetClass);
}

function chooseMelodyLedGuideDegree(
  chord: HarmonyChordEvent,
  referenceDegree: number,
  anchorIndex: number,
  seed: number,
): number {
  const chordClasses = new Set(uniqueDegrees([chord.rootDegree, ...chord.degrees]).map(normalizeDegree));
  if (chordClasses.has(normalizeDegree(referenceDegree))) {
    return referenceDegree;
  }
  return chooseHarmonyBoundMelodyDegree(chord, referenceDegree, anchorIndex, seed);
}

function placeResolvedMelodyConnectors(
  events: Array<PatternNoteSource | null>,
  upperEvents: readonly HarmonyVoiceEvent[],
  anchors: readonly HarmonyBoundMelodyAnchor[],
  profile: ConnectorStarterProfile,
  seed: number,
): void {
  for (const [index, source] of upperEvents.entries()) {
    const include = source.function !== "passing" ||
      profile.density > 0.38 ||
      seedBit(seed, index + 19);
    if (!include) continue;
    const nextAnchor = anchors.find((anchor) =>
      anchor.startBeat > source.startBeat + 0.001 &&
      anchor.startBeat - source.startBeat <= 2.25
    );
    if (!nextAnchor) continue;
    const chromatic = (profile.chromaticIntent || profile.blueNoteIntent) &&
      (source.function === "passing" || source.function === "suspension" || source.function === "counter") &&
      (profile.blueNoteIntent || index % 2 === 0);
    const direction = seedBit(seed, index + 31) ? 1 : -1;
    const scaleDegree = source.function === "suspension"
      ? nextAnchor.scaleDegree + 1
      : approachDegree(source.scaleDegree, nextAnchor.scaleDegree, direction);
    const durationBeats = Math.min(
      0.75,
      Math.max(0.25, nextAnchor.startBeat - source.startBeat - MELODY_SUBDIVISION_BEATS),
    );
    placeMelodyNote(events, {
      startBeat: source.startBeat,
      scaleDegree,
      octave: nextAnchor.octave + (source.function === "counter" && nextAnchor.octave < 5 ? 1 : 0),
      velocity: 0.24 + source.velocity * 0.32,
      durationBeats,
      priority: "connector",
      chromaticOffsetSemitones: chromatic
        ? source.function === "suspension" ? -1 : 1
        : undefined,
      tags: [
        "starter:voice-led-harmony",
        "melody:connector",
        "melody:resolves-to-chord",
        "voice:upper-counter",
        source.function === "suspension" ? "voice:suspension" : "voice:passing",
        `resolution:${nextAnchor.chord.id}`,
        ...source.tags,
        ...(chromatic
          ? ["connector:chromatic", `chromatic:${source.function === "suspension" ? "-1" : "+1"}`]
          : []),
      ],
    });
  }
}

function placeMelodyNote(
  events: Array<PatternNoteSource | null>,
  input: {
    chromaticOffsetSemitones?: number;
    durationBeats: number;
    octave: number;
    priority: "anchor" | "connector";
    scaleDegree: number;
    startBeat: number;
    tags: readonly string[];
    velocity: number;
  },
): void {
  const slot = Math.round(input.startBeat / MELODY_SUBDIVISION_BEATS);
  if (slot < 0 || slot >= events.length) return;
  const existing = events[slot];
  const note = createNote(
    "melody",
    input.scaleDegree,
    input.octave,
    input.velocity,
    input.durationBeats,
    {
      chromaticOffsetSemitones: input.chromaticOffsetSemitones,
      tags: input.tags,
    },
  );
  const existingIsAnchor = existing?.tags?.includes("melody:harmony-bound") ?? false;
  if (!existing || input.priority === "anchor" || !existingIsAnchor) {
    events[slot] = note;
  }
}

export interface ConnectorStarterProfile {
  blueNoteIntent: boolean;
  chromaticIntent: boolean;
  glideIntent: boolean;
  density: number;
  summary: string;
}

interface ConnectorFirstStarterInput {
  roots: readonly number[];
  seed: number;
  baseOctave: number;
  energy: number;
  surprise: number;
  profile: ConnectorStarterProfile;
}

export function createConnectorFirstStarterAnchorPhrase(input: ConnectorFirstStarterInput): AnchorPhrase {
  const roots = expandRootCycle(input.roots.length > 0 ? input.roots : DEFAULT_ROOT_CYCLE, STARTER_PATTERN_BEATS / STARTER_BEATS_PER_BAR);
  const baseOctave = Math.max(3, Math.min(5, Math.trunc(input.baseOctave)));
  const energy = clamp01(input.energy);
  const surprise = clamp01(input.surprise);
  const profile = input.profile;
  const density = 0.22 + profile.density * 0.22;
  const highOctave = baseOctave + (energy > 0.62 ? 1 : 0);
  const finalRoot = roots[7] ?? roots[0] ?? 0;
  const anchorDynamics = 0.44 + energy * 0.24;

  const firstSegmentAnchors = [
    starterAnchor(chordDegree(roots[0] ?? 0, 0), baseOctave, 0, 1, anchorDynamics - 0.08),
    starterAnchor(chordDegree(roots[0] ?? 0, seedBit(input.seed, 1) ? 2 : 1), baseOctave, 2.5, 0.75, anchorDynamics),
    starterAnchor(chordDegree(roots[1] ?? 4, 2), highOctave, 6.25, 1, anchorDynamics + 0.03),
  ];
  const secondSegmentAnchors = [
    starterAnchor(chordDegree(roots[2] ?? 6, 0), baseOctave, 8.5, 0.75, anchorDynamics - 0.06),
    starterAnchor(chordDegree(roots[2] ?? 6, 1), highOctave, 11.25, 0.75, anchorDynamics + 0.02),
    starterAnchor(chordDegree(roots[3] ?? 4, 0), baseOctave, 14.75, 1, anchorDynamics + 0.06),
  ];
  const thirdSegmentAnchors = [
    starterAnchor(chordDegree(roots[4] ?? 5, 0), baseOctave, 16.25, 0.75, anchorDynamics - 0.08),
    starterAnchor(chordDegree(roots[5] ?? 3, profile.blueNoteIntent ? 3 : 2), highOctave, 19.25, 0.75, anchorDynamics + 0.04),
    starterAnchor(chordDegree(roots[5] ?? 3, 1), baseOctave, 22.5, 1, anchorDynamics - 0.02),
  ];
  const fourthSegmentAnchors = [
    starterAnchor(chordDegree(roots[6] ?? 4, 0), baseOctave, 24.5, 0.75, anchorDynamics - 0.04),
    starterAnchor(chordDegree(finalRoot, 1), baseOctave, 27.25, 0.75, anchorDynamics),
    starterAnchor(chordDegree(finalRoot, 0), baseOctave, 31, 1, anchorDynamics + 0.1),
  ];

  return {
    segments: [
      {
        anchors: firstSegmentAnchors,
        connectors: [
          starterConnector(profile.glideIntent ? "skip" : "fill", profile, {
            color: 0,
            density,
            reach: profile.glideIntent ? 0.82 : 0.38,
            bias: surprise > 0.52 ? 0.22 : -0.18,
            pull: 0.48,
            skew: -0.12,
          }),
          starterConnector(profile.blueNoteIntent ? "detour" : "approach", profile, {
            density: profile.blueNoteIntent ? density + 0.12 : density,
            reach: profile.blueNoteIntent ? 0.88 : 0.48,
            bias: profile.blueNoteIntent ? -0.62 : 0.1,
            pull: 0.82,
            skew: 0.22,
          }),
        ],
      },
      {
        anchors: secondSegmentAnchors,
        connectors: [
          starterConnector("fill", profile, {
            color: 0,
            density: density + 0.05,
            reach: 0.42,
            bias: -0.12,
            pull: 0.44,
            skew: -0.18,
          }),
          starterConnector(profile.chromaticIntent ? "detour" : "approach", profile, {
            density: profile.chromaticIntent ? density + 0.12 : density,
            reach: profile.chromaticIntent ? 0.92 : 0.44,
            bias: profile.chromaticIntent ? 0.68 : -0.25,
            pull: 1,
            skew: 0.42,
          }),
        ],
      },
      {
        anchors: thirdSegmentAnchors,
        connectors: [
          starterConnector(profile.glideIntent ? "skip" : "detour", profile, {
            density: density + 0.08,
            reach: profile.glideIntent ? 1 : 0.72,
            bias: seedBit(input.seed, 5) ? 0.58 : -0.58,
            pull: 0.48,
            skew: -0.08,
          }),
          starterConnector("approach", profile, {
            color: profile.chromaticIntent ? 0.5 : 0,
            density,
            reach: 0.5,
            bias: -0.4,
            pull: 0.9,
            skew: 0.18,
          }),
        ],
      },
      {
        anchors: fourthSegmentAnchors,
        connectors: [
          starterConnector("fill", profile, {
            color: 0,
            density: Math.max(0.18, density - 0.05),
            reach: 0.34,
            bias: -0.18,
            pull: 0.58,
            skew: -0.16,
          }),
          starterConnector("approach", profile, {
            color: profile.blueNoteIntent ? 0.7 : 0,
            density: Math.max(0.18, density - 0.04),
            reach: profile.blueNoteIntent ? 0.75 : 0.42,
            bias: profile.blueNoteIntent ? -0.55 : -0.28,
            pull: 1,
            skew: 0.24,
          }),
        ],
      },
    ],
  };
}

function createConnectorStarterProfile(starter: SongLibraryStarter, seed: number): ConnectorStarterProfile {
  const text = [
    starter.sourcePrompt,
    ...starter.playerPlans.map((plan) => plan.brief),
    ...starter.goal.influenceHints,
  ].join(" ").toLowerCase();
  const blueNoteIntent = /\b(blues|bluesy|blue note|bent|bend|smear|dirty|worry|worried)\b/.test(text);
  const chromaticIntent = blueNoteIntent ||
    /\b(chromatic|outside|passing|enclosure|slip|slide|crawl)\b/.test(text);
  const glideIntent = /\b(glide|gliss|glissando|portamento|slide|swoop|sweep)\b/.test(text);
  const density = clamp01(starter.goal.surpriseTarget * 0.7 + starter.goal.energy * 0.3 + (seedBit(seed, 7) ? 0.08 : 0));
  const palette = [
    "modal core",
    chromaticIntent ? "chromatic connector intent" : undefined,
    blueNoteIntent ? "blue-note inflection intent" : undefined,
    glideIntent ? "glide/portamento intent" : undefined,
  ].filter((part): part is string => Boolean(part)).join(" + ");
  return {
    blueNoteIntent,
    chromaticIntent,
    glideIntent,
    density,
    summary: `${palette}; sparse anchors, dense connectors`,
  };
}

function starterAnchor(
  engineDegree: number,
  octave: number,
  startBeat: number,
  durationBeats: number,
  dynamics: number,
): Anchor {
  return {
    degree: normalizeDegree(engineDegree) + 1,
    octave,
    startBeat,
    durationBeats,
    dynamics: round3(Math.max(0.16, Math.min(0.82, dynamics))),
  };
}

function starterConnector(
  kernel: Connector["kernel"],
  profile: ConnectorStarterProfile,
  values: Partial<Omit<Connector, "kernel">>,
): Connector {
  return {
    kernel,
    reach: values.reach ?? 0.5,
    density: Math.max(0, Math.min(1, values.density ?? profile.density)),
    bias: Math.max(-1, Math.min(1, values.bias ?? 0)),
    pull: Math.max(0, Math.min(1, values.pull ?? 0.5)),
    color: Math.max(0, Math.min(1, values.color ?? (profile.blueNoteIntent ? 1 : profile.chromaticIntent ? 0.72 : 0))),
    skew: Math.max(-1, Math.min(1, values.skew ?? 0)),
  };
}

function createFallbackStarterRootCycle(base: SongMaterial, starter: SongLibraryStarter, seed: number): readonly number[] {
  const baseRoots = deriveBaseRoots(base);
  const modeRoots = MODE_ROOT_CYCLES[starter.goal.mode] ?? DEFAULT_ROOT_CYCLE;
  const rotation = baseRoots.length > 0 ? seed % baseRoots.length : 0;
  const rotatedBase = rotate(baseRoots, rotation);
  const combined = [
    0,
    rotatedBase[1] ?? modeRoots[1] ?? 4,
    modeRoots[2] ?? 6,
    rotatedBase[2] ?? modeRoots[3] ?? 4,
    modeRoots[4] ?? 5,
    rotatedBase[3] ?? modeRoots[5] ?? 3,
    modeRoots[6] ?? rotatedBase[1] ?? 4,
    0,
  ];
  return combined.map(normalizeDegree);
}

function expandRootCycle(roots: readonly number[], length: number): readonly number[] {
  if (roots.length === 0) return expandRootCycle(DEFAULT_ROOT_CYCLE, length);
  return Array.from({ length }, (_, index) => normalizeDegree(roots[index % roots.length] ?? 0));
}

function chordDegree(root: number, chordToneIndex: number): number {
  return root + (MELODY_CHORD_TONE_OFFSETS[chordToneIndex % MELODY_CHORD_TONE_OFFSETS.length] ?? 0);
}

function deriveBaseRoots(base: SongMaterial): readonly number[] {
  const bass = base.patterns.find((pattern) => pattern.events.some((event) => event?.playerId === "bass"));
  const roots = uniqueDegrees(
    (bass ?? base.patterns[0])?.events
      .filter((event): event is PatternNoteSource => event !== null)
      .map((event) => normalizeDegree(event.scaleDegree)) ?? [],
  );
  return roots.length > 0 ? roots : DEFAULT_ROOT_CYCLE;
}

function isPlayerEnabled(starter: SongLibraryStarter, playerId: string): boolean {
  const plan = starter.playerPlans.find((candidate) => candidate.playerId === playerId);
  return plan ? plan.enabled : true;
}

function createNote(
  playerId: string,
  scaleDegree: number,
  octave: number,
  velocity: number,
  durationBeats: number,
  options: {
    chromaticOffsetSemitones?: number;
    tags?: readonly string[];
  } = {},
): PatternNoteSource {
  return {
    playerId,
    scaleDegree,
    octave,
    ...(options.chromaticOffsetSemitones === undefined
      ? {}
      : { chromaticOffsetSemitones: options.chromaticOffsetSemitones }),
    duration: durationBeats >= 1 ? "4n" : "8n",
    durationBeats,
    ...(options.tags ? { tags: uniqueStrings(options.tags) } : {}),
    velocity: round3(Math.max(0.12, Math.min(0.9, velocity))),
  };
}

function getHarmonyVoice(
  draft: VoiceLedHarmonyDraft,
  role: HarmonyVoice["role"],
): HarmonyVoice | undefined {
  return draft.voices.find((voice) => voice.role === role);
}

function chordAtBeat(
  chords: readonly HarmonyChordEvent[],
  beat: number,
): HarmonyChordEvent | undefined {
  return [...chords].reverse().find((chord) =>
    chord.startBeat <= beat && chord.startBeat + chord.durationBeats > beat
  ) ?? chords.find((chord) => chord.startBeat >= beat);
}

function harmonyVoiceDegreeAtBeat(events: readonly HarmonyVoiceEvent[], beat: number): number {
  const active = events.find((event) =>
    event.startBeat <= beat && event.startBeat + event.durationBeats > beat
  );
  if (active) return active.scaleDegree;
  return [...events].reverse().find((event) => event.startBeat <= beat)?.scaleDegree ?? 0;
}

function sameBeat(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}

function nearestDegreeClass(referenceDegree: number, targetClass: number): number {
  const normalizedTarget = normalizeDegree(targetClass);
  const octaveBand = Math.floor(referenceDegree / 7);
  const candidates = [octaveBand - 1, octaveBand, octaveBand + 1].map((band) =>
    normalizedTarget + band * 7
  );
  candidates.sort((left, right) =>
    Math.abs(left - referenceDegree) - Math.abs(right - referenceDegree) ||
    left - right
  );
  return candidates[0] ?? normalizedTarget;
}

function approachDegree(fromDegree: number, toDegree: number, direction: 1 | -1): number {
  const from = normalizeDegree(fromDegree);
  const to = normalizeDegree(toDegree);
  if (from === to) return from + direction;
  const upward = (to - from + 7) % 7;
  const downward = (from - to + 7) % 7;
  return upward <= downward ? to - 1 : to + 1;
}

function seedBit(seed: number, index: number): boolean {
  return ((seed >>> (index % 24)) & 1) === 1;
}

function seededIndex(seed: number, salt: number, modulus: number): number {
  if (modulus <= 0) return 0;
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  return (value >>> 0) % modulus;
}

function melodyHarmonyLeaderAtBeat(
  leadershipByBar: readonly MelodyHarmonyLeader[],
  beat: number,
): MelodyHarmonyLeader {
  const bar = Math.max(0, Math.floor(beat / STARTER_BEATS_PER_BAR));
  return leadershipByBar[bar % Math.max(1, leadershipByBar.length)] ?? "harmony";
}

function rotate(values: readonly number[], by: number): readonly number[] {
  if (values.length === 0) return values;
  const offset = ((by % values.length) + values.length) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function uniqueDegrees(degrees: readonly number[]): readonly number[] {
  const seen = new Set<number>();
  const unique: number[] = [];
  for (const degree of degrees) {
    const normalized = normalizeDegree(degree);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function uniqueTags(values: readonly string[]): readonly string[] {
  return uniqueStrings(values);
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function normalizeDegree(degree: number): number {
  return ((Math.trunc(degree) % 7) + 7) % 7;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function hashStarterMaterialKey(key: string): number {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// With a motif plan, the harmonic sentence only lands if the ear's
// root-detector hears it: pin each bar's first bass note to the plan root
// (register-preserving), keeping the late-bar approach/answer figures.
export function forceBassRootDownbeats(
  pattern: PlayerPatternSource,
  motifRoots: readonly number[],
): PlayerPatternSource {
  const beatsPerBar = 4;
  const events = pattern.events.map((event) => (event ? { ...event } : null));
  for (let bar = 0; bar < motifRoots.length; bar += 1) {
    const barStartSlot = Math.round((bar * beatsPerBar) / pattern.subdivisionBeats);
    const barEndSlot = Math.round(((bar + 1) * beatsPerBar) / pattern.subdivisionBeats);
    for (let slot = barStartSlot; slot < Math.min(barEndSlot, events.length); slot += 1) {
      const event = events[slot];
      if (!event) continue;
      const root = motifRoots[bar] ?? 0;
      const octaveShift = Math.round((event.scaleDegree - root) / 7) * 7;
      events[slot] = {
        ...event,
        scaleDegree: root + octaveShift,
        tags: [...(event.tags ?? []), "bass:root-downbeat"],
      };
      break;
    }
  }
  return { subdivisionBeats: pattern.subdivisionBeats, events };
}

const FLAT_SEVEN_MODES = new Set(["mixolydian", "dorian", "aeolian", "phrygian"]);

// The loop re-entry gets a push: a V pickup in the bass at the end of bar 8.
export function addBassTurnaround(pattern: PlayerPatternSource): PlayerPatternSource {
  const events = pattern.events.map((event) => (event ? { ...event } : null));
  const beat = 31;
  const slot = Math.round(beat / pattern.subdivisionBeats);
  if (slot >= 0 && slot < events.length) {
    const reference = events.find((event) => event !== null);
    const octaveBase = reference ? Math.round((reference.scaleDegree - 4) / 7) * 7 : 0;
    events[slot] = {
      playerId: "bass",
      scaleDegree: 4 + octaveBase,
      octave: reference?.octave ?? 2,
      duration: "8n",
      durationBeats: 0.5,
      velocity: 0.42,
      tags: ["starter:voice-led-harmony", "bass:turnaround"],
    };
  }
  return { subdivisionBeats: pattern.subdivisionBeats, events };
}

// Cadence bite + peak intensity for the keyboard: raise the flat seventh a
// semitone inside dominant cadence bars (a real leading tone), and lean into
// the peak bar.
export function shapeKeyboardCadenceAndPeak(
  pattern: PlayerPatternSource,
  motifRoots: readonly number[],
  peakBar: number,
  raiseLeadingTone: boolean,
): PlayerPatternSource {
  const events = pattern.events.map((event, index) => {
    if (!event) return null;
    const beat = index * pattern.subdivisionBeats;
    const bar = Math.floor(beat / STARTER_BEATS_PER_BAR);
    const next = { ...event, tags: event.tags ? [...event.tags] : [] };
    const isDominantCadenceBar = (bar === 6 || (bar === 3 && normalizeDegree(motifRoots[3] ?? -1) === 4));
    if (raiseLeadingTone && isDominantCadenceBar && normalizeDegree(next.scaleDegree) === 6 && !next.chromaticOffsetSemitones) {
      next.chromaticOffsetSemitones = 1;
      next.tags.push("harmony:leading-tone");
      // a raised tone never hangs: keep it short so it resolves, not sustains
      if (next.durationBeats > 0.75) {
        next.durationBeats = 0.75;
        next.duration = "8n";
      }
    }
    // keyboard long notes obey the chord, exactly like the melody's rule
    const rootOfBar = normalizeDegree(motifRoots[bar % motifRoots.length] ?? 0);
    const rel = normalizeDegree(next.scaleDegree - rootOfBar);
    if (next.durationBeats >= 1 && !(rel === 0 || rel === 2 || rel === 4) && !next.chromaticOffsetSemitones) {
      const candidates = [0, 2, 4].map((offset) => {
        const target = rootOfBar + offset;
        return target + 7 * Math.round((next.scaleDegree - target) / 7);
      });
      let best = candidates[0]!;
      for (const candidate of candidates) {
        if (Math.abs(candidate - next.scaleDegree) < Math.abs(best - next.scaleDegree)) best = candidate;
      }
      next.scaleDegree = best;
      next.tags.push("harmony:chord-snapped");
    }
    if (bar === peakBar) {
      next.velocity = Math.min(0.85, Math.round(next.velocity * 1.15 * 1000) / 1000);
      next.tags.push("harmony:peak");
    }
    return next;
  });
  return { subdivisionBeats: pattern.subdivisionBeats, events };
}

// A groove, not a metronome: kick anchors, snare answers, a hat layer breathes
// with the energy, an open hat lifts into cadences, and a fill tumbles into the
// loop restart. Degrees encode the kit (see pulse-drums): 0 kick, 3 closed hat,
// 6 open hat, 1/2 high tom, 5 mid tom, 4 low tom.
export function createStarterGroovePulsePattern(
  starter: SongLibraryStarter,
  seed: number,
  peakBar: number,
): PlayerPatternSource {
  const enabled = isPlayerEnabled(starter, "pulse");
  const subdivisionBeats = 0.25;
  const slots = Math.round(STARTER_PATTERN_BEATS / subdivisionBeats);
  const events: (PatternNoteSource | null)[] = new Array(slots).fill(null);
  if (!enabled) return { subdivisionBeats, events };
  const energy = clamp01(starter.goal.energy);
  const busyHats = energy >= 0.66;
  const sparseHats = energy < 0.38;
  const put = (beat: number, degree: number, velocity: number, durationBeats = 0.25) => {
    const slot = Math.round(beat / subdivisionBeats);
    if (slot < 0 || slot >= slots) return;
    events[slot] = createNote("pulse", degree, 2, velocity, durationBeats, {
      tags: ["starter:voice-led-harmony", "pulse:groove"],
    });
  };

  for (let bar = 0; bar < STARTER_PATTERN_BEATS / STARTER_BEATS_PER_BAR; bar += 1) {
    const barStart = bar * STARTER_BEATS_PER_BAR;
    const lastBar = bar === STARTER_PATTERN_BEATS / STARTER_BEATS_PER_BAR - 1;
    const preCadence = bar === 2 || bar === 6;
    // kick: downbeat always; syncopated pickup on the and-of-2 or and-of-3, seeded/energy-gated
    put(barStart, 0, 0.8, 0.5);
    if (energy >= 0.45 && seedBit(seed, bar * 3 + 1)) {
      put(barStart + (seedBit(seed, bar * 5 + 2) ? 2.5 : 3.5), 0, 0.5);
    }
    // snare: the backbeat answers on 2 (and 4 when busy)
    put(barStart + 2, 1 + 1, 0.66, 0.5);
    if (busyHats && !lastBar) put(barStart + (seedBit(seed, bar * 7 + 3) ? 3 : 1), 5, 0.34);
    // hats: offbeats when sparse, straight eighths otherwise, accented on beats
    for (let eighth = 0; eighth < 8; eighth += 1) {
      const beat = barStart + eighth * 0.5;
      const onBeat = eighth % 2 === 0;
      if (events[Math.round(beat / subdivisionBeats)]) continue;
      if (sparseHats && onBeat) continue;
      if (sparseHats && seedBit(seed, bar * 11 + eighth)) continue;
      put(beat, 3, onBeat ? 0.42 : 0.3 + (seedBit(seed, bar * 13 + eighth) ? 0.06 : 0));
    }
    // open hat lifts into the half cadence and the home cadence
    if (preCadence) put(barStart + 3.5, 6, 0.55);
    // peak bar gets sixteenth hat pushes on the back half
    if (bar === peakBar && busyHats) {
      put(barStart + 2.25, 3, 0.3);
      put(barStart + 3.25, 3, 0.3);
    }
    // the fill: tumble into the loop restart
    if (lastBar) {
      put(barStart + 3, 2, 0.45);
      put(barStart + 3.25, 2, 0.5);
      put(barStart + 3.5, 5, 0.56);
      put(barStart + 3.75, 4, 0.62);
    }
  }
  return { subdivisionBeats, events };
}

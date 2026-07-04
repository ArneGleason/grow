import type { TonalContext } from "./listening";
import { DEFAULT_TONAL_CONTEXT, noteFromScaleDegree } from "./tonal-context";

export type HarmonyVoiceRole =
  | "middle-guide"
  | "lower-counter"
  | "upper-counter"
  | "bass-foundation";

export type HarmonyVoiceFunction =
  | "anchor"
  | "anticipation"
  | "bass"
  | "counter"
  | "passing"
  | "suspension";

export type HarmonyChordQuality =
  | "add"
  | "open"
  | "seventh"
  | "sixth"
  | "sus"
  | "triad";

export type HarmonyChangeKind =
  | "anticipation"
  | "cadence"
  | "landing"
  | "passing"
  | "suspension";

export interface HarmonyVoiceEvent {
  id: string;
  voiceId: string;
  role: HarmonyVoiceRole;
  function: HarmonyVoiceFunction;
  startBeat: number;
  durationBeats: number;
  scaleDegree: number;
  octave: number;
  pitch: string;
  velocity: number;
  tags: readonly string[];
}

export interface HarmonyVoice {
  id: string;
  role: HarmonyVoiceRole;
  label: string;
  events: readonly HarmonyVoiceEvent[];
}

export interface HarmonyChordEvent {
  id: string;
  startBeat: number;
  durationBeats: number;
  rootDegree: number;
  bassDegree: number;
  degrees: readonly number[];
  pitches: readonly string[];
  label: string;
  quality: HarmonyChordQuality;
  ambiguity: number;
  changeKind: HarmonyChangeKind;
  sourceVoiceEventIds: readonly string[];
  tags: readonly string[];
}

export interface HarmonyDraftSection {
  id: string;
  label: string;
  startBeat: number;
  durationBeats: number;
  chordEventIds: readonly string[];
  summary: string;
}

export interface VoiceLedHarmonyDraft {
  id: string;
  seed: number;
  bars: number;
  phraseBeats: number;
  tonalContext: TonalContext;
  voices: readonly HarmonyVoice[];
  chordEvents: readonly HarmonyChordEvent[];
  sections: readonly HarmonyDraftSection[];
  summary: string;
}

export interface VoiceLedHarmonyDraftOptions {
  seed?: number;
  bars?: number;
  tonalContext?: TonalContext;
  ambiguity?: number;
  motion?: number;
}

interface TimedDegree {
  beat: number;
  degree: number;
  fn?: "counter" | "passing" | "suspension";
}

const BEATS_PER_BAR = 4;
const DEFAULT_BARS = 8;
const MIN_BARS = 4;
const MAX_BARS = 24;
const ROMAN_DEGREES = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;
const GUIDE_CONTOUR_FAMILIES = [
  [2, 3, 4, 6, 5, 3, 4, 2],
  [0, 2, 4, 3, 5, 4, 1, 2],
  [2, 4, 5, 3, 1, 3, 4, 0],
  [4, 2, 0, 1, 3, 5, 4, 1],
  [1, 4, 3, 6, 2, 5, 3, 0],
  [5, 4, 2, 3, 1, 0, 2, 4],
  [0, 3, 5, 4, 6, 5, 1, 2],
  [3, 1, 4, 2, 5, 3, 0, 4],
] as const;
const GUIDE_CADENCE_PAIRS = [
  [1, 0],
  [4, 0],
  [2, 0],
  [5, 4],
  [6, 0],
  [1, 2],
] as const;
const GUIDE_BEAT_FAMILIES = [
  [0, 2],
  [0, 1.5],
  [0.5, 2.5],
  [0, 2.5],
  [0, 1, 3],
] as const;
const LOWER_COUNTER_INTERVAL_FAMILIES = [
  [-3, -2, -4, -2],
  [-4, -3, -2, -5],
  [-2, -4, -3, -1],
  [-5, -3, -4, -2],
] as const;
const UPPER_COUNTER_FAMILIES = [
  [
    { offset: 1.5, interval: 4, fn: "counter" },
    { offset: 2.5, interval: 5, fn: "passing" },
  ],
  [
    { offset: 0.75, interval: 5, fn: "counter" },
    { offset: 2.75, interval: 3, fn: "passing" },
  ],
  [
    { offset: 1, interval: 6, fn: "counter" },
    { offset: 3.25, interval: 4, fn: "suspension" },
  ],
  [
    { offset: 0.5, interval: 4, fn: "counter" },
    { offset: 1.75, interval: 6, fn: "passing" },
    { offset: 3, interval: 5, fn: "counter" },
  ],
] as const satisfies ReadonlyArray<ReadonlyArray<{
  offset: number;
  interval: number;
  fn: "counter" | "passing" | "suspension";
}>>;

export function generateVoiceLedHarmonyDraft(
  options: VoiceLedHarmonyDraftOptions = {},
): VoiceLedHarmonyDraft {
  const seed = normalizeSeed(options.seed ?? 1);
  const bars = normalizeBars(options.bars ?? DEFAULT_BARS);
  const phraseBeats = bars * BEATS_PER_BAR;
  const tonalContext = options.tonalContext ?? DEFAULT_TONAL_CONTEXT;
  const ambiguity = clamp01(options.ambiguity ?? 0.48);
  const motion = clamp01(options.motion ?? 0.58);

  const middle = createMiddleGuideVoice({ seed, bars, phraseBeats, tonalContext, ambiguity, motion });
  const lower = createLowerCounterVoice({ seed, bars, phraseBeats, tonalContext, middle, ambiguity, motion });
  const upper = createUpperCounterVoice({ seed, bars, phraseBeats, tonalContext, middle, ambiguity, motion });
  const preliminaryChords = deriveHarmonyChordEvents({
    seed,
    tonalContext,
    phraseBeats,
    voices: [middle, lower, upper],
  });
  const bass = createBassFoundationVoice({
    seed,
    phraseBeats,
    tonalContext,
    preliminaryChords,
    ambiguity,
    motion,
  });
  const voices = [middle, lower, upper, bass] as const;
  const chordEvents = deriveHarmonyChordEvents({
    seed,
    tonalContext,
    phraseBeats,
    voices,
  });
  const sections = createHarmonyDraftSections(chordEvents, bars);
  const summary = createHarmonyDraftSummary(chordEvents, sections);

  return {
    id: `voice-led-harmony-${seed}-${bars}`,
    seed,
    bars,
    phraseBeats,
    tonalContext: cloneTonalContext(tonalContext),
    voices,
    chordEvents,
    sections,
    summary,
  };
}

interface VoiceGenerationContext {
  seed: number;
  bars: number;
  phraseBeats: number;
  tonalContext: TonalContext;
  ambiguity: number;
  motion: number;
}

function createMiddleGuideVoice(context: VoiceGenerationContext): HarmonyVoice {
  const contour = createGuideContour(context.seed, context.bars, context.motion);
  const beats = createGuideBeats(context.seed, context.bars, context.ambiguity, context.motion);
  const events = beats.map((beat, index) => {
    const nextBeat = beats[index + 1] ?? context.phraseBeats;
    const degree = contour[index % contour.length] ?? 0;
    const isAnticipation = beat % BEATS_PER_BAR >= 3.45;
    const isCadence = nextBeat >= context.phraseBeats;
    return createVoiceEvent({
      tonalContext: context.tonalContext,
      id: `middle-${index}`,
      voiceId: "middle",
      role: "middle-guide",
      fn: isAnticipation ? "anticipation" : "anchor",
      startBeat: beat,
      durationBeats: Math.max(0.5, nextBeat - beat),
      scaleDegree: degree,
      octave: 4,
      velocity: isCadence ? 0.55 : 0.42 + context.motion * 0.12,
      tags: [
        "voice:middle-guide",
        isAnticipation ? "voice:pre-bar" : "voice:landed",
        isCadence ? "voice:cadence" : "voice:guide",
      ],
    });
  });
  return {
    id: "middle",
    role: "middle-guide",
    label: "Middle guide voice",
    events,
  };
}

function createLowerCounterVoice(context: VoiceGenerationContext & { middle: HarmonyVoice }): HarmonyVoice {
  const intervalFamily = LOWER_COUNTER_INTERVAL_FAMILIES[
    seededIndex(context.seed, 29, LOWER_COUNTER_INTERVAL_FAMILIES.length)
  ] ?? LOWER_COUNTER_INTERVAL_FAMILIES[0];
  const starts = Array.from({ length: context.bars }, (_, bar) => {
    const base = bar * BEATS_PER_BAR;
    return bar > 0 && bar % 4 === 3 && context.ambiguity > 0.42 ? base - 0.5 : base;
  });
  const events = starts.map((beat, index) => {
    const nextBeat = starts[index + 1] ?? context.phraseBeats;
    const middleDegree = degreeAt(context.middle.events, beat);
    const contrary = intervalFamily[index % intervalFamily.length] ?? -3;
    const seedOffset = seededIndex(context.seed, index + 5, 3) - 1;
    const degree = middleDegree + contrary + seedOffset;
    return createVoiceEvent({
      tonalContext: context.tonalContext,
      id: `lower-${index}`,
      voiceId: "lower",
      role: "lower-counter",
      fn: beat % BEATS_PER_BAR >= 3.45 ? "anticipation" : "counter",
      startBeat: beat,
      durationBeats: Math.max(1, nextBeat - beat),
      scaleDegree: degree,
      octave: 3,
      velocity: 0.36 + context.motion * 0.08,
      tags: ["voice:lower-counter", index % 2 === 0 ? "motion:contrary" : "motion:oblique"],
    });
  });
  return {
    id: "lower",
    role: "lower-counter",
    label: "Lower counter voice",
    events,
  };
}

function createUpperCounterVoice(context: VoiceGenerationContext & { middle: HarmonyVoice }): HarmonyVoice {
  const starts: TimedDegree[] = [];
  const familyOffset = seededIndex(context.seed, 41, UPPER_COUNTER_FAMILIES.length);
  for (let bar = 0; bar < context.bars; bar += 1) {
    const base = bar * BEATS_PER_BAR;
    const middleDegree = degreeAt(context.middle.events, base);
    const family = UPPER_COUNTER_FAMILIES[
      (familyOffset + bar + (context.motion > 0.68 ? 1 : 0)) % UPPER_COUNTER_FAMILIES.length
    ] ?? UPPER_COUNTER_FAMILIES[0];
    for (const [entryIndex, entry] of family.entries()) {
      if (entryIndex > 0 && context.motion <= 0.46 && !seedBit(context.seed, bar + entryIndex + 9)) {
        continue;
      }
      starts.push({
        beat: roundBeat(base + entry.offset),
        degree: middleDegree +
          entry.interval +
          seededIndex(context.seed, bar * 5 + entryIndex + 9, 3) -
          1,
        fn: entry.fn,
      });
    }
    if (context.ambiguity > 0.35 && bar > 0 && bar % 2 === 0) {
      starts.push({
        beat: roundBeat(base - 0.5),
        degree: degreeAt(context.middle.events, base) + 3,
        fn: "suspension",
      });
    }
  }
  const sorted = starts
    .filter((entry) => entry.beat >= 0 && entry.beat < context.phraseBeats)
    .sort((left, right) => left.beat - right.beat || left.degree - right.degree);
  const events = sorted.map((entry, index) => {
    const nextBeat = sorted[index + 1]?.beat ?? Math.min(context.phraseBeats, entry.beat + 1);
    const duration = Math.min(1, Math.max(0.5, nextBeat - entry.beat));
    const isSuspension = entry.beat % BEATS_PER_BAR >= 3.45;
    const fn = isSuspension ? "suspension" : entry.fn ?? (index % 3 === 1 ? "passing" : "counter");
    return createVoiceEvent({
      tonalContext: context.tonalContext,
      id: `upper-${index}`,
      voiceId: "upper",
      role: "upper-counter",
      fn,
      startBeat: entry.beat,
      durationBeats: duration,
      scaleDegree: entry.degree,
      octave: 5,
      velocity: isSuspension ? 0.36 : 0.31 + context.motion * 0.08,
      tags: [
        "voice:upper-counter",
        fn === "suspension" ? "voice:suspension" : fn === "passing" ? "voice:passing" : "voice:counter",
      ],
    });
  });
  return {
    id: "upper",
    role: "upper-counter",
    label: "Upper counter voice",
    events,
  };
}

function createBassFoundationVoice(input: {
  seed: number;
  phraseBeats: number;
  tonalContext: TonalContext;
  preliminaryChords: readonly HarmonyChordEvent[];
  ambiguity: number;
  motion: number;
}): HarmonyVoice {
  const selected = input.preliminaryChords.filter((chord, index) =>
    index === 0 ||
    chord.changeKind === "anticipation" ||
    chord.changeKind === "cadence" ||
    chord.startBeat % 2 === 0 ||
    chord.ambiguity >= 0.45
  );
  const events = selected.map((chord, index) => {
    const nextBeat = selected[index + 1]?.startBeat ?? input.phraseBeats;
    const useInversion = chord.ambiguity > 0.38 && seedBit(input.seed, index + 13);
    const bassDegree = useInversion
      ? chord.degrees.find((degree) => normalizeDegree(degree) !== normalizeDegree(chord.rootDegree)) ?? chord.rootDegree
      : chord.rootDegree;
    return createVoiceEvent({
      tonalContext: input.tonalContext,
      id: `bass-foundation-${index}`,
      voiceId: "bass-foundation",
      role: "bass-foundation",
      fn: "bass",
      startBeat: chord.startBeat,
      durationBeats: Math.max(0.5, nextBeat - chord.startBeat),
      scaleDegree: bassDegree,
      octave: 2,
      velocity: 0.46 + input.motion * 0.08,
      tags: [
        "voice:bass-foundation",
        useInversion ? "bass:inversion" : "bass:rooted",
        chord.changeKind === "anticipation" ? "bass:pre-bar" : "bass:landing",
      ],
    });
  });
  return {
    id: "bass-foundation",
    role: "bass-foundation",
    label: "Bass foundation",
    events,
  };
}

function deriveHarmonyChordEvents(input: {
  seed: number;
  phraseBeats: number;
  tonalContext: TonalContext;
  voices: readonly HarmonyVoice[];
}): readonly HarmonyChordEvent[] {
  const starts = uniqueSortedBeats([
    0,
    ...input.voices.flatMap((voice) =>
      voice.events
        .filter((event) => event.role !== "upper-counter" || event.function !== "passing")
        .map((event) => event.startBeat)
    ),
    input.phraseBeats,
  ]);
  const chordStarts = starts.filter((beat) => beat >= 0 && beat < input.phraseBeats);
  const events = chordStarts.map((startBeat, index) => {
    const nextBeat = starts.find((beat) => beat > startBeat) ?? input.phraseBeats;
    const active = activeVoiceEventsAt(input.voices, startBeat);
    const sourceIds = active.map((event) => event.id);
    const degrees = uniqueDegrees(active.map((event) => event.scaleDegree));
    const sortedActive = [...active].sort((left, right) => notePosition(left) - notePosition(right));
    const bassEvent = active
      .filter((event) => event.role === "bass-foundation")
      .sort((left, right) => notePosition(left) - notePosition(right))[0] ??
      sortedActive[0];
    const bassDegree = bassEvent?.scaleDegree ?? degrees[0] ?? 0;
    const rootDegree = chooseChordRoot(degrees, bassDegree);
    const quality = classifyChordQuality(rootDegree, degrees);
    const changeKind = classifyChangeKind(startBeat, input.phraseBeats, active);
    const ambiguity = calculateChordAmbiguity(rootDegree, bassDegree, degrees, changeKind);
    const label = formatChordLabel(rootDegree, bassDegree, quality);
    const tags = [
      "harmony:voice-led",
      `quality:${quality}`,
      `change:${changeKind}`,
      ambiguity >= 0.42 ? "harmony:ambiguous" : "harmony:clear",
    ];
    return {
      id: `harmony-chord-${index}`,
      startBeat,
      durationBeats: roundBeat(Math.max(0.25, nextBeat - startBeat)),
      rootDegree,
      bassDegree,
      degrees,
      pitches: degrees.map((degree) => noteFromScaleDegree(input.tonalContext, degree, 4)),
      label,
      quality,
      ambiguity,
      changeKind,
      sourceVoiceEventIds: sourceIds,
      tags,
    };
  });
  return coalesceEquivalentChords(events, input.phraseBeats);
}

function createGuideContour(seed: number, bars: number, motion: number): readonly number[] {
  const values: number[] = [];
  const length = bars * 3;
  const motif = GUIDE_CONTOUR_FAMILIES[
    seededIndex(seed, 13, GUIDE_CONTOUR_FAMILIES.length)
  ] ?? GUIDE_CONTOUR_FAMILIES[0];
  const motifRotation = seededIndex(seed, 17, motif.length);
  const phraseShift = seededIndex(seed, 19, 5) - 2;
  for (let index = 0; index < length; index += 1) {
    const base = motif[(index + motifRotation) % motif.length] ?? 0;
    const section = Math.floor(index / Math.max(1, Math.ceil(length / 3)));
    const lift = section === 1 && motion > 0.54 ? 1 : 0;
    const fall = section === 2 && motion < 0.42 ? -1 : 0;
    const turn = seedBit(seed, index + 3) && index % 4 === 2 ? -1 : 0;
    const leap = motion > 0.74 && seededIndex(seed, index + 23, 5) === 0 ? 2 : 0;
    values.push(base + phraseShift + lift + fall + turn + leap);
  }
  values[0] = values[0] ?? 2;
  const cadence = GUIDE_CADENCE_PAIRS[
    seededIndex(seed, 31, GUIDE_CADENCE_PAIRS.length)
  ] ?? GUIDE_CADENCE_PAIRS[0];
  values[length - 2] = cadence[0];
  values[length - 1] = cadence[1];
  return values;
}

function createGuideBeats(
  seed: number,
  bars: number,
  ambiguity: number,
  motion: number,
): readonly number[] {
  const beats: number[] = [];
  const familyOffset = seededIndex(seed, 37, GUIDE_BEAT_FAMILIES.length);
  for (let bar = 0; bar < bars; bar += 1) {
    const family = GUIDE_BEAT_FAMILIES[
      (familyOffset + bar + (motion > 0.7 ? 1 : 0)) % GUIDE_BEAT_FAMILIES.length
    ] ?? GUIDE_BEAT_FAMILIES[0];
    for (const [offsetIndex, offset] of family.entries()) {
      if (offsetIndex > 1 && motion < 0.62 && !seedBit(seed, bar + offsetIndex + 43)) {
        continue;
      }
      let beat = bar * BEATS_PER_BAR + offset;
      const shouldAnticipate = bar > 0 &&
        offset === 0 &&
        ambiguity > 0.3 &&
        (bar % 3 === 0 || seedBit(seed, bar + 17));
      if (shouldAnticipate) {
        beat -= 0.5;
      }
      beats.push(roundBeat(Math.max(0, beat)));
    }
  }
  return uniqueSortedBeats([0, ...beats]);
}

function createHarmonyDraftSections(
  chordEvents: readonly HarmonyChordEvent[],
  bars: number,
): readonly HarmonyDraftSection[] {
  const sectionBars = bars <= 8 ? 4 : bars === 12 ? 4 : 8;
  const sectionCount = Math.ceil(bars / sectionBars);
  return Array.from({ length: sectionCount }, (_, index) => {
    const startBeat = index * sectionBars * BEATS_PER_BAR;
    const endBeat = Math.min(bars * BEATS_PER_BAR, startBeat + sectionBars * BEATS_PER_BAR);
    const sectionChords = chordEvents.filter((event) =>
      event.startBeat >= startBeat && event.startBeat < endBeat
    );
    const first = sectionChords[0]?.label ?? "open";
    const last = sectionChords.at(-1)?.label ?? first;
    return {
      id: `harmony-section-${index + 1}`,
      label: index === 0 ? "A" : index === 1 ? "B" : `C${index - 1}`,
      startBeat,
      durationBeats: roundBeat(endBeat - startBeat),
      chordEventIds: sectionChords.map((event) => event.id),
      summary: `${first} -> ${last}, ${sectionChords.length} changes`,
    };
  });
}

function createHarmonyDraftSummary(
  chordEvents: readonly HarmonyChordEvent[],
  sections: readonly HarmonyDraftSection[],
): string {
  const offBar = chordEvents.filter((event) => event.startBeat % BEATS_PER_BAR !== 0).length;
  const ambiguous = chordEvents.filter((event) => event.ambiguity >= 0.42).length;
  const labels = chordEvents.slice(0, 6).map((event) => event.label).join(" ");
  return `${chordEvents.length} voice-led chord moments across ${sections.length} sections; ` +
    `${offBar} off-bar changes; ${ambiguous} ambiguous voicings; ${labels}`;
}

function activeVoiceEventsAt(
  voices: readonly HarmonyVoice[],
  beat: number,
): readonly HarmonyVoiceEvent[] {
  return voices.flatMap((voice) => {
    const active = voice.events.find((event) =>
      event.startBeat <= beat && event.startBeat + event.durationBeats > beat
    );
    if (active) return [active];
    const previous = [...voice.events].reverse().find((event) => event.startBeat <= beat);
    return previous ? [previous] : [];
  });
}

function chooseChordRoot(degrees: readonly number[], bassDegree: number): number {
  const candidates = uniqueDegrees([bassDegree, ...degrees]);
  const scored = candidates.map((candidate) => {
    const degreeSet = new Set(degrees.map(normalizeDegree));
    const root = normalizeDegree(candidate);
    let score = normalizeDegree(bassDegree) === root ? 1.2 : 0;
    if (degreeSet.has(root)) score += 0.8;
    if (degreeSet.has(normalizeDegree(root + 2))) score += 1.4;
    if (degreeSet.has(normalizeDegree(root + 4))) score += 1.2;
    if (degreeSet.has(normalizeDegree(root + 3))) score += 0.45;
    if (degreeSet.has(normalizeDegree(root + 6))) score += 0.35;
    return { candidate, score };
  });
  scored.sort((left, right) => right.score - left.score || Math.abs(left.candidate) - Math.abs(right.candidate));
  return scored[0]?.candidate ?? bassDegree;
}

function classifyChordQuality(
  rootDegree: number,
  degrees: readonly number[],
): HarmonyChordQuality {
  const offsets = chordOffsets(rootDegree, degrees);
  const hasThird = offsets.has(2);
  const hasFifth = offsets.has(4);
  const hasFourth = offsets.has(3);
  const hasSixth = offsets.has(5);
  const hasSeventh = offsets.has(6);
  if (!hasThird && hasFourth) return "sus";
  if (hasThird && hasFifth && hasSeventh) return "seventh";
  if (hasThird && hasFifth && hasSixth) return "sixth";
  if (hasThird && hasFifth) return "triad";
  if (!hasThird && hasFifth) return "open";
  return "add";
}

function classifyChangeKind(
  startBeat: number,
  phraseBeats: number,
  active: readonly HarmonyVoiceEvent[],
): HarmonyChangeKind {
  if (phraseBeats - startBeat <= 2) return "cadence";
  if (active.some((event) => event.function === "suspension")) return "suspension";
  if (startBeat % BEATS_PER_BAR >= 3.45) return "anticipation";
  if (active.every((event) => event.function === "passing")) return "passing";
  return "landing";
}

function calculateChordAmbiguity(
  rootDegree: number,
  bassDegree: number,
  degrees: readonly number[],
  changeKind: HarmonyChangeKind,
): number {
  const offsets = chordOffsets(rootDegree, degrees);
  let score = 0.08;
  if (!offsets.has(2)) score += 0.22;
  if (offsets.has(3)) score += 0.18;
  if (offsets.has(1) || offsets.has(5)) score += 0.14;
  if (normalizeDegree(rootDegree) !== normalizeDegree(bassDegree)) score += 0.16;
  if (changeKind === "anticipation" || changeKind === "suspension") score += 0.18;
  if (degrees.length >= 4) score += 0.08;
  return round3(clamp01(score));
}

function formatChordLabel(
  rootDegree: number,
  bassDegree: number,
  quality: HarmonyChordQuality,
): string {
  const roman = ROMAN_DEGREES[normalizeDegree(rootDegree)] ?? "I";
  const qualitySuffix = quality === "triad"
    ? ""
    : quality === "seventh"
      ? "7"
      : quality === "sixth"
        ? "6"
        : quality === "sus"
          ? "sus"
          : quality === "open"
            ? "open"
            : "add";
  const slash = normalizeDegree(rootDegree) === normalizeDegree(bassDegree)
    ? ""
    : `/${ROMAN_DEGREES[normalizeDegree(bassDegree)] ?? "I"}`;
  return `${roman}${qualitySuffix}${slash}`;
}

function coalesceEquivalentChords(
  events: readonly HarmonyChordEvent[],
  phraseBeats: number,
): readonly HarmonyChordEvent[] {
  const coalesced: HarmonyChordEvent[] = [];
  for (const event of events) {
    const previous = coalesced.at(-1);
    const sameChord = previous &&
      previous.label === event.label &&
      previous.changeKind === event.changeKind &&
      Math.abs(previous.ambiguity - event.ambiguity) < 0.08;
    if (sameChord) {
      const merged: HarmonyChordEvent = {
        ...previous,
        durationBeats: roundBeat(event.startBeat + event.durationBeats - previous.startBeat),
        sourceVoiceEventIds: uniqueStrings([...previous.sourceVoiceEventIds, ...event.sourceVoiceEventIds]),
      };
      coalesced[coalesced.length - 1] = merged;
    } else {
      coalesced.push(event);
    }
  }
  return coalesced.map((event, index, mergedEvents) => ({
    ...event,
    id: `harmony-chord-${index}`,
    durationBeats: roundBeat(
      Math.min(phraseBeats, mergedEvents[index + 1]?.startBeat ?? phraseBeats) - event.startBeat,
    ),
  }));
}

function createVoiceEvent(input: {
  tonalContext: TonalContext;
  id: string;
  voiceId: string;
  role: HarmonyVoiceRole;
  fn: HarmonyVoiceFunction;
  startBeat: number;
  durationBeats: number;
  scaleDegree: number;
  octave: number;
  velocity: number;
  tags: readonly string[];
}): HarmonyVoiceEvent {
  return {
    id: input.id,
    voiceId: input.voiceId,
    role: input.role,
    function: input.fn,
    startBeat: roundBeat(input.startBeat),
    durationBeats: roundBeat(input.durationBeats),
    scaleDegree: Math.trunc(input.scaleDegree),
    octave: Math.trunc(input.octave),
    pitch: noteFromScaleDegree(input.tonalContext, input.scaleDegree, input.octave),
    velocity: round3(clamp01(input.velocity)),
    tags: input.tags,
  };
}

function degreeAt(events: readonly HarmonyVoiceEvent[], beat: number): number {
  const active = events.find((event) =>
    event.startBeat <= beat && event.startBeat + event.durationBeats > beat
  );
  if (active) return active.scaleDegree;
  return [...events].reverse().find((event) => event.startBeat <= beat)?.scaleDegree ?? 0;
}

function chordOffsets(rootDegree: number, degrees: readonly number[]): Set<number> {
  const root = normalizeDegree(rootDegree);
  return new Set(degrees.map((degree) => normalizeDegree(degree - root)));
}

function uniqueDegrees(degrees: readonly number[]): readonly number[] {
  const seen = new Set<number>();
  const unique: number[] = [];
  for (const degree of degrees) {
    const normalized = normalizeDegree(degree);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(Math.trunc(degree));
  }
  return unique;
}

function uniqueSortedBeats(beats: readonly number[]): readonly number[] {
  return [...new Set(beats.map(roundBeat))].sort((left, right) => left - right);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function normalizeBars(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_BARS;
  const rounded = Math.round(value / 4) * 4;
  return Math.max(MIN_BARS, Math.min(MAX_BARS, rounded));
}

function normalizeSeed(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const seed = Math.trunc(Math.abs(value)) >>> 0;
  return seed === 0 ? 1 : seed;
}

function normalizeDegree(degree: number): number {
  return ((Math.trunc(degree) % 7) + 7) % 7;
}

function notePosition(event: HarmonyVoiceEvent): number {
  return event.octave * 7 + event.scaleDegree;
}

function seedBit(seed: number, index: number): boolean {
  return ((seed >>> (index % 24)) & 1) === 1;
}

function seededIndex(seed: number, salt: number, modulo: number): number {
  if (modulo <= 1) return 0;
  let mixed = seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b);
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return (mixed >>> 0) % modulo;
}

function cloneTonalContext(tonalContext: TonalContext): TonalContext {
  return {
    tonic: tonalContext.tonic,
    mode: tonalContext.mode,
    scale: [...tonalContext.scale],
  };
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function roundBeat(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

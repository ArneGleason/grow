import type { TonalContext } from "./listening";
import type { SongLibraryPlayerPlan } from "./song-library";
import type { SongGoal } from "./song-goal";
import { noteFromScaleDegree } from "./tonal-context";
import type {
  HarmonyChangeKind,
  HarmonyChordEvent,
  HarmonyChordQuality,
  HarmonyDraftSection,
  HarmonyVoice,
  HarmonyVoiceEvent,
  HarmonyVoiceFunction,
  HarmonyVoiceRole,
  VoiceLedHarmonyDraft,
} from "./voice-led-harmony";

export type SongDraftPlanSource = "model";
export type SongDraftPlanLeader = "melody" | "harmony" | "answer";
export type SongDraftPlanContour = "rise" | "fall" | "arch" | "dip" | "wave" | "flat";
export type SongDraftPlanRhythm = "sparse" | "steady" | "syncopated" | "busy";
export type SongDraftPlanCadence = "open" | "half" | "home" | "surprise";

export interface SongDraftPlanBar {
  barIndex: number;
  leader: SongDraftPlanLeader;
  rootDegree: number;
  anchorDegrees: readonly number[];
  contour: SongDraftPlanContour;
  rhythm: SongDraftPlanRhythm;
  cadence: SongDraftPlanCadence;
  tension: number;
}

export interface SongDraftPlan {
  version: "grow.songDraftPlan/1";
  source: SongDraftPlanSource;
  bars: readonly SongDraftPlanBar[];
  summary: string;
}

export interface SongDraftPlanPromptInput {
  prompt: string;
  goal: SongGoal;
  materialSeed: number;
  playerPlans: readonly SongLibraryPlayerPlan[];
}

export interface SongDraftPlanValidationResult {
  valid: boolean;
  errors: readonly string[];
  warnings: readonly string[];
  clamps: readonly string[];
  plan?: SongDraftPlan;
}

export const SONG_DRAFT_PLAN_BAR_COUNT = 8;
const BEATS_PER_BAR = 4;
const PHRASE_BEATS = SONG_DRAFT_PLAN_BAR_COUNT * BEATS_PER_BAR;
const MAX_SUMMARY_LENGTH = 220;
const DEGREE_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;
const LEADERS = ["melody", "harmony", "answer"] as const satisfies readonly SongDraftPlanLeader[];
const CONTOURS = ["rise", "fall", "arch", "dip", "wave", "flat"] as const satisfies readonly SongDraftPlanContour[];
const RHYTHMS = ["sparse", "steady", "syncopated", "busy"] as const satisfies readonly SongDraftPlanRhythm[];
const CADENCES = ["open", "half", "home", "surprise"] as const satisfies readonly SongDraftPlanCadence[];

export const SONG_DRAFT_PLAN_RESPONSE_FORMAT = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "bars"],
  properties: {
    summary: {
      type: "string",
      minLength: 1,
      maxLength: MAX_SUMMARY_LENGTH,
    },
    bars: {
      type: "array",
      minItems: SONG_DRAFT_PLAN_BAR_COUNT,
      maxItems: SONG_DRAFT_PLAN_BAR_COUNT,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "barIndex",
          "leader",
          "rootDegree",
          "anchorDegrees",
          "contour",
          "rhythm",
          "cadence",
          "tension",
        ],
        properties: {
          barIndex: { type: "integer", minimum: 0, maximum: SONG_DRAFT_PLAN_BAR_COUNT - 1 },
          leader: { type: "string", enum: LEADERS },
          rootDegree: { type: "integer", enum: DEGREE_VALUES },
          anchorDegrees: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "integer", enum: DEGREE_VALUES },
          },
          contour: { type: "string", enum: CONTOURS },
          rhythm: { type: "string", enum: RHYTHMS },
          cadence: { type: "string", enum: CADENCES },
          tension: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;

export function createSongDraftPlanPrimer(): string {
  return [
    "You are Grow's local melody/harmony draft planner.",
    "Return a bounded eight-bar sketch that lets melody and harmony influence each other.",
    "Return one compact JSON object. No markdown. No prose outside JSON.",
    "Do not output pitches, pitch names, chords names, lyrics, MIDI, note durations, audio instructions, or event lists.",
    "Use only scale degrees 1..7. They are abstract modal degrees, not absolute pitches.",
    "Each bar must say who leads: melody, harmony, or answer.",
    "melody-led bars should make the harmony support the anchorDegrees.",
    "harmony-led bars should make anchorDegrees lean toward the rootDegree.",
    "answer bars should noticeably respond to the previous bar's contour or cadence.",
  ].join("\n");
}

export function createSongDraftPlanPrompt(input: SongDraftPlanPromptInput): string {
  return [
    "Create a song-specific eight-bar melody/harmony sketch for this Grow song.",
    "Return exactly this JSON shape: {\"summary\":\"...\",\"bars\":[{\"barIndex\":0,\"leader\":\"melody|harmony|answer\",\"rootDegree\":1,\"anchorDegrees\":[1,3],\"contour\":\"rise|fall|arch|dip|wave|flat\",\"rhythm\":\"sparse|steady|syncopated|busy\",\"cadence\":\"open|half|home|surprise\",\"tension\":0.4}, ... eight bars total]}",
    "rootDegree and anchorDegrees are modal scale degrees 1..7 only. Do not return C, D, notes, chords, durations, beats, or pitches.",
    "Make a real proposition: vary leaders, contours, roots, rhythms, and cadences across the eight bars.",
    "Use answer bars for call/response. Use at least one melody-led bar and one harmony-led bar unless the prompt strongly says otherwise.",
    "Song setup:",
    JSON.stringify({
      tonic: input.goal.tonic,
      mode: input.goal.mode,
      tempoBpm: input.goal.tempoBpm,
      energy: input.goal.energy,
      surpriseTarget: input.goal.surpriseTarget,
      brightness: input.goal.brightness,
      formPreference: input.goal.formPreference,
      influenceHints: input.goal.influenceHints,
      sectionEmphasis: input.goal.sectionEmphasis,
      materialSeed: input.materialSeed,
    }),
    "Enabled players:",
    JSON.stringify(input.playerPlans.filter((plan) => plan.enabled).map((plan) => ({
      playerId: plan.playerId,
      role: plan.role,
      brief: plan.brief,
    }))),
    "User request:",
    input.prompt,
  ].join("\n");
}

export function validateSongDraftPlanResponse(response: unknown): SongDraftPlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const clamps: string[] = [];
  if (!isRecord(response)) {
    return {
      valid: false,
      errors: ["song draft plan response must be an object"],
      warnings,
      clamps,
    };
  }

  const summary = sanitizeText(response.summary, MAX_SUMMARY_LENGTH);
  if (!summary) errors.push("summary must be a non-empty string");
  if (!Array.isArray(response.bars)) {
    errors.push("bars must be an array");
    return { valid: false, errors, warnings, clamps };
  }
  if (response.bars.length !== SONG_DRAFT_PLAN_BAR_COUNT) {
    errors.push(`bars must contain exactly ${SONG_DRAFT_PLAN_BAR_COUNT} entries`);
  }

  const seenBars = new Set<number>();
  const bars: SongDraftPlanBar[] = [];
  for (let index = 0; index < Math.min(response.bars.length, SONG_DRAFT_PLAN_BAR_COUNT); index += 1) {
    const rawBar = response.bars[index];
    if (!isRecord(rawBar)) {
      errors.push(`bars.${index} must be an object`);
      continue;
    }
    const barIndex = readInteger(rawBar.barIndex, `bars.${index}.barIndex`, errors);
    if (barIndex === undefined) continue;
    if (barIndex < 0 || barIndex >= SONG_DRAFT_PLAN_BAR_COUNT) {
      errors.push(`bars.${index}.barIndex must be 0..${SONG_DRAFT_PLAN_BAR_COUNT - 1}`);
      continue;
    }
    if (seenBars.has(barIndex)) {
      errors.push(`duplicate barIndex ${barIndex}`);
      continue;
    }
    seenBars.add(barIndex);
    const leader = readEnum(rawBar.leader, LEADERS, `bars.${index}.leader`, errors);
    const rootDegree = readDegree(rawBar.rootDegree, `bars.${index}.rootDegree`, errors);
    const anchorDegrees = readAnchorDegrees(rawBar.anchorDegrees, `bars.${index}.anchorDegrees`, errors);
    const contour = readEnum(rawBar.contour, CONTOURS, `bars.${index}.contour`, errors);
    const rhythm = readEnum(rawBar.rhythm, RHYTHMS, `bars.${index}.rhythm`, errors);
    const cadence = readEnum(rawBar.cadence, CADENCES, `bars.${index}.cadence`, errors);
    const tension = readClampedNumber(rawBar.tension, `bars.${index}.tension`, errors, clamps);
    if (!leader || rootDegree === undefined || !anchorDegrees || !contour || !rhythm || !cadence || tension === undefined) {
      continue;
    }
    bars.push({
      barIndex,
      leader,
      rootDegree,
      anchorDegrees,
      contour,
      rhythm,
      cadence,
      tension,
    });
  }

  bars.sort((left, right) => left.barIndex - right.barIndex);
  const missingBars = Array.from({ length: SONG_DRAFT_PLAN_BAR_COUNT }, (_, index) => index)
    .filter((index) => !seenBars.has(index));
  if (missingBars.length > 0) {
    errors.push(`missing barIndex values ${missingBars.join(", ")}`);
  }
  const leaderSet = new Set(bars.map((bar) => bar.leader));
  if (!leaderSet.has("melody")) warnings.push("plan has no melody-led bar");
  if (!leaderSet.has("harmony")) warnings.push("plan has no harmony-led bar");
  if (new Set(bars.map((bar) => bar.rootDegree)).size < 3) {
    warnings.push("plan uses fewer than three root degrees");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    clamps,
    plan: errors.length === 0
      ? {
        version: "grow.songDraftPlan/1",
        source: "model",
        summary,
        bars,
      }
      : undefined,
  };
}

export function normalizeStoredSongDraftPlan(candidate: unknown): SongDraftPlan | undefined {
  const result = validateSongDraftPlanResponse(candidate);
  return result.valid ? result.plan : undefined;
}

export function getSongDraftPlanLeaderAtBar(plan: SongDraftPlan, barIndex: number): "melody" | "harmony" {
  const bar = plan.bars.find((candidate) => candidate.barIndex === barIndex);
  return bar?.leader === "harmony" ? "harmony" : "melody";
}

export function createVoiceLedHarmonyDraftFromSongDraftPlan(
  plan: SongDraftPlan,
  options: {
    seed: number;
    tonalContext: TonalContext;
  },
): VoiceLedHarmonyDraft {
  const middle = createMiddleGuideVoice(plan, options.tonalContext);
  const bass = createBassFoundationVoice(plan, options.tonalContext);
  const lower = createLowerCounterVoice(plan, options.tonalContext);
  const upper = createUpperCounterVoice(plan, options.tonalContext);
  const chordEvents = createPlanChordEvents(plan, options.tonalContext);
  const sections = createPlanSections(chordEvents);
  const summary = `${plan.summary}; model co-draft ${createPlanSignature(plan)}`;
  return {
    id: `song-draft-plan-${options.seed}-${stableHash(createPlanSignature(plan))}`,
    seed: options.seed,
    bars: SONG_DRAFT_PLAN_BAR_COUNT,
    phraseBeats: PHRASE_BEATS,
    tonalContext: cloneTonalContext(options.tonalContext),
    voices: [middle, lower, upper, bass],
    chordEvents,
    sections,
    summary,
  };
}

function createMiddleGuideVoice(plan: SongDraftPlan, tonalContext: TonalContext): HarmonyVoice {
  const events = plan.bars.flatMap((bar) => {
    const starts = anchorStartsForBar(bar);
    const degrees = contourAdjustedAnchors(bar);
    return degrees.map((languageDegree, index) => {
      const startBeat = bar.barIndex * BEATS_PER_BAR + (starts[index] ?? starts.at(-1) ?? 0);
      const nextStart = starts[index + 1];
      const endBeat = nextStart === undefined
        ? (bar.barIndex + 1) * BEATS_PER_BAR
        : bar.barIndex * BEATS_PER_BAR + nextStart;
      const cadence = index === degrees.length - 1 ? bar.cadence : "open";
      return createVoiceEvent({
        tonalContext,
        id: `plan-middle-${bar.barIndex}-${index}`,
        voiceId: "plan-middle",
        role: "middle-guide",
        fn: cadence === "home" || cadence === "half" ? "anchor" : bar.leader === "answer" ? "counter" : "anchor",
        startBeat,
        durationBeats: Math.max(0.5, endBeat - startBeat),
        scaleDegree: toEngineDegree(languageDegree),
        octave: 4 + (bar.tension > 0.72 && index === degrees.length - 1 ? 1 : 0),
        velocity: 0.38 + bar.tension * 0.14 + (bar.leader === "melody" ? 0.06 : 0),
        tags: [
          "song-plan:model",
          "voice:middle-guide",
          `plan:bar-${bar.barIndex}`,
          `plan:leader-${bar.leader}`,
          `plan:contour-${bar.contour}`,
          `plan:rhythm-${bar.rhythm}`,
          `plan:cadence-${bar.cadence}`,
        ],
      });
    });
  });
  return {
    id: "plan-middle",
    role: "middle-guide",
    label: "Model planned melody guide",
    events,
  };
}

function createBassFoundationVoice(plan: SongDraftPlan, tonalContext: TonalContext): HarmonyVoice {
  const events = plan.bars.flatMap((bar) => {
    const primary = createVoiceEvent({
      tonalContext,
      id: `plan-bass-${bar.barIndex}-0`,
      voiceId: "plan-bass",
      role: "bass-foundation",
      fn: "bass",
      startBeat: bar.barIndex * BEATS_PER_BAR,
      durationBeats: bar.tension > 0.68 ? 2 : BEATS_PER_BAR,
      scaleDegree: toEngineDegree(rootForBar(bar)),
      octave: 2,
      velocity: 0.42 + bar.tension * 0.12,
      tags: ["song-plan:model", "voice:bass-foundation", `plan:leader-${bar.leader}`],
    });
    if (bar.tension <= 0.55 || bar.rhythm === "sparse") return [primary];
    const responseRoot = toEngineDegree(responseDegreeForBar(bar));
    return [
      primary,
      createVoiceEvent({
        tonalContext,
        id: `plan-bass-${bar.barIndex}-1`,
        voiceId: "plan-bass",
        role: "bass-foundation",
        fn: "bass",
        startBeat: bar.barIndex * BEATS_PER_BAR + 2,
        durationBeats: 2,
        scaleDegree: responseRoot,
        octave: 2,
        velocity: 0.35 + bar.tension * 0.1,
        tags: ["song-plan:model", "voice:bass-foundation", "bass:response", `plan:leader-${bar.leader}`],
      }),
    ];
  });
  return {
    id: "plan-bass",
    role: "bass-foundation",
    label: "Model planned bass foundation",
    events,
  };
}

function createLowerCounterVoice(plan: SongDraftPlan, tonalContext: TonalContext): HarmonyVoice {
  const events = plan.bars.map((bar) => {
    const anchor = toEngineDegree(bar.anchorDegrees[0] ?? bar.rootDegree);
    const root = toEngineDegree(rootForBar(bar));
    const degree = bar.leader === "melody" ? anchor - 3 : root - 2 - (bar.barIndex % 2);
    return createVoiceEvent({
      tonalContext,
      id: `plan-lower-${bar.barIndex}`,
      voiceId: "plan-lower",
      role: "lower-counter",
      fn: "counter",
      startBeat: bar.barIndex * BEATS_PER_BAR + (bar.rhythm === "syncopated" ? 0.5 : 0),
      durationBeats: BEATS_PER_BAR,
      scaleDegree: degree,
      octave: 3,
      velocity: 0.3 + bar.tension * 0.09,
      tags: ["song-plan:model", "voice:lower-counter", `plan:leader-${bar.leader}`],
    });
  });
  return {
    id: "plan-lower",
    role: "lower-counter",
    label: "Model planned lower counter",
    events,
  };
}

function createUpperCounterVoice(plan: SongDraftPlan, tonalContext: TonalContext): HarmonyVoice {
  const events = plan.bars.flatMap((bar) => {
    const starts = bar.rhythm === "busy"
      ? [1, 2.5, 3.25]
      : bar.rhythm === "syncopated"
        ? [1.25, 2.75]
        : [2.5];
    const anchors = contourAdjustedAnchors(bar);
    return starts.map((offset, index) => {
      const target = toEngineDegree(anchors[Math.min(index + 1, anchors.length - 1)] ?? bar.rootDegree);
      const fn: HarmonyVoiceFunction = offset >= 3 ? "suspension" : index % 2 === 0 ? "counter" : "passing";
      return createVoiceEvent({
        tonalContext,
        id: `plan-upper-${bar.barIndex}-${index}`,
        voiceId: "plan-upper",
        role: "upper-counter",
        fn,
        startBeat: bar.barIndex * BEATS_PER_BAR + offset,
        durationBeats: fn === "suspension" ? 0.5 : 0.75,
        scaleDegree: target + (fn === "suspension" ? 1 : fn === "passing" ? -1 : 2),
        octave: 5,
        velocity: 0.24 + bar.tension * 0.13,
        tags: [
          "song-plan:model",
          "voice:upper-counter",
          fn === "suspension" ? "voice:suspension" : fn === "passing" ? "voice:passing" : "voice:counter",
          `plan:leader-${bar.leader}`,
        ],
      });
    });
  });
  return {
    id: "plan-upper",
    role: "upper-counter",
    label: "Model planned upper counter",
    events,
  };
}

function createPlanChordEvents(plan: SongDraftPlan, tonalContext: TonalContext): readonly HarmonyChordEvent[] {
  return plan.bars.flatMap((bar) => {
    const root = toEngineDegree(rootForBar(bar));
    const primaryDuration = needsMidBarChord(bar) ? 2 : BEATS_PER_BAR;
    const primary = createChordEvent({
      tonalContext,
      id: `plan-chord-${bar.barIndex}-0`,
      startBeat: bar.barIndex * BEATS_PER_BAR,
      durationBeats: primaryDuration,
      rootDegree: root,
      degrees: chordDegreesForBar(bar, root, 0),
      quality: qualityForBar(bar, 0),
      changeKind: bar.barIndex === SONG_DRAFT_PLAN_BAR_COUNT - 1 ? "cadence" : "landing",
      ambiguity: bar.tension,
      tags: ["song-plan:model", `plan:leader-${bar.leader}`, `plan:cadence-${bar.cadence}`],
    });
    if (!needsMidBarChord(bar)) return [primary];
    const midRoot = toEngineDegree(responseDegreeForBar(bar));
    return [
      primary,
      createChordEvent({
        tonalContext,
        id: `plan-chord-${bar.barIndex}-1`,
        startBeat: bar.barIndex * BEATS_PER_BAR + 2,
        durationBeats: 2,
        rootDegree: midRoot,
        degrees: chordDegreesForBar(bar, midRoot, 1),
        quality: qualityForBar(bar, 1),
        changeKind: bar.cadence === "surprise" ? "suspension" : bar.leader === "answer" ? "anticipation" : "passing",
        ambiguity: Math.min(1, bar.tension + 0.1),
        tags: ["song-plan:model", "plan:mid-bar", `plan:leader-${bar.leader}`, `plan:cadence-${bar.cadence}`],
      }),
    ];
  }).sort((left, right) => left.startBeat - right.startBeat || left.id.localeCompare(right.id));
}

function createChordEvent(input: {
  tonalContext: TonalContext;
  id: string;
  startBeat: number;
  durationBeats: number;
  rootDegree: number;
  degrees: readonly number[];
  quality: HarmonyChordQuality;
  changeKind: HarmonyChangeKind;
  ambiguity: number;
  tags: readonly string[];
}): HarmonyChordEvent {
  const root = normalizeDegree(input.rootDegree);
  const degrees = uniqueDegrees([root, ...input.degrees]);
  const bassDegree = root;
  return {
    id: input.id,
    startBeat: roundBeat(input.startBeat),
    durationBeats: roundBeat(input.durationBeats),
    rootDegree: root,
    bassDegree,
    degrees,
    pitches: degrees.map((degree) => noteFromScaleDegree(input.tonalContext, degree, 4)),
    label: `plan-${root + 1}-${input.quality}`,
    quality: input.quality,
    ambiguity: round3(clamp01(input.ambiguity)),
    changeKind: input.changeKind,
    sourceVoiceEventIds: [],
    tags: [
      "harmony:voice-led",
      "song-plan:model",
      `quality:${input.quality}`,
      `change:${input.changeKind}`,
      input.ambiguity >= 0.42 ? "harmony:ambiguous" : "harmony:clear",
      ...input.tags,
    ],
  };
}

function createPlanSections(chordEvents: readonly HarmonyChordEvent[]): readonly HarmonyDraftSection[] {
  return [0, 1].map((sectionIndex) => {
    const startBeat = sectionIndex * 16;
    const endBeat = startBeat + 16;
    const sectionChords = chordEvents.filter((chord) => chord.startBeat >= startBeat && chord.startBeat < endBeat);
    return {
      id: `plan-section-${sectionIndex + 1}`,
      label: sectionIndex === 0 ? "A" : "B",
      startBeat,
      durationBeats: 16,
      chordEventIds: sectionChords.map((chord) => chord.id),
      summary: `${sectionChords[0]?.label ?? "open"} -> ${sectionChords.at(-1)?.label ?? "open"}, ${sectionChords.length} changes`,
    };
  });
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
    durationBeats: roundBeat(Math.max(0.25, input.durationBeats)),
    scaleDegree: input.scaleDegree,
    octave: input.octave,
    pitch: noteFromScaleDegree(input.tonalContext, input.scaleDegree, input.octave),
    velocity: round3(Math.max(0.12, Math.min(0.88, input.velocity))),
    tags: uniqueStrings(input.tags),
  };
}

function anchorStartsForBar(bar: SongDraftPlanBar): readonly number[] {
  const count = Math.max(2, Math.min(4, bar.anchorDegrees.length));
  const families: Record<SongDraftPlanRhythm, readonly number[]> = {
    sparse: [0, 2.5],
    steady: [0, 2, 3],
    syncopated: [0.5, 1.75, 3.25],
    busy: [0, 1, 2, 3],
  };
  return (families[bar.rhythm] ?? families.steady).slice(0, count);
}

function contourAdjustedAnchors(bar: SongDraftPlanBar): readonly number[] {
  const anchors = [...bar.anchorDegrees];
  if (anchors.length < 2) return [bar.rootDegree, bar.rootDegree];
  switch (bar.contour) {
    case "rise":
      return anchors.sort((left, right) => left - right);
    case "fall":
      return anchors.sort((left, right) => right - left);
    case "arch":
      return arrangeWithPeak(anchors);
    case "dip":
      return arrangeWithValley(anchors);
    case "wave":
      return anchors.map((degree, index) => index % 2 === 0 ? degree : reflectDegree(degree));
    case "flat":
      return anchors;
  }
}

function arrangeWithPeak(values: readonly number[]): readonly number[] {
  const sorted = [...values].sort((left, right) => left - right);
  const peak = sorted.at(-1) ?? sorted[0] ?? 1;
  const rest = sorted.filter((_, index) => index !== sorted.length - 1);
  return [...rest.slice(0, Math.ceil(rest.length / 2)), peak, ...rest.slice(Math.ceil(rest.length / 2)).reverse()];
}

function arrangeWithValley(values: readonly number[]): readonly number[] {
  const sorted = [...values].sort((left, right) => left - right);
  const valley = sorted[0] ?? 1;
  const rest = sorted.slice(1).sort((left, right) => right - left);
  return [rest[0] ?? valley, valley, ...rest.slice(1)];
}

function reflectDegree(degree: number): number {
  return 8 - degree;
}

function rootForBar(bar: SongDraftPlanBar): number {
  if (bar.leader !== "melody") return bar.rootDegree;
  const firstAnchor = bar.anchorDegrees[0] ?? bar.rootDegree;
  const supportOffsets = [0, -2, -4];
  return normalizeLanguageDegree(firstAnchor + (supportOffsets[bar.barIndex % supportOffsets.length] ?? 0));
}

function responseDegreeForBar(bar: SongDraftPlanBar): number {
  const anchors = contourAdjustedAnchors(bar);
  const target = anchors.at(-1) ?? bar.rootDegree;
  if (bar.leader === "answer") return normalizeLanguageDegree(target - 2);
  if (bar.cadence === "home") return 1;
  if (bar.cadence === "half") return 5;
  if (bar.cadence === "surprise") return normalizeLanguageDegree(target + 1);
  return normalizeLanguageDegree(target);
}

function chordDegreesForBar(bar: SongDraftPlanBar, root: number, chordIndex: number): readonly number[] {
  const rootLanguage = root + 1;
  const anchors = bar.leader === "melody" || bar.leader === "answer"
    ? bar.anchorDegrees.map(toEngineDegree)
    : [];
  const chordToneLanguage = [
    rootLanguage,
    normalizeLanguageDegree(rootLanguage + 2),
    normalizeLanguageDegree(rootLanguage + 4),
    ...(bar.tension > 0.55 || chordIndex > 0 ? [normalizeLanguageDegree(rootLanguage + 6)] : []),
  ];
  return uniqueDegrees([
    root,
    ...chordToneLanguage.map(toEngineDegree),
    ...anchors,
  ]);
}

function qualityForBar(bar: SongDraftPlanBar, chordIndex: number): HarmonyChordQuality {
  if (bar.cadence === "surprise" || bar.tension > 0.72) return "sus";
  if (bar.tension > 0.58 || chordIndex > 0) return "seventh";
  if (bar.cadence === "half") return "open";
  return "triad";
}

function needsMidBarChord(bar: SongDraftPlanBar): boolean {
  return bar.rhythm === "busy" ||
    bar.rhythm === "syncopated" ||
    bar.leader === "answer" ||
    bar.tension > 0.62;
}

function createPlanSignature(plan: SongDraftPlan): string {
  return plan.bars
    .map((bar) =>
      `${bar.leader[0]}${bar.rootDegree}${bar.anchorDegrees.join("")}${bar.contour[0]}${bar.rhythm[0]}${bar.cadence[0]}${bar.tension.toFixed(2)}`
    )
    .join("|");
}

function readAnchorDegrees(value: unknown, label: string, errors: string[]): readonly number[] | undefined {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return undefined;
  }
  if (value.length < 2 || value.length > 4) {
    errors.push(`${label} must contain 2..4 degrees`);
    return undefined;
  }
  const degrees: number[] = [];
  for (const [index, entry] of value.entries()) {
    const degree = readDegree(entry, `${label}.${index}`, errors);
    if (degree !== undefined) degrees.push(degree);
  }
  return degrees.length === value.length ? degrees : undefined;
}

function readDegree(value: unknown, label: string, errors: string[]): number | undefined {
  const degree = readInteger(value, label, errors);
  if (degree === undefined) return undefined;
  if (!DEGREE_VALUES.includes(degree as typeof DEGREE_VALUES[number])) {
    errors.push(`${label} must be a scale degree 1..7`);
    return undefined;
  }
  return degree;
}

function readInteger(value: unknown, label: string, errors: string[]): number | undefined {
  if (Number.isInteger(value)) return Number(value);
  errors.push(`${label} must be an integer`);
  return undefined;
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  errors: string[],
): T | undefined {
  if (typeof value === "string" && allowed.includes(value as T)) return value as T;
  errors.push(`${label} must be one of ${allowed.join(", ")}`);
  return undefined;
}

function readClampedNumber(
  value: unknown,
  label: string,
  errors: string[],
  clamps: string[],
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number`);
    return undefined;
  }
  const clamped = clamp01(value);
  if (clamped !== value) {
    clamps.push(`${label} clamped to ${clamped.toFixed(2)}`);
  }
  return round3(clamped);
}

function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function cloneTonalContext(tonalContext: TonalContext): TonalContext {
  return {
    tonic: tonalContext.tonic,
    mode: tonalContext.mode,
    scale: [...tonalContext.scale],
  };
}

function uniqueDegrees(degrees: readonly number[]): readonly number[] {
  return [...new Set(degrees.map(normalizeDegree))];
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function toEngineDegree(languageDegree: number): number {
  return normalizeLanguageDegree(languageDegree) - 1;
}

function normalizeLanguageDegree(degree: number): number {
  return ((Math.trunc(degree) - 1) % 7 + 7) % 7 + 1;
}

function normalizeDegree(degree: number): number {
  return ((Math.trunc(degree) % 7) + 7) % 7;
}

function roundBeat(value: number): number {
  return Math.round(value * 4) / 4;
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

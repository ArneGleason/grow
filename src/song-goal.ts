import {
  DEFAULT_FORM_VARIANT_ID,
  FORM_VARIANTS,
  isFormVariantId,
  type FormVariantId,
} from "./form-variants";
import type { PlayerRole } from "./players";
import type { SongSectionType } from "./song-form";

export const SONG_GOAL_TONICS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

export type SongGoalTonic = typeof SONG_GOAL_TONICS[number];

export const SONG_GOAL_MODES = [
  "ionian",
  "dorian",
  "mixolydian",
  "aeolian",
  "lydian",
  "phrygian",
] as const;

export type SongGoalMode = typeof SONG_GOAL_MODES[number];

export const SONG_GOAL_INFLUENCE_HINTS = [
  "steady-pulse",
  "modal-folk",
  "dub-space",
  "glass-bright",
  "machine-hum",
  "paper-lantern",
  "wide-return",
  "restless-hook",
] as const;

export type SongGoalInfluenceHint = typeof SONG_GOAL_INFLUENCE_HINTS[number];

export const SONG_GOAL_TEMPO_RANGE = {
  minimum: 60,
  maximum: 180,
  snap: 5,
} as const;

export const SONG_GOAL_NUDGE_RANGE = {
  minimum: -0.25,
  maximum: 0.25,
} as const;

const SONG_GOAL_PLAYER_ROLES = [
  "pulse",
  "bass",
  "melody",
  "texture",
  "effects",
] as const satisfies readonly PlayerRole[];
const SONG_GOAL_SECTION_TYPES = [
  "verse",
  "chorus",
  "bridge",
] as const satisfies readonly SongSectionType[];
const DEFAULT_SOURCE_IDEA = "Build a balanced modal terrarium piece.";
const MAX_SOURCE_IDEA_LENGTH = 280;
const MAX_RATIONALE_LENGTH = 360;

export type SongGoalStatus = "deterministic" | "model";
export type SongGoalDispositionBias = Partial<Record<PlayerRole, number>>;
export type SongGoalSectionEmphasis = Partial<Record<SongSectionType, number>>;

export interface SongGoal {
  id: string;
  status: SongGoalStatus;
  sourceIdea: string;
  tonic: SongGoalTonic;
  mode: SongGoalMode;
  tempoBpm: number;
  energy: number;
  surpriseTarget: number;
  brightness: number;
  formPreference: FormVariantId;
  dispositionBias: SongGoalDispositionBias;
  influenceHints: readonly SongGoalInfluenceHint[];
  sectionEmphasis: SongGoalSectionEmphasis;
  brief: string;
  rationale?: string;
}

export interface SongGoalValidationResult {
  valid: boolean;
  goal: SongGoal;
  errors: readonly string[];
  warnings: readonly string[];
  clamps: readonly string[];
}

export interface SongGoalInterpretation {
  source: "deterministic-keywords" | "model";
  matchedKeywords: readonly string[];
  validation: SongGoalValidationResult;
  goal: SongGoal;
}

export interface SongGoalInterpretOptions {
  materialSeed?: number;
}

export interface SongGoalVocabulary {
  tonics: readonly SongGoalTonic[];
  modes: readonly SongGoalMode[];
  formVariants: readonly FormVariantId[];
  influenceHints: readonly SongGoalInfluenceHint[];
  playerRoles: readonly PlayerRole[];
  sectionTypes: readonly SongSectionType[];
  tempoRange: typeof SONG_GOAL_TEMPO_RANGE;
  nudgeRange: typeof SONG_GOAL_NUDGE_RANGE;
}

export const SONG_GOAL_VOCABULARY: SongGoalVocabulary = {
  tonics: SONG_GOAL_TONICS,
  modes: SONG_GOAL_MODES,
  formVariants: FORM_VARIANTS.map((variant) => variant.id),
  influenceHints: SONG_GOAL_INFLUENCE_HINTS,
  playerRoles: SONG_GOAL_PLAYER_ROLES,
  sectionTypes: SONG_GOAL_SECTION_TYPES,
  tempoRange: SONG_GOAL_TEMPO_RANGE,
  nudgeRange: SONG_GOAL_NUDGE_RANGE,
};

export const DEFAULT_SONG_GOAL: SongGoal = finalizeSongGoal({
  status: "deterministic",
  sourceIdea: DEFAULT_SOURCE_IDEA,
  tonic: "C",
  mode: "mixolydian",
  tempoBpm: 90,
  energy: 0.52,
  surpriseTarget: 0.42,
  brightness: 0.48,
  formPreference: DEFAULT_FORM_VARIANT_ID,
  dispositionBias: {
    pulse: 0.06,
    bass: 0.02,
    melody: 0.04,
  },
  influenceHints: ["steady-pulse", "modal-folk"],
  sectionEmphasis: {
    verse: 0.5,
    chorus: 0.58,
    bridge: 0.45,
  },
});

export function createDefaultSongGoal(sourceIdea = DEFAULT_SOURCE_IDEA): SongGoal {
  return finalizeSongGoal({
    ...cloneGoal(DEFAULT_SONG_GOAL),
    id: undefined,
    brief: undefined,
    sourceIdea: sanitizeText(sourceIdea, MAX_SOURCE_IDEA_LENGTH) || DEFAULT_SOURCE_IDEA,
  });
}

export function interpretSongGoal(
  sourceIdea: string,
  options: SongGoalInterpretOptions = {},
): SongGoalInterpretation {
  const text = sanitizeText(sourceIdea, MAX_SOURCE_IDEA_LENGTH) || DEFAULT_SOURCE_IDEA;
  const lowerText = text.toLowerCase();
  const matchedKeywords: string[] = [];
  const draft = createSeededSongGoalDraft(text, options.materialSeed);
  draft.sourceIdea = text;

  const bpmMatch = lowerText.match(/\b(?:bpm|bmp|tempo)\s*(\d{2,3})\b/) ??
    lowerText.match(/\b(\d{2,3})\s*(?:bpm|bmp)\b/);
  if (bpmMatch) {
    draft.tempoBpm = Number(bpmMatch[1]);
    matchedKeywords.push("explicit-tempo");
  } else {
    const tempoCue = readTempoCue(lowerText, matchedKeywords);
    if (tempoCue) {
      draft.tempoBpm = applyTempoCue(draft.tempoBpm, tempoCue);
    }
  }

  const tonic = parseTonic(lowerText);
  if (tonic) {
    draft.tonic = tonic;
    matchedKeywords.push(`tonic-${tonic}`);
  }

  const explicitMode = parseMode(lowerText);
  if (explicitMode) {
    draft.mode = explicitMode;
    matchedKeywords.push(`mode-${explicitMode}`);
  } else if (hasAny(lowerText, ["minor", "sad", "shadow", "dark"], matchedKeywords)) {
    draft.mode = "aeolian";
  } else if (hasAny(lowerText, ["blues", "bluesy", "modal"], matchedKeywords)) {
    draft.mode = "mixolydian";
  } else if (hasAny(lowerText, ["floating", "shimmer", "open sky"], matchedKeywords)) {
    draft.mode = "lydian";
  } else if (hasAny(lowerText, ["folk", "warm", "earth"], matchedKeywords)) {
    draft.mode = "dorian";
  } else if (hasAny(lowerText, ["bright", "clear", "major"], matchedKeywords)) {
    draft.mode = "ionian";
  }

  if (hasAny(lowerText, ["energetic", "loud", "drive", "driving", "urgent", "push"], matchedKeywords)) {
    draft.energy = 0.78;
  }
  if (hasAny(lowerText, ["calm", "quiet", "soft", "hushed", "gentle"], matchedKeywords)) {
    draft.energy = Math.min(draft.energy, 0.34);
  }
  if (hasAny(lowerText, ["spacious", "space", "air", "room", "breath"], matchedKeywords)) {
    draft.energy = Math.min(draft.energy, 0.44);
    draft.sectionEmphasis.bridge = 0.72;
  }

  if (hasAny(lowerText, ["restless", "weird", "surprising", "strange", "unstable"], matchedKeywords)) {
    draft.surpriseTarget = 0.72;
  }
  if (hasAny(lowerText, ["steady", "simple", "plain", "grounded"], matchedKeywords)) {
    draft.surpriseTarget = Math.min(draft.surpriseTarget, 0.3);
  }

  if (hasAny(lowerText, ["bright", "glass", "spark", "clear"], matchedKeywords)) {
    draft.brightness = 0.74;
  }
  if (hasAny(lowerText, ["dark", "shadow", "smoke", "warm"], matchedKeywords)) {
    draft.brightness = Math.min(draft.brightness, 0.34);
  }

  if (hasAny(lowerText, ["wide return", "long return", "final chorus", "spacious return"], matchedKeywords)) {
    draft.formPreference = "wide-return";
    draft.sectionEmphasis.chorus = 0.72;
  } else if (hasAny(lowerText, ["waltz", "three feel", "dance return"], matchedKeywords)) {
    draft.formPreference = "wide-return";
    draft.sectionEmphasis.bridge = 0.68;
  } else if (hasAny(lowerText, ["hook", "chorus", "early chorus", "get to the chorus"], matchedKeywords)) {
    draft.formPreference = "early-hook";
    draft.sectionEmphasis.chorus = 0.82;
  } else if (hasAny(lowerText, ["classic", "standard", "traditional"], matchedKeywords)) {
    draft.formPreference = "classic-arc";
  }

  applyInfluenceHints(lowerText, draft, matchedKeywords);
  applyDispositionBiases(lowerText, draft, matchedKeywords);

  const validation = validateSongGoal(draft);
  return {
    source: "deterministic-keywords",
    matchedKeywords,
    validation,
    goal: validation.goal,
  };
}

export function validateSongGoal(candidate: unknown): SongGoalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const clamps: string[] = [];
  const source = isRecord(candidate) ? candidate : {};
  if (!isRecord(candidate)) {
    errors.push("SongGoal must be an object");
  }

  const fallback = cloneGoal(DEFAULT_SONG_GOAL);
  const sourceIdea = readString(source.sourceIdea, fallback.sourceIdea, "sourceIdea", warnings);
  const status = readStatus(source.status, fallback.status, errors);
  const tonic = readTonic(source.tonic, fallback.tonic, errors);
  const mode = readMode(source.mode, fallback.mode, errors);
  const tempoBpm = readClampedNumber(
    source.tempoBpm,
    fallback.tempoBpm,
    SONG_GOAL_TEMPO_RANGE.minimum,
    SONG_GOAL_TEMPO_RANGE.maximum,
    "tempoBpm",
    warnings,
    clamps,
    SONG_GOAL_TEMPO_RANGE.snap,
  );
  const energy = readClampedNumber(source.energy, fallback.energy, 0, 1, "energy", warnings, clamps);
  const surpriseTarget = readClampedNumber(
    source.surpriseTarget,
    fallback.surpriseTarget,
    0,
    1,
    "surpriseTarget",
    warnings,
    clamps,
  );
  const brightness = readClampedNumber(
    source.brightness,
    fallback.brightness,
    0,
    1,
    "brightness",
    warnings,
    clamps,
  );
  const formPreference = readFormPreference(source.formPreference, fallback.formPreference, errors);
  const dispositionBias = readDispositionBias(source.dispositionBias, fallback.dispositionBias, errors, clamps);
  const influenceHints = readInfluenceHints(source.influenceHints, fallback.influenceHints, errors);
  const sectionEmphasis = readSectionEmphasis(source.sectionEmphasis, fallback.sectionEmphasis, errors, clamps);
  const rationale = readOptionalString(source.rationale, "rationale", warnings, MAX_RATIONALE_LENGTH);

  const goal = finalizeSongGoal({
    id: typeof source.id === "string" ? source.id : undefined,
    status,
    sourceIdea,
    tonic,
    mode,
    tempoBpm,
    energy,
    surpriseTarget,
    brightness,
    formPreference,
    dispositionBias,
    influenceHints,
    sectionEmphasis,
    rationale,
  });

  return {
    valid: errors.length === 0,
    goal,
    errors,
    warnings,
    clamps,
  };
}

function finalizeSongGoal(goal: Omit<SongGoal, "id" | "brief"> & Partial<Pick<SongGoal, "id" | "brief">>): SongGoal {
  const normalized: SongGoal = {
    id: goal.id ?? createSongGoalId(goal),
    status: goal.status,
    sourceIdea: sanitizeText(goal.sourceIdea, MAX_SOURCE_IDEA_LENGTH) || DEFAULT_SOURCE_IDEA,
    tonic: goal.tonic,
    mode: goal.mode,
    tempoBpm: snapNumber(clampNumber(goal.tempoBpm, SONG_GOAL_TEMPO_RANGE.minimum, SONG_GOAL_TEMPO_RANGE.maximum), SONG_GOAL_TEMPO_RANGE.snap),
    energy: clampNumber(goal.energy, 0, 1),
    surpriseTarget: clampNumber(goal.surpriseTarget, 0, 1),
    brightness: clampNumber(goal.brightness, 0, 1),
    formPreference: goal.formPreference,
    dispositionBias: sortDispositionBias(goal.dispositionBias),
    influenceHints: sortUniqueHints(goal.influenceHints),
    sectionEmphasis: sortSectionEmphasis(goal.sectionEmphasis),
    brief: goal.brief ?? "",
    rationale: goal.rationale ? sanitizeText(goal.rationale, MAX_RATIONALE_LENGTH) : undefined,
  };
  return {
    ...normalized,
    brief: goal.brief ?? createSongGoalBrief(normalized),
  };
}

function createSongGoalBrief(goal: SongGoal): string {
  const form = goal.formPreference.replaceAll("-", " ");
  const hints = goal.influenceHints.length > 0 ? goal.influenceHints.join(", ") : "no influence hints";
  return `${goal.tonic} ${goal.mode}, ${goal.tempoBpm} BPM, ${form}; energy ${goal.energy.toFixed(2)}, surprise ${goal.surpriseTarget.toFixed(2)}, brightness ${goal.brightness.toFixed(2)}; ${hints}.`;
}

function createSongGoalId(goal: Omit<SongGoal, "id" | "brief">): string {
  const key = [
    goal.status,
    goal.sourceIdea,
    goal.tonic,
    goal.mode,
    goal.tempoBpm,
    goal.energy.toFixed(3),
    goal.surpriseTarget.toFixed(3),
    goal.brightness.toFixed(3),
    goal.formPreference,
    sortUniqueHints(goal.influenceHints).join(","),
    Object.entries(sortDispositionBias(goal.dispositionBias)).map(([role, value]) => `${role}:${value}`).join(","),
    Object.entries(sortSectionEmphasis(goal.sectionEmphasis)).map(([section, value]) => `${section}:${value}`).join(","),
  ].join("|");
  return `goal-${stableHash(key)}`;
}

function cloneGoal(goal: SongGoal): SongGoal {
  return {
    ...goal,
    dispositionBias: { ...goal.dispositionBias },
    influenceHints: [...goal.influenceHints],
    sectionEmphasis: { ...goal.sectionEmphasis },
  };
}

function createSeededSongGoalDraft(sourceIdea: string, materialSeed = 0): SongGoal {
  const seed = stableHashNumber(sourceIdea) ^ (materialSeed >>> 0);
  const rng = mulberry32(seed || 1);
  const lowerText = sourceIdea.toLowerCase();
  const energyCue = cueLevel(lowerText, {
    low: ["slow", "dream", "drift", "patient", "hushed", "calm", "quiet", "soft", "gentle", "spacious"],
    high: ["fast", "hyper fast", "breakneck", "urgent", "driving", "drive", "rush", "run", "energetic", "loud", "push", "restless"],
  });
  const brightnessCue = cueLevel(lowerText, {
    low: ["dark", "shadow", "smoke", "warm", "minor", "sad"],
    high: ["bright", "glass", "spark", "clear", "shimmer", "shine", "hopeful"],
  });
  const surpriseCue = cueLevel(lowerText, {
    low: ["steady", "simple", "plain", "grounded", "minimal"],
    high: ["restless", "weird", "surprising", "strange", "unstable", "angular"],
  });
  const energy = seededUnit(rng, energyCue);
  const brightness = seededUnit(rng, brightnessCue);
  const surpriseTarget = seededUnit(rng, surpriseCue);
  const tempoBase = 66;
  const tempoSpan = SONG_GOAL_TEMPO_RANGE.maximum - tempoBase;
  const tempoTarget = tempoBase + energy * tempoSpan;
  const tempoBpm = tempoTarget * 0.62 + (tempoBase + rng() * tempoSpan) * 0.38;
  const mode = brightnessCue === undefined
    ? SONG_GOAL_MODES[(seed >>> 3) % SONG_GOAL_MODES.length]!
    : pickWeighted(SONG_GOAL_MODES, rng, (candidate) => modeWeight(candidate, brightness));
  const tonic = pickWeighted(SONG_GOAL_TONICS, rng, () => 1);
  const formPreference = pickWeighted(FORM_VARIANTS.map((variant) => variant.id), rng, (candidate) =>
    candidate === "early-hook" && energy > 0.64
      ? 3
      : candidate === "wide-return" && energy < 0.46
        ? 3
        : 1
  );
  const chorus = clampNumber(0.38 + energy * 0.48 + rng() * 0.18, 0, 1);
  const bridge = clampNumber(0.25 + surpriseTarget * 0.42 + (1 - energy) * 0.18 + rng() * 0.18, 0, 1);
  const verse = clampNumber(0.28 + (1 - energy) * 0.36 + rng() * 0.16, 0, 1);
  return finalizeSongGoal({
    ...cloneGoal(DEFAULT_SONG_GOAL),
    id: undefined,
    brief: undefined,
    tonic,
    mode,
    tempoBpm,
    energy,
    surpriseTarget,
    brightness,
    formPreference,
    influenceHints: [],
    sectionEmphasis: {
      verse,
      chorus,
      bridge,
    },
  });
}

function cueLevel(
  text: string,
  keywords: { high: readonly string[]; low: readonly string[] },
): number | undefined {
  if (keywords.high.some((keyword) => hasKeyword(text, keyword))) return 0.82;
  if (keywords.low.some((keyword) => hasKeyword(text, keyword))) return 0.22;
  return undefined;
}

type TempoCue = "slow" | "mid" | "fast" | "hyper-fast";

function readTempoCue(text: string, matchedKeywords: string[]): TempoCue | undefined {
  if (hasAny(text, ["hyper fast", "very fast", "super fast", "breakneck", "double time", "racing", "sprint"], matchedKeywords)) {
    return "hyper-fast";
  }
  if (hasAny(text, ["fast", "urgent", "driving", "rush", "run"], matchedKeywords)) {
    return "fast";
  }
  if (hasAny(text, ["slow", "dream", "drift", "patient", "hushed"], matchedKeywords)) {
    return "slow";
  }
  if (hasAny(text, ["midtempo", "walking", "steady tempo"], matchedKeywords)) {
    return "mid";
  }
  return undefined;
}

function applyTempoCue(tempoBpm: number, cue: TempoCue): number {
  switch (cue) {
    case "hyper-fast":
      return snapTempo(mapTempoToBand(tempoBpm, 155, 180));
    case "fast":
      return snapTempo(mapTempoToBand(tempoBpm, 125, 150));
    case "slow":
      return snapTempo(mapTempoToBand(tempoBpm, 65, 85));
    case "mid":
      return snapTempo(mapTempoToBand(tempoBpm, 90, 110));
  }
}

function snapTempo(tempoBpm: number): number {
  return snapNumber(tempoBpm, SONG_GOAL_TEMPO_RANGE.snap);
}

function mapTempoToBand(tempoBpm: number, minimum: number, maximum: number): number {
  const boundedMinimum = Math.max(SONG_GOAL_TEMPO_RANGE.minimum, minimum);
  const boundedMaximum = Math.min(SONG_GOAL_TEMPO_RANGE.maximum, maximum);
  const normalized = clampNumber(
    (tempoBpm - SONG_GOAL_TEMPO_RANGE.minimum) /
      (SONG_GOAL_TEMPO_RANGE.maximum - SONG_GOAL_TEMPO_RANGE.minimum),
    0,
    1,
  );
  return boundedMinimum + normalized * (boundedMaximum - boundedMinimum);
}

function seededUnit(rng: () => number, cue: number | undefined): number {
  const raw = 0.18 + rng() * 0.72;
  return roundTo(cue === undefined ? raw : raw * 0.38 + cue * 0.62, 3);
}

function modeWeight(mode: SongGoalMode, brightness: number): number {
  if (brightness >= 0.62) {
    if (mode === "lydian" || mode === "ionian") return 3;
    if (mode === "mixolydian") return 2;
    return 1;
  }
  if (brightness <= 0.38) {
    if (mode === "phrygian" || mode === "aeolian") return 3;
    if (mode === "dorian") return 2;
    return 1;
  }
  return mode === "mixolydian" || mode === "dorian" ? 2 : 1;
}

function pickWeighted<T extends string>(
  values: readonly T[],
  rng: () => number,
  weightFor: (value: T) => number,
): T {
  const weights = values.map((value) => Math.max(0.001, weightFor(value)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = rng() * total;
  for (let index = 0; index < values.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) return values[index]!;
  }
  return values[values.length - 1]!;
}

function hasAny(text: string, keywords: readonly string[], matchedKeywords: string[]): boolean {
  const match = keywords.find((keyword) => hasKeyword(text, keyword));
  if (match) {
    matchedKeywords.push(match);
    return true;
  }
  return false;
}

function parseTonic(text: string): SongGoalTonic | undefined {
  const match = text.match(/\b(?:in|key of)\s+(c#|db|d#|eb|f#|gb|g#|ab|a#|bb|[a-g])\b/);
  if (!match) return undefined;
  const normalized = normalizePitchClass(match[1]);
  return isSongGoalTonic(normalized) ? normalized : undefined;
}

function parseMode(text: string): SongGoalMode | undefined {
  return SONG_GOAL_MODES.find((mode) => hasKeyword(text, mode));
}

function applyInfluenceHints(text: string, draft: SongGoal, matchedKeywords: string[]): void {
  const hints = new Set(draft.influenceHints);
  const addHint = (keyword: string, hint: SongGoalInfluenceHint) => {
    if (hasKeyword(text, keyword)) {
      hints.add(hint);
      matchedKeywords.push(keyword);
    }
  };
  addHint("machine", "machine-hum");
  addHint("industrial", "machine-hum");
  addHint("lantern", "paper-lantern");
  addHint("paper", "paper-lantern");
  addHint("dub", "dub-space");
  addHint("echo", "dub-space");
  addHint("space", "dub-space");
  addHint("spacious", "dub-space");
  addHint("glass", "glass-bright");
  addHint("bright", "glass-bright");
  addHint("folk", "modal-folk");
  addHint("modal", "modal-folk");
  addHint("steady", "steady-pulse");
  addHint("clock", "steady-pulse");
  addHint("restless", "restless-hook");
  addHint("hook", "restless-hook");
  addHint("wide", "wide-return");
  draft.influenceHints = [...hints];
}

function applyDispositionBiases(text: string, draft: SongGoal, matchedKeywords: string[]): void {
  const bias = { ...draft.dispositionBias };
  if (hasAny(text, ["steady", "clock", "grounded"], matchedKeywords)) {
    bias.pulse = clampNumber((bias.pulse ?? 0) + 0.12, SONG_GOAL_NUDGE_RANGE.minimum, SONG_GOAL_NUDGE_RANGE.maximum);
    bias.bass = clampNumber((bias.bass ?? 0) + 0.06, SONG_GOAL_NUDGE_RANGE.minimum, SONG_GOAL_NUDGE_RANGE.maximum);
  }
  if (hasAny(text, ["restless", "surprising", "weird"], matchedKeywords)) {
    bias.melody = clampNumber((bias.melody ?? 0) + 0.14, SONG_GOAL_NUDGE_RANGE.minimum, SONG_GOAL_NUDGE_RANGE.maximum);
    bias.pulse = clampNumber((bias.pulse ?? 0) - 0.04, SONG_GOAL_NUDGE_RANGE.minimum, SONG_GOAL_NUDGE_RANGE.maximum);
  }
  if (hasAny(text, ["machine", "industrial", "fabrication"], matchedKeywords)) {
    bias.pulse = clampNumber((bias.pulse ?? 0) + 0.1, SONG_GOAL_NUDGE_RANGE.minimum, SONG_GOAL_NUDGE_RANGE.maximum);
    bias.bass = clampNumber((bias.bass ?? 0) + 0.1, SONG_GOAL_NUDGE_RANGE.minimum, SONG_GOAL_NUDGE_RANGE.maximum);
  }
  if (hasAny(text, ["air", "space", "spacious"], matchedKeywords)) {
    bias.melody = clampNumber((bias.melody ?? 0) - 0.06, SONG_GOAL_NUDGE_RANGE.minimum, SONG_GOAL_NUDGE_RANGE.maximum);
    bias.bass = clampNumber((bias.bass ?? 0) - 0.03, SONG_GOAL_NUDGE_RANGE.minimum, SONG_GOAL_NUDGE_RANGE.maximum);
  }
  draft.dispositionBias = bias;
}

function hasKeyword(text: string, keyword: string): boolean {
  const textTokens = tokenize(text);
  const keywordTokens = tokenize(keyword);
  if (keywordTokens.length === 0 || textTokens.length < keywordTokens.length) return false;

  for (let index = 0; index <= textTokens.length - keywordTokens.length; index += 1) {
    const matches = keywordTokens.every((token, tokenIndex) => textTokens[index + tokenIndex] === token);
    if (matches) return true;
  }
  return false;
}

function tokenize(value: string): readonly string[] {
  return value.toLowerCase().match(/[a-z0-9#]+/g) ?? [];
}

function readStatus(value: unknown, fallback: SongGoalStatus, errors: string[]): SongGoalStatus {
  if (value === undefined) return fallback;
  if (value === "deterministic" || value === "model") return value;
  errors.push(`status must be deterministic or model`);
  return fallback;
}

function readTonic(value: unknown, fallback: SongGoalTonic, errors: string[]): SongGoalTonic {
  if (value === undefined) return fallback;
  const normalized = typeof value === "string" ? normalizePitchClass(value) : "";
  if (isSongGoalTonic(normalized)) return normalized;
  errors.push(`tonic must be one of ${SONG_GOAL_TONICS.join(", ")}`);
  return fallback;
}

function readMode(value: unknown, fallback: SongGoalMode, errors: string[]): SongGoalMode {
  if (value === undefined) return fallback;
  if (typeof value === "string" && isSongGoalMode(value)) return value;
  errors.push(`mode must be one of ${SONG_GOAL_MODES.join(", ")}`);
  return fallback;
}

function readFormPreference(value: unknown, fallback: FormVariantId, errors: string[]): FormVariantId {
  if (value === undefined) return fallback;
  if (typeof value === "string" && isFormVariantId(value)) return value;
  errors.push(`formPreference must be one of ${SONG_GOAL_VOCABULARY.formVariants.join(", ")}`);
  return fallback;
}

function readInfluenceHints(
  value: unknown,
  fallback: readonly SongGoalInfluenceHint[],
  errors: string[],
): readonly SongGoalInfluenceHint[] {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value)) {
    errors.push("influenceHints must be an array");
    return [...fallback];
  }
  const hints: SongGoalInfluenceHint[] = [];
  for (const item of value) {
    if (typeof item === "string" && isSongGoalInfluenceHint(item)) {
      hints.push(item);
    } else {
      errors.push(`unknown influence hint ${String(item)}`);
    }
  }
  return sortUniqueHints(hints);
}

function readDispositionBias(
  value: unknown,
  fallback: SongGoalDispositionBias,
  errors: string[],
  clamps: string[],
): SongGoalDispositionBias {
  if (value === undefined) return { ...fallback };
  if (!isRecord(value)) {
    errors.push("dispositionBias must be an object keyed by player role");
    return { ...fallback };
  }
  const bias: SongGoalDispositionBias = {};
  for (const [role, rawNudge] of Object.entries(value)) {
    if (!isPlayerRole(role)) {
      errors.push(`unknown disposition role ${role}`);
      continue;
    }
    bias[role] = readNudge(rawNudge, role, clamps);
  }
  return sortDispositionBias(bias);
}

function readSectionEmphasis(
  value: unknown,
  fallback: SongGoalSectionEmphasis,
  errors: string[],
  clamps: string[],
): SongGoalSectionEmphasis {
  if (value === undefined) return { ...fallback };
  if (!isRecord(value)) {
    errors.push("sectionEmphasis must be an object keyed by section type");
    return { ...fallback };
  }
  const emphasis: SongGoalSectionEmphasis = {};
  for (const [sectionType, rawWeight] of Object.entries(value)) {
    if (!isSongSectionType(sectionType)) {
      errors.push(`unknown section emphasis ${sectionType}`);
      continue;
    }
    emphasis[sectionType] = readClampedNumber(rawWeight, 0.5, 0, 1, `sectionEmphasis.${sectionType}`, [], clamps);
  }
  return sortSectionEmphasis(emphasis);
}

function readNudge(value: unknown, label: string, clamps: string[]): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const clamped = clampNumber(value, SONG_GOAL_NUDGE_RANGE.minimum, SONG_GOAL_NUDGE_RANGE.maximum);
  if (clamped !== value) {
    clamps.push(`${label} nudge clamped to ${clamped.toFixed(2)}`);
  }
  return roundTo(clamped, 3);
}

function readString(value: unknown, fallback: string, label: string, warnings: string[]): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") {
    warnings.push(`${label} was not a string; fallback used`);
    return fallback;
  }
  return sanitizeText(value, MAX_SOURCE_IDEA_LENGTH) || fallback;
}

function readOptionalString(
  value: unknown,
  label: string,
  warnings: string[],
  maxLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    warnings.push(`${label} was not a string; omitted`);
    return undefined;
  }
  return sanitizeText(value, maxLength) || undefined;
}

function readClampedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
  warnings: string[],
  clamps: string[],
  snap?: number,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    warnings.push(`${label} was not finite; fallback used`);
    return fallback;
  }
  const clamped = clampNumber(value, minimum, maximum);
  const snapped = snap ? snapNumber(clamped, snap) : clamped;
  if (snapped !== value) {
    clamps.push(`${label} clamped to ${roundTo(snapped, 3)}`);
  }
  return roundTo(snapped, 3);
}

function isSongGoalTonic(value: string): value is SongGoalTonic {
  return (SONG_GOAL_TONICS as readonly string[]).includes(value);
}

function isSongGoalMode(value: string): value is SongGoalMode {
  return (SONG_GOAL_MODES as readonly string[]).includes(value);
}

function isSongGoalInfluenceHint(value: string): value is SongGoalInfluenceHint {
  return (SONG_GOAL_INFLUENCE_HINTS as readonly string[]).includes(value);
}

function isPlayerRole(value: string): value is PlayerRole {
  return (SONG_GOAL_PLAYER_ROLES as readonly string[]).includes(value);
}

function isSongSectionType(value: string): value is SongSectionType {
  return (SONG_GOAL_SECTION_TYPES as readonly string[]).includes(value);
}

function sortUniqueHints(hints: readonly SongGoalInfluenceHint[]): readonly SongGoalInfluenceHint[] {
  const order = new Map(SONG_GOAL_INFLUENCE_HINTS.map((hint, index) => [hint, index]));
  return [...new Set(hints)].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}

function sortDispositionBias(bias: SongGoalDispositionBias): SongGoalDispositionBias {
  return Object.fromEntries(
    SONG_GOAL_PLAYER_ROLES
      .filter((role) => bias[role] !== undefined)
      .map((role) => [role, roundTo(bias[role] ?? 0, 3)]),
  ) as SongGoalDispositionBias;
}

function sortSectionEmphasis(emphasis: SongGoalSectionEmphasis): SongGoalSectionEmphasis {
  return Object.fromEntries(
    SONG_GOAL_SECTION_TYPES
      .filter((section) => emphasis[section] !== undefined)
      .map((section) => [section, roundTo(emphasis[section] ?? 0, 3)]),
  ) as SongGoalSectionEmphasis;
}

function normalizePitchClass(value: string): string {
  const trimmed = value.trim().replace("♭", "b").replace("♯", "#");
  const normalized = `${trimmed.slice(0, 1).toUpperCase()}${trimmed.slice(1)}`;
  const enharmonic: Record<string, SongGoalTonic> = {
    "C#": "Db",
    "D#": "Eb",
    "F#": "Gb",
    "G#": "Ab",
    "A#": "Bb",
  };
  return enharmonic[normalized] ?? normalized;
}

function sanitizeText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function snapNumber(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function roundTo(value: number, places: number): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function stableHash(value: string): string {
  return stableHashNumber(value).toString(36);
}

function stableHashNumber(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

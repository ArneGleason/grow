import {
  FORM_VARIANTS,
  isFormVariantId,
  type FormVariantId,
} from "./form-variants";
import { PLAYER_REGISTRY, type PlayerRole } from "./players";
import { isSongId, SONG_MATERIALS, type SongId } from "./song-material";
import type { SongSectionType } from "./song-form";
import {
  SONG_GOAL_INFLUENCE_HINTS,
  SONG_GOAL_MODES,
  SONG_GOAL_NUDGE_RANGE,
  SONG_GOAL_TEMPO_RANGE,
  SONG_GOAL_TONICS,
  validateSongGoal,
  type SongGoal,
  type SongGoalInfluenceHint,
  type SongGoalInterpretation,
  type SongGoalMode,
  type SongGoalTonic,
} from "./song-goal";

export interface SongIntentPromptPlayerPlan {
  playerId: string;
  role: string;
  enabled: boolean;
  brief: string;
}

export interface SongIntentPromptInput {
  prompt: string;
  deterministicGoal: SongGoal;
  playerPlans: readonly SongIntentPromptPlayerPlan[];
}

export interface SongIntentApplication {
  source: "model";
  interpretation: SongGoalInterpretation;
  baseSongId?: SongId;
  playerBriefs: Readonly<Record<string, string>>;
  matchedSignals: readonly string[];
  rationale?: string;
}

export interface SongIntentApplicationResult {
  valid: boolean;
  errors: readonly string[];
  warnings: readonly string[];
  clamps: readonly string[];
  application?: SongIntentApplication;
}

const SONG_INTENT_SECTION_TYPES = ["verse", "chorus", "bridge"] as const satisfies readonly SongSectionType[];
const MAX_INTENT_RATIONALE_LENGTH = 220;
const MAX_INTENT_PLAYER_BRIEF_LENGTH = 140;

export const SONG_INTENT_RESPONSE_FORMAT = {
  type: "object",
  additionalProperties: false,
  properties: {
    tonic: { type: "string", enum: SONG_GOAL_TONICS },
    mode: { type: "string", enum: SONG_GOAL_MODES },
    tempoBpm: {
      type: "number",
      minimum: SONG_GOAL_TEMPO_RANGE.minimum,
      maximum: SONG_GOAL_TEMPO_RANGE.maximum,
    },
    energy: { type: "number", minimum: 0, maximum: 1 },
    surpriseTarget: { type: "number", minimum: 0, maximum: 1 },
    brightness: { type: "number", minimum: 0, maximum: 1 },
    formPreference: {
      type: "string",
      enum: FORM_VARIANTS.map((variant) => variant.id),
    },
    influenceHints: {
      type: "array",
      maxItems: 4,
      items: { type: "string", enum: SONG_GOAL_INFLUENCE_HINTS },
    },
    sectionEmphasis: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        SONG_INTENT_SECTION_TYPES.map((section) => [section, { type: "number", minimum: 0, maximum: 1 }]),
      ),
    },
    dispositionBias: {
      type: "object",
      additionalProperties: false,
      properties: {
        pulse: {
          type: "number",
          minimum: SONG_GOAL_NUDGE_RANGE.minimum,
          maximum: SONG_GOAL_NUDGE_RANGE.maximum,
        },
        bass: {
          type: "number",
          minimum: SONG_GOAL_NUDGE_RANGE.minimum,
          maximum: SONG_GOAL_NUDGE_RANGE.maximum,
        },
        melody: {
          type: "number",
          minimum: SONG_GOAL_NUDGE_RANGE.minimum,
          maximum: SONG_GOAL_NUDGE_RANGE.maximum,
        },
        texture: {
          type: "number",
          minimum: SONG_GOAL_NUDGE_RANGE.minimum,
          maximum: SONG_GOAL_NUDGE_RANGE.maximum,
        },
        effects: {
          type: "number",
          minimum: SONG_GOAL_NUDGE_RANGE.minimum,
          maximum: SONG_GOAL_NUDGE_RANGE.maximum,
        },
      },
    },
    baseMaterialHint: {
      type: "string",
      enum: SONG_MATERIALS.map((material) => material.id),
    },
    playerBriefs: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        PLAYER_REGISTRY.map((player) => [
          player.id,
          { type: "string", minLength: 1, maxLength: MAX_INTENT_PLAYER_BRIEF_LENGTH },
        ]),
      ),
    },
    rationale: {
      type: "string",
      minLength: 1,
      maxLength: MAX_INTENT_RATIONALE_LENGTH,
    },
  },
} as const;

export function createSongIntentPrimer(): string {
  return [
    "You are Grow's local song-intent interpreter.",
    "Read poetic or ordinary language as musical direction, then choose only bounded app-owned knobs.",
    "Return one compact JSON object. No markdown. No prose outside JSON.",
    "Do not output notes, chords, lyrics, melodies, rhythms, scale degrees, pitch names beyond tonic, MIDI, or scheduling instructions.",
    "The app owns all generated musical material. Your job is setup, character, section emphasis, material flavor, and short player brief nudges.",
    "Prefer interpreting metaphor. For example glass can mean bright, brittle, or high surprise; machinery can mean pulse, drive, or low brightness.",
    "If the prompt explicitly asks for key, mode, tempo, or form, honor it within the allowed vocabulary.",
  ].join("\n");
}

export function createSongIntentPrompt(input: SongIntentPromptInput): string {
  const enabledPlayers = input.playerPlans
    .filter((plan) => plan.enabled)
    .map((plan) => ({
      playerId: plan.playerId,
      role: plan.role,
      currentBrief: plan.brief,
    }));
  return [
    "Interpret this song request into bounded Grow song intent.",
    "Return any subset of the JSON fields from the response schema. Omit uncertain fields instead of guessing rigidly.",
    "A useful response changes at least one musical setup or character field.",
    "playerBriefs may add short role-specific direction; keep them concrete and playable.",
    "Allowed vocabulary:",
    JSON.stringify({
      tonics: SONG_GOAL_TONICS,
      modes: SONG_GOAL_MODES,
      tempoBpm: SONG_GOAL_TEMPO_RANGE,
      formPreferences: FORM_VARIANTS.map((variant) => variant.id),
      influenceHints: SONG_GOAL_INFLUENCE_HINTS,
      sectionEmphasis: SONG_INTENT_SECTION_TYPES,
      dispositionBiasRoles: ["pulse", "bass", "melody", "texture", "effects"],
      baseMaterialHints: SONG_MATERIALS.map((material) => material.id),
    }),
    "Seeded deterministic fallback goal:",
    JSON.stringify(projectGoalForPrompt(input.deterministicGoal)),
    "Enabled players:",
    JSON.stringify(enabledPlayers),
    "User request:",
    input.prompt,
  ].join("\n");
}

export function applySongIntentResponse(
  base: SongGoalInterpretation,
  response: unknown,
): SongIntentApplicationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const matchedSignals: string[] = [];
  if (!isRecord(response)) {
    return {
      valid: false,
      errors: ["song intent response must be an object"],
      warnings,
      clamps: [],
    };
  }

  const candidate: SongGoal = {
    ...base.goal,
    dispositionBias: { ...base.goal.dispositionBias },
    influenceHints: [...base.goal.influenceHints],
    sectionEmphasis: { ...base.goal.sectionEmphasis },
    status: "model",
  };

  if (response.tonic !== undefined) {
    const tonic = readTonic(response.tonic, errors);
    if (tonic) {
      candidate.tonic = tonic;
      matchedSignals.push(`tonic-${tonic}`);
    }
  }
  if (response.mode !== undefined) {
    const mode = readMode(response.mode, errors);
    if (mode) {
      candidate.mode = mode;
      matchedSignals.push(`mode-${mode}`);
    }
  }
  if (response.tempoBpm !== undefined) {
    const tempoBpm = readNumber(response.tempoBpm, "tempoBpm", errors);
    if (tempoBpm !== undefined) {
      candidate.tempoBpm = tempoBpm;
      matchedSignals.push("tempoBpm");
    }
  }
  for (const field of ["energy", "surpriseTarget", "brightness"] as const) {
    if (response[field] === undefined) continue;
    const value = readNumber(response[field], field, errors);
    if (value === undefined) continue;
    candidate[field] = value;
    matchedSignals.push(field);
  }
  if (response.formPreference !== undefined) {
    const formPreference = readFormPreference(response.formPreference, errors);
    if (formPreference) {
      candidate.formPreference = formPreference;
      matchedSignals.push(`form-${formPreference}`);
    }
  }
  if (response.influenceHints !== undefined) {
    const influenceHints = readInfluenceHints(response.influenceHints, errors);
    if (influenceHints) {
      candidate.influenceHints = influenceHints;
      matchedSignals.push(...influenceHints.map((hint) => `hint-${hint}`));
    }
  }
  if (response.sectionEmphasis !== undefined) {
    const sectionEmphasis = readSectionEmphasis(response.sectionEmphasis, errors);
    if (sectionEmphasis) {
      candidate.sectionEmphasis = sectionEmphasis;
      matchedSignals.push(...Object.keys(sectionEmphasis).map((section) => `section-${section}`));
    }
  }
  if (response.dispositionBias !== undefined) {
    const dispositionBias = readDispositionBias(response.dispositionBias, errors);
    if (dispositionBias) {
      candidate.dispositionBias = dispositionBias;
      matchedSignals.push(...Object.keys(dispositionBias).map((role) => `bias-${role}`));
    }
  }
  const baseSongId = response.baseMaterialHint === undefined
    ? undefined
    : readBaseMaterialHint(response.baseMaterialHint, errors);
  if (baseSongId) matchedSignals.push(`material-${baseSongId}`);

  const playerBriefs = response.playerBriefs === undefined
    ? {}
    : readPlayerBriefs(response.playerBriefs, errors, warnings);
  if (playerBriefs) {
    matchedSignals.push(...Object.keys(playerBriefs).map((playerId) => `brief-${playerId}`));
  }

  const rationale = response.rationale === undefined
    ? undefined
    : sanitizeText(response.rationale, MAX_INTENT_RATIONALE_LENGTH);
  if (response.rationale !== undefined && !rationale) {
    warnings.push("rationale was empty after sanitizing");
  }
  candidate.rationale = rationale;

  const validation = validateSongGoal(candidate);
  const clamps = [...validation.clamps];
  const allErrors = [...errors, ...validation.errors];
  if (matchedSignals.length === 0) {
    allErrors.push("song intent did not change any bounded field");
  }

  const interpretation: SongGoalInterpretation = {
    source: "model",
    matchedKeywords: [...base.matchedKeywords, ...dedupeStrings(matchedSignals)],
    validation,
    goal: validation.goal,
  };
  const valid = allErrors.length === 0 && validation.valid;
  return {
    valid,
    errors: allErrors,
    warnings: [...warnings, ...validation.warnings],
    clamps,
    application: valid
      ? {
        source: "model",
        interpretation,
        baseSongId,
        playerBriefs: playerBriefs ?? {},
        matchedSignals: dedupeStrings(matchedSignals),
        rationale,
      }
      : undefined,
  };
}

function projectGoalForPrompt(goal: SongGoal): Record<string, unknown> {
  return {
    tonic: goal.tonic,
    mode: goal.mode,
    tempoBpm: goal.tempoBpm,
    energy: goal.energy,
    surpriseTarget: goal.surpriseTarget,
    brightness: goal.brightness,
    formPreference: goal.formPreference,
    influenceHints: goal.influenceHints,
    sectionEmphasis: goal.sectionEmphasis,
    dispositionBias: goal.dispositionBias,
  };
}

function readTonic(value: unknown, errors: string[]): SongGoalTonic | undefined {
  if (typeof value === "string" && (SONG_GOAL_TONICS as readonly string[]).includes(value)) {
    return value as SongGoalTonic;
  }
  errors.push(`tonic must be one of ${SONG_GOAL_TONICS.join(", ")}`);
  return undefined;
}

function readMode(value: unknown, errors: string[]): SongGoalMode | undefined {
  if (typeof value === "string" && (SONG_GOAL_MODES as readonly string[]).includes(value)) {
    return value as SongGoalMode;
  }
  errors.push(`mode must be one of ${SONG_GOAL_MODES.join(", ")}`);
  return undefined;
}

function readFormPreference(value: unknown, errors: string[]): FormVariantId | undefined {
  if (typeof value === "string" && isFormVariantId(value)) return value;
  errors.push(`formPreference must be one of ${FORM_VARIANTS.map((variant) => variant.id).join(", ")}`);
  return undefined;
}

function readInfluenceHints(value: unknown, errors: string[]): readonly SongGoalInfluenceHint[] | undefined {
  if (!Array.isArray(value)) {
    errors.push("influenceHints must be an array");
    return undefined;
  }
  const hints: SongGoalInfluenceHint[] = [];
  for (const hint of value) {
    if (typeof hint === "string" && (SONG_GOAL_INFLUENCE_HINTS as readonly string[]).includes(hint)) {
      hints.push(hint as SongGoalInfluenceHint);
    } else {
      errors.push(`unknown influence hint ${String(hint)}`);
    }
  }
  return dedupeStrings(hints) as SongGoalInfluenceHint[];
}

function readSectionEmphasis(value: unknown, errors: string[]): Partial<Record<SongSectionType, number>> | undefined {
  if (!isRecord(value)) {
    errors.push("sectionEmphasis must be an object");
    return undefined;
  }
  const emphasis: Partial<Record<SongSectionType, number>> = {};
  for (const [section, raw] of Object.entries(value)) {
    if (!(SONG_INTENT_SECTION_TYPES as readonly string[]).includes(section)) {
      errors.push(`unknown section emphasis ${section}`);
      continue;
    }
    const number = readNumber(raw, `sectionEmphasis.${section}`, errors);
    if (number !== undefined) emphasis[section as SongSectionType] = number;
  }
  return emphasis;
}

function readDispositionBias(value: unknown, errors: string[]): Partial<Record<PlayerRole, number>> | undefined {
  if (!isRecord(value)) {
    errors.push("dispositionBias must be an object");
    return undefined;
  }
  const roles = new Set<PlayerRole>(["pulse", "bass", "melody", "texture", "effects"]);
  const bias: Partial<Record<PlayerRole, number>> = {};
  for (const [role, raw] of Object.entries(value)) {
    if (!roles.has(role as PlayerRole)) {
      errors.push(`unknown disposition role ${role}`);
      continue;
    }
    const number = readNumber(raw, `dispositionBias.${role}`, errors);
    if (number !== undefined) bias[role as PlayerRole] = number;
  }
  return bias;
}

function readBaseMaterialHint(value: unknown, errors: string[]): SongId | undefined {
  if (typeof value === "string" && isSongId(value)) return value;
  errors.push(`baseMaterialHint must be one of ${SONG_MATERIALS.map((material) => material.id).join(", ")}`);
  return undefined;
}

function readPlayerBriefs(
  value: unknown,
  errors: string[],
  warnings: string[],
): Readonly<Record<string, string>> | undefined {
  if (!isRecord(value)) {
    errors.push("playerBriefs must be an object");
    return undefined;
  }
  const playerIds = new Set(PLAYER_REGISTRY.map((player) => player.id));
  const briefs: Record<string, string> = {};
  for (const [playerId, rawBrief] of Object.entries(value)) {
    if (!playerIds.has(playerId)) {
      errors.push(`unknown playerBriefs player ${playerId}`);
      continue;
    }
    const brief = sanitizeText(rawBrief, MAX_INTENT_PLAYER_BRIEF_LENGTH);
    if (!brief) {
      warnings.push(`empty playerBriefs.${playerId} ignored`);
      continue;
    }
    briefs[playerId] = brief;
  }
  return briefs;
}

function readNumber(value: unknown, label: string, errors: string[]): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  errors.push(`${label} must be a finite number`);
  return undefined;
}

function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function dedupeStrings<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

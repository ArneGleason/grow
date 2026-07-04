import type { SongGoal } from "./song-goal";
import type { SongDraftPlan, SongDraftPlanBar } from "./song-draft-plan";
import type { PatternNoteSource, PlayerPatternSource } from "./song-material";

// A motif plan is the smallest musical statement a model (or seed) can make
// that still forces a coherent song: ONE melodic cell (relative steps + rhythm),
// ONE functional harmonic move (a real 8-bar sentence that ends V->I), a peak,
// and a chorus transform. The code develops the cell across the sentence;
// coherence comes from development, not from per-bar choices.

export const SONG_MOTIF_HARMONIC_MOVES = ["settle", "lift", "lean", "fall"] as const;
export type SongMotifHarmonicMove = typeof SONG_MOTIF_HARMONIC_MOVES[number];

export const SONG_MOTIF_CHORUS_TRANSFORMS = ["invert", "double-time", "wider", "answer"] as const;
export type SongMotifChorusTransform = typeof SONG_MOTIF_CHORUS_TRANSFORMS[number];

export const SONG_MOTIF_RHYTHM_VALUES = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;

export const SONG_MOTIF_BAR_COUNT = 8;
const BEATS_PER_BAR = 4;
const MIN_CELL_LENGTH = 4;
const MAX_CELL_LENGTH = 6;
const MAX_STEP = 3;

// Two 4-bar phrases in engine scale degrees (0 = I). Every move ends ...V, I so
// the sentence audibly arrives; bar 3 differentiates the half-way feel.
export const SONG_MOTIF_MOVE_ROOTS: Record<SongMotifHarmonicMove, readonly number[]> = {
  settle: [0, 0, 3, 0, 0, 5, 4, 0],
  lift: [0, 3, 4, 5, 3, 0, 4, 0],
  lean: [0, 5, 3, 4, 0, 3, 4, 0],
  fall: [0, 4, 5, 2, 3, 0, 4, 0],
};

export interface SongMotifPlan {
  version: "grow.songMotifPlan/1";
  source: "model" | "seeded";
  cellSteps: readonly number[];
  cellRhythm: readonly number[];
  move: SongMotifHarmonicMove;
  peakBar: number;
  chorusTransform: SongMotifChorusTransform;
  mood: string;
}

export interface SongMotifPlanValidationResult {
  valid: boolean;
  plan?: SongMotifPlan;
  errors: readonly string[];
  warnings: readonly string[];
  clamps: readonly string[];
}

export interface SongMotifPlanPromptInput {
  prompt: string;
  goal: Pick<SongGoal, "mode" | "tempoBpm" | "energy" | "brightness" | "surpriseTarget">;
}

export const SONG_MOTIF_PLAN_RESPONSE_FORMAT = {
  type: "object",
  properties: {
    cellSteps: { type: "array", items: { type: "integer", minimum: -3, maximum: 3 }, minItems: 4, maxItems: 6 },
    cellRhythm: { type: "array", items: { type: "number", enum: [...SONG_MOTIF_RHYTHM_VALUES] }, minItems: 4, maxItems: 6 },
    move: { type: "string", enum: [...SONG_MOTIF_HARMONIC_MOVES] },
    peakBar: { type: "integer", minimum: 3, maximum: 7 },
    chorusTransform: { type: "string", enum: [...SONG_MOTIF_CHORUS_TRANSFORMS] },
    mood: { type: "string" },
  },
  required: ["cellSteps", "cellRhythm", "move", "peakBar", "chorusTransform", "mood"],
} as const;

export function createSongMotifPlanPrimer(): string {
  return [
    "You give a tiny musical motif for a song idea. Reply with ONLY compact JSON, no commentary.",
    "Schema: {\"cellSteps\": array of 4-6 integers, each -3..3, FIRST must be 0, relative scale steps from the previous note;",
    "\"cellRhythm\": array same length, each one of 0.25,0.5,0.75,1,1.5,2 (beats);",
    "\"move\": one of \"settle\" (stays home, calm), \"lift\" (rises then releases), \"lean\" (yearning pull), \"fall\" (descending weight);",
    "\"peakBar\": integer 3-7 where intensity peaks; \"chorusTransform\": one of \"invert\",\"double-time\",\"wider\",\"answer\"; \"mood\": 2-4 words}.",
    "Choose to match the idea's motion, weight and feel. A short spiky cell reads urgent; long even values read calm.",
    "Do not reuse values you would give for a different idea.",
  ].join(" ");
}

export function createSongMotifPlanPrompt(input: SongMotifPlanPromptInput): string {
  const goal = input.goal;
  return [
    `Song idea: ${input.prompt.trim().slice(0, 240)}`,
    `Context: mode ${goal.mode}, ${Math.round(goal.tempoBpm)} BPM, energy ${goal.energy.toFixed(2)}, brightness ${goal.brightness.toFixed(2)}, surprise ${goal.surpriseTarget.toFixed(2)}.`,
  ].join("\n");
}

export function parseSongMotifPlanResponse(rawResponse: string): SongMotifPlanValidationResult {
  const trimmed = (rawResponse ?? "").trim();
  if (!trimmed) {
    return { valid: false, errors: ["empty motif plan response"], warnings: [], clamps: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(trimmed));
  } catch {
    return { valid: false, errors: ["motif plan response was not valid JSON"], warnings: [], clamps: [] };
  }
  return validateSongMotifPlanResponse(parsed);
}

export function validateSongMotifPlanResponse(response: unknown): SongMotifPlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const clamps: string[] = [];
  if (!isRecord(response)) {
    return { valid: false, errors: ["motif plan must be an object"], warnings, clamps };
  }

  const rawSteps = Array.isArray(response.cellSteps) ? response.cellSteps : undefined;
  if (!rawSteps || rawSteps.length < MIN_CELL_LENGTH) {
    errors.push(`cellSteps must be an array of ${MIN_CELL_LENGTH}-${MAX_CELL_LENGTH} integers`);
  }
  const steps = (rawSteps ?? []).slice(0, MAX_CELL_LENGTH).map((value, index) => {
    const n = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
    const clamped = Math.max(-MAX_STEP, Math.min(MAX_STEP, n));
    if (clamped !== value) clamps.push(`cellSteps.${index} clamped to ${clamped}`);
    return clamped;
  });
  if (steps.length > 0 && steps[0] !== 0) {
    clamps.push("cellSteps.0 forced to 0");
    steps[0] = 0;
  }

  const rawRhythm = Array.isArray(response.cellRhythm) ? response.cellRhythm : undefined;
  const rhythm = (rawRhythm ?? []).slice(0, MAX_CELL_LENGTH).map((value, index) => {
    const n = typeof value === "number" && Number.isFinite(value) ? value : 1;
    const snapped = snapRhythm(n);
    if (snapped !== value) clamps.push(`cellRhythm.${index} snapped to ${snapped}`);
    return snapped;
  });
  while (rhythm.length < steps.length) rhythm.push(1);
  if (rhythm.length > steps.length) rhythm.length = steps.length;

  const move = isMotifMove(response.move) ? response.move : undefined;
  if (!move) errors.push(`move must be one of ${SONG_MOTIF_HARMONIC_MOVES.join(", ")}`);
  const transform = isMotifTransform(response.chorusTransform) ? response.chorusTransform : undefined;
  if (!transform) errors.push(`chorusTransform must be one of ${SONG_MOTIF_CHORUS_TRANSFORMS.join(", ")}`);
  const rawPeak = typeof response.peakBar === "number" && Number.isFinite(response.peakBar)
    ? Math.trunc(response.peakBar)
    : 5;
  const peakBar = Math.max(3, Math.min(SONG_MOTIF_BAR_COUNT - 1, rawPeak));
  if (peakBar !== response.peakBar) clamps.push(`peakBar clamped to ${peakBar}`);
  const mood = typeof response.mood === "string" ? response.mood.trim().slice(0, 40) : "";

  if (errors.length > 0 || steps.length < MIN_CELL_LENGTH || !move || !transform) {
    return { valid: false, errors, warnings, clamps };
  }
  if (isDegenerateMotifCell(steps)) {
    return { valid: false, errors: ["cellSteps are degenerate (flat or constant)"], warnings, clamps };
  }
  return {
    valid: true,
    errors: [],
    warnings,
    clamps,
    plan: {
      version: "grow.songMotifPlan/1",
      source: "model",
      cellSteps: steps,
      cellRhythm: rhythm,
      move,
      peakBar,
      chorusTransform: transform,
      mood,
    },
  };
}

export function isDegenerateMotifCell(steps: readonly number[]): boolean {
  if (steps.length < MIN_CELL_LENGTH) return true;
  const distinct = new Set(steps).size;
  if (distinct < 2) return true;
  return steps.every((step) => step === 0);
}

const SEEDED_CELLS: readonly (readonly number[])[] = [
  [0, 2, -1, -1, 2],
  [0, -1, -1, 3, -2],
  [0, 1, 2, -3, 1, 1],
  [0, -2, 1, 1, -2, 2],
  [0, 3, -1, -2, 1],
  [0, 1, -2, 2, -1, 1],
  [0, -3, 2, 1, -1],
  [0, 2, 2, -3, -1, 1],
];

const SEEDED_RHYTHMS: readonly (readonly number[])[] = [
  [1, 0.5, 0.5, 1.5, 0.5],
  [0.5, 0.5, 1, 0.75, 1.25],
  [1.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  [0.75, 0.75, 0.5, 1, 0.5, 0.5],
  [2, 0.5, 0.5, 0.75, 0.25],
  [0.5, 1, 0.5, 1, 0.5, 0.5],
];

export function createSeededSongMotifPlan(
  seed: number,
  goal?: Pick<SongGoal, "energy" | "brightness" | "surpriseTarget">,
): SongMotifPlan {
  const rng = mulberry32((seed >>> 0) || 1);
  const cellIndex = Math.floor(rng() * SEEDED_CELLS.length);
  const rhythmIndex = Math.floor(rng() * SEEDED_RHYTHMS.length);
  const cell = SEEDED_CELLS[cellIndex] ?? SEEDED_CELLS[0];
  const rhythmBase = SEEDED_RHYTHMS[rhythmIndex] ?? SEEDED_RHYTHMS[0];
  const length = Math.min(cell.length, rhythmBase.length);
  const energy = goal?.energy ?? rng();
  const surprise = goal?.surpriseTarget ?? rng();
  const move = energy > 0.66
    ? (rng() < 0.5 ? "lift" : "fall")
    : energy < 0.36
      ? (rng() < 0.6 ? "settle" : "lean")
      : SONG_MOTIF_HARMONIC_MOVES[Math.floor(rng() * SONG_MOTIF_HARMONIC_MOVES.length)]!;
  const transform = surprise > 0.6
    ? (rng() < 0.5 ? "invert" : "answer")
    : SONG_MOTIF_CHORUS_TRANSFORMS[Math.floor(rng() * SONG_MOTIF_CHORUS_TRANSFORMS.length)]!;
  return {
    version: "grow.songMotifPlan/1",
    source: "seeded",
    cellSteps: cell.slice(0, length),
    cellRhythm: rhythmBase.slice(0, length),
    move,
    peakBar: 3 + Math.floor(rng() * 5),
    chorusTransform: transform,
    mood: "",
  };
}

export function normalizeStoredSongMotifPlan(candidate: unknown): SongMotifPlan | undefined {
  if (!isRecord(candidate)) return undefined;
  const result = validateSongMotifPlanResponse(candidate);
  if (!result.valid || !result.plan) return undefined;
  const source = candidate.source === "seeded" ? "seeded" : "model";
  const mood = typeof candidate.mood === "string" ? candidate.mood.trim().slice(0, 40) : "";
  return { ...result.plan, source, mood };
}

// ---- Expansion: motif plan -> the existing SongDraftPlan contract ----------
// Keeps every downstream consumer (voice-led harmony, keyboard, leadership)
// working, but feeds them a functional sentence instead of model boilerplate.

export function expandSongMotifPlanToDraftPlan(plan: SongMotifPlan, seed: number): SongDraftPlan {
  const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
  const walk = developSongMotifWalk(plan, seed);
  const bars: SongDraftPlanBar[] = roots.map((rootDegree, barIndex) => {
    const barNotes = walk.bars[barIndex] ?? [];
    const entry = barNotes[0]?.degree ?? rootDegree + 2;
    const exit = barNotes[barNotes.length - 1]?.degree ?? entry;
    const distanceFromPeak = Math.abs(barIndex - plan.peakBar);
    const tension = clamp01(0.35 + (plan.peakBar === barIndex ? 0.45 : 0.3 - distanceFromPeak * 0.08) + (barIndex >= 6 ? -0.1 : 0));
    return {
      barIndex,
      leader: barIndex % 4 === 3 ? "harmony" : "melody",
      rootDegree: normalizeDegree(rootDegree) + 1,
      anchorDegrees: [normalizeDegree(entry) + 1, normalizeDegree(exit) + 1],
      contour: contourOf(barNotes),
      rhythm: rhythmLabelOf(plan),
      cadence: barIndex === 7 ? "home" : barIndex === 3 ? "half" : barIndex === plan.peakBar ? "surprise" : "open",
      tension: round3(tension),
    };
  });
  return {
    version: "grow.songDraftPlan/1",
    source: "model",
    bars,
    summary: `motif ${plan.move}, peak bar ${plan.peakBar + 1}${plan.mood ? `, ${plan.mood}` : ""}`,
  };
}

// ---- Development: the cell becomes the tune --------------------------------

interface MotifWalkNote {
  startBeat: number;
  durationBeats: number;
  degree: number;
  strong: boolean;
  cadence: boolean;
  leading?: boolean;
}

interface MotifWalk {
  bars: readonly (readonly MotifWalkNote[])[];
}

export const SONG_MOTIF_DEVELOPMENT_OPS = ["state", "sequence", "answer", "vary-rhythm", "breath"] as const;
export type SongMotifDevelopmentOp = typeof SONG_MOTIF_DEVELOPMENT_OPS[number];

// Development schedule: bar 0 states the cell; cadence bars land; the bars
// between develop it — sequence along the phrase arc, answer it inverted,
// split its long note, or breathe. Identity through variation, not looping.
export function chooseSongMotifDevelopmentOps(_plan: SongMotifPlan, seed: number): readonly SongMotifDevelopmentOp[] {
  const rng = mulberry32(((seed >>> 0) ^ 0x7f4a7c15) || 1);
  const pool: SongMotifDevelopmentOp[] = ["sequence", "answer", "vary-rhythm", "breath", "sequence", "state"];
  const ops: SongMotifDevelopmentOp[] = [];
  let previous: SongMotifDevelopmentOp = "state";
  for (let bar = 0; bar < SONG_MOTIF_BAR_COUNT; bar += 1) {
    if (bar === 0) { ops.push("state"); previous = "state"; continue; }
    if (bar === 3 || bar === 7) { ops.push("state"); previous = "state"; continue; }
    if (bar === 4) { ops.push("state"); previous = "state"; continue; }
    let op = pool[Math.floor(rng() * pool.length)] ?? "state";
    if (op === previous && op !== "sequence") op = "state";
    ops.push(op);
    previous = op;
  }
  return ops;
}

export interface SongMotifWalkOptions {
  chorusTransform?: SongMotifChorusTransform;
}

export function developSongMotifWalk(plan: SongMotifPlan, seed: number, walkOptions: SongMotifWalkOptions = {}): MotifWalk {
  const chorus = walkOptions.chorusTransform;
  const workingPlan = chorus ? transformPlanForChorus(plan, chorus) : plan;
  const roots = SONG_MOTIF_MOVE_ROOTS[plan.move];
  const rng = mulberry32(((seed >>> 0) ^ (chorus ? 0x2c9277b5 : 0x51ed2701)) || 1);
  const baseOps = chooseSongMotifDevelopmentOps(workingPlan, seed);
  const ops = chorus
    ? baseOps.map((op, bar) => (op === "breath" ? "state" : chorus === "answer" && bar % 2 === 1 && bar !== 3 && bar !== 7 ? "answer" : op))
    : baseOps;
  const bars: MotifWalkNote[][] = [];
  let previousExit: number | undefined;

  for (let barIndex = 0; barIndex < SONG_MOTIF_BAR_COUNT; barIndex += 1) {
    const root = roots[barIndex] ?? 0;
    const chordTones = [root, root + 2, root + 4];
    const op = ops[barIndex] ?? "state";
    // Phrase arc: entries rise into the peak bar and settle after it, so the
    // eight bars have a shape instead of hovering.
    const arcLift = chorus ? 2 : 0;
    const arcBias = arcLift + (barIndex <= plan.peakBar
      ? (barIndex / Math.max(1, plan.peakBar)) * 2.4
      : 2.4 - ((barIndex - plan.peakBar) / Math.max(1, SONG_MOTIF_BAR_COUNT - 1 - plan.peakBar)) * 3.2);
    const target = previousExit === undefined ? root + 2 : previousExit + (op === "sequence" ? 1 : 0);
    const entry = previousExit === undefined
      ? root + 2
      : nearestTo(chordTones.map((tone) => tone + (arcBias >= 1.2 ? 7 * Math.round((target + 2 - tone) / 7) : 7 * Math.round((target - tone) / 7))), target + arcBias * 0.5);
    const steps = op === "answer" ? workingPlan.cellSteps.map((step) => -step) : workingPlan.cellSteps;
    let rhythm = [...workingPlan.cellRhythm];
    if (op === "vary-rhythm") {
      const longest = rhythm.indexOf(Math.max(...rhythm));
      if (rhythm[longest]! >= 1) {
        const half = rhythm[longest]! / 2;
        rhythm.splice(longest, 1, half, half);
      }
    }
    const displacement = chorus
      ? 0
      : op === "breath" ? (rng() < 0.5 ? 1 : 1.5) : (barIndex % 2 === 1 && rng() < 0.35 ? 0.5 : 0);
    const notes: MotifWalkNote[] = [];
    let degree = entry;
    let cursor = displacement;
    const isCadenceBar = barIndex === 3 || barIndex === 7;
    const stepsForBar = op === "vary-rhythm" ? expandStepsForRhythm(steps, rhythm.length) : steps;
    for (let i = 0; i < stepsForBar.length; i += 1) {
      if (i > 0) degree += stepsForBar[i] ?? 0;
      degree = foldDegree(degree, entry);
      let duration = rhythm[i] ?? 1;
      if (cursor + duration > BEATS_PER_BAR) duration = BEATS_PER_BAR - cursor;
      if (duration < 0.25) break;
      const strong = i === 0;
      // articulation: inner notes detach, strong notes carry — less plunk, more speech
      const spoken = isCadenceBar ? duration : round3(Math.max(0.25, duration * (strong ? 0.95 : 0.62)));
      notes.push({
        startBeat: barIndex * BEATS_PER_BAR + cursor,
        durationBeats: spoken,
        degree,
        strong,
        cadence: false,
      });
      cursor += duration;
      if (cursor >= BEATS_PER_BAR) break;
    }
    if (notes.length === 0) {
      notes.push({ startBeat: barIndex * BEATS_PER_BAR, durationBeats: 1, degree: entry, strong: true, cadence: false });
      cursor = displacement + 1;
    }
    if (isCadenceBar) {
      const last = notes[notes.length - 1];
      const target7 = barIndex === 7
        ? root + 7 * Math.round((last.degree - root) / 7)
        : nearestTo(chordTones, last.degree);
      last.degree = target7;
      last.durationBeats = Math.max(1, BEATS_PER_BAR - (last.startBeat - barIndex * BEATS_PER_BAR));
      last.cadence = true;
      if (barIndex === 7 && notes.length >= 2) {
        // the note before the final arrival becomes a leading tone resolving up
        const approach = notes[notes.length - 2];
        approach.degree = last.degree - 1;
        approach.leading = true;
      }
    } else if (cursor < BEATS_PER_BAR && rng() < 0.3) {
      const last = notes[notes.length - 1];
      last.durationBeats = round3(last.durationBeats + Math.min(1, BEATS_PER_BAR - cursor));
    }
    previousExit = notes[notes.length - 1]?.degree;
    bars.push(notes);
  }
  return { bars };
}

function expandStepsForRhythm(steps: readonly number[], targetLength: number): readonly number[] {
  if (targetLength <= steps.length) return steps;
  const extended = [...steps];
  while (extended.length < targetLength) {
    extended.push(extended.length % 2 === 0 ? 1 : -1);
  }
  return extended;
}

function transformPlanForChorus(plan: SongMotifPlan, transform: SongMotifChorusTransform): SongMotifPlan {
  if (transform === "invert") {
    return { ...plan, cellSteps: plan.cellSteps.map((step) => -step) };
  }
  if (transform === "double-time") {
    const halved = plan.cellRhythm.map((value) => Math.max(0.25, value / 2));
    return {
      ...plan,
      cellSteps: [...plan.cellSteps, ...plan.cellSteps],
      cellRhythm: [...halved, ...halved],
    };
  }
  if (transform === "wider") {
    return {
      ...plan,
      cellSteps: plan.cellSteps.map((step) => step === 0 ? 0 : Math.sign(step) * Math.min(MAX_STEP, Math.abs(step) + 1)),
    };
  }
  return plan;
}

export interface SongMotifMelodyOptions {
  seed: number;
  playerId?: string;
  octave?: number;
  subdivisionBeats?: number;
  velocityScale?: number;
  chorusTransform?: SongMotifChorusTransform;
  // raise the leading tone a semitone at the home cadence (flat-7 modes)
  raiseLeadingTone?: boolean;
}

export function developSongMotifMelodyPattern(
  plan: SongMotifPlan,
  options: SongMotifMelodyOptions,
): PlayerPatternSource {
  const subdivisionBeats = options.subdivisionBeats ?? 0.25;
  const playerId = options.playerId ?? "melody";
  const octave = Math.max(0, Math.min(8, Math.trunc(options.octave ?? 4)));
  const velocityScale = options.velocityScale ?? 1;
  const walk = developSongMotifWalk(plan, options.seed, options.chorusTransform ? { chorusTransform: options.chorusTransform } : {});
  const totalBeats = SONG_MOTIF_BAR_COUNT * BEATS_PER_BAR;
  const slots = Math.round(totalBeats / subdivisionBeats);
  const events: (PatternNoteSource | null)[] = new Array(slots).fill(null);
  for (const bar of walk.bars) {
    for (const note of bar) {
      const index = Math.round(note.startBeat / subdivisionBeats);
      if (index < 0 || index >= slots) continue;
      const velocity = note.cadence ? 0.7 : note.strong ? 0.62 : 0.42;
      const tags = ["starter:voice-led-harmony", "melody:motif-cell"];
      if (options.chorusTransform) tags.push("melody:section-chorus");
      if (note.strong || note.cadence) tags.push("melody:harmony-bound");
      if (note.cadence) tags.push("melody:cadence");
      const raiseLeading = Boolean(note.leading && options.raiseLeadingTone);
      if (raiseLeading) tags.push("melody:leading-tone");
      events[index] = {
        playerId,
        scaleDegree: note.degree,
        octave,
        ...(raiseLeading ? { chromaticOffsetSemitones: 1 } : {}),
        duration: note.durationBeats >= 1 ? "4n" : "8n",
        durationBeats: round3(note.durationBeats),
        velocity: round3(Math.max(0.2, Math.min(0.8, velocity * velocityScale))),
        tags,
      };
    }
  }
  return { subdivisionBeats, events };
}

// ---- helpers ----------------------------------------------------------------

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function nearestTo(candidates: readonly number[], target: number): number {
  let best = candidates[0] ?? 0;
  let bestDistance = Math.abs(best - target);
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - target);
    if (distance < bestDistance || (distance === bestDistance && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function foldDegree(degree: number, anchor: number): number {
  let folded = degree;
  while (folded > anchor + 7) folded -= 7;
  while (folded < anchor - 7) folded += 7;
  return folded;
}

function contourOf(notes: readonly MotifWalkNote[]): SongDraftPlanBar["contour"] {
  if (notes.length < 2) return "flat";
  const first = notes[0].degree;
  const last = notes[notes.length - 1].degree;
  const peak = Math.max(...notes.map((n) => n.degree));
  const valley = Math.min(...notes.map((n) => n.degree));
  if (peak > first && peak > last) return "arch";
  if (valley < first && valley < last) return "dip";
  if (last > first + 1) return "rise";
  if (last < first - 1) return "fall";
  const changes = notes.filter((n, i) => i > 0 && Math.sign(n.degree - notes[i - 1].degree) !== 0).length;
  return changes >= 3 ? "wave" : "flat";
}

function rhythmLabelOf(plan: SongMotifPlan): SongDraftPlanBar["rhythm"] {
  const mean = plan.cellRhythm.reduce((sum, value) => sum + value, 0) / Math.max(1, plan.cellRhythm.length);
  if (mean >= 1.2) return "sparse";
  if (mean >= 0.8) return "steady";
  const hasOffbeat = plan.cellRhythm.some((value) => value === 0.75 || value === 0.25);
  return hasOffbeat ? "syncopated" : "busy";
}

function isMotifMove(value: unknown): value is SongMotifHarmonicMove {
  return typeof value === "string" && (SONG_MOTIF_HARMONIC_MOVES as readonly string[]).includes(value);
}

function isMotifTransform(value: unknown): value is SongMotifChorusTransform {
  return typeof value === "string" && (SONG_MOTIF_CHORUS_TRANSFORMS as readonly string[]).includes(value);
}

function snapRhythm(value: number): number {
  let best: number = SONG_MOTIF_RHYTHM_VALUES[0];
  for (const candidate of SONG_MOTIF_RHYTHM_VALUES) {
    if (Math.abs(candidate - value) < Math.abs(best - value)) best = candidate;
  }
  return best;
}

function normalizeDegree(degree: number): number {
  return ((Math.trunc(degree) % 7) + 7) % 7;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
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

export function developSongMotifChorusMelodyPattern(
  plan: SongMotifPlan,
  options: SongMotifMelodyOptions,
): PlayerPatternSource {
  return developSongMotifMelodyPattern(plan, {
    ...options,
    chorusTransform: plan.chorusTransform,
    velocityScale: (options.velocityScale ?? 1) * 1.12,
  });
}

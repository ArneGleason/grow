import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const BPM = 90;
const BEAT_MS = 60_000 / BPM;
const TEMP_DIR = "/private/tmp/grow-timing-feel-grid";
const TEMP_MODULE = `${TEMP_DIR}/performed-time.mjs`;
const execFileAsync = promisify(execFile);
const sourceRef = process.argv[2] ?? "working-tree";

const PLAYERS = [
  {
    id: "pulse",
    role: "pulse",
    thinking: {
      disposition: {
        steadiness: 0.96,
        disruption: 0.08,
        caution: 0.8,
        novelty: 0.12,
        density: 0.44,
        responsiveness: 0.52,
      },
    },
  },
  {
    id: "bass",
    role: "bass",
    thinking: {
      disposition: {
        steadiness: 0.74,
        disruption: 0.22,
        caution: 0.62,
        novelty: 0.34,
        density: 0.58,
        responsiveness: 0.78,
      },
    },
  },
  {
    id: "melody",
    role: "melody",
    thinking: {
      disposition: {
        steadiness: 0.46,
        disruption: 0.36,
        caution: 0.34,
        novelty: 0.72,
        density: 0.64,
        responsiveness: 0.66,
      },
    },
  },
];

const SCALE = ["C", "D", "E", "F", "G", "A", "Bb"];
const PATTERNS = [
  {
    playerId: "pulse",
    subdivisionBeats: 1,
    events: [
      { scaleDegree: 0, octave: 2, durationBeats: 0.5, velocity: 0.74 },
    ],
  },
  {
    playerId: "bass",
    subdivisionBeats: 0.5,
    events: [
      { scaleDegree: 0, octave: 2, durationBeats: 0.5, velocity: 0.54 },
      null,
      null,
      { scaleDegree: 4, octave: 1, durationBeats: 0.5, velocity: 0.44 },
      { scaleDegree: 6, octave: 1, durationBeats: 0.5, velocity: 0.48 },
      null,
      { scaleDegree: 4, octave: 1, durationBeats: 0.5, velocity: 0.42 },
      null,
    ],
  },
  {
    playerId: "melody",
    subdivisionBeats: 0.5,
    events: [
      null,
      { scaleDegree: 2, octave: 4, durationBeats: 0.5, velocity: 0.28 },
      { scaleDegree: 4, octave: 4, durationBeats: 0.5, velocity: 0.32 },
      null,
      { scaleDegree: 5, octave: 4, durationBeats: 0.5, velocity: 0.28 },
      { scaleDegree: 4, octave: 4, durationBeats: 0.5, velocity: 0.24 },
      null,
      { scaleDegree: 1, octave: 4, durationBeats: 0.5, velocity: 0.3 },
      null,
      { scaleDegree: 0, octave: 4, durationBeats: 0.5, velocity: 0.26 },
      null,
      { scaleDegree: 2, octave: 4, durationBeats: 0.5, velocity: 0.28 },
      { scaleDegree: 4, octave: 4, durationBeats: 0.5, velocity: 0.3 },
      null,
      { scaleDegree: 6, octave: 4, durationBeats: 0.5, velocity: 0.24 },
      null,
    ],
  },
];

await mkdir(TEMP_DIR, { recursive: true });
const source = await readTimingSource(sourceRef);
const output = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    verbatimModuleSyntax: true,
  },
}).outputText.replace(/^import .*;\n/gm, "");
await writeFile(TEMP_MODULE, output);

const { calculatePerformedTiming } = await import(pathToFileURL(TEMP_MODULE).href);

const rows = sampleRows(32);
console.log(`Timing source: ${sourceRef}`);
printGrid(rows);
printBarPositionStats(rows);
printJumpStats(rows);
printCollisionStats(rows);

async function readTimingSource(ref) {
  if (ref === "working-tree") {
    return readFile("src/performed-time.ts", "utf8");
  }
  const { stdout } = await execFileAsync("git", ["show", `${ref}:src/performed-time.ts`]);
  return stdout;
}

function sampleRows(totalBeats) {
  const rows = [];
  const previousPitch = new Map();
  const eventIndexes = new Map();
  for (let beat = 0; beat < totalBeats; beat += 0.5) {
    for (const pattern of PATTERNS) {
      const note = noteAt(pattern, beat);
      if (!note) continue;

      const player = PLAYERS.find((candidate) => candidate.id === pattern.playerId);
      const pitch = noteFromScaleDegree(note.scaleDegree, note.octave);
      const eventIndex = eventIndexes.get(player.id) ?? 0;
      const timing = calculatePerformedTiming({
        player,
        absoluteBeat: beat,
        eventIndex,
        pitch,
        previousPitch: previousPitch.get(player.id),
        durationBeats: note.durationBeats,
        baseVelocity: note.velocity,
        localDensity: calculateLocalDensity(beat),
      });
      rows.push({
        beat,
        bar: Math.floor(beat / 4) + 1,
        position: modulo(beat, 4),
        playerId: player.id,
        eventIndex,
        pitch,
        offsetBeats: timing.performedOffsetBeats,
        offsetMs: timing.performedOffsetBeats * BEAT_MS,
        summary: timing.summary,
        components: timing.components,
      });
      eventIndexes.set(player.id, eventIndex + 1);
      previousPitch.set(player.id, pitch);
    }
  }
  return rows;
}

function printGrid(rows) {
  console.log("\nOffset grid, ms at 90 BPM. Negative = push/ahead, positive = drag/behind.");
  console.log("bar beat | pulse        bass         melody");
  console.log("---------+-------------------------------------------");
  for (let beat = 0; beat < 32; beat += 0.5) {
    const atBeat = rows.filter((row) => row.beat === beat);
    if (atBeat.length === 0) continue;
    const cells = ["pulse", "bass", "melody"].map((playerId) => {
      const row = atBeat.find((candidate) => candidate.playerId === playerId);
      if (!row) return "     .      ";
      return `${formatMs(row.offsetMs).padStart(7)} ${symbol(row.offsetMs)} `;
    });
    console.log(`${String(Math.floor(beat / 4) + 1).padStart(3)} ${formatBeat(modulo(beat, 4)).padStart(4)} | ${cells.join(" ")}`);
  }
}

function printBarPositionStats(rows) {
  console.log("\nBar-position pocket by player, mean ms +/- sd.");
  for (const playerId of ["pulse", "bass", "melody"]) {
    console.log(`\n${playerId}`);
    for (const position of [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]) {
      const offsets = rows
        .filter((row) => row.playerId === playerId && row.position === position)
        .map((row) => row.offsetMs);
      if (offsets.length === 0) continue;
      console.log(`  beat ${formatBeat(position).padStart(3)}: ${formatMs(mean(offsets)).padStart(7)} +/- ${formatMs(stddev(offsets)).padStart(6)} n=${offsets.length}`);
    }
  }
}

function printJumpStats(rows) {
  console.log("\nNote-to-note offset jump by player, mean abs ms / max abs ms.");
  for (const playerId of ["pulse", "bass", "melody"]) {
    const playerRows = rows.filter((row) => row.playerId === playerId);
    const jumps = playerRows.slice(1).map((row, index) => row.offsetMs - playerRows[index].offsetMs);
    console.log(`  ${playerId.padEnd(6)} ${formatMs(mean(jumps.map(Math.abs))).padStart(7)} / ${formatMs(Math.max(...jumps.map(Math.abs))).padStart(7)}`);
  }
}

function printCollisionStats(rows) {
  console.log("\nSame-grid-point player spread, max-min ms where 2+ players land together.");
  const spreads = [];
  for (let beat = 0; beat < 32; beat += 0.5) {
    const offsets = rows.filter((row) => row.beat === beat).map((row) => row.offsetMs);
    if (offsets.length < 2) continue;
    spreads.push(Math.max(...offsets) - Math.min(...offsets));
  }
  console.log(`  mean ${formatMs(mean(spreads))}, max ${formatMs(Math.max(...spreads))}, n=${spreads.length}`);
}

function noteAt(pattern, beat) {
  const step = Math.round(beat / pattern.subdivisionBeats);
  if (Math.abs(beat / pattern.subdivisionBeats - step) > 0.0001) return undefined;
  return pattern.events[step % pattern.events.length];
}

function calculateLocalDensity(absoluteBeat) {
  let possibleSteps = 0;
  let noteSteps = 0;
  for (let beat = Math.max(0, absoluteBeat - 0.5); beat <= absoluteBeat + 0.5 + Number.EPSILON; beat += 0.5) {
    for (const pattern of PATTERNS) {
      const note = noteAt(pattern, beat);
      if (note === undefined) continue;
      possibleSteps += 1;
      if (note) noteSteps += 1;
    }
  }
  return possibleSteps === 0 ? 0 : noteSteps / possibleSteps;
}

function noteFromScaleDegree(degree, octave) {
  const scaleIndex = modulo(degree, SCALE.length);
  const octaveOffset = Math.floor(degree / SCALE.length);
  return `${SCALE[scaleIndex]}${octave + octaveOffset}`;
}

function symbol(offsetMs) {
  if (offsetMs <= -8) return "<<";
  if (offsetMs <= -3) return "< ";
  if (offsetMs >= 8) return ">>";
  if (offsetMs >= 3) return "> ";
  return "| ";
}

function formatMs(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatBeat(value) {
  return value.toFixed(1).replace(/\.0$/, "");
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function stddev(values) {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

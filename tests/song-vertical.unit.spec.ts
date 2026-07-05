import { expect, test } from "@playwright/test";
import { DEFAULT_SONG_ARRANGEMENT, arrangeSongFormPatternEvent, sectionAtBeat } from "../src/song-form";
import { createSongStarterMaterial } from "../src/song-starter-material";
import { createSeededSongMotifPlan } from "../src/song-motif-plan";
import { DEFAULT_SONG_GOAL } from "../src/song-goal";
import { getSongMaterial } from "../src/song-material";
import { createTonalContext, noteFromScaleDegreeWithChromaticOffset } from "../src/tonal-context";

test("the performed verticality is clean: harmony follows the sentence, no unintentional sustained harshness", () => {
  for (const probeSeed of [424242, 7, 90210]) {
  const goal = { ...DEFAULT_SONG_GOAL, tonic: "A", mode: "aeolian" as const, tempoBpm: 120, energy: 0.6, surpriseTarget: 0.5, brightness: 0.4 };
  const starter = {
    source: "deterministic-keywords" as const,
    sourcePrompt: "vertical probe",
    baseSongId: "switchback" as const,
    materialSeed: probeSeed,
    goal,
    playerPlans: [],
    motifPlan: createSeededSongMotifPlan(probeSeed, goal),
  };
  const material = createSongStarterMaterial(getSongMaterial("switchback"), starter);
  const tonalContext = createTonalContext(goal.tonic, goal.mode);
  const PC: Record<string, number> = { C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11 };
  const semi = (pitch: string) => { const m = /^([A-G][#b]?)(-?\d+)$/.exec(pitch); return m ? PC[m[1]]! + 12 * (parseInt(m[2]) + 1) : null; };
  type N = { p: string; b: number; d: number; s: number; pitch: string };
  const notes: N[] = [];
  const totalBeats = 384; // two passes: structural dynamics stay clash-clean too
  for (const pattern of material.patterns) {
    const len = pattern.events.length;
    for (let step = 0; step * pattern.subdivisionBeats < totalBeats; step += 1) {
      const absoluteBeat = step * pattern.subdivisionBeats;
      const sourceEvent = pattern.events[step % len] ?? null;
      const arranged = arrangeSongFormPatternEvent({
        song: material, pattern, sourceEvent, stepIndex: step, absoluteBeat, tonalContext,
        arrangement: DEFAULT_SONG_ARRANGEMENT,
      });
      if (!arranged || arranged.playerId === "pulse") continue;
      const pitch = noteFromScaleDegreeWithChromaticOffset(tonalContext, arranged.scaleDegree, arranged.octave, arranged.chromaticOffsetSemitones);
      const s = semi(pitch);
      if (s === null) continue;
      notes.push({ p: arranged.playerId, b: absoluteBeat, d: arranged.durationBeats, s, pitch });
    }
  }
  const clashes: { pair: string; kind: string; at: number; overlap: number; what: string; section: string }[] = [];
  for (let i = 0; i < notes.length; i += 1) {
    for (let j = i + 1; j < notes.length; j += 1) {
      const a = notes[i]!, b = notes[j]!;
      if (a.p === b.p) continue;
      const start = Math.max(a.b, b.b), end = Math.min(a.b + a.d, b.b + b.d);
      const overlap = end - start;
      if (overlap < 0.75) continue;
      const ic = Math.abs(a.s - b.s) % 12;
      const cls = Math.min(ic, 12 - ic);
      if (cls === 1 || cls === 6) {
        const section = sectionAtBeat(start, DEFAULT_SONG_ARRANGEMENT).sectionType;
        clashes.push({ pair: [a.p, b.p].sort().join("+"), kind: cls === 1 ? "m2/M7" : "tritone", at: start, overlap, what: `${a.pitch}(${a.p})+${b.pitch}(${b.p})`, section });
      }
    }
  }
  const byPair: Record<string, number> = {};
  const bySection: Record<string, number> = {};
  for (const c of clashes) { byPair[`${c.pair} ${c.kind}`] = (byPair[`${c.pair} ${c.kind}`] ?? 0) + 1; bySection[c.section] = (bySection[c.section] ?? 0) + 1; }
  // relational rails: the arranged bass walks the composed sentence, and
  // sustained harsh intervals (m2/M7/tritone held >= 0.75 beat) stay rare
  expect(material.rootPlan?.length).toBe(8);
  if (clashes.length > 2) {
    throw new Error(
      `sustained harshness above threshold (seed ${probeSeed}): ` + JSON.stringify(byPair) + " " +
        JSON.stringify(clashes.map((c) => `${c.section}@${c.at.toFixed(2)} ${c.what} ${c.kind} x${c.overlap.toFixed(2)}`)),
    );
  }
  const bassNotes = notes.filter((n) => n.p === "bass");
  expect(bassNotes.length).toBeGreaterThan(20);
  if (byPair["bass+keyboard m2/M7"] || byPair["bass+keyboard tritone"]) {
    const detail = clashes
      .filter((c) => c.pair === "bass+keyboard")
      .map((c) => `${c.section}@${c.at.toFixed(2)} ${c.what} x${c.overlap.toFixed(2)}`);
    throw new Error(
      `bass and keyboard disagree about the harmony (seed ${probeSeed}): ` +
        JSON.stringify(byPair) + " " + JSON.stringify(detail),
    );
  }
  void bySection;
  }
});

import {
  DEFAULT_SONG_ID,
  isSongId,
  SONG_MATERIALS,
  type SongId,
} from "./song-material";
import type { PlayerRole } from "./players";
import { normalizeStoredSongDraftPlan, type SongDraftPlan } from "./song-draft-plan";
import { normalizeStoredSongMotifPlan, type SongMotifPlan } from "./song-motif-plan";
import { validateSongGoal, type SongGoal } from "./song-goal";

export const SONG_LIBRARY_STORAGE_KEY = "grow.songLibrary.v1";
export const DEFAULT_LIBRARY_SONG_TITLE = "Untitled song 1";
const MAX_LIBRARY_SONGS = 64;
const MAX_LIBRARY_TITLE_LENGTH = 80;

export interface SongLibraryEntry {
  id: string;
  title: string;
  baseSongId: SongId;
  starter?: SongLibraryStarter;
  createdAt: string;
  updatedAt: string;
  version: 1;
}

export interface SongLibraryPlayerPlan {
  playerId: string;
  role: PlayerRole | string;
  enabled: boolean;
  brief: string;
}

export interface SongLibraryStarter {
  source: "deterministic-keywords" | "model";
  sourcePrompt: string;
  baseSongId?: SongId;
  materialSeed?: number;
  structureSummary?: string;
  draftPlan?: SongDraftPlan;
  motifPlan?: SongMotifPlan;
  goal: SongGoal;
  playerPlans: readonly SongLibraryPlayerPlan[];
}

export interface SongLibraryState {
  songs: readonly SongLibraryEntry[];
  activeSongId: string;
}

export interface SongLibrarySnapshot {
  songs: readonly SongLibraryEntry[];
  active: SongLibraryEntry;
  activeIndex: number;
}

export interface CreateSongLibraryEntryInput {
  id?: string;
  title?: string;
  baseSongId?: SongId;
  starter?: SongLibraryStarter;
  now?: Date;
}

export function createDefaultSongLibrary(now = new Date(0)): SongLibraryState {
  const firstSong = createSongLibraryEntry({
    id: "song-untitled-1",
    title: DEFAULT_LIBRARY_SONG_TITLE,
    baseSongId: DEFAULT_SONG_ID,
    now,
  });
  return {
    activeSongId: firstSong.id,
    songs: [firstSong],
  };
}

export function createSongLibraryEntry(input: CreateSongLibraryEntryInput = {}): SongLibraryEntry {
  const now = input.now ?? new Date();
  const id = normalizeSongLibraryId(input.id) ?? createSongLibraryId(now);
  const baseSongId = input.baseSongId && isSongId(input.baseSongId)
    ? input.baseSongId
    : DEFAULT_SONG_ID;
  const timestamp = toIsoString(now);
  return {
    id,
    title: sanitizeSongTitle(input.title) || "Untitled song",
    baseSongId,
    starter: cloneSongLibraryStarter(input.starter),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
}

export function normalizeSongLibraryState(candidate: unknown): SongLibraryState {
  if (!candidate || typeof candidate !== "object") {
    return createDefaultSongLibrary();
  }
  const raw = candidate as Partial<{
    songs: unknown;
    activeSongId: unknown;
  }>;
  const songs = Array.isArray(raw.songs)
    ? raw.songs.map(readSongLibraryEntry).filter((entry): entry is SongLibraryEntry => Boolean(entry))
    : [];
  const uniqueSongs = dedupeSongsById(songs).slice(0, MAX_LIBRARY_SONGS);
  const fallback = uniqueSongs.length > 0 ? uniqueSongs : createDefaultSongLibrary().songs;
  const requestedActiveId = typeof raw.activeSongId === "string"
    ? normalizeSongLibraryId(raw.activeSongId)
    : undefined;
  const activeSongId = requestedActiveId && fallback.some((song) => song.id === requestedActiveId)
    ? requestedActiveId
    : fallback[0]!.id;
  return {
    activeSongId,
    songs: fallback,
  };
}

export function getSongLibrarySnapshot(state: SongLibraryState): SongLibrarySnapshot {
  const normalized = normalizeSongLibraryState(state);
  const activeIndex = Math.max(0, normalized.songs.findIndex((song) => song.id === normalized.activeSongId));
  const active = normalized.songs[activeIndex] ?? normalized.songs[0]!;
  return {
    active,
    activeIndex,
    songs: normalized.songs,
  };
}

export function selectSongLibraryEntry(state: SongLibraryState, songId: string): SongLibraryState {
  const normalized = normalizeSongLibraryState(state);
  const nextId = normalizeSongLibraryId(songId);
  if (!nextId || !normalized.songs.some((song) => song.id === nextId)) return normalized;
  return {
    ...normalized,
    activeSongId: nextId,
  };
}

export function renameSongLibraryEntry(
  state: SongLibraryState,
  songId: string,
  title: string,
  now = new Date(),
): SongLibraryState {
  const normalized = normalizeSongLibraryState(state);
  const safeTitle = sanitizeSongTitle(title);
  if (!safeTitle) return normalized;
  return {
    ...normalized,
    songs: normalized.songs.map((song) => song.id === songId
      ? { ...song, title: safeTitle, updatedAt: toIsoString(now) }
      : song),
  };
}

export function updateSongLibraryEntryBase(
  state: SongLibraryState,
  songId: string,
  baseSongId: SongId,
  now = new Date(),
): SongLibraryState {
  const normalized = normalizeSongLibraryState(state);
  return {
    ...normalized,
    songs: normalized.songs.map((song) => song.id === songId
      ? { ...song, baseSongId, updatedAt: toIsoString(now) }
      : song),
  };
}

export function updateSongLibraryEntryStarter(
  state: SongLibraryState,
  songId: string,
  starter: SongLibraryStarter,
  baseSongId?: SongId,
  now = new Date(),
): SongLibraryState {
  const normalized = normalizeSongLibraryState(state);
  return {
    ...normalized,
    songs: normalized.songs.map((song) => song.id === songId
      ? {
        ...song,
        baseSongId: baseSongId && isSongId(baseSongId) ? baseSongId : song.baseSongId,
        starter: cloneSongLibraryStarter(starter),
        updatedAt: toIsoString(now),
      }
      : song),
  };
}

export function appendSongLibraryEntry(state: SongLibraryState, entry: SongLibraryEntry): SongLibraryState {
  const normalized = normalizeSongLibraryState(state);
  const existingIds = new Set(normalized.songs.map((song) => song.id));
  const uniqueEntry = existingIds.has(entry.id)
    ? { ...entry, id: nextAvailableSongId(entry.id, existingIds) }
    : entry;
  return {
    activeSongId: uniqueEntry.id,
    songs: [...normalized.songs, uniqueEntry].slice(0, MAX_LIBRARY_SONGS),
  };
}

export function removeSongLibraryEntry(state: SongLibraryState, songId: string): SongLibraryState {
  const normalized = normalizeSongLibraryState(state);
  if (normalized.songs.length <= 1) return normalized;
  const removeId = normalizeSongLibraryId(songId);
  if (!removeId) return normalized;
  const removeIndex = normalized.songs.findIndex((song) => song.id === removeId);
  if (removeIndex < 0) return normalized;
  const songs = normalized.songs.filter((song) => song.id !== removeId);
  const activeSongId = normalized.activeSongId === removeId
    ? songs[Math.min(removeIndex, songs.length - 1)]!.id
    : normalized.activeSongId;
  return normalizeSongLibraryState({
    activeSongId,
    songs,
  });
}

export function createNextLibrarySongTitle(count: number): string {
  return `Untitled song ${Math.max(1, Math.trunc(count) + 1)}`;
}

export function chooseStarterSongId(count: number): SongId {
  const index = Math.max(0, Math.trunc(count)) % SONG_MATERIALS.length;
  return SONG_MATERIALS[index]?.id ?? DEFAULT_SONG_ID;
}

export function sanitizeSongTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LIBRARY_TITLE_LENGTH);
}

export function normalizeSongLibraryId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const id = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9:_-]{0,79}$/.test(id)) return undefined;
  return id;
}

function readSongLibraryEntry(candidate: unknown): SongLibraryEntry | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;
  const raw = candidate as Partial<SongLibraryEntry>;
  const id = normalizeSongLibraryId(raw.id);
  if (!id) return undefined;
  const title = sanitizeSongTitle(raw.title) || "Untitled song";
  const baseSongId = raw.baseSongId && isSongId(raw.baseSongId) ? raw.baseSongId : DEFAULT_SONG_ID;
  const starter = readSongLibraryStarter(raw.starter);
  const createdAt = readIsoString(raw.createdAt) ?? new Date(0).toISOString();
  const updatedAt = readIsoString(raw.updatedAt) ?? createdAt;
  return {
    id,
    title,
    baseSongId,
    starter,
    createdAt,
    updatedAt,
    version: 1,
  };
}

export function cloneSongLibraryStarter(starter: SongLibraryStarter | undefined): SongLibraryStarter | undefined {
  if (!starter) return undefined;
  return {
    source: starter.source,
    sourcePrompt: starter.sourcePrompt,
    baseSongId: starter.baseSongId,
    materialSeed: starter.materialSeed,
    structureSummary: starter.structureSummary,
    draftPlan: cloneSongDraftPlan(starter.draftPlan),
    motifPlan: starter.motifPlan
      ? { ...starter.motifPlan, cellSteps: [...starter.motifPlan.cellSteps], cellRhythm: [...starter.motifPlan.cellRhythm] }
      : undefined,
    goal: {
      ...starter.goal,
      dispositionBias: { ...starter.goal.dispositionBias },
      influenceHints: [...starter.goal.influenceHints],
      sectionEmphasis: { ...starter.goal.sectionEmphasis },
    },
    playerPlans: starter.playerPlans.map((plan) => ({ ...plan })),
  };
}

function readSongLibraryStarter(candidate: unknown): SongLibraryStarter | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;
  const raw = candidate as Partial<SongLibraryStarter>;
  const source = raw.source === "model" ? "model" : "deterministic-keywords";
  if (!raw.goal || typeof raw.goal !== "object") return undefined;
  const sourcePrompt = typeof raw.sourcePrompt === "string" ? raw.sourcePrompt : "";
  const playerPlans = Array.isArray(raw.playerPlans)
    ? raw.playerPlans.map(readSongLibraryPlayerPlan).filter((plan): plan is SongLibraryPlayerPlan => Boolean(plan))
    : [];
  const validation = validateSongGoal(raw.goal);
  const draftPlan = normalizeStoredSongDraftPlan(raw.draftPlan);
  const motifPlan = normalizeStoredSongMotifPlan(raw.motifPlan);
  return {
    source,
    sourcePrompt,
    baseSongId: raw.baseSongId && isSongId(raw.baseSongId) ? raw.baseSongId : undefined,
    materialSeed: readStarterSeed(raw.materialSeed),
    structureSummary: typeof raw.structureSummary === "string"
      ? raw.structureSummary.replace(/\s+/g, " ").trim().slice(0, 240)
      : undefined,
    draftPlan,
    motifPlan,
    goal: validation.goal,
    playerPlans,
  };
}

function cloneSongDraftPlan(plan: SongDraftPlan | undefined): SongDraftPlan | undefined {
  if (!plan) return undefined;
  return {
    version: plan.version,
    source: plan.source,
    summary: plan.summary,
    bars: plan.bars.map((bar) => ({
      ...bar,
      anchorDegrees: [...bar.anchorDegrees],
    })),
  };
}

function readStarterSeed(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.trunc(value)) >>> 0;
}

function readSongLibraryPlayerPlan(candidate: unknown): SongLibraryPlayerPlan | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;
  const raw = candidate as Partial<SongLibraryPlayerPlan>;
  const playerId = typeof raw.playerId === "string" ? raw.playerId.trim() : "";
  if (!playerId) return undefined;
  return {
    playerId,
    role: typeof raw.role === "string" ? raw.role : "melody",
    enabled: raw.enabled !== false,
    brief: typeof raw.brief === "string" ? raw.brief.replace(/\s+/g, " ").trim().slice(0, 240) : "",
  };
}

function dedupeSongsById(songs: readonly SongLibraryEntry[]): SongLibraryEntry[] {
  const seen = new Set<string>();
  const deduped: SongLibraryEntry[] = [];
  for (const song of songs) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    deduped.push(song);
  }
  return deduped;
}

function nextAvailableSongId(baseId: string, existingIds: ReadonlySet<string>): string {
  for (let index = 2; index <= MAX_LIBRARY_SONGS + 1; index += 1) {
    const candidate = `${baseId}-${index}`;
    if (!existingIds.has(candidate)) return candidate;
  }
  return `${baseId}-${Date.now().toString(36)}`;
}

function createSongLibraryId(now: Date): string {
  return `song-${now.getTime().toString(36)}`;
}

function toIsoString(date: Date): string {
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

function readIsoString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

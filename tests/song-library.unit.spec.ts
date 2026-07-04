import { expect, test } from "@playwright/test";
import {
  appendSongLibraryEntry,
  createDefaultSongLibrary,
  createSongLibraryEntry,
  getSongLibrarySnapshot,
  removeSongLibraryEntry,
  selectSongLibraryEntry,
} from "../src/song-library";

test.describe("song library curation", () => {
  test("removes the active song and selects the next neighbor", () => {
    let state = createDefaultSongLibrary();
    const second = createSongLibraryEntry({
      id: "song-second",
      title: "Second",
      baseSongId: "switchback",
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const third = createSongLibraryEntry({
      id: "song-third",
      title: "Third",
      baseSongId: "glass",
      now: new Date("2026-01-02T00:00:00Z"),
    });
    state = appendSongLibraryEntry(state, second);
    state = appendSongLibraryEntry(state, third);
    state = selectSongLibraryEntry(state, second.id);

    const pruned = removeSongLibraryEntry(state, second.id);
    const snapshot = getSongLibrarySnapshot(pruned);

    expect(snapshot.songs.map((song) => song.id)).toEqual(["song-untitled-1", third.id]);
    expect(snapshot.active.id).toBe(third.id);
    expect(snapshot.activeIndex).toBe(1);
  });

  test("removing the active tail selects the previous remaining song", () => {
    let state = createDefaultSongLibrary();
    const second = createSongLibraryEntry({ id: "song-second", title: "Second" });
    state = appendSongLibraryEntry(state, second);

    const pruned = removeSongLibraryEntry(state, second.id);
    const snapshot = getSongLibrarySnapshot(pruned);

    expect(snapshot.songs.map((song) => song.id)).toEqual(["song-untitled-1"]);
    expect(snapshot.active.id).toBe("song-untitled-1");
  });

  test("keeps the last song and ignores unknown ids", () => {
    const state = createDefaultSongLibrary();

    expect(removeSongLibraryEntry(state, "song-untitled-1")).toEqual(state);
    expect(removeSongLibraryEntry(state, "missing-song")).toEqual(state);
  });

  test("removing an inactive song preserves the active song", () => {
    let state = createDefaultSongLibrary();
    const second = createSongLibraryEntry({ id: "song-second", title: "Second" });
    const third = createSongLibraryEntry({ id: "song-third", title: "Third" });
    state = appendSongLibraryEntry(state, second);
    state = appendSongLibraryEntry(state, third);

    const pruned = removeSongLibraryEntry(state, second.id);
    const snapshot = getSongLibrarySnapshot(pruned);

    expect(snapshot.songs.map((song) => song.id)).toEqual(["song-untitled-1", third.id]);
    expect(snapshot.active.id).toBe(third.id);
  });
});

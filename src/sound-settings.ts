export type PulseVoiceId = "root-pulse" | "drum-kit";
export type BassVoiceId = "round-bass" | "sub-bass" | "rubber-bass";
export type KeyboardVoiceId = "warm-keys" | "soft-piano" | "muted-organ";
export type MelodyVoiceId = "sine-line" | "glass-line" | "reed-line" | "pluck-line";
export type PlayerVoiceId = PulseVoiceId | BassVoiceId | KeyboardVoiceId | MelodyVoiceId;

export interface PlayerVoiceOption {
  id: PlayerVoiceId;
  label: string;
}

export interface PlayerSoundSettings {
  level: number;
  voice: PlayerVoiceId;
}

export interface SoundMixSettings {
  masterLevel: number;
  players: Record<string, PlayerSoundSettings>;
}

export const PLAYER_VOICE_OPTIONS = {
  pulse: [
    { id: "drum-kit", label: "Drum kit" },
    { id: "root-pulse", label: "Root pulse" },
  ],
  bass: [
    { id: "round-bass", label: "Round" },
    { id: "sub-bass", label: "Sub" },
    { id: "rubber-bass", label: "Rubber" },
  ],
  keyboard: [
    { id: "warm-keys", label: "Warm keys" },
    { id: "soft-piano", label: "Soft piano" },
    { id: "muted-organ", label: "Muted organ" },
  ],
  melody: [
    { id: "glass-line", label: "Glass" },
    { id: "sine-line", label: "Sine" },
    { id: "reed-line", label: "Reed" },
    { id: "pluck-line", label: "Pluck" },
  ],
} as const satisfies Record<string, readonly PlayerVoiceOption[]>;

export const DEFAULT_SOUND_MIX: SoundMixSettings = {
  masterLevel: 0.82,
  players: {
    pulse: { level: 0.82, voice: "drum-kit" },
    bass: { level: 0.92, voice: "round-bass" },
    keyboard: { level: 0.68, voice: "warm-keys" },
    melody: { level: 0.9, voice: "glass-line" },
  },
};

export function clampSoundLevel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export function getPlayerSoundSettings(
  settings: SoundMixSettings | undefined,
  playerId: string,
): PlayerSoundSettings {
  const fallback = DEFAULT_SOUND_MIX.players[playerId] ?? { level: 0.8, voice: "sine-line" as const };
  const candidate = settings?.players[playerId];
  if (!candidate) return fallback;
  return {
    level: clampSoundLevel(candidate.level),
    voice: isVoiceAllowedForPlayer(playerId, candidate.voice) ? candidate.voice : fallback.voice,
  };
}

export function isVoiceAllowedForPlayer(playerId: string, voice: string): voice is PlayerVoiceId {
  return getVoiceOptionsForPlayer(playerId).some((option) => option.id === voice);
}

export function getVoiceOptionsForPlayer(playerId: string): readonly PlayerVoiceOption[] {
  return PLAYER_VOICE_OPTIONS[playerId as keyof typeof PLAYER_VOICE_OPTIONS] ?? [
    { id: "sine-line", label: "Sine" },
  ];
}

export function cloneSoundMixSettings(settings: SoundMixSettings): SoundMixSettings {
  return {
    masterLevel: clampSoundLevel(settings.masterLevel),
    players: Object.fromEntries(Object.keys(settings.players).map((playerId) => [
      playerId,
      { ...getPlayerSoundSettings(settings, playerId) },
    ])),
  };
}

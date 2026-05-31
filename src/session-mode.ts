export const SESSION_MODE_OPTIONS = [
  {
    id: "break",
    label: "Break",
  },
  {
    id: "solo-practice",
    label: "Solo practice",
  },
  {
    id: "rehearsal",
    label: "Rehearsal",
  },
  {
    id: "performance",
    label: "Performance",
  },
] as const;

export type SessionMode = typeof SESSION_MODE_OPTIONS[number]["id"];

export interface SessionModeOption {
  id: SessionMode;
  label: string;
}

export const DEFAULT_SESSION_MODE: SessionMode = "rehearsal";
export const SESSION_MODES = SESSION_MODE_OPTIONS.map((option) => option.id) as readonly SessionMode[];

export function getSessionModeLabel(mode: SessionMode): string {
  return SESSION_MODE_OPTIONS.find((option) => option.id === mode)?.label ?? mode;
}

export function isSessionMode(value: string): value is SessionMode {
  return SESSION_MODES.includes(value as SessionMode);
}

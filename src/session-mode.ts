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

export interface SessionModePolicy {
  refillsLookahead: boolean;
}

export const DEFAULT_SESSION_MODE: SessionMode = "rehearsal";
export const SESSION_MODES = SESSION_MODE_OPTIONS.map((option) => option.id) as readonly SessionMode[];
export const SESSION_MODE_POLICIES = {
  break: {
    refillsLookahead: false,
  },
  "solo-practice": {
    refillsLookahead: true,
  },
  rehearsal: {
    refillsLookahead: true,
  },
  performance: {
    refillsLookahead: true,
  },
} as const satisfies Record<SessionMode, SessionModePolicy>;

export function getSessionModeLabel(mode: SessionMode): string {
  return SESSION_MODE_OPTIONS.find((option) => option.id === mode)?.label ?? mode;
}

export function getSessionModePolicy(mode: SessionMode): SessionModePolicy {
  return SESSION_MODE_POLICIES[mode];
}

export function shouldSessionModeRefillLookahead(mode: SessionMode): boolean {
  return getSessionModePolicy(mode).refillsLookahead;
}

export function isSessionMode(value: string): value is SessionMode {
  return SESSION_MODES.includes(value as SessionMode);
}

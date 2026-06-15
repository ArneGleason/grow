import type { StoredCandidate } from "./candidate-store";

export const STRICTLY_BETTER_FITNESS_EPSILON = 0.000001;

export interface EvolvingEliteSelection {
  shouldSwap: boolean;
  reason: "no-elite" | "first-elite" | "strictly-better" | "not-better";
  previousFitness?: number;
  candidate?: StoredCandidate;
}

export function selectStrictlyBetterElite(
  current: StoredCandidate | undefined,
  candidates: readonly StoredCandidate[],
): EvolvingEliteSelection {
  const best = [...candidates]
    .filter((candidate) => candidate.kind === "phrase" && candidate.status === "elite")
    .sort(rankEvolvingEliteCandidate)[0];

  if (!best) {
    return { shouldSwap: false, reason: "no-elite", previousFitness: current?.fitness };
  }

  if (!current) {
    return {
      shouldSwap: true,
      reason: "first-elite",
      candidate: best,
    };
  }

  if (best.fitness > current.fitness + STRICTLY_BETTER_FITNESS_EPSILON) {
    return {
      shouldSwap: true,
      reason: "strictly-better",
      previousFitness: current.fitness,
      candidate: best,
    };
  }

  return {
    shouldSwap: false,
    reason: "not-better",
    previousFitness: current.fitness,
    candidate: best,
  };
}

export function rankEvolvingEliteCandidate(left: StoredCandidate, right: StoredCandidate): number {
  return (
    right.fitness - left.fitness ||
    left.generation - right.generation ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

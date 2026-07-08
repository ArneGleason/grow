// The goal formula used when generating judgment pairs — training and pair
// generation MUST derive goals identically or features drift from the labels.
export function judgmentGoalForSeed(seed: number): { energy: number; brightness: number; surpriseTarget: number } {
  return {
    energy: 0.25 + ((seed * 7919) % 100) / 200,
    brightness: 0.3 + ((seed * 104729) % 100) / 250,
    surpriseTarget: 0.3 + ((seed * 1299709) % 100) / 250,
  };
}

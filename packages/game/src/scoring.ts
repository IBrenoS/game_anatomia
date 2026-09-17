import { BasePoints, SPEED_BONUS_WINDOW_MS, SPEED_BONUS_MULTIPLIER } from '@batalha/protocol';

export function calculatePoints(
  basePoints: BasePoints,
  correct: boolean,
  responseTimeMs: number
): number {
  if (!correct || responseTimeMs < 0) {
    return 0;
  }

  if (responseTimeMs <= SPEED_BONUS_WINDOW_MS) {
    return Math.round(basePoints * SPEED_BONUS_MULTIPLIER);
  }

  return basePoints;
}

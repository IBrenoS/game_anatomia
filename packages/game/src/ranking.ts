import { PlayerData, ScoreData, RankingEntry } from '@batalha/protocol';

/**
 * Build a ranked list of players using PRD tiebreak criteria (p.10):
 * 1. Highest total points
 * 2. Highest correct count
 * 3. Lowest accumulated correct response time
 * 4. Stable join order (joinedAt)
 */
export function buildRanking(scores: ScoreData[], players: PlayerData[]): RankingEntry[] {
  const activePlayers = players.filter(p => p.removedAt === null);

  const entries = activePlayers.map(player => {
    const score = scores.find(s => s.playerId === player.playerId);
    return {
      position: 0, // will be assigned after sort
      playerId: player.playerId,
      nickname: player.nickname,
      totalPoints: score?.totalPoints ?? 0,
      correctCount: score?.correctCount ?? 0,
      correctResponseTimeMs: score?.correctResponseTimeMs ?? 0,
      distanceToPrevious: 0,
      // Keep joinedAt for sorting but strip it from output
      _joinedAt: player.joinedAt,
    };
  });

  entries.sort((a, b) => {
    // 1. Highest total points
    if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;
    // 2. Highest correct count
    if (a.correctCount !== b.correctCount) return b.correctCount - a.correctCount;
    // 3. Lowest correct response time
    if (a.correctResponseTimeMs !== b.correctResponseTimeMs)
      return a.correctResponseTimeMs - b.correctResponseTimeMs;
    // 4. Stable join order
    return a._joinedAt - b._joinedAt;
  });

  const ranking: RankingEntry[] = entries.map((entry, i) => {
    const { _joinedAt, ...rest } = entry;
    return {
      ...rest,
      position: i + 1,
      distanceToPrevious: i === 0 ? 0 : entries[i - 1].totalPoints - entry.totalPoints,
    };
  });

  return ranking;
}

import { describe, it, expect } from 'vitest';
import { buildRanking } from '../ranking';
import type { PlayerData, ScoreData } from '@batalha/protocol';

function makePlayer(overrides: Partial<PlayerData> & { playerId: string }): PlayerData {
  return {
    nickname: 'Player',
    tokenHash: 'hash',
    joinedAt: Date.now(),
    eligibleFromQuestion: 0,
    removedAt: null,
    ...overrides,
  };
}

describe('buildRanking', () => {
  it('handles single player ranking', () => {
    const players: PlayerData[] = [
      makePlayer({ playerId: 'p1', nickname: 'Alice', joinedAt: 1000 }),
    ];
    const scores: ScoreData[] = [
      { playerId: 'p1', totalPoints: 100, correctCount: 1, correctResponseTimeMs: 5000 },
    ];

    const ranking = buildRanking(scores, players);
    expect(ranking).toHaveLength(1);
    expect(ranking[0]).toMatchObject({
      position: 1,
      playerId: 'p1',
      nickname: 'Alice',
      totalPoints: 100,
      correctCount: 1,
      distanceToPrevious: 0,
    });
  });

  it('sorts multiple players by points and calculates distanceToPrevious', () => {
    const players: PlayerData[] = [
      makePlayer({ playerId: 'p1', nickname: 'Alice', joinedAt: 1000 }),
      makePlayer({ playerId: 'p2', nickname: 'Bob', joinedAt: 2000 }),
      makePlayer({ playerId: 'p3', nickname: 'Charlie', joinedAt: 3000 }),
    ];
    const scores: ScoreData[] = [
      { playerId: 'p1', totalPoints: 100, correctCount: 1, correctResponseTimeMs: 5000 },
      { playerId: 'p2', totalPoints: 200, correctCount: 2, correctResponseTimeMs: 4000 },
      { playerId: 'p3', totalPoints: 150, correctCount: 1, correctResponseTimeMs: 3000 },
    ];

    const ranking = buildRanking(scores, players);

    expect(ranking[0]).toMatchObject({ position: 1, playerId: 'p2', distanceToPrevious: 0 });
    expect(ranking[1]).toMatchObject({ position: 2, playerId: 'p3', distanceToPrevious: 50 });
    expect(ranking[2]).toMatchObject({ position: 3, playerId: 'p1', distanceToPrevious: 50 });
  });

  it('tiebreaks by correctCount (AC 10)', () => {
    const players: PlayerData[] = [
      makePlayer({ playerId: 'p1', nickname: 'Alice', joinedAt: 1000 }),
      makePlayer({ playerId: 'p2', nickname: 'Bob', joinedAt: 2000 }),
    ];
    const scores: ScoreData[] = [
      { playerId: 'p1', totalPoints: 100, correctCount: 2, correctResponseTimeMs: 5000 },
      { playerId: 'p2', totalPoints: 100, correctCount: 1, correctResponseTimeMs: 4000 },
    ];

    const ranking = buildRanking(scores, players);
    expect(ranking[0].playerId).toBe('p1'); // Higher correct count wins
  });

  it('tiebreaks by correctResponseTimeMs (AC 10)', () => {
    const players: PlayerData[] = [
      makePlayer({ playerId: 'p1', nickname: 'Alice', joinedAt: 1000 }),
      makePlayer({ playerId: 'p2', nickname: 'Bob', joinedAt: 2000 }),
    ];
    const scores: ScoreData[] = [
      { playerId: 'p1', totalPoints: 100, correctCount: 1, correctResponseTimeMs: 5000 },
      { playerId: 'p2', totalPoints: 100, correctCount: 1, correctResponseTimeMs: 4000 },
    ];

    const ranking = buildRanking(scores, players);
    expect(ranking[0].playerId).toBe('p2'); // Lower time wins
  });

  it('tiebreaks by join order (stable)', () => {
    const players: PlayerData[] = [
      makePlayer({ playerId: 'p1', nickname: 'Alice', joinedAt: 1000 }),
      makePlayer({ playerId: 'p2', nickname: 'Bob', joinedAt: 2000 }),
    ];
    const scores: ScoreData[] = [
      { playerId: 'p1', totalPoints: 100, correctCount: 1, correctResponseTimeMs: 4000 },
      { playerId: 'p2', totalPoints: 100, correctCount: 1, correctResponseTimeMs: 4000 },
    ];

    const ranking = buildRanking(scores, players);
    expect(ranking[0].playerId).toBe('p1'); // Joined first wins
  });

  it('excludes removed players', () => {
    const players: PlayerData[] = [
      makePlayer({ playerId: 'p1', nickname: 'Alice', joinedAt: 1000 }),
      makePlayer({ playerId: 'p2', nickname: 'Bob', joinedAt: 2000, removedAt: Date.now() }),
    ];
    const scores: ScoreData[] = [
      { playerId: 'p1', totalPoints: 100, correctCount: 1, correctResponseTimeMs: 5000 },
      { playerId: 'p2', totalPoints: 200, correctCount: 2, correctResponseTimeMs: 4000 },
    ];

    const ranking = buildRanking(scores, players);
    expect(ranking).toHaveLength(1);
    expect(ranking[0].playerId).toBe('p1');
  });

  describe('P3.1 cascading multi-player tiebreakers (3+ players)', () => {
    it('handles 3+ player tie broken by response time with distanceToPrevious = 0', () => {
      // 3 players have identical points (300) and correct count (3)
      // Player A responded in 3000ms, Player B in 4500ms, Player C in 6000ms
      // Player D has 250 points
      const players: PlayerData[] = [
        makePlayer({ playerId: 'p1', nickname: 'Alice', joinedAt: 1000 }),
        makePlayer({ playerId: 'p2', nickname: 'Bob', joinedAt: 2000 }),
        makePlayer({ playerId: 'p3', nickname: 'Charlie', joinedAt: 3000 }),
        makePlayer({ playerId: 'p4', nickname: 'Diana', joinedAt: 4000 }),
      ];
      const scores: ScoreData[] = [
        { playerId: 'p2', totalPoints: 300, correctCount: 3, correctResponseTimeMs: 4500 },
        { playerId: 'p3', totalPoints: 300, correctCount: 3, correctResponseTimeMs: 6000 },
        { playerId: 'p1', totalPoints: 300, correctCount: 3, correctResponseTimeMs: 3000 },
        { playerId: 'p4', totalPoints: 250, correctCount: 2, correctResponseTimeMs: 2000 },
      ];

      const ranking = buildRanking(scores, players);

      expect(ranking).toHaveLength(4);

      // Order should be Alice (#1), Bob (#2), Charlie (#3), Diana (#4)
      expect(ranking[0]).toMatchObject({
        position: 1,
        playerId: 'p1',
        totalPoints: 300,
        distanceToPrevious: 0,
      });

      // Bob has same 300 points as Alice -> distanceToPrevious is 0
      expect(ranking[1]).toMatchObject({
        position: 2,
        playerId: 'p2',
        totalPoints: 300,
        distanceToPrevious: 0,
      });

      // Charlie has same 300 points as Bob -> distanceToPrevious is 0
      expect(ranking[2]).toMatchObject({
        position: 3,
        playerId: 'p3',
        totalPoints: 300,
        distanceToPrevious: 0,
      });

      // Diana has 250 points -> distance to Charlie (300) is 50
      expect(ranking[3]).toMatchObject({
        position: 4,
        playerId: 'p4',
        totalPoints: 250,
        distanceToPrevious: 50,
      });
    });

    it('handles 4-way tie on points and correctCount broken across tiebreak tiers', () => {
      // 4 players all have 200 points
      // p1: 2 correct, 5000ms, joinedAt 1000
      // p2: 1 correct, 2000ms (higher points than other 1-correct, but p1 has 2 correct!)
      // p3: 2 correct, 4000ms, joinedAt 2000
      // p4: 2 correct, 4000ms, joinedAt 1500 (tied with p3 in time, but joined earlier)
      const players: PlayerData[] = [
        makePlayer({ playerId: 'p1', nickname: 'P1', joinedAt: 1000 }),
        makePlayer({ playerId: 'p2', nickname: 'P2', joinedAt: 500 }),
        makePlayer({ playerId: 'p3', nickname: 'P3', joinedAt: 2000 }),
        makePlayer({ playerId: 'p4', nickname: 'P4', joinedAt: 1500 }),
      ];
      const scores: ScoreData[] = [
        { playerId: 'p1', totalPoints: 200, correctCount: 2, correctResponseTimeMs: 5000 },
        { playerId: 'p2', totalPoints: 200, correctCount: 1, correctResponseTimeMs: 2000 },
        { playerId: 'p3', totalPoints: 200, correctCount: 2, correctResponseTimeMs: 4000 },
        { playerId: 'p4', totalPoints: 200, correctCount: 2, correctResponseTimeMs: 4000 },
      ];

      const ranking = buildRanking(scores, players);

      // Order:
      // Among 2 correct:
      // - p4 vs p3: both 4000ms. p4 joinedAt 1500 < p3 joinedAt 2000 -> p4 wins over p3
      // - p1: 5000ms -> 3rd among 2 correct
      // - p2: 1 correct -> 4th
      expect(ranking.map(r => r.playerId)).toEqual(['p4', 'p3', 'p1', 'p2']);

      // All 4 have 200 points, so distanceToPrevious is 0 for all of them!
      expect(ranking[0].distanceToPrevious).toBe(0);
      expect(ranking[1].distanceToPrevious).toBe(0);
      expect(ranking[2].distanceToPrevious).toBe(0);
      expect(ranking[3].distanceToPrevious).toBe(0);
    });

    it('handles tie when player scores are not yet recorded (0 points default)', () => {
      const players: PlayerData[] = [
        makePlayer({ playerId: 'p1', nickname: 'P1', joinedAt: 3000 }),
        makePlayer({ playerId: 'p2', nickname: 'P2', joinedAt: 1000 }),
        makePlayer({ playerId: 'p3', nickname: 'P3', joinedAt: 2000 }),
      ];
      // No scores recorded yet
      const ranking = buildRanking([], players);

      expect(ranking).toHaveLength(3);
      // All tied at 0 points, 0 correct, 0 time -> sorted strictly by joinedAt
      expect(ranking.map(r => r.playerId)).toEqual(['p2', 'p3', 'p1']);
      expect(ranking.every(r => r.distanceToPrevious === 0)).toBe(true);
    });
  });
});

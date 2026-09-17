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
});

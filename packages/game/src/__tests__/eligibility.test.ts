import { describe, it, expect } from 'vitest';
import {
  isPlayerEligible,
  isPlayerActive,
  normalizeNickname,
  isNicknameUnique,
  canPlayerAnswer,
  shouldQuestionEnd,
  canStartGame,
} from '../eligibility';
import type { PlayerData, PresenceData, AnswerData, RoundData } from '@batalha/protocol';

function makePlayer(overrides: Partial<PlayerData> & { playerId: string }): PlayerData {
  return {
    nickname: 'Test',
    tokenHash: 'hash',
    joinedAt: Date.now(),
    eligibleFromQuestion: 0,
    removedAt: null,
    ...overrides,
  };
}

function makePresence(overrides: Partial<PresenceData> & { playerId: string }): PresenceData {
  return {
    connectionId: 'conn1',
    lastSeenAt: Date.now(),
    connected: true,
    ...overrides,
  };
}

function makeRound(overrides?: Partial<RoundData>): RoundData {
  return {
    questionId: 'q1',
    state: 'active',
    startedAt: Date.now() - 1000,
    deadlineAt: Date.now() + 5000,
    remainingMs: null,
    endedAt: null,
    endReason: null,
    ...overrides,
  };
}

const now = 10000;

describe('isPlayerEligible', () => {
  it('eligible when not removed and questionIndex >= eligibleFromQuestion', () => {
    const p = makePlayer({ playerId: '1', eligibleFromQuestion: 1 });
    expect(isPlayerEligible(p, 0)).toBe(false);
    expect(isPlayerEligible(p, 1)).toBe(true);
    expect(isPlayerEligible(p, 2)).toBe(true);
  });

  it('not eligible when removed', () => {
    const p = makePlayer({ playerId: '2', eligibleFromQuestion: 0, removedAt: 123 });
    expect(isPlayerEligible(p, 0)).toBe(false);
  });
});

describe('isPlayerActive', () => {
  it('active when connected and within timeout', () => {
    const pr = makePresence({ playerId: '1', connected: true, lastSeenAt: now - 5000 });
    expect(isPlayerActive(pr, now)).toBe(true);
  });

  it('inactive when beyond timeout', () => {
    const pr = makePresence({ playerId: '2', connected: true, lastSeenAt: now - 15000 });
    expect(isPlayerActive(pr, now)).toBe(false);
  });

  it('inactive when disconnected', () => {
    const pr = makePresence({ playerId: '3', connected: false, lastSeenAt: now - 1000 });
    expect(isPlayerActive(pr, now)).toBe(false);
  });
});

describe('normalizeNickname', () => {
  it('trims and collapses spaces', () => {
    expect(normalizeNickname('  A   B  ')).toBe('A B');
  });
});

describe('isNicknameUnique', () => {
  it('case-insensitive and trim-insensitive comparison', () => {
    const existing: PlayerData[] = [
      makePlayer({ playerId: '1', nickname: 'John Doe' }),
      makePlayer({ playerId: '2', nickname: 'Jane', removedAt: 123 }),
    ];

    expect(isNicknameUnique('john doe', existing)).toBe(false);
    expect(isNicknameUnique('  JOHN doe  ', existing)).toBe(false);
    expect(isNicknameUnique('Jane', existing)).toBe(true); // removed player
    expect(isNicknameUnique('Jack', existing)).toBe(true);
  });
});

describe('canPlayerAnswer', () => {
  it('returns allowed when all conditions met', () => {
    const p = makePlayer({ playerId: '1' });
    const pr = makePresence({ playerId: '1', lastSeenAt: now });
    const round = makeRound({ state: 'active', deadlineAt: now + 5000, startedAt: now - 1000 });

    expect(canPlayerAnswer(p, pr, 0, undefined, round, now)).toEqual({ allowed: true });
  });

  it('rejects ineligible player', () => {
    const p = makePlayer({ playerId: '1', eligibleFromQuestion: 1 });
    const pr = makePresence({ playerId: '1', lastSeenAt: now });
    const round = makeRound({ state: 'active', deadlineAt: now + 5000 });

    expect(canPlayerAnswer(p, pr, 0, undefined, round, now).allowed).toBe(false);
  });

  it('rejects inactive player', () => {
    const p = makePlayer({ playerId: '1' });
    const pr = makePresence({ playerId: '1', connected: false, lastSeenAt: now });
    const round = makeRound({ state: 'active', deadlineAt: now + 5000 });

    expect(canPlayerAnswer(p, pr, 0, undefined, round, now).allowed).toBe(false);
  });

  it('rejects when round not active', () => {
    const p = makePlayer({ playerId: '1' });
    const pr = makePresence({ playerId: '1', lastSeenAt: now });
    const round = makeRound({ state: 'ended', deadlineAt: now + 5000 });

    expect(canPlayerAnswer(p, pr, 0, undefined, round, now).allowed).toBe(false);
  });

  it('rejects already answered', () => {
    const p = makePlayer({ playerId: '1' });
    const pr = makePresence({ playerId: '1', lastSeenAt: now });
    const round = makeRound({ state: 'active', deadlineAt: now + 5000 });
    const ans: AnswerData = {
      questionId: 'q1', playerId: '1', optionId: 'o1',
      receivedAt: now, correct: true, awardedPoints: 100,
    };

    expect(canPlayerAnswer(p, pr, 0, ans, round, now).allowed).toBe(false);
  });

  it('rejects after deadline', () => {
    const p = makePlayer({ playerId: '1' });
    const pr = makePresence({ playerId: '1', lastSeenAt: now + 10000 });
    const round = makeRound({ state: 'active', deadlineAt: now + 5000 });

    expect(canPlayerAnswer(p, pr, 0, undefined, round, now + 10000).allowed).toBe(false);
  });
});

describe('shouldQuestionEnd', () => {
  it('returns true if deadline passed', () => {
    const round = makeRound({ deadlineAt: now - 1000, startedAt: now - 5000 });
    expect(shouldQuestionEnd([], [], [], round, now)).toBe(true);
  });

  it('returns true if all eligible and active players answered', () => {
    const players: PlayerData[] = [
      makePlayer({ playerId: '1', nickname: 'A' }),
      makePlayer({ playerId: '2', nickname: 'B' }),
    ];
    const presences: PresenceData[] = [
      makePresence({ playerId: '1', connected: true, lastSeenAt: now }),
      makePresence({ playerId: '2', connected: false, lastSeenAt: now - 20000 }), // inactive
    ];
    const answers: AnswerData[] = [
      { questionId: 'q1', playerId: '1', optionId: 'o1', receivedAt: now, correct: true, awardedPoints: 100 },
    ];
    const round = makeRound({ deadlineAt: now + 5000 });

    expect(shouldQuestionEnd(players, presences, answers, round, now)).toBe(true);
  });

  it('returns false if active eligible players have not answered', () => {
    const players: PlayerData[] = [
      makePlayer({ playerId: '1', nickname: 'A' }),
      makePlayer({ playerId: '2', nickname: 'B' }),
    ];
    const presences: PresenceData[] = [
      makePresence({ playerId: '1', connected: true, lastSeenAt: now }),
      makePresence({ playerId: '2', connected: true, lastSeenAt: now }),
    ];
    const answers: AnswerData[] = [
      { questionId: 'q1', playerId: '1', optionId: 'o1', receivedAt: now, correct: true, awardedPoints: 100 },
    ];
    const round = makeRound({ deadlineAt: now + 5000 });

    expect(shouldQuestionEnd(players, presences, answers, round, now)).toBe(false);
  });
});

describe('canStartGame', () => {
  it('returns false if players list is empty', () => {
    expect(canStartGame([])).toBe(false);
  });

  it('returns false if all players are removed', () => {
    expect(canStartGame([{ removedAt: 12345 }, { removedAt: 67890 }])).toBe(false);
  });

  it('returns true if at least 1 player is active and not removed', () => {
    expect(canStartGame([{ removedAt: null }])).toBe(true);
    expect(canStartGame([{ removedAt: 12345 }, { removedAt: null }])).toBe(true);
  });

  it('returns false if registered players are all disconnected or presence expired', () => {
    const now = 100_000;
    const players = [{ playerId: 'p1', removedAt: null }];
    // Disconnected
    expect(canStartGame(players, [{ playerId: 'p1', connected: false, lastSeenAt: now }], now)).toBe(false);
    // Expired presence (> 10s)
    expect(canStartGame(players, [{ playerId: 'p1', connected: true, lastSeenAt: now - 15_000 }], now)).toBe(false);
  });

  it('returns true if at least 1 player has live connected presence', () => {
    const now = 100_000;
    const players = [
      { playerId: 'p1', removedAt: null },
      { playerId: 'p2', removedAt: null },
    ];
    const presences = [
      { playerId: 'p1', connected: false, lastSeenAt: now },
      { playerId: 'p2', connected: true, lastSeenAt: now - 2_000 },
    ];
    expect(canStartGame(players, presences, now)).toBe(true);
  });

  it('does not count removed players as connected', () => {
    const now = 100_000;
    const players = [{ playerId: 'p1', removedAt: now }];
    const presences = [{ playerId: 'p1', connected: true, lastSeenAt: now }];
    expect(canStartGame(players, presences, now)).toBe(false);
  });
});


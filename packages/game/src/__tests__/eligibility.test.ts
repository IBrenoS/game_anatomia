import { describe, it, expect } from 'vitest';
import {
  isPlayerEligible,
  isPlayerActive,
  normalizeNickname,
  isNicknameUnique,
  canPlayerAnswer,
  shouldQuestionEnd,
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

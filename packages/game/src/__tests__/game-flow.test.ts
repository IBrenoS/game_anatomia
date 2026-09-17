import { describe, it, expect } from 'vitest';
import {
  calculatePoints,
  buildRanking,
  canTransition,
  assertTransition,
  toPublicQuestion,
  isPlayerEligible,
  isPlayerActive,
  canPlayerAnswer,
  shouldQuestionEnd,
  normalizeNickname,
  isNicknameUnique,
  canStartGame,
} from '../index.js';
import type { PlayerData, PresenceData, AnswerData, RoundData, ScoreData, Question } from '@batalha/protocol';

describe('Batalha Anatômica - End-to-End Acceptance Criteria Suite', () => {
  const now = 1_000_000;

  it('AC 01: State machine validates host start game transition LOBBY -> COUNTDOWN -> QUESTION_ACTIVE', () => {
    expect(canTransition('LOBBY', 'COUNTDOWN')).toBe(true);
    expect(canTransition('COUNTDOWN', 'QUESTION_ACTIVE')).toBe(true);
    expect(() => assertTransition('LOBBY', 'QUESTION_ACTIVE')).toThrow();
  });

  it('AC 02: Question ends when all active eligible players answer', () => {
    const round: RoundData = {
      questionId: 'q1',
      state: 'active',
      startedAt: now,
      deadlineAt: now + 60_000,
      remainingMs: null,
      endedAt: null,
      endReason: null,
    };

    const players: PlayerData[] = [
      { playerId: 'p1', nickname: 'Alice', tokenHash: 'h1', joinedAt: now - 5000, eligibleFromQuestion: 0, removedAt: null },
      { playerId: 'p2', nickname: 'Bob', tokenHash: 'h2', joinedAt: now - 4000, eligibleFromQuestion: 0, removedAt: null },
    ];

    const presences: PresenceData[] = [
      { playerId: 'p1', connectionId: 'c1', lastSeenAt: now, connected: true },
      { playerId: 'p2', connectionId: 'c2', lastSeenAt: now, connected: true },
    ];

    const answers: AnswerData[] = [
      { questionId: 'q1', playerId: 'p1', optionId: 'opt_a', receivedAt: now + 3000, correct: true, awardedPoints: 125 },
    ];

    // Only 1 of 2 answered: should NOT end
    expect(shouldQuestionEnd(players, presences, answers, round, now + 3000)).toBe(false);

    // Both answered: SHOULD end immediately
    answers.push({
      questionId: 'q1',
      playerId: 'p2',
      optionId: 'opt_b',
      receivedAt: now + 4500,
      correct: false,
      awardedPoints: 0,
    });

    expect(shouldQuestionEnd(players, presences, answers, round, now + 4500)).toBe(true);
  });

  it('AC 03 & AC 04: Speed bonus at boundary conditions (<= 10,000ms vs 10,001ms)', () => {
    // Exactly 10,000ms: Bonus granted (100 * 1.25 = 125)
    expect(calculatePoints(100, true, 10_000)).toBe(125);
    expect(calculatePoints(200, true, 10_000)).toBe(250);
    expect(calculatePoints(300, true, 10_000)).toBe(375);

    // 10,001ms: Base points only
    expect(calculatePoints(100, true, 10_001)).toBe(100);
    expect(calculatePoints(200, true, 10_001)).toBe(200);
    expect(calculatePoints(300, true, 10_001)).toBe(300);

    // AC 05: Incorrect answer always receives 0
    expect(calculatePoints(100, false, 2000)).toBe(0);
    expect(calculatePoints(200, false, 10_000)).toBe(0);
    expect(calculatePoints(300, false, 10_001)).toBe(0);
  });

  it('AC 06: Question ends automatically when deadline is reached', () => {
    const round: RoundData = {
      questionId: 'q1',
      state: 'active',
      startedAt: now,
      deadlineAt: now + 60_000,
      remainingMs: null,
      endedAt: null,
      endReason: null,
    };

    const players: PlayerData[] = [
      { playerId: 'p1', nickname: 'Alice', tokenHash: 'h1', joinedAt: now, eligibleFromQuestion: 0, removedAt: null },
    ];
    const presences: PresenceData[] = [
      { playerId: 'p1', connectionId: 'c1', lastSeenAt: now, connected: true },
    ];

    // Before deadline, no answer
    expect(shouldQuestionEnd(players, presences, [], round, now + 30_000)).toBe(false);

    // At or after deadline
    expect(shouldQuestionEnd(players, presences, [], round, now + 60_000)).toBe(true);
    expect(shouldQuestionEnd(players, presences, [], round, now + 60_001)).toBe(true);
  });

  it('AC 08: State machine supports PAUSE from QUESTION_ACTIVE and RESUME via COUNTDOWN', () => {
    expect(canTransition('QUESTION_ACTIVE', 'PAUSED')).toBe(true);
    expect(canTransition('PAUSED', 'COUNTDOWN')).toBe(true);
    expect(canTransition('COUNTDOWN', 'QUESTION_ACTIVE')).toBe(true);
  });

  it('AC 09: Late entrant eligibility starts on next question', () => {
    const lateJoiner: PlayerData = {
      playerId: 'p_late',
      nickname: 'Latecomer',
      tokenHash: 'hl',
      joinedAt: now + 15_000,
      eligibleFromQuestion: 3, // joined while question 2 was active
      removedAt: null,
    };

    // Question 2: Ineligible
    expect(isPlayerEligible(lateJoiner, 2)).toBe(false);

    // Question 3 and beyond: Eligible
    expect(isPlayerEligible(lateJoiner, 3)).toBe(true);
    expect(isPlayerEligible(lateJoiner, 4)).toBe(true);
  });

  it('AC 10: Complete tiebreak hierarchy (points -> correct -> time -> join order)', () => {
    const players: PlayerData[] = [
      { playerId: 'p1', nickname: 'First', tokenHash: 'h1', joinedAt: 1000, eligibleFromQuestion: 0, removedAt: null },
      { playerId: 'p2', nickname: 'Second', tokenHash: 'h2', joinedAt: 2000, eligibleFromQuestion: 0, removedAt: null },
      { playerId: 'p3', nickname: 'Third', tokenHash: 'h3', joinedAt: 3000, eligibleFromQuestion: 0, removedAt: null },
      { playerId: 'p4', nickname: 'Fourth', tokenHash: 'h4', joinedAt: 4000, eligibleFromQuestion: 0, removedAt: null },
    ];

    const scores: ScoreData[] = [
      // p1 and p2 tied on points (250) and correct count (2)
      // p1 has lower correct response time (8000ms vs 9000ms) -> p1 wins
      { playerId: 'p1', totalPoints: 250, correctCount: 2, correctResponseTimeMs: 8000 },
      { playerId: 'p2', totalPoints: 250, correctCount: 2, correctResponseTimeMs: 9000 },
      // p3 has same points (250) but lower correct count (1) -> p3 below p1 and p2
      { playerId: 'p3', totalPoints: 250, correctCount: 1, correctResponseTimeMs: 5000 },
      // p4 has fewer points (200) -> lowest
      { playerId: 'p4', totalPoints: 200, correctCount: 2, correctResponseTimeMs: 4000 },
    ];

    const ranking = buildRanking(scores, players);

    expect(ranking[0].playerId).toBe('p1');
    expect(ranking[0].position).toBe(1);
    expect(ranking[0].distanceToPrevious).toBe(0);

    expect(ranking[1].playerId).toBe('p2');
    expect(ranking[1].position).toBe(2);
    expect(ranking[1].distanceToPrevious).toBe(0); // 250 - 250

    expect(ranking[2].playerId).toBe('p3');
    expect(ranking[2].position).toBe(3);
    expect(ranking[2].distanceToPrevious).toBe(0); // 250 - 250

    expect(ranking[3].playerId).toBe('p4');
    expect(ranking[3].position).toBe(4);
    expect(ranking[3].distanceToPrevious).toBe(50); // 250 - 200
  });

  it('AC 11: toPublicQuestion strips correctOptionId and explanation', () => {
    const fullQuestion: Question = {
      id: 'q10',
      order: 9,
      type: 'final',
      prompt: 'Por que estudar os músculos de bovinos e equinos é importante?',
      options: [
        { id: 'opt_1', label: 'Para compreender postura, locomoção e movimentos' },
        { id: 'opt_2', label: 'Apenas para identificar cortes de carne' },
      ],
      correctOptionId: 'opt_1',
      explanation: 'O estudo muscular comparativo é essencial para a biomecânica veterinária.',
      durationMs: 60_000,
      basePoints: 300,
      speedBonusWindowMs: 10_000,
      speedBonusMultiplier: 1.25,
    };

    const publicQ = toPublicQuestion(fullQuestion);

    expect(publicQ.id).toBe('q10');
    expect(publicQ.prompt).toBe(fullQuestion.prompt);
    expect(publicQ.options).toHaveLength(2);
    expect((publicQ as any).correctOptionId).toBeUndefined();
    expect((publicQ as any).explanation).toBeUndefined();
  });

  it('Nickname normalization and uniqueness rules (trim, collapse spaces, case-insensitive)', () => {
    expect(normalizeNickname('   Dr.   Anatomia   ')).toBe('Dr. Anatomia');

    const existing: PlayerData[] = [
      { playerId: 'p1', nickname: 'Maria Silva', tokenHash: 'h', joinedAt: now, eligibleFromQuestion: 0, removedAt: null },
    ];

    expect(isNicknameUnique('maria silva', existing)).toBe(false);
    expect(isNicknameUnique('  MARIA   SILVA  ', existing)).toBe(false);
    expect(isNicknameUnique('Carlos', existing)).toBe(true);
  });

  it('Presence timeout and canPlayerAnswer validation', () => {
    const player: PlayerData = { playerId: 'p1', nickname: 'Test', tokenHash: 'h', joinedAt: now, eligibleFromQuestion: 0, removedAt: null };
    const activePresence: PresenceData = { playerId: 'p1', connectionId: 'c1', lastSeenAt: now, connected: true };
    const inactivePresence: PresenceData = { playerId: 'p1', connectionId: 'c1', lastSeenAt: now - 15_000, connected: true };

    expect(isPlayerActive(activePresence, now)).toBe(true);
    expect(isPlayerActive(inactivePresence, now)).toBe(false);

    const round: RoundData = {
      questionId: 'q1',
      state: 'active',
      startedAt: now,
      deadlineAt: now + 60_000,
      remainingMs: null,
      endedAt: null,
      endReason: null,
    };

    expect(canPlayerAnswer(player, activePresence, 0, undefined, round, now).allowed).toBe(true);
    expect(canPlayerAnswer(player, inactivePresence, 0, undefined, round, now).allowed).toBe(false);
  });

  it('PRD v1.1: Host cannot start game when player count is 0 and can start when >= 1', () => {
    // 0 players: start blocked
    expect(canStartGame([])).toBe(false);

    // Removed players only: start blocked
    const removedOnly: PlayerData[] = [
      { playerId: 'p1', nickname: 'Ex-Player', tokenHash: 'h', joinedAt: now, eligibleFromQuestion: 0, removedAt: now - 1000 },
    ];
    expect(canStartGame(removedOnly)).toBe(false);

    // 1 active player: start allowed
    const withActive: PlayerData[] = [
      { playerId: 'p2', nickname: 'Competitor', tokenHash: 'h2', joinedAt: now, eligibleFromQuestion: 0, removedAt: null },
    ];
    expect(canStartGame(withActive)).toBe(true);
  });
});


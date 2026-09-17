import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getValidTransitions,
  assertTransition,
  isTerminal,
  toPublicQuestion,
} from '../state-machine';
import { GameState, Question } from '@batalha/protocol';

describe('state-machine', () => {
  it('allows valid transitions', () => {
    expect(canTransition('LOBBY', 'COUNTDOWN')).toBe(true);
    expect(canTransition('QUESTION_ACTIVE', 'QUESTION_REVEAL')).toBe(true);
  });

  it('denies invalid transitions', () => {
    expect(canTransition('LOBBY', 'QUESTION_ACTIVE')).toBe(false);
    expect(canTransition('COUNTDOWN', 'LOBBY')).toBe(false);
  });

  it('gets valid transitions', () => {
    const fromLobby = getValidTransitions('LOBBY');
    expect(fromLobby).toContain('COUNTDOWN');
    expect(fromLobby).toContain('FINISHED');
    expect(fromLobby.length).toBe(2);
  });

  it('throws on invalid transition assertion', () => {
    expect(() => assertTransition('LOBBY', 'QUESTION_ACTIVE')).toThrow(/Invalid state transition/);
  });

  it('does not throw on valid transition assertion', () => {
    expect(() => assertTransition('LOBBY', 'COUNTDOWN')).not.toThrow();
  });

  it('identifies terminal state', () => {
    expect(isTerminal('FINISHED')).toBe(true);
    expect(isTerminal('LOBBY')).toBe(false);
    expect(isTerminal('COUNTDOWN')).toBe(false);
    expect(isTerminal('QUESTION_ACTIVE')).toBe(false);
    expect(isTerminal('QUESTION_REVEAL')).toBe(false);
    expect(isTerminal('ROUND_RANKING')).toBe(false);
    expect(isTerminal('FINAL_RANKING')).toBe(false);
    expect(isTerminal('PODIUM')).toBe(false);
    expect(isTerminal('PAUSED')).toBe(false);
  });

  it('toPublicQuestion removes secrets', () => {
    const q: Question = {
      id: 'q1',
      order: 0,
      prompt: 'What is it?',
      type: 'region',
      basePoints: 100,
      durationMs: 60000,
      speedBonusWindowMs: 10000,
      speedBonusMultiplier: 1.25,
      options: [{ id: 'o1', label: 'A' }, { id: 'o2', label: 'B' }],
      correctOptionId: 'o1',
      explanation: 'Because A',
    };

    const pq = toPublicQuestion(q);
    expect(pq.id).toBe('q1');
    expect(pq.prompt).toBe('What is it?');
    expect((pq as any).correctOptionId).toBeUndefined();
    expect((pq as any).explanation).toBeUndefined();
  });

  describe('P3.1 10th Question Sequence and Terminal State Tests', () => {
    it('supports direct 10th question sequence: QUESTION_REVEAL -> FINAL_RANKING -> PODIUM -> FINISHED', () => {
      // 10th question path from QUESTION_REVEAL directly to FINAL_RANKING
      expect(canTransition('QUESTION_REVEAL', 'FINAL_RANKING')).toBe(true);
      expect(() => assertTransition('QUESTION_REVEAL', 'FINAL_RANKING')).not.toThrow();

      // From FINAL_RANKING to PODIUM
      expect(canTransition('FINAL_RANKING', 'PODIUM')).toBe(true);
      expect(() => assertTransition('FINAL_RANKING', 'PODIUM')).not.toThrow();

      // From PODIUM to FINISHED
      expect(canTransition('PODIUM', 'FINISHED')).toBe(true);
      expect(() => assertTransition('PODIUM', 'FINISHED')).not.toThrow();
    });

    it('supports alternate path via ROUND_RANKING -> FINAL_RANKING -> PODIUM -> FINISHED', () => {
      expect(canTransition('QUESTION_REVEAL', 'ROUND_RANKING')).toBe(true);
      expect(canTransition('ROUND_RANKING', 'FINAL_RANKING')).toBe(true);
      expect(canTransition('FINAL_RANKING', 'PODIUM')).toBe(true);
      expect(canTransition('PODIUM', 'FINISHED')).toBe(true);
    });

    it('enforces terminal state immutability for FINISHED', () => {
      // FINISHED must have NO valid transitions outward
      const fromFinished = getValidTransitions('FINISHED');
      expect(fromFinished).toEqual([]);

      const allStates: GameState[] = [
        'LOBBY',
        'COUNTDOWN',
        'QUESTION_ACTIVE',
        'PAUSED',
        'QUESTION_REVEAL',
        'ROUND_RANKING',
        'FINAL_RANKING',
        'PODIUM',
        'FINISHED',
      ];

      allStates.forEach(targetState => {
        expect(canTransition('FINISHED', targetState)).toBe(false);
        expect(() => assertTransition('FINISHED', targetState)).toThrow(
          /Invalid state transition from FINISHED/
        );
      });
    });

    it('prevents skipping states in the 10th question sequence', () => {
      // Cannot jump directly from QUESTION_REVEAL to PODIUM
      expect(canTransition('QUESTION_REVEAL', 'PODIUM')).toBe(false);

      // Cannot jump directly from QUESTION_ACTIVE to FINAL_RANKING
      expect(canTransition('QUESTION_ACTIVE', 'FINAL_RANKING')).toBe(false);

      // Cannot revert from FINAL_RANKING back to QUESTION_ACTIVE or COUNTDOWN
      expect(canTransition('FINAL_RANKING', 'QUESTION_ACTIVE')).toBe(false);
      expect(canTransition('FINAL_RANKING', 'COUNTDOWN')).toBe(false);

      // Cannot revert from PODIUM back to FINAL_RANKING
      expect(canTransition('PODIUM', 'FINAL_RANKING')).toBe(false);
    });
  });
});

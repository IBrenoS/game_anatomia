import { describe, it, expect } from 'vitest';
import { canTransition, getValidTransitions, assertTransition, isTerminal, toPublicQuestion } from '../state-machine';
import { Question } from '@batalha/protocol';

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
});

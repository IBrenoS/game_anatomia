import { describe, it, expect } from 'vitest';
import { validateQuestions, TOTAL_QUESTIONS } from '../validate';
import type { Question } from '@batalha/protocol';

describe('validateQuestions', () => {
  const getBaseQuestion = (id: string, order: number, type: Question['type'] = 'identify'): Question => ({
    id,
    type,
    order,
    basePoints: 100,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: 'Sample?',
    options: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' }
    ],
    correctOptionId: 'a'
  });

  const getValidQuestions = (): Question[] => {
    const questions = [];
    for (let i = 0; i < TOTAL_QUESTIONS - 1; i++) {
      questions.push(getBaseQuestion(`q${i}`, i));
    }
    questions.push(getBaseQuestion(`q${TOTAL_QUESTIONS - 1}`, TOTAL_QUESTIONS - 1, 'final'));
    return questions;
  };

  it('passes valid questions', () => {
    const questions = getValidQuestions();
    const errors = validateQuestions(questions);
    expect(errors).toHaveLength(0);
  });

  it('detects duplicate ID', () => {
    const questions = getValidQuestions();
    questions[1].id = questions[0].id;
    const errors = validateQuestions(questions);
    expect(errors.some(e => e.error.includes('Duplicate question ID'))).toBe(true);
  });

  it('detects missing correctOptionId', () => {
    const questions = getValidQuestions();
    questions[0].correctOptionId = 'c';
    const errors = validateQuestions(questions);
    expect(errors.some(e => e.error.includes('not found in options'))).toBe(true);
  });

  it('detects less than 2 options', () => {
    const questions = getValidQuestions();
    questions[0].options = [{ id: 'a', label: 'A' }];
    const errors = validateQuestions(questions);
    expect(errors.some(e => e.error.includes('at least 2 options'))).toBe(true);
  });

  it('detects final not last', () => {
    const questions = getValidQuestions();
    questions[TOTAL_QUESTIONS - 1].type = 'identify';
    const errors = validateQuestions(questions);
    expect(errors.some(e => e.error.includes('must have type="final"'))).toBe(true);
  });

  it('detects wrong question count', () => {
    const questions = getValidQuestions();
    questions.pop();
    const errors = validateQuestions(questions);
    expect(errors.some(e => e.error.includes('Expected exactly'))).toBe(true);
  });

  it('detects non-sequential orders', () => {
    const questions = getValidQuestions();
    questions[1].order = 5;
    const errors = validateQuestions(questions);
    expect(errors.some(e => e.error.includes('sequential'))).toBe(true);
  });
});

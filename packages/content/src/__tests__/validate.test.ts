import { describe, it, expect } from 'vitest';
import { validateQuestions, TOTAL_QUESTIONS } from '../validate';
import { questions } from '../questions';
import type { Question, QuestionType } from '@batalha/protocol';

describe('validateQuestions - Real Content Suite', () => {
  it('validates the real exported questions array with 0 errors', () => {
    const errors = validateQuestions(questions);
    expect(errors).toHaveLength(0);
  });

  it('verifies that real questions export exactly 15 questions', () => {
    expect(questions).toHaveLength(TOTAL_QUESTIONS);
  });

  it('verifies Q23 is the final question with 300 base points', () => {
    const q23 = questions[14];
    expect(q23.id).toBe('q23');
    expect(q23.type).toBe('final');
    expect(q23.order).toBe(14);
    expect(q23.basePoints).toBe(300);
  });
});

describe('validateQuestions - Edge Cases & Rule Enforcement', () => {
  const getBaseQuestion = (
    id: string,
    order: number,
    type: QuestionType = 'identify',
    basePoints: 100 | 200 | 300 = 100
  ): Question => ({
    id,
    type,
    order,
    basePoints,
    durationMs: 60000,
    speedBonusWindowMs: 10000,
    speedBonusMultiplier: 1.25,
    prompt: `Sample question ${id}?`,
    media: {
      src: `/questions/${id}.svg`,
      alt: `Alt description for ${id}`,
      width: 800,
      height: 600,
    },
    options:
      type === 'boolean'
        ? [
            { id: `${id}_v`, label: 'Verdadeiro' },
            { id: `${id}_f`, label: 'Falso' },
          ]
        : [
            { id: `${id}_a`, label: 'Option A' },
            { id: `${id}_b`, label: 'Option B' },
          ],
    correctOptionId: type === 'boolean' ? `${id}_v` : `${id}_a`,
  });

  const getValidSyntheticQuestions = (): Question[] => [
    getBaseQuestion('q1', 0, 'region', 100),
    getBaseQuestion('q2', 1, 'identify', 100),
    getBaseQuestion('q3', 2, 'region', 100),
    getBaseQuestion('q4', 3, 'function', 200),
    getBaseQuestion('q5', 4, 'identify', 100),
    getBaseQuestion('q6', 5, 'region', 100),
    getBaseQuestion('q7', 6, 'region', 100),
    getBaseQuestion('q8', 7, 'species', 100),
    getBaseQuestion('q9', 8, 'boolean', 100),
    getBaseQuestion('q10', 9, 'identify', 100),
    getBaseQuestion('q11', 10, 'identify', 100),
    getBaseQuestion('q12', 11, 'identify', 100),
    getBaseQuestion('q13', 12, 'identify', 100),
    getBaseQuestion('q14', 13, 'identify', 100),
    getBaseQuestion('q15', 14, 'final', 300),
  ];

  it('passes a fully valid synthetic question set', () => {
    const list = getValidSyntheticQuestions();
    const errors = validateQuestions(list);
    expect(errors).toHaveLength(0);
  });

  it('detects duplicate question IDs', () => {
    const list = getValidSyntheticQuestions();
    list[1].id = list[0].id;
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('Duplicate question ID'))).toBe(true);
  });

  it('detects correctOptionId not in options', () => {
    const list = getValidSyntheticQuestions();
    list[0].correctOptionId = 'non_existent_id';
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('not found in options'))).toBe(true);
  });

  it('detects less than 2 options in standard question', () => {
    const list = getValidSyntheticQuestions();
    list[0].options = [{ id: 'single', label: 'Single' }];
    list[0].correctOptionId = 'single';
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('at least 2 options'))).toBe(true);
  });

  it('detects boolean question with 3 options', () => {
    const list = getValidSyntheticQuestions();
    list[8].type = 'boolean';
    list[8].options = [
      { id: 'opt_1', label: 'Verdadeiro' },
      { id: 'opt_2', label: 'Falso' },
      { id: 'opt_3', label: 'Talvez' },
    ];
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('Boolean question must have exactly 2 options'))).toBe(true);
  });

  it('detects boolean question with invalid option labels (e.g. Sim/Nao)', () => {
    const list = getValidSyntheticQuestions();
    list[8].type = 'boolean';
    list[8].options = [
      { id: 'opt_1', label: 'Sim' },
      { id: 'opt_2', label: 'Não' },
    ];
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes("Boolean question options must have labels 'Verdadeiro' and 'Falso'"))).toBe(true);
  });

  it('detects final question not being the last question', () => {
    const list = getValidSyntheticQuestions();
    list[14].type = 'identify';
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('must have type="final"'))).toBe(true);
  });

  it('detects final question with basePoints !== 300', () => {
    const list = getValidSyntheticQuestions();
    list[14].basePoints = 100;
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('Final question must have basePoints === 300'))).toBe(true);
  });

  it('detects incorrect total question count', () => {
    const list = getValidSyntheticQuestions();
    list.pop();
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('Expected exactly 15 questions'))).toBe(true);
  });

  it('detects non-sequential orders', () => {
    const list = getValidSyntheticQuestions();
    list[1].order = 7;
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('Question order must be sequential'))).toBe(true);
  });

  it('detects missing media alt text', () => {
    const list = getValidSyntheticQuestions();
    list[0].media = {
      src: '/img.svg',
      alt: '',
      width: 800,
      height: 600,
    };
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('media alt text must be provided'))).toBe(true);
  });

  it('detects non-positive durationMs', () => {
    const list = getValidSyntheticQuestions();
    list[0].durationMs = 0;
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('durationMs must be a positive number'))).toBe(true);
  });
});

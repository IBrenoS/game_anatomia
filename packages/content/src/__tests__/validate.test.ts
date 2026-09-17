import { describe, it, expect } from 'vitest';
import { validateQuestions, TOTAL_QUESTIONS, REQUIRED_MECHANICS } from '../validate';
import { questions } from '../questions';
import type { Question, QuestionType } from '@batalha/protocol';

describe('validateQuestions - Real Content Suite', () => {
  it('validates the real exported questions array with 0 errors', () => {
    const errors = validateQuestions(questions);
    expect(errors).toHaveLength(0);
  });

  it('verifies that real questions export exactly 10 questions', () => {
    expect(questions).toHaveLength(TOTAL_QUESTIONS);
  });

  it('verifies all 6 mechanics are represented in real questions', () => {
    const mechanics = new Set<QuestionType>(questions.map(q => q.type));
    for (const mechanic of REQUIRED_MECHANICS) {
      expect(mechanics.has(mechanic)).toBe(true);
    }
  });

  it('verifies Q8 is an anatomical miology challenge comparing species', () => {
    const q8 = questions[7];
    expect(q8.id).toBe('q8');
    expect(q8.type).toBe('species');
    expect(q8.prompt).toContain('gluteobíceps');
    expect(q8.options.some(opt => opt.label.includes('Bovino'))).toBe(true);
    expect(q8.options.some(opt => opt.label.includes('Equino'))).toBe(true);
  });

  it('verifies Q9 is boolean with exactly 2 binary choices (Verdadeiro and Falso)', () => {
    const q9 = questions[8];
    expect(q9.id).toBe('q9');
    expect(q9.type).toBe('boolean');
    expect(q9.options).toHaveLength(2);
    const labels = q9.options.map(opt => opt.label);
    expect(labels).toContain('Verdadeiro');
    expect(labels).toContain('Falso');
  });

  it('verifies Q10 is the final comparative challenge with 300 base points', () => {
    const q10 = questions[9];
    expect(q10.id).toBe('q10');
    expect(q10.type).toBe('final');
    expect(q10.order).toBe(9);
    expect(q10.basePoints).toBe(300);
    expect(q10.prompt.toLowerCase()).toContain('equino');
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
    getBaseQuestion('q10', 9, 'final', 300),
  ];

  it('passes a fully valid synthetic question set with all 6 mechanics', () => {
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

  it('detects missing required mechanic', () => {
    const list = getValidSyntheticQuestions();
    // Replace the boolean question with an identify question
    list[8] = getBaseQuestion('q9', 8, 'identify', 100);
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes("Missing required question mechanic/type: 'boolean'"))).toBe(true);
  });

  it('detects boolean question with 3 options', () => {
    const list = getValidSyntheticQuestions();
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
    list[8].options = [
      { id: 'opt_1', label: 'Sim' },
      { id: 'opt_2', label: 'Não' },
    ];
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes("Boolean question options must have labels 'Verdadeiro' and 'Falso'"))).toBe(true);
  });

  it('detects final question not being the last question', () => {
    const list = getValidSyntheticQuestions();
    list[9].type = 'identify';
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('must have type="final"'))).toBe(true);
  });

  it('detects final question with basePoints !== 300', () => {
    const list = getValidSyntheticQuestions();
    list[9].basePoints = 100;
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('Final question must have basePoints === 300'))).toBe(true);
  });

  it('detects incorrect total question count', () => {
    const list = getValidSyntheticQuestions();
    list.pop();
    const errors = validateQuestions(list);
    expect(errors.some(e => e.error.includes('Expected exactly 10 questions'))).toBe(true);
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

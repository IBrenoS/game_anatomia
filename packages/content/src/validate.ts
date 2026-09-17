import type { Question } from '@batalha/protocol';

export type ValidationError = {
  questionId?: string;
  error: string;
};

export const TOTAL_QUESTIONS = 10;

export function validateQuestions(questions: Question[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const idSet = new Set<string>();
  
  if (questions.length !== TOTAL_QUESTIONS) {
    errors.push({ error: `Expected exactly ${TOTAL_QUESTIONS} questions, got ${questions.length}` });
  }
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    
    // Duplicate ID check
    if (idSet.has(q.id)) {
      errors.push({ questionId: q.id, error: `Duplicate question ID: ${q.id}` });
    }
    idSet.add(q.id);
    
    // At least 2 options
    if (!q.options || q.options.length < 2) {
      errors.push({ questionId: q.id, error: 'Question must have at least 2 options' });
    } else {
      // correctOptionId exists
      const correctOptionExists = q.options.some(opt => opt.id === q.correctOptionId);
      if (!correctOptionExists) {
        errors.push({ questionId: q.id, error: `correctOptionId '${q.correctOptionId}' not found in options` });
      }
    }
    
    // valid durationMs
    if (typeof q.durationMs !== 'number' || q.durationMs <= 0) {
      errors.push({ questionId: q.id, error: 'durationMs must be a positive number' });
    }
    
    // media has alt text
    if (q.media && (!q.media.alt || q.media.alt.trim() === '')) {
      errors.push({ questionId: q.id, error: 'media alt text must be provided if media is set' });
    }
    
    // orders are sequential 0-9
    if (q.order !== i) {
      errors.push({ questionId: q.id, error: `Question order must be sequential. Expected ${i}, got ${q.order}` });
    }
  }
  
  // final question is last
  const lastQuestion = questions[questions.length - 1];
  if (lastQuestion) {
    if (lastQuestion.type !== 'final') {
      errors.push({ questionId: lastQuestion.id, error: 'The last question must have type="final"' });
    }
    if (lastQuestion.order !== TOTAL_QUESTIONS - 1) {
      errors.push({ questionId: lastQuestion.id, error: `The final question must have order ${TOTAL_QUESTIONS - 1}` });
    }
  }
  
  return errors;
}

// When run as script, perform validation on the actual exported questions
if (typeof process !== 'undefined' && process.argv && process.argv[1]) {
  import('node:url').then(({ pathToFileURL }) => {
    if (import.meta.url === pathToFileURL(process.argv[1]).href) {
      import('./questions.js').then(({ questions }) => {
        const errors = validateQuestions(questions);
        if (errors.length > 0) {
          console.error('Validation errors found:');
          errors.forEach(e => console.error(`- [${e.questionId || 'GLOBAL'}] ${e.error}`));
          process.exit(1);
        } else {
          console.log('All questions validated successfully.');
        }
      }).catch(err => {
        console.error('Failed to load questions:', err);
        process.exit(1);
      });
    }
  }).catch(() => {});
}

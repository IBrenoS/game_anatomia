import { GameState, Question, PublicQuestion } from '@batalha/protocol';

export type Transition = { from: GameState; to: GameState; trigger: string };

export const VALID_TRANSITIONS: Transition[] = [
  { from: 'LOBBY', to: 'COUNTDOWN', trigger: 'host starts' },
  { from: 'LOBBY', to: 'FINISHED', trigger: 'host ends' },
  { from: 'COUNTDOWN', to: 'QUESTION_ACTIVE', trigger: 'countdown ends' },
  { from: 'COUNTDOWN', to: 'PAUSED', trigger: 'host pauses' },
  { from: 'QUESTION_ACTIVE', to: 'QUESTION_REVEAL', trigger: 'all answered / deadline / host ends' },
  { from: 'QUESTION_ACTIVE', to: 'PAUSED', trigger: 'host pauses' },
  { from: 'QUESTION_REVEAL', to: 'ROUND_RANKING', trigger: 'timer / host shows ranking' },
  { from: 'QUESTION_REVEAL', to: 'FINAL_RANKING', trigger: 'timer / host shows ranking (last question)' },
  { from: 'QUESTION_REVEAL', to: 'PAUSED', trigger: 'host pauses' },
  { from: 'QUESTION_REVEAL', to: 'FINISHED', trigger: 'host ends' },
  { from: 'ROUND_RANKING', to: 'COUNTDOWN', trigger: 'timer / host next question, NOT last' },
  { from: 'ROUND_RANKING', to: 'FINAL_RANKING', trigger: 'was last question' },
  { from: 'ROUND_RANKING', to: 'PAUSED', trigger: 'host pauses' },
  { from: 'ROUND_RANKING', to: 'FINISHED', trigger: 'host ends' },
  { from: 'PAUSED', to: 'COUNTDOWN', trigger: 'host resumes' },
  { from: 'PAUSED', to: 'FINISHED', trigger: 'host ends' },
  { from: 'FINAL_RANKING', to: 'PODIUM', trigger: 'timer / host starts podium' },
  { from: 'FINAL_RANKING', to: 'FINISHED', trigger: 'host ends' },
  { from: 'PODIUM', to: 'FINISHED', trigger: 'ceremony ends' }
];

export function getValidTransitions(from: GameState): GameState[] {
  return VALID_TRANSITIONS.filter(t => t.from === from).map(t => t.to);
}

export function canTransition(from: GameState, to: GameState): boolean {
  return VALID_TRANSITIONS.some(t => t.from === from && t.to === to);
}

export function assertTransition(from: GameState, to: GameState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid state transition from ${from} to ${to}`);
  }
}

export function isTerminal(state: GameState): boolean {
  return state === 'FINISHED';
}

export function toPublicQuestion(question: Question): PublicQuestion {
  const { correctOptionId, explanation, ...publicQ } = question;
  return publicQ as PublicQuestion;
}

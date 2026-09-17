// ─── Game States ─────────────────────────────────────────────
// PRD p.7: Official states with transitions
export const GameState = {
  LOBBY: 'LOBBY',
  COUNTDOWN: 'COUNTDOWN',
  QUESTION_ACTIVE: 'QUESTION_ACTIVE',
  QUESTION_REVEAL: 'QUESTION_REVEAL',
  ROUND_RANKING: 'ROUND_RANKING',
  PAUSED: 'PAUSED',
  FINAL_RANKING: 'FINAL_RANKING',
  PODIUM: 'PODIUM',
  FINISHED: 'FINISHED',
} as const;

export type GameState = (typeof GameState)[keyof typeof GameState];

// ─── Question Types ──────────────────────────────────────────
// PRD p.8: Six challenge types
export const QuestionType = {
  IDENTIFY: 'identify',
  REGION: 'region',
  SPECIES: 'species',
  FUNCTION: 'function',
  BOOLEAN: 'boolean',
  FINAL: 'final',
} as const;

export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

// ─── Base Points ─────────────────────────────────────────────
// PRD p.8-9: 100, 200, or 300 per question type
export type BasePoints = 100 | 200 | 300;

// ─── Roles ───────────────────────────────────────────────────
// PRD p.4: Three surfaces
export const Role = {
  HOST: 'host',
  PLAYER: 'player',
  SCREEN: 'screen',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

// ─── Question ────────────────────────────────────────────────
// PRD p.9: Content contract (exact from PRD)
export interface QuestionMedia {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface QuestionOption {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  media?: QuestionMedia;
  options: QuestionOption[];
  correctOptionId: string;
  explanation?: string;
  durationMs: number;
  basePoints: BasePoints;
  speedBonusWindowMs: 10_000;
  speedBonusMultiplier: 1.25;
}

// PRD p.9: Public projection during QUESTION_ACTIVE removes secret fields
export type PublicQuestion = Omit<Question, 'correctOptionId' | 'explanation'>;

// ─── Data Model Entities ─────────────────────────────────────
// PRD p.21: Entities persisted in GameRoom

export interface RoomData {
  pin: string;
  status: GameState;
  roomVersion: number;
  entryLocked: boolean;
  currentQuestionIndex: number;
  createdAt: number;
  expiresAt: number;
}

export interface RoundData {
  questionId: string;
  state: 'active' | 'paused' | 'ended';
  startedAt: number;
  deadlineAt: number;
  remainingMs: number | null;
  endedAt: number | null;
  endReason: 'all_answered' | 'deadline' | 'host' | null;
}

export interface PlayerData {
  playerId: string;
  nickname: string;
  tokenHash: string;
  joinedAt: number;
  eligibleFromQuestion: number;
  removedAt: number | null;
}

export interface PresenceData {
  playerId: string;
  connectionId: string;
  lastSeenAt: number;
  connected: boolean;
}

export interface AnswerData {
  questionId: string;
  playerId: string;
  optionId: string;
  receivedAt: number;
  correct: boolean;
  awardedPoints: number;
}

export interface ScoreData {
  playerId: string;
  totalPoints: number;
  correctCount: number;
  correctResponseTimeMs: number;
}

export interface CommandData {
  commandId: string;
  actor: string;
  type: string;
  acceptedAt: number;
  resultingRoomVersion: number;
}

// ─── Ranking Entry ───────────────────────────────────────────
// PRD p.10: Ranking with tiebreaker fields
export interface RankingEntry {
  position: number;
  playerId: string;
  nickname: string;
  totalPoints: number;
  correctCount: number;
  correctResponseTimeMs: number;
  /** Points difference to previous position (0 for 1st) */
  distanceToPrevious: number;
}

// ─── Host Commands ───────────────────────────────────────────
// PRD p.6: Controls allowed for the host
export const HostCommandType = {
  START_GAME: 'START_GAME',
  LOCK_ENTRIES: 'LOCK_ENTRIES',
  UNLOCK_ENTRIES: 'UNLOCK_ENTRIES',
  REMOVE_PLAYER: 'REMOVE_PLAYER',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  END_QUESTION: 'END_QUESTION',
  SHOW_RANKING: 'SHOW_RANKING',
  NEXT_QUESTION: 'NEXT_QUESTION',
  START_PODIUM: 'START_PODIUM',
  END_GAME: 'END_GAME',
} as const;

export type HostCommandType = (typeof HostCommandType)[keyof typeof HostCommandType];

// ─── Answer Distribution ─────────────────────────────────────
export interface OptionDistribution {
  optionId: string;
  count: number;
  percentage: number;
}

// ─── Personal Result ─────────────────────────────────────────
export interface PersonalResult {
  correct: boolean;
  selectedOptionId: string;
  awardedPoints: number;
  responseTimeMs: number;
}

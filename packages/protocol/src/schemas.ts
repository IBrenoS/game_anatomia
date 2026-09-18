import { z } from 'zod';

// ─── Event Envelope ──────────────────────────────────────────
// PRD p.18: Protocol envelope with roomVersion for consistency
export const EventEnvelopeSchema = z.object({
  protocolVersion: z.literal(1),
  eventId: z.string().min(1),
  type: z.string().min(1),
  sentAt: z.number().int().positive(),
  roomVersion: z.number().int().nonnegative(),
  correlationId: z.string().optional(),
  payload: z.unknown(),
});

// ─── Question Schema ─────────────────────────────────────────
// PRD p.9: Content contract
export const QuestionMediaSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const QuestionOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

export const QuestionSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
  type: z.enum(['identify', 'region', 'species', 'function', 'boolean', 'final'] as const),
  prompt: z.string().min(1),
  media: QuestionMediaSchema.optional(),
  options: z.array(QuestionOptionSchema).min(2),
  correctOptionId: z.string().min(1),
  explanation: z.string().optional(),
  durationMs: z.number().int().positive(),
  basePoints: z.union([z.literal(100), z.literal(200), z.literal(300)]),
  speedBonusWindowMs: z.literal(10_000),
  speedBonusMultiplier: z.literal(1.25),
});

// ─── Client Event Schemas ────────────────────────────────────
// PRD p.18: Events from client to server

export const JoinRoomSchema = z.object({
  pin: z.string().length(6).regex(/^\d{6}$/),
  nickname: z.string().min(2).max(20),
});

export const ResumeSessionSchema = z.object({
  pin: z.string().length(6).regex(/^\d{6}$/),
  reconnectToken: z.string().min(1),
});

export const SubmitAnswerSchema = z.object({
  questionId: z.string().min(1),
  questionVersion: z.number().int().nonnegative(),
  optionId: z.string().min(1),
});

export const ClientAliveSchema = z.object({
  clientTime: z.number().positive(),
});

export const RemovePlayerPayload = z.object({
  playerId: z.string().min(1),
});

export const HostCommandSchema = z.object({
  command: z.enum([
    'START_GAME',
    'LOCK_ENTRIES',
    'UNLOCK_ENTRIES',
    'REMOVE_PLAYER',
    'PAUSE',
    'RESUME',
    'END_QUESTION',
    'SHOW_RANKING',
    'NEXT_QUESTION',
    'START_PODIUM',
    'END_GAME',
  ] as const),
  expectedRoomVersion: z.number().int().nonnegative(),
  /** Additional data for commands like REMOVE_PLAYER */
  data: z.record(z.unknown()).optional(),
});

export const RequestSnapshotSchema = z.object({
  lastRoomVersion: z.number().int().nonnegative(),
});

// ─── Nickname Normalization ──────────────────────────────────
// PRD FR 005-006: 2-20 chars after space normalization, case-insensitive uniqueness
export const NicknameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(2).max(20));

// ─── Client Event Types ──────────────────────────────────────

export const ClientEventType = {
  JOIN_ROOM: 'JOIN_ROOM',
  RESUME_SESSION: 'RESUME_SESSION',
  SUBMIT_ANSWER: 'SUBMIT_ANSWER',
  CLIENT_ALIVE: 'CLIENT_ALIVE',
  HOST_COMMAND: 'HOST_COMMAND',
  REQUEST_SNAPSHOT: 'REQUEST_SNAPSHOT',
} as const;

export type ClientEventType = (typeof ClientEventType)[keyof typeof ClientEventType];

// ─── Server Event Types ──────────────────────────────────────

export const ServerEventType = {
  SESSION_ACCEPTED: 'SESSION_ACCEPTED',
  SNAPSHOT: 'SNAPSHOT',
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_PRESENCE_CHANGED: 'PLAYER_PRESENCE_CHANGED',
  GAME_STATE_CHANGED: 'GAME_STATE_CHANGED',
  QUESTION_STARTED: 'QUESTION_STARTED',
  ROUND_PROGRESS: 'ROUND_PROGRESS',
  ANSWER_ACCEPTED: 'ANSWER_ACCEPTED',
  ANSWER_REJECTED: 'ANSWER_REJECTED',
  QUESTION_ENDED: 'QUESTION_ENDED',
  ANSWER_REVEAL: 'ANSWER_REVEAL',
  RANKING_UPDATED: 'RANKING_UPDATED',
  ROOM_FINISHED: 'ROOM_FINISHED',
  ERROR: 'ERROR',
} as const;

export type ServerEventType = (typeof ServerEventType)[keyof typeof ServerEventType];

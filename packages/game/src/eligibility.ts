import { PlayerData, PresenceData, AnswerData, RoundData, PRESENCE_TIMEOUT_MS } from '@batalha/protocol';

/**
 * PRD p.10: Player eligible if not removed AND eligibleFromQuestion <= questionIndex
 */
export function isPlayerEligible(player: PlayerData, questionIndex: number): boolean {
  return player.removedAt === null && player.eligibleFromQuestion <= questionIndex;
}

/**
 * PRD p.10: Active if connected AND lastSeenAt within PRESENCE_TIMEOUT_MS
 */
export function isPlayerActive(presence: PresenceData, now: number): boolean {
  return presence.connected && (now - presence.lastSeenAt) <= PRESENCE_TIMEOUT_MS;
}

/**
 * PRD FR 005: Trim and collapse spaces
 */
export function normalizeNickname(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * PRD FR 006: Case-insensitive, trim-insensitive uniqueness check
 */
export function isNicknameUnique(nickname: string, existingPlayers: PlayerData[]): boolean {
  const normalized = normalizeNickname(nickname).toLowerCase();
  return !existingPlayers.some(
    p => p.removedAt === null && normalizeNickname(p.nickname).toLowerCase() === normalized
  );
}

/**
 * Full eligibility check for submitting an answer.
 * Returns { allowed: true } or { allowed: false, errorCode }.
 */
export function canPlayerAnswer(
  player: PlayerData,
  presence: PresenceData,
  questionIndex: number,
  existingAnswer: AnswerData | undefined,
  round: RoundData,
  now: number
): { allowed: boolean; errorCode?: string } {
  if (!isPlayerEligible(player, questionIndex)) {
    return { allowed: false, errorCode: 'PLAYER_NOT_ELIGIBLE' };
  }
  if (!isPlayerActive(presence, now)) {
    return { allowed: false, errorCode: 'PLAYER_NOT_ACTIVE' };
  }
  if (round.state !== 'active') {
    return { allowed: false, errorCode: 'QUESTION_NOT_ACTIVE' };
  }
  if (existingAnswer) {
    return { allowed: false, errorCode: 'ALREADY_ANSWERED' };
  }
  if (now > round.deadlineAt) {
    return { allowed: false, errorCode: 'DEADLINE_PASSED' };
  }

  return { allowed: true };
}

/**
 * PRD FR 016 / AC 01: Question ends when all eligible+active answered OR deadline passed.
 */
export function shouldQuestionEnd(
  eligiblePlayers: PlayerData[],
  activePresences: PresenceData[],
  answers: AnswerData[],
  round: RoundData,
  now: number
): boolean {
  if (now >= round.deadlineAt) {
    return true;
  }

  const activeAndEligible = eligiblePlayers.filter(p => {
    const presence = activePresences.find(pr => pr.playerId === p.playerId);
    return presence && isPlayerActive(presence, now);
  });

  if (activeAndEligible.length === 0) return false;

  return activeAndEligible.every(p =>
    answers.some(a => a.playerId === p.playerId)
  );
}

/**
 * PRD v1.1 / FR 011: Game can only start if there is at least 1 non-removed player in the room
 */
export function canStartGame(players: Array<{ removedAt?: number | null }>): boolean {
  return players.some(p => p.removedAt === null || p.removedAt === undefined);
}

/**
 * PRD v1.1 / P1.1: Determine player presence status
 */
export function getPlayerPresenceStatus(
  player: { removedAt?: number | null },
  presence: { connected: boolean; lastSeenAt: number } | undefined,
  now: number
): 'CONNECTED' | 'TEMPORARILY_DISCONNECTED' | 'REMOVED' {
  if (player.removedAt !== null && player.removedAt !== undefined) {
    return 'REMOVED';
  }
  if (presence && isPlayerActive(presence as PresenceData, now)) {
    return 'CONNECTED';
  }
  return 'TEMPORARILY_DISCONNECTED';
}

/**
 * PRD v1.1 / P0.9: Single authoritative source of truth for room player counters
 */
export function getRoomPlayerCounts(
  players: PlayerData[],
  presences: PresenceData[],
  questionIndex: number,
  now: number
): {
  totalPlayers: number;
  connectedPlayers: number;
  eligiblePlayers: number;
} {
  const nonRemoved = players.filter(p => p.removedAt === null);
  const totalPlayers = nonRemoved.length;
  const connectedPlayers = nonRemoved.filter(p => {
    const pr = presences.find(pres => pres.playerId === p.playerId);
    return pr ? isPlayerActive(pr, now) : false;
  }).length;
  const eligiblePlayers = nonRemoved.filter(p => isPlayerEligible(p, questionIndex)).length;

  return { totalPlayers, connectedPlayers, eligiblePlayers };
}


// ─── Constants ───────────────────────────────────────────────
// PRD-defined constants collected in one place

/** PRD p.4: Maximum active players per room */
export const MAX_PLAYERS_PER_ROOM = 50;

/** Quiz de músculos: default question duration in ms */
export const DEFAULT_QUESTION_DURATION_MS = 20_000;

/** PRD p.9: Speed bonus window in ms (≤10s gets bonus) */
export const SPEED_BONUS_WINDOW_MS = 10_000;

/** PRD p.9: Speed bonus multiplier (25% bonus) */
export const SPEED_BONUS_MULTIPLIER = 1.25;

/** PRD p.7: Countdown duration before question starts */
export const COUNTDOWN_DURATION_MS = 3_000;

/** PRD p.10: Heartbeat interval for presence */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/** Static heartbeat frames handled by the Durable Object auto-response API. */
export const HEARTBEAT_PING_FRAME = 'ping';
export const HEARTBEAT_PONG_FRAME = 'pong';

/** PRD p.10: Presence timeout (inactive after 10s without signal) */
export const PRESENCE_TIMEOUT_MS = 10_000;

/** PRD p.21: Room expires 24h after FINISHED */
export const ROOM_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** Quiz de músculos: total number of questions */
export const TOTAL_QUESTIONS = 15;

/** PRD p.2: PIN length */
export const PIN_LENGTH = 6;

/** PRD FR 005: Nickname min/max length after normalization */
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

/** PRD v1.1: Automatic game loop phase durations */
export const REVEAL_DURATION_MS = 5_000;
export const ROUND_RANKING_DURATION_MS = 5_000;
export const FINAL_RANKING_DURATION_MS = 5_000;
export const PODIUM_DURATION_MS = 10_000;


// ─── Event Envelope ──────────────────────────────────────────
// PRD p.18: Exact envelope structure

export interface EventEnvelope<TType extends string = string, TPayload = unknown> {
  protocolVersion: 1;
  eventId: string;
  type: TType;
  sentAt: number;
  roomVersion: number;
  correlationId?: string;
  payload: TPayload;
}

// ─── Envelope Factory ────────────────────────────────────────

let _counter = 0;

/**
 * Create a server event envelope.
 * eventId is unique per GameRoom instance lifetime.
 */
export function createServerEnvelope<T extends string, P>(
  type: T,
  payload: P,
  roomVersion: number,
  correlationId?: string,
): EventEnvelope<T, P> {
  return {
    protocolVersion: 1,
    eventId: `s_${Date.now()}_${++_counter}`,
    type,
    sentAt: Date.now(),
    roomVersion,
    correlationId,
    payload,
  };
}

/**
 * Create a client event envelope.
 */
export function createClientEnvelope<T extends string, P>(
  type: T,
  payload: P,
  roomVersion: number,
  correlationId?: string,
): EventEnvelope<T, P> {
  return {
    protocolVersion: 1,
    eventId: `c_${Date.now()}_${++_counter}`,
    type,
    sentAt: Date.now(),
    roomVersion,
    correlationId,
    payload,
  };
}

/** Reset counter (for testing only) */
export function _resetEnvelopeCounter(): void {
  _counter = 0;
}

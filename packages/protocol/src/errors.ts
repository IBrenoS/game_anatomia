// ─── Protocol Error Codes ────────────────────────────────────
// PRD p.20: Error codes and client behavior

export const ProtocolError = {
  /** PIN inexistente ou expirado */
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  /** Entradas bloqueadas */
  ROOM_LOCKED: 'ROOM_LOCKED',
  /** Limite de 50 jogadores */
  ROOM_FULL: 'ROOM_FULL',
  /** Nome normalizado já usado */
  NICKNAME_TAKEN: 'NICKNAME_TAKEN',
  /** Comando usa versão antiga */
  STALE_VERSION: 'STALE_VERSION',
  /** Jogador tenta alterar resposta */
  ANSWER_ALREADY_SUBMITTED: 'ANSWER_ALREADY_SUBMITTED',
  /** Resposta fora do estado válido */
  QUESTION_NOT_ACTIVE: 'QUESTION_NOT_ACTIVE',
  /** Resposta chegou após o prazo */
  DEADLINE_EXCEEDED: 'DEADLINE_EXCEEDED',
  /** Token ausente, inválido ou revogado */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Payload malformado ou inválido */
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
} as const;

export type ProtocolError = (typeof ProtocolError)[keyof typeof ProtocolError];

/** Map error codes to human-readable messages */
export const ERROR_MESSAGES: Record<ProtocolError, string> = {
  ROOM_NOT_FOUND: 'Sala não encontrada ou expirada.',
  ROOM_LOCKED: 'As entradas estão bloqueadas.',
  ROOM_FULL: 'A sala atingiu a capacidade máxima.',
  NICKNAME_TAKEN: 'Este apelido já está em uso.',
  STALE_VERSION: 'Estado desatualizado. Atualize e tente novamente.',
  ANSWER_ALREADY_SUBMITTED: 'Você já enviou sua resposta.',
  QUESTION_NOT_ACTIVE: 'Nenhuma questão ativa no momento.',
  DEADLINE_EXCEEDED: 'O tempo para responder encerrou.',
  UNAUTHORIZED: 'Sessão inválida ou expirada.',
  INVALID_PAYLOAD: 'Dados inválidos ou malformados.',
};

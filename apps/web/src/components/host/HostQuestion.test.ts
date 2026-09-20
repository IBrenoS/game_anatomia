import { describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { PublicQuestion } from '@batalha/protocol';
import HostQuestion from './HostQuestion.js';
import { useGameStore } from '../../stores/gameStore.js';

const question: PublicQuestion = {
  id: 'q-host-pause',
  order: 0,
  type: 'function',
  prompt: 'Qual estrutura estabiliza o dorso?',
  options: [
    { id: 'a', label: 'Alternativa A' },
    { id: 'b', label: 'Alternativa B' },
    { id: 'c', label: 'Alternativa C' },
    { id: 'd', label: 'Alternativa D' },
  ],
  durationMs: 60_000,
  basePoints: 100,
  speedBonusWindowMs: 10_000,
  speedBonusMultiplier: 1.25,
};

describe('HostQuestion paused state', () => {
  beforeEach(() => {
    useGameStore.setState({
      roomState: 'PAUSED',
      remainingMs: 19_000,
      answeredCount: 2,
      activeEligiblePlayers: 4,
      distribution: [],
    });
  });

  it('concentra a retomada no modal e preserva a rodada congelada ao fundo', () => {
    const html = renderToString(
      React.createElement(HostQuestion, {
        question,
        currentQuestionIndex: 0,
        startedAt: 1_000,
        deadlineAt: null,
        onResume: () => {},
      }),
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Você pausou a partida. O cronômetro está congelado');
    expect(html).toContain('em 19s.');
    expect(html.match(/aria-label="Retomar Rodada - Retomar Partida"/g)).toHaveLength(1);
    expect(html).not.toContain('Finalizar Partida');
  });
});

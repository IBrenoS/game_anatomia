import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import PlayerQuestion from './PlayerQuestion.js';
import { useGameStore } from '../../stores/gameStore.js';
import type { PublicQuestion } from '@batalha/protocol';

const mockQuestion: PublicQuestion = {
  id: 'q1',
  order: 0,
  type: 'identify',
  prompt: 'Qual é o osso do braço?',
  options: [
    { id: 'opt-a', label: 'Úmero' },
    { id: 'opt-b', label: 'Fêmur' },
    { id: 'opt-c', label: 'Tíbia' },
    { id: 'opt-d', label: 'Rádio' },
  ],
  durationMs: 60000,
  basePoints: 100,
  speedBonusWindowMs: 10_000,
  speedBonusMultiplier: 1.25,
};

describe('PlayerQuestion UI Component (V32-T05A/B/C/D)', () => {
  beforeEach(() => {
    useGameStore.setState({
      roomState: 'QUESTION_ACTIVE',
      answerRejected: null,
      remainingMs: null,
    });
  });

  it('V32-T05A: PAUSED sem resposta mostra banner pausado, desabilita alternativas e NÃO mostra "Resposta registrada!"', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: null,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'PAUSED',
        remainingMs: 45000,
      })
    );

    expect(html).toContain('Partida pausada pelo apresentador');
    expect(html).not.toContain('Resposta registrada!');
    expect(html).not.toContain('Aguarde o encerramento da rodada');
    expect(html).toContain('disabled=""');
  });

  it('V32-T05B: PAUSED com resposta mostra banner pausado, alternativas disabled e "Resposta registrada!"', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: null,
        selectedOptionId: 'opt-a',
        answerSubmitted: true,
        roomState: 'PAUSED',
        remainingMs: 45000,
      })
    );

    expect(html).toContain('Partida pausada pelo apresentador');
    expect(html).toContain('Resposta registrada!');
    expect(html).toContain('Aguarde o encerramento da rodada');
    expect(html).toContain('disabled=""');
  });

  it('V32-T05C: QUESTION_ACTIVE após RESUME sem resposta libera alternativas e não exibe banner de resposta', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: 61000,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'QUESTION_ACTIVE',
        remainingMs: null,
      })
    );

    expect(html).not.toContain('Partida pausada pelo apresentador');
    expect(html).not.toContain('Resposta registrada!');
    expect(html).not.toContain('disabled=""');
  });

  it('V32-T05D: QUESTION_ACTIVE após RESUME com resposta mantém alternativas bloqueadas e "Resposta registrada!"', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: 61000,
        selectedOptionId: 'opt-a',
        answerSubmitted: true,
        roomState: 'QUESTION_ACTIVE',
        remainingMs: null,
      })
    );

    expect(html).not.toContain('Partida pausada pelo apresentador');
    expect(html).toContain('Resposta registrada!');
    expect(html).toContain('disabled=""');
  });

  it('Exibe banner de rejeição e não bloqueia se resposta for rejeitada', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: 61000,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'QUESTION_ACTIVE',
        answerRejected: { code: 'UNAUTHORIZED', message: 'Conexão inválida' },
      })
    );

    expect(html).toContain('Conexão inválida');
    expect(html).not.toContain('Resposta registrada!');
    expect(html).not.toContain('disabled=""');
  });

  it('bloqueia novamente a interação quando uma nova alternativa é selecionada após rejeição', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: 61000,
        selectedOptionId: 'opt-b',
        answerSubmitted: false,
        roomState: 'QUESTION_ACTIVE',
        answerRejected: null,
      })
    );

    expect(html).toContain('Alternativa B: Fêmur');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Resposta registrada!');
  });

  it('exibe o progresso de uma partida com 15 questões', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: 21000,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'QUESTION_ACTIVE',
      })
    );

    expect(html).toContain('Questão 1 de 15');
  });

  it('PAUSED com isHost=true e onResume exibe botão "Retomar Partida" e mensagem voltada ao host', () => {
    const onResume = () => {};
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: null,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'PAUSED',
        remainingMs: 19000,
        isHost: true,
        onResume,
      })
    );

    expect(html).toContain('Partida pausada');
    expect(html).toContain('Você pausou a partida');
    expect(html).toContain('congelado em 19s');
    expect(html).toContain('Retomar Partida');
    expect(html).toContain('aria-label="Retomar Rodada - Retomar Partida"');
    expect(html).not.toContain('Partida pausada pelo apresentador');
  });

  it('PAUSED para participante comum não exibe botão "Retomar Partida"', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: null,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'PAUSED',
        remainingMs: 19000,
        isHost: false,
      })
    );

    expect(html).toContain('Partida pausada');
    expect(html).toContain('Partida pausada pelo apresentador');
    expect(html).toContain('congelado em 19s');
    expect(html).not.toContain('Retomar Partida');
    expect(html).toContain('Rodada suspensa temporariamente');
  });

  it('PAUSED com isHost=true mas sem onResume mantém cópia segura sem instruir clique em botão inexistente', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: null,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'PAUSED',
        remainingMs: 19000,
        isHost: true,
        onResume: undefined,
      })
    );

    expect(html).toContain('Partida pausada');
    expect(html).toContain('Partida pausada pelo apresentador');
    expect(html).not.toContain('Clique no botão abaixo para retomar');
    expect(html).not.toContain('Retomar Partida');
    expect(html).toContain('Rodada suspensa temporariamente');
  });
});

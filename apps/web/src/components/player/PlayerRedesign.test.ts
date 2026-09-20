import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import PlayerLobby from './PlayerLobby.js';
import PlayerCountdown from './PlayerCountdown.js';
import PlayerQuestion from './PlayerQuestion.js';
import PlayerReveal from './PlayerReveal.js';
import PlayerRanking from './PlayerRanking.js';
import PlayerPodium from './PlayerPodium.js';
import PlayerFinished from './PlayerFinished.js';
import ReconnectOverlay from './ReconnectOverlay.js';
import ConnectionRestoredToast from './ConnectionRestoredToast.js';
import HostControls from '../host/HostControls.js';
import { PlayerPage } from '../../pages/PlayerPage.js';
import { HostPage } from '../../pages/HostPage.js';
import { MemoryRouter, Routes, Route } from 'react-router';
import { getWebSocketManager } from '../../lib/ws.js';
import { useGameStore } from '../../stores/gameStore.js';
import type { PublicQuestion, PersonalResult, RankingEntry } from '@batalha/protocol';

const mockBaseQuestion: PublicQuestion = {
  id: 'q-normal',
  order: 0,
  type: 'function',
  prompt: 'Qual é uma das principais funções dos músculos dorsais?',
  options: [
    { id: 'opt-1', label: 'Auxiliar na sustentação e movimentação do dorso' },
    { id: 'opt-2', label: 'Apenas sustentação de órgãos internos' },
    { id: 'opt-3', label: 'Exclusivamente flexão dos membros' },
    { id: 'opt-4', label: 'Movimentação exclusiva dos olhos' },
  ],
  durationMs: 60000,
  basePoints: 200,
  speedBonusWindowMs: 10_000,
  speedBonusMultiplier: 1.25,
};

const mockQuestionWithMedia: PublicQuestion = {
  ...mockBaseQuestion,
  id: 'q-media',
  media: {
    src: '/questions/q1.svg',
    alt: 'Coluna vertebral e musculatura dorsal',
    width: 800,
    height: 600,
  },
};

const mockStressQuestion: PublicQuestion = {
  id: 'q-stress',
  order: 8,
  type: 'identify',
  prompt:
    'Considerando a anatomia comparada de bovinos e equinos, observe a ilustração e identifique qual alternativa descreve corretamente a relação funcional entre a musculatura dorsal, a estabilização da coluna vertebral e a transmissão de forças durante a locomoção.',
  options: [
    {
      id: 'opt-s1',
      label:
        'Atua na extensão, sustentação e estabilização vertebral durante o deslocamento axial e transmissão de forças.',
    },
    {
      id: 'opt-s2',
      label:
        'Sua função limita-se à proteção passiva dos órgãos torácicos e abdominais sem envolvimento motor.',
    },
    {
      id: 'opt-s3',
      label:
        'Participa exclusivamente da flexão distal dos membros anteriores e posteriores sem influência na coluna.',
    },
    {
      id: 'opt-s4',
      label:
        'É responsável apenas por movimentos finos e isolados da cabeça durante o repouso do animal.',
    },
  ],
  durationMs: 60000,
  basePoints: 300,
  speedBonusWindowMs: 10_000,
  speedBonusMultiplier: 1.25,
  media: {
    src: '/questions/q10.svg',
    alt: 'Mapa muscular comparado · bovino x equino',
    width: 800,
    height: 600,
  },
};

describe('Player Surface Redesign — Comprehensive Acceptance Suite', () => {
  beforeEach(() => {
    (useGameStore as any).getInitialState = () => useGameStore.getState();
    useGameStore.setState({
      roomState: 'LOBBY',
      totalPlayers: 4,
      nickname: 'Hsu',
      personalScore: { totalPoints: 575, correctCount: 4, position: 2 },
      rankings: [],
      previousRankings: [],
      answerRejected: null,
      remainingMs: null,
    });
  });

  // P01: Player Lobby
  it('P01: renders Player Lobby with "VOCÊ ESTÁ NA ARENA", player guarantee, and real-time status', () => {
    const html = renderToString(React.createElement(PlayerLobby, { nickname: 'Hsu', totalPlayers: 4 }));

    expect(html).toContain('BATALHA ANATÔMICA');
    expect(html).toContain('BOVINO');
    expect(html).toContain('EQUINO');
    expect(html).toContain('VOCÊ ESTÁ NA ARENA');
    expect(html).toContain('Hsu, sua vaga está garantida.');
    expect(html).toContain('Pronto para a batalha');
    expect(html).toContain('4 jogadores conectados');
    expect(html).toContain('A sala está crescendo em tempo real.');
  });

  // P02: Countdown
  it('P02: renders Countdown with "PRÓXIMA QUESTÃO", circular counter, and guidance', () => {
    useGameStore.setState({
      startedAt: Date.now(),
      deadlineAt: Date.now() + 3000,
    });
    const html = renderToString(React.createElement(PlayerCountdown));

    expect(html).toContain('PRÓXIMA QUESTÃO');
    expect(html).toContain('Fique pronto.');
    expect(html).toContain('Respire.');
    expect(html).toContain('Observe.');
    expect(html).toContain('Responda.');
  });

  // P03: Active Question without Image
  it('P03: renders Question without image with 2x2 desktop grid and 4 color-accented alternatives', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockBaseQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: 61000,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'QUESTION_ACTIVE',
      })
    );

    expect(html).toContain('Questão 1 de 15');
    expect(html).toContain('200 pts');
    expect(html).toContain(mockBaseQuestion.prompt);
    expect(html).toContain('sm:grid-cols-2');
    expect(html).toContain('Alternativa A: Auxiliar na sustentação');
    expect(html).toContain('Alternativa B: Apenas sustentação');
    expect(html).toContain('Alternativa C: Exclusivamente flexão');
    expect(html).toContain('Alternativa D: Movimentação exclusiva');
    expect(html).not.toContain('REFERÊNCIA ANATÔMICA');
  });

  // P04: Active Question with Complementary Image
  it('P04: renders Question with complementary media in 2-column desktop split layout', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestionWithMedia,
        currentQuestionIndex: 3,
        startedAt: 1000,
        deadlineAt: 61000,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'QUESTION_ACTIVE',
        layout: 'complementary',
      })
    );

    expect(html).toContain('REFERÊNCIA ANATÔMICA');
    expect(html).toContain('Coluna vertebral e musculatura dorsal');
    expect(html).toContain('/questions/q1.svg');
    expect(html).toContain('lg:grid-cols-12');
    expect(html).toContain('lg:col-span-5');
    expect(html).toContain('lg:col-span-7');
  });

  // P04B: Desktop Protagonist Layout
  it('P04B: provides wide hero media card with 2x2 grid below on desktop, stacked on mobile', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestionWithMedia,
        currentQuestionIndex: 6,
        startedAt: 1000,
        deadlineAt: 61000,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'QUESTION_ACTIVE',
        protagonist: true,
      })
    );

    // Protagonist has central hero media and 2x2 grid
    expect(html).toContain('REFERÊNCIA ANATÔMICA');
    expect(html).toContain('sm:grid-cols-2');
    expect(html).toContain('Coluna vertebral e musculatura dorsal');
  });

  // P05: Resposta Registrada (Locked Choice, No Spoilers)
  it('P05: displays "Resposta registrada!", locks choices, and shows "Sua escolha" badge without spoilers', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockBaseQuestion,
        currentQuestionIndex: 3,
        startedAt: 1000,
        deadlineAt: 61000,
        selectedOptionId: 'opt-1',
        answerSubmitted: true,
        roomState: 'QUESTION_ACTIVE',
      })
    );

    expect(html).toContain('Resposta registrada!');
    expect(html).toContain('sua escolha já está salva.');
    expect(html).toContain('Sua escolha');
    expect(html).toContain('disabled=""');
    // Does NOT reveal correct answer yet
    expect(html).not.toContain('Gabarito Oficial');
    expect(html).not.toContain('Você acertou');
  });

  // P06: Paused State
  it('P06: displays Paused overlay banner with frozen seconds and preserves question context', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockBaseQuestion,
        currentQuestionIndex: 3,
        startedAt: 1000,
        deadlineAt: null,
        selectedOptionId: 'opt-1',
        answerSubmitted: true,
        roomState: 'PAUSED',
        remainingMs: 31000,
      })
    );

    expect(html).toContain('Partida pausada');
    expect(html).toContain('Rodada pausada');
    expect(html).toContain('Partida pausada pelo apresentador');
    expect(html).toContain('congelado em 31s');
    expect(html).toContain('Quando a rodada voltar, você poderá responder normalmente.');
    expect(html).toContain(mockBaseQuestion.prompt);
  });

  // P07: Feedback Correto
  it('P07: renders Correct Feedback with green confirmation, round points and total', () => {
    const mockResult: PersonalResult = {
      correct: true,
      awardedPoints: 100,
      responseTimeMs: 14000, // No speed bonus (> 10s)
      selectedOptionId: 'opt-2',
    };

    const html = renderToString(
      React.createElement(PlayerReveal, {
        result: mockResult,
        correctOptionId: 'opt-2',
        question: mockBaseQuestion,
      })
    );

    expect(html).toContain('Você acertou.');
    expect(html).toContain('Boa leitura anatômica.');
    expect(html).toContain('+100');
    expect(html).toContain('TOTAL');
    expect(html).not.toContain('BÔNUS DE VELOCIDADE');
  });

  // P08: Feedback Correto + Bônus de Rapidez
  it('P08: renders Correct Feedback with Speed Bonus, golden highlight and breakdown', () => {
    const mockResult: PersonalResult = {
      correct: true,
      awardedPoints: 375,
      responseTimeMs: 1480, // <= 10s => speed bonus
      selectedOptionId: 'opt-1',
    };

    const html = renderToString(
      React.createElement(PlayerReveal, {
        result: mockResult,
        correctOptionId: 'opt-1',
        question: mockBaseQuestion,
      })
    );

    expect(html).toContain('Resposta certeira.');
    expect(html).toContain('1.48s');
    expect(html).toContain('+375');
    expect(html).toContain('BÔNUS DE VELOCIDADE +25%');
    expect(html).toContain('pts por velocidade');
  });

  // P09: Feedback Incorreto
  it('P09: renders Incorrect Feedback with terracotta badge and correct answer card', () => {
    const mockResult: PersonalResult = {
      correct: false,
      awardedPoints: 0,
      responseTimeMs: 4000,
      selectedOptionId: 'opt-3',
    };

    const html = renderToString(
      React.createElement(PlayerReveal, {
        result: mockResult,
        correctOptionId: 'opt-1',
        question: mockBaseQuestion,
      })
    );

    expect(html).toContain('Não foi dessa vez.');
    expect(html).toContain('Confira a resposta correta e siga para a próxima.');
    expect(html).toContain('+0');
    expect(html).toContain('RESPOSTA CORRETA');
    expect(html).toContain('Auxiliar na sustentação e movimentação do dorso');
  });

  // P10: Feedback Tempo Esgotado
  it('P10: renders Timeout Feedback with amber clock and official gabarito', () => {
    const html = renderToString(
      React.createElement(PlayerReveal, {
        result: null,
        correctOptionId: 'opt-1',
        question: mockBaseQuestion,
      })
    );

    expect(html).toContain('O tempo acabou.');
    expect(html).toContain('Você não enviou uma alternativa nesta rodada.');
    expect(html).toContain('GABARITO');
    expect(html).toContain('Pontuação acumulada');
  });

  // P11: Progressão de Ranking — Subiu
  it('P11: renders Ranking Progression (Subiu) with green pill, positions delta and distance', () => {
    const previousRankings = [
      {
        position: 4,
        playerId: 'p1',
        nickname: 'Hsu',
        totalPoints: 400,
        correctCount: 3,
        correctResponseTimeMs: 12000,
        distanceToPrevious: 100,
      },
    ];

    const ranking: RankingEntry = {
      position: 2,
      playerId: 'p1',
      nickname: 'Hsu',
      totalPoints: 575,
      correctCount: 4,
      correctResponseTimeMs: 13480,
      distanceToPrevious: 75,
    };

    const html = renderToString(React.createElement(PlayerRanking, { ranking, isFinal: false, previousRankings }));

    expect(html).toContain('#2');
    expect(html).toContain('Subiu 2 posições');
    expect(html).toContain('75 pts');
    expect(html).toContain('do #1');
    expect(html).toContain('575');
    expect(html).toContain('4 questões corretas');
  });

  // P11B: Progressão de Ranking — Manteve
  it('P11B: renders Ranking Progression (Manteve) with neutral indicator', () => {
    const previousRankings = [
      {
        position: 2,
        playerId: 'p1',
        nickname: 'Hsu',
        totalPoints: 500,
        correctCount: 4,
        correctResponseTimeMs: 12000,
        distanceToPrevious: 50,
      },
    ];

    const ranking: RankingEntry = {
      position: 2,
      playerId: 'p1',
      nickname: 'Hsu',
      totalPoints: 625,
      correctCount: 5,
      correctResponseTimeMs: 14000,
      distanceToPrevious: 75,
    };

    const html = renderToString(React.createElement(PlayerRanking, { ranking, isFinal: false, previousRankings }));

    expect(html).toContain('#2');
    expect(html).toContain('Manteve a posição');
    expect(html).toContain('625');
  });

  // P11C: Progressão de Ranking — Caiu
  it('P11C: renders Ranking Progression (Caiu) with terracotta indicator', () => {
    const previousRankings = [
      {
        position: 2,
        playerId: 'p1',
        nickname: 'Hsu',
        totalPoints: 500,
        correctCount: 4,
        correctResponseTimeMs: 12000,
        distanceToPrevious: 50,
      },
    ];

    const ranking: RankingEntry = {
      position: 4,
      playerId: 'p1',
      nickname: 'Hsu',
      totalPoints: 500,
      correctCount: 4,
      correctResponseTimeMs: 12000,
      distanceToPrevious: 60,
    };

    const html = renderToString(React.createElement(PlayerRanking, { ranking, isFinal: false, previousRankings }));

    expect(html).toContain('#4');
    expect(html).toContain('Caiu 2 posições');
    expect(html).toContain('Próxima posição a');
    expect(html).toContain('60 pts');
  });

  // P12: Liderança (#1)
  it('P12: renders Leadership state with celebratory gold styling and "Assumiu a liderança"', () => {
    const ranking: RankingEntry = {
      position: 1,
      playerId: 'p1',
      nickname: 'Hsu',
      totalPoints: 850,
      correctCount: 7,
      correctResponseTimeMs: 18000,
      distanceToPrevious: 0,
    };

    const html = renderToString(React.createElement(PlayerRanking, { ranking, isFinal: false }));

    expect(html).toContain('#1');
    expect(html).toContain('Assumiu a liderança');
    expect(html).toContain('Você está liderando a batalha');
    expect(html).toContain('Você virou o jogo.');
  });

  // P13: Classificação para Pódio
  it('P13: renders Podium Qualification with trophy, position and ceremony notice', () => {
    const podium: RankingEntry[] = [
      {
        position: 1,
        playerId: 'p-other',
        nickname: 'Alice',
        totalPoints: 950,
        correctCount: 8,
        correctResponseTimeMs: 15000,
        distanceToPrevious: 0,
      },
      {
        position: 2,
        playerId: 'p1',
        nickname: 'Hsu',
        totalPoints: 850,
        correctCount: 7,
        correctResponseTimeMs: 18000,
        distanceToPrevious: 100,
      },
    ];

    const html = renderToString(React.createElement(PlayerPodium, { podium, playerId: 'p1' }));

    expect(html).toContain('CERIMÔNIA FINAL');
    expect(html).toContain('Você está no pódio.');
    expect(html).toContain('2º lugar · 850 pontos');
    expect(html).toContain('A revelação final acontece no telão');
    expect(html).toContain('PREPARE-SE PARA A CELEBRAÇÃO');
  });

  // P14: Resultado Final
  it('P14: renders Final Result with stats grid (position, points, breakdown) and exit CTA', () => {
    const ranking: RankingEntry = {
      position: 2,
      playerId: 'p1',
      nickname: 'Hsu',
      totalPoints: 850,
      correctCount: 7,
      correctResponseTimeMs: 18000,
      distanceToPrevious: 100,
    };

    const html = renderToString(React.createElement(PlayerFinished, { ranking }));

    expect(html).toContain('PARTIDA CONCLUÍDA');
    expect(html).toContain('Sua batalha terminou.');
    expect(html).toContain('Você terminou em 2º lugar com 850 pontos.');
    expect(html).toContain('POSIÇÃO FINAL');
    expect(html).toContain('#2');
    expect(html).toContain('850 pts');
    expect(html).toContain('7 acertos');
    expect(html).toContain('Voltar ao início');
  });

  // P15: Reconectando à Partida
  it('P15: renders ReconnectOverlay as a non-disruptive system modal over battle context', () => {
    const html = renderToString(React.createElement(ReconnectOverlay, { isReconnecting: true }));

    expect(html).toContain('Reconectando à partida...');
    expect(html).toContain('Seu progresso está seguro.');
    expect(html).toContain('Voltamos assim que a conexão responder.');
  });

  // P16: Conexão Restaurada
  it('P16: renders ConnectionRestoredToast with green check and synchronization confirmation', () => {
    const html = renderToString(React.createElement(ConnectionRestoredToast, { show: true }));

    expect(html).toContain('Você voltou à partida');
    expect(html).toContain('Tudo sincronizado. Continue de onde parou.');
  });

  // P17: Long Content Stress Test
  it('P17: renders complex stress-test question with long prompt, long options, and media cleanly', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockStressQuestion,
        currentQuestionIndex: 8,
        startedAt: 1000,
        deadlineAt: 61000,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'QUESTION_ACTIVE',
      })
    );

    expect(html).toContain('Considerando a anatomia comparada de bovinos e equinos');
    expect(html).toContain('Atua na extensão, sustentação e estabilização vertebral');
    expect(html).toContain('Sua função limita-se à proteção passiva dos órgãos');
    expect(html).toContain('Participa exclusivamente da flexão distal dos membros');
    expect(html).toContain('É responsável apenas por movimentos finos e isolados');
    expect(html).toContain('REFERÊNCIA ANATÔMICA');
    expect(html).toContain('Mapa muscular comparado · bovino x equino');
  });

  // P18: Canvas Architecture Verification
  it('P18: gameplay components render directly on ivory canvas without outer screen-in-screen container', () => {
    const questionHtml = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockBaseQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: 61000,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'QUESTION_ACTIVE',
      })
    );
    // Should NOT have the old outer wrapper card
    expect(questionHtml).not.toContain('max-h-[calc(100dvh-4rem)]');
    expect(questionHtml).not.toContain('rounded-3xl p-6 shadow-2xl');

    const countdownHtml = renderToString(React.createElement(PlayerCountdown));
    expect(countdownHtml).not.toContain('rounded-3xl p-6 shadow-2xl');

    const revealHtml = renderToString(
      React.createElement(PlayerReveal, {
        result: { correct: true, awardedPoints: 100, responseTimeMs: 5000, selectedOptionId: 'opt-1' },
        correctOptionId: 'opt-1',
        question: mockBaseQuestion,
      })
    );
    expect(revealHtml).not.toContain('rounded-3xl p-6 shadow-2xl');

    const finishedHtml = renderToString(
      React.createElement(PlayerFinished, {
        ranking: {
          position: 1,
          playerId: 'p1',
          nickname: 'Hsu',
          totalPoints: 850,
          correctCount: 7,
          correctResponseTimeMs: 18000,
          distanceToPrevious: 0,
        },
      })
    );
    expect(finishedHtml).not.toContain('rounded-3xl p-6 shadow-2xl');
  });

  // P19: ReconnectOverlay adaptivity (gameplay vs pregame)
  it('P19: ReconnectOverlay uses soft green translucent veil in gameplay and dark backdrop in pre-game', () => {
    // In gameplay: should NOT have bg-[#080C11]/80
    const gameplayOverlayHtml = renderToString(
      React.createElement(ReconnectOverlay, { isReconnecting: true, isGameplay: true })
    );
    expect(gameplayOverlayHtml).toContain('bg-[#123829]/30');
    expect(gameplayOverlayHtml).not.toContain('bg-[#080C11]/80');

    // In pre-game lobby: should retain dark arena backdrop
    const pregameOverlayHtml = renderToString(
      React.createElement(ReconnectOverlay, { isReconnecting: true, isGameplay: false })
    );
    expect(pregameOverlayHtml).toContain('bg-[#080C11]/80');
  });

  // P20: Mobile Small Responsiveness (Complementary Media Layout)
  it('P20: complementary question layout renders with responsive flex/grid and compact media constraints on mobile', () => {
    const html = renderToString(
      React.createElement(PlayerQuestion, {
        question: mockQuestionWithMedia,
        currentQuestionIndex: 1,
        startedAt: 1000,
        deadlineAt: 61000,
        selectedOptionId: null,
        answerSubmitted: false,
        roomState: 'QUESTION_ACTIVE',
        layout: 'complementary',
      })
    );

    // Complementary layout uses responsive flex-col on mobile and grid on desktop
    expect(html).toContain('flex-1 flex flex-col lg:grid lg:grid-cols-12');
    expect(html).toContain('max-h-[13vh]');
    expect(html).toContain('REFERÊNCIA ANATÔMICA');
  });

  // P21: HostControls Compact Footer
  it('P21: HostControls renders compact local actions and game controls without excessive vertical bulk', () => {
    useGameStore.setState({ connectedPlayers: 3 });
    const html = renderToString(
      React.createElement(HostControls, {
        roomState: 'QUESTION_ACTIVE',
        adminConnectionState: 'connected',
      })
    );

    expect(html).toContain('Som');
    expect(html).toContain('Tela Cheia');
    expect(html).toContain('Pausar');
    expect(html).toContain('Encerrar Questão');
    expect(html).toContain('Finalizar Partida');
    expect(html).toContain('gap-2 sm:gap-3');
  });

  // P22: PlayerPage Shell Architecture (Pre-game renders dark arena shell without gameplay canvas)
  it('P22: PlayerPage pre-game shell renders dark-arena-bg without gameplay-canvas #FAF8F3', () => {
    const playerManager = getWebSocketManager('player') as any;
    playerManager._state = 'connected';

    const pageHtml = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/play/123456'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/play/:pin', element: React.createElement(PlayerPage) })
        )
      )
    );
    expect(pageHtml).toContain('dark-arena-bg');
    expect(pageHtml).not.toContain('gameplay-canvas');
    expect(pageHtml).not.toContain('bg-[#FAF8F3]');
  });

  // P23: HostPage Shell Architecture (Pre-game renders dark arena shell without gameplay canvas)
  it('P23: HostPage pre-game shell renders dark arena background without gameplay-canvas #FAF8F3', () => {
    const hostHtml = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/host/654321'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/host/:pin', element: React.createElement(HostPage) })
        )
      )
    );
    expect(hostHtml).toContain('bg-[#080C11]');
    expect(hostHtml).not.toContain('gameplay-canvas');
    expect(hostHtml).not.toContain('bg-[#FAF8F3]');
  });
});

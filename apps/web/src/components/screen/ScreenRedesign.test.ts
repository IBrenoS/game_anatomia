import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ScreenLobby from './ScreenLobby.js';
import ScreenQuestion from './ScreenQuestion.js';
import ScreenReveal from './ScreenReveal.js';
import ScreenRanking from './ScreenRanking.js';
import ScreenPodium from './ScreenPodium.js';
import ScreenFinished from './ScreenFinished.js';
import QrPanel from './QrPanel.js';
import CountdownDisplay from '../shared/CountdownDisplay.js';
import { ScreenPage } from '../../pages/ScreenPage.js';
import { MemoryRouter, Routes, Route } from 'react-router';
import { useGameStore } from '../../stores/gameStore.js';
import { getWebSocketManager } from '../../lib/ws.js';
import type { PublicQuestion, RankingEntry, OptionDistribution } from '@batalha/protocol';

const mockBaseQuestion: PublicQuestion = {
  id: 'q-normal',
  order: 0,
  type: 'function',
  prompt: 'Qual é a função do músculo trapézio na locomoção comparada?',
  options: [
    { id: 'opt-1', label: 'Elevação e direcionamento cranial da escápula' },
    { id: 'opt-2', label: 'Flexão distal exclusiva dos dígitos' },
    { id: 'opt-3', label: 'Sustentação passiva das vísceras abdominais' },
    { id: 'opt-4', label: 'Rotação medial e pronação dos membros pélvicos' },
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

const mockProtagonistQuestion: PublicQuestion = {
  ...mockBaseQuestion,
  id: 'q-protagonist',
  type: 'identify',
  prompt: 'Identifique a estrutura muscular destacada no espécime equino.',
  media: {
    src: '/questions/q10.svg',
    alt: 'Músculo braquiocefálico em equino',
    width: 800,
    height: 600,
  },
};

const mockStressQuestion: PublicQuestion = {
  id: 'q-stress',
  order: 14,
  type: 'identify',
  prompt:
    'Considerando a anatomia comparada de grandes animais domésticos (bovinos e equinos), identifique qual das alternativas descreve com precisão biomecânica a fixação e a ação sinérgica do músculo serrátil ventral torácico durante o apoio dos membros torácicos e sustentação do tronco.',
  options: [
    {
      id: 'opt-s1',
      label:
        'Origem nas costelas e inserção na fáscia serrata da escápula, formando a principal cinta muscular de sustentação do tronco entre os membros torácicos.',
    },
    {
      id: 'opt-s2',
      label:
        'Fixação nos processos espinhosos lombares com inserção no fêmur, atuando exclusivamente na flexão da pelve durante o salto.',
    },
    {
      id: 'opt-s3',
      label:
        'Origem no arco zigomático com inserção na mandíbula, participando passivamente dos movimentos mastigatórios sem impacto locomotor.',
    },
    {
      id: 'opt-s4',
      label:
        'Inserção unicamente nos tendões flexores profundos da quartela, garantindo o amortecimento elástico passivo.',
    },
  ],
  durationMs: 60000,
  basePoints: 300,
  speedBonusWindowMs: 10_000,
  speedBonusMultiplier: 1.25,
  media: {
    src: '/questions/q7.svg',
    alt: 'Cinta torácica comparada',
    width: 800,
    height: 600,
  },
};

describe('Telão (Public Screen) Redesign — Comprehensive Acceptance Suite', () => {
  beforeEach(() => {
    (useGameStore as any).getInitialState = () => useGameStore.getState();
    useGameStore.setState({
      roomState: 'LOBBY',
      totalPlayers: 4,
      answeredCount: 2,
      activeEligiblePlayers: 4,
      rankings: [],
      previousRankings: [],
      remainingMs: null,
      countdownKind: null,
    });
  });

  // S01: Screen Lobby
  it('S01: renders Screen Lobby in dark arena palette with formatted PIN, large QR panel, and no host controls', () => {
    const players = [
      { playerId: 'p1', nickname: 'Dra. Camila', joinedAt: 1000 },
      { playerId: 'p2', nickname: 'Dr. Lucas', joinedAt: 1005 },
    ];
    const presences = [
      { playerId: 'p1', connected: true },
      { playerId: 'p2', connected: false },
    ];

    const html = renderToString(
      React.createElement(ScreenLobby, { players, presences, pin: '123456' })
    );

    // Identity and branding
    expect(html).toContain('Batalha Anatômica');
    expect(html).toContain('BOVINO');
    expect(html).toContain('EQUINO');
    expect(html).toContain('Arena Pública • Telão');

    // Connection instructions
    expect(html).toContain('Acesse no celular ou navegador');
    expect(html).toContain('123 456'); // Formatted PIN
    expect(html).toContain('Aponte a câmera para entrar');

    // Roster
    expect(html).toContain('Participantes na Arena');
    expect(html).toContain('Dra. Camila');
    expect(html).toContain('Dr. Lucas');

    // No administrative host controls
    expect(html).not.toContain('Iniciar partida');
    expect(html).not.toContain('Remover');
    expect(html).not.toContain('Bloquear entradas');
    expect(html).not.toContain('Liberar entradas');

    // No old blue background
    expect(html).not.toContain('bg-[#1e3a5f]');
    expect(html).not.toContain('text-blue-200');
    expect(html).not.toContain('bg-blue-950');
  });

  // S02: Countdown Screen
  it('S02: renders Screen Countdown in clinical ivory palette with high-contrast digits and guidance', () => {
    useGameStore.setState({
      startedAt: Date.now(),
      deadlineAt: Date.now() + 3000,
      countdownKind: 'NEXT_QUESTION',
    });

    const html = renderToString(
      React.createElement(CountdownDisplay, { mode: 'screen' })
    );

    expect(html).toContain('BATALHA ANATÔMICA');
    expect(html).toContain('Preparação para a Próxima Questão');
    expect(html).toContain('A próxima questão vai começar em instantes!');
    expect(html).not.toContain('bg-blue-950');
    expect(html).not.toContain('text-blue-300');
  });

  it('S02-INITIAL: renders Screen Countdown with match start announcement when countdownKind is INITIAL', () => {
    useGameStore.setState({
      startedAt: Date.now(),
      deadlineAt: Date.now() + 3000,
      countdownKind: 'INITIAL',
    });

    const html = renderToString(
      React.createElement(CountdownDisplay, { mode: 'screen' })
    );

    expect(html).toContain('A Batalha vai começar!');
    expect(html).toContain('Prepare-se para a 1ª questão da arena!');
  });

  it('S02-RESUME: renders Screen Countdown with resume notice when countdownKind is RESUME', () => {
    useGameStore.setState({
      startedAt: Date.now(),
      deadlineAt: Date.now() + 3000,
      countdownKind: 'RESUME',
    });

    const html = renderToString(
      React.createElement(CountdownDisplay, { mode: 'screen' })
    );

    expect(html).toContain('Retomando Partida!');
    expect(html).toContain('A rodada continuará de onde parou!');
  });

  // S03: Question without Media
  it('S03: renders Question without media in 2x2 grid with design system tokens and high distance readability', () => {
    useGameStore.setState({
      answeredCount: 3,
      activeEligiblePlayers: 4,
      roomState: 'QUESTION_ACTIVE',
    });

    const html = renderToString(
      React.createElement(ScreenQuestion, {
        question: mockBaseQuestion,
        currentQuestionIndex: 0,
        startedAt: 1000,
        deadlineAt: 61000,
      })
    );

    // Header bar
    expect(html).toContain('Questão 1 de 15');
    expect(html).toContain('200 pts');
    expect(html).toContain('3');
    expect(html).toContain('4 responderam');

    // Prompt & 2x2 Grid
    expect(html).toContain(mockBaseQuestion.prompt);
    expect(html).toContain('md:grid-cols-2');
    expect(html).toContain('Elevação e direcionamento cranial da escápula');
    expect(html).toContain('Flexão distal exclusiva dos dígitos');

    // Color tokens
    expect(html).toContain('border-l-[#3B68A6]');
    expect(html).toContain('border-l-[#C95A34]');
    expect(html).toContain('border-l-[#2D8058]');
    expect(html).toContain('border-l-[#7A4C80]');

    // No old saturated blocks
    expect(html).not.toContain('bg-blue-600 border-blue-400');
  });

  // S04: Question with Complementary Media
  it('S04: renders Question with complementary media in 2-column widescreen split layout', () => {
    useGameStore.setState({
      answeredCount: 1,
      activeEligiblePlayers: 4,
      roomState: 'QUESTION_ACTIVE',
    });

    const html = renderToString(
      React.createElement(ScreenQuestion, {
        question: mockQuestionWithMedia,
        currentQuestionIndex: 2,
        startedAt: 1000,
        deadlineAt: 61000,
      })
    );

    expect(html).toContain('REFERÊNCIA ANATÔMICA');
    expect(html).toContain('Coluna vertebral e musculatura dorsal');
    expect(html).toContain('/questions/q1.svg');
    expect(html).toContain('col-span-12 lg:col-span-5');
    expect(html).toContain('col-span-12 lg:col-span-7');
  });

  // S05: Question with Protagonist Media
  it('S05: renders Question with protagonist media in central hero layout with 2x2 grid below', () => {
    useGameStore.setState({
      answeredCount: 2,
      activeEligiblePlayers: 4,
      roomState: 'QUESTION_ACTIVE',
    });

    const html = renderToString(
      React.createElement(ScreenQuestion, {
        question: mockProtagonistQuestion,
        currentQuestionIndex: 9,
        startedAt: 1000,
        deadlineAt: 61000,
      })
    );

    expect(html).toContain('REFERÊNCIA ANATÔMICA');
    expect(html).toContain('Músculo braquiocefálico em equino');
    expect(html).toContain('max-h-[36vh]');
    expect(html).toContain(mockProtagonistQuestion.prompt);
  });

  // S06: Desafio Final (Final Question Badge)
  it('S06: highlights Desafio Final (Question 15) with golden badge on Telão', () => {
    const html = renderToString(
      React.createElement(ScreenQuestion, {
        question: mockBaseQuestion,
        currentQuestionIndex: 14,
        startedAt: 1000,
        deadlineAt: 61000,
      })
    );

    expect(html).toContain('DESAFIO FINAL (300 PTS)');
    expect(html).toContain('Questão 15 de 15');
  });

  // S07: Paused State
  it('S07: freezes timer and displays paused banner while keeping question and alternatives visible', () => {
    useGameStore.setState({
      roomState: 'PAUSED',
      remainingMs: 25000,
      answeredCount: 2,
      activeEligiblePlayers: 4,
    });

    const html = renderToString(
      React.createElement(ScreenQuestion, {
        question: mockBaseQuestion,
        currentQuestionIndex: 4,
        startedAt: 1000,
        deadlineAt: null,
      })
    );

    expect(html).toContain('Partida pausada — cronômetro congelado');
    expect(html).toContain('25s');
    expect(html).toContain(mockBaseQuestion.prompt);
    expect(html).toContain('Elevação e direcionamento cranial da escápula');
    // Read-only: no host resume button
    expect(html).not.toContain('Retomar Partida');
  });

  // S07-ALL-ANSWERED: All players answered notice
  it('S07-ALL-ANSWERED: displays green badge and banner when all active eligible participants have answered', () => {
    useGameStore.setState({
      roomState: 'QUESTION_ACTIVE',
      answeredCount: 4,
      activeEligiblePlayers: 4,
    });

    const html = renderToString(
      React.createElement(ScreenQuestion, {
        question: mockBaseQuestion,
        currentQuestionIndex: 1,
        startedAt: 1000,
        deadlineAt: 61000,
      })
    );

    expect(html).toContain('✓ Todos responderam (4/4)');
    expect(html).toContain('✓ Todos os participantes já responderam! Aguardando revelação do gabarito...');
  });

  // S08: Answer Reveal
  it('S08: highlights correct answer in green, recedes incorrect ones, and displays vote counts/percentages', () => {
    const distribution: OptionDistribution[] = [
      { optionId: 'opt-1', count: 18, percentage: 75 },
      { optionId: 'opt-2', count: 4, percentage: 17 },
      { optionId: 'opt-3', count: 2, percentage: 8 },
      { optionId: 'opt-4', count: 0, percentage: 0 },
    ];

    const html = renderToString(
      React.createElement(ScreenReveal, {
        question: mockBaseQuestion,
        distribution,
        correctOptionId: 'opt-1',
        explanation: null,
      })
    );

    // Header badge
    expect(html).toContain('Gabarito Oficial da Pergunta');

    // Correct option highlights
    expect(html).toContain('border-[#2D8058]');
    expect(html).toContain('✓ CORRETA');
    expect(html).toContain('18');
    expect(html).toContain('(75%)');

    // Incorrect option receding
    expect(html).toContain('opacity-60');
    expect(html).toContain('4');
    expect(html).toContain('(17%)');

    // No old blue styling
    expect(html).not.toContain('bg-blue-950');
    expect(html).not.toContain('bg-blue-600');
  });

  // S09: Answer Reveal with Didactic Explanation
  it('S09: displays didactic explanation when provided', () => {
    const distribution: OptionDistribution[] = [
      { optionId: 'opt-1', count: 10, percentage: 100 },
    ];

    const html = renderToString(
      React.createElement(ScreenReveal, {
        question: mockBaseQuestion,
        distribution,
        correctOptionId: 'opt-1',
        explanation:
          'O músculo trapézio atua tracionando e elevando a escápula, sendo fundamental para o passo cranial do membro.',
      })
    );

    expect(html).toContain('Explicação Didática');
    expect(html).toContain(
      'O músculo trapézio atua tracionando e elevando a escápula'
    );
  });

  // S08-MEDIA: Answer Reveal with Media preserves anatomical reference card
  it('S08-MEDIA: preserves anatomical reference media card in ScreenReveal for pedagogical continuity', () => {
    const distribution: OptionDistribution[] = [
      { optionId: 'opt-1', count: 12, percentage: 80 },
      { optionId: 'opt-2', count: 3, percentage: 20 },
    ];

    const html = renderToString(
      React.createElement(ScreenReveal, {
        question: mockQuestionWithMedia,
        distribution,
        correctOptionId: 'opt-1',
        explanation: 'Fixação dorsal do músculo trapézio.',
      })
    );

    // Anatomical media is preserved in reveal state
    expect(html).toContain('REFERÊNCIA ANATÔMICA');
    expect(html).toContain('Gabarito Ilustrado');
    expect(html).toContain('/questions/q1.svg');
    expect(html).toContain('Coluna vertebral e musculatura dorsal');
    expect(html).toContain('✓ CORRETA');
    expect(html).toContain('Explicação Didática');
  });

  // S10: Collective Round Ranking (Top 5)
  it('S10: renders Top 5 round ranking with position badges, deltas, and distance on ivory canvas', () => {
    useGameStore.setState({
      previousRankings: [
        {
          position: 3,
          playerId: 'p1',
          nickname: 'Dra. Beatriz',
          totalPoints: 400,
          correctCount: 2,
          correctResponseTimeMs: 10000,
          distanceToPrevious: 50,
        },
        {
          position: 1,
          playerId: 'p2',
          nickname: 'Dr. Pedro',
          totalPoints: 500,
          correctCount: 3,
          correctResponseTimeMs: 8000,
          distanceToPrevious: 0,
        },
      ],
    });

    const rankings: RankingEntry[] = [
      {
        position: 1,
        playerId: 'p1',
        nickname: 'Dra. Beatriz',
        totalPoints: 650,
        correctCount: 3,
        correctResponseTimeMs: 12000,
        distanceToPrevious: 0,
      },
      {
        position: 2,
        playerId: 'p2',
        nickname: 'Dr. Pedro',
        totalPoints: 500,
        correctCount: 3,
        correctResponseTimeMs: 8000,
        distanceToPrevious: 150,
      },
      {
        position: 3,
        playerId: 'p3',
        nickname: 'Dra. Sofia',
        totalPoints: 450,
        correctCount: 2,
        correctResponseTimeMs: 14000,
        distanceToPrevious: 50,
      },
    ];

    const html = renderToString(
      React.createElement(ScreenRanking, { rankings, isFinal: false })
    );

    expect(html).toContain('Classificação da Rodada');
    expect(html).toContain('Top 5 da Batalha');

    // 1st place gold highlight
    expect(html).toContain('#1');
    expect(html).toContain('Dra. Beatriz');
    expect(html).toContain('650 pts');
    expect(html).toContain('🔺 +2'); // Rose from 3rd to 1st

    // 2nd place
    expect(html).toContain('#2');
    expect(html).toContain('Dr. Pedro');
    expect(html).toContain('-150 pts do #1');
    expect(html).toContain('🔻 -1'); // Dropped from 1st to 2nd

    // 3rd place
    expect(html).toContain('#3');
    expect(html).toContain('Dra. Sofia');

    // No old blue styling
    expect(html).not.toContain('bg-blue-950');
    expect(html).not.toContain('text-blue-200');
  });

  // S11: Final Ranking Title
  it('S11: displays "Resultado Geral" and "Classificação Final" when isFinal is true', () => {
    const rankings: RankingEntry[] = [
      {
        position: 1,
        playerId: 'p1',
        nickname: 'Campeão',
        totalPoints: 900,
        correctCount: 8,
        correctResponseTimeMs: 15000,
        distanceToPrevious: 0,
      },
    ];

    const html = renderToString(
      React.createElement(ScreenRanking, { rankings, isFinal: true })
    );

    expect(html).toContain('Resultado Geral');
    expect(html).toContain('🏆 Classificação Final');
  });

  // S12: Podium Ceremony
  it('S12: renders Podium on clinical ivory canvas with metallic gradients and ceremony header', () => {
    const podium: RankingEntry[] = [
      {
        position: 1,
        playerId: 'p1',
        nickname: 'Beatriz',
        totalPoints: 1200,
        correctCount: 9,
        correctResponseTimeMs: 14000,
        distanceToPrevious: 0,
      },
      {
        position: 2,
        playerId: 'p2',
        nickname: 'Lucas',
        totalPoints: 950,
        correctCount: 8,
        correctResponseTimeMs: 16000,
        distanceToPrevious: 250,
      },
      {
        position: 3,
        playerId: 'p3',
        nickname: 'Mariana',
        totalPoints: 800,
        correctCount: 7,
        correctResponseTimeMs: 18000,
        distanceToPrevious: 150,
      },
    ];

    const html = renderToString(React.createElement(ScreenPodium, { podium, initialStep: 3 }));

    expect(html).toContain('Cerimônia Oficial de Encerramento');
    expect(html).toContain('🏆 PÓDIO DOS CAMPEÕES');
    expect(html).toContain('Beatriz');
    expect(html).toContain('Lucas');
    expect(html).toContain('Mariana');
    expect(html).toContain('Parabéns a todos os participantes da Batalha Anatômica!');

    // Does NOT contain the old blue gradient
    expect(html).not.toContain('from-blue-900 via-[#1e3a5f] to-black');

    // Unrevealed state (initialStep = 0) shows placeholder dots
    const htmlUnrevealed = renderToString(React.createElement(ScreenPodium, { podium, initialStep: 0 }));
    expect(htmlUnrevealed).toContain('...');
  });

  it('S12-EMPTY: renders graceful preparation state when podium data is empty instead of blank null', () => {
    const htmlEmpty = renderToString(React.createElement(ScreenPodium, { podium: [] }));
    expect(htmlEmpty).toContain('Preparando cerimônia do pódio...');
  });

  it('S12-TIE: safely falls back to index access when positions have irregular or tied values', () => {
    const tiedPodium: RankingEntry[] = [
      {
        position: 1,
        playerId: 'p1',
        nickname: 'Campeão A',
        totalPoints: 1000,
        correctCount: 10,
        correctResponseTimeMs: 15000,
        distanceToPrevious: 0,
      },
      {
        position: 1, // Tied position 1
        playerId: 'p2',
        nickname: 'Campeão B',
        totalPoints: 1000,
        correctCount: 10,
        correctResponseTimeMs: 15000,
        distanceToPrevious: 0,
      },
      {
        position: 3,
        playerId: 'p3',
        nickname: 'Terceiro',
        totalPoints: 800,
        correctCount: 8,
        correctResponseTimeMs: 18000,
        distanceToPrevious: 200,
      },
    ];

    const htmlTied = renderToString(React.createElement(ScreenPodium, { podium: tiedPodium, initialStep: 3 }));
    expect(htmlTied).toContain('Campeão A');
    expect(htmlTied).toContain('Campeão B');
    expect(htmlTied).toContain('Terceiro');
  });

  // S13: Solo and 2-Player Podium
  it('S13: handles 1-player and 2-player podium without throwing or breaking layout', () => {
    const soloPodium: RankingEntry[] = [
      {
        position: 1,
        playerId: 'p1',
        nickname: 'Campeão Solitário',
        totalPoints: 500,
        correctCount: 5,
        correctResponseTimeMs: 10000,
        distanceToPrevious: 0,
      },
    ];

    const htmlSolo = renderToString(React.createElement(ScreenPodium, { podium: soloPodium, initialStep: 3 }));
    expect(htmlSolo).toContain('Campeão');
    expect(htmlSolo).toContain('Campeão Solitário');

    const twoPodium: RankingEntry[] = [
      ...soloPodium,
      {
        position: 2,
        playerId: 'p2',
        nickname: 'Vice',
        totalPoints: 400,
        correctCount: 4,
        correctResponseTimeMs: 12000,
        distanceToPrevious: 100,
      },
    ];
    const htmlTwo = renderToString(React.createElement(ScreenPodium, { podium: twoPodium, initialStep: 3 }));
    expect(htmlTwo).toContain('PÓDIO DOS CAMPEÕES');
    expect(htmlTwo).toContain('Vice');
  });

  // S14: Game Finished
  it('S14: renders ScreenFinished with celebratory conclusion and no host buttons', () => {
    const html = renderToString(React.createElement(ScreenFinished));

    expect(html).toContain('BATALHA ANATÔMICA');
    expect(html).toContain('Fim de Jogo!');
    expect(html).toContain('Medicina Veterinária • Anatomia Comparada');
    expect(html).not.toContain('Reiniciar');
    expect(html).not.toContain('Nova Partida');
  });

  // S15: ScreenPage Shell Dynamic Background Architecture
  it('S15: ScreenPage shell uses dark arena background during pre-game lobby and ivory gameplay-canvas during gameplay', () => {
    const screenManager = getWebSocketManager('screen') as any;
    screenManager._state = 'connected';

    // 1. In Lobby: Pre-game dark arena
    useGameStore.setState({ roomState: 'LOBBY', totalPlayers: 4 });
    const lobbyHtml = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/screen/123456'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/screen/:pin', element: React.createElement(ScreenPage) })
        )
      )
    );
    expect(lobbyHtml).toContain('dark-arena-bg');
    expect(lobbyHtml).toContain('bg-[#080C11]');
    expect(lobbyHtml).not.toContain('gameplay-canvas');
    expect(lobbyHtml).not.toContain('bg-[#1e3a5f]');

    // 2. In Question Active: Gameplay ivory canvas
    useGameStore.setState({
      roomState: 'QUESTION_ACTIVE',
      currentQuestion: mockBaseQuestion,
      currentQuestionIndex: 0,
      startedAt: 1000,
      deadlineAt: 61000,
    });
    const questionHtml = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/screen/123456'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/screen/:pin', element: React.createElement(ScreenPage) })
        )
      )
    );
    expect(questionHtml).toContain('gameplay-canvas');
    expect(questionHtml).toContain('bg-[#FAF8F3]');
    expect(questionHtml).not.toContain('dark-arena-bg');
    expect(questionHtml).not.toContain('bg-[#1e3a5f]');

    // 3. In Finished: Gameplay ivory canvas
    useGameStore.setState({ roomState: 'FINISHED' });
    const finishedHtml = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/screen/123456'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/screen/:pin', element: React.createElement(ScreenPage) })
        )
      )
    );
    expect(finishedHtml).toContain('gameplay-canvas');
    expect(finishedHtml).toContain('Fim de Jogo!');
  });

  // S16: Non-disruptive Reconnection
  it('S16: maintains snapshot view and displays non-disruptive banner when reconnecting during active battle', () => {
    const screenManager = getWebSocketManager('screen') as any;
    screenManager._state = 'connecting';

    useGameStore.setState({
      roomState: 'QUESTION_ACTIVE',
      currentQuestion: mockBaseQuestion,
      currentQuestionIndex: 1,
      startedAt: 1000,
      deadlineAt: 61000,
    });

    const html = renderToString(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/screen/123456'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/screen/:pin', element: React.createElement(ScreenPage) })
        )
      )
    );

    // Preserves question content
    expect(html).toContain(mockBaseQuestion.prompt);
    // Non-disruptive banner
    expect(html).toContain('Reconectando ao Telão da Arena...');
  });

  // S17: Stress Test with Long Anatomical Texts
  it('S17: renders complex stress-test question cleanly with long prompt, long options, and media', () => {
    useGameStore.setState({
      answeredCount: 4,
      activeEligiblePlayers: 4,
      roomState: 'QUESTION_ACTIVE',
    });

    const html = renderToString(
      React.createElement(ScreenQuestion, {
        question: mockStressQuestion,
        currentQuestionIndex: 13,
        startedAt: 1000,
        deadlineAt: 61000,
      })
    );

    expect(html).toContain('Considerando a anatomia comparada de grandes animais');
    expect(html).toContain('Origem nas costelas e inserção na fáscia serrata da escápula');
    expect(html).toContain('Fixação nos processos espinhosos lombares');
    expect(html).toContain('Origem no arco zigomático');
    expect(html).toContain('Inserção unicamente nos tendões flexores profundos');
    expect(html).toContain('REFERÊNCIA ANATÔMICA');
  });

  // S18: QrPanel renders dark QR colors and high-contrast label
  it('S18: QrPanel renders with dark arena color tokens and projection scale', () => {
    const html = renderToString(React.createElement(QrPanel, { pin: '654321' }));
    expect(html).toContain('Aponte a câmera para entrar');
  });
});

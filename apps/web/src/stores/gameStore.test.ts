import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';

describe('useGameStore handleSnapshot convergence across game states', () => {
  beforeEach(() => {
    useGameStore.getState().resetStore();
  });

  it('converges correctly in LOBBY state', () => {
    // Dirty state from prior game
    useGameStore.setState({
      roomState: 'QUESTION_ACTIVE',
      currentQuestionIndex: 2,
      currentQuestion: { id: 'q2', title: 'Q2', options: [], durationMs: 20000, basePoints: 1000 } as any,
      selectedOptionId: 'opt-b',
      answerSubmitted: true,
      answerAcceptedAt: 12345,
      personalResult: { correct: true, selectedOptionId: 'opt-b', awardedPoints: 1000, responseTimeMs: 2000 },
      correctOptionId: 'opt-b',
      explanation: 'Old explanation',
    });

    // Foreground snapshot in LOBBY
    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'LOBBY',
        roomVersion: 1,
        entryLocked: false,
        currentQuestionIndex: -1,
      },
      currentQuestion: null,
      players: [{ playerId: 'p1', nickname: 'Alice', joinedAt: 1000, eligibleFromQuestion: 0 }],
      presences: [{ playerId: 'p1', connected: true }],
      personalAnswers: [],
    });

    const state = useGameStore.getState();
    expect(state.roomState).toBe('LOBBY');
    expect(state.currentQuestion).toBeNull();
    expect(state.selectedOptionId).toBeNull();
    expect(state.answerSubmitted).toBe(false);
    expect(state.answerAcceptedAt).toBeNull();
    expect(state.personalResult).toBeNull();
    expect(state.correctOptionId).toBeNull();
    expect(state.explanation).toBeNull();
  });

  it('converges correctly in QUESTION_ACTIVE when player has NOT answered yet', () => {
    // Player was in Question 0 and answered
    useGameStore.setState({
      playerId: 'p1',
      roomState: 'QUESTION_REVEAL',
      currentQuestionIndex: 0,
      currentQuestion: { id: 'q0', title: 'Q0', options: [], durationMs: 20000, basePoints: 1000 } as any,
      selectedOptionId: 'opt-a',
      answerSubmitted: true,
      personalResult: { correct: true, selectedOptionId: 'opt-a', awardedPoints: 1000, responseTimeMs: 1500 },
    });

    // Background occurred, host advanced to Question 1. Player returns to foreground.
    const activeQuestion = {
      id: 'q1',
      index: 1,
      totalQuestions: 10,
      title: 'Qual osso forma a fronte?',
      options: [{ id: 'opt-1', label: 'Osso frontal' }, { id: 'opt-2', label: 'Osso parietal' }],
      durationMs: 20000,
      basePoints: 1000,
    };

    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'QUESTION_ACTIVE',
        roomVersion: 10,
        entryLocked: true,
        currentQuestionIndex: 1,
      },
      currentQuestion: activeQuestion,
      round: { startedAt: 100000, deadlineAt: 120000 },
      playerId: 'p1',
      personalAnswers: [
        { questionId: 'q0', optionId: 'opt-a', correct: true, awardedPoints: 1000, responseTimeMs: 1500 },
      ],
      personalScore: { totalPoints: 1000, correctCount: 1, position: 1 },
      rankings: [{ playerId: 'p1', nickname: 'Alice', totalPoints: 1000, correctCount: 1, position: 1, distanceToPrevious: 0 }],
    });

    const state = useGameStore.getState();
    expect(state.roomState).toBe('QUESTION_ACTIVE');
    expect(state.currentQuestion?.id).toBe('q1');
    // Crucial: answers from q0 must NOT lock q1!
    expect(state.selectedOptionId).toBeNull();
    expect(state.answerSubmitted).toBe(false);
    expect(state.personalResult).toBeNull();
    expect(state.correctOptionId).toBeNull();
    expect(state.explanation).toBeNull();
    expect(state.startedAt).toBe(100000);
    expect(state.deadlineAt).toBe(120000);
  });

  it('converges correctly in QUESTION_ACTIVE when player ALREADY answered', () => {
    useGameStore.setState({ playerId: 'p1' });

    const activeQuestion = {
      id: 'q1',
      index: 1,
      totalQuestions: 10,
      title: 'Pergunta ativa',
      options: [{ id: 'opt-1', label: 'A' }, { id: 'opt-2', label: 'B' }],
      durationMs: 20000,
      basePoints: 1000,
    };

    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'QUESTION_ACTIVE',
        roomVersion: 11,
        entryLocked: true,
        currentQuestionIndex: 1,
      },
      currentQuestion: activeQuestion,
      round: { startedAt: 100000, deadlineAt: 120000 },
      playerId: 'p1',
      personalAnswers: [
        { questionId: 'q1', optionId: 'opt-2', receivedAt: 105000, correct: true, awardedPoints: 1000, responseTimeMs: 5000 },
      ],
    });

    const state = useGameStore.getState();
    expect(state.roomState).toBe('QUESTION_ACTIVE');
    expect(state.currentQuestion?.id).toBe('q1');
    expect(state.selectedOptionId).toBe('opt-2');
    expect(state.answerSubmitted).toBe(true);
    expect(state.answerAcceptedAt).toBe(105000);
    // Even though answered, during ACTIVE question, personalResult and correctOptionId remain hidden
    expect(state.personalResult).toBeNull();
    expect(state.correctOptionId).toBeNull();
  });

  it('converges correctly in QUESTION_REVEAL with player result', () => {
    useGameStore.setState({ playerId: 'p1' });

    const revealQuestion = {
      id: 'q1',
      title: 'Pergunta revelada',
      options: [{ id: 'opt-1', label: 'A' }, { id: 'opt-2', label: 'B' }],
      correctOptionId: 'opt-2',
      explanation: 'B é a resposta correta',
    };

    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'QUESTION_REVEAL',
        roomVersion: 15,
        entryLocked: true,
        currentQuestionIndex: 1,
      },
      currentQuestion: revealQuestion,
      correctOptionId: 'opt-2',
      explanation: 'B é a resposta correta',
      distribution: [
        { optionId: 'opt-1', count: 0, percentage: 0 },
        { optionId: 'opt-2', count: 1, percentage: 100 },
      ],
      playerId: 'p1',
      personalResult: {
        correct: true,
        selectedOptionId: 'opt-2',
        awardedPoints: 1250,
        responseTimeMs: 3200,
      },
      personalScore: { totalPoints: 1250, correctCount: 1, position: 1 },
      personalAnswers: [
        { questionId: 'q1', optionId: 'opt-2', receivedAt: 103200, correct: true, awardedPoints: 1250, responseTimeMs: 3200 },
      ],
    });

    const state = useGameStore.getState();
    expect(state.roomState).toBe('QUESTION_REVEAL');
    expect(state.correctOptionId).toBe('opt-2');
    expect(state.explanation).toBe('B é a resposta correta');
    expect(state.distribution).toHaveLength(2);
    expect(state.personalResult).toEqual({
      correct: true,
      selectedOptionId: 'opt-2',
      awardedPoints: 1250,
      responseTimeMs: 3200,
    });
    expect(state.selectedOptionId).toBe('opt-2');
    expect(state.answerSubmitted).toBe(true);
    expect(state.personalScore.totalPoints).toBe(1250);
  });

  it('converges correctly in QUESTION_REVEAL when player timed out (no answer submitted)', () => {
    useGameStore.setState({ playerId: 'p1' });

    const revealQuestion = {
      id: 'q1',
      title: 'Pergunta revelada',
      options: [{ id: 'opt-1', label: 'A' }, { id: 'opt-2', label: 'B' }],
      correctOptionId: 'opt-1',
      explanation: 'A é correta',
    };

    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'QUESTION_REVEAL',
        roomVersion: 15,
        entryLocked: true,
        currentQuestionIndex: 1,
      },
      currentQuestion: revealQuestion,
      correctOptionId: 'opt-1',
      explanation: 'A é correta',
      playerId: 'p1',
      personalResult: {
        correct: false,
        selectedOptionId: '',
        awardedPoints: 0,
        responseTimeMs: 0,
      },
      personalAnswers: [],
    });

    const state = useGameStore.getState();
    expect(state.roomState).toBe('QUESTION_REVEAL');
    expect(state.correctOptionId).toBe('opt-1');
    expect(state.personalResult?.correct).toBe(false);
    expect(state.personalResult?.selectedOptionId).toBe('');
    expect(state.answerSubmitted).toBe(false);
  });

  it('converges correctly in ROUND_RANKING with leaderboards', () => {
    useGameStore.setState({ playerId: 'p2' });

    const rankings = [
      { playerId: 'p1', nickname: 'Alice', totalPoints: 1250, correctCount: 1, position: 1, distanceToPrevious: 0 },
      { playerId: 'p2', nickname: 'Bob', totalPoints: 800, correctCount: 1, position: 2, distanceToPrevious: 450 },
    ];

    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'ROUND_RANKING',
        roomVersion: 18,
        entryLocked: true,
        currentQuestionIndex: 1,
      },
      playerId: 'p2',
      rankings,
      personalScore: { totalPoints: 800, correctCount: 1, position: 2 },
      isFinalRanking: false,
    });

    const state = useGameStore.getState();
    expect(state.roomState).toBe('ROUND_RANKING');
    expect(state.rankings).toHaveLength(2);
    expect(state.personalScore).toEqual({
      totalPoints: 800,
      correctCount: 1,
      position: 2,
    });
    expect(state.isFinalRanking).toBe(false);
  });

  it('discards stale snapshot when incoming roomVersion is older than current roomVersion', () => {
    useGameStore.setState({
      roomState: 'QUESTION_REVEAL',
      roomVersion: 20,
    });

    // Stale snapshot with version 15 arrives
    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'QUESTION_ACTIVE',
        roomVersion: 15,
        entryLocked: true,
        currentQuestionIndex: 0,
      },
      currentQuestion: null,
    });

    const state = useGameStore.getState();
    // Must remain on version 20 and QUESTION_REVEAL!
    expect(state.roomState).toBe('QUESTION_REVEAL');
    expect(state.roomVersion).toBe(20);
  });

  it('recovers player nickname from players array when state.nickname is null', () => {
    useGameStore.setState({
      playerId: 'p1',
      nickname: null,
    });

    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'LOBBY',
        roomVersion: 5,
        entryLocked: false,
        currentQuestionIndex: -1,
      },
      players: [
        { playerId: 'p1', nickname: 'RecoveredUser', joinedAt: 1000, eligibleFromQuestion: 0 },
      ],
      playerId: 'p1',
    });

    const state = useGameStore.getState();
    expect(state.nickname).toBe('RecoveredUser');
  });

  it('preserves previousRankings when new rankings arrive via snapshot', () => {
    const initialRankings = [
      { playerId: 'p1', nickname: 'Alice', totalPoints: 1000, correctCount: 1, position: 1, distanceToPrevious: 0, correctResponseTimeMs: 1500 },
    ];
    useGameStore.setState({
      playerId: 'p1',
      rankings: initialRankings,
      previousRankings: [],
    });

    const updatedRankings = [
      { playerId: 'p2', nickname: 'Bob', totalPoints: 1200, correctCount: 1, position: 1, distanceToPrevious: 0, correctResponseTimeMs: 1200 },
      { playerId: 'p1', nickname: 'Alice', totalPoints: 1000, correctCount: 1, position: 2, distanceToPrevious: 200, correctResponseTimeMs: 1500 },
    ];

    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'ROUND_RANKING',
        roomVersion: 12,
        entryLocked: true,
        currentQuestionIndex: 1,
      },
      playerId: 'p1',
      rankings: updatedRankings,
    });

    const state = useGameStore.getState();
    expect(state.rankings).toEqual(updatedRankings);
    expect(state.previousRankings).toEqual(initialRankings);
  });

  it('synchronizes countdown timestamps when converging in COUNTDOWN state', () => {
    useGameStore.setState({
      roomState: 'LOBBY',
      countdownStartedAt: null,
    });

    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'COUNTDOWN',
        roomVersion: 4,
        entryLocked: true,
        currentQuestionIndex: -1,
      },
    });

    const state = useGameStore.getState();
    expect(state.roomState).toBe('COUNTDOWN');
    expect(state.countdownStartedAt).toBeTypeOf('number');
    expect(state.startedAt).toBeTypeOf('number');
    expect(state.deadlineAt).toBeTypeOf('number');
    expect(state.deadlineAt!).toBeGreaterThan(state.startedAt!);
  });

  it('T35/T37: uses authoritative paused and resume timing from snapshot', () => {
    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'PAUSED',
        roomVersion: 20,
        entryLocked: true,
        currentQuestionIndex: 0,
      },
      gameState: 'PAUSED',
      phaseStartedAt: 50_000,
      phaseDeadlineAt: null,
      remainingMs: 42_000,
      question: { id: 'q1', options: [], durationMs: 60_000 },
      questionVersion: 0,
      answerSubmitted: true,
      selectedOptionId: 'a',
    });

    let state = useGameStore.getState();
    expect(state.roomState).toBe('PAUSED');
    expect(state.remainingMs).toBe(42_000);
    expect(state.deadlineAt).toBeNull();
    expect(state.answerSubmitted).toBe(true);
    expect(state.selectedOptionId).toBe('a');

    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'COUNTDOWN',
        roomVersion: 21,
        entryLocked: true,
        currentQuestionIndex: 0,
      },
      gameState: 'COUNTDOWN',
      phaseStartedAt: 60_000,
      phaseDeadlineAt: 63_000,
      countdownKind: 'RESUME',
      question: { id: 'q1', options: [], durationMs: 60_000 },
      questionVersion: 0,
      answerSubmitted: true,
      selectedOptionId: 'a',
    });

    state = useGameStore.getState();
    expect(state.startedAt).toBe(60_000);
    expect(state.deadlineAt).toBe(63_000);
    expect(state.countdownKind).toBe('RESUME');
  });

  it('T38/T39/T40: restores authoritative progress counters and distribution', () => {
    useGameStore.getState().handleSnapshot({
      room: {
        pin: '123456',
        status: 'QUESTION_ACTIVE',
        roomVersion: 30,
        entryLocked: true,
        currentQuestionIndex: 0,
      },
      gameState: 'QUESTION_ACTIVE',
      phaseStartedAt: 100_000,
      phaseDeadlineAt: 160_000,
      question: { id: 'q1', options: [{ id: 'a', label: 'A' }], durationMs: 60_000 },
      answeredCount: 7,
      totalPlayers: 15,
      connectedPlayers: 12,
      eligiblePlayers: 10,
      activeEligiblePlayers: 9,
      distribution: [{ optionId: 'a', count: 7, percentage: 100 }],
    });

    const state = useGameStore.getState();
    expect(state.answeredCount).toBe(7);
    expect(state.totalPlayers).toBe(15);
    expect(state.connectedPlayers).toBe(12);
    expect(state.eligiblePlayers).toBe(10);
    expect(state.activeEligiblePlayers).toBe(9);
    expect(state.distribution).toEqual([{ optionId: 'a', count: 7, percentage: 100 }]);
  });

  it('permite retry limpo após ANSWER_REJECTED e preserva a nova alternativa aceita', () => {
    useGameStore.setState({
      roomState: 'QUESTION_ACTIVE',
      selectedOptionId: 'opt-a',
      answerSubmitted: false,
      answerAcceptedAt: null,
      answerRejected: null,
    });

    useGameStore.getState().handleAnswerRejected({ code: 'INVALID_PAYLOAD', message: 'Resposta rejeitada' });
    let state = useGameStore.getState();
    expect(state.answerSubmitted).toBe(false);
    expect(state.selectedOptionId).toBeNull();
    expect(state.answerAcceptedAt).toBeNull();
    expect(state.answerRejected?.code).toBe('INVALID_PAYLOAD');

    useGameStore.getState().selectOption('opt-b');
    state = useGameStore.getState();
    expect(state.answerRejected).toBeNull();
    expect(state.selectedOptionId).toBe('opt-b');

    useGameStore.getState().handleAnswerAccepted({ receivedAt: 123_456 });
    state = useGameStore.getState();
    expect(state.answerSubmitted).toBe(true);
    expect(state.selectedOptionId).toBe('opt-b');
    expect(state.answerRejected).toBeNull();
  });

  describe('V32-T05: PAUSED e RESUME semântica de interactionLocked vs hasRecordedAnswer', () => {
    it('V32-T05A: PAUSED sem resposta mantem answerSubmitted=false e selectedOptionId=null', () => {
      useGameStore.getState().handleSnapshot({
        room: { pin: '123456', status: 'PAUSED', roomVersion: 10, entryLocked: true, currentQuestionIndex: 0 },
        gameState: 'PAUSED',
        remainingMs: 45000,
        question: { id: 'q1', options: [{ id: 'a', label: 'A' }], durationMs: 60000 },
        questionVersion: 0,
        answerSubmitted: false,
        selectedOptionId: null,
      });

      const state = useGameStore.getState();
      expect(state.roomState).toBe('PAUSED');
      expect(state.answerSubmitted).toBe(false);
      expect(state.selectedOptionId).toBeNull();
      // UI semantics:
      const hasRecordedAnswer = Boolean(state.answerSubmitted || state.selectedOptionId);
      const interactionLocked = Boolean(state.roomState === 'PAUSED' || hasRecordedAnswer);
      expect(hasRecordedAnswer).toBe(false); // NO "Resposta registrada!"
      expect(interactionLocked).toBe(true);  // Buttons disabled
    });

    it('V32-T05B: PAUSED após resposta preserva answerSubmitted=true e selectedOptionId', () => {
      useGameStore.getState().handleSnapshot({
        room: { pin: '123456', status: 'PAUSED', roomVersion: 11, entryLocked: true, currentQuestionIndex: 0 },
        gameState: 'PAUSED',
        remainingMs: 45000,
        question: { id: 'q1', options: [{ id: 'a', label: 'A' }], durationMs: 60000 },
        questionVersion: 0,
        answerSubmitted: true,
        selectedOptionId: 'a',
      });

      const state = useGameStore.getState();
      expect(state.roomState).toBe('PAUSED');
      expect(state.answerSubmitted).toBe(true);
      expect(state.selectedOptionId).toBe('a');
      // UI semantics:
      const hasRecordedAnswer = Boolean(state.answerSubmitted || state.selectedOptionId);
      const interactionLocked = Boolean(state.roomState === 'PAUSED' || hasRecordedAnswer);
      expect(hasRecordedAnswer).toBe(true); // "Resposta registrada!" shown
      expect(interactionLocked).toBe(true); // Buttons disabled
    });

    it('V32-T05C: RESUME para jogador não respondeu libera alternativas', () => {
      useGameStore.getState().handleSnapshot({
        room: { pin: '123456', status: 'QUESTION_ACTIVE', roomVersion: 15, entryLocked: true, currentQuestionIndex: 0 },
        gameState: 'QUESTION_ACTIVE',
        phaseStartedAt: 100000,
        phaseDeadlineAt: 145000,
        question: { id: 'q1', options: [{ id: 'a', label: 'A' }], durationMs: 60000 },
        questionVersion: 0,
        answerSubmitted: false,
        selectedOptionId: null,
      });

      const state = useGameStore.getState();
      expect(state.roomState).toBe('QUESTION_ACTIVE');
      const hasRecordedAnswer = Boolean(state.answerSubmitted || state.selectedOptionId);
      const interactionLocked = Boolean(state.roomState === 'PAUSED' || hasRecordedAnswer);
      expect(hasRecordedAnswer).toBe(false);
      expect(interactionLocked).toBe(false); // Alternatives enabled!
    });

    it('V32-T05D: RESUME para jogador que já respondeu mantém alternativas bloqueadas e confirmação visível', () => {
      useGameStore.getState().handleSnapshot({
        room: { pin: '123456', status: 'QUESTION_ACTIVE', roomVersion: 15, entryLocked: true, currentQuestionIndex: 0 },
        gameState: 'QUESTION_ACTIVE',
        phaseStartedAt: 100000,
        phaseDeadlineAt: 145000,
        question: { id: 'q1', options: [{ id: 'a', label: 'A' }], durationMs: 60000 },
        questionVersion: 0,
        answerSubmitted: true,
        selectedOptionId: 'a',
      });

      const state = useGameStore.getState();
      expect(state.roomState).toBe('QUESTION_ACTIVE');
      const hasRecordedAnswer = Boolean(state.answerSubmitted || state.selectedOptionId);
      const interactionLocked = Boolean(state.roomState === 'PAUSED' || hasRecordedAnswer);
      expect(hasRecordedAnswer).toBe(true);  // Confirmation remains visible
      expect(interactionLocked).toBe(true);  // Alternatives remain locked
    });
  });
});

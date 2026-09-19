import { create } from 'zustand';
import type {
  GameState, RankingEntry, PublicQuestion,
  OptionDistribution, PersonalResult,
} from '@batalha/protocol';

export interface PlayerInfo {
  playerId: string;
  nickname: string;
  joinedAt: number;
  eligibleFromQuestion: number;
}

export interface PresenceInfo {
  playerId: string;
  connected: boolean;
}

export interface PersonalScore {
  totalPoints: number;
  correctCount: number;
  position: number;
}

interface GameStoreState {
  // Connection
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  
  // Room
  pin: string | null;
  roomState: GameState | null;
  roomVersion: number;
  entryLocked: boolean;
  currentQuestionIndex: number;
  
  // Player identity
  role: 'player' | 'host' | 'screen' | null;
  playerId: string | null;
  nickname: string | null;
  reconnectToken: string | null;
  
  // Host data
  joinUrl: string | null;
  
  // Players
  players: PlayerInfo[];
  presences: PresenceInfo[];
  
  // Current question
  currentQuestion: PublicQuestion | null;
  startedAt: number | null;
  deadlineAt: number | null;
  
  // Answer state
  selectedOptionId: string | null;
  answerSubmitted: boolean;
  answerAcceptedAt: number | null;
  
  // Reveal
  correctOptionId: string | null;
  explanation: string | null;
  distribution: OptionDistribution[];
  personalResult: PersonalResult | null;
  
  // Ranking
  rankings: RankingEntry[];
  previousRankings: RankingEntry[];
  isFinalRanking: boolean;
  
  // Podium
  podium: RankingEntry[];
  
  // Personal score tracking
  personalScore: PersonalScore;
  
  // Countdown tracking
  countdownStartedAt: number | null;

  // Round progress
  answeredCount: number;
  totalEligible: number;

  // Answer rejected state
  answerRejected: { code: string; message: string } | null;
  
  // Actions
  setConnectionState: (state: GameStoreState['connectionState']) => void;
  setPin: (pin: string) => void;
  setRole: (role: GameStoreState['role']) => void;
  setHostData: (data: { joinUrl: string; pin: string }) => void;
  setSession: (data: { playerId: string; reconnectToken?: string; nickname: string }) => void;
  
  // Event handlers - called by WebSocket manager
  handleSnapshot: (payload: any) => void;
  handlePlayerJoined: (payload: any) => void;
  handlePlayerPresenceChanged: (payload: any) => void;
  handleGameStateChanged: (payload: any) => void;
  handleQuestionStarted: (payload: any) => void;
  handleRoundProgress: (payload: any) => void;
  handleAnswerAccepted: (payload: any) => void;
  handleAnswerRejected: (payload: { code: string; message: string }) => void;
  handleQuestionEnded: (payload: any) => void;
  handleAnswerReveal: (payload: any) => void;
  handleRankingUpdated: (payload: any) => void;
  handleRoomFinished: (payload: any) => void;
  
  // Player actions
  selectOption: (optionId: string) => void;
  clearQuestionState: () => void;
  resetStore: () => void;
}

const initialState = {
  connectionState: 'disconnected' as const,
  pin: null,
  roomState: null,
  roomVersion: 0,
  entryLocked: false,
  currentQuestionIndex: 0,
  role: null,
  playerId: null,
  nickname: null,
  reconnectToken: null,
  joinUrl: null,
  players: [],
  presences: [],
  currentQuestion: null,
  startedAt: null,
  deadlineAt: null,
  selectedOptionId: null,
  answerSubmitted: false,
  answerAcceptedAt: null,
  answerRejected: null,
  countdownStartedAt: null,
  answeredCount: 0,
  totalEligible: 0,
  correctOptionId: null,
  explanation: null,
  distribution: [],
  personalResult: null,
  rankings: [],
  previousRankings: [],
  isFinalRanking: false,
  podium: [],
  personalScore: {
    totalPoints: 0,
    correctCount: 0,
    position: 0,
  },
};

export const useGameStore = create<GameStoreState>((set, get) => ({
  ...initialState,

  setConnectionState: (state) => set({ connectionState: state }),
  setPin: (pin) => set({ pin }),
  setRole: (role) => set({ role }),
  setHostData: (data) => set({ 
    joinUrl: data.joinUrl, 
    pin: data.pin 
  }),
  setSession: (data) => {
    const pin = get().pin || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : null);
    if (pin && data.reconnectToken && typeof localStorage !== 'undefined') {
      localStorage.setItem(`batalha_session_${pin}`, data.reconnectToken);
    }
    set({
      playerId: data.playerId,
      reconnectToken: data.reconnectToken ?? get().reconnectToken,
      nickname: data.nickname,
    });
  },

  handleSnapshot: (payload) => set((state) => {
    const status = payload.room?.status ?? state.roomState;
    const incomingVersion = payload.room?.roomVersion ?? state.roomVersion;
    if (incomingVersion > 0 && incomingVersion < state.roomVersion) {
      // Discard stale snapshot that is strictly older than current store version
      return state;
    }

    const activeQId = payload.currentQuestion?.id;
    const isSameQuestion = Boolean(activeQId && state.currentQuestion?.id === activeQId);

    let selectedOptionId: string | null = null;
    let answerSubmitted = false;
    let answerAcceptedAt: number | null = null;
    let personalResult: PersonalResult | null = null;

    // Check if player has an answer in personalAnswers for the active question
    let answerForActive: any = null;
    if (activeQId && Array.isArray(payload.personalAnswers)) {
      answerForActive = payload.personalAnswers.find(
        (a: any) => a.questionId === activeQId || a.question_id === activeQId
      );
    }

    if (status === 'QUESTION_ACTIVE' || status === 'PAUSED') {
      if (answerForActive) {
        selectedOptionId = answerForActive.optionId || answerForActive.option_id;
        answerSubmitted = true;
        answerAcceptedAt = answerForActive.receivedAt || answerForActive.received_at || state.answerAcceptedAt;
      } else if (isSameQuestion && !state.answerSubmitted) {
        // Retain unsubmitted local selection on same question
        selectedOptionId = state.selectedOptionId;
        answerSubmitted = false;
      }
      personalResult = null;
    } else if (status === 'QUESTION_REVEAL') {
      if (payload.personalResult) {
        personalResult = payload.personalResult;
      } else if (answerForActive) {
        personalResult = {
          correct: Boolean(answerForActive.correct),
          selectedOptionId: answerForActive.optionId || answerForActive.option_id || '',
          awardedPoints: answerForActive.awardedPoints || answerForActive.awarded_points || 0,
          responseTimeMs: answerForActive.responseTimeMs || answerForActive.response_time_ms || 0,
        };
      } else {
        personalResult = {
          correct: false,
          selectedOptionId: '',
          awardedPoints: 0,
          responseTimeMs: 0,
        };
      }
      selectedOptionId = answerForActive ? (answerForActive.optionId || answerForActive.option_id) : (personalResult?.selectedOptionId || null);
      answerSubmitted = Boolean(answerForActive);
    } else if (status === 'ROUND_RANKING' || status === 'FINAL_RANKING') {
      personalResult = payload.personalResult ?? state.personalResult;
    }

    const pid = payload.playerId ?? state.playerId;
    const myPlayer = Array.isArray(payload.players) && pid ? payload.players.find((p: any) => p.playerId === pid) : null;
    const nickname = state.nickname ?? myPlayer?.nickname ?? null;

    let personalScore = state.personalScore;
    if (payload.personalScore) {
      personalScore = {
        totalPoints: payload.personalScore.totalPoints ?? personalScore.totalPoints,
        correctCount: payload.personalScore.correctCount ?? personalScore.correctCount,
        position: payload.personalScore.position ?? personalScore.position,
      };
    } else if (pid) {
      if (Array.isArray(payload.scores)) {
        const myScore = payload.scores.find((s: any) => s.playerId === pid || s.player_id === pid);
        if (myScore) {
          personalScore = {
            totalPoints: myScore.totalPoints ?? myScore.total_points ?? personalScore.totalPoints,
            correctCount: myScore.correctCount ?? myScore.correct_count ?? personalScore.correctCount,
            position: personalScore.position,
          };
        }
      }
      if (Array.isArray(payload.rankings)) {
        const myRank = payload.rankings.find((r: any) => r.playerId === pid);
        if (myRank) {
          personalScore = {
            ...personalScore,
            position: myRank.position,
          };
        }
      }
    }

    const pin = payload.room?.pin ?? state.pin;
    const reconnectToken = state.reconnectToken ?? (pin && typeof localStorage !== 'undefined' ? localStorage.getItem(`batalha_session_${pin}`) : null);
    const currentQuestion = payload.currentQuestion !== undefined ? payload.currentQuestion : state.currentQuestion;

    const isCountdown = status === 'COUNTDOWN';
    const countdownStartedAt = isCountdown
      ? (state.countdownStartedAt ?? Date.now())
      : null;
    const startedAt = isCountdown
      ? (payload.round?.startedAt ?? countdownStartedAt)
      : (payload.round?.startedAt ?? (status === 'QUESTION_ACTIVE' ? state.startedAt : null));
    const deadlineAt = isCountdown
      ? (payload.round?.deadlineAt ?? (countdownStartedAt ? countdownStartedAt + 3000 : Date.now() + 3000))
      : (payload.round?.deadlineAt ?? (status === 'QUESTION_ACTIVE' ? state.deadlineAt : null));

    const previousRankings = (state.rankings.length > 0 && Array.isArray(payload.rankings) && state.rankings !== payload.rankings)
      ? state.rankings
      : state.previousRankings;

    return {
      ...state,
      pin,
      nickname,
      reconnectToken,
      roomState: status,
      roomVersion: incomingVersion,
      entryLocked: payload.room?.entryLocked ?? state.entryLocked,
      currentQuestionIndex: payload.room?.currentQuestionIndex ?? state.currentQuestionIndex,
      players: payload.players ?? state.players,
      presences: payload.presences ?? state.presences,
      currentQuestion,
      countdownStartedAt,
      startedAt,
      deadlineAt,
      playerId: pid,
      selectedOptionId,
      answerSubmitted,
      answerAcceptedAt,
      personalResult,
      personalScore,
      rankings: payload.rankings ?? state.rankings,
      previousRankings,
      podium: payload.podium ?? state.podium,
      distribution: payload.distribution ?? (status === 'QUESTION_REVEAL' ? state.distribution : []),
      correctOptionId: status === 'QUESTION_REVEAL' ? (payload.correctOptionId ?? state.correctOptionId) : null,
      explanation: status === 'QUESTION_REVEAL' ? (payload.explanation ?? state.explanation) : null,
      isFinalRanking: payload.isFinalRanking ?? (status === 'FINAL_RANKING'),
      answeredCount: payload.counts?.answeredCount ?? state.answeredCount,
      totalEligible: payload.counts?.totalEligible ?? state.totalEligible,
    };
  }),

  handlePlayerJoined: (payload) => set((state) => {
    const exists = state.players.some(p => p.playerId === payload.playerId);
    if (exists) return state;
    return {
      players: [...state.players, {
        playerId: payload.playerId,
        nickname: payload.nickname,
        joinedAt: Date.now(),
        eligibleFromQuestion: 0,
      }],
      presences: [
        ...state.presences.filter(p => p.playerId !== payload.playerId),
        { playerId: payload.playerId, connected: true },
      ],
    };
  }),

  handlePlayerPresenceChanged: (payload) => set((state) => {
    if (payload.reason === 'removed') {
      return {
        players: state.players.filter(p => p.playerId !== payload.playerId),
        presences: state.presences.filter(p => p.playerId !== payload.playerId),
      };
    }
    const exists = state.presences.some(p => p.playerId === payload.playerId);
    const presences = exists
      ? state.presences.map(p => p.playerId === payload.playerId ? { ...p, connected: payload.connected } : p)
      : [...state.presences, { playerId: payload.playerId, connected: payload.connected }];
    return { presences };
  }),

  handleGameStateChanged: (payload) => set((state) => {
    const isCountdown = payload.state === 'COUNTDOWN';
    const now = Date.now();
    return {
      roomState: payload.state,
      roomVersion: payload.roomVersion,
      entryLocked: payload.entryLocked,
      currentQuestionIndex: payload.currentQuestionIndex,
      countdownStartedAt: isCountdown ? now : state.countdownStartedAt,
      startedAt: isCountdown ? now : state.startedAt,
      deadlineAt: isCountdown ? now + 3000 : state.deadlineAt,
    };
  }),

  handleQuestionStarted: (payload) => set((state) => {
    const isSameQuestion = state.currentQuestion?.id === payload.question.id;
    return {
      roomState: 'QUESTION_ACTIVE' as GameState,
      currentQuestion: payload.question,
      startedAt: payload.startedAt,
      deadlineAt: payload.deadlineAt,
      currentQuestionIndex: payload.questionIndex,
      countdownStartedAt: null,
      answeredCount: isSameQuestion ? state.answeredCount : 0,
      totalEligible: isSameQuestion ? state.totalEligible : 0,
      // Preserve local answer state if resuming the same question (P1.3)
      selectedOptionId: isSameQuestion ? state.selectedOptionId : null,
      answerSubmitted: isSameQuestion ? state.answerSubmitted : false,
      answerAcceptedAt: isSameQuestion ? state.answerAcceptedAt : null,
      answerRejected: null,
      correctOptionId: null,
      explanation: null,
      distribution: isSameQuestion ? state.distribution : [],
      personalResult: null,
    };
  }),

  handleRoundProgress: (payload) => set((state) => ({
    answeredCount: payload.answeredCount ?? state.answeredCount,
    totalEligible: payload.totalEligible ?? state.totalEligible,
    distribution: payload.distribution ?? state.distribution,
  })),

  handleAnswerAccepted: (payload) => set({
    answerSubmitted: true,
    answerAcceptedAt: payload.receivedAt,
    answerRejected: null,
  }),

  handleAnswerRejected: (payload) => set({
    answerSubmitted: false,
    answerRejected: payload,
  }),

  handleQuestionEnded: (_payload) => set({
    deadlineAt: Date.now(), // Close timer visually
  }),

  handleAnswerReveal: (payload) => set((state) => {
    const res = payload.personalResult;
    let personalScore = state.personalScore;
    if (res) {
      personalScore = {
        ...personalScore,
        totalPoints: (personalScore.totalPoints || 0) + (res.awardedPoints || 0),
        correctCount: (personalScore.correctCount || 0) + (res.correct ? 1 : 0),
      };
    }
    return {
      roomState: 'QUESTION_REVEAL' as GameState,
      correctOptionId: payload.correctOptionId,
      explanation: payload.explanation ?? null,
      distribution: payload.distribution ?? [],
      personalResult: payload.personalResult ?? null,
      personalScore,
    };
  }),

  handleRankingUpdated: (payload) => set((state) => {
    const newRankings: RankingEntry[] = payload.rankings ?? [];
    const myRank = newRankings.find(r => r.playerId === state.playerId);
    return {
      roomState: payload.isFinal ? 'FINAL_RANKING' as GameState : 'ROUND_RANKING' as GameState,
      previousRankings: state.rankings.length > 0 ? state.rankings : state.previousRankings,
      rankings: newRankings,
      isFinalRanking: payload.isFinal ?? false,
      personalScore: myRank ? {
        totalPoints: myRank.totalPoints,
        correctCount: myRank.correctCount,
        position: myRank.position,
      } : state.personalScore,
    };
  }),

  handleRoomFinished: (payload) => set({
    podium: payload.podium ?? payload.fullRanking?.slice(0, 3) ?? [],
    rankings: payload.fullRanking ?? [],
    roomState: payload.isFinal ? 'PODIUM' as GameState : 'FINISHED' as GameState,
  }),

  selectOption: (optionId) => set({ selectedOptionId: optionId }),

  clearQuestionState: () => set({
    currentQuestion: null,
    startedAt: null,
    deadlineAt: null,
    selectedOptionId: null,
    answerSubmitted: false,
    answerAcceptedAt: null,
    answerRejected: null,
    countdownStartedAt: null,
    correctOptionId: null,
    explanation: null,
    distribution: [],
    personalResult: null,
  }),

  resetStore: () => set(initialState),
}));

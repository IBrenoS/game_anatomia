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
  hostToken: string | null;
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
  isFinalRanking: boolean;
  
  // Podium
  podium: RankingEntry[];
  
  // Personal score tracking
  personalScore: PersonalScore;
  
  // Actions
  setConnectionState: (state: GameStoreState['connectionState']) => void;
  setPin: (pin: string) => void;
  setRole: (role: GameStoreState['role']) => void;
  setHostData: (data: { hostToken: string; joinUrl: string; pin: string }) => void;
  setSession: (data: { playerId: string; reconnectToken?: string; nickname: string }) => void;
  
  // Event handlers - called by WebSocket manager
  handleSnapshot: (payload: any) => void;
  handlePlayerJoined: (payload: any) => void;
  handlePlayerPresenceChanged: (payload: any) => void;
  handleGameStateChanged: (payload: any) => void;
  handleQuestionStarted: (payload: any) => void;
  handleAnswerAccepted: (payload: any) => void;
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
  hostToken: null,
  joinUrl: null,
  players: [],
  presences: [],
  currentQuestion: null,
  startedAt: null,
  deadlineAt: null,
  selectedOptionId: null,
  answerSubmitted: false,
  answerAcceptedAt: null,
  correctOptionId: null,
  explanation: null,
  distribution: [],
  personalResult: null,
  rankings: [],
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
    hostToken: data.hostToken, 
    joinUrl: data.joinUrl, 
    pin: data.pin 
  }),
  setSession: (data) => {
    const { pin } = get();
    if (pin && data.reconnectToken) {
      localStorage.setItem(`batalha_session_${pin}`, data.reconnectToken);
    }
    set({
      playerId: data.playerId,
      reconnectToken: data.reconnectToken,
      nickname: data.nickname,
    });
  },

  handleSnapshot: (payload) => set((state) => ({
    ...state,
    roomState: payload.room?.status ?? state.roomState,
    roomVersion: payload.room?.roomVersion ?? state.roomVersion,
    entryLocked: payload.room?.entryLocked ?? state.entryLocked,
    currentQuestionIndex: payload.room?.currentQuestionIndex ?? state.currentQuestionIndex,
    players: payload.players ?? state.players,
    presences: payload.presences ?? state.presences,
    currentQuestion: payload.currentQuestion ?? state.currentQuestion,
    startedAt: payload.round?.startedAt ?? state.startedAt,
    deadlineAt: payload.round?.deadlineAt ?? state.deadlineAt,
    playerId: payload.playerId ?? state.playerId,
  })),

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
      presences: [...state.presences, { playerId: payload.playerId, connected: true }],
    };
  }),

  handlePlayerPresenceChanged: (payload) => set((state) => ({
    presences: state.presences.map(p =>
      p.playerId === payload.playerId ? { ...p, connected: payload.connected } : p
    ),
  })),

  handleGameStateChanged: (payload) => set({
    roomState: payload.state,
    roomVersion: payload.roomVersion,
    entryLocked: payload.entryLocked,
    currentQuestionIndex: payload.currentQuestionIndex,
  }),

  handleQuestionStarted: (payload) => set({
    roomState: 'QUESTION_ACTIVE' as GameState,
    currentQuestion: payload.question,
    startedAt: payload.startedAt,
    deadlineAt: payload.deadlineAt,
    currentQuestionIndex: payload.questionIndex,
    // Reset local answer state
    selectedOptionId: null,
    answerSubmitted: false,
    answerAcceptedAt: null,
    correctOptionId: null,
    explanation: null,
    distribution: [],
    personalResult: null,
  }),

  handleAnswerAccepted: (payload) => set({
    answerSubmitted: true,
    answerAcceptedAt: payload.receivedAt,
  }),

  handleQuestionEnded: (_payload) => set({
    deadlineAt: Date.now(), // Close timer visually
  }),

  handleAnswerReveal: (payload) => set({
    roomState: 'QUESTION_REVEAL' as GameState,
    correctOptionId: payload.correctOptionId,
    explanation: payload.explanation ?? null,
    distribution: payload.distribution ?? [],
    personalResult: payload.personalResult ?? null,
  }),

  handleRankingUpdated: (payload) => set({
    roomState: payload.isFinal ? 'FINAL_RANKING' as GameState : 'ROUND_RANKING' as GameState,
    rankings: payload.rankings ?? [],
    isFinalRanking: payload.isFinal ?? false,
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
    correctOptionId: null,
    explanation: null,
    distribution: [],
    personalResult: null,
  }),

  resetStore: () => set(initialState),
}));

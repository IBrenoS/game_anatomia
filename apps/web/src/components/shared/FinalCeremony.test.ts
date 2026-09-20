import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { RankingEntry } from '@batalha/protocol';
import CollectiveCeremony from './CollectiveCeremony.js';
import HostPodium from '../host/HostPodium.js';
import ScreenPodium from '../screen/ScreenPodium.js';
import HostRanking from '../host/HostRanking.js';
import ScreenRanking from '../screen/ScreenRanking.js';
import PlayerRanking from '../player/PlayerRanking.js';
import PlayerPodium from '../player/PlayerPodium.js';
import PlayerFinished from '../player/PlayerFinished.js';
import { soundManager } from '../../lib/sound.js';
import { useGameStore } from '../../stores/gameStore.js';
import { HostPage } from '../../pages/HostPage.js';
import { ScreenPage } from '../../pages/ScreenPage.js';
import { MemoryRouter, Routes, Route } from 'react-router';
import { getWebSocketManager } from '../../lib/ws.js';

const mockPodium: RankingEntry[] = [
  {
    position: 1,
    playerId: 'p1',
    nickname: 'Dra. Beatriz',
    totalPoints: 1250,
    correctCount: 14,
    correctResponseTimeMs: 14000,
    distanceToPrevious: 0,
  },
  {
    position: 2,
    playerId: 'p2',
    nickname: 'Dr. Lucas',
    totalPoints: 1000,
    correctCount: 12,
    correctResponseTimeMs: 16000,
    distanceToPrevious: 250,
  },
  {
    position: 3,
    playerId: 'p3',
    nickname: 'Dra. Mariana',
    totalPoints: 850,
    correctCount: 10,
    correctResponseTimeMs: 18000,
    distanceToPrevious: 150,
  },
];

const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => storageMap.set(k, String(v)),
  removeItem: (k: string) => storageMap.delete(k),
  clear: () => storageMap.clear(),
};
(globalThis as any).localStorage = localStorageMock;

describe('Cerimônia Final & Pódio por Perfil — Mandatory Scenarios A–J', () => {
  beforeEach(() => {
    useGameStore.getState().resetStore();
    localStorageMock.clear();
  });

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO A — HOST-ONLY
  // ─────────────────────────────────────────────────────────────
  describe('CENÁRIO A — HOST-ONLY', () => {
    it('A1: Ranking final antecede a cerimônia no Host-only com título explícito', () => {
      const html = renderToString(
        React.createElement(HostRanking, {
          rankings: mockPodium,
          isFinal: true,
        })
      );
      expect(html).toContain('Classificação Final');
      expect(html).toContain('Dra. Beatriz');
      expect(html).toContain('1250');
      expect(html).toContain('pts');
    });

    it('A2: Revelação progressiva do 3º, 2º e 1º com medalhas específicas e hierarquia', () => {
      // 3º lugar reveal
      const htmlThird = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'host',
          initialPhase: 'third',
        })
      );
      expect(htmlThird).toContain('🥉');
      expect(htmlThird).toContain('Dra. Mariana');
      expect(htmlThird).toContain('850 pts');

      // 2º lugar reveal
      const htmlSecond = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'host',
          initialPhase: 'second',
        })
      );
      expect(htmlSecond).toContain('🥈');
      expect(htmlSecond).toContain('Dr. Lucas');
      expect(htmlSecond).toContain('1000 pts');

      // 1º lugar reveal
      const htmlFirst = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'host',
          initialPhase: 'first',
        })
      );
      expect(htmlFirst).toContain('🏆');
      expect(htmlFirst).toContain('Dra. Beatriz');
      expect(htmlFirst).toContain('1250 pts');

      // Consolidated Podium
      const htmlPodium = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'host',
          initialPhase: 'podium',
        })
      );
      expect(htmlPodium).toContain('🏆 PÓDIO DOS CAMPEÕES');
      expect(htmlPodium).toContain('Campeão');
      expect(htmlPodium).toContain('Vice-Campeão');
      expect(htmlPodium).toContain('3º Colocado');
    });

    it('A3: Champion Moment possui destaque para 1º lugar, troféu e pontuação', () => {
      const html = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'host',
          initialPhase: 'champion',
        })
      );
      expect(html).toContain('Cerimônia Oficial dos Campeões');
      expect(html).toContain('1º Lugar · Grande Campeão da Arena');
      expect(html).toContain('Dra. Beatriz');
      expect(html).toContain('1250 pts');
      expect(html).toContain('🏆');
      expect(html).toContain('🏆');
    });

    it('A4: Agradecimento final do Host-only exibe botões "Nova Partida" e "Voltar ao Início"', () => {
      const html = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'host',
          initialPhase: 'thanks',
        })
      );
      expect(html).toContain('Fim de Jogo!');
      expect(html).toContain('Partida Finalizada');
      expect(html).toContain('Nova Partida');
      expect(html).toContain('Voltar ao Início');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO B — TELÃO
  // ─────────────────────────────────────────────────────────────
  describe('CENÁRIO B — TELÃO', () => {
    it('B1: Telão compartilha a mesma cinematografia do pódio e champion moment do Host-only', () => {
      const screenHtml = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'screen',
          initialPhase: 'champion',
        })
      );
      const hostHtml = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'host',
          initialPhase: 'champion',
        })
      );

      // Same visual champion presentation
      expect(screenHtml).toContain('Dra. Beatriz');
      expect(screenHtml).toContain('1250 pts');
      expect(screenHtml).toContain('1º Lugar · Grande Campeão da Arena');
      expect(hostHtml).toContain('Dra. Beatriz');
      expect(hostHtml).toContain('1250 pts');
    });

    it('B2: Telão na fase de agradecimento é read-only e NÃO exibe botões administrativos', () => {
      const html = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'screen',
          initialPhase: 'thanks',
        })
      );
      expect(html).toContain('Fim de Jogo!');
      expect(html).toContain('Aguarde o apresentador iniciar uma nova batalha.');
      expect(html).not.toContain('Nova Partida');
      expect(html).not.toContain('Reiniciar');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO C — PLAYER #1
  // ─────────────────────────────────────────────────────────────
  describe('CENÁRIO C — PLAYER #1', () => {
    it('C1: Player #1 vê "Você está no pódio." com troféu/ouro e celebração forte', () => {
      const html = renderToString(
        React.createElement(PlayerPodium, {
          podium: mockPodium,
          playerId: 'p1',
        })
      );
      expect(html).toContain('CERIMÔNIA FINAL');
      expect(html).toContain('Você está no pódio.');
      expect(html).toContain('1º lugar · 1250 pontos');
      expect(html).toContain('Parabéns, você subiu ao pódio!');
      expect(html).toContain('🏆');
      expect(html).not.toContain('🥈');
      expect(html).not.toContain('🥉');
    });

    it('C2: Resumo final do Player #1 exibe estatísticas e somente botão "Voltar ao início"', () => {
      const html = renderToString(
        React.createElement(PlayerFinished, {
          ranking: mockPodium[0],
        })
      );
      expect(html).toContain('PARTIDA CONCLUÍDA');
      expect(html).toContain('#1');
      expect(html).toContain('1250 pts');
      expect(html).toContain('14 acertos');
      expect(html).toContain('Voltar ao início');
      expect(html).not.toContain('Nova Partida');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO D — PLAYER #2
  // ─────────────────────────────────────────────────────────────
  describe('CENÁRIO D — PLAYER #2', () => {
    it('D1: Player #2 vê medalha de prata 🥈 e celebração individual intermediária (SEM troféu)', () => {
      const html = renderToString(
        React.createElement(PlayerPodium, {
          podium: mockPodium,
          playerId: 'p2',
        })
      );
      expect(html).toContain('Você está no pódio.');
      expect(html).toContain('2º lugar · 1000 pontos');
      expect(html).toContain('🥈');
      expect(html).not.toContain('🏆');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO E — PLAYER #3
  // ─────────────────────────────────────────────────────────────
  describe('CENÁRIO E — PLAYER #3', () => {
    it('E1: Player #3 vê medalha de bronze 🥉 e celebração intermediária (SEM troféu)', () => {
      const html = renderToString(
        React.createElement(PlayerPodium, {
          podium: mockPodium,
          playerId: 'p3',
        })
      );
      expect(html).toContain('Você está no pódio.');
      expect(html).toContain('3º lugar · 850 pontos');
      expect(html).toContain('🥉');
      expect(html).not.toContain('🏆');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO F — PLAYER FORA DO TOP 3
  // ─────────────────────────────────────────────────────────────
  describe('CENÁRIO F — PLAYER FORA DO TOP 3', () => {
    it('F1: Player fora do Top 3 vê "Excelente Participação" sem troféu e sem fanfarra de campeão', () => {
      const html = renderToString(
        React.createElement(PlayerPodium, {
          podium: mockPodium,
          playerId: 'p-fora',
        })
      );
      expect(html).toContain('Excelente Participação!');
      expect(html).toContain('👏');
      expect(html).toContain('Acompanhe os grandes campeões no telão da sala.');
      expect(html).not.toContain('Você está no pódio');
      expect(html).not.toContain('🏆');
      expect(html).not.toContain('🥈');
      expect(html).not.toContain('🥉');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO G — HOST + PLAYER TOP 3
  // ─────────────────────────────────────────────────────────────
  describe('CENÁRIO G — HOST + PLAYER TOP 3', () => {
    it('G1: Host + Player no Top 3 recebe experiência individual no pódio e apenas "Voltar ao início"', () => {
      const podiumHtml = renderToString(
        React.createElement(PlayerPodium, {
          podium: mockPodium,
          playerId: 'p1',
        })
      );
      expect(podiumHtml).toContain('Você está no pódio.');
      expect(podiumHtml).not.toContain('🏆 PÓDIO DOS CAMPEÕES'); // Not collective ceremony!

      const finishedHtml = renderToString(
        React.createElement(PlayerFinished, {
          ranking: mockPodium[0],
        })
      );
      expect(finishedHtml).toContain('Voltar ao início');
      expect(finishedHtml).not.toContain('Nova Partida');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO H — HOST + PLAYER FORA DO TOP 3
  // ─────────────────────────────────────────────────────────────
  describe('CENÁRIO H — HOST + PLAYER FORA DO TOP 3', () => {
    it('H1: Host + Player fora do Top 3 vê "Excelente Participação" e somente "Voltar ao início"', () => {
      const podiumHtml = renderToString(
        React.createElement(PlayerPodium, {
          podium: mockPodium,
          playerId: 'p-out',
        })
      );
      expect(podiumHtml).toContain('Excelente Participação!');
      expect(podiumHtml).not.toContain('Você está no pódio');

      const finishedHtml = renderToString(
        React.createElement(PlayerFinished, {
          ranking: {
            position: 5,
            playerId: 'p-out',
            nickname: 'HostJogador',
            totalPoints: 400,
            correctCount: 4,
            correctResponseTimeMs: 15000,
            distanceToPrevious: 100,
          },
        })
      );
      expect(finishedHtml).toContain('#5');
      expect(finishedHtml).toContain('Voltar ao início');
      expect(finishedHtml).not.toContain('Nova Partida');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO I — RECONNECT DURANTE PÓDIO
  // ─────────────────────────────────────────────────────────────
  describe('CENÁRIO I — RECONNECT DURANTE PÓDIO', () => {
    it('I1: Reconnect recupera a fase correspondente do pódio a partir do phaseStartedAt autoritativo', () => {
      const now = Date.now();

      // Case 1: Reconnecting 2.5s into ceremony (Phase: second)
      const htmlAt2500 = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'screen',
          phaseStartedAt: now - 2000, // 2s elapsed => phase 'third'
        })
      );
      expect(htmlAt2500).toContain('Dra. Mariana'); // 3rd revealed

      // Case 2: Reconnecting 5s into ceremony (Phase: first)
      const htmlAt5000 = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'screen',
          phaseStartedAt: now - 5200, // 5.2s elapsed => phase 'first'
        })
      );
      expect(htmlAt5000).toContain('Dra. Beatriz'); // 1st revealed

      // Case 3: Reconnecting 10s into ceremony (Phase: champion)
      const htmlAt10000 = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'screen',
          phaseStartedAt: now - 10500, // 10.5s elapsed => phase 'champion'
        })
      );
      expect(htmlAt10000).toContain('Cerimônia Oficial dos Campeões');
      expect(htmlAt10000).toContain('1º Lugar · Grande Campeão da Arena');

      // Case 4: Reconnecting after ceremony (Phase: thanks)
      const htmlAt14000 = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'screen',
          phaseStartedAt: now - 14000, // 14s elapsed => phase 'thanks'
        })
      );
      expect(htmlAt14000).toContain('Fim de Jogo!');
      expect(htmlAt14000).toContain('Aguarde o apresentador iniciar uma nova batalha.');
    });

    it('I2: Reconnect in FINISHED state at 10.5s preserves Champion Moment and does not cut off prematurely', () => {
      const now = Date.now();
      useGameStore.setState({
        podiumStartedAt: now - 10500,
        startedAt: now - 500,
        roomState: 'FINISHED',
      });

      const hostHtml = renderToString(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(HostPodium, {
            podium: mockPodium,
            roomState: 'FINISHED',
          })
        )
      );
      // At 10.5s, should still be in champion moment, NOT cut off to thanks!
      expect(hostHtml).toContain('Cerimônia Oficial dos Campeões');
      expect(hostHtml).toContain('1º Lugar · Grande Campeão da Arena');
      expect(hostHtml).not.toContain('Fim de Jogo!');

      const screenHtml = renderToString(
        React.createElement(ScreenPodium, {
          podium: mockPodium,
          roomState: 'FINISHED',
        })
      );
      expect(screenHtml).toContain('Cerimônia Oficial dos Campeões');
      expect(screenHtml).not.toContain('Fim de Jogo!');
    });

    it('I3: Reconnect in FINISHED state after 13s displays thanks screen on both Host and Telão', () => {
      const now = Date.now();
      useGameStore.setState({
        podiumStartedAt: now - 15000,
        startedAt: now - 5000,
        roomState: 'FINISHED',
      });

      const hostHtml = renderToString(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(HostPodium, {
            podium: mockPodium,
            roomState: 'FINISHED',
          })
        )
      );
      expect(hostHtml).toContain('Fim de Jogo!');
      expect(hostHtml).toContain('Nova Partida');
      expect(hostHtml).toContain('Voltar ao Início');

      const screenHtml = renderToString(
        React.createElement(ScreenPodium, {
          podium: mockPodium,
          roomState: 'FINISHED',
        })
      );
      expect(screenHtml).toContain('Fim de Jogo!');
      expect(screenHtml).toContain('Aguarde o apresentador iniciar uma nova batalha.');
      expect(screenHtml).not.toContain('Nova Partida');
    });

    it('I4: gameStore tracks and retains podiumStartedAt across state transitions', () => {
      const t0 = 1710000000000;
      // 1. Transition to PODIUM
      useGameStore.getState().handleGameStateChanged({
        state: 'PODIUM' as any,
        phaseStartedAt: t0,
        roomVersion: 10,
      });
      expect(useGameStore.getState().podiumStartedAt).toBe(t0);

      // 2. Transition to FINISHED at T=10s
      const tFinished = t0 + 10000;
      useGameStore.getState().handleGameStateChanged({
        state: 'FINISHED' as any,
        phaseStartedAt: tFinished,
        roomVersion: 11,
      });
      // podiumStartedAt must be retained to maintain ceremony continuity
      expect(useGameStore.getState().podiumStartedAt).toBe(t0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO J — SOM DESATIVADO
  // ─────────────────────────────────────────────────────────────
  describe('CENÁRIO J — SOM DESATIVADO', () => {
    it('J1: Cerimônia funciona e é visualmente compreensível mesmo com som desativado', () => {
      soundManager.setEnabled(false);
      expect(soundManager.isEnabled()).toBe(false);

      // Verify no exception is thrown and all visual elements render perfectly
      const html = renderToString(
        React.createElement(CollectiveCeremony, {
          podium: mockPodium,
          mode: 'host',
          initialPhase: 'champion',
        })
      );
      expect(html).toContain('Cerimônia Oficial dos Campeões');
      expect(html).toContain('Dra. Beatriz');
      expect(html).toContain('1250 pts');
      expect(html).toContain('🏆');

      // Restore sound for subsequent tests
      soundManager.setEnabled(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // CENÁRIO K — ACCESSIBILITY & RESILIENCE
  // ─────────────────────────────────────────────────────────────
  describe('CENÁRIO K — ACCESSIBILITY & RESILIENCE', () => {
    it('K1: PlayerPodium resolves ranking and personal score fallback when podium array is incomplete', () => {
      useGameStore.setState({
        rankings: mockPodium,
        personalScore: {
          position: 2,
          totalPoints: 1000,
          correctCount: 12,
        },
      });

      // Player 2 not in podium array, but present in rankings
      const html = renderToString(
        React.createElement(PlayerPodium, {
          podium: [mockPodium[0]], // only contains 1st
          playerId: 'p2',
        })
      );
      expect(html).toContain('Você está no pódio.');
      expect(html).toContain('2º lugar · 1000 pontos');
      expect(html).toContain('🥈');
    });
  });
});

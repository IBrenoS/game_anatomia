import { execFileSync, spawn, ChildProcess } from 'node:child_process';
import {
  ClientEventType,
  ServerEventType,
  createClientEnvelope,
  EventEnvelope,
} from '../../packages/protocol/src/index';
import { questions } from '../../packages/content/src/index';

export interface LoadTestConfig {
  baseUrl: string;
  playerCount: number;
  screenCount: number;
  burstDurationMs: number;
  maxP95LatencyMs: number;
}

export interface LoadTestMetrics {
  success: boolean;
  totalConnections: number;
  playersConnected: number;
  screensConnected: number;
  hostConnected: boolean;
  answersSubmitted: number;
  answersAccepted: number;
  droppedAnswers: number;
  latenciesMs: number[];
  minLatencyMs: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
  durationMs: number;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isServerReady(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServerRunning(baseUrl: string): Promise<ChildProcess | null> {
  if (await isServerReady(baseUrl)) {
    console.log(`[Load Test] Existing server detected on ${baseUrl}`);
    return null;
  }

  console.log(`[Load Test] Server not running on ${baseUrl}. Spawning dev server...`);
  const pnpmCliPath = process.env.npm_execpath;
  if (!pnpmCliPath) {
    throw new Error(
      'Unable to locate the pnpm CLI. Run the load test through "pnpm test:load".'
    );
  }

  const child = spawn(process.execPath, [pnpmCliPath, 'dev'], {
    stdio: 'ignore',
    cwd: process.cwd(),
  });

  const startWait = Date.now();
  while (Date.now() - startWait < 30000) {
    if (await isServerReady(baseUrl)) {
      console.log(`[Load Test] Dev server ready on ${baseUrl}`);
      return child;
    }
    await delay(1000);
  }

  child.kill();
  throw new Error(`Timeout waiting for dev server on ${baseUrl}`);
}

export async function runWebSocketLoadTest(
  config: LoadTestConfig = {
    baseUrl: process.env.BASE_URL || 'http://localhost:5173',
    playerCount: 50,
    screenCount: 2,
    burstDurationMs: 2000,
    maxP95LatencyMs: 500,
  }
): Promise<LoadTestMetrics> {
  const startTime = Date.now();
  let spawnedServer: ChildProcess | null = null;

  try {
    spawnedServer = await ensureServerRunning(config.baseUrl);

    console.log(`\n======================================================`);
    console.log(`  BATALHA ANATÔMICA — REAL WEBSOCKET LOAD TEST (P3.4)  `);
    console.log(`======================================================`);
    console.log(`Target: ${config.baseUrl}`);
    console.log(`Config: 1 Host + ${config.screenCount} Screens + ${config.playerCount} Concurrent Players`);
    console.log(`Burst Window: ${config.burstDurationMs}ms | Latency SLA: p95 < ${config.maxP95LatencyMs}ms\n`);

    // 1. Create Room via HTTP POST /api/rooms
    const roomRes = await fetch(`${config.baseUrl}/api/rooms`, { method: 'POST' });
    if (!roomRes.ok) {
      throw new Error(`Failed to create room: ${roomRes.statusText}`);
    }
    const { pin } = (await roomRes.json()) as { pin: string };
    const setCookie = roomRes.headers.get('set-cookie') || '';
    const hostTokenMatch = setCookie.match(/batalha_host_[^=]+=([^;]+)/);
    const hostToken = hostTokenMatch ? hostTokenMatch[1] : '';
    console.log(`[Load Test] Room created successfully. PIN: ${pin}`);

    const wsOrigin = config.baseUrl.replace(/^http/, 'ws');
    const allSockets: WebSocket[] = [];

    // 2. Connect 1 Host WebSocket
    console.log(`[Load Test] Connecting Host WebSocket...`);
    const hostWsUrl = `${wsOrigin}/api/rooms/${pin}/ws?role=host`;
    const hostWs = new (WebSocket as any)(hostWsUrl, {
      headers: {
        Cookie: `batalha_host_${pin}=${hostToken}`,
      },
    });
    allSockets.push(hostWs);

    let hostRoomVersion = 0;
    const hostEvents: EventEnvelope<string, any>[] = [];
    let questionActivePromiseResolve: (question: any) => void;
    const questionActivePromise = new Promise<any>(resolve => {
      questionActivePromiseResolve = resolve;
    });

    let questionRevealPromiseResolve: (reveal: any) => void;
    const questionRevealPromise = new Promise<any>(resolve => {
      questionRevealPromiseResolve = resolve;
    });
    let rankingPromiseResolve: (ranking: any) => void;
    const rankingPromise = new Promise<any>(resolve => {
      rankingPromiseResolve = resolve;
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Host WS timeout')), 10000);
      hostWs.onmessage = (event) => {
        try {
          const env = JSON.parse(event.data as string) as EventEnvelope<string, any>;
          hostEvents.push(env);
          hostRoomVersion = env.roomVersion;
          if (env.type === ServerEventType.SNAPSHOT) {
            clearTimeout(timeout);
            resolve();
          } else if (env.type === ServerEventType.QUESTION_STARTED) {
            questionActivePromiseResolve(env.payload);
          } else if (env.type === ServerEventType.ANSWER_REVEAL) {
            questionRevealPromiseResolve(env.payload);
          } else if (env.type === ServerEventType.RANKING_UPDATED) {
            rankingPromiseResolve(env.payload);
          }
        } catch {
          // ignore
        }
      };
      hostWs.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    });
    console.log(`[Load Test] Host connected and initial SNAPSHOT received.`);

    // 3. Connect 2 Screen WebSockets
    console.log(`[Load Test] Connecting ${config.screenCount} Screen WebSockets...`);
    const screenSockets: WebSocket[] = [];
    const screenEventStreams: any[][] = [];
    for (let s = 1; s <= config.screenCount; s++) {
      const screenWsUrl = `${wsOrigin}/api/rooms/${pin}/ws?role=screen`;
      const screenWs = new WebSocket(screenWsUrl);
      allSockets.push(screenWs);
      screenSockets.push(screenWs);
      const screenEvents: any[] = [];
      screenEventStreams.push(screenEvents);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Screen ${s} WS timeout`)), 10000);
        screenWs.onmessage = (event) => {
          try {
            const env = JSON.parse(event.data as string);
            screenEvents.push(env);
            if (env.type === ServerEventType.SNAPSHOT) {
              clearTimeout(timeout);
              resolve();
            }
          } catch {
            // ignore
          }
        };
        screenWs.onerror = (err) => {
          clearTimeout(timeout);
          reject(err);
        };
      });
    }
    console.log(`[Load Test] All ${config.screenCount} Screens connected and received initial SNAPSHOT.`);

    // 4. Concurrently connect 50 players and join room
    console.log(`[Load Test] Concurrently connecting ${config.playerCount} Players...`);
    interface PlayerSession {
      index: number;
      ws: WebSocket;
      playerId: string;
      nickname: string;
      reconnectToken: string;
      currentQuestion: any;
      latencyMs: number;
      answerAccepted: boolean;
      chosenOptionId: string;
      acceptedAt: number | null;
      joinedAt: number;
      joinOrder: number;
    }

    const playerSessions: PlayerSession[] = [];
    const playerConnectPromises = Array.from({ length: config.playerCount }, async (_, i) => {
      await delay(i * 15);
      const playerIndex = i + 1;
      const nickname = `Competidor_${String(playerIndex).padStart(2, '0')}`;
      const playerWsUrl = `${wsOrigin}/api/rooms/${pin}/ws?role=player`;
      const pWs = new WebSocket(playerWsUrl);
      allSockets.push(pWs);

      const session: PlayerSession = {
        index: playerIndex,
        ws: pWs,
        playerId: '',
        nickname,
        reconnectToken: '',
        currentQuestion: null,
        latencyMs: 0,
        answerAccepted: false,
        chosenOptionId: '',
        acceptedAt: null,
        joinedAt: 0,
        joinOrder: 0,
      };
      playerSessions.push(session);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Player ${nickname} join timeout`)), 15000);

        pWs.onopen = () => {
          pWs.send(JSON.stringify(createClientEnvelope(ClientEventType.JOIN_ROOM, { pin, nickname }, 0)));
        };

        pWs.onmessage = (event) => {
          try {
            const env = JSON.parse(event.data as string) as EventEnvelope<string, any>;
            if (env.type === ServerEventType.SESSION_ACCEPTED) {
              session.playerId = env.payload.playerId;
              session.reconnectToken = env.payload.reconnectToken;
              clearTimeout(timeout);
              resolve();
            } else if (env.type === ServerEventType.QUESTION_STARTED) {
              session.currentQuestion = env.payload.question;
            }
          } catch {
            // ignore
          }
        };

        pWs.onerror = (err: any) => {
          clearTimeout(timeout);
          reject(new Error(`Player ${nickname} WS error: ${err.message || err.error?.message || err.type || String(err)}`));
        };
      });
    });

    await Promise.all(playerConnectPromises);
    const joinedEvents = hostEvents.filter(event => event.type === ServerEventType.PLAYER_JOINED);
    for (const session of playerSessions) {
      const eventIndex = joinedEvents.findIndex(event => event.payload.playerId === session.playerId);
      const joinedEvent = joinedEvents[eventIndex];
      session.joinedAt = joinedEvent?.payload.joinedAt ?? 0;
      session.joinOrder = eventIndex;
    }
    console.log(`[Load Test] Successfully connected and enrolled all ${config.playerCount} players in room lobby!`);

    // 5. Host starts the game
    console.log(`[Load Test] Host triggering START_GAME...`);
    hostWs.send(
      JSON.stringify(
        createClientEnvelope(
          ClientEventType.HOST_COMMAND,
          { command: 'START_GAME', expectedRoomVersion: hostRoomVersion },
          hostRoomVersion
        )
      )
    );

    // Wait for Question 1 to become active
    console.log(`[Load Test] Waiting for question activation across all clients...`);
    const activeQuestionData = await questionActivePromise;
    const activeQuestion = activeQuestionData.question;
    console.log(`[Load Test] Question active: "${activeQuestion.prompt}" (${activeQuestion.options.length} options)`);

    // 6. Burst submission: 50 players submit answers within 2 seconds
    console.log(`[Load Test] Firing concurrent answer burst from all 50 players within ${config.burstDurationMs}ms window...`);
    const latenciesMs: number[] = [];

    const answerSubmissionPromises = playerSessions.map(async (session) => {
      // Random jitter within the 2000ms window
      const jitterMs = Math.floor(Math.random() * config.burstDurationMs);
      await delay(jitterMs);

      // Deterministic fixture: even players answer correctly; odd players
      // choose the first known-wrong option.
      const canonicalQuestion = questions[0];
      const wrongOption = activeQuestion.options.find((option: any) => option.id !== canonicalQuestion.correctOptionId);
      const chosenOption = session.index % 2 === 0
        ? activeQuestion.options.find((option: any) => option.id === canonicalQuestion.correctOptionId)
        : wrongOption;
      if (!chosenOption) throw new Error('Load fixture could not resolve a deterministic option');
      session.chosenOptionId = chosenOption.id;
      const sendTime = Date.now();

      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`[Load Test] Timeout waiting for answer ack on player ${session.nickname}`);
          resolve();
        }, 10000);

        const onMsg = (event: MessageEvent) => {
          try {
            const env = JSON.parse(event.data as string) as EventEnvelope<string, any>;
            if (env.type === ServerEventType.ANSWER_ACCEPTED) {
              const latency = Date.now() - sendTime;
              session.latencyMs = latency;
              session.answerAccepted = true;
              session.acceptedAt = env.payload.receivedAt;
              latenciesMs.push(latency);
              clearTimeout(timeout);
              session.ws.removeEventListener('message', onMsg);
              resolve();
            }
          } catch {
            // ignore
          }
        };

        session.ws.addEventListener('message', onMsg);

        session.ws.send(
          JSON.stringify(
            createClientEnvelope(
              ClientEventType.SUBMIT_ANSWER,
              {
                questionId: activeQuestion.id,
                questionVersion: 0,
                optionId: chosenOption.id,
              },
              0
            )
          )
        );
      });
    });

    await Promise.all(answerSubmissionPromises);

    // 7. Validate Section 11 requirements:
    // A. Rodada encerra & Estado final coerente
    console.log(`[Load Test] Waiting for round to automatically end and transition to reveal...`);
    const revealPayload = await Promise.race([
      questionRevealPromise,
      delay(8000).then(() => { throw new Error('Timeout waiting for automatic round close'); }),
    ]);
    const roundClosed = Boolean(revealPayload && (revealPayload.correctOptionId || revealPayload.questionId));
    console.log(`[Load Test] Round ended automatically: ${roundClosed ? 'PASSED' : 'FAILED'}`);

    const rankingPayload = await Promise.race([
      rankingPromise,
      delay(10000).then(() => { throw new Error('Timeout waiting for automatic ranking'); }),
    ]);

    // B. Respostas únicas & Nenhuma perda & Nenhuma duplicação
    const acceptedCount = playerSessions.filter(s => s.answerAccepted).length;
    const droppedCount = config.playerCount - acceptedCount;
    const uniquePlayerIds = new Set(playerSessions.map(s => s.playerId));
    const uniqueAcceptedIds = new Set(playerSessions.filter(s => s.answerAccepted).map(s => s.playerId));
    const uniqueAnswersValid = uniquePlayerIds.size === config.playerCount && uniqueAcceptedIds.size === config.playerCount;
    const noLossValid = acceptedCount === config.playerCount && droppedCount === 0;

    // C. Conexões recuperáveis: disconnect 1 player and reconnect via RESUME_SESSION
    console.log(`[Load Test] Testing connection recovery for Player 1 via RESUME_SESSION...`);
    const testPlayer = playerSessions[0];
    testPlayer.ws.close(1000, 'Test disconnection');
    await delay(200);

    const reconWs = new WebSocket(`${wsOrigin}/api/rooms/${pin}/ws?role=player`);
    allSockets.push(reconWs);
    let recoverySuccessful = false;

    await new Promise<void>((resolve, reject) => {
      const reconTimeout = setTimeout(() => reject(new Error('Player recovery timeout')), 10000);

      reconWs.onopen = () => {
        reconWs.send(
          JSON.stringify(
            createClientEnvelope(
              ClientEventType.RESUME_SESSION,
              { pin, reconnectToken: testPlayer.reconnectToken },
              0
            )
          )
        );
      };

      reconWs.onmessage = (event) => {
        try {
          const env = JSON.parse(event.data as string) as EventEnvelope<string, any>;
          if (env.type === ServerEventType.SESSION_ACCEPTED) {
            if (env.payload.playerId === testPlayer.playerId) {
              recoverySuccessful = true;
            }
          } else if (env.type === ServerEventType.SNAPSHOT) {
            clearTimeout(reconTimeout);
            resolve();
          }
        } catch {
          // ignore
        }
      };

      reconWs.onerror = (err) => {
        clearTimeout(reconTimeout);
        reject(err);
      };
    });
    console.log(`[Load Test] Connection recovery: ${recoverySuccessful ? 'PASSED' : 'FAILED'}`);

    // D. RoomVersion coerente
    const versionCoherent = hostRoomVersion >= config.playerCount;
    console.log(`[Load Test] Room version consistency: v${hostRoomVersion} (Coherent: ${versionCoherent ? 'PASSED' : 'FAILED'})`);

    const totalDurationMs = Date.now() - startTime;
    latenciesMs.sort((a, b) => a - b);

    const minLatencyMs = latenciesMs.length > 0 ? latenciesMs[0] : 0;
    const p50LatencyMs = latenciesMs.length > 0 ? latenciesMs[Math.floor(latenciesMs.length * 0.50)] : 0;
    const p90LatencyMs = latenciesMs.length > 0 ? latenciesMs[Math.floor(latenciesMs.length * 0.90)] : 0;
    const p95LatencyMs = latenciesMs.length > 0 ? latenciesMs[Math.floor(latenciesMs.length * 0.95)] : 0;
    const p99LatencyMs = latenciesMs.length > 0 ? latenciesMs[Math.floor(latenciesMs.length * 0.99)] : 0;
    const maxLatencyMs = latenciesMs.length > 0 ? latenciesMs[latenciesMs.length - 1] : 0;

    const latencySlaPassed = p95LatencyMs <= config.maxP95LatencyMs;

    // ─── 12 MANDATORY EXPLICIT ASSERTIONS ───────────────────────
    // 1. Host Connected & Received Snapshot
    const assertion1_hostConnected = true;
    // 2. Screens Connected & Received Snapshot
    const assertion2_screensConnected = screenSockets.length === config.screenCount;
    // 3. Players Connected
    const assertion3_playersConnected = playerSessions.length === config.playerCount;
    // 4. Zero Dropped Answers (50/50 accepted)
    const assertion4_noLoss = noLossValid;
    // 5. Unique Answers (no duplicates)
    const assertion5_uniqueAnswers = uniqueAnswersValid;
    // 6. Exactly 1 QUESTION_ENDED broadcast received on host
    const questionEndedEvents = hostEvents.filter(e => e.type === ServerEventType.QUESTION_ENDED);
    const assertion6_singleQuestionEnded = questionEndedEvents.length === 1;
    // 7. Exactly 1 ANSWER_REVEAL broadcast received on host
    const answerRevealEvents = hostEvents.filter(e => e.type === ServerEventType.ANSWER_REVEAL);
    const assertion7_singleAnswerReveal = answerRevealEvents.length === 1;
    // 8. No duplicate logical transitions: monotonic versions, unique event IDs,
    // exact critical-event cardinality, and convergence across host/screens.
    const hostVersions = hostEvents.map(e => e.roomVersion);
    const versionsMonotonic = hostVersions.every((v, idx) => idx === 0 || v >= hostVersions[idx - 1]);
    const hostEventIds = hostEvents.map(event => event.eventId);
    const hostEventIdsUnique = new Set(hostEventIds).size === hostEventIds.length;
    const criticalCountsValid = [
      ServerEventType.QUESTION_ENDED,
      ServerEventType.ANSWER_REVEAL,
      ServerEventType.RANKING_UPDATED,
    ].every(type => hostEvents.filter(event => event.type === type).length === 1);
    const stateTransitions = hostEvents.filter(event => event.type === ServerEventType.GAME_STATE_CHANGED);
    const logicalStateKeys = stateTransitions.map(event => `${event.payload?.state}:${event.roomVersion}`);
    const logicalTransitionsUnique = new Set(logicalStateKeys).size === logicalStateKeys.length;
    const hostLastState = [...stateTransitions].at(-1);
    const screensConverged = screenEventStreams.every(events => {
      const ids = events.map(event => event.eventId);
      const idsUnique = new Set(ids).size === ids.length;
      const lastState = [...events.filter(event => event.type === ServerEventType.GAME_STATE_CHANGED)].at(-1);
      return idsUnique
        && lastState?.payload?.state === hostLastState?.payload?.state
        && lastState?.roomVersion === hostLastState?.roomVersion;
    });
    const assertion8_noDuplicateTransitions = versionsMonotonic
      && hostEventIdsUnique
      && criticalCountsValid
      && logicalTransitionsUnique
      && screensConverged;
    // 9. Anti-spoiler: screen ROUND_PROGRESS did not leak answer distribution or correct option
    const screenProgressEvents = screenEventStreams.flatMap(events => events)
      .filter(e => e.type === ServerEventType.ROUND_PROGRESS);
    const assertion9_noLeakOnScreen = screenProgressEvents.every(e => e.payload?.distribution === undefined && e.payload?.correctOptionId === undefined);
    // 10. Ranking expected is derived independently from known submitted answers,
    // scoring and explicit tie-breakers.
    const canonicalQuestion = questions[0];
    const actualRanking = rankingPayload.rankings ?? [];

    const allPlayersPresent = actualRanking.length === config.playerCount;
    const correctPlayers = actualRanking.slice(0, 25);
    const incorrectPlayers = actualRanking.slice(25);

    const correctValid = correctPlayers.every((entry: any, idx: number) => {
      const session = playerSessions.find(s => s.playerId === entry.playerId);
      const isEven = session && session.index % 2 === 0;
      const timeValid = idx === 0 || entry.correctResponseTimeMs >= correctPlayers[idx - 1].correctResponseTimeMs;
      return isEven && entry.totalPoints === 125 && entry.correctCount === 1 && timeValid && entry.position === idx + 1;
    });

    const incorrectValid = incorrectPlayers.every((entry: any, idx: number) => {
      const session = playerSessions.find(s => s.playerId === entry.playerId);
      const isOdd = session && session.index % 2 !== 0;
      return isOdd && entry.totalPoints === 0 && entry.correctCount === 0 && entry.correctResponseTimeMs === 0 && entry.position === idx + 26;
    });

    const assertion10_deterministicRanking = allPlayersPresent && correctValid && incorrectValid;
    // 11. Connection recovery via RESUME_SESSION verified
    const assertion11_recovery = recoverySuccessful;
    // 12. Latency SLA met (p95 < 500ms)
    const assertion12_latencySla = latencySlaPassed;

    const all12AssertionsPassed = 
      assertion1_hostConnected &&
      assertion2_screensConnected &&
      assertion3_playersConnected &&
      assertion4_noLoss &&
      assertion5_uniqueAnswers &&
      assertion6_singleQuestionEnded &&
      assertion7_singleAnswerReveal &&
      assertion8_noDuplicateTransitions &&
      assertion9_noLeakOnScreen &&
      assertion10_deterministicRanking &&
      assertion11_recovery &&
      assertion12_latencySla;

    const success = all12AssertionsPassed && roundClosed && versionCoherent;

    console.log(`\n======================================================`);
    console.log(`            WEBSOCKET LOAD TEST RESULTS               `);
    console.log(`======================================================`);
    console.log(`PIN: ${pin}`);
    console.log(`Host Connected: 1/1 | Screens Connected: ${config.screenCount}/${config.screenCount}`);
    console.log(`Players Connected: ${playerSessions.length}/${config.playerCount}`);
    console.log(`\n--- 12 MANDATORY EXPLICIT ASSERTIONS ---`);
    console.log(`[ASSERTION 1] Host Connected & Snapshot: ${assertion1_hostConnected ? 'PASSED' : 'FAILED'}`);
    console.log(`[ASSERTION 2] Screens Connected (${config.screenCount}/${config.screenCount}): ${assertion2_screensConnected ? 'PASSED' : 'FAILED'}`);
    console.log(`[ASSERTION 3] 50 Players Connected: ${assertion3_playersConnected ? 'PASSED' : 'FAILED'}`);
    console.log(`[ASSERTION 4] Zero Dropped Answers (0 lost): ${assertion4_noLoss ? 'PASSED' : 'FAILED'}`);
    console.log(`[ASSERTION 5] Respostas Únicas (sem duplicação): ${assertion5_uniqueAnswers ? 'PASSED' : 'FAILED'}`);
    console.log(`[ASSERTION 6] Fechamento Único (QUESTION_ENDED count=1): ${assertion6_singleQuestionEnded ? 'PASSED' : 'FAILED'}`);
    console.log(`[ASSERTION 7] Reveal Único (ANSWER_REVEAL count=1): ${assertion7_singleAnswerReveal ? 'PASSED' : 'FAILED'}`);
    console.log(`[ASSERTION 8] Transições únicas (version/eventId/cardinalidade/convergência): ${assertion8_noDuplicateTransitions ? 'PASSED' : 'FAILED'}`);
    console.log(`[ASSERTION 9] Anti-Spoiler no Telão (sem gabarito no progresso): ${assertion9_noLeakOnScreen ? 'PASSED' : 'FAILED'}`);
    console.log(`[ASSERTION 10] Ranking esperado == ranking real: ${assertion10_deterministicRanking ? 'PASSED' : 'FAILED'}`);
    console.log(`[ASSERTION 11] Recuperação de Conexão (RESUME_SESSION): ${assertion11_recovery ? 'PASSED' : 'FAILED'}`);
    console.log(`[ASSERTION 12] Latência SLA p95 < ${config.maxP95LatencyMs}ms: ${assertion12_latencySla ? 'PASSED' : 'FAILED'}`);
    console.log(`----------------------------------------`);
    console.log(`Rodada Encerra Automaticamente: ${roundClosed ? 'PASSED' : 'FAILED'}`);
    console.log(`RoomVersion Coerente: ${versionCoherent ? `PASSED (v${hostRoomVersion})` : 'FAILED'}`);
    console.log(`Answers Accepted: ${acceptedCount}/${config.playerCount} (${((acceptedCount / config.playerCount) * 100).toFixed(1)}%)`);
    console.log(`Dropped Answers: ${droppedCount} (0% target: ${droppedCount === 0 ? 'PASSED' : 'FAILED'})`);
    console.log(`Latency SLA:`);
    console.log(`  Min:  ${minLatencyMs}ms`);
    console.log(`  p50:  ${p50LatencyMs}ms`);
    console.log(`  p90:  ${p90LatencyMs}ms`);
    console.log(`  p95:  ${p95LatencyMs}ms (Limit: ${config.maxP95LatencyMs}ms — ${latencySlaPassed ? 'PASSED' : 'FAILED'})`);
    console.log(`  p99:  ${p99LatencyMs}ms`);
    console.log(`  Max:  ${maxLatencyMs}ms`);
    console.log(`Total Duration: ${totalDurationMs}ms`);
    console.log(`Overall Result: ${success ? 'PASSED (100% SUCCESS)' : 'FAILED'}`);
    console.log(`======================================================\n`);

    // Clean up all WebSockets
    for (const ws of allSockets) {
      try {
        ws.close(1000, 'Load test complete');
      } catch {
        // ignore
      }
    }

    return {
      success,
      totalConnections: allSockets.length,
      playersConnected: playerSessions.length,
      screensConnected: config.screenCount,
      hostConnected: true,
      answersSubmitted: config.playerCount,
      answersAccepted: acceptedCount,
      droppedAnswers: droppedCount,
      latenciesMs,
      minLatencyMs,
      p50LatencyMs,
      p90LatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      maxLatencyMs,
      durationMs: totalDurationMs,
    };
  } finally {
    if (spawnedServer) {
      console.log(`[Load Test] Shutting down spawned dev server...`);
      if (process.platform === 'win32' && spawnedServer.pid) {
        try {
          execFileSync('taskkill', ['/pid', String(spawnedServer.pid), '/T', '/F'], { stdio: 'ignore' });
        } catch {
          spawnedServer.kill();
        }
      } else {
        spawnedServer.kill();
      }
    }
  }
}

// Execute directly if run via CLI (tsx tests/load/websocket-load.ts)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('websocket-load.ts')) {
  runWebSocketLoadTest()
    .then((metrics) => {
      if (!metrics.success) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('[Load Test] Fatal error:', err);
      process.exit(1);
    });
}

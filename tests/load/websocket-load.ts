import { spawn, ChildProcess } from 'node:child_process';
import {
  ClientEventType,
  ServerEventType,
  createClientEnvelope,
  EventEnvelope,
} from '../../packages/protocol/src/index';

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
  const child = spawn('pnpm', ['dev'], {
    shell: true,
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
    const { pin, hostToken } = (await roomRes.json()) as { pin: string; hostToken: string };
    console.log(`[Load Test] Room created successfully. PIN: ${pin}`);

    const wsOrigin = config.baseUrl.replace(/^http/, 'ws');
    const allSockets: WebSocket[] = [];

    // 2. Connect 1 Host WebSocket
    console.log(`[Load Test] Connecting Host WebSocket...`);
    const hostWsUrl = `${wsOrigin}/api/rooms/${pin}/ws?role=host&token=${hostToken}`;
    const hostWs = new WebSocket(hostWsUrl);
    allSockets.push(hostWs);

    let hostRoomVersion = 0;
    let questionActivePromiseResolve: (question: any) => void;
    const questionActivePromise = new Promise<any>(resolve => {
      questionActivePromiseResolve = resolve;
    });

    let questionRevealPromiseResolve: (reveal: any) => void;
    const questionRevealPromise = new Promise<any>(resolve => {
      questionRevealPromiseResolve = resolve;
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Host WS timeout')), 10000);
      hostWs.onmessage = (event) => {
        try {
          const env = JSON.parse(event.data as string) as EventEnvelope<string, any>;
          hostRoomVersion = env.roomVersion;
          if (env.type === ServerEventType.SNAPSHOT) {
            clearTimeout(timeout);
            resolve();
          } else if (env.type === ServerEventType.QUESTION_STARTED) {
            questionActivePromiseResolve(env.payload);
          } else if (env.type === ServerEventType.ANSWER_REVEAL || env.type === ServerEventType.QUESTION_ENDED) {
            questionRevealPromiseResolve(env.payload);
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
    for (let s = 1; s <= config.screenCount; s++) {
      const screenWsUrl = `${wsOrigin}/api/rooms/${pin}/ws?role=screen`;
      const screenWs = new WebSocket(screenWsUrl);
      allSockets.push(screenWs);
      screenSockets.push(screenWs);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Screen ${s} WS timeout`)), 10000);
        screenWs.onmessage = (event) => {
          try {
            const env = JSON.parse(event.data as string);
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
    }

    const playerSessions: PlayerSession[] = [];
    const playerConnectPromises = Array.from({ length: config.playerCount }, async (_, i) => {
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

        pWs.onerror = (err) => {
          clearTimeout(timeout);
          reject(err);
        };
      });
    });

    await Promise.all(playerConnectPromises);
    console.log(`[Load Test] Successfully connected and enrolled all ${config.playerCount} players in room lobby!`);

    // 5. Host starts the game
    console.log(`[Load Test] Host triggering START_GAME...`);
    hostWs.send(
      JSON.stringify(
        createClientEnvelope(
          ClientEventType.HOST_COMMAND,
          { command: 'START_GAME', expectedRoomVersion: 99999 },
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

      // Select option
      const chosenOption = activeQuestion.options[session.index % activeQuestion.options.length];
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

    // Wait for question reveal event indicating server processed all answers
    await Promise.race([questionRevealPromise, delay(5000)]);

    const totalDurationMs = Date.now() - startTime;
    latenciesMs.sort((a, b) => a - b);

    const minLatencyMs = latenciesMs.length > 0 ? latenciesMs[0] : 0;
    const p50LatencyMs = latenciesMs.length > 0 ? latenciesMs[Math.floor(latenciesMs.length * 0.50)] : 0;
    const p90LatencyMs = latenciesMs.length > 0 ? latenciesMs[Math.floor(latenciesMs.length * 0.90)] : 0;
    const p95LatencyMs = latenciesMs.length > 0 ? latenciesMs[Math.floor(latenciesMs.length * 0.95)] : 0;
    const p99LatencyMs = latenciesMs.length > 0 ? latenciesMs[Math.floor(latenciesMs.length * 0.99)] : 0;
    const maxLatencyMs = latenciesMs.length > 0 ? latenciesMs[latenciesMs.length - 1] : 0;

    const acceptedCount = playerSessions.filter(s => s.answerAccepted).length;
    const droppedCount = config.playerCount - acceptedCount;
    const success = acceptedCount === config.playerCount && p95LatencyMs <= config.maxP95LatencyMs;

    console.log(`\n======================================================`);
    console.log(`            WEBSOCKET LOAD TEST RESULTS               `);
    console.log(`======================================================`);
    console.log(`PIN: ${pin}`);
    console.log(`Host Connected: 1/1 | Screens Connected: ${config.screenCount}/${config.screenCount}`);
    console.log(`Players Connected: ${playerSessions.length}/${config.playerCount}`);
    console.log(`Answers Accepted: ${acceptedCount}/${config.playerCount} (${((acceptedCount / config.playerCount) * 100).toFixed(1)}%)`);
    console.log(`Dropped Answers: ${droppedCount} (0% target: ${droppedCount === 0 ? 'PASSED' : 'FAILED'})`);
    console.log(`Latency SLA:`);
    console.log(`  Min:  ${minLatencyMs}ms`);
    console.log(`  p50:  ${p50LatencyMs}ms`);
    console.log(`  p90:  ${p90LatencyMs}ms`);
    console.log(`  p95:  ${p95LatencyMs}ms (Limit: ${config.maxP95LatencyMs}ms — ${p95LatencyMs <= config.maxP95LatencyMs ? 'PASSED' : 'FAILED'})`);
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
      spawnedServer.kill();
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

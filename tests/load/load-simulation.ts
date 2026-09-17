/**
 * Batalha Anatômica - 50-Player Concurrent Load Simulation (P3.4)
 * Delegates to the real WebSocket load testing engine in websocket-load.ts
 */
export { runWebSocketLoadTest as runLoadSimulation, type LoadTestConfig as LoadSimulationConfig } from './websocket-load';

import { runWebSocketLoadTest } from './websocket-load';

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('load-simulation.ts')) {
  runWebSocketLoadTest()
    .then((metrics) => {
      if (!metrics.success) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

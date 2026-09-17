# E2E Test Infra: Batalha Anatômica

## Test Philosophy
- Opaque-box, requirement-driven. Derived strictly from `ORIGINAL_REQUEST.md` and user requirements.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise + Real-World Workloads.

## Feature Inventory & Test Coverage
| # | Feature | Source | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Pairwise) |
|---|---------|--------|:-----------------:|:-----------------:|:-----------------:|
| 1 | Host Snapshot | P0.1 | Host connects & gets LOBBY | Reconnect / page reload | Host + Screen + Player |
| 2 | Player Lifecycle | P0.2 | Connect, disconnect, resume | Resume with active question / post-answer | Resume during countdown / reveal |
| 3 | Room Versioning | P0.3 | Sequential version increment | Duplicate eventId discarded | Version gap triggers snapshot |
| 4 | WebSocket Hibernation | P0.4 | Connection attachment preserved | Idle timeout, wake-up answer | Multiple concurrent hibernations |
| 5 | 10th Question Machine | P0.5 | Transitions Q1-Q10 | Q10 reveal -> FINAL_RANKING | FINAL_RANKING -> PODIUM -> FINISHED |
| 6 | Authoritative Validation | P0.6 | Valid answer accepted | Out of time, invalid option, duplicate | Answer submitted during pause |
| 7 | Pause / Resume Bonus | P0.7 | Pause & resume round | 9999ms vs 10001ms boundary | Pause across 10s bonus boundary |
| 8 | Presenter Screen Link | P1.1 | "Abrir Telão" opens `/screen/:pin` | Multi-screen instances | Host navigation vs Screen sync |
| 9 | 3-2-1 Countdown | P1.2 | Synchronized 3-2-1 in PT | Fast transitions | Countdown across multiple tabs |
| 10 | Realtime Feedback | P1.3 | Correct answer & distribution | Score calculation, bonus display | Multi-player distribution bars |
| 11 | Answer Lock | P1.4 | Immediate click lock | Reload preserves lock | Reconnect before reveal |
| 12 | 6 Mechanics & Q10 | P1.5 | All 6 types verified | Boolean has 2 options, Q10 300pts | Full 10-question sequence |
| 13 | Asset Sanitization | P1.6 | 10 SVGs inspected | No spoiler text tags | High-res & small-res rendering |
| 14 | Audio Toggle | P1.7 | Sound feedback active | Storage toggle persistence | Audio state across pages |
| 15 | Host Security | P1.8 | Host token required for host API | Invalid token rejected | PIN cannot access host API |
| 16 | Rate Limiting | P1.9 | Room creation limited | Rapid room creation burst | Oversized WS message rejected |

## Test Architecture
- **Unit Tests**: `packages/game`, `packages/content` using `pnpm test` (Vitest).
- **Integration Tests**: Worker & Durable Object tests using Miniflare / Vitest.
- **E2E Tests**: Playwright browser suite (`tests/e2e/game-flow.spec.ts`).
- **Load Test**: 50 concurrent WebSocket clients (`tests/load/websocket-load.ts`).

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full 10-Question Arena Game | Host + Screen + 3 Players, complete run to podium | High |
| 2 | Mid-Game Player Reconnection | Player drops during Q5, resumes during Q6, preserves score | High |
| 3 | Pause/Resume Speed Bonus Stress | Host pauses during Question 3, resumes, verifies speed bonus | Medium |
| 4 | 50-Player Concurrent Flash Mob | 50 WebSockets join, answer simultaneously within 2s | High |

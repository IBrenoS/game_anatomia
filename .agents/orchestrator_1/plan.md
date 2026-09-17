# Orchestration Plan — Batalha Anatômica

## Objective
Deliver complete audit, fix, and verification of Batalha Anatômica — Bovino × Equino according to R1 (P0), R2 (P1), R3 (P2), R4 (P3), and R5 (P4).

## Phases

### Phase 0: Survey & Codebase Mapping (Parallel Explorers)
- Dispatch 3 Explorers in parallel:
  - **Explorer 1 (Realtime & Worker/DO Backend)**: Investigate Durable Object WebSocket lifecycle, hibernation, roomVersion, snapshot generation, player reconnection, pause/resume bonus window, 10th question state transition, and rate limiting.
  - **Explorer 2 (Frontend UI, Telão, Audio & Game Loop)**: Investigate host snapshot loading, player reconnection persistence, screen (`/screen/:pin`), countdown synchronization, answer lock, audio controls, live lobby, hierarchy, ranking, podium ceremony, reduced motion.
  - **Explorer 3 (Content, Images & Test Infrastructure)**: Investigate questions JSON (6 mechanics, comparative final question), images sanitization (labels/text check), existing unit/integration/E2E test setup, and load test capability.
- Aggregate reports into `PROJECT.md` (Architecture, Feature Inventory, Milestones, Interface Contracts, Code Layout).

### Phase 1: Dual Track Execution
- **Implementation Track**:
  - Sub-orchestrators for decomposed milestones (or iteration loops):
    - M1: Backend Realtime & State Machine Stabilization (R1: P0.1 - P0.7, P1.8, P1.9)
    - M2: Pedagogical Content, Mechanics & Visual Assets (R2: P1.5, P1.6)
    - M3: Frontend Experience, Screen, Audio & Arena Atmosphere (R2: P1.1-P1.4, P1.7, R3: P2.1-P2.4)
- **E2E Testing Track (Parallel)**:
  - Establish opaque-box test suite (unit tests, Worker + DO tests, Playwright E2E, 50-conn WebSocket load test).
  - Produce `TEST_READY.md`.

### Phase 2: Final Integration & Hardening
- Phase 1: Run 100% E2E tests (Tiers 1-4).
- Phase 2: Adversarial Coverage Hardening (Tier 5) with Challengers & Reviewers.

### Phase 3: Comprehensive Audit & Final Reporting
- Forensic Auditor integrity review.
- Compile `AUDIT_FIX_REPORT.md` with root causes, requirement mapping, test logs, load test metrics, and limitations.
- Deliver completion report to user and parent.

# Host + Player Dual Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o criador escolha jogar ou apenas apresentar, mantendo sessões Host e Player independentes no mesmo navegador, sem vantagem competitiva e com restauração completa.

**Architecture:** Um registry fornece um `WebSocketManager` independente por papel. No modo combinado, somente a conexão Player sincroniza o estado competitivo renderizado; a conexão Host permanece isolada para autenticação, comandos e lifecycle. A escolha explícita e o token Player são persistidos por PIN, e a interface Host reutiliza componentes Player durante as fases competitivas.

**Tech Stack:** React 19, React Router 7, TypeScript 5.6, Zustand 5, Vitest 2, Playwright 1.63, Cloudflare Workers, Durable Objects SQLite e WebSockets hibernáveis.

**Spec:** `docs/superpowers/specs/2026-09-19-host-player-dual-session-design.md`

## Global Constraints

- Host continua autenticado exclusivamente pelo cookie HttpOnly existente.
- Player mantém `playerId` e `reconnectToken` próprios; nunca usar `playerId = hostId`.
- Não criar o papel público `host_player`.
- Reutilizar `JOIN_ROOM`, `RESUME_SESSION`, presença, snapshot, scoring, ranking e pódio existentes.
- Não alterar game loop, duração, perguntas, alarm scheduler, limite de 50 jogadores ou Screen além do roteamento necessário.
- Não adicionar dependências.
- Não implementar troca de modo durante a partida.
- Durante `QUESTION_ACTIVE`, o store renderizado no modo combinado não recebe o snapshot Host com distribuição.

## File Structure

- Modify `apps/web/src/lib/ws.ts`: registry de managers por papel e lifecycle independente.
- Modify `apps/web/src/lib/ws.test.ts`: provas de coexistência, isolamento, reconnect e roteamento por papel.
- Create `apps/web/src/lib/ws.testUtils.ts`: fake WebSocket compartilhado somente pelos testes frontend.
- Create `apps/web/src/lib/hostParticipation.ts`: persistência por PIN e ingresso Player inicial aguardando `SESSION_ACCEPTED`.
- Create `apps/web/src/lib/hostParticipation.test.ts`: validação de modo, ingresso, erro e retry sem nova sala.
- Create `apps/web/src/lib/socketBindings.ts`: binding explícito de eventos de um manager para o `gameStore`.
- Create `apps/web/src/lib/socketBindings.test.ts`: isolamento entre snapshot Host e estado competitivo Player.
- Modify `apps/web/src/hooks/useGameSocket.ts`: hook parametrizado por papel e política de sincronização.
- Modify `apps/web/src/stores/gameStore.ts`: remover ownership global da conexão única e preservar apenas estado de jogo/identidade Player.
- Modify `apps/web/src/stores/gameStore.test.ts`: restauração Player e rejeição de dados privilegiados pela origem errada.
- Modify `apps/web/src/pages/HostEntryPage.tsx`: escolha de modo, apelido e criação/ingresso transacional.
- Modify `apps/web/src/pages/HostPage.tsx`: duas conexões simultâneas e superfície Player no modo combinado.
- Modify `apps/web/src/pages/JoinPage.tsx`, `PlayerPage.tsx`, `ScreenPage.tsx`: migração para managers por papel.
- Modify `apps/web/src/components/host/HostLobby.tsx`, `HostControls.tsx`: comandos enviados pelo manager Host e indisponibilidade explícita durante reconnect Host.
- Modify `apps/web/src/components/player/PlayerQuestion.tsx`, `PlayerFinished.tsx`: ações enviadas pelo manager Player.
- Modify `tests/integration/worker-game-room.test.ts`: sessão dupla real no Durable Object, contagens, resposta e resume sem duplicação.
- Create `tests/e2e/host-player.spec.ts`: T1–T12 na interface real.
- Modify `tests/e2e/game-flow.spec.ts` e `tests/e2e/scenarios.spec.ts`: selecionar explicitamente Presenter no fluxo legado.

## Review Focus

- Reload entre `JOIN_ROOM` e `SESSION_ACCEPTED`: a navegação só ocorre depois do token persistido e retry reutiliza a sala já criada.
- Token Player antigo sem escolha combinada para o PIN: Host permanece Presenter, sem promoção implícita.
- Host reconectando enquanto Player responde: resposta usa o socket Player e controles ficam indisponíveis sem bloquear a questão.
- Player reconectando enquanto Host controla: comandos continuam no socket Host e não criam um segundo Player.
- Evento Host privilegiado durante `QUESTION_ACTIVE`: não atravessa o binding competitivo nem altera `distribution`/`correctOptionId`.

---

### Task 1: Registry de conexões independentes

**Files:**
- Modify: `apps/web/src/lib/ws.ts`
- Modify: `apps/web/src/lib/ws.test.ts`
- Create: `apps/web/src/lib/ws.testUtils.ts`

**Interfaces:**
- Produces: `type GameSocketRole = 'host' | 'player' | 'screen'`
- Produces: `getWebSocketManager(role: GameSocketRole): WebSocketManager`
- Produces: `disconnectWebSocketManager(role: GameSocketRole): void`
- Produces for tests: `installFakeWebSocket(): { sockets: FakeWebSocket[]; emit(socket, envelope): void; cleanup(): void }`
- Preserves: `WebSocketManager.connect(pin: string, role: GameSocketRole, token?: string): void`

- [ ] **Step 1: Escrever testes falhando para coexistência e isolamento**

Adicionar casos literais em `ws.test.ts`:

```ts
it('T3: mantém sockets host e player simultâneos', () => {
  const host = getWebSocketManager('host');
  const player = getWebSocketManager('player');

  host.connect('123456', 'host');
  player.connect('123456', 'player', 'player-token');

  expect(host).not.toBe(player);
  expect(sockets).toHaveLength(2);
  expect(sockets[0].url).toContain('role=host');
  expect(sockets[1].url).toContain('role=player');
  expect(sockets[0].readyState).toBe(FakeWebSocket.CONNECTING);
});

it('T10: desconectar host não fecha player', () => {
  const host = getWebSocketManager('host');
  const player = getWebSocketManager('player');
  host.connect('123456', 'host');
  player.connect('123456', 'player', 'player-token');
  sockets.forEach(socket => socket.open());

  disconnectWebSocketManager('host');

  expect(sockets[0].readyState).toBe(3);
  expect(sockets[1].readyState).toBe(FakeWebSocket.OPEN);
  expect(player.state).toBe('connected');
});
```

Incluir limpeza chamando `disconnectWebSocketManager` para cada papel no `afterEach`.
Mover o `FakeWebSocket` já existente para `ws.testUtils.ts`; `installFakeWebSocket` deve instalar os globals, retornar a lista de sockets e restaurar os globals em `cleanup`.

- [ ] **Step 2: Executar RED**

Run: `pnpm vitest run apps/web/src/lib/ws.test.ts`

Expected: FAIL porque `getWebSocketManager` e `disconnectWebSocketManager` ainda não existem.

- [ ] **Step 3: Implementar registry mínimo**

Em `ws.ts`, tipar `currentRole`, `connect` e o registry:

```ts
export type GameSocketRole = 'host' | 'player' | 'screen';

const managers = new Map<GameSocketRole, WebSocketManager>();

export function getWebSocketManager(role: GameSocketRole): WebSocketManager {
  const existing = managers.get(role);
  if (existing) return existing;
  const manager = new WebSocketManager();
  managers.set(role, manager);
  return manager;
}

export function disconnectWebSocketManager(role: GameSocketRole): void {
  managers.get(role)?.disconnect();
}
```

Expor em desenvolvimento `window.__wsManagers` como objeto somente de inspeção, sem manter o alias singleton.

- [ ] **Step 4: Executar GREEN e regressão do manager**

Run: `pnpm vitest run apps/web/src/lib/ws.test.ts`

Expected: PASS em todos os testes, inclusive heartbeat, ordering, foreground e resume existentes.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/ws.ts apps/web/src/lib/ws.test.ts apps/web/src/lib/ws.testUtils.ts
git commit -m "feat: suportar conexoes websocket por papel"
```

### Task 2: Binding seletivo de eventos e hook por papel

**Files:**
- Create: `apps/web/src/lib/socketBindings.ts`
- Create: `apps/web/src/lib/socketBindings.test.ts`
- Modify: `apps/web/src/hooks/useGameSocket.ts`
- Modify: `apps/web/src/stores/gameStore.ts`
- Modify: `apps/web/src/stores/gameStore.test.ts`
- Modify: `apps/web/src/pages/JoinPage.tsx`
- Modify: `apps/web/src/pages/PlayerPage.tsx`
- Modify: `apps/web/src/pages/ScreenPage.tsx`

**Interfaces:**
- Consumes: `getWebSocketManager(role)` da Task 1.
- Produces: `bindGameSocketToStore(manager: WebSocketManager): () => void`
- Produces: `useGameSocket(role: GameSocketRole, options?: { syncStore?: boolean }): { manager: WebSocketManager; connect(pin: string, token?: string): void; disconnect(): void; connectionState: ConnectionState }`

- [ ] **Step 1: Escrever testes falhando para binding opt-in e identidade Player**

Em `socketBindings.test.ts`, usar managers reais com `installFakeWebSocket`, disparando envelopes por `emit`:

```ts
it('T5: snapshot host não alimenta store quando não possui binding', () => {
  const host = new WebSocketManager();
  const player = new WebSocketManager();
  const { sockets, emit } = installFakeWebSocket();
  const unbindPlayer = bindGameSocketToStore(player);
  host.connect('123456', 'host');
  player.connect('123456', 'player', 'token');
  sockets.forEach(socket => socket.open());

  emit(sockets[0], createServerEnvelope('SNAPSHOT', {
      room: { pin: '123456', status: 'QUESTION_ACTIVE', roomVersion: 2, currentQuestionIndex: 0 },
      distribution: [{ optionId: 'a', count: 4, percentage: 100 }],
      correctOptionId: 'a',
    }, 2));
  emit(sockets[1], createServerEnvelope('SNAPSHOT', {
      room: { pin: '123456', status: 'QUESTION_ACTIVE', roomVersion: 2, currentQuestionIndex: 0 },
      question: { id: 'q1', options: [{ id: 'a', label: 'A' }], durationMs: 60_000 },
      distribution: [],
      correctOptionId: null,
    }, 2));

  expect(useGameStore.getState().distribution).toEqual([]);
  expect(useGameStore.getState().correctOptionId).toBeNull();
  unbindPlayer();
});
```

Adicionar teste em `gameStore.test.ts` garantindo que `SESSION_ACCEPTED` Player preserva `playerId`, nickname e token após snapshots subsequentes.

- [ ] **Step 2: Executar RED**

Run: `pnpm vitest run apps/web/src/lib/socketBindings.test.ts apps/web/src/stores/gameStore.test.ts`

Expected: FAIL porque o binding extraído ainda não existe.

- [ ] **Step 3: Extrair binding e parametrizar hook**

Mover a lista atual de `onEvent` para `socketBindings.ts`, retornando cleanup único:

```ts
export function bindGameSocketToStore(manager: WebSocketManager): () => void {
  const unsubscribes = [
    manager.onEvent(ServerEventType.SESSION_ACCEPTED, payload => {
      useGameStore.getState().setSession(payload);
    }),
    manager.onEvent(ServerEventType.SNAPSHOT, payload => {
      useGameStore.getState().handleSnapshot(payload);
    }),
    // repetir explicitamente todos os handlers existentes
  ];
  return () => unsubscribes.forEach(unsubscribe => unsubscribe());
}
```

Reescrever o hook com estado local por manager:

```ts
export function useGameSocket(
  role: GameSocketRole,
  options: { syncStore?: boolean } = {},
) {
  const manager = getWebSocketManager(role);
  const [connectionState, setConnectionState] = useState(manager.state);
  const syncStore = options.syncStore ?? true;

  useEffect(() => {
    const unsubscribeState = manager.onStateChange(setConnectionState);
    const unsubscribeStore = syncStore ? bindGameSocketToStore(manager) : () => undefined;
    return () => { unsubscribeState(); unsubscribeStore(); };
  }, [manager, syncStore]);

  const connect = useCallback((pin: string, token?: string) => {
    useGameStore.getState().setPin(pin);
    manager.connect(pin, role, token);
  }, [manager, role]);

  return { manager, connect, disconnect: () => manager.disconnect(), connectionState };
}
```

Remover `connectionState`, `role`, `setConnectionState` e `setRole` do store depois de migrar consumidores. Atualizar `JoinPage`, `PlayerPage` e `ScreenPage` para `useGameSocket('player')` ou `useGameSocket('screen')` e usar o `manager` retornado.

- [ ] **Step 4: Executar GREEN e typecheck direcionado**

Run: `pnpm vitest run apps/web/src/lib/socketBindings.test.ts apps/web/src/stores/gameStore.test.ts apps/web/src/lib/ws.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS, provando que não restaram consumidores do singleton/estado global removidos.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/socketBindings.ts apps/web/src/lib/socketBindings.test.ts apps/web/src/hooks/useGameSocket.ts apps/web/src/stores/gameStore.ts apps/web/src/stores/gameStore.test.ts apps/web/src/pages/JoinPage.tsx apps/web/src/pages/PlayerPage.tsx apps/web/src/pages/ScreenPage.tsx
git commit -m "refactor: isolar sincronizacao websocket por papel"
```

### Task 3: Escolha explícita e ingresso Player do criador

**Files:**
- Create: `apps/web/src/lib/hostParticipation.ts`
- Create: `apps/web/src/lib/hostParticipation.test.ts`
- Modify: `apps/web/src/pages/HostEntryPage.tsx`

**Interfaces:**
- Consumes: `getWebSocketManager('player')` e `createRoom()`.
- Produces: `type HostParticipationMode = 'presenter' | 'player'`
- Produces: `getHostParticipation(pin: string): HostParticipationMode`
- Produces: `setHostParticipation(pin: string, mode: HostParticipationMode): void`
- Produces: `joinCreatedRoomAsPlayer(pin: string, nickname: string, manager: WebSocketManager): Promise<void>`

- [ ] **Step 1: Escrever testes falhando para persistência, sucesso e erro**

```ts
it('T1: PIN sem escolha explícita permanece presenter mesmo com token player', () => {
  localStorage.setItem('batalha_session_123456', 'old-token');
  expect(getHostParticipation('123456')).toBe('presenter');
});

it('T2: resolve ingresso somente após SESSION_ACCEPTED', async () => {
  const { sockets, emit } = installFakeWebSocket();
  const manager = new WebSocketManager();
  let resolved = false;
  const promise = joinCreatedRoomAsPlayer('123456', 'Breno', manager);
  promise.then(() => { resolved = true; });
  sockets[0].open();
  expect(JSON.parse(sockets[0].sentMessages[0])).toMatchObject({
    type: 'JOIN_ROOM', payload: { pin: '123456', nickname: 'Breno' },
  });
  await Promise.resolve();
  expect(resolved).toBe(false);
  emit(sockets[0], createServerEnvelope('SESSION_ACCEPTED', {
    playerId: 'p1', reconnectToken: 'token', nickname: 'Breno', role: 'player',
  }, 1));
  await expect(promise).resolves.toBeUndefined();
});

it('mantém a mesma sala disponível para retry após erro protocolar', async () => {
  const { sockets, emit } = installFakeWebSocket();
  const manager = new WebSocketManager();
  const promise = joinCreatedRoomAsPlayer('123456', 'Breno', manager);
  sockets[0].open();
  emit(sockets[0], createServerEnvelope('ERROR', {
    code: 'NICKNAME_TAKEN', message: 'Nickname is taken',
  }, 1));
  await expect(promise).rejects.toMatchObject({ code: 'NICKNAME_TAKEN' });
  expect(sockets[0].url).toContain('/api/rooms/123456/ws');
});
```

- [ ] **Step 2: Executar RED**

Run: `pnpm vitest run apps/web/src/lib/hostParticipation.test.ts`

Expected: FAIL porque o módulo não existe.

- [ ] **Step 3: Implementar serviço e formulário**

Usar chave `batalha_host_participation_${pin}` e default seguro `presenter`. O ingresso deve registrar listeners antes de conectar, limpar todos em resolve/reject e nunca chamar `JOIN_ROOM` duas vezes para a mesma abertura.

Em `HostEntryPage`, representar os estados `selecting`, `creating-room`, `joining-player` e `error`. Mostrar:

```tsx
<fieldset>
  <legend>Como você vai participar?</legend>
  <button type="button" onClick={() => setMode('player')}>Também vou jogar</button>
  <p>Você cria a sala e participa da batalha.</p>
  <button type="button" onClick={() => setMode('presenter')}>Só vou apresentar</button>
  <p>Você controla a partida sem participar.</p>
</fieldset>
```

Para `player`, validar o apelido normalizado com 2–20 caracteres, criar uma única sala, salvar `player`, aguardar `joinCreatedRoomAsPlayer` e só então navegar. Para `presenter`, salvar `presenter` e navegar imediatamente após `createRoom`.

- [ ] **Step 4: Executar GREEN**

Run: `pnpm vitest run apps/web/src/lib/hostParticipation.test.ts apps/web/src/lib/ws.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/hostParticipation.ts apps/web/src/lib/hostParticipation.test.ts apps/web/src/pages/HostEntryPage.tsx
git commit -m "feat: adicionar escolha host ou host player"
```

### Task 4: Superfície competitiva combinada e controles Host isolados

**Files:**
- Modify: `apps/web/src/pages/HostPage.tsx`
- Modify: `apps/web/src/components/host/HostLobby.tsx`
- Modify: `apps/web/src/components/host/HostControls.tsx`
- Modify: `apps/web/src/components/player/PlayerQuestion.tsx`
- Modify: `apps/web/src/components/player/PlayerFinished.tsx`

**Interfaces:**
- Consumes: `getHostParticipation(pin)` da Task 3.
- Consumes: `useGameSocket('host', { syncStore })` e `useGameSocket('player')` da Task 2.
- Produces: `HostControlsProps.adminConnectionState: ConnectionState`

- [ ] **Step 1: Escrever E2E mínimo falhando para justiça e dual connection**

Criar inicialmente `tests/e2e/host-player.spec.ts` com T2–T5:

```ts
test('T2-T5: criador entra uma vez, mantém dois sockets e recebe superfície Player', async ({ page }) => {
  await page.goto('/host');
  await page.getByRole('button', { name: /também vou jogar/i }).click();
  await page.getByLabel(/nome|apelido/i).fill('Criador');
  await page.getByRole('button', { name: /criar partida/i }).click();
  await expect(page).toHaveURL(/\/host\/\d{6}/);
  await expect(page.getByText('Criador', { exact: true })).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__wsManagers ?? {}).sort())).toEqual(['host', 'player']);

  await page.getByRole('button', { name: /iniciar partida/i }).click();
  await expect(page.getByText(/questão 1 de 10/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /alternativa a/i })).toBeVisible();
  await expect(page.getByText(/voto|distribuição/i)).toHaveCount(0);
  await expect(page.getByText(/resposta correta/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /pausar rodada/i })).toBeVisible();
});
```

Declarar o tipo de debug apenas no teste ou em `vite-env.d.ts`, sem `any` em código de produto.

- [ ] **Step 2: Executar RED**

Run: `pnpm playwright test tests/e2e/host-player.spec.ts --project=chromium --grep "T2-T5"`

Expected: FAIL porque a página Host ainda renderiza `HostQuestion` e não mantém os dois managers.

- [ ] **Step 3: Implementar composição da página**

Em `HostPage`:

```ts
const participation = getHostParticipation(pin);
const isHostPlayer = participation === 'player';
const hostSocket = useGameSocket('host', { syncStore: !isHostPlayer });
const playerSocket = useGameSocket('player', { syncStore: isHostPlayer });
```

Conectar Host sempre. Conectar Player somente no modo combinado e somente com token existente; token ausente deve renderizar erro de restauração, sem `JOIN_ROOM` automático.

No renderer combinado, usar `PlayerCountdown`, `PlayerQuestion`, `PlayerReveal`, `PlayerRanking`, `PlayerPodium` e `PlayerFinished`. Manter `HostLobby` no lobby porque ele mostra roster e moderação, mas seus comandos devem usar `getWebSocketManager('host')`. `PlayerQuestion` envia resposta exclusivamente por `getWebSocketManager('player')`.

Passar `adminConnectionState` para `HostControls`; quando diferente de `connected`, desabilitar comandos e exibir “Reconectando controles da partida…”, sem cobrir ou desabilitar a superfície Player.

- [ ] **Step 4: Executar GREEN e testes direcionados**

Run: `pnpm playwright test tests/e2e/host-player.spec.ts --project=chromium --grep "T2-T5"`

Expected: PASS.

Run: `pnpm vitest run apps/web/src/lib/ws.test.ts apps/web/src/lib/socketBindings.test.ts apps/web/src/lib/hostParticipation.test.ts apps/web/src/components/player/PlayerQuestion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/pages/HostPage.tsx apps/web/src/components/host/HostLobby.tsx apps/web/src/components/host/HostControls.tsx apps/web/src/components/player/PlayerQuestion.tsx apps/web/src/components/player/PlayerFinished.tsx tests/e2e/host-player.spec.ts
git commit -m "feat: renderizar experiencia host player justa"
```

### Task 5: Integração Durable Object da sessão dupla

**Files:**
- Modify: `tests/integration/worker-game-room.test.ts`
- Modify only if a failing test proves necessary: `apps/web/worker/game-room.ts`

**Interfaces:**
- Consumes: protocolo existente `JOIN_ROOM`, `RESUME_SESSION`, `SUBMIT_ANSWER`, `HOST_COMMAND`.
- Produces: nenhuma API nova; comprova que backend existente satisfaz o contrato.

- [ ] **Step 1: Escrever teste de integração T2/T3/T6/T8/T9/T10**

Adicionar um `describe('Host + Player dual session')` que:

```ts
await room.fetch(createHostRequest());
const hostServer = ctx.getWebSockets('role:host')[0];
const host = attachTestClient(room, hostServer, hostServer.peer!);

await room.fetch(new Request('http://internal/ws?role=player', {
  headers: { Upgrade: 'websocket' },
}));
const creatorServer = ctx.getWebSockets('role:player')[0];
const creator = attachTestClient(room, creatorServer, creatorServer.peer!);
await creator.send(createClientEnvelope('JOIN_ROOM', { pin: testPin, nickname: 'Criador' }, 0));
const accepted = creator.getAllMessages().find(message => message.type === ServerEventType.SESSION_ACCEPTED);
const playerId = accepted.payload.playerId;
const token = accepted.payload.reconnectToken;

expect(ctx.getWebSockets('role:host')).toHaveLength(1);
expect(ctx.getWebSockets('role:player')).toHaveLength(1);
const hostMessages = host.getAllMessages();
const joined = hostMessages.find(message => message.type === ServerEventType.PLAYER_JOINED);
expect(joined.payload.totalPlayers).toBe(1);
expect(joined.payload.playerId).toBe(playerId);
```

Depois iniciar a partida pelo Host, responder pelo Player, confirmar `ANSWER_ACCEPTED` e `answeredCount`, fechar apenas Player, reconectar via `RESUME_SESSION` e verificar mesmo `playerId`, resposta e score. Fechar apenas Host e comprovar que o Player continua recebendo snapshot. Concluir o jogo usando os helpers já existentes e verificar que o criador aparece em ranking/pódio.

- [ ] **Step 2: Executar caracterização**

Run: `pnpm vitest run --config tests/vitest.integration.config.ts tests/integration/worker-game-room.test.ts --testNamePattern "Host \+ Player dual session"`

Expected: PASS se o backend já sustenta o contrato. Se falhar, registrar o ponto exato; uma falha de helper/teste não autoriza mudança backend.

- [ ] **Step 3: Aplicar somente correção backend demonstrada, se necessária**

Se a falha real mostrar interferência entre os papéis, limitar a correção aos metadados por WebSocket. Exemplo aceitável:

```ts
const meta = this.getConnectionMeta(ws);
if (meta.role !== 'player' || !meta.playerId) {
  this.sendError(ws, ProtocolError.UNAUTHORIZED, 'Player session required');
  return;
}
```

Não alterar schemas, scoring ou tabelas se o teste passar sem isso.

- [ ] **Step 4: Executar integração completa**

Run: `pnpm test:integration`

Expected: PASS em toda a suíte, incluindo presença e mechanical gate.

- [ ] **Step 5: Commit**

```powershell
git add tests/integration/worker-game-room.test.ts
if (Test-Path apps/web/worker/game-room.ts) { git add apps/web/worker/game-room.ts }
git commit -m "test: validar sessao dupla host player"
```

Antes do commit, confirmar com `git diff -- apps/web/worker/game-room.ts` se o backend realmente mudou; não incluir o arquivo sem diff.

### Task 6: E2E T1–T12 e regressões finais

**Files:**
- Modify: `tests/e2e/host-player.spec.ts`
- Modify: `tests/e2e/game-flow.spec.ts`
- Modify: `tests/e2e/scenarios.spec.ts`

**Interfaces:**
- Consumes: interface final das Tasks 1–5.
- Produces: evidência automatizada nominal para T1–T12.

- [ ] **Step 1: Completar testes E2E falhando**

Adicionar cenários independentes ou agrupados com títulos T1–T12:

```ts
import type { Page } from '@playwright/test';

async function createHostPlayer(page: Page, nickname = 'Criador'): Promise<string> {
  await page.goto('/host');
  await page.getByRole('button', { name: /também vou jogar/i }).click();
  await page.getByLabel(/nome|apelido/i).fill(nickname);
  await page.getByRole('button', { name: /criar partida/i }).click();
  await expect(page).toHaveURL(/\/host\/\d{6}/);
  return page.url().match(/\/host\/(\d{6})/)![1];
}

async function joinPlayer(page: Page, pin: string, nickname: string): Promise<void> {
  await page.goto(`/join/${pin}`);
  await page.getByLabel(/seu apelido/i).fill(nickname);
  await page.getByRole('button', { name: /entrar na arena/i }).click();
  await expect(page).toHaveURL(new RegExp(`/play/${pin}`));
}

test('T1/T12: presenter não entra no roster e mantém Host + Players + Screen', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await host.goto('/host');
  await host.getByRole('button', { name: /só vou apresentar/i }).click();
  await host.getByRole('button', { name: /criar partida/i }).click();
  const pin = host.url().match(/\/host\/(\d{6})/)![1];
  await expect(host.getByText(/participantes.*0/i)).toBeVisible();

  const playerContext = await browser.newContext();
  const player = await playerContext.newPage();
  await joinPlayer(player, pin, 'Aluno');
  const screenContext = await browser.newContext();
  const screen = await screenContext.newPage();
  await screen.goto(`/screen/${pin}`);
  await expect(host.getByText('Aluno')).toBeVisible();
  await expect(screen.getByText('Aluno')).toBeVisible();
  await expect(host.getByText('Apresentador', { exact: true })).toHaveCount(0);
});

test('T2/T3/T11: host player cria uma identidade e joga sem Screen', async ({ page }) => {
  await createHostPlayer(page);
  await expect(page.getByText('Criador', { exact: true })).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__wsManagers ?? {}).sort()))
    .toEqual(['host', 'player']);
  await expect(page.getByText(/participantes.*1/i)).toBeVisible();
});

test('T4/T5/T6/T7: questão usa UI Player, aceita resposta e preserva controles', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  const pin = await createHostPlayer(host);
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await joinPlayer(other, pin, 'Outro');
  await host.getByRole('button', { name: /iniciar partida/i }).click();
  await expect(host.getByText(/questão 1 de 10/i)).toBeVisible();
  await expect(host.getByText(/voto|distribuição|resposta correta/i)).toHaveCount(0);
  await host.getByRole('button', { name: /alternativa a/i }).click();
  await expect(host.getByText(/resposta registrada/i)).toBeVisible();
  await host.getByRole('button', { name: /pausar rodada/i }).click();
  await expect(host.getByRole('button', { name: /retomar rodada/i })).toBeVisible();
  await host.getByRole('button', { name: /retomar rodada/i }).click();
  await expect(host.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 10_000 });
  await host.getByRole('button', { name: /encerrar questão/i }).click();
  await host.getByRole('button', { name: /sim, encerrar/i }).click();
  await expect(host.getByText(/você acertou|resposta incorreta/i)).toBeVisible();
});

test('T8: criador participa do ranking e pódio', async ({ browser }) => {
  test.setTimeout(240_000);
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  const pin = await createHostPlayer(host);
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await joinPlayer(other, pin, 'Outro');
  await host.getByRole('button', { name: /iniciar partida/i }).click();
  for (let question = 1; question <= 10; question++) {
    await expect(host.getByText(new RegExp(`questão ${question} de 10`, 'i'))).toBeVisible({ timeout: 15_000 });
    await host.getByRole('button', { name: /alternativa a/i }).click();
    await other.getByRole('button', { name: /alternativa b/i }).click();
    await expect(host.getByText(/você acertou|resposta incorreta/i)).toBeVisible({ timeout: 10_000 });
  }
  await expect(host.getByText(/pódio/i)).toBeVisible({ timeout: 15_000 });
  await expect(host.getByText('Criador', { exact: true })).toBeVisible();
});

test('T9: reload mantém token, resposta, score e uma identidade', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  const pin = await createHostPlayer(host);
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await joinPlayer(other, pin, 'Outro');
  await host.getByRole('button', { name: /iniciar partida/i }).click();
  await expect(host.getByText(/questão 1 de 10/i)).toBeVisible();
  await host.getByRole('button', { name: /alternativa a/i }).click();
  await other.getByRole('button', { name: /alternativa b/i }).click();
  await expect(host.getByText(/pontuação acumulada/i)).toBeVisible();
  const scoreBefore = await host.getByText(/\d+ pts/i).last().textContent();
  const tokenBefore = await host.evaluate(key => localStorage.getItem(key), `batalha_session_${pin}`);
  await host.reload();
  await expect(host.getByText(/pontuação acumulada|total de pontos/i)).toBeVisible();
  await expect(host.getByText(scoreBefore ?? '', { exact: true })).toBeVisible();
  const tokenAfter = await host.evaluate(key => localStorage.getItem(key), `batalha_session_${pin}`);
  expect(tokenAfter).toBe(tokenBefore);
  await expect(host.getByText('Criador', { exact: true })).toHaveCount(1);
});

test('T10: sockets recuperam independentemente sem duplicar criador', async ({ page }) => {
  await createHostPlayer(page);
  await page.evaluate(() => window.__wsManagers.player.closeSocketForTest());
  await expect.poll(() => page.evaluate(() => window.__wsManagers.player.state)).toBe('connected');
  await expect(page.getByText('Criador', { exact: true })).toHaveCount(1);
  await page.evaluate(() => window.__wsManagers.host.closeSocketForTest());
  await expect.poll(() => page.evaluate(() => window.__wsManagers.host.state)).toBe('connected');
  await expect(page.getByText('Criador', { exact: true })).toHaveCount(1);
});
```

Nos testes legados, selecionar “Só vou apresentar” antes do botão de criação. Não enfraquecer assertions existentes.

- [ ] **Step 2: Executar RED dos novos cenários ainda não cobertos**

Run: `pnpm playwright test tests/e2e/host-player.spec.ts --project=chromium`

Expected: os cenários adicionados nesta task falham pelos gaps reais restantes, especialmente reload/reconnect ou pódio.

- [ ] **Step 3: Corrigir gaps mínimos encontrados**

Aplicar correções somente nos arquivos owners das Tasks 1–4. Para reload sem token, mostrar erro explícito:

```tsx
<div role="alert">
  Não foi possível restaurar sua sessão de participante. Os controles do apresentador continuam disponíveis.
</div>
```

Para debug E2E de queda individual, expor apenas em ambiente de desenvolvimento/teste métodos já existentes por manager; não criar endpoint público.

- [ ] **Step 4: Executar T1–T12 após o estado final**

Run: `pnpm playwright test tests/e2e/host-player.spec.ts --project=chromium`

Expected: PASS em todos os cenários T1–T12.

- [ ] **Step 5: Executar regressões de Presenter, Screen e lifecycle**

Run: `pnpm playwright test tests/e2e/game-flow.spec.ts tests/e2e/scenarios.spec.ts --project=chromium`

Expected: PASS.

Run: `pnpm playwright test tests/e2e/mobile-lifecycle.spec.ts --project=android-chrome`

Expected: PASS; o lifecycle Player existente continua funcional.

- [ ] **Step 6: Executar verificação ampla final**

Run: `pnpm lint`

Expected: exit 0.

Run: `pnpm typecheck`

Expected: exit 0.

Run: `pnpm test`

Expected: exit 0, zero falhas.

Run: `pnpm test:integration`

Expected: exit 0, zero falhas.

Run: `pnpm build`

Expected: exit 0 e assets em `apps/web/dist`.

- [ ] **Step 7: Revisar diff e commit final**

```powershell
git diff --check
git status --short
git add tests/e2e/host-player.spec.ts tests/e2e/game-flow.spec.ts tests/e2e/scenarios.spec.ts
git add apps/web/src
git commit -m "test: cobrir fluxo host player ponta a ponta"
```

Não adicionar artefatos Playwright, `dist`, traces ou arquivos não relacionados.

## Matriz de aceite

| Teste | Evidência principal |
|---|---|
| T1 Presenter | `host-player.spec.ts` + regressão `game-flow.spec.ts` |
| T2 Criação Host + Player | E2E + integração Durable Object |
| T3 Dual connection | `ws.test.ts` + E2E debug registry |
| T4 Start | E2E superfície Player |
| T5 Fairness | `socketBindings.test.ts` + ausência visual E2E |
| T6 Answer | integração `ANSWER_ACCEPTED`/`answeredCount` + E2E |
| T7 Admin controls | E2E pausa/retomada/encerramento |
| T8 Ranking/podium | integração + E2E jogo concluído |
| T9 Reload | E2E token/playerId/resposta/score |
| T10 Network/reconnect | unitário manager + integração resume + E2E |
| T11 Screen optional | E2E sem rota Screen |
| T12 Classroom regression | Presenter + Players + Screen existente |

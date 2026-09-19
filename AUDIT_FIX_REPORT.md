# AUDIT FIX REPORT — Pacote Corretivo V3.2 + Fechamento Final Realtime/Presença/Retry

Data: 19/09/2026

Escopo: Fechamento de presença, reconexão e pause (V3.2), acrescido do corretivo final de conexão canônica, heartbeat e retry, sem redesign visual

PRD canônico: [`PRD.md`](PRD.md), versão 1.5

## 1. Resultado executivo

O gate automatizado está **PASS** para os pontos mecânicos V3.2 e para os quatro comportamentos do corretivo final de realtime/presença/retry. Isso não equivale a homologação Cloudflare em produção nem a homologação em hardware físico.

- Cloudflare smoke: **NOT EXECUTED**.
- Android físico: **PHYSICAL NOT EXECUTED**.
- iPhone físico: **PHYSICAL NOT EXECUTED**.
- Validação acadêmica humana: **PENDENTE DE VALIDAÇÃO ACADÊMICA**.

## 2. Causa raiz e correções mecânicas (V3.2)

### 2.1 P0 — Reativar presença quando o mesmo WebSocket continua aberto
- **Requirement ID:** V32-P0-SAME-SOCKET
- **Status:** **PASS**
- **Causa raiz:** Quando a presença expirava por inatividade (> 10s), o servidor marcava `presence.connected = 0` no SQLite. Se o navegador retornava ao foreground mantendo o mesmo WebSocket físico `OPEN` e enviava `CLIENT_ALIVE` ou `REQUEST_SNAPSHOT`, o servidor apenas atualizava o metadado em memória ou respondia o snapshot, sem restaurar `connected = 1` no banco de dados e sem emitir `PLAYER_PRESENCE_CHANGED`.
- **Correção:** Implementado o método server-side canônico `markPlayerPresent(playerId, connectionId, now)` em `apps/web/worker/game-room.ts`. Sempre que uma mensagem válida chega de um socket autenticado (`CLIENT_ALIVE`, `REQUEST_SNAPSHOT`, `SUBMIT_ANSWER`), o método verifica a titularidade da conexão (`connectionId === presence.connection_id`), restaura `presence.connected = 1`, atualiza `last_seen_at` no banco, emite `PLAYER_PRESENCE_CHANGED (connected: true)` caso estivesse desconectado e rearma o alarme de presença. Conexões com `connectionId` incompatível ou jogadores removidos são rejeitados (`return false`). Não cria jogador duplicado, não altera pontuação, não apaga respostas e não altera elegibilidade.
- **Evidência:** `tests/integration/v32-presence-gate.test.ts` (V32-T01).

### 2.2 P0 — SUBMIT_ANSWER exige jogador ativo (Semântica A)
- **Requirement ID:** V32-P0-ANSWER-PRESENCE
- **Status:** **PASS**
- **Causa raiz:** Um jogador com presença expirada mantinha o socket aberto e conseguia submeter resposta se o deadline não tivesse passado, criando o estado inconsistente de resposta aceita com jogador offline nos contadores.
- **Semântica escolhida:** **Semântica A (Reativação automática por evidência de atividade)**. Uma mensagem `SUBMIT_ANSWER` recebida em um socket autenticado associado ao jogador é evidência legítima de atividade em tempo real. O servidor reativa a presença do jogador via `markPlayerPresent` *antes* de avaliar a validade da resposta. Se `markPlayerPresent` falhar (jogador removido ou conexão incompatível), a resposta é rejeitada imediatamente com `ANSWER_REJECTED (UNAUTHORIZED)`. Quando a resposta é validada e aceita, o modelo canônico de presença já reflete o jogador como ativo e conectado, assegurando coerência imediata em `answeredCount`, `activeEligiblePlayers` e `allAnswered`.
- **Invariante:** É matematicamente impossível o estado `answer accepted + player offline`.
- **Evidência:** `tests/integration/v32-presence-gate.test.ts` (V32-T02 e V32-T02-REJECT).

### 2.3 P0 — RESUME_SESSION rearma o scheduler de presença
- **Requirement ID:** V32-P0-RESUME-SCHEDULER
- **Status:** **PASS**
- **Causa raiz:** `handleResumeSession` restaurava `connected = 1` na tabela de presença, mas não invocava o agendamento de alarme do Durable Object. Em fases sem deadline ativo (como `LOBBY`), se o jogador reconectado sumisse novamente em silêncio, nenhum alarme acordava o DO para expirá-lo.
- **Correção:** Unificado o scheduler através de `ensurePresenceAlarmScheduled()`, invocado obrigatoriamente após `JOIN_ROOM`, `RESUME_SESSION` e reativações de presença. O método calcula `min(effectivePhaseDeadline, earliestPresenceExpiry)` e garante o agendamento no Durable Object Alarm Storage, compatível com a Hibernation API e sem loops em memória.
- **Evidência:** `tests/integration/v32-presence-gate.test.ts` (V32-T03).

### 2.4 P0 — Presença continua sendo monitorada durante PAUSED
- **Requirement ID:** V32-P0-PAUSED-PRESENCE
- **Status:** **PASS**
- **Causa raiz:** Ao entrar em `PAUSED`, `handlePause` executava `this.ctx.storage.deleteAlarm()`, cancelando todo e qualquer alarme futuro, incluindo a expiração de participantes que perdessem conectividade durante a pausa.
- **Correção:** `PAUSE` congela o relógio de gameplay (`remainingMs` congelado e preservado intacto), mas NÃO congela a presença de rede. Em `handlePause`, o servidor agenda o alarme de presença (`ensurePresenceAlarmScheduled()`). Ao disparar `alarm()` durante `PAUSED`, o servidor executa exclusivamente a rotina de expiração de presença, não consome `remainingMs`, não avança a máquina de estados, não dispara reveal e reagenda o próximo alarme de presença. Ao retomar (`RESUME`), a mesma pergunta continua com o `remainingMs` perfeitamente preservado.
- **Evidência:** `tests/integration/v32-presence-gate.test.ts` (V32-T04).

### 2.5 P0 — Separação entre interactionLocked e hasRecordedAnswer na UI
- **Requirement ID:** V32-P0-UI-PAUSE-ANSWER
- **Status:** **PASS**
- **Causa raiz:** No frontend `PlayerQuestion.tsx`, a flag `isLocked` agregava `isPaused || answerSubmitted || optimisticOptionId`, e era usada tanto para desabilitar alternativas quanto para renderizar o banner de "Resposta registrada!". Quando o apresentador pausava a rodada antes de o jogador votar, as alternativas ficavam bloqueadas corretamente, mas a interface exibia falsamente que a resposta havia sido registrada. Além disso, `optimisticOptionId` não era resetado caso a resposta fosse rejeitada pelo servidor ou na transição de pergunta.
- **Correção:** Desacoplados os conceitos:
  - `hasRecordedAnswer = Boolean(answerSubmitted || ((selectedOptionId || optimisticOptionId) && !answerRejected))`
  - `interactionLocked = roomState !== 'QUESTION_ACTIVE' || hasRecordedAnswer`
  - Efeitos adicionados para limpar `optimisticOptionId` ao receber `answerRejected`, ao trocar de `question.id` ou após `answerSubmitted`.
  - Suporte a props opcionais (`roomState`, `remainingMs`, `answerRejected`) permitindo renderização determinística e testes unitários diretos do componente.
  - Caso A (PAUSED sem resposta): alternativas desabilitadas (`interactionLocked === true`), banner de rodada pausada visível, banner de "Resposta registrada!" OCULTO.
  - Caso B (PAUSED após resposta): alternativas desabilitadas, banner de pausa visível e confirmação de resposta visível.
  - Caso C (RESUME sem resposta): alternativas liberadas para voto.
  - Caso D (RESUME com resposta prévia): alternativas mantidas bloqueadas com confirmação de voto preservada.
- **Evidência:** `apps/web/src/components/player/PlayerQuestion.test.ts`, `apps/web/src/stores/gameStore.test.ts` e `tests/integration/v32-presence-gate.test.ts` (V32-T05A/B/C/D).

### 2.6 P0 — Close/Error são connection-aware
- **Requirement ID:** FINAL-RT-01
- **Status:** **PASS**
- **Causa raiz:** `webSocketClose` e `webSocketError` localizavam a presença somente por `playerId`; um callback tardio da conexão A podia marcar offline a presença já transferida para B.
- **Correção:** A desconexão exige igualdade entre `socket.connectionId` e `presence.connection_id`. O `UPDATE` também inclui os dois identificadores, preservando atomicamente a conexão canônica.
- **Evidência:** `tests/integration/v32-presence-gate.test.ts`, cenários separados de close e error tardios.

### 2.7 P0 — getEffectivePresences usa conexão canônica
- **Requirement ID:** FINAL-RT-02
- **Status:** **PASS**
- **Causa raiz:** A busca de WebSocket usava apenas `playerId` e podia selecionar a conexão antiga em uma janela de coexistência A/B.
- **Correção:** A projeção efetiva exige correspondência simultânea de `playerId` e `connectionId` com a presença persistida. Timestamp e conectividade da conexão antiga deixam de influenciar o estado.
- **Evidência:** `tests/integration/v32-presence-gate.test.ts`, cenário com timestamps divergentes em A e B.

### 2.8 P0 — Semântica explícita do heartbeat raw
- **Requirement ID:** FINAL-RT-03
- **Status:** **PASS**
- **Semântica implementada:** O `ping` raw tratado por `setWebSocketAutoResponse` não acorda o Durable Object e não executa transição de aplicação. Ele evita expiração enquanto `connected=true`, por meio do timestamp de auto-response, mas sozinho não reativa uma presença já persistida como desconectada. `REQUEST_SNAPSHOT`, `CLIENT_ALIVE`, `SUBMIT_ANSWER` no socket canônico ou `RESUME_SESSION` reativam deterministicamente.
- **Evidência:** `tests/integration/v32-presence-gate.test.ts`; contrato documentado no `PRD.md` 1.5.

### 2.9 P0 — Retry após ANSWER_REJECTED
- **Requirement ID:** FINAL-RT-04
- **Status:** **PASS**
- **Causa raiz:** A rejeição preservava `selectedOptionId` e a nova escolha preservava `answerRejected`, deixando seleção visual e trava otimista incompatíveis.
- **Correção:** `ANSWER_REJECTED` limpa seleção e confirmação pendentes; `selectOption` limpa a rejeição. Durante `QUESTION_ACTIVE`, uma nova seleção volta a bloquear a interação até aceitação ou rejeição, e `ANSWER_ACCEPTED` preserva a alternativa final.
- **Evidência:** `apps/web/src/stores/gameStore.test.ts` e `apps/web/src/components/player/PlayerQuestion.test.ts`.

## 3. Matriz de Testes V3.2

| ID | Status | Suite de Teste | Descrição / Resultado |
|---|---|---|---|
| V32-T01 | PASS | `tests/integration/v32-presence-gate.test.ts` | Reativação no mesmo socket via `CLIENT_ALIVE` e `REQUEST_SNAPSHOT`; mesmo `playerId`, sem duplicação, score e respostas preservados |
| V32-T02 | PASS | `tests/integration/v32-presence-gate.test.ts` | `SUBMIT_ANSWER` em jogador com presença expirada reativa presença antes da validação; aceita resposta e atualiza contadores canônicos |
| V32-T02-REJECT | PASS | `tests/integration/v32-presence-gate.test.ts` | Rejeição de resposta para conexão incompatível ou jogador removido administrativo |
| V32-T03 | PASS | `tests/integration/v32-presence-gate.test.ts` | `RESUME_SESSION` no LOBBY agenda alarme de presença; segundo timeout de silêncio ocorre sem intervenção de terceiros |
| V32-T04 | PASS | `tests/integration/v32-presence-gate.test.ts` | `PAUSED` monitora expiração de B mantendo A conectado; `remainingMs` preservado intacto; retomada sem salto temporal |
| V32-T05A | PASS | `PlayerQuestion.test.ts` & `gameStore.test.ts` | PAUSED sem resposta: alternativas bloqueadas, "Resposta registrada!" NÃO aparece |
| V32-T05B | PASS | `PlayerQuestion.test.ts` & `gameStore.test.ts` | PAUSED com resposta: alternativas bloqueadas, "Resposta registrada!" aparece |
| V32-T05C | PASS | `PlayerQuestion.test.ts` & `gameStore.test.ts` | RESUME para jogador que não respondeu: alternativas liberadas para toque |
| V32-T05D | PASS | `PlayerQuestion.test.ts` & `gameStore.test.ts` | RESUME para quem já respondeu: alternativas permanecem bloqueadas e confirmação visível |
| V32-INT1 | PASS | `tests/integration/v32-presence-gate.test.ts` | Cenário integrado: A responde, B expira, B volta no mesmo socket, B responde, ambos online, rodada encerra por `all_answered` |
| V32-INT2 | PASS | `tests/integration/v32-presence-gate.test.ts` | Variante com PAUSE: B expira em PAUSED, jogo continua PAUSED, host retoma, B volta e pergunta continua |
| FINAL-RT-01-CLOSE | PASS | `tests/integration/v32-presence-gate.test.ts` | Close tardio de A não derruba B; close de B desconecta |
| FINAL-RT-01-ERROR | PASS | `tests/integration/v32-presence-gate.test.ts` | Error tardio de A não derruba B; error de B desconecta |
| FINAL-RT-02 | PASS | `tests/integration/v32-presence-gate.test.ts` | Projeção efetiva usa somente `(playerId, presence.connection_id)` |
| FINAL-RT-03 | PASS | `tests/integration/v32-presence-gate.test.ts` | Raw heartbeat isolado não reativa presença expirada; `REQUEST_SNAPSHOT` reativa |
| FINAL-RT-04 | PASS | store + componente | Retry A rejeitada → B selecionada/bloqueada → B aceita |

## 4. Gates executados após a implementação final

| Comando | Exit code | Passed | Failed | Skipped | Status |
|---|---:|---:|---:|---:|---|
| `pnpm lint` | 0 | 1 gate | 0 | 0 | PASS |
| `pnpm typecheck` | 0 | 1 gate | 0 | 0 | PASS |
| `pnpm test` | 0 | 116 tests (9 arquivos) | 0 | 0 | PASS |
| `pnpm test:integration` | 0 | 68 tests (3 arquivos) | 0 | 0 | PASS |

Validações do gate anterior que não foram repetidas após este corretivo isolado: `pnpm test:e2e`, `pnpm test:load` e `pnpm build`. Seus resultados históricos permanecem válidos como evidência anterior, mas não são declarados como nova execução neste fechamento.

## 5. Pendências reais

1. Cloudflare smoke/deploy real: **NOT EXECUTED**; nenhuma credencial de produção foi usada.
2. Android físico: **PHYSICAL NOT EXECUTED**.
3. iPhone físico: **PHYSICAL NOT EXECUTED**.
4. Validação acadêmica humana: **PENDENTE DE VALIDAÇÃO ACADÊMICA** por docente/equipe responsável.

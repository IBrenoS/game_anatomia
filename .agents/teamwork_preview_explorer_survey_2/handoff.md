# Relatório de Handoff — Explorer Survey 2: Frontend, Telão & UX

**Data/Hora**: 2026-09-17T04:38:00Z  
**Autor**: `teamwork_preview_explorer_survey_2`  
**Escopo**: Auditoria e diagnóstico técnico do cliente web React (`apps/web`), hooks, roteamento, componentes, gerenciamento de estado (Zustand) e integração com WebSocket e Durable Objects.

---

## 1. Observation (Observações Detalhadas)

### 1.1 P0.1 & P1.1: Snapshot Imediato no Host e Ação "Abrir Telão"
- **HostPage.tsx (linhas 41-43 e 63-65)**:
  ```tsx
  if (connectionState === 'disconnected' || connectionState === 'connecting') {
    return <div className="min-h-screen bg-[#1e3a5f] text-white flex items-center justify-center">Conectando ao painel do apresentador...</div>;
  }
  // renderContent switch:
  default:
    return <div className="flex-1 flex items-center justify-center text-white">Aguardando estado do jogo...</div>;
  ```
  Quando a conexão WebSocket atinge o estado `'connected'`, `renderContent()` cai no `default` caso `roomState` permaneça `null`.
- **game-room.ts (linhas 158-183)**:
  `handleWebSocketUpgrade` valida o host token e aceita o WebSocket:
  ```ts
  this.ctx.acceptWebSocket(server, [`role:${role}`]);
  (server as any).__role = role;
  return new Response(null, { status: 101, webSocket: client });
  ```
  O servidor **não envia** mensagem `SNAPSHOT` na aceitação do WebSocket.
- **game-room.ts (linhas 363, 420, 616)**:
  `this.sendSnapshot()` é invocado exclusivamente em `handleJoinRoom` (linha 363), `handleResumeSession` (linha 420) e `handleRequestSnapshot` (linha 616). O Host e o Telão nunca emitem `JOIN_ROOM` nem `RESUME_SESSION`.
- **ws.ts (linhas 49-53)**:
  ```ts
  this.ws.onopen = () => {
    this.setState('connected');
    this.reconnectAttempt = 0;
    this.startHeartbeat();
  };
  ```
  O evento `onopen` do WebSocket do cliente apenas inicia o heartbeat; **não envia** `REQUEST_SNAPSHOT`.
- **Ausência de ação "Abrir Telão"**:
  Grep por `telão` em `apps/web/src/pages/HostPage.tsx`, `HostLobby.tsx` e `HostControls.tsx` confirma zero ocorrências. Não existe link ou botão apontando para `/screen/:pin` nas interfaces do apresentador.

---

### 1.2 P0.2 & P1.4: Reconexão de Jogador, Bloqueio de Resposta e Confirmação
- **PlayerPage.tsx (linhas 42-50)**:
  ```tsx
  if (connectionState === 'disconnected') {
    const savedToken = localStorage.getItem(`batalha_session_${pin}`);
    if (savedToken) {
      connect(pin, 'player', savedToken);
    } else if (!playerId) {
      navigate(`/join/${pin}`, { replace: true });
    }
  }
  ```
  Ao recarregar a página `/play/:pin`, `connect()` é chamado com `savedToken`.
- **ws.ts (linhas 29-53 e 125-137)**:
  `connect` abre a conexão WebSocket com a URL contendo `token=${token}` como query parameter. No entanto, `this.ws.onopen` **não envia** `RESUME_SESSION`. O método `scheduleReconnect()` também reconecta sem emitir `RESUME_SESSION`.
- **game-room.ts (linhas 158-183)**:
  O Durable Object apenas aceita a conexão para `role: 'player'`. A identidade e presença só são restauradas quando uma mensagem `RESUME_SESSION` é recebida em `webSocketMessage`. Como `ws.ts` não envia `RESUME_SESSION`, a reconexão empaca em "Conectando ao jogo...".
- **gameStore.ts (linhas 159-171)**:
  ```ts
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
  ```
  O payload de snapshot enviado pelo servidor contém `personalAnswers: [...]` (linha 1152 de `game-room.ts`), mas `handleSnapshot` **ignora completamente** `payload.personalAnswers`. `answerSubmitted` e `selectedOptionId` não são restaurados após reconexão/recarregamento.
- **PlayerQuestion.tsx (linhas 33-52)**:
  ```tsx
  const handleSelectOption = (optionId: string) => {
    if (answerSubmitted) return;
    wsManager.submitAnswer(question.id, wsManager.roomVersion, optionId);
  };
  ```
  `handleSelectOption` não executa bloqueio otimista local nem chama `selectOption(optionId)`. Durante a latência de rede entre o clique e o `ANSWER_ACCEPTED`, os botões permanecem clicáveis, podendo gerar cliques repetidos e erro `ANSWER_ALREADY_SUBMITTED`.
- **PlayerQuestion.tsx (linhas 38-52)**:
  ```tsx
  if (answerSubmitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white p-6 text-center animate-[fadeIn_0.3s_ease-out]">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_25px_rgba(34,197,94,0.5)]">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-2 text-green-300">Resposta Enviada!</h2>
        ...
  ```
  Ao receber confirmação, a tela oculta a pergunta e alternativas e exibe um círculo verde gigante com checkmark. O verde e checkmark induzem o jogador a achar que acertou antes da revelação, e não mostram qual alternativa ele escolheu.
- **useGameSocket.ts (linhas 24-69)**:
  Não há listener registrado para `ServerEventType.ANSWER_REJECTED`. Se a resposta for rejeitada (ex: fora do prazo ou jogo pausado), a UI silencia o erro.

---

### 1.3 P1.2: Contagem Regressiva e Strings Residuais em Inglês
- **PlayerCountdown.tsx (linhas 7-8)**:
  ```tsx
  <h2 className="text-4xl font-black mb-4">Get Ready!</h2>
  <p className="text-xl text-blue-200">Look at the big screen</p>
  ```
  Texto inteiramente em inglês, sem contagem 3, 2, 1.
- **PlayerLobby.tsx (linhas 11, 18-19)**:
  ```tsx
  <h2 className="text-2xl font-bold mb-2">You're in!</h2>
  ...
  <p className="text-blue-200">Waiting for host to start...</p>
  <p className="text-sm opacity-50 mt-4">Look at the big screen</p>
  ```
  Mensagens residuais em inglês.
- **ScreenPage.tsx (linhas 50-55) & HostPage.tsx (linhas 49-50)**:
  - ScreenPage exibe apenas `<h2 className="text-8xl ...">Prepare-se!</h2>` estático.
  - HostPage exibe apenas `<h2>Preparando rodada...</h2>` estático.
  Nenhum cliente implementa a progressão sincronizada 3 -> 2 -> 1.

---

### 1.4 P1.3: Feedback Individual e Coletivo
- **PlayerReveal.tsx (linhas 1-73)**:
  Recebe `result: PersonalResult | null` e `correctOptionId: string | null`.
  - Não exibe o texto da **alternativa correta** (apenas diz "Veja a explicação da alternativa correta no telão").
  - Não exibe a **pontuação acumulada** total do jogador (apenas os pontos obtidos na rodada e se houve bônus de rapidez).
- **gameStore.ts (linhas 19-23, 74, 129-133)**:
  O estado `personalScore` (`totalPoints`, `correctCount`, `position`) é declarado mas nunca é atualizado nos handlers `handleSnapshot`, `handleAnswerReveal` ou `handleRankingUpdated`.
- **ScreenReveal.tsx (linhas 23-93)**:
  Exibe distribuição em barras com contagem e percentual, destaque em verde na alternativa correta (`✓ CORRETA`) e caixa de explicação didática. Está bem implementado coletivamente, necessitando apenas de animação suave e garantia de persistência.

---

### 1.5 P1.7: Controle de Áudio
- **HostControls.tsx (linhas 12-17, 28-33, 165-177)**:
  O botão "🔊 Som Ativo" / "🔇 Som Mudo" apenas altera a chave `'batalha_sound_enabled'` no `localStorage`.
- **Busca no repositório**:
  - `find_by_name` por arquivos `.mp3`, `.wav`, `.ogg` retornou **0 resultados**.
  - `grep_search` por `Audio`, `play()`, `new Audio` retornou **0 resultados**.
  O botão é 100% um placebo sem funcionalidade ativa.

---

### 1.6 P2.1: Lobby Vivo & Indicadores de Conexão
- **ScreenLobby.tsx (linhas 53-76) & PlayerList.tsx (linhas 12-38)**:
  - Participantes são renderizados sem animação de entrada (`fade-in` / `scale-in`).
  - Indicador de conexão é uma bolinha estática (`bg-green-400` ou `bg-gray-400`/`bg-gray-500`), sem pulso nem ping de presença em tempo real.
  - Não há aplicação das variantes `motion-reduce:animate-none` ou `motion-reduce:transition-none` nas listas de entrada.

---

### 1.7 P2.2: Hierarquia Visual das Questões
- **PlayerQuestion.tsx (linhas 55-112)**:
  - Hierarquia: Badge da questão ("Questão 1 de 10") + pontos base -> Barra de tempo -> Enunciado -> Imagem anatômica -> 4 Botões de alternativas verticais.
  - Imagem possui `max-h-40` (160px). Em telas verticais de smartphone (como 375x667px ou quando há barra de navegação do browser ativa), o conjunto imagem (160px) + enunciado longo + 4 botões de 58px cada (total > 232px) + margens excede o viewport, forçando rolagem vertical durante a contagem de tempo.
  - Falta tratamento de erro/fallback na carga de imagem SVG.

---

### 1.8 P2.3: Exibição Competitiva de Ranking
- **PlayerRanking.tsx (linhas 21-61)**:
  Exibe posição individual (`#position`), `totalPoints`, `correctCount` e `distanceToPrevious` ("A X pts do #{position - 1}").
- **ScreenRanking.tsx (linhas 22-67)**:
  Exibe Top 5 com destaque de pódio e diferença de pontos para o anterior.
- **Falta de indicador de mudança de posição**:
  Nem o mobile nem o telão indicam movimentação na tabela (ex: 🔺 Subiu 2 posições, 🔻 Caiu 1 posição, ➖ Manteve posição). Em `gameStore.ts`, a chegada de `RANKING_UPDATED` sobrescreve `rankings` sem preservar o ranking anterior.

---

### 1.9 P2.4: Cerimônia de Pódio Sequencial e Fallback
- **ScreenPodium.tsx (linhas 25-70)**:
  ```tsx
  {/* Segundo Lugar: delay 0.5s */}
  <div className="... motion-safe:animate-[slideUp_1s_ease-out_0.5s_both]">...</div>
  {/* Primeiro Lugar: delay 0s */}
  <div className="... motion-safe:animate-[slideUp_1.4s_ease-out_both]">...</div>
  {/* Terceiro Lugar: delay 0.2s */}
  <div className="... motion-safe:animate-[slideUp_0.8s_ease-out_0.2s_both]">...</div>
  ```
  O 1º lugar é animado primeiro (delay 0s), seguido pelo 3º (0.2s) e pelo 2º (0.5s). A ordem está invertida em relação a uma cerimônia solene tradicional (3º -> 2º -> 1º).
- **HostPodium.tsx (linhas 25-58)**:
  Também anima 1º lugar no tempo 0s, 2º em 0.2s e 3º em 0.4s.
- **Efeitos de celebração ausentes**:
  Não há efeitos de confete, brilho ou celebração de troféu.
- **Fallback para movimento reduzido**:
  O código usa `motion-safe:animate-[...]`, mas não há estado sequencial controlado (as caixas ficam visíveis ou dependem puramente de animação CSS sem revelação dramática por etapas).

---

### 1.10 Achado Adicional Crítico: Vazamento de Gabarito nos Assets SVG (P1.6)
- **Grep em `apps/web/public/questions/`**:
  Todas as 10 ilustrações em SVG (`q1.svg` a `q10.svg`) contêm na tag `<text>` a seção `ESTRUTURA EM DESTAQUE` imprimindo explicitamente o gabarito da questão:
  - `q1.svg`: "Região Dorsal" (Gabarito: Região do dorso)
  - `q2.svg`: "M. Reto Abdominal" (Gabarito: Reto abdominal)
  - `q3.svg`: "M. Trapézio" (Gabarito: Trapézio)
  - `q4.svg`: "Sustentação e Movimentação da Coluna Vertebral" (Gabarito: Auxiliar na sustentação e movimentação do dorso)
  - `q5.svg`: "M. Peitoral Superficial" (Gabarito: Peitoral superficial)
  - `q6.svg`: "Abdômen Ventral" (Gabarito: Abdômen ventral)
  - `q7.svg`: "Dorso e Escápula" (Gabarito: Dorso e escápula)
  - `q8.svg`: "Anatomia Comparada: Bovino e Equino" (Gabarito: Equino)
  - `q10.svg`: "Postura e Locomoção" (Gabarito: Para compreender postura, locomoção e movimentos)

---

## 2. Logic Chain (Cadeia de Raciocínio)

1. **Do travamento infinito do Host para a causa raiz (P0.1)**:
   - `HostPage.tsx` aguarda `roomState !== null` para sair de "Aguardando estado do jogo...".
   - `roomState` só é populado por `handleSnapshot` ou `handleGameStateChanged`.
   - Na inicialização do host, nenhum evento de estado é disparado até que ocorra uma ação externa.
   - O Durable Object (`game-room.ts:158-183`) aceita o WebSocket do host mas não dispara `sendSnapshot()`.
   - O cliente WebSocket (`ws.ts:49-53`) conecta e não dispara `requestSnapshot()`.
   - Logo, `roomState` permanece `null` indefinidamente.
   - **Correção lógica**: Tanto o servidor deve enviar `sendSnapshot` imediatamente na aceitação de conexão de papéis `host` e `screen`, quanto o cliente deve emitir `requestSnapshot()` no evento `onopen`.

2. **Da perda de resposta e travamento de reconexão do jogador (P0.2 & P1.4)**:
   - O token de reconexão é mantido no `localStorage`, mas `wsManager.connect` e `scheduleReconnect` não emitem `RESUME_SESSION` no `onopen`.
   - Como o servidor Durable Object requer a mensagem `RESUME_SESSION` para reassociar a sessão do jogador na tabela `presence`, a conexão nunca é autenticada.
   - Quando o `SNAPSHOT` é enviado após uma reconexão bem-sucedida, ele traz `personalAnswers`, mas `gameStore.handleSnapshot` não lê nem processa esse array, zerando `answerSubmitted` e `selectedOptionId`.
   - No envio de resposta em `PlayerQuestion.tsx`, a ausência de trava imediata no clique permite cliques concorrentes antes da resposta do servidor, e a troca abrupta de tela por um checkmark verde esconde as opções e induz falso feedback de acerto.
   - **Correção lógica**: Enviar `RESUME_SESSION` automaticamente no `onopen` quando houver `token` e `role === 'player'`; restaurar `answerSubmitted` e `selectedOptionId` a partir de `payload.personalAnswers` em `handleSnapshot`; aplicar bloqueio otimista neutro imediatamente no clique mantendo enunciado e alternativas visíveis com badge de "Resposta Confirmada".

3. **Das divergências de texto e contagem regressiva (P1.2)**:
   - Os componentes `PlayerCountdown.tsx` e `PlayerLobby.tsx` mantiveram protótipos em inglês ("Get Ready!", "You're in!", "Look at the big screen").
   - A transição `COUNTDOWN` dura 3000ms (`COUNTDOWN_DURATION_MS`), mas Telão, Host e Jogador mostram títulos estáticos sem o decremento 3, 2, 1.
   - **Correção lógica**: Substituir textos residuais por português e implementar componente comum de contagem regressiva (ou hook) baseado no `startedAt` / duração de 3s exibindo "Prepare-se" seguido por 3, 2, 1.

4. **Do feedback individual incompleto (P1.3)**:
   - `PlayerReveal.tsx` não recebe nem busca o rótulo da alternativa correta da pergunta.
   - `personalScore` não é alimentado no Zustand store, impedindo que o jogador veja seus pontos acumulados.
   - **Correção lógica**: Passar `currentQuestion` e pontuação total para `PlayerReveal`, exibindo a alternativa correta destacada e o total de pontos acumulados.

5. **Do botão de áudio inerte (P1.7)**:
   - Não existem arquivos de áudio nem inicialização de `AudioContext` no projeto.
   - **Correção lógica**: Implementar síntese Web Audio API leve (beeps para 3-2-1 e finalização) respeitando o estado `soundEnabled`, ou desabilitar/ocultar o botão com aviso de "Em desenvolvimento".

6. **Da cerimônia de pódio desordenada (P2.4)**:
   - `ScreenPodium.tsx` utiliza delays de animação CSS onde o 1º lugar surge no tempo 0s e o 3º lugar apenas depois.
   - Não há controle de etapas (Step 1: 3º lugar -> Step 2: 2º lugar -> Step 3: Campeão com troféu e celebração).
   - **Correção lógica**: Implementar máquina de estados de apresentação sequencial com delays controlados (ex: 3º lugar aos 1.5s, 2º lugar aos 3.5s, 1º lugar aos 5.5s com celebração de confetes), e em caso de `prefers-reduced-motion: reduce`, renderizar imediatamente todos os três degraus estáticos sem animações.

---

## 3. Caveats (Ressalvas e Limitações)

1. **Modo Somente Leitura**: Nenhuma modificação em arquivos de código-fonte (`.ts`, `.tsx`, `.svg`, `.css`) foi realizada nesta fase de auditoria, conforme as diretrizes do arquétipo explorer.
2. **Ambiente Cloudflare Local**: A validação em runtime do WebSocket requer execução concomitante do Vite e do emulador Miniflare/Workerd (`wrangler dev`).
3. **Imagens SVG de Conteúdo**: Embora a auditoria visual dos SVGs tenha sido realizada no cliente web (`apps/web/public/questions`), a sanitização definitiva deve ocorrer em coordenação com a equipe de conteúdo (`packages/content`).

---

## 4. Conclusion (Diagnóstico e Recomendações de Correção)

A auditoria identificou causas raízes precisas e mapeou os 9 itens de UI/UX e realtime solicitados. A seguir, o plano concreto de intervenção recomendado para a fase de implementação:

| ID | Item | Arquivos-Alvo | Ação Recomendada |
|---|---|---|---|
| **P0.1** | Snapshot Imediato no Host | `apps/web/worker/game-room.ts`<br>`apps/web/src/lib/ws.ts`<br>`apps/web/src/pages/HostPage.tsx` | Enviar snapshot no upgrade de WebSocket para host/screen; invocar `requestSnapshot()` no `ws.onopen`; adicionar timeout/fallback no HostPage. |
| **P1.1** | Ação "Abrir Telão" | `apps/web/src/pages/HostPage.tsx`<br>`apps/web/src/components/host/HostLobby.tsx` | Incluir botão destacado "📺 Abrir Telão" apontando para `/screen/${pin}` com `target="_blank"`. |
| **P0.2** | Reconexão de Jogador | `apps/web/src/lib/ws.ts`<br>`apps/web/src/stores/gameStore.ts`<br>`apps/web/src/pages/PlayerPage.tsx` | Disparar `resumeSession(pin, token)` no `onopen`; ler `payload.personalAnswers` no `handleSnapshot` e restaurar `answerSubmitted` e `selectedOptionId`. |
| **P1.4** | Bloqueio e Confirmação de Resposta | `apps/web/src/components/player/PlayerQuestion.tsx`<br>`apps/web/src/hooks/useGameSocket.ts` | Aplicar bloqueio otimista no clique; manter enunciado e alternativas visíveis com badge de resposta confirmada (sem cores de acerto/erro antecipadas); tratar `ANSWER_REJECTED`. |
| **P1.2** | Contagem Sincronizada 3-2-1 e i18n PT | `apps/web/src/components/player/PlayerCountdown.tsx`<br>`apps/web/src/components/player/PlayerLobby.tsx`<br>`apps/web/src/pages/ScreenPage.tsx`<br>`apps/web/src/pages/HostPage.tsx` | Traduzir todas as strings residuais para PT-BR; exibir contagem 3-2-1 animada e sincronizada sobre a janela de 3000ms. |
| **P1.3** | Feedback Individual e Coletivo | `apps/web/src/components/player/PlayerReveal.tsx`<br>`apps/web/src/stores/gameStore.ts` | Exibir texto da alternativa correta no celular; atualizar `personalScore` no store e mostrar pontuação acumulada total junto dos pontos da rodada e bônus. |
| **P1.7** | Controle de Áudio | `apps/web/src/components/host/HostControls.tsx`<br>`apps/web/src/lib/sound.ts` | Implementar gerador Web Audio API nativo para beeps da contagem e alerta, ou ocultar/desabilitar o botão com aviso explicativo. |
| **P2.1** | Lobby Vivo & Indicadores de Conexão | `apps/web/src/components/screen/ScreenLobby.tsx`<br>`apps/web/src/components/host/PlayerList.tsx` | Adicionar microanimação de entrada para competidores (`scale-in`); indicador de presença com pulso verde ativo; respeitar `motion-reduce`. |
| **P2.2** | Hierarquia Visual das Questões | `apps/web/src/components/player/PlayerQuestion.tsx` | Ajustar altura responsiva da imagem (`max-h-28 sm:max-h-36`) para evitar scroll vertical em telas de 667px; skeleton loader para imagens; botões touch >= 48px. |
| **P2.3** | Ranking Competitivo | `apps/web/src/components/player/PlayerRanking.tsx`<br>`apps/web/src/stores/gameStore.ts` | Armazenar ranking anterior no store e exibir indicador de movimentação na tabela (🔺 subiu, 🔻 caiu, ➖ manteve). |
| **P2.4** | Pódio Sequencial e Celebração | `apps/web/src/components/screen/ScreenPodium.tsx`<br>`apps/web/src/components/host/HostPodium.tsx` | Sequenciamento real: 3º lugar -> 2º lugar -> 1º lugar com troféu e efeito de confetes; renderização imediata estática se `prefers-reduced-motion`. |
| **P1.6** | Higienização de Imagens | `apps/web/public/questions/q1.svg` a `q10.svg` | Remover os textos de `ESTRUTURA EM DESTAQUE` que entregam o gabarito das 10 questões. |

---

## 5. Verification Method (Método de Verificação Independente)

Para validar e reproduzir as constatações e futuras correções:

1. **Verificação de Tipos e Build**:
   ```bash
   pnpm typecheck
   pnpm --filter @batalha/web build
   ```
2. **Execução de Testes Unitários de Domínio**:
   ```bash
   pnpm test
   ```
3. **Inspeção Manual dos Arquivos Auditados**:
   - `HostPage.tsx`: Verificar tratamento de `roomState === null` e presença do botão "Abrir Telão".
   - `ws.ts`: Verificar envio de `REQUEST_SNAPSHOT` e `RESUME_SESSION` em `this.ws.onopen`.
   - `gameStore.ts`: Inspecionar preenchimento de `personalAnswers` e `personalScore` em `handleSnapshot`.
   - `PlayerCountdown.tsx` e `PlayerLobby.tsx`: Confirmar eliminação de strings em inglês.
   - `ScreenPodium.tsx`: Verificar ordem e sequenciamento da revelação (3º -> 2º -> 1º).
   - `apps/web/public/questions/q1.svg`: Verificar remoção do texto "Região Dorsal".
4. **Condições de Invalidação**:
   - Se ao abrir `/host/:pin` a tela renderizar o painel do lobby em menos de 500ms sem intervenção manual, a falha P0.1 terá sido sanada.
   - Se após F5 em `/play/:pin` com uma questão ativa já respondida, o botão da resposta permanecer travado e selecionado, a falha P0.2 / P1.4 terá sido sanada.

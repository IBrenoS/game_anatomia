# DOCUMENTO DE PRODUTO E ENGENHARIA
# Batalha Anatômica — Bovino × Equino
## Product Requirements Document (PRD) — Versão 1.5
**Jogo multiplayer de anatomia veterinária para apresentação presencial**

* **Versão:** 1.5 (Fechamento Final de Realtime, Presença e Retry)
* **Data:** 19 de setembro de 2026
* **Status:** Especificação canônica atual; homologações externas permanecem explicitamente pendentes quando não executadas
* **Escopo:** MVP para uma partida efêmera com até 50 participantes simultâneos
* **Fonte Canônica:** `PRD.md`. Revisões PDF anteriores estão arquivadas em `docs/archive/` e não representam o contrato atual.

---

## 1. Resumo Executivo

A **Batalha Anatômica — Bovino × Equino** é uma aplicação web multiplayer em tempo real desenvolvida para revisar músculos dorsais e ventrais de bovinos e equinos durante apresentações acadêmicas presenciais de medicina veterinária. 

Os participantes (alunos) entram na partida pelo próprio celular sem necessidade de login, cadastro ou download de aplicativos, utilizando a câmera para ler um QR Code ou digitando um PIN de 6 dígitos. O apresentador (professor ou palestrante) conduz a sessão a partir de um computador ou dispositivo conectado a um projetor/telão (proporção 16:9).

O jogo é composto por dez questões previamente configuradas, cobrindo seis mecânicas didáticas distintas, com pontuação baseada no acerto (100, 200 ou 300 pontos) e um bônus de velocidade de 25% para respostas corretas submetidas nos primeiros 10 segundos da pergunta.

A arquitetura adota o modelo de autoridade absoluta do servidor executando sobre **Cloudflare Workers** com **Durable Objects** (`GameRoom`), **WebSockets com Hibernation API**, **SQLite integrado ao Durable Object** para persistência efêmera em memória/disco local, e **Durable Object Alarms** para a orquestração autônoma do loop de jogo em tempo real.

### Deltas da Versão 1.5 (Realtime, Presença e Retry)
1. **Callbacks de conexão canônica:** `webSocketClose` e `webSocketError` só alteram presença quando o `connectionId` do socket corresponde a `presence.connection_id`; callbacks tardios de conexões substituídas são ignorados.
2. **Projeção efetiva canônica:** `getEffectivePresences` usa exclusivamente o socket cujo par `(playerId, connectionId)` corresponde à presença persistida; sockets antigos não influenciam `connected` nem `lastSeenAt`.
3. **Heartbeat raw auto-respondido:** o frame `ping` tratado por `setWebSocketAutoResponse` não executa lógica da aplicação e, sozinho, não restaura `connected=true` após uma expiração. Enquanto a presença ainda está conectada, seu timestamp evita expiração indevida. Após expiração, a reativação determinística ocorre por mensagem autenticada que acorda o Durable Object (`REQUEST_SNAPSHOT`, `CLIENT_ALIVE`, `SUBMIT_ANSWER`) ou por `RESUME_SESSION`.
4. **Retry após rejeição:** `ANSWER_REJECTED` remove seleção otimista inválida e confirmação pendente. Uma nova seleção durante `QUESTION_ACTIVE` limpa o erro, registra a nova alternativa e reaplica a trava otimista até aceitação ou nova rejeição.

### Deltas da Versão 1.4 (Pacote Corretivo V3.2)
1. **Reativação de Presença no Mesmo WebSocket Aberto:** Qualquer evidência válida de atividade em WebSocket autenticado de jogador (`CLIENT_ALIVE`, `REQUEST_SNAPSHOT`, `SUBMIT_ANSWER`, etc.) restaura a presença (`connected = true`) sem duplicar o jogador, preservando `playerId`, `reconnectToken`, score, respostas e elegibilidade, garantindo incremento imediato de `connectedPlayers`.
2. **Exigência de Presença Coerente em `SUBMIT_ANSWER` (Semântica A):** O recebimento de `SUBMIT_ANSWER` em socket autenticado é reconhecido como sinal de atividade e reativa imediatamente a presença do jogador antes da validação da resposta, impedindo o estado anômalo de resposta aceita com jogador offline e assegurando coerência nos contadores canônicos (`answeredCount`, `activeEligiblePlayers`).
3. **Rearme do Scheduler de Presença em `RESUME_SESSION`:** Qualquer operação que torna a presença ativa (`JOIN_ROOM`, `RESUME_SESSION`, reativação por socket) invoca `ensurePresenceAlarmScheduled()`, garantindo agendamento para o próximo vencimento de presença sem loops em memória ou setInterval, respeitando `phaseDeadlineAt`.
4. **Monitoramento de Presença durante `PAUSED`:** A ação de pausa congela o relógio de gameplay (`remainingMs` preservado), mas NÃO congela a presença de rede. Durante `PAUSED`, alarmes de presença continuam operando de forma autônoma sem consumir tempo de rodada, sem disparar reveal e sem retomar o jogo.
5. **Desacoplamento de UI entre `interactionLocked` e `hasRecordedAnswer`:** A UI do jogador separa a trava de alternativas da confirmação visual de resposta. Jogadores em rodada pausada que ainda não responderam têm botões desabilitados mas NÃO visualizam a mensagem "Resposta registrada!".

### Deltas da Versão 1.3 (Pacote Corretivo V3.1)
1. **Game Loop 100% Automático e Eliminação de Botões de Caminho Feliz:** Transições de tela entre pergunta, revelação de gabarito (5 segundos), ranking de rodada (5 segundos), contagem regressiva (3 segundos) e próxima pergunta são orquestradas autonomamente pelo servidor via alarmes de Durable Object. Botões manuais de avanço de fluxo feliz foram eliminados da interface do apresentador, mantendo apenas controles de exceção (Pausar/Retomar e Encerrar Pergunta Antecipadamente).
2. **Início Condicionado a Presença Ativa (`connectedPlayers >= 1`):** O jogo só pode ser iniciado quando houver pelo menos 1 jogador com status `CONNECTED`. O botão de início permanece desabilitado com feedback explícito enquanto nenhum jogador estiver ativamente conectado.
3. **Pausa Estritamente Restrita a Pergunta Ativa:** A ação de pausa (`PAUSE`) só é permitida durante `QUESTION_ACTIVE`. Tentativas de pausar em `LOBBY`, `COUNTDOWN`, `QUESTION_REVEAL` ou `ROUND_RANKING` são expressamente rejeitadas pela máquina de estados e pelo servidor com `INVALID_STATE`.
4. **Anti-Spoiler Total e Projeção Canônica por `canRevealAnswer`:** Snapshots e broadcasts durante `LOBBY`, `COUNTDOWN`, `QUESTION_ACTIVE` e `PAUSED` jamais incluem `correctOptionId` ou `explanation` para qualquer cliente (host, telão ou jogador). O gabarito só é exposto em estados pós-encerramento (`QUESTION_REVEAL`, `ROUND_RANKING`, `FINAL_RANKING`, `PODIUM`, `FINISHED`).
5. **Expiração Autônoma de Presença via Alarmes de DO:** O servidor não depende de tráfego de entrada para expirar conexões silenciosas. O alarme periódico do Durable Object detecta inatividade de heartbeat (> 10s), transiciona o jogador para `TEMPORARILY_DISCONNECTED` e dispara autonomamente `checkAllAnswered()`, prevenindo travamento da rodada.
6. **Autenticação Estrita do Host Exclusivamente via Cookie:** O `hostToken` é verificado estritamente através do cookie HttpOnly `batalha_host_${pin}`. Fallbacks por query string ou URLs de WebSocket foram totalmente removidos.
7. **Isolamento de Sessão e Descarte de Conexões em Novas Partidas:** Ao clicar em "Nova Partida" ou "Voltar ao Início", o cliente desconecta explicitamente o WebSocket, reseta o Zustand store e limpa o estado interno do `WebSocketManager` (`seenEventIds`, `_roomVersion = 0`), garantindo que novas salas operem sem contaminação de cache.
8. **Semântica do Scheduler/Alarm:** Um disparo de `alarm()` representa apenas a execução do próximo trabalho agendado; não representa implicitamente o deadline da pergunta. Em `QUESTION_ACTIVE`, o servidor primeiro expira presenças, reavalia `allAnswered`, encerra somente se `now >= deadlineAt` e, caso contrário, agenda `min(deadlineAt, nextPresenceExpiryAt)`.
9. **Pausa Mecânica Restrita:** `PAUSE` permanece permitido somente em `QUESTION_ACTIVE`. Em `PAUSED`, o servidor rejeita respostas, preserva pergunta, versão, resposta já submetida, `remainingMs` e `accumulatedActiveMs`; jogador, host e telão exibem tempo congelado e estado explícito de pausa.
10. **Snapshot Autoritativo:** `SNAPSHOT` fornece `gameState`, `phaseStartedAt`, `phaseDeadlineAt`, `currentQuestionIndex`, `question`, `questionVersion`, `remainingMs`, `countdownKind`, estado pessoal de resposta, progresso, quatro contadores canônicos, distribuição autorizada, ranking e pódio. O countdown de retomada possui deadline próprio de 3 segundos e nunca reutiliza o deadline anterior da pergunta.
11. **Contrato Público Enxuto:** `SHOW_RANKING`, `NEXT_QUESTION`, `START_PODIUM` e `COMPLETE_GAME` não integram o protocolo público. As transições correspondentes são internas ao loop automático.
12. **Limites de Homologação:** Testes automatizados em Chromium/WebKit não equivalem a homologação em hardware físico. Validação Android/iPhone físico e validação acadêmica humana são registradas como pendentes até evidência real.

---

## 2. Contexto do Produto e Objetivos

### 2.1 Problema
Atividades de perguntas e respostas em apresentações acadêmicas de medicina veterinária frequentemente sofrem com:
* Fricção excessiva de entrada (necessidade de cadastro, instalação de apps ou e-mails);
* Dependência de conexões de internet pesadas e instáveis em salas de aula;
* Revelação involuntária de gabarito em telas públicas antes que todos os alunos respondam;
* Necessidade de intervenções manuais repetitivas do apresentador a cada pergunta, quebrando o ritmo pedagógico da aula;
* Travamento de clientes em celulares ao bloquear tela ou alternar aplicativos.

### 2.2 Proposta de Valor
A aplicação oferece uma sequência imersiva e automatizada de dez desafios anatômicos:
* **Telão (Projetor 16:9):** Mantém o foco coletivo da turma, exibindo enunciado em fonte ampliada, ilustrações anatômicas limpas (sem rótulos de gabarito), progresso coletivo e estatísticas agregadas durante a revelação.
* **Celular do Jogador (Mobile Vertical):** Oferece interação direta com botões de toque amplo, bloqueio visual imediato ao votar, neutralidade contra spoilers e feedback individual enriquecido pós-rodada.
* **Painel do Apresentador:** Concede visão pedagógica privilegiada com contagens em tempo real, mantendo controles de exceção (pausa, avanço antecipado, moderação e ejeção de participantes).

### 2.3 Métricas de Sucesso do MVP
| Indicador | Meta do MVP | Método de Verificação |
|---|---|---|
| **Taxa de Entrada** | ≥ 95% dos participantes no lobby em até 60 segundos após exibição do QR Code | Teste de carga e ensaios presenciais |
| **Sincronização** | Mudanças de estado propagadas para 95% dos clientes conectados em até 500 ms | Métricas de broadcast no servidor |
| **Confirmação de Resposta** | Latência de confirmação (`ANSWER_ACCEPTED`) ≤ 500 ms no percentil 95 sob 50 conexões | Teste de carga automatizado (SLA verificado: p95 < 150ms) |
| **Confiabilidade Pedagógica** | 0% de respostas perdidas ou computadas em duplicidade | Testes automatizados de concorrência e carga |

---

## 3. Usuários, Superfícies e Princípios de Experiência

### 3.1 Papéis e Superfícies
| Papel | Necessidade Central | Superfície e Orientação |
|---|---|---|
| **Jogador** | Entrar instantaneamente sem cadastro, responder de forma clara e acompanhar sua pontuação individual | Celular (smartphones Android e iOS) em orientação vertical (*portrait*) |
| **Apresentador (Host)** | Criar a sala, acompanhar o engajamento pedagógico da turma e gerenciar situações excepcionais | Computador portátil ou desktop (resolução ≥ 1024px) |
| **Audiência (Telão)** | Acompanhar a questão, ilustrações anatômicas, distribuição de respostas e pódio dos campeões | Projetor ou Smart TV em proporção 16:9 (1920×1080 recomendado) |

### 3.2 Princípios de Experiência e Game Feel
* **Ação Única Evidente:** Cada tela do celular deve deixar explícita uma única ação primária por estado.
* **Economia de Informação Mobile:** O celular não replica a densidade textual do projetor; exibe alternativas com botões amplos e contraste elevado.
* **Neutralidade Absoluta contra Spoilers:** Enquanto a rodada estiver aberta (`QUESTION_ACTIVE`), nenhuma tela pública nem aparelho de jogador que já respondeu pode insinuar ou destacar a resposta correta ou a tendência de votos.
* **Feedback Imediato (Answer Lock):** Ao tocar numa alternativa, a interface fornece resposta tátil/visual imediata (< 50ms): seleção destacada, opções bloqueadas contra novos toques e confirmação textual de registro.
* **Game Feel e Atmosfera Acadêmica:** Microanimações no lobby, contagem sincronizada 3-2-1 em português ("Prepare-se"), animação de pontuação (+125 pts com ícone de rapidez), feedback educativo de erro (sem humilhação) e atmosfera com iluminação especial no Desafio Final (Q10).
* **Acessibilidade Universal:** Contraste mínimo WCAG AA em todas as alternativas, suporte completo a navegação por teclado e conformidade estrita com `prefers-reduced-motion`.

---

## 4. Jornadas de Usuário

### 4.1 Jornada do Jogador
```text
Entrada (/join/:pin via QR Code ou PIN)
↓
Definição de Apelido (Normalizado, 2-20 caracteres)
↓
Lobby do Jogador ("✓ Você entrou!", contagem de participantes, microanimação de espera)
↓
Contagem Regressiva (3-2-1 sincronizado com áudio opcional)
↓
Pergunta Ativa (Cronômetro dinâmico, imagem anatômica, 4 botões de resposta)
↓
Resposta Registrada ("Resposta registrada / Aguardando os demais participantes...")
↓
Revelação Automática (5s: Acerto com bônus / Erro com gabarito / "Tempo esgotado — Sem resposta")
↓
Ranking da Rodada (5s: Posição individual no celular, pontuação total, variação de colocações)
↓
Contagem Regressiva (3s: 3 -> 2 -> 1)
↓
Próxima Pergunta Automática (Avanço contínuo da Q2 até a Q9)
↓
Desafio Final (Questão 10: Clímax acadêmico com valor de 300 pontos e comparativo morfológico)
↓
Revelação Final (5s)
↓
Ranking Final Consolidado (5s)
↓
Cerimônia de Pódio (Sequência animada adaptativa com troféus e confetes)
↓
Partida Concluída (FINISHED: Posição final de honra e pontuação total do jogador)
↓
Botão "Voltar ao Início" (Purga sessão local e permite novo jogo imediatamente)
```

### 4.2 Jornada do Apresentador (Host)
No fluxo normal da partida, o apresentador apenas clica em **"Iniciar Partida"** no Lobby. Todas as transições subsequentes são automáticas:

```text
Apresentador abre /host
↓
"Iniciar Batalha" (Criação de sala efêmera)
↓
Lobby com PIN, QR Code e Link de Entrada
↓
Apresentador clica em "Iniciar Partida"
↓
[Transições Automáticas do Game Loop: Q1 a Q10]
↓
Pódio e Encerramento
↓
"Nova Partida" ou "Voltar ao Início"
```

#### Controles de Exceção do Apresentador:
* **Abrir Telão:** Atalho para abrir a projeção pública em `/screen/:pin` em nova aba ou tela estendida.
* **Pausar Rodada:** Congela o cronômetro oficial, o alarme do servidor e os timers dos clientes; preserva intactas as respostas já aceitas e o tempo ativo para fins de bônus de velocidade.
* **Retomar Rodada:** Dispara contagem de 3 segundos e retoma a rodada com o tempo restante exato.
* **Encerrar Questão Antecipadamente:** Fecha a rodada ativa imediatamente e avança para a revelação pedagógica.
* **Bloquear / Liberar Entradas:** Impede a entrada de novos participantes na sala a qualquer momento.
* **Remover Participante:** Ejeta participante com conduta inadequada, cancelando sua conexão WebSocket e desqualificando-o do cálculo da rodada.
* **Encerrar Partida:** Interrompe a partida imediatamente e finaliza a sala.
* **Controles Locais:** Alterna efeitos sonoros sintetizados e modo de tela cheia (fullscreen).

### 4.3 Jornada da Audiência (Telão 16:9)
* **Lobby:** Exibe PIN em destaque, QR Code de alta densidade, URL amigável de entrada e roster com os participantes que entram na arena em tempo real com efeito de pulso suave.
* **Contagem Regressiva:** Animação expansiva com os números 3, 2, 1 e a legenda "Prepare-se!".
* **Pergunta Ativa:** Exibe cronômetro visual com alerta cromático nos últimos 10 segundos, enunciado em corpo de texto ampliado, esquema anatômico limpo e as alternativas coloridas. Exibe o progresso de respondentes (ex.: "18/25 responderam") sem revelar a distribuição de opções nem o gabarito.
* **Revelação Didática:** Destaca a alternativa correta em verde esmeralda, exibe gráfico com percentuais e contagens reais de votos da turma e apresenta a explicação anatômica formal para discussão em sala.
* **Ranking:** Exibe os 5 primeiros colocados com pontuação acumulada.
* **Pódio:** Executa a cerimônia adaptativa dos vencedores com pedestais animados, troféus e partículas comemorativas.

---

## 5. Game Loop Automático e Máquina de Estados

### 5.1 Especificação das Transições Oficiais
O fluxo oficial é estritamente orquestrado pelos alarmes do Durable Object (`alarm()`):

```text
[LOBBY] 
  │  (Host clica em "Iniciar Partida")
  ▼
[COUNTDOWN] (3 segundos)
  │  (Alarme automático dispara)
  ▼
[QUESTION_ACTIVE] (Duração padrão: 60s)
  │  (Condições de saída: Todos os ativos respondem OU Prazo expira OU Host encerra)
  ▼
[QUESTION_REVEAL] (Exatamente 5 segundos)
  │  (Alarme automático dispara)
  ▼
[ROUND_RANKING] (Exatamente 5 segundos — Q1 a Q9)
  │  (Alarme automático dispara)
  ▼
[COUNTDOWN] (Exatamente 3 segundos)
  │  (Alarme automático dispara)
  ▼
[Próxima QUESTION_ACTIVE]
```

#### Fechamento Especial da 10ª Questão:
```text
[QUESTION_ACTIVE (Q10)]
  │  (Todos respondem ou prazo expira)
  ▼
[QUESTION_REVEAL (Q10)] (Exatamente 5 segundos)
  │  (Alarme automático dispara)
  ▼
[FINAL_RANKING] (Exatamente 5 segundos)
  │  (Alarme automático dispara)
  ▼
[PODIUM] (Cerimônia adaptativa: ~8 a 10 segundos)
  │  (Alarme automático dispara)
  ▼
[FINISHED] (Estado terminal definitivo da sala)
```

### 5.2 Pódio Adaptativo Obrigatório
A cerimônia de pódio ocorre obrigatoriamente independente da quantidade de jogadores presentes:
* **1 Participante:** Pedestal centralizado de 1º Lugar com troféu dourado, coroa de campeão, apelido e pontuação total.
* **2 Participantes:** Pedestais balanceados de 2º Lugar (Prata) e 1º Lugar (Ouro), revelados sequencialmente sem coluna vazia.
* **3 ou mais Participantes:** Sequência clássica revelando 3º Lugar (Bronze) → 2º Lugar (Prata) → 1º Lugar (Ouro Campeão), seguido da visualização da tabela completa.

---

## 6. Conteúdo Pedagógico e Regras de Pontuação

### 6.1 As 6 Mecânicas Didáticas
O jogo contém 10 questões estáticas validadas por Zod em tempo de compilação:
1. **Identificação Anatômica (`identify`):** Reconhecimento de estrutura muscular em imagem anatômica (100 pts).
2. **Classificação Regional (`region`):** Discriminação entre músculos de região dorsal ou ventral (100 pts).
3. **Diferenciação por Espécie (`species`):** Identificação de particularidades morfológicas de bovinos vs. equinos (100 pts).
4. **Função Muscular (`function`):** Relação biomecânica e motora dos músculos do tronco e membros (200 pts).
5. **Verdadeiro ou Falso (`boolean`):** Análise de proposições anatômicas afirmativas ou negativas (100 pts).
6. **Desafio Final (`final`):** Síntese comparativa miológica avançada entre grandes animais (300 pts).

### 6.2 Fórmula Oficial de Pontuação e Bônus
* **Acerto Normal:** Concede a pontuação base da questão (100, 200 ou 300 pontos).
* **Bônus de Rapidez:** Se a resposta correta for recebida nos primeiros 10 segundos da pergunta (`tempo_ativo ≤ 10.000 ms`), é aplicado um bônus fixo de 25%:
  $$\text{Pontos} = \text{round}(\text{basePoints} \times 1.25)$$
  * Questão de 100 pts $\rightarrow$ **125 pontos**
  * Questão de 200 pts $\rightarrow$ **250 pontos**
  * Desafio Final de 300 pts $\rightarrow$ **375 pontos**
* **Erro ou Timeout:** **0 pontos**.
* **Preservação de Tempo em Pausa:** Caso o apresentador pause a rodada, o tempo acumulado antes da pausa é somado ao tempo decorrido após a retomada:
  $$\text{responseTimeMs} = \text{accumulatedActiveMs} + (\text{now} - \text{startedAt})$$
  Garante que uma pausa legítima do professor não prejudique a janela de bônus do estudante.

### 6.3 Critérios Oficiais de Desempate no Ranking
A classificação dos participantes é estritamente determinística, avaliada na seguinte ordem:
1. **Maior pontuação total acumulada;**
2. **Maior número de respostas corretas;**
3. **Menor tempo total acumulado exclusivamente nas respostas corretas;**
4. **Ordem cronológica de ingresso na sala (`joinedAt`).**

---

## 7. Realtime, Presença e Resiliência Mobile

### 7.1 Estados Formais de Presença
O sistema diferencia formalmente três estados para cada participante:
1. **`CONNECTED`:** Conexão WebSocket aberta e emitindo heartbeats regulares (sinal nos últimos 10 segundos). Participa de todos os eventos e é contabilizado para a condição de "todos responderam".
2. **`TEMPORARILY_DISCONNECTED`:** Ausência de sinal de heartbeat há mais de 10 segundos ou socket encerrado sem ação voluntária de saída. O jogador:
   * Permanece registrado no banco de dados da sala;
   * Preserva seus pontos e histórico intactos;
   * **Não bloqueia** o encerramento da rodada ativa por "todos responderam";
   * Pode retornar a qualquer instante dentro da validade da sala e receber o snapshot atualizado.
3. **`REMOVED`:** Participante expulso administrativamente pelo apresentador. Tem sua conexão encerrada, seu `reconnectToken` revogado e é desqualificado de rankings ativos.

### 7.2 Tratamento de Foreground e Background Mobile
Dispositivos móveis (Android Chrome, iOS Safari) rotineiramente suspendem o processamento de abas em segundo plano ou quando a tela é bloqueada. Para assegurar convergência instantânea:
* **Listeners Ativos:** O cliente monitora `document.addEventListener('visibilitychange')`, `window.addEventListener('pageshow')` e `window.addEventListener('focus')`.
* **Retorno com Socket Fechado:** Executa imediatamente a reconexão automática enviando `RESUME_SESSION` com o `reconnectToken` salvo.
* **Retorno com Socket Aparentemente Aberto:** Envia imediatamente `REQUEST_SNAPSHOT` para forçar a resincronização de estado com o servidor.
* **Resultado:** O aluno vê imediatamente o estado oficial da arena (mesmo que a partida já esteja em outra questão ou no pódio), sem precisar de F5 ou comandos manuais.

### 7.3 Conectividade de Rede (Offline / Online)
* Ao disparar `window.offline`: A interface exibe aviso flutuante não intrusivo de perda de conectividade, sem deletar a identidade nem zerar os pontos do participante.
* Ao disparar `window.online`: O cliente tenta reconectar imediatamente via `RESUME_SESSION` e snapshot sem aguardar o backoff exponencial.

### 7.4 Protocolo de Versão e Resolução de Concorrência
* **`roomVersion`:** Inteiro sequencial monotonicamente crescente mantido pelo Durable Object para todas as transições de fase da sala.
* **`last_state_version`:** Registra a versão da sala no momento em que a fase atual foi iniciada. Comandos administrativos do host (como pausar ou encerrar a questão) são aceitos se `expectedRoomVersion >= lastStateVersion && expectedRoomVersion <= roomVersion`. Isso resolve o conflito em que o envio simultâneo de respostas de alunos não invalida os comandos do professor.
* **Detecção de Gaps:** Se um cliente receber um evento com `incomingVersion > localVersion + 1`, ele descarta o evento incremental e emite imediatamente `REQUEST_SNAPSHOT`.
* **Idempotência:** Mensagens duplicadas recebidas com o mesmo `eventId` são descartadas.

### 7.5 Contadores Canônicos
* **`totalPlayers`:** jogadores registrados na sala e não removidos.
* **`connectedPlayers`:** jogadores com presença viva no instante da projeção.
* **`eligiblePlayers`:** jogadores elegíveis pelas regras da rodada, independentemente da conectividade atual.
* **`activeEligiblePlayers`:** interseção entre jogadores elegíveis e presença viva; é o denominador autoritativo de `allAnswered`.
* **`answeredCount`:** quantidade de jogadores `activeEligiblePlayers` que já possuem resposta na questão atual.

Clientes exibem e tomam decisões funcionais a partir desses valores do servidor; `players.length` não substitui nenhum contador canônico.

### 7.6 Timing Autoritativo de Fase
Toda fase temporizada possui `phaseStartedAt` e `phaseDeadlineAt` persistidos pelo `GameRoom`. `COUNTDOWN` também informa `countdownKind` (`INITIAL`, `NEXT_QUESTION` ou `RESUME`). Durante `PAUSED`, `phaseDeadlineAt` é nulo e `remainingMs` é o valor congelado. Após um countdown `RESUME`, a mesma questão volta a `QUESTION_ACTIVE` com novo deadline calculado como `now + remainingMs`.

### 7.7 Reativação de Presença no Mesmo WebSocket Aberto
Qualquer evidência válida de atividade em WebSocket autenticado de jogador (`CLIENT_ALIVE`, `REQUEST_SNAPSHOT`, `SUBMIT_ANSWER`, etc.) aciona `markPlayerPresent(playerId, connectionId, now)`:
* Confirma que a conexão pertence ao jogador;
* Atualiza `presence.connected = true` e `last_seen_at = now`;
* Mantém intactos `playerId`, `reconnectToken`, pontuação, respostas e elegibilidade;
* Não cria registros duplicados;
* Notifica clientes via `PLAYER_PRESENCE_CHANGED` e incrementa `connectedPlayers`;
* Garante que o jogador volte a ser computado imediatamente como ativo sem depender exclusivamente de `RESUME_SESSION`.

### 7.8 Exigência de Presença Coerente em SUBMIT_ANSWER (Semântica A)
Antes da validação da resposta, a submissão de `SUBMIT_ANSWER` em socket autenticado é reconhecida como sinal efetivo de vida:
* Primeiro reativa a presença do participante no servidor;
* Em seguida processa as regras de resposta (estado da rodada, prazo, elegibilidade, opção válida);
* Atualiza contadores canônicos (`answeredCount`, `activeEligiblePlayers`, `connectedPlayers`);
* É terminantemente proibido o estado anômalo onde uma resposta é aceita enquanto o jogador permanece offline.

### 7.9 Rearme Autônomo de Scheduler de Presença
Toda operação que torna ou restaura presença ativa (`JOIN_ROOM`, `RESUME_SESSION`, reativação por atividade de socket) invoca `ensurePresenceAlarmScheduled()`:
* Compatível com Hibernation API, sem loops ou timers em memória;
* Seleciona o menor instante relevante entre o deadline da fase ativa (`phaseDeadlineAt`) e a próxima expiração de presença conectada (`lastSeenAt + PRESENCE_TIMEOUT_MS + 100`);
* Previne que reconexões no Lobby ou em fases sem deadline deixem de monitorar silêncios subsequentes.

### 7.10 Monitoramento Contínuo de Presença durante PAUSED
O comando `PAUSE` congela exclusivamente o relógio de gameplay:
* `remainingMs` da pergunta é preservado sem decremento;
* `accumulatedActiveMs` é congelado;
* Respostas novas permanecem bloqueadas;
* A presença de rede NÃO é congelada: o alarme de presença continua agendado e, disparando em `PAUSED`, expira jogadores inativos, atualiza contadores e reagenda próximo alarme sem avançar a fase nem disparar reveal.

### 7.11 Desacoplamento na UI entre interactionLocked e hasRecordedAnswer
A interface móvel do participante desacopla duas condições fundamentais:
* **`interactionLocked = roomState !== 'QUESTION_ACTIVE' || hasRecordedAnswer`:** bloqueia alternativas fora da janela ativa ou durante uma submissão/registro existente;
* **`hasRecordedAnswer = answerSubmitted || Boolean((selectedOptionId || optimisticOptionId) && !answerRejected)`:** define se existe escolha pendente ou voto aceito, excluindo tentativas rejeitadas.
Em `PAUSED` sem resposta enviada, as alternativas ficam desabilitadas exibindo o aviso "Partida pausada pelo apresentador", sem renderizar indevidamente a confirmação "Resposta registrada!" nem "Aguarde o encerramento".

### 7.12 Conexão Canônica e Heartbeat Raw
Para cada jogador, `presence.connection_id` identifica a única conexão canônica. Projeções, callbacks de fechamento e callbacks de erro devem comparar simultaneamente `playerId` e `connectionId`; uma conexão substituída nunca pode derrubar ou atualizar a presença da conexão atual.

O heartbeat raw `ping` é respondido pela Hibernation API sem acordar o Durable Object. Seu timestamp pode prolongar uma presença que ainda está conectada, mas não executa escrita nem transição de aplicação. Portanto, depois que `connected=false` foi persistido, o raw heartbeat isolado não reativa a presença. `REQUEST_SNAPSHOT`, `CLIENT_ALIVE`, `SUBMIT_ANSWER` no socket canônico ou `RESUME_SESSION` constituem sinais autenticados que reativam deterministicamente a presença.

### 7.13 Retry após ANSWER_REJECTED
Ao receber `ANSWER_REJECTED`, o cliente remove `selectedOptionId`, `answerAcceptedAt` e qualquer trava otimista da tentativa rejeitada, mantendo `answerSubmitted=false`. Se a fase ainda for `QUESTION_ACTIVE`, a próxima escolha limpa `answerRejected`, define a nova alternativa e bloqueia novamente a interação durante a submissão. Ao receber `ANSWER_ACCEPTED`, a alternativa escolhida permanece registrada e `answerSubmitted=true`.

---

## 8. Segurança, Privacidade e Integridade

### 8.1 Sessão Administrativa do Host
1. **Emissão de Cookie Seguro:** Ao criar uma sala (`POST /api/rooms`), o Worker gera um token criptográfico de 32 bytes e o configura exclusivamente via cabeçalho HTTP:
   ```http
   Set-Cookie: batalha_host_<PIN>=<HOST_TOKEN>; Path=/; HttpOnly; SameSite=Strict; Secure
   ```
2. **Proibição de Vazamento:** O `hostToken` jamais é devolvido no corpo JSON da resposta, nem armazenado em `localStorage`, nem exposto em query params ou na URL de conexão WebSocket.
3. **Isolamento do PIN:** O conhecimento do PIN de 6 dígitos permite apenas a entrada como jogador ou visualização do telão público, sendo totalmente insuficiente para autorizar comandos de moderação.
4. **Autenticação no Handshake:** Durante o upgrade de WebSocket para o papel de `host`, o Worker valida a presença do cookie `batalha_host_<PIN>`.

### 8.2 Rate Limiting e Proteção contra Abuso
* Criação de salas limitada a no máximo 10 requisições por minuto por endereço IP.
* Payloads recebidos via WebSocket são limitados a 64 KB.
* Apelidos sofrem sanitização estrita (remoção de tags HTML, caracteres de controle e normalização de espaços, entre 2 e 20 caracteres).

---

## 9. Requisitos Funcionais Detalhados

### Sala e Entrada
* **FR 001:** O sistema deve criar uma sala efêmera e retornar PIN, QR Code, joinUrl e definir cookie seguro do host.
* **FR 002:** O PIN deve conter exatamente seis dígitos numéricos e identificar uma única sala ativa.
* **FR 003:** O QR Code deve direcionar diretamente para `/join/:pin`, abrindo a etapa de definição de apelido.
* **FR 004:** A entrada manual deve validar PIN inexistente, expirado e sala bloqueada ou cheia (máximo 50 participantes).
* **FR 005:** O apelido deve ser normalizado, ter entre 2 e 20 caracteres visíveis e ser único na sala.
* **FR 006:** A tela de entrada deve exibir o estado da conexão e mensagens claras de erro.
* **FR 007:** O telão deve exibir PIN em tamanho grande, link de acesso e QR Code escaneável à distância.
* **FR 008:** O apresentador deve ter atalho dedicado ("Abrir Telão") para abrir a projeção pública.

### Condução e Game Loop Automático
* **FR 009:** O jogo deve iniciar por comando explícito do apresentador no Lobby, acionando contagem de 3 segundos.
* **FR 010:** Cada contagem regressiva (início e retomada) deve durar exatamente 3 segundos em português ("Prepare-se", 3, 2, 1).
* **FR 011:** O início da questão deve gravar `startedAt`, calcular `deadlineAt` e notificar todos os clientes.
* **FR 012:** Durante a questão ativa, o jogador vê alternativas, imagem e tempo restante, sem qualquer indício do gabarito.
* **FR 013:** Ao selecionar uma alternativa, o cliente trava os botões imediatamente e recebe confirmação com `receivedAt`.
* **FR 014:** O jogador não pode alterar nem reenviar sua resposta após o primeiro registro válido.
* **FR 015:** O telão deve exibir a quantidade de respostas submetidas sem indicar tendências de votos por alternativa.
* **FR 016:** O apresentador pode acompanhar a contagem agregada de respostas por opção em tempo real, sem destaque de gabarito antes da revelação.
* **FR 017:** A questão encerra automaticamente assim que o último jogador ativo e elegível responder ou quando o prazo oficial expirar.
* **FR 018:** O apresentador pode encerrar a questão antecipadamente em caráter de exceção.
* **FR 019:** O encerramento da questão consolida pontos, bônus e ranking exatamente uma vez de forma idempotente.
* **FR 020:** A revelação (`QUESTION_REVEAL`) deve iniciar automaticamente após o encerramento e durar exatamente 5 segundos.
* **FR 021:** Na revelação, o jogador vê se acertou ou errou, pontos ganhos, bônus e o gabarito. Casos de timeout exibem "Tempo Esgotado — Sem resposta".
* **FR 022:** Na revelação, o telão e o host exibem a alternativa correta em destaque, gráfico percentual de respostas da turma e a explicação didática.
* **FR 023:** O ranking de rodada (`ROUND_RANKING`) deve iniciar automaticamente após os 5 segundos da revelação e durar exatamente 5 segundos.
* **FR 024:** O ranking deve ordenar participantes por pontos, acertos, tempo em acertos e ordem de entrada.
* **FR 025:** O celular do jogador exibe sua colocação individual, pontuação total e variação de posição no ranking.
* **FR 026:** Após 5 segundos no ranking de rodada, o sistema inicia automaticamente a contagem regressiva de 3 segundos para a próxima pergunta.
* **FR 027:** O apresentador pode pausar a rodada a qualquer momento, congelando os prazos e timers em todos os clientes.
* **FR 028:** Ao retomar uma rodada pausada, uma contagem de 3 segundos é executada e o tempo restante exato é restaurado.
* **FR 029:** O apresentador pode expulsar participantes indisciplinados, cancelando sua sessão imediatamente.
* **FR 030:** A décima questão (Desafio Final) deve ter destaque visual diferenciado e valer 300 pontos base.
* **FR 031:** Após a revelação da 10ª questão, o sistema transiciona automaticamente para o Ranking Final (5 segundos) e em seguida para a Cerimônia de Pódio.
* **FR 032:** O pódio deve ser adaptativo, funcionando de forma completa para 1, 2 ou 3+ participantes.
* **FR 033:** Após a cerimônia de pódio, o jogo transiciona para o estado `FINISHED`, exibindo telas finais reais para jogadores e apresentador.
* **FR 034:** A tela `FINISHED` do jogador e do host contém botão "Voltar ao Início", que desconecta a sessão, purga dados locais do `localStorage` e permite nova partida sem necessidade de limpar cache do navegador.

### Reconexão e Presença
* **FR 035:** O servidor gera `playerId` e `reconnectToken` aleatórios por participante no momento do aceite.
* **FR 036:** O cliente armazena `reconnectToken` localmente e o utiliza em comandos `RESUME_SESSION`.
* **FR 037:** O retorno de abas mobile suspensas (foreground) deve disparar resincronização automática via `RESUME_SESSION` ou `REQUEST_SNAPSHOT`.
* **FR 038:** Eventos de rede `online`/`offline` devem ser tratados de forma autônoma pelo cliente.
* **FR 039:** Todo cliente reconectado recebe um `SNAPSHOT` integral de estado antes de eventos incrementais.
* **FR 040:** Participantes desconectados temporariamente não bloqueiam a regra de encerramento por "todos responderam".

---

## 10. Requisitos Não Funcionais

| ID | Atributo | Requisito Formal |
|---|---|---|
| **NFR 01** | **Capacidade** | Suportar até 50 jogadores simultâneos conectados por WebSocket, 1 host e até 2 telas espectadoras por sala. |
| **NFR 02** | **Latência de Broadcast** | Broadcast de mudanças de estado entregue a 95% dos clientes em até 500 ms a partir do processamento no servidor. |
| **NFR 03** | **Consistência** | Pontuação, validação de respostas, ranking e transições de fase serializadas com autoridade exclusiva pelo Durable Object. |
| **NFR 04** | **Disponibilidade Mobile** | Reconexão transparente ao alternar abas ou restaurar rede sem perda de pontos ou duplicidade de registros. |
| **NFR 05** | **Idempotência** | Eventos duplicados com mesmo `eventId` ou respostas repetidas são descartados sem causar mutações adicionais de estado. |
| **NFR 06** | **Acessibilidade por Teclado** | Todas as ações essenciais de jogador, host e tela operáveis via teclado com indicador de foco visível. |
| **NFR 07** | **Movimento Reduzido** | Respeitar a preferência do sistema operacional (`prefers-reduced-motion: reduce`), desativando confetes e transições bruscas. |
| **NFR 08** | **Contraste Cromático** | Textos e alternativas com contraste compatível com nível WCAG 2.1 AA. |
| **NFR 09** | **Responsividade** | Interface de jogador otimizada para telas móveis verticais de 360px a 430px de largura; telão otimizado para 16:9 em 1080p. |
| **NFR 10** | **Tolerância a Redes Instáveis** | Funcionamento estável em conexões 3G/4G/Wi-Fi com perda intermitente de pacotes e latência variável de até 300 ms. |
| **NFR 11** | **Orçamento de Mídia** | Imagens anatômicas em formato vetorial SVG ou formatos compactos (AVIF/WebP) com peso preferencial inferior a 500 KB. |
| **NFR 12** | **Compatibilidade de Navegadores** | Fluxos automatizados devem permanecer verdes em Chromium e WebKit. Compatibilidade em Android/iPhone físico exige homologação manual separada e não pode ser inferida apenas desses testes. |
| **NFR 13** | **Retenção e Privacidade** | Salas e dados temporários no SQLite do Durable Object purgados automaticamente em até 24 horas após o encerramento da partida. |
| **NFR 14** | **Segurança de Credenciais** | O token administrativo do apresentador jamais trafega no corpo de respostas públicas nem em scripts de frontend. |
| **NFR 15** | **Isolamento de Infraestrutura** | Arquitetura efêmera sem dependência de bancos relacionais externos (PostgreSQL/Supabase/Firebase) ou instâncias de Redis. |
| **NFR 16** | **Integridade de Build** | Conteúdo das 10 questões, mídias e gabaritos auditados estritamente com schemas Zod durante o pipeline de build. |

---

## 11. Arquitetura Técnica e Modelo de Dados

### 11.1 Stack de Tecnologia
* **Frontend:** React 18+, TypeScript 5+, Vite com plugin oficial da Cloudflare, Tailwind CSS, Radix UI primitives, Zustand.
* **Backend:** Cloudflare Workers, Cloudflare Durable Objects com Hibernation API e SQLite local integrado.
* **Tempo Real:** WebSockets bidirecionais com `EventEnvelope` versionado e alarme agendado (`DO Alarms`).
* **Validação de Contratos:** Zod em pacote compartilhado `@batalha/protocol`.
* **Workspace:** Monorepo pnpm com pacotes `@batalha/protocol`, `@batalha/content`, `@batalha/game`, `@batalha/ui` e aplicação `apps/web`.

### 11.2 Esquema do Banco SQLite no Durable Object
```sql
CREATE TABLE IF NOT EXISTS room (
  pin TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  room_version INTEGER NOT NULL DEFAULT 1,
  last_state_version INTEGER NOT NULL DEFAULT 1,
  entry_locked INTEGER NOT NULL DEFAULT 0,
  current_question_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player (
  player_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  presence TEXT NOT NULL DEFAULT 'CONNECTED', -- CONNECTED | TEMPORARILY_DISCONNECTED | REMOVED
  joined_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  eligible_from_question INTEGER NOT NULL DEFAULT 0,
  removed_at INTEGER
);

CREATE TABLE IF NOT EXISTS question_round (
  question_index INTEGER PRIMARY KEY,
  question_id TEXT NOT NULL,
  state TEXT NOT NULL, -- ACTIVE | PAUSED | REVEAL | RANKING
  started_at INTEGER NOT NULL,
  deadline_at INTEGER NOT NULL,
  remaining_ms INTEGER NOT NULL,
  accumulated_active_ms INTEGER NOT NULL DEFAULT 0,
  ended_at INTEGER,
  end_reason TEXT
);

CREATE TABLE IF NOT EXISTS player_answer (
  question_index INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  awarded_points INTEGER NOT NULL,
  PRIMARY KEY (question_index, player_id)
);

CREATE TABLE IF NOT EXISTS score (
  player_id TEXT PRIMARY KEY,
  total_points INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  correct_response_time_ms INTEGER NOT NULL DEFAULT 0
);
```

---

## 12. Protocolo de Comunicação em Tempo Real

### 12.1 Envelope de Eventos
```typescript
interface EventEnvelope<TType extends string, TPayload> {
  protocolVersion: 1
  eventId: string
  type: TType
  sentAt: number
  roomVersion: number
  correlationId?: string
  payload: TPayload
}
```

### 12.2 Catálogo de Eventos do Cliente
* `JOIN_ROOM`: Payload `{ pin, nickname }` — Inicia tentativa de entrada do jogador no lobby.
* `RESUME_SESSION`: Payload `{ pin, reconnectToken }` — Restaura sessão de jogador existente após reconexão ou foco.
* `SUBMIT_ANSWER`: Payload `{ questionId, questionVersion, optionId }` — Submete resposta oficial de uma pergunta.
* `CLIENT_ALIVE`: Payload `{ clientTime }` — Heartbeat periódico da aplicação (a cada 5 segundos).
* `REQUEST_SNAPSHOT`: Payload `{ lastRoomVersion }` — Solicita projeção integral do estado após salto de versão ou foreground.
* `HOST_COMMAND`: Payload `{ command, expectedRoomVersion, ...params }` — Comandos de moderação exclusivos do apresentador (`START_GAME`, `PAUSE`, `RESUME`, `END_QUESTION`, `LOCK_ENTRIES`, `UNLOCK_ENTRIES`, `REMOVE_PLAYER`, `END_GAME`).

### 12.3 Catálogo de Eventos do Servidor
* `SESSION_ACCEPTED`: Devolve `playerId` e `reconnectToken` privado ao jogador recém-admitido.
* `SNAPSHOT`: Projeção universal e completa do estado da sala, adaptada aos privilégios de cada papel.
* `PLAYER_JOINED`: Notifica a entrada de um novo participante com lista e contadores canônicos atualizados.
* `PLAYER_PRESENCE_CHANGED`: Notifica alteração no estado de conectividade (`CONNECTED`, `TEMPORARILY_DISCONNECTED`, `REMOVED`).
* `GAME_STATE_CHANGED`: Broadcast oficial de avanço de fase na máquina de estados com novo `roomVersion`.
* `QUESTION_STARTED`: Notifica início da pergunta ativa com enunciado, opções públicas, `startedAt` e `deadlineAt`.
* `ANSWER_ACCEPTED`: Confirmação privada entregue exclusivamente ao jogador que submeteu uma resposta válida.
* `ANSWER_REJECTED`: Mensagem de erro com código descritivo em caso de resposta inválida, duplicada ou fora de prazo.
* `QUESTION_ENDED`: Notifica encerramento da rodada ativa por alarme, resposta unânime ou intervenção do host.
* `ANSWER_REVEAL`: Publica gabarito oficial, distribuição percentual da turma e feedback individual.
* `RANKING_UPDATED`: Publica ranking atualizado da rodada ou classificação final definitiva.
* `ROOM_FINISHED`: Notifica o término formal da partida e início do período de expiração efêmera.

---

## 13. Critérios de Aceite Críticos

* **AC 01 — Todos respondem antes do prazo:** Quando o último participante ativo e elegível envia uma resposta válida, o servidor encerra a questão imediatamente sem aguardar o restante dos 60 segundos.
* **AC 02 — Prazo expira:** Ao esgotar o prazo (`deadlineAt`), novas respostas são rejeitadas com `DEADLINE_EXCEEDED` e o cálculo da rodada utiliza apenas as respostas previamente aceitas.
* **AC 03 — Bônus de rapidez:** Resposta correta recebida em até 10.000 ms de tempo ativo recebe 125% da pontuação base (ex.: 100 $\rightarrow$ 125).
* **AC 04 — Resposta no limite:** Resposta correta aceita exatamente aos 10.000 ms recebe o bônus de 25%; resposta aceita aos 10.001 ms recebe apenas a pontuação base.
* **AC 05 — Resposta duplicada:** Resposta subsequente com a mesma alternativa é confirmada de forma idempotente; tentativa de troca por outra alternativa é rejeitada com `ANSWER_ALREADY_SUBMITTED`.
* **AC 06 — Desconexão de participante:** Participante ausente por mais de 10s passa para `TEMPORARILY_DISCONNECTED`, não bloqueando o encerramento antecipado por "todos responderam" e mantendo sua pontuação preservada.
* **AC 07 — Reconexão de jogador:** Jogador que recarrega a página ou retorna do background com `reconnectToken` válido é restaurado com seu mesmo `playerId`, pontuação acumulada e estado de resposta atual.
* **AC 08 — Entrada tardia:** Participante admitido com rodada em andamento vê mensagem informativa e entra como elegível a partir da questão seguinte.
* **AC 09 — Pausa e retomada:** Ao pausar uma rodada com tempo restante $T$, os cronômetros congelam; ao retomar, uma contagem regressiva de 3 segundos antecede a reabertura com os mesmos $T$ segundos.
* **AC 10 — Desempate determinístico:** Empates em pontos são resolvidos sucessivamente por maior número de acertos, menor tempo acumulado em acertos e ordem estável de ingresso.
* **AC 11 — Segredo absoluto da resposta:** Durante `QUESTION_ACTIVE`, nenhum pacote enviado a jogadores ou ao telão contém `correctOptionId` ou `explanation`.
* **AC 12 — Pódio adaptativo e término:** Ao término da 10ª questão, o sistema exibe o pódio adequado para 1, 2 ou 3+ participantes, seguido do estado `FINISHED` sem botão de próxima pergunta.
* **AC 13 — Game loop contínuo sem intervenção:** Uma partida completa de 10 questões progride do início ao pódio sem que o apresentador precise clicar em botões de avanço manual entre perguntas.
* **AC 14 — Concorrência do host com respostas simultâneas:** Comandos do apresentador durante a questão ativa não são rejeitados caso alunos submetam respostas no mesmo milissegundo, graças à validação com `last_state_version`.
* **AC 15 — Limpeza limpa de sessão:** O botão "Voltar ao Início" na tela `FINISHED` desassocia a sala concluída, permitindo nova navegação sem retenção de cache.

---

## 14. Apêndice: Conteúdo Pedagógico das 10 Questões

| Nº | Mecânica | Enunciado Didático | Alternativas | Gabarito | Base |
|---|---|---|---|---|---|
| **1** | `region` | Na anatomia veterinária de grandes animais, qual região muscular está situada no aspecto superior do tronco, acompanhando a coluna vertebral? | A) Região ventral<br>B) Região dorsal<br>C) Região cranial<br>D) Região caudal | **B** | 100 |
| **2** | `identify` | Observe o esquema da musculatura ventral do abdômen de um equino. Qual músculo longo e par estende-se paralelamente à linha alba? | A) Reto do abdômen<br>B) Trapézio torácico<br>C) Grande dorsal<br>D) Peitoral profundo | **A** | 100 |
| **3** | `region` | Qual dos músculos a seguir pertence à musculatura dorsal, fixando-se na espinha da escápula e na fáscia toracolombar? | A) Reto abdominal<br>B) Peitoral superficial<br>C) Músculo trapézio<br>D) Oblíquo externo do abdômen | **C** | 100 |
| **4** | `function` | Qual é a principal função biomecânica dos músculos epaxiais dorsais em grandes ruminantes e equinos? | A) Flexão do membro pélvico<br>B) Sustentação e extensão da coluna vertebral<br>C) Contração das vísceras abdominais<br>D) Rotação livre da articulação coxo-femoral | **B** | 200 |
| **5** | `identify` | Na parede torácica ventral de bovinos e equinos, qual agrupamento muscular conecta o esterno ao membro torácico? | A) Músculo trapézio<br>B) Músculo grande dorsal<br>C) Músculos peitorais (superficial e profundo)<br>D) Músculo eretor da espinha | **C** | 100 |
| **6** | `region` | Em relação à parede corporal do boi e do cavalo, em qual plano anatômico o músculo oblíquo externo do abdômen está inserido? | A) Dorso torácico profundo<br>B) Região ventrolateral do abdômen<br>C) Cervical dorsal superior<br>D) Eminência sagital da nuca | **B** | 100 |
| **7** | `function` | Além de fixar a escápula ao tronco, qual movimento o músculo trapézio executa quando sua porção cervical é ativada? | A) Elevação e tração cranial da escápula<br>B) Depressão e abdução dos dígitos<br>C) Flexão da articulação femorotibiorrotuliana<br>D) Compressão dos órgãos pélvicos | **A** | 200 |
| **8** | `species` | Em equinos, a fáscia toracolombar e a musculatura glútea dorsal possuem particular relevância na locomoção. Qual espécie é comparada neste jogo? | A) Suíno e Canino<br>B) Bovino e Equino<br>C) Caprino e Felino<br>D) Ovino e Bubalino | **B** | 100 |
| **9** | `boolean` | Analise a afirmação: "Os músculos peitoral superficial e reto abdominal situam-se na face ventral do corpo do animal". Ela é verdadeira ou falsa? | A) Verdadeiro<br>B) Falso | **A** | 100 |
| **10** | `final` | **DESAFIO FINAL (300 pts):** Comparando a musculatura de sustentação em bovinos e equinos, por que a conformação dorsal e abdominal reflete a biomecânica de cada espécie? | A) Equinos priorizam flexibilidade torácica sem auxílio de fáscia elástica<br>B) Bovinos possuem grande peso visceral ruminal exigindo forte tônus abdominal, enquanto equinos apresentam musculatura adaptada à propulsão e galope<br>C) Ambas as espécies apresentam idêntica musculatura sem variação morfológica<br>D) O sistema musculoesquelético de grandes herbívoros não interfere na sustentação visceral | **B** | 300 |

---

## 15. Rastreabilidade e Matriz de Conformidade

| Objetivo / Requisito | Requisitos de Referência | Evidência de Validação |
|---|---|---|
| **Entrada e Acesso sem Cadastro** | FR 001 a FR 008, AC 01 | Teste E2E com Playwright (`tests/e2e/scenarios.spec.ts`) |
| **Game Loop Automático por Alarme** | FR 009 a FR 026, AC 01, AC 02, AC 12, AC 13 | Teste E2E de 10 questões completas (`tests/e2e/game-flow.spec.ts`) |
| **Temporização, Bônus e Pausa Estrita** | FR 011, FR 027, FR 028, AC 03, AC 04, AC 09 | Testes unitários (`scoring.test.ts`, `state-machine.test.ts`) e de integração (T09, T10) |
| **Presença Ativa e Expiração Autônoma** | FR 035 a FR 040, AC 06, AC 07 | Testes de integração (T05, T06, T07, T08) e carga com 12 asserções |
| **Início Condicionado (`connected >= 1`)** | FR 009, AC 01 | Testes unitários (`eligibility.test.ts`) e de integração (T01) |
| **Anti-Spoiler e Projeção Canônica** | FR 012, AC 11 | Testes unitários (`state-machine.test.ts`) e de integração (T11, T12) |
| **Concorrência Host vs. Respostas** | FR 027, AC 14 | Teste de integração com `last_state_version` |
| **Pódio Adaptativo e Término** | FR 031 a FR 034, AC 12, AC 15 | Testes de integração (T12, T16) e E2E completo |
| **Segurança do Host via Cookie Estrito** | FR 001, NFR 14 | Testes de integração (T01, T17) com cookie `HttpOnly` e sem query param fallback |
| **Descarte de Sessão / Nova Partida** | FR 034, AC 15 | E2E T25/T46: sala B recebe jogador, inicia e completa rodada real sem limpeza manual de storage |
| **Escalabilidade sob 50 Conexões** | NFR 01 a NFR 04 | `tests/load/websocket-load.ts`: ranking esperado versus real, unicidade de eventos/transições, convergência e latência medida na execução |
| **Acessibilidade e Usabilidade** | NFR 06 a NFR 09 | Auditoria visual, navegação por teclado e reduced-motion |

---

## 16. Status de Validação

Esta seção registra evidência disponível; não atribui aprovação em nome de pessoas ou equipes que não tenham assinado a revisão.

| Responsabilidade | Nome do Responsável | Data | Parecer / Status |
|---|---|---|---|
| **Engenharia de Software** | Execução automatizada registrada no `AUDIT_FIX_REPORT.md` | 19/09/2026 | Condicionada aos resultados efetivamente executados após a alteração final |
| **Hardware Android** | Responsável humano a designar | — | **PHYSICAL NOT EXECUTED** |
| **Hardware iPhone** | Responsável humano a designar | — | **PHYSICAL NOT EXECUTED** |
| **Conteúdo Acadêmico** | Professor/equipe responsável | — | **PENDENTE DE VALIDAÇÃO ACADÊMICA** |

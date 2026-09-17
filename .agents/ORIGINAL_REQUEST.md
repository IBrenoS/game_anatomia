# Original User Request

## 2026-09-17T04:29:33Z

Auditar, corrigir e validar ponta a ponta a implementação existente da Batalha Anatômica — Bovino × Equino no repositório local, eliminando todas as divergências técnicas, de realtime, de máquina de estados, pedagógicas e de experiência levantadas no checklist corretivo e no PRD.

Working directory: D:\game_anatomia
Integrity mode: development

## Requirements

### R1. P0 — Desbloquear o Produto e Estabilizar o Realtime
- **P0.1 Snapshot Imediato no Host**: Eliminar o carregamento infinito ("Aguardando estado do jogo...") garantindo que o host recém-conectado receba imediatamente uma projeção inicial válida (`SNAPSHOT`) com status `LOBBY`, PIN, QR code, contadores e controles.
- **P0.2 Ciclo de Vida e Reconexão de Jogador**: Preservar `playerId` e `reconnectToken` na sessão do jogador independentemente de desmontagem de componentes React. Suportar reconexão (`RESUME_SESSION`) com recuperação exata de estado em lobby, questão ativa (com prazo), pós-resposta e ranking.
- **P0.3 Protocolo de Versão e Eventos**: Validar sequenciamento estrito de `roomVersion` e descarte idempotente de `eventId` já processados, requisitando `REQUEST_SNAPSHOT` em caso de gaps.
- **P0.4 Hibernação e Identidade de WebSockets**: Assegurar que os vínculos de conexão (`playerId`, `role`, `connectionId`) sobrevivam à hibernação e recuperação do Durable Object sem depender de propriedades JS voláteis no objeto WebSocket. Atualizar presença e remover bloqueio de avanço após timeout.
- **P0.5 Máquina de Estados na 10ª Questão**: Garantir fluxo determinístico da última questão (`QUESTION_ACTIVE` → `QUESTION_REVEAL` → `FINAL_RANKING` → `PODIUM` → `FINISHED`) sem exceções de transição inválida ou tentativa de pergunta 11.
- **P0.6 Validação Autoritativa de Respostas (`SUBMIT_ANSWER`)**: Validar rigorosamente no servidor se a questão está ativa, se o jogador é elegível e ainda não respondeu, se a opção pertence à questão e se `receivedAt <= deadlineAt` e o jogo não está pausado.
- **P0.7 Pausa, Retomada e Janela de Bônus Ativo**: Preservar o tempo ativo transcorrido e o `remainingMs` durante pausas, impedindo que pausas consumam ou reiniciem artificialmente a janela de 10s do bônus de rapidez.

### R2. P1 — Experiência Funcional e Conteúdo Pedagógico
- **P1.1 Acesso ao Telão**: Disponibilizar ação explícita "Abrir Telão" no painel do apresentador apontando para `/screen/:pin`, com exibição completa no telão (PIN, QR, participantes em tempo real).
- **P1.2 Contagem Regressiva Sincronizada**: Exibir contagem visual e textual em português ("Prepare-se", 3, 2, 1) sincronizada entre participante, host e telão, eliminando textos residuais em inglês.
- **P1.3 Feedback Individual e Coletivo**: Apresentar no telão a distribuição das respostas e alternativa correta; no celular, exibir acerto/erro, alternativa correta, pontos obtidos, bônus de rapidez e pontuação acumulada.
- **P1.4 Bloqueio e Confirmação de Resposta**: Bloquear imediatamente alternativas após resposta, exibir confirmação visual sem revelar o gabarito antecipadamente e manter estado após reconexão.
- **P1.5 Tipagem das 6 Mecânicas Reais**: Revisar as 10 questões do arquivo de conteúdo para refletir suas mecânicas genuínas (`identify`, `region`, `species`, `function`, `boolean`, `final`), com a 10ª questão configurada como desafio final comparativo.
- **P1.6 Higienização dos Assets Visuais**: Auditar todas as imagens das questões e remover qualquer texto, legenda ou rótulo que entregue o gabarito ou identifique a estrutura previamente.
- **P1.7 Controle de Áudio**: Implementar feedback sonoro real e acessível para o botão de áudio ou ocultar o botão enquanto não houver funcionalidade ativa.
- **P1.8 Segurança da Sessão do Apresentador**: Implementar proteção para o token do host compatível com a especificação (HttpOnly/SameSite ou isolamento seguro local) e garantir que o PIN não permita controle administrativo.
- **P1.9 Rate Limiting Local**: Aplicar proteção básica contra abuso de criação de salas e payloads sem recorrer a bancos externos.

### R3. P2 — Atmosfera de Arena e Polimento Visual
- **P2.1 Lobby Vivo**: Microanimações discretas para entrada de competidores, indicador de conexão em tempo real e respeito estrito a `prefers-reduced-motion`.
- **P2.2 Hierarquia Visual das Questões**: Priorizar visualmente o progresso (n/10), enunciado, imagem anatômica, timer e botões de toque grandes no mobile.
- **P2.3 Ranking Competitivo**: Enfatizar a competição saudável destacando posição individual, proximidade de pontuação e mudanças de posição.
- **P2.4 Pódio Final**: Cerimônia de premiação com revelação sequencial (3º, 2º, 1º), troféu, pontuações, efeitos moderados de celebração e fallback para movimento reduzido.

### R4. P3 — Suíte de Testes e Validação Completa
- **P3.1 Testes Unitários de Domínio**: Cobertura exaustiva de pontuação nos limites (9999ms, 10000ms, 10001ms), desempates, transições de estado, décima pergunta e elegibilidade.
- **P3.2 Testes de Integração Worker + Durable Object**: Testes automatizados cobrindo WebSocket upgrade, snapshot inicial, presenças, disconnect/resume, hibernação, alarmes e ciclo completo de sala.
- **P3.3 Testes E2E (Playwright)**: Fluxo completo com host abrindo sala, participantes conectando, telão aberto, execução das 10 perguntas até o pódio, além de cenários de reconexão e nickname duplicado.
- **P3.4 Teste de Carga Real**: Cenário de carga com 1 host, 2 telas e 50 conexões de jogadores via WebSocket enviando respostas concentradas em ~2s, sem perdas de mensagens ou corrupção de estado.
- **P3.5 Typecheck & Build Monorepo**: Verificação de tipos (`pnpm typecheck` / `tsc --noEmit`) em todos os pacotes e compilação do Worker e aplicação web sem erros.

### R5. P4 — Relatório Técnico de Auditoria e Correções
- Gerar o documento `AUDIT_FIX_REPORT.md` contendo causas raízes identificadas, mapeamento dos requisitos atendidos, comandos e saídas de testes, métricas do teste de carga e limitações honestamente reportadas.

## Acceptance Criteria

### Realtime & Máquina de Estados
- [ ] Conexão do host em `/host/:pin` recebe `SNAPSHOT` imediato com estado `LOBBY` e renderiza interface sem carregamento infinito.
- [ ] Jogador reconecta com sucesso após recarregamento de página ou queda de rede preservando identidade, pontuação e resposta anterior.
- [ ] Partida de 10 perguntas transita sem exceção de `QUESTION_REVEAL` para `FINAL_RANKING` e em seguida para `PODIUM` e `FINISHED`.
- [ ] Respostas fora do prazo, duplicadas ou com jogo pausado são autoritativamente rejeitadas pelo servidor.
- [ ] Pausa preserva o tempo ativo transcorrido e não afeta a janela de bônus de agilidade na retomada.

### Conteúdo, UI & Integração
- [ ] Nenhuma imagem de questão exibe rótulo que entregue o gabarito anatômico.
- [ ] As 10 questões cobrem adequadamente as 6 mecânicas (`identify`, `region`, `species`, `function`, `boolean`, `final`).
- [ ] Telão (`/screen/:pin`) exibe estado do jogo e distribuição de respostas sincronizados em tempo real.
- [ ] Contagem regressiva (3-2-1) é perceptível e sincronizada em português em todos os clientes.

### Verificação & Qualidade
- [ ] Suíte de testes unitários (`pnpm test`) executada e 100% verde.
- [ ] Testes de integração de Durable Object e WebSocket passando.
- [ ] Testes E2E (Playwright) executam o ciclo completo da partida do lobby ao pódio.
- [ ] Teste de carga com 50 conexões WebSocket simultâneas executado com sucesso e latências registradas.
- [ ] Typecheck global e build (`pnpm build`) executados com sucesso com código de saída 0.
- [ ] Arquivo `AUDIT_FIX_REPORT.md` criado na raiz com detalhamento completo das causas raízes e evidências.

## 2026-09-17T06:26:29Z

O servidor foi reiniciado. Por favor, retome a execução do projeto a partir do estado atual registrado em .agents/orchestrator_1/progress.md. Verifique o status dos workers e continue com Milestone 3, a infraestrutura de testes, os testes de integração e E2E, o teste de carga com 50 WebSockets e a geração do AUDIT_FIX_REPORT.md.


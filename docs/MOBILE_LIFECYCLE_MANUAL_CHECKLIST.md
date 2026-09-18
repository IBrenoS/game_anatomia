# Checklist Manual Obrigatório — Lifecycle Mobile (Android & iOS)
**Batalha Anatômica — Validação de Resiliência Background/Foreground (T5 / P0.1 / P0.2)**

> **Objetivo:** Estabelecer o protocolo de homologação manual em dispositivos físicos reais (Chrome no Android e Safari no iOS) para validar a convergência automática de estado sem necessidade de recarregamento manual (F5 / pull-to-refresh), complementando os testes automatizados E2E de browser engine (`android-chrome` e `ios-safari`).

---

## 1. Diferenças Críticas de Lifecycle por Sistema Operacional

| Característica de Lifecycle | Google Chrome no Android (Blink) | Apple Safari no iOS (WebKit) | Impacto no Batalha Anatômica | Mitigação Arquitetural |
| :--- | :--- | :--- | :--- | :--- |
| **Suspensão em Segundo Plano** | Timers (`setTimeout`/`setInterval`) sofrem throttling progressivo (máximo 1 execução por minuto após 5 minutos). O WebSocket permanece aberto se a bateria e a rede permitirem. | **Congelamento total imediato (Ice Freeze):** JS e timers são congelados dentro de 5 a 15 segundos após trocar de app ou bloquear a tela. | O cliente não recebe broadcasts incrementais enquanto suspenso. | Ao retornar, `handleForegroundSync()` verifica o estado e dispara imediatamente `REQUEST_SNAPSHOT` ou `RESUME_SESSION`. |
| **Encerramento da Conexão TCP** | O Android pode manter o socket aberto até timeout de keepalive, a menos que o Doze Mode corte os dados em segundo plano. | O iOS fecha abruptamente conexões celulares/Wi-Fi após suspensão profunda sem enviar `CLOSE` frame ou TCP FIN limpo (erro 1006). | O socket pode estar em estado "zumbi" (half-open) no momento do desbloqueio. | `visibilitychange`, `pageshow` e `focus` disparam `handleForegroundSync()`. Se fechado, reconecta imediatamente; se aberto, envia `REQUEST_SNAPSHOT` provocando falha/resposta imediata. |
| **BFCache (Back-Forward Cache)** | Suportado, mas menos agressivo em páginas dinâmicas com WebSocket ativo. | **Altamente agressivo:** Salva o snapshot da página na memória do sistema e restaura no `pageshow` (`persisted === true`). | O estado visual pode apresentar elementos defasados ao restaurar do cache. | Ouvinte `window.addEventListener('pageshow', ...)` invoca `handleForegroundSync()`. |
| **Descarte de Aba por Memória (LMK)** | Sob pressão de memória (ex: abrir a câmera ou outro app pesado), o *Low Memory Killer* do Android descarta a aba. Ao reabrir, o Chrome recarrega a URL. | O WebKit descarta o processo web e recarrega a página ao focar. | O estado em memória (`gameStore`) é reinicializado. | O `reconnectToken` é persistido no `localStorage` (`batalha_session_{pin}`). Na inicialização de `/play/:pin`, o cliente envia `RESUME_SESSION` e restaura o jogador sem voltar à tela de entrada. |
| **Bloqueio de Tela / Power Button** | Dispara `visibilitychange` para `hidden` e evento `blur`. Ao desbloquear, dispara `visibilitychange` para `visible` e `focus`. | Dispara `visibilitychange` para `hidden`, `pagehide` e `blur`. Ao desbloquear, dispara `visibilitychange` para `visible`, `pageshow` e `focus`. | Gatilhos nativos cobrem 100% dos eventos em ambos os SOs. | Registro unificado no `WebSocketManager`: `visibilitychange`, `pageshow`, `focus`, `online`, `offline`. |

---

## 2. Dispositivos e Ambientes de Teste Homologados

Antes do aceite final, os testes devem ser executados em pelo menos:
1. **Android:** Smartphone com Android 11+ e Google Chrome (versão estável mais recente). Ex: Samsung Galaxy (OneUI) ou Google Pixel.
2. **iOS:** iPhone com iOS 16+ e Safari nativo. Ex: iPhone 12 ou superior.

---

## 3. Protocolo de Testes — Cenários Obrigatórios

### Cenário 1: Transição LOBBY → QUESTION_ACTIVE
- **Passo 1.1:** O jogador entra na sala pelo celular (`/join/:pin`), digita apelido e confirma. O celular exibe o lobby de espera.
- **Passo 1.2:** No celular, minimizar o navegador (ir para a tela inicial / Home) ou bloquear a tela com o botão físico de energia. Aguardar 5 segundos.
- **Passo 1.3:** No computador (Host), clicar em **"Iniciar Partida"**. Aguardar a contagem regressiva (3s) e o início oficial da Questão 1 (com alternativas na tela do apresentador).
- **Passo 1.4:** No celular, reabrir o navegador / desbloquear a tela. **NÃO RECARREGAR A PÁGINA (sem F5 / sem puxar para atualizar).**
- **Critério de Aceite:**
  - [ ] O cliente não exibe tela branca ou erro de conexão permanente.
  - [ ] O cliente converge automaticamente para a **Questão 1 de 10**.
  - [ ] As 4 alternativas (A, B, C, D) aparecem ativas e clicáveis.
  - [ ] O cronômetro circular exibe o tempo restante correto sincronizado com o servidor.
  - [ ] O jogador consegue tocar em uma alternativa e recebe a confirmação *"Resposta registrada"*.

---

### Cenário 2: Transição QUESTION_ACTIVE → QUESTION_REVEAL
- **Passo 2.1:** Com a Questão ativa e o cronômetro correndo, o jogador minimiza o navegador ou bloqueia a tela do celular.
  - *Variante A:* Jogador já respondeu a questão antes de minimizar.
  - *Variante B:* Jogador ainda NÃO respondeu a questão antes de minimizar.
- **Passo 2.2:** No Host, aguardar o tempo expirar ou clicar em **"Encerrar Questão"** → Confirmar. O Host entra na tela de revelação de resposta.
- **Passo 2.3:** No celular, retornar ao navegador (foreground). **SEM REFRESH MANUAL.**
- **Critério de Aceite:**
  - [ ] O cliente converge automaticamente para a tela de **Revelação / Gabarito**.
  - [ ] Se o jogador respondeu (*Variante A*):
    - Exibe card de *"Você Acertou!"* ou *"Resposta Incorreta"*.
    - Pontuação da rodada calculada e tempo de resposta exibido.
  - [ ] Se o jogador não respondeu (*Variante B*):
    - Exibe card de *"Tempo Esgotado! Sem resposta nesta rodada"*.
    - Exibe o Gabarito Oficial com a alternativa correta destacada.

---

### Cenário 3: Transição QUESTION_REVEAL → ROUND_RANKING
- **Passo 3.1:** Com o celular na tela de revelação, minimizar o navegador ou bloquear a tela. Aguardar 5 segundos.
- **Passo 3.2:** No Host, clicar em **"Ver Classificação"**. O Host transiciona para a classificação da rodada.
- **Passo 3.3:** No celular, voltar para o primeiro plano (foreground). **SEM REFRESH MANUAL.**
- **Critério de Aceite:**
  - [ ] O cliente converge automaticamente para a tela de **Classificação da Rodada**.
  - [ ] A posição oficial do jogador (ex: `#1`, `#2`) é exibida em destaque com fonte legível.
  - [ ] A pontuação total acumulada e o indicador de evolução (subiu, caiu ou manteve) são exibidos corretamente.

---

### Cenário 4: Transição ROUND_RANKING → Próxima Pergunta (QUESTION_ACTIVE)
- **Passo 4.1:** Com o celular na tela de classificação, minimizar o navegador ou bloquear a tela.
- **Passo 4.2:** No Host, clicar em **"Próxima Pergunta"**. O Host transiciona para a Questão 2.
- **Passo 4.3:** No celular, retornar ao primeiro plano (foreground). **SEM REFRESH MANUAL.**
- **Critério de Aceite:**
  - [ ] O cliente converge automaticamente para a **Questão 2 de 10**.
  - [ ] **Limpeza de Estado Residual:** As alternativas da Questão 2 estão limpas e disponíveis para toque (NÃO exibe a mensagem de *"Resposta registrada"* herdada da Questão 1).
  - [ ] O jogador consegue votar na Questão 2 normalmente.

---

### Cenário 5: Suspensão Profunda com Queda de Conexão / Modo Avião (RESUME_SESSION)
- **Passo 5.1:** Durante o jogo (ex: Questão 3 ativa), o jogador responde uma alternativa.
- **Passo 5.2:** O jogador ativa o **Modo Avião** no celular e bloqueia a tela por 15 segundos.
- **Passo 5.3:** O Host encerra a questão e avança para a classificação.
- **Passo 5.4:** O jogador desativa o Modo Avião, aguarda a rede restabelecer e desbloqueia a tela.
- **Critério de Aceite:**
  - [ ] O banner ou overlay de reconexão (*"Reconectando..."*) aparece brevemente.
  - [ ] O cliente executa automaticamente `connect()` e emite `RESUME_SESSION` com o `reconnectToken`.
  - [ ] O servidor aceita a sessão com `SESSION_ACCEPTED` e envia o `SNAPSHOT` atualizado.
  - [ ] O jogador é restaurado com a pontuação preservada e posicionado na classificação atual da partida sem intervenção do usuário.

---

### Cenário 6: Encerramento de App / Reabertura de Aba Descartada
- **Passo 6.1:** Em qualquer etapa da partida (Lobby ou Questão), forçar o fechamento do navegador Chrome/Safari através do gerenciador de multitarefas do SO (swipe up para fechar app).
- **Passo 6.2:** Reabrir o navegador e acessar a URL da partida `/play/:pin` ou restaurar a aba fechada.
- **Critério de Aceite:**
  - [ ] O app recupera a sessão via `localStorage.getItem('batalha_session_' + pin)`.
  - [ ] O jogador reconecta instantaneamente à sala com seu apelido original sem ser redirecionado para a tela de apelido duplicado.

---

## 4. Tabela de Homologação Final para Assinatura

| ID Teste | Dispositivo / SO | Navegador | Data | Responsável | Resultado | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **M-01** | Google Pixel / Galaxy (Android 13+) | Chrome 120+ | | | [ ] APROVADO / [ ] REPROVADO | |
| **M-02** | iPhone 13/14/15 (iOS 17+) | Safari Nativo | | | [ ] APROVADO / [ ] REPROVADO | |
| **M-03** | iPhone (iOS 16+) | Safari (BFCache test) | | | [ ] APROVADO / [ ] REPROVADO | |
| **M-04** | Android (Xiaomi/Samsung) | Chrome (Modo Economia) | | | [ ] APROVADO / [ ] REPROVADO | |

---
**Nota de Engenharia:** Qualquer falha que exija o usuário realizar `F5` ou recarregar manualmente a aba desqualifica a aprovação do item.

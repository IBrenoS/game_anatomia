import { test, expect } from '@playwright/test';

/**
 * Batalha Anatômica — Edge Cases and Operational Scenarios E2E Suite (P3.3)
 * Covering:
 * - Scenario 1: PIN inválido / sala inexistente
 * - Scenario 2: Entrada bloqueada (LOCK_ENTRIES e UNLOCK_ENTRIES)
 * - Scenario 3: Pausa e retomada no painel do apresentador
 * - Scenario 4: Remoção de participante pelo apresentador
 * - Scenario 5: Reload de página durante questão ativa antes e após responder
 * - Scenario 6: Encerramento antecipado da questão e da partida pelo apresentador
 */

test.describe('Batalha Anatômica — Operational Scenarios & Edge Cases', () => {

  test('Scenario 1: PIN inválido exibe mensagem de sala não encontrada', async ({ page }) => {
    // Navigate directly to non-existent PIN
    await page.goto('/join/000000');

    await expect(page.getByText(/sala não encontrada/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /digitar outro pin/i })).toBeVisible();
  });

  test('Scenario 1b: Digitação de PIN na home formata com espaço e navega com sucesso para a sala', async ({ page }) => {
    await page.goto('/?step=join');
    const pinInput = page.getByLabel(/pin da sala/i);
    await expect(pinInput).toBeVisible();
    await pinInput.fill('346779');
    await expect(pinInput).toHaveValue('346 779');
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/join\/346779/);
  });

  test('Scenario 2: Entrada bloqueada impede novos participantes até ser liberada', async ({ browser }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');
    await hostPage.getByRole('button', { name: /só vou apresentar/i }).click();
    await hostPage.getByRole('button', { name: /criar partida/i }).click();
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });

    const pinMatch = hostPage.url().match(/\/host\/(\d{6})/);
    expect(pinMatch).not.toBeNull();
    const pin = pinMatch![1];

    // 2. Host locks entries
    const lockBtn = hostPage.getByRole('button', { name: /bloquear/i });
    await expect(lockBtn).toBeVisible({ timeout: 10000 });
    await lockBtn.click();
    // Verify button text changes to Liberar
    await expect(hostPage.getByRole('button', { name: /liberar/i })).toBeVisible({ timeout: 5000 });

    // 3. Player attempts to join locked room
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await playerPage.goto(`/join/${pin}`);

    const nicknameInput = playerPage.getByLabel(/seu apelido/i);
    await expect(nicknameInput).toBeVisible({ timeout: 10000 });
    await nicknameInput.fill('BlockedPlayer');
    await playerPage.getByRole('button', { name: /entrar na arena/i }).click();

    // Verify rejection error
    await expect(playerPage.getByText(/entradas estão bloqueadas/i)).toBeVisible({ timeout: 5000 });

    // 4. Host unlocks entries
    const unlockBtn = hostPage.getByRole('button', { name: /liberar/i });
    await unlockBtn.click();
    await expect(hostPage.getByRole('button', { name: /bloquear/i })).toBeVisible({ timeout: 5000 });

    // 5. Player retries and succeeds
    await playerPage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(playerPage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });

    await hostContext.close();
    await playerContext.close();
  });

  test('Scenario 3: Pausa e retomada no painel do apresentador', async ({ browser }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');
    await hostPage.getByRole('button', { name: /só vou apresentar/i }).click();
    await hostPage.getByRole('button', { name: /criar partida/i }).click();
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });
    const pin = hostPage.url().match(/\/host\/(\d{6})/)![1];

    // 2. Player joins
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await playerPage.goto(`/join/${pin}`);
    await playerPage.getByLabel(/seu apelido/i).fill('Pauser');
    await playerPage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(playerPage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });

    // 3. Host starts game -> Countdown -> Question 1
    await hostPage.getByRole('button', { name: /iniciar partida/i }).first().click();
    await expect(playerPage.getByText(/questão 1 de 15/i)).toBeVisible({ timeout: 12000 });

    const screenContext = await browser.newContext();
    const screenPage = await screenContext.newPage();
    await screenPage.goto(`/screen/${pin}`);
    await expect(screenPage.getByText(/questão 1 de 15/i)).toBeVisible({ timeout: 10000 });

    // 4. Host pauses round
    const pauseBtn = hostPage.getByRole('button', { name: /pausar rodada/i });
    await expect(pauseBtn).toBeVisible({ timeout: 5000 });
    await pauseBtn.click();

    // Host should now see "Retomar Rodada"
    const resumeBtn = hostPage.getByRole('button', { name: /retomar rodada/i });
    await expect(resumeBtn).toBeVisible({ timeout: 5000 });

    // T34/T35: pause is mechanical in all frontends, not only rejected server-side.
    await expect(playerPage.getByRole('status').filter({ hasText: /rodada pausada/i })).toBeVisible();
    const answerButtons = playerPage.getByRole('button', { name: /alternativa/i });
    await expect(answerButtons.first()).toBeDisabled();
    await expect(hostPage.getByRole('status').filter({ hasText: /cronômetro congelado/i })).toBeVisible();
    await expect(screenPage.getByRole('status').filter({ hasText: /cronômetro congelado/i })).toBeVisible();
    const frozenTimer = await playerPage.getByLabel(/tempo restante/i).textContent();
    await playerPage.waitForTimeout(1200);
    await expect(playerPage.getByLabel(/tempo restante/i)).toHaveText(frozenTimer ?? '');

    // 5. Host resumes round
    await resumeBtn.click();

    // Countdown triggers, then question returns to active
    await expect(playerPage.getByText(/questão 1 de 15/i)).toBeVisible({ timeout: 10000 });

    await hostContext.close();
    await playerContext.close();
    await screenContext.close();
  });

  test('Scenario 4: Remoção de participante pelo apresentador', async ({ browser }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');
    await hostPage.getByRole('button', { name: /só vou apresentar/i }).click();
    await hostPage.getByRole('button', { name: /criar partida/i }).click();
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });
    const pin = hostPage.url().match(/\/host\/(\d{6})/)![1];

    // 2. Player 1 joins
    const p1Context = await browser.newContext();
    const p1Page = await p1Context.newPage();
    await p1Page.goto(`/join/${pin}`);
    await p1Page.getByLabel(/seu apelido/i).fill('GoodPlayer');
    await p1Page.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(p1Page).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });

    // 3. Player 2 joins
    const p2Context = await browser.newContext();
    const p2Page = await p2Context.newPage();
    await p2Page.goto(`/join/${pin}`);
    await p2Page.getByLabel(/seu apelido/i).fill('BadPlayer');
    await p2Page.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(p2Page).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });

    // Verify both appear in host list
    await expect(hostPage.getByText('GoodPlayer')).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByText('BadPlayer')).toBeVisible({ timeout: 5000 });

    // 4. Host removes BadPlayer
    const removeBtn = hostPage.getByRole('button', { name: /remover participante badplayer/i });
    await expect(removeBtn).toBeVisible({ timeout: 5000 });
    await removeBtn.click();

    // Confirm dialog
    const confirmRemoveBtn = hostPage.getByRole('button', { name: /sim, remover/i });
    await expect(confirmRemoveBtn).toBeVisible({ timeout: 5000 });
    await confirmRemoveBtn.click();

    // Verify BadPlayer is no longer in host list, but GoodPlayer remains
    await expect(hostPage.getByText('BadPlayer')).not.toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByText('GoodPlayer')).toBeVisible();

    await hostContext.close();
    await p1Context.close();
    await p2Context.close();
  });

  test('T39/T40: reload/foreground durante questão restaura resposta do jogador e progresso/distribuição do host', async ({ browser }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');
    await hostPage.getByRole('button', { name: /só vou apresentar/i }).click();
    await hostPage.getByRole('button', { name: /criar partida/i }).click();
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });
    const pin = hostPage.url().match(/\/host\/(\d{6})/)![1];

    // Connect another player so room doesn't auto-end when Alice answers
    const companionContext = await browser.newContext();
    const companionPage = await companionContext.newPage();
    await companionPage.goto(`/join/${pin}`);
    await companionPage.getByLabel(/seu apelido/i).fill('Companion');
    await companionPage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(companionPage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });

    // 2. Alice joins
    const aliceContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    await alicePage.goto(`/join/${pin}`);
    await alicePage.getByLabel(/seu apelido/i).fill('AliceReload');
    await alicePage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(alicePage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });

    // 3. Start game -> Question 1
    await hostPage.getByRole('button', { name: /iniciar partida/i }).first().click();
    await expect(alicePage.getByText(/questão 1 de 15/i)).toBeVisible({ timeout: 12000 });

    // 4. Reload BEFORE answering -> question still visible, options can still be clicked
    await alicePage.reload();
    await expect(alicePage.getByText(/questão 1 de 15/i)).toBeVisible({ timeout: 10000 });
    const optA = alicePage.getByRole('button', { name: /alternativa a/i }).first();
    await expect(optA).toBeVisible({ timeout: 5000 });

    // 5. Submit answer -> answer registered
    await optA.click();
    await expect(alicePage.getByText(/resposta registrada|resposta incorreta|você acertou/i)).toBeVisible({ timeout: 5000 });

    // Host projection is authoritative after refresh and foreground sync.
    await expect(hostPage.getByText(/1 \/ 2 jogadores ativos responderam/i)).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByText('1 voto')).toBeVisible();
    await hostPage.reload();
    await expect(hostPage.getByText(/1 \/ 2 jogadores ativos responderam/i)).toBeVisible({ timeout: 10000 });
    await expect(hostPage.getByText('1 voto')).toBeVisible();
    await hostPage.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(hostPage.getByText(/1 \/ 2 jogadores ativos responderam/i)).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByText('1 voto')).toBeVisible();

    // 6. Reload AFTER answering -> should preserve answer state and NOT allow second answer
    await alicePage.reload();
    await expect(alicePage.getByText(/resposta registrada|resposta incorreta|você acertou/i)).toBeVisible({ timeout: 10000 });

    await hostContext.close();
    await companionContext.close();
    await aliceContext.close();
  });

  test('Scenario 6: Encerramento antecipado de questão pelo apresentador', async ({ browser }) => {
    // 1. Host creates room and starts game with 1 player
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');
    await hostPage.getByRole('button', { name: /só vou apresentar/i }).click();
    await hostPage.getByRole('button', { name: /criar partida/i }).click();
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });
    const pin = hostPage.url().match(/\/host\/(\d{6})/)![1];

    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await playerPage.goto(`/join/${pin}`);
    await playerPage.getByLabel(/seu apelido/i).fill('EarlyEnder');
    await playerPage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(playerPage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });

    await hostPage.getByRole('button', { name: /iniciar partida/i }).first().click();
    await expect(playerPage.getByText(/questão 1 de 15/i)).toBeVisible({ timeout: 12000 });

    // 2. Host ends question prematurely
    const endQBtn = hostPage.getByRole('button', { name: /encerrar questão/i });
    await expect(endQBtn).toBeVisible({ timeout: 5000 });
    await endQBtn.click();

    // Confirm dialog
    const confirmBtn = hostPage.getByRole('button', { name: /sim, encerrar/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // Should transition to reveal
    await expect(hostPage.getByText(/gabarito da rodada/i)).toBeVisible({ timeout: 8000 });
    await expect(hostPage.getByText(/avanço automático/i)).toBeVisible({ timeout: 8000 });

    await hostContext.close();
    await playerContext.close();
  });

  test('Scenario 7 (T02): 4 jogadores entram sequencialmente e aparecem em tempo real no host sem refresh', async ({ browser }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');
    await hostPage.getByRole('button', { name: /só vou apresentar/i }).click();
    await hostPage.getByRole('button', { name: /criar partida/i }).click();
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });
    const pin = hostPage.url().match(/\/host\/(\d{6})/)![1];

    const players = ['Ana', 'Beto', 'Caio', 'Duda'];
    const playerContexts: any[] = [];

    // 2. Each player joins sequentially and host must see them in real time WITHOUT refresh
    for (let i = 0; i < players.length; i++) {
      const name = players[i];
      const count = i + 1;

      const pContext = await browser.newContext();
      playerContexts.push(pContext);
      const pPage = await pContext.newPage();
      await pPage.goto(`/join/${pin}`);
      await pPage.getByLabel(/seu apelido/i).fill(name);
      await pPage.getByRole('button', { name: /entrar na arena/i }).click();
      await expect(pPage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });
      await expect(pPage.getByText(name).first()).toBeVisible({ timeout: 5000 });

      // Host must reflect new participant and count immediately WITHOUT page reload
      await expect(hostPage.getByText(name, { exact: true })).toBeVisible({ timeout: 8000 });
      await expect(hostPage.getByText(`Participantes (${count}/${count} conectados)`)).toBeVisible({ timeout: 8000 });
    }

    // Verify all 4 players are visible in host roster
    for (const name of players) {
      await expect(hostPage.getByText(name, { exact: true })).toBeVisible();
    }

    // Verify Start button indicates ready with 4 connected players
    const startBtn = hostPage.getByRole('button', { name: /iniciar partida/i }).first();
    await expect(startBtn).toBeEnabled();

    // Clean up
    await hostContext.close();
    for (const ctx of playerContexts) {
      await ctx.close();
    }
  });

  test('T25/T46: Partida A FINISHED -> Nova Partida -> sala B inicia e completa uma rodada real sem limpar cache/storage', async ({ browser }) => {
    // 1. Host creates Room A
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');
    await hostPage.getByRole('button', { name: /só vou apresentar/i }).click();
    await hostPage.getByRole('button', { name: /criar partida/i }).click();
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });
    const pinA = hostPage.url().match(/\/host\/(\d{6})/)![1];

    // Player joins Room A
    const p1Context = await browser.newContext();
    const p1Page = await p1Context.newPage();
    await p1Page.goto(`/join/${pinA}`);
    await p1Page.getByLabel(/seu apelido/i).fill('PlayerA');
    await p1Page.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(p1Page).toHaveURL(new RegExp(`/play/${pinA}`), { timeout: 10000 });
    await expect(hostPage.getByText('PlayerA')).toBeVisible({ timeout: 5000 });

    // Host starts and ends game to FINISHED
    await hostPage.getByRole('button', { name: /iniciar partida/i }).first().click();

    // Host can end an active match without pausing or completing all questions.
    const endGameBtn = hostPage.getByRole('button', { name: /finalizar partida/i });
    await expect(endGameBtn).toBeVisible({ timeout: 12000 });
    await endGameBtn.click();
    const confirmEndBtn = hostPage.getByRole('button', { name: /finalizar agora/i });
    await expect(confirmEndBtn).toBeVisible({ timeout: 5000 });
    await confirmEndBtn.click();

    // Host displays FINISHED
    await expect(hostPage.getByText(/partida encerrada/i)).toBeVisible({ timeout: 10000 });
    const novaPartidaBtn = hostPage.getByRole('button', { name: /nova partida/i });
    await expect(novaPartidaBtn).toBeVisible();

    // 2. Host clicks "Nova Partida" -> navigates to /host cleanly
    await novaPartidaBtn.click();
    await expect(hostPage).toHaveURL('/host', { timeout: 5000 });

    // 3. Host launches Room B
    await hostPage.getByRole('button', { name: /só vou apresentar/i }).click();
    await hostPage.getByRole('button', { name: /criar partida/i }).click();
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });
    const pinB = hostPage.url().match(/\/host\/(\d{6})/)![1];
    expect(pinB).not.toBe(pinA);

    // Host sees Room B lobby with PIN B
    await expect(hostPage.getByText(pinB, { exact: true })).toBeVisible();

    // 4. Player joins Room B
    const p2Context = await browser.newContext();
    const p2Page = await p2Context.newPage();
    await p2Page.goto(`/join/${pinB}`);
    await p2Page.getByLabel(/seu apelido/i).fill('PlayerB');
    await p2Page.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(p2Page).toHaveURL(new RegExp(`/play/${pinB}`), { timeout: 10000 });

    // Host sees PlayerB in real-time in Room B lobby without refresh
    await expect(hostPage.getByText('PlayerB')).toBeVisible({ timeout: 8000 });

    // 5. Room B starts and completes one real question through the automatic loop.
    await hostPage.getByRole('button', { name: /iniciar partida/i }).first().click();
    await expect(p2Page.getByText(/questão 1 de 15/i)).toBeVisible({ timeout: 12000 });
    await p2Page.getByRole('button', { name: /alternativa a:/i }).click();
    await expect(p2Page.getByText(/resposta registrada|você acertou|resposta incorreta/i)).toBeVisible({ timeout: 5000 });
    await expect(p2Page.getByText(/você acertou|resposta incorreta/i)).toBeVisible({ timeout: 10000 });
    await expect(hostPage.getByText(/classificação da rodada/i)).toBeVisible({ timeout: 10000 });

    await hostContext.close();
    await p1Context.close();
    await p2Context.close();
  });
});

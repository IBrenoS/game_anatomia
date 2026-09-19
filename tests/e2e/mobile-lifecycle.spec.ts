import { test, expect, type Page } from '@playwright/test';

/**
 * Batalha Anatômica — Mobile Background/Foreground Lifecycle Suite (T5)
 *
 * Validates the complete lifecycle scenario across mobile browser engines:
 * - Android Chrome (Chromium mobile viewport + touch + user agent)
 * - iOS Safari (WebKit mobile viewport + touch + user agent)
 *
 * Scenario:
 *   jogador entra no lobby
 *   ↓
 *   navegador vai para background
 *   ↓
 *   host altera o estado da partida
 *   ↓
 *   navegador volta para foreground
 *   ↓
 *   sem refresh manual (sem page.reload)
 *   ↓
 *   cliente verifica conexão
 *   ↓
 *   RESUME_SESSION / REQUEST_SNAPSHOT conforme necessário
 *   ↓
 *   jogador converge automaticamente para o estado oficial atual
 *
 * Repeated across all 4 mandatory states:
 *   1. LOBBY
 *   2. QUESTION_ACTIVE
 *   3. QUESTION_REVEAL
 *   4. ROUND_RANKING
 */

/**
 * Simulates mobile browser moving to background (tab switch, app minimize, screen lock)
 * by updating document visibilityState and firing standard mobile browser lifecycle events.
 */
async function simulateBackground(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('blur'));
  });
}

/**
 * Simulates mobile browser returning to foreground (tab resume, app reopen, unlock)
 * by restoring document visibilityState and firing standard foreground events.
 */
async function simulateForeground(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new Event('focus'));
  });
}

/**
 * Simulates background state accompanied by OS network suspend or socket termination.
 */
async function simulateBackgroundWithSocketDrop(page: Page): Promise<void> {
  await simulateBackground(page);
  await page.evaluate(() => {
    const mgr = (window as any).__wsManager;
    if (mgr && typeof mgr.closeSocketForTest === 'function') {
      mgr.closeSocketForTest();
    }
  });
}

test.describe('T5 — Mobile Background/Foreground Lifecycle Suite', () => {

  test('Scenario 1: Seamless convergence across LOBBY, QUESTION_ACTIVE, QUESTION_REVEAL, ROUND_RANKING via REQUEST_SNAPSHOT (socket kept open)', async ({
    browser,
  }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');
    await hostPage.getByRole('button', { name: /iniciar batalha/i }).click();
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });
    const pin = hostPage.url().match(/\/host\/(\d{6})/)![1];

    // 2. Companion player joins so the room doesn't auto-advance when 1 player answers
    const companionContext = await browser.newContext();
    const companionPage = await companionContext.newPage();
    await companionPage.goto(`/join/${pin}`);
    await companionPage.getByLabel(/seu apelido/i).fill('Companion');
    await companionPage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(companionPage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 15000 });

    // 3. Mobile Player joins
    const mobileContext = await browser.newContext();
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`/join/${pin}`);
    await mobilePage.getByLabel(/seu apelido/i).fill('MobileUser');
    await mobilePage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(mobilePage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 15000 });
    await expect(mobilePage.getByText('MobileUser').first()).toBeVisible({ timeout: 15000 });

    // Both players visible on host lobby
    await expect(hostPage.getByText('MobileUser')).toBeVisible({ timeout: 5000 });
    await expect(hostPage.getByText('Companion')).toBeVisible({ timeout: 5000 });

    // =========================================================================
    // STATE 1: LOBBY
    // Mobile player in lobby -> background -> host starts game -> foreground
    // =========================================================================
    await simulateBackground(mobilePage);

    // Host starts game: COUNTDOWN -> QUESTION_ACTIVE (Question 1)
    const startPartidaBtn = hostPage.getByRole('button', { name: /iniciar partida/i }).first();
    await expect(startPartidaBtn).toBeVisible({ timeout: 5000 });
    await startPartidaBtn.click();

    // Host enters active question
    await expect(hostPage.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 15000 });

    // Mobile player returns to foreground WITHOUT manual reload
    await simulateForeground(mobilePage);

    // Convergence check: Mobile player is in QUESTION_ACTIVE with active options
    await expect(mobilePage.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 10000 });
    const optA = mobilePage.getByRole('button', { name: /alternativa a/i }).first();
    await expect(optA).toBeVisible({ timeout: 5000 });

    // Mobile player answers Question 1
    await optA.click();
    await expect(mobilePage.getByText(/resposta registrada/i)).toBeVisible({ timeout: 5000 });

    // =========================================================================
    // STATE 2: QUESTION_ACTIVE
    // Mobile player on question -> background -> host ends question -> foreground
    // =========================================================================
    await simulateBackground(mobilePage);

    // Host ends Question 1 prematurely
    const endQBtn = hostPage.getByRole('button', { name: /encerrar questão/i });
    await expect(endQBtn).toBeVisible({ timeout: 5000 });
    await endQBtn.click();
    const confirmEndBtn = hostPage.getByRole('button', { name: /sim, encerrar/i });
    await expect(confirmEndBtn).toBeVisible({ timeout: 5000 });
    await confirmEndBtn.click();

    // Host is now in QUESTION_REVEAL
    await expect(hostPage.getByText(/gabarito da rodada/i)).toBeVisible({ timeout: 8000 });

    // Mobile player returns to foreground WITHOUT manual reload
    await simulateForeground(mobilePage);

    // Convergence check: Mobile player automatically displays QUESTION_REVEAL
    await expect(mobilePage.getByText(/você acertou|resposta incorreta/i)).toBeVisible({ timeout: 10000 });

    // =========================================================================
    // STATE 3: QUESTION_REVEAL
    // Mobile player in reveal -> background -> automatic transition to ranking -> foreground
    // =========================================================================
    await simulateBackground(mobilePage);

    // Host automatically moves to ROUND_RANKING (~5s)
    await expect(hostPage.getByText(/classificação/i)).toBeVisible({ timeout: 15000 });

    // Mobile player returns to foreground WITHOUT manual reload
    await simulateForeground(mobilePage);

    // Convergence check: Mobile player automatically displays ROUND_RANKING
    await expect(mobilePage.getByText(/classificação da rodada/i)).toBeVisible({ timeout: 10000 });
    await expect(mobilePage.getByText(/sua posição/i)).toBeVisible({ timeout: 5000 });

    // =========================================================================
    // STATE 4: ROUND_RANKING
    // Mobile player in ranking -> background -> automatic transition to Q2 -> foreground
    // =========================================================================
    await simulateBackground(mobilePage);

    // Host automatically enters Question 2 (~5s)
    await expect(hostPage.getByText(/questão 2 de 10/i)).toBeVisible({ timeout: 15000 });

    // Mobile player returns to foreground WITHOUT manual reload
    await simulateForeground(mobilePage);

    // Convergence check: Mobile player automatically converges to Question 2
    await expect(mobilePage.getByText(/questão 2 de 10/i)).toBeVisible({ timeout: 10000 });

    // Ensure options are fresh and clickable (NO leftover submitted state from Question 1!)
    const optB_Q2 = mobilePage.getByRole('button', { name: /alternativa b/i }).first();
    await expect(optB_Q2).toBeVisible({ timeout: 5000 });
    await optB_Q2.click();
    await expect(mobilePage.getByText(/resposta registrada/i)).toBeVisible({ timeout: 5000 });

    // Clean up
    await hostContext.close();
    await companionContext.close();
    await mobileContext.close();
  });

  test('Scenario 2: Automatic recovery via RESUME_SESSION when socket is closed during mobile background', async ({
    browser,
  }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');
    await hostPage.getByRole('button', { name: /iniciar batalha/i }).click();
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });
    const pin = hostPage.url().match(/\/host\/(\d{6})/)![1];

    // Companion
    const companionContext = await browser.newContext();
    const companionPage = await companionContext.newPage();
    await companionPage.goto(`/join/${pin}`);
    await companionPage.getByLabel(/seu apelido/i).fill('Companion2');
    await companionPage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(companionPage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 15000 });

    // Mobile Player joins
    const mobileContext = await browser.newContext();
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`/join/${pin}`);
    await mobilePage.getByLabel(/seu apelido/i).fill('ReconMobile');
    await mobilePage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(mobilePage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 15000 });
    await expect(mobilePage.getByText('ReconMobile').first()).toBeVisible({ timeout: 15000 });

    // =========================================================================
    // STATE 1: LOBBY
    // Mobile player in lobby -> background + socket drop -> host starts game -> foreground
    // =========================================================================
    await simulateBackgroundWithSocketDrop(mobilePage);

    // Host starts game: COUNTDOWN -> QUESTION_ACTIVE (Question 1)
    const startPartidaBtn = hostPage.getByRole('button', { name: /iniciar partida/i }).first();
    await expect(startPartidaBtn).toBeVisible({ timeout: 5000 });
    await startPartidaBtn.click();
    await expect(hostPage.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 15000 });

    // Mobile player returns to foreground (triggers reconnect + RESUME_SESSION)
    await simulateForeground(mobilePage);

    // Convergence check: Player reconnects via RESUME_SESSION and converges to QUESTION_ACTIVE
    await expect(mobilePage.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 12000 });
    const optA = mobilePage.getByRole('button', { name: /alternativa a/i }).first();
    await expect(optA).toBeVisible({ timeout: 5000 });

    // 2. Mobile player answers Question 1
    await optA.click();
    await expect(mobilePage.getByText(/resposta registrada/i)).toBeVisible({ timeout: 5000 });

    // 3. Mobile player moves to background AND socket drops (OS kills connection)
    await simulateBackgroundWithSocketDrop(mobilePage);

    // Host ends Question 1 -> QUESTION_REVEAL
    const endQBtn = hostPage.getByRole('button', { name: /encerrar questão/i });
    await expect(endQBtn).toBeVisible({ timeout: 5000 });
    await endQBtn.click();
    const confirmEndBtn = hostPage.getByRole('button', { name: /sim, encerrar/i });
    await expect(confirmEndBtn).toBeVisible({ timeout: 5000 });
    await confirmEndBtn.click();
    await expect(hostPage.getByText(/gabarito da rodada/i)).toBeVisible({ timeout: 8000 });

    // 4. Mobile player returns to foreground (triggers reconnect + RESUME_SESSION)
    await simulateForeground(mobilePage);

    // Convergence check: Player reconnects, restores session and converges to QUESTION_REVEAL
    await expect(mobilePage.getByText(/você acertou|resposta incorreta/i)).toBeVisible({ timeout: 12000 });

    // 5. Background + Socket drop again before host advances to ROUND_RANKING
    await simulateBackgroundWithSocketDrop(mobilePage);

    // Host automatically advances to ROUND_RANKING (~5s)
    await expect(hostPage.getByText(/classificação/i)).toBeVisible({ timeout: 15000 });

    // Return to foreground
    await simulateForeground(mobilePage);

    // Convergence check: Player converges to ROUND_RANKING
    await expect(mobilePage.getByText(/classificação da rodada/i)).toBeVisible({ timeout: 12000 });
    await expect(mobilePage.getByText(/sua posição/i)).toBeVisible({ timeout: 5000 });

    // 6. Background + Socket drop before host advances to Question 2
    await simulateBackgroundWithSocketDrop(mobilePage);

    // Host automatically advances to Question 2 (~5s)
    await expect(hostPage.getByText(/questão 2 de 10/i)).toBeVisible({ timeout: 15000 });

    // Return to foreground
    await simulateForeground(mobilePage);

    // Convergence check: Player converges to Question 2 with fresh interactive buttons
    await expect(mobilePage.getByText(/questão 2 de 10/i)).toBeVisible({ timeout: 12000 });
    const optC_Q2 = mobilePage.getByRole('button', { name: /alternativa c/i }).first();
    await expect(optC_Q2).toBeVisible({ timeout: 5000 });
    await optC_Q2.click();
    await expect(mobilePage.getByText(/resposta registrada/i)).toBeVisible({ timeout: 5000 });

    await hostContext.close();
    await companionContext.close();
    await mobileContext.close();
  });

  test('Scenario 3: Unanswered question during background converges to QUESTION_REVEAL with timeout state', async ({
    browser,
  }) => {
    // 1. Host creates room
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');
    await hostPage.getByRole('button', { name: /iniciar batalha/i }).click();
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });
    const pin = hostPage.url().match(/\/host\/(\d{6})/)![1];

    // Mobile Player joins
    const mobileContext = await browser.newContext();
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`/join/${pin}`);
    await mobilePage.getByLabel(/seu apelido/i).fill('SleepyPlayer');
    await mobilePage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(mobilePage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 15000 });

    // Start game
    await hostPage.getByRole('button', { name: /iniciar partida/i }).first().click();
    await expect(mobilePage.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 15000 });

    // Mobile player immediately goes to background WITHOUT answering
    await simulateBackground(mobilePage);

    // Host ends Question 1
    const endQBtn = hostPage.getByRole('button', { name: /encerrar questão/i });
    await expect(endQBtn).toBeVisible({ timeout: 5000 });
    await endQBtn.click();
    const confirmEndBtn = hostPage.getByRole('button', { name: /sim, encerrar/i });
    await expect(confirmEndBtn).toBeVisible({ timeout: 5000 });
    await confirmEndBtn.click();
    await expect(hostPage.getByText(/gabarito da rodada/i)).toBeVisible({ timeout: 8000 });

    // Mobile player returns to foreground
    await simulateForeground(mobilePage);

    // Convergence check: Shows "Tempo Esgotado!" timeout state and official answer
    await expect(mobilePage.getByText(/tempo esgotado/i)).toBeVisible({ timeout: 10000 });
    await expect(mobilePage.getByText(/sem resposta nesta rodada/i)).toBeVisible();
    await expect(mobilePage.getByText(/gabarito oficial/i)).toBeVisible();

    await hostContext.close();
    await mobileContext.close();
  });
});

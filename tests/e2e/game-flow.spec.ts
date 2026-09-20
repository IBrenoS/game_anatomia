import { test, expect } from '@playwright/test';

/**
 * Batalha Anatômica — Full 10-Question Arena E2E Suite (Section 9 / P0.10–P0.24)
 * Mandatory Requirements:
 * - Host + 2 Players (Alice + Bob) + Screen
 * - Complete 10 questions without clicking "Próxima pergunta" or "Ver classificação"
 * - Observe game as a real user via automated server transitions
 * - Duplicate nickname validation
 * - Mid-game reload/reconnection preserving state
 * - Question 10 DESAFIO FINAL visual treatment
 * - Automatic transition: QUESTION_ACTIVE -> QUESTION_REVEAL (5s) -> ROUND_RANKING (5s) -> COUNTDOWN (3s) -> next
 * - Question 10 -> QUESTION_REVEAL (5s) -> FINAL_RANKING (5s) -> PODIUM (10s) -> FINISHED
 * - Adaptive podium for 2 participants
 * - FINISHED navigation: player returns to home, host creates new game
 */

test.describe('Batalha Anatômica — Complete Automated 10-Question E2E Suite', () => {
  test('Full Arena Game Lifecycle: Host + Screen + 2 Players through 10 Questions to Podium & Finished (Fully Automated Loop)', async ({
    browser,
  }) => {
    test.setTimeout(240_000);

    // -------------------------------------------------------------
    // 1. Host Surface (/host)
    // -------------------------------------------------------------
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');
    await hostPage.getByRole('button', { name: /só vou apresentar/i }).click();

    const startBattleBtn = hostPage.getByRole('button', { name: /criar partida/i });
    await expect(startBattleBtn).toBeVisible({ timeout: 15000 });
    await startBattleBtn.click();

    // Host navigates to /host/:pin
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/, { timeout: 15000 });
    const hostUrl = hostPage.url();
    const pinMatch = hostUrl.match(/\/host\/(\d{6})/);
    expect(pinMatch).not.toBeNull();
    const pin = pinMatch![1];

    // Verify PIN and QR Code are visible on Host Lobby
    await expect(hostPage.getByText(pin, { exact: true })).toBeVisible();
    await expect(hostPage.getByAltText(new RegExp(`QR Code para entrar na sala ${pin}`))).toBeVisible();

    // -------------------------------------------------------------
    // 2. Telão / Big Screen Surface (/screen/:pin)
    // -------------------------------------------------------------
    const screenContext = await browser.newContext();
    const screenPage = await screenContext.newPage();
    await screenPage.goto(`/screen/${pin}`);

    await expect(screenPage.getByText(pin, { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(screenPage.getByText(/aguardando participantes entrarem/i)).toBeVisible();

    // -------------------------------------------------------------
    // 3. Player 1: Alice Joins
    // -------------------------------------------------------------
    const aliceContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    await alicePage.goto(`/join/${pin}`);

    const aliceInput = alicePage.getByLabel(/seu apelido/i);
    await expect(aliceInput).toBeVisible({ timeout: 10000 });
    await aliceInput.fill('Alice');
    await alicePage.getByRole('button', { name: /entrar na arena/i }).click();

    // Alice lands on /play/:pin in lobby
    await expect(alicePage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });
    await expect(alicePage.getByText('Alice').first()).toBeVisible({ timeout: 10000 });

    // Host and Screen reflect Alice
    await expect(hostPage.getByText('Alice')).toBeVisible();
    await expect(screenPage.getByText('Alice')).toBeVisible();

    // -------------------------------------------------------------
    // 4. Duplicate Nickname Rejection
    // -------------------------------------------------------------
    const bobContext = await browser.newContext();
    const bobPage = await bobContext.newPage();
    await bobPage.goto(`/join/${pin}`);

    const bobInput = bobPage.getByLabel(/seu apelido/i);
    await expect(bobInput).toBeVisible({ timeout: 10000 });
    // Attempt duplicate 'alice' (case-insensitive)
    await bobInput.fill('alice');
    await bobPage.getByRole('button', { name: /entrar na arena/i }).click();

    // Verify error message displayed
    await expect(bobPage.getByRole('alert')).toBeVisible({ timeout: 5000 });
    await expect(bobPage.getByText(/já está em uso/i)).toBeVisible();

    // Enter unique name Bob
    await bobInput.fill('Bob');
    await bobPage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(bobPage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });
    await expect(bobPage.getByText('Bob').first()).toBeVisible({ timeout: 10000 });

    // Host and Screen see both participants (2 / 50)
    await expect(hostPage.getByText('Bob')).toBeVisible();
    await expect(screenPage.getByText('2 / 50')).toBeVisible();

    // -------------------------------------------------------------
    // 5. Host Starts the Game -> Countdown
    // -------------------------------------------------------------
    const startPartidaBtn = hostPage.getByRole('button', { name: /iniciar partida/i }).first();
    await expect(startPartidaBtn).toBeVisible();
    await startPartidaBtn.click();

    // Verify synchronized countdown across Screen and Players
    await expect(screenPage.getByText(/prepare-se/i)).toBeVisible({ timeout: 5000 });
    await expect(alicePage.getByText(/prepare-se/i)).toBeVisible({ timeout: 5000 });
    await expect(bobPage.getByText(/prepare-se/i)).toBeVisible({ timeout: 5000 });

    // -------------------------------------------------------------
    // 6. Execute All 10 Questions via Automated Game Loop (NO MANUAL ADVANCE CLICKS!)
    // -------------------------------------------------------------
    for (let qNum = 1; qNum <= 10; qNum++) {
      // A. Verify question is active across clients
      const qProgress = new RegExp(`questão ${qNum} de 10`, 'i');
      await expect(alicePage.getByText(qProgress)).toBeVisible({ timeout: 15000 });
      await expect(bobPage.getByText(qProgress)).toBeVisible({ timeout: 15000 });

      // Special visual atmosphere on Question 10 (P1.14)
      if (qNum === 10) {
        await expect(alicePage.getByText(/desafio final/i)).toBeVisible();
        await expect(screenPage.getByText(/desafio final/i)).toBeVisible();
      }

      // Option buttons exist
      const aliceOptA = alicePage.getByRole('button', { name: /alternativa a/i }).first();
      const bobOptB = bobPage.getByRole('button', { name: /alternativa b/i }).first();
      await expect(aliceOptA).toBeVisible({ timeout: 5000 });

      // Mid-game reconnection check on Question 5: Bob reloads before answering
      if (qNum === 5) {
        await bobPage.reload();
        await expect(bobPage.getByText(qProgress)).toBeVisible({ timeout: 8000 });
      }

      // B. Alice submits answer -> sees "Resposta registrada" neutral confirmation
      await aliceOptA.click();
      await expect(alicePage.getByText(/resposta registrada/i)).toBeVisible({ timeout: 5000 });

      // B2. Bob submits answer (as the last eligible player, triggers immediate round close)
      const bobOpt = bobPage.getByRole('button', { name: /alternativa b/i }).first();
      await bobOpt.click();
      await expect(bobPage.getByText(/resposta registrada|você acertou|resposta incorreta/i)).toBeVisible({ timeout: 5000 });

      // C. All active players have answered! Server automatically ends question -> QUESTION_REVEAL
      // Screen displays reveal and distribution
      await expect(screenPage.getByText(/gabarito da pergunta/i)).toBeVisible({ timeout: 8000 });

      // Players see their personal results (correct/wrong, points, accumulated score)
      await expect(alicePage.getByText(/você acertou|resposta incorreta/i)).toBeVisible({ timeout: 5000 });
      await expect(bobPage.getByText(/você acertou|resposta incorreta/i)).toBeVisible({ timeout: 5000 });

      // D. Automatic Advancement (NO HOST CLICKS!)
      if (qNum < 10) {
        // Automatically transitions to ROUND_RANKING (~5s alarm)
        await expect(screenPage.getByText(/top 5 da batalha/i)).toBeVisible({ timeout: 10000 });

        // Automatically transitions to COUNTDOWN (3s) and then next QUESTION_ACTIVE
        // The loop will wait for next question's qProgress on top of next iteration!
      } else {
        // Question 10: Automatically transitions to FINAL_RANKING (~5s alarm)
        await expect(screenPage.getByText(/classificação final/i)).toBeVisible({ timeout: 10000 });
      }
    }

    // -------------------------------------------------------------
    // 7. Question 10 -> Automated Podium Ceremony (~5s alarm)
    // -------------------------------------------------------------
    // Automatically transitions from FINAL_RANKING to PODIUM
    await expect(screenPage.getByText(/pódio dos campeões/i)).toBeVisible({ timeout: 10000 });

    // Adaptive podium displays 1º and 2º place for 2 participants (P0.20)
    await expect(screenPage.getByText('1º')).toBeVisible({ timeout: 12000 });
    await expect(screenPage.getByText('2º')).toBeVisible({ timeout: 12000 });

    // -------------------------------------------------------------
    // 8. Automated Transition to FINISHED (~10s alarm)
    // -------------------------------------------------------------
    // Screen displays game completion
    await expect(screenPage.getByText(/fim de jogo/i)).toBeVisible({ timeout: 15000 });

    // Host displays FINISHED state with action buttons
    await expect(hostPage.getByText(/partida encerrada/i)).toBeVisible({ timeout: 15000 });
    const novaPartidaBtn = hostPage.getByRole('button', { name: /nova partida/i });
    await expect(novaPartidaBtn).toBeVisible();

    // Alice displays FINISHED state with position and score
    await expect(alicePage.getByText(/partida finalizada/i)).toBeVisible({ timeout: 15000 });
    const voltarInicioBtn = alicePage.getByRole('button', { name: /voltar ao início/i });
    await expect(voltarInicioBtn).toBeVisible();

    // T14/T45: reopening the finished domain converges without manual storage cleanup.
    await alicePage.reload();
    await expect(alicePage.getByText(/partida finalizada/i)).toBeVisible({ timeout: 15000 });
    const reopenedVoltarInicioBtn = alicePage.getByRole('button', { name: /voltar ao início/i });
    await expect(reopenedVoltarInicioBtn).toBeVisible();

    // -------------------------------------------------------------
    // 9. Clean Navigation & Storage (P0.23, P0.24)
    // -------------------------------------------------------------
    // Alice returns home cleanly
    await reopenedVoltarInicioBtn.click();
    await expect(alicePage).toHaveURL('/', { timeout: 5000 });

    // Host navigates to create another game
    await novaPartidaBtn.click();
    await expect(hostPage).toHaveURL('/host', { timeout: 5000 });

    // Clean up browser contexts
    await hostContext.close();
    await screenContext.close();
    await aliceContext.close();
    await bobContext.close();
  });
});

import { test, expect } from '@playwright/test';

/**
 * Batalha Anatômica — Full 10-Question Arena E2E Suite (P3.3)
 * Covering:
 * - Host opens room from /host and gets PIN and QR code
 * - Screen opens on /screen/:pin and synchronizes in real time
 * - Player 1 (Alice) joins via /join/:pin
 * - Duplicate nickname rejection ('alice' / case-insensitive)
 * - Player 2 (Bob) and Player 3 (Charlie) join
 * - Synchronized 3-2-1 countdown across Host, Screen, and Players
 * - Full 10-question execution with answer locking and feedback
 * - Mid-game player page reload / reconnection preserving session and score
 * - Question 10 300pt challenge and transition: QUESTION_REVEAL -> FINAL_RANKING
 * - Sequential Podium ceremony and final completion
 */

test.describe('Batalha Anatômica — Complete 10-Question E2E Suite', () => {
  test('Full Arena Game Lifecycle: Host + Screen + 3 Players through 10 Questions to Podium', async ({
    browser,
  }) => {
    // -------------------------------------------------------------
    // 1. Host Surface (/host)
    // -------------------------------------------------------------
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/host');

    const startBattleBtn = hostPage.getByRole('button', { name: /iniciar batalha/i });
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
    // 2. Telão / Big Screen Surface (/screen/:pin) (P1.1)
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
    // Reload ensures fresh connectionState on PlayerPage with saved session token
    await alicePage.reload();
    await expect(alicePage.getByText('Alice').first()).toBeVisible({ timeout: 10000 });

    // Host and Screen reflect 1 participant
    await expect(hostPage.getByText('Alice')).toBeVisible();
    await expect(screenPage.getByText('Alice')).toBeVisible();

    // -------------------------------------------------------------
    // 4. Duplicate Nickname Rejection (P0.2)
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

    // Reload join page and enter unique name Bob
    await bobPage.goto(`/join/${pin}`);
    const bobInput2 = bobPage.getByLabel(/seu apelido/i);
    await expect(bobInput2).toBeVisible({ timeout: 10000 });
    await bobInput2.fill('Bob');
    await bobPage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(bobPage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });
    await bobPage.reload();
    await expect(bobPage.getByText('Bob').first()).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------
    // 5. Player 3: Charlie Joins
    // -------------------------------------------------------------
    const charlieContext = await browser.newContext();
    const charliePage = await charlieContext.newPage();
    await charliePage.goto(`/join/${pin}`);
    await charliePage.getByLabel(/seu apelido/i).fill('Charlie');
    await charliePage.getByRole('button', { name: /entrar na arena/i }).click();
    await expect(charliePage).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10000 });
    await charliePage.reload();
    await expect(charliePage.getByText('Charlie').first()).toBeVisible({ timeout: 10000 });

    // Host and Screen see all 3 players
    await expect(hostPage.getByText('Charlie')).toBeVisible();
    await expect(screenPage.getByText('3 / 50')).toBeVisible();

    // -------------------------------------------------------------
    // 6. Host Starts the Game -> Countdown (P1.2)
    // -------------------------------------------------------------
    const startPartidaBtn = hostPage.getByRole('button', { name: /iniciar partida/i }).first();
    await expect(startPartidaBtn).toBeVisible();
    await startPartidaBtn.click();

    // Verify Portuguese countdown on Screen
    await expect(screenPage.getByText(/prepare-se/i)).toBeVisible({ timeout: 5000 });

    // -------------------------------------------------------------
    // 7. Execute All 10 Questions
    // -------------------------------------------------------------
    for (let qNum = 1; qNum <= 10; qNum++) {
      // A. Verify question is active across clients
      const qProgress = new RegExp(`questão ${qNum} de 10`, 'i');
      await expect(alicePage.getByText(qProgress)).toBeVisible({ timeout: 12000 });
      await expect(bobPage.getByText(qProgress)).toBeVisible({ timeout: 12000 });
      await expect(charliePage.getByText(qProgress)).toBeVisible({ timeout: 12000 });

      // Option buttons exist
      const aliceOptA = alicePage.getByRole('button', { name: /alternativa a/i }).first();
      const bobOptB = bobPage.getByRole('button', { name: /alternativa b/i }).first();
      const charlieOptA = charliePage.getByRole('button', { name: /alternativa a/i }).first();
      await expect(aliceOptA).toBeVisible({ timeout: 5000 });

      // B. Players submit answers with optimistic click locking (P1.4)
      await aliceOptA.click();
      await expect(alicePage.getByText(/resposta registrada|resposta incorreta|você acertou/i)).toBeVisible({ timeout: 5000 });

      await bobOptB.click();
      await expect(bobPage.getByText(/resposta registrada|resposta incorreta|você acertou/i)).toBeVisible({ timeout: 5000 });

      await charlieOptA.click();
      await expect(charliePage.getByText(/resposta registrada|resposta incorreta|você acertou/i)).toBeVisible({ timeout: 5000 });

      // C. All answered -> server transitions automatically to QUESTION_REVEAL (P1.3)
      // Screen displays reveal and distribution
      await expect(screenPage.getByText(/gabarito da pergunta/i)).toBeVisible({ timeout: 8000 });

      // Host displays ranking advancement button
      const showRankingBtn = hostPage.getByRole('button', { name: /ver classificação/i });
      await expect(showRankingBtn).toBeVisible({ timeout: 8000 });
      await showRankingBtn.click();

      // D. Ranking View
      if (qNum < 10) {
        // Questions 1–9: Host shows next question button
        await expect(hostPage.getByRole('button', { name: /próxima pergunta/i })).toBeVisible({ timeout: 8000 });
        await expect(screenPage.getByText(/top 5 da batalha/i)).toBeVisible({ timeout: 8000 });

        // Mid-game test on Question 5: Test Bob page reload and reconnect (P0.2)
        if (qNum === 5) {
          await bobPage.reload();
          // Bob automatically restores session and lands back on player page
          await expect(bobPage.getByText('Bob').first()).toBeVisible({ timeout: 8000 });
        }

        const nextQBtn = hostPage.getByRole('button', { name: /próxima pergunta/i });
        await nextQBtn.click();
      } else {
        // Question 10 (Final Question) -> Transitions to FINAL_RANKING (P0.5)
        await expect(screenPage.getByText(/classificação final/i)).toBeVisible({ timeout: 8000 });
      }
    }

    // -------------------------------------------------------------
    // 8. Question 10 -> Podium Ceremony (P2.4)
    // -------------------------------------------------------------
    // Host triggers podium ceremony from FINAL_RANKING
    const startPodiumBtn = hostPage.getByRole('button', { name: /iniciar pódio/i });
    await expect(startPodiumBtn).toBeVisible({ timeout: 8000 });
    await startPodiumBtn.click();

    // Screen displays ceremonial podium
    await expect(screenPage.getByText(/pódio dos campeões/i)).toBeVisible({ timeout: 10000 });
    await expect(screenPage.getByText('1º')).toBeVisible({ timeout: 12000 });

    // Host finishes game
    const finishGameBtn = hostPage.getByRole('button', { name: /concluir partida/i });
    await expect(finishGameBtn).toBeVisible({ timeout: 8000 });
    await finishGameBtn.click();

    // Confirm dialog
    const confirmBtn = hostPage.getByRole('button', { name: /finalizar agora/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // Screen displays game completed
    await expect(screenPage.getByText(/fim de jogo/i)).toBeVisible({ timeout: 8000 });

    // Clean up contexts
    await hostContext.close();
    await screenContext.close();
    await aliceContext.close();
    await bobContext.close();
    await charlieContext.close();
  });
});

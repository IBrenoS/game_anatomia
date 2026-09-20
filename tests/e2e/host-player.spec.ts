import { expect, test, type Page } from '@playwright/test';

interface DebugSocketManager {
  state: string;
  closeSocketForTest(): void;
}

interface DebugWindow extends Window {
  __wsManagers?: Record<string, DebugSocketManager>;
}

async function createPresenter(page: Page): Promise<string> {
  await page.goto('/host');
  await page.getByRole('button', { name: /só vou apresentar/i }).click();
  await page.getByRole('button', { name: /criar partida/i }).click();
  await expect(page).toHaveURL(/\/host\/\d{6}/, { timeout: 15_000 });
  return page.url().match(/\/host\/(\d{6})/)![1];
}

async function createHostPlayer(page: Page, nickname = 'Criador'): Promise<string> {
  await page.goto('/host');
  await page.getByRole('button', { name: /também vou jogar/i }).click();
  await page.getByLabel(/nome|apelido/i).fill(nickname);
  await page.getByRole('button', { name: /criar partida/i }).click();
  await expect(page).toHaveURL(/\/host\/\d{6}/, { timeout: 15_000 });
  return page.url().match(/\/host\/(\d{6})/)![1];
}

async function joinPlayer(page: Page, pin: string, nickname: string): Promise<void> {
  await page.goto(`/join/${pin}`);
  await page.getByLabel(/seu apelido/i).fill(nickname);
  await page.getByRole('button', { name: /entrar na arena/i }).click();
  await expect(page).toHaveURL(new RegExp(`/play/${pin}`), { timeout: 10_000 });
}

test.describe('Host + Player', () => {
  test('T1/T12: presenter não entra no roster e mantém Host + Players + Screen', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const host = await hostContext.newPage();
    const pin = await createPresenter(host);
    await expect(host.getByRole('heading', { name: /participantes \(0\/0 conectados\)/i })).toBeVisible();

    const playerContext = await browser.newContext();
    const player = await playerContext.newPage();
    await joinPlayer(player, pin, 'Aluno');
    const screenContext = await browser.newContext();
    const screen = await screenContext.newPage();
    await screen.goto(`/screen/${pin}`);

    await expect(host.getByText('Aluno')).toBeVisible();
    await expect(screen.getByText('Aluno')).toBeVisible();
    await expect(host.getByText('Apresentador', { exact: true })).toHaveCount(0);
    await host.getByRole('button', { name: /iniciar partida/i }).first().click();
    await expect(player.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 12_000 });
    await expect(screen.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 12_000 });
  });

  test('T2/T3/T11: host player cria uma identidade e joga sem Screen', async ({ page }) => {
    await createHostPlayer(page);
    await expect(page.getByText('Criador', { exact: true })).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => Object.keys(
      (window as DebugWindow).__wsManagers ?? {},
    ).sort())).toEqual(['host', 'player']);
    await expect(page.getByRole('heading', { name: /participantes \(1\/1 conectados\)/i })).toBeVisible();
  });

  test('T4/T5/T6/T7: questão usa UI Player, aceita resposta e preserva controles', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const host = await hostContext.newPage();
    const pin = await createHostPlayer(host);
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await joinPlayer(other, pin, 'Outro');

    await host.getByRole('button', { name: /iniciar partida/i }).first().click();
    await expect(host.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 12_000 });
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
    await host.getByRole('button', { name: /iniciar partida/i }).first().click();

    for (let question = 1; question <= 10; question++) {
      const progress = new RegExp(`questão ${question} de 10`, 'i');
      await expect(host.getByText(progress)).toBeVisible({ timeout: 15_000 });
      await expect(other.getByText(progress)).toBeVisible({ timeout: 15_000 });
      await host.getByRole('button', { name: /alternativa a/i }).click();
      await other.getByRole('button', { name: /alternativa b/i }).click();
      await expect(host.getByText(/você acertou|resposta incorreta/i)).toBeVisible({ timeout: 10_000 });
    }

    await expect(host.getByText(/você subiu ao pódio/i)).toBeVisible({ timeout: 15_000 });
    await expect(host.getByText(/\d+º lugar/i)).toBeVisible();
  });

  test('T9: reload mantém token, resposta, score e uma identidade', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const host = await hostContext.newPage();
    const pin = await createHostPlayer(host);
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await joinPlayer(other, pin, 'Outro');
    await host.getByRole('button', { name: /iniciar partida/i }).first().click();
    await expect(host.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 12_000 });
    await host.getByRole('button', { name: /alternativa a/i }).click();
    await other.getByRole('button', { name: /alternativa b/i }).click();
    await expect(host.getByText(/pontuação acumulada/i)).toBeVisible({ timeout: 8_000 });

    const scoreBefore = await host.getByText(/\d+ pts/i).last().textContent();
    const tokenBefore = await host.evaluate(key => localStorage.getItem(key), `batalha_session_${pin}`);
    await host.reload();
    await expect(host.getByText(/pontuação acumulada|total de pontos/i)).toBeVisible({ timeout: 10_000 });
    await expect(host.getByText(scoreBefore ?? '', { exact: true })).toBeVisible();
    const tokenAfter = await host.evaluate(key => localStorage.getItem(key), `batalha_session_${pin}`);
    expect(tokenAfter).toBe(tokenBefore);
    await expect(host.getByRole('heading', { name: new RegExp(`Host \\+ Player — Criador — Sala PIN: ${pin}`, 'i') })).toBeVisible();
    await expect(host.getByText(/2 participantes.*2 conectados/i)).toBeVisible();
  });

  test('T10: sockets recuperam independentemente sem duplicar criador', async ({ page }) => {
    await createHostPlayer(page);
    await page.evaluate(() => (window as DebugWindow).__wsManagers!.player.closeSocketForTest());
    await expect.poll(() => page.evaluate(() => (window as DebugWindow).__wsManagers!.player.state), {
      timeout: 10_000,
    }).toBe('connected');
    await expect(page.getByText('Criador', { exact: true })).toHaveCount(1);

    await page.evaluate(() => (window as DebugWindow).__wsManagers!.host.closeSocketForTest());
    await expect.poll(() => page.evaluate(() => (window as DebugWindow).__wsManagers!.host.state), {
      timeout: 10_000,
    }).toBe('connected');
    await expect(page.getByText('Criador', { exact: true })).toHaveCount(1);
  });
});

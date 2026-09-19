import { expect, test } from '@playwright/test';

test.describe('Host + Player', () => {
  test('T1: presenter cria sala sem entrar no roster', async ({ page }) => {
    await page.goto('/host');
    await page.getByRole('button', { name: /só vou apresentar/i }).click();
    await page.getByRole('button', { name: /criar partida/i }).click();

    await expect(page).toHaveURL(/\/host\/\d{6}/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /participantes \(0\/0 conectados\)/i })).toBeVisible();
  });

  test('T2: criador escolhe jogar e aparece uma vez no roster', async ({ page }) => {
    await page.goto('/host');
    await page.getByRole('button', { name: /também vou jogar/i }).click();
    await page.getByLabel(/nome|apelido/i).fill('Criador');
    await page.getByRole('button', { name: /criar partida/i }).click();

    await expect(page).toHaveURL(/\/host\/\d{6}/, { timeout: 15_000 });
    await expect(page.getByText('Criador', { exact: true })).toHaveCount(1);
  });

  test('T3-T5: mantém dois sockets e usa superfície competitiva sem distribuição', async ({ page }) => {
    await page.goto('/host');
    await page.getByRole('button', { name: /também vou jogar/i }).click();
    await page.getByLabel(/nome|apelido/i).fill('Criador');
    await page.getByRole('button', { name: /criar partida/i }).click();
    await expect(page).toHaveURL(/\/host\/\d{6}/, { timeout: 15_000 });
    await expect.poll(() => page.evaluate(() => Object.keys(
      (window as Window & { __wsManagers?: Record<string, unknown> }).__wsManagers ?? {},
    ).sort())).toEqual(['host', 'player']);

    await page.getByRole('button', { name: /iniciar partida/i }).first().click();
    await expect(page.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 12_000 });
    await expect(page.getByRole('button', { name: /alternativa a/i })).toBeVisible();
    await expect(page.getByText(/voto|distribuição/i)).toHaveCount(0);
    await expect(page.getByText(/resposta correta/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /pausar rodada/i })).toBeVisible();
  });
});

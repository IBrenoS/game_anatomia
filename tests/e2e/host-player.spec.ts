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
});

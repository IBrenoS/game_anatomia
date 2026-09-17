import { test, expect } from '@playwright/test';

/**
 * Batalha Anatômica - E2E Multi-User Flow
 * Conforme PRD Páginas 25-26:
 * - Host cria a sala; obtém PIN e QR Code
 * - Jogadores entram pelo PIN/link
 * - Host inicia o jogo; contagem de 3s; questão sincronizada
 * - Jogadores respondem; encerramento por todos responderam
 * - Revelação com gabarito e ranking determinístico
 * - Pausa congela o cronômetro; retomada restaura tempo
 * - Fim de jogo com pódio teatral e sem botão de próxima pergunta
 */

test.describe('Batalha Anatômica - Fluxo Completo de Partida', () => {
  test('Fluxo E2E: Criação de sala, entrada de jogadores e ciclo de rodada', async ({ browser }) => {
    // 1. Contexto do Apresentador
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    await hostPage.goto('/');

    // Clicar em "Criar Novo Jogo"
    const createBtn = hostPage.getByRole('button', { name: /criar novo jogo/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Aguardar redirecionamento para o painel do apresentador
    await expect(hostPage).toHaveURL(/\/host\/\d{6}/);
    const hostUrl = hostPage.url();
    const pinMatch = hostUrl.match(/\/host\/(\d{6})/);
    expect(pinMatch).not.toBeNull();
    const pin = pinMatch![1];

    // Verificar exibição do PIN e do QR Code no lobby
    await expect(hostPage.getByText(pin)).toBeVisible();
    await expect(hostPage.getByAltText(new RegExp(`QR Code para entrar na sala ${pin}`))).toBeVisible();

    // 2. Contexto do Jogador 1 (Alice)
    const player1Context = await browser.newContext();
    const player1Page = await player1Context.newPage();
    await player1Page.goto(`/join/${pin}`);

    const nicknameInput1 = player1Page.getByPlaceholderText(/ex: maria silva/i);
    await expect(nicknameInput1).toBeVisible();
    await nicknameInput1.fill('Alice');
    await player1Page.getByRole('button', { name: /entrar na batalha/i }).click();

    // Confirmar que Alice entrou no lobby
    await expect(player1Page.getByText(/aguardando início da batalha/i)).toBeVisible();
    await expect(hostPage.getByText('Alice')).toBeVisible();

    // 3. Contexto do Jogador 2 (Bob)
    const player2Context = await browser.newContext();
    const player2Page = await player2Context.newPage();
    await player2Page.goto(`/join/${pin}`);

    const nicknameInput2 = player2Page.getByPlaceholderText(/ex: maria silva/i);
    await nicknameInput2.fill('Bob');
    await player2Page.getByRole('button', { name: /entrar na batalha/i }).click();

    await expect(player2Page.getByText(/aguardando início da batalha/i)).toBeVisible();
    await expect(hostPage.getByText('Bob')).toBeVisible();

    // 4. Host inicia a partida
    const startBtn = hostPage.getByRole('button', { name: /iniciar jogo/i });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // 5. Verificar início sincronizado da questão 1
    await expect(player1Page.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 6000 });
    await expect(player2Page.getByText(/questão 1 de 10/i)).toBeVisible({ timeout: 6000 });

    // Alternativas possuem marcadores textuais A, B, C, D (WCAG 2.2 AA)
    await expect(player1Page.getByRole('button', { name: /alternativa a/i })).toBeVisible();
    await expect(player1Page.getByRole('button', { name: /alternativa b/i })).toBeVisible();

    // 6. Jogadores enviam resposta
    await player1Page.getByRole('button', { name: /alternativa b/i }).click();
    await expect(player1Page.getByText(/resposta enviada/i)).toBeVisible();

    await player2Page.getByRole('button', { name: /alternativa a/i }).click();
    await expect(player2Page.getByText(/resposta enviada/i)).toBeVisible();

    // 7. Encerramento automático quando todos responderam
    await expect(hostPage.getByText(/gabarito da rodada/i)).toBeVisible({ timeout: 4000 });

    // 8. Host avança para a classificação
    const showRankingBtn = hostPage.getByRole('button', { name: /ver classificação/i });
    await showRankingBtn.click();

    await expect(player1Page.getByText(/você está liderando a partida/i)).toBeVisible({ timeout: 4000 });
    await expect(player2Page.getByText(/pts do #1/i)).toBeVisible({ timeout: 4000 });

    await hostContext.close();
    await player1Context.close();
    await player2Context.close();
  });
});

import { expect, test } from '@playwright/test';

const password = 'LeadFlow@123';

async function signIn(page, email) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Abrir modo de desenvolvimento' })).toHaveCount(0);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar com e-mail' }).click();
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();
}

test('authenticates an administrator through the Firebase Emulator', async ({ page }) => {
  await signIn(page, 'admin@leadflow.test');

  await expect(page.getByText('Administrador Teste')).toBeVisible();
  await expect(page.getByRole('button', { name: /Acessos da equipe/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Configurações/ })).toBeVisible();
});

test('keeps the same account authenticated on multiple devices', async ({ browser }) => {
  const mobileContext = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true
  });
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 }
  });

  try {
    const mobilePage = await mobileContext.newPage();
    const desktopPage = await desktopContext.newPage();

    await signIn(mobilePage, 'admin@leadflow.test');
    await signIn(desktopPage, 'admin@leadflow.test');

    await mobilePage.reload();
    await desktopPage.reload();

    await expect(mobilePage.getByRole('heading', { name: 'Início' })).toBeVisible();
    await expect(desktopPage.getByRole('heading', { name: 'Início' })).toBeVisible();
    await expect(mobilePage.getByText('Administrador Teste')).toBeVisible();
    await expect(desktopPage.getByText('Administrador Teste')).toBeVisible();
  } finally {
    await Promise.all([mobileContext.close(), desktopContext.close()]);
  }
});

test('loads the real appointment flow for a receptionist profile', async ({ page }) => {
  await signIn(page, 'balcao@leadflow.test');

  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await expect(page).toHaveURL(/#\/appointments$/);
  await expect(page.getByText('Agenda de exames')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compareceu' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Não compareceu' }).first()).toBeVisible();
});

test('validates appointment cancellation reasons for a receptionist', async ({ page }) => {
  await signIn(page, 'balcao@leadflow.test');

  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await expect(page.getByRole('button', { name: /Cancelar agendamento de/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Abrir cadastro de/ }).first().click();
  await page.getByRole('button', { name: 'Cancelar agendamento' }).click();

  const dialog = page.locator('#appointment-cancellation-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Cancelar agendamento?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(dialog.getByText('Selecione o motivo do cancelamento.')).toBeVisible();

  await dialog.getByLabel('Motivo do cancelamento').selectOption('other');
  await dialog.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(dialog.getByText('Descreva o motivo do cancelamento.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Voltar' }).click();
  await expect(dialog).toHaveCount(0);
});

test('requires formal confirmation when a receptionist reschedules an appointment', async ({ page }) => {
  await signIn(page, 'balcao@leadflow.test');

  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await page.getByRole('button', { name: /Abrir cadastro de Cliente Pendente Hoje/ }).click();
  const form = page.locator('#edit-lead-form');
  await expect(form).toBeVisible();
  await form.getByLabel('Data do pré-agendamento').fill('2026-11-06');
  const time = form.getByLabel('Horário disponível');
  await expect(time).toBeEnabled();
  await time.selectOption({ index: 1 });
  await form.getByRole('button', { name: /Salvar (reagendamento|alterações)/ }).click();

  const dialog = page.locator('#appointment-reschedule-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Reagendar cliente?' })).toBeVisible();
  await expect(dialog).toContainText('Cliente Pendente Hoje');
  await expect(dialog).toContainText('08:00');
  await dialog.getByRole('button', { name: 'Confirmar reagendamento' }).click();
  await expect(dialog.getByText('Selecione o motivo do reagendamento.')).toBeVisible();
  await dialog.getByLabel('Motivo do reagendamento').selectOption('other');
  await dialog.getByRole('button', { name: 'Confirmar reagendamento' }).click();
  await expect(dialog.getByText('Descreva o motivo do reagendamento.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Voltar' }).click();
  await expect(dialog).toHaveCount(0);
});

test('shows the simplified lead history without a duplicated funnel heading', async ({ page }) => {
  await signIn(page, 'admin@leadflow.test');

  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await page.getByRole('button', { name: /Abrir cadastro de/ }).first().click();
  await page.getByText('Ver histórico', { exact: true }).click();

  const dialog = page.locator('#lead-history-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Histórico do lead' })).toHaveCount(1);
  await expect(dialog.getByText('FUNIL', { exact: true })).toHaveCount(0);
  await expect(dialog.locator('.lead-history > header')).toHaveCount(0);
  await expect(dialog.locator('.lead-history-list li').first()).toBeVisible();
});

test('lets another collaborator explicitly claim a cancelled lead', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Fluxo transacional executado uma vez por seed.');
  await signIn(page, 'mei@leadflow.test');

  await page.goto('/#/search');
  await expect(page.getByLabel('Nome ou CPF')).toBeVisible();
  await page.waitForTimeout(750);
  await page.getByLabel('Nome ou CPF').fill('Cliente Cancelado');
  await page.getByRole('button', { name: 'Pesquisar' }).click();
  await expect(page.getByText('Cancelado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir cadastro de Cliente Cancelado' }).click();

  const form = page.locator('#edit-lead-form');
  await expect(form.getByText('Consulta somente leitura')).toBeVisible();
  await form.getByRole('button', { name: 'Assumir este lead' }).click();
  const dialog = page.locator('#lead-assignment-dialog');
  await expect(dialog.getByRole('heading', { name: 'Assumir este lead?' })).toBeVisible();
  await expect(dialog).toContainText('Colaborador Teste');
  await dialog.getByRole('button', { name: 'Assumir lead' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(form.getByText('Consulta somente leitura')).toHaveCount(0);
  await expect(form.getByRole('button', { name: /Salvar altera/ })).toBeVisible();
});

test('lets a store manager transfer a lead with an audited history entry', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Fluxo transacional executado uma vez por seed.');
  await signIn(page, 'gestor@leadflow.test');

  await page.goto('/#/search');
  await expect(page.getByLabel('Nome ou CPF')).toBeVisible();
  await page.waitForTimeout(750);
  await page.getByLabel('Nome ou CPF').fill('Cliente Sem Agendamento');
  await page.getByRole('button', { name: 'Pesquisar' }).click();
  await page.getByRole('button', { name: 'Abrir cadastro de Cliente Sem Agendamento' }).click();
  await page.getByRole('button', { name: 'Transferir responsável' }).click();

  const dialog = page.locator('#lead-assignment-dialog');
  await expect(dialog.getByRole('heading', { name: 'Transferir responsável' })).toBeVisible();
  await dialog.getByLabel('Novo responsável').selectOption({ label: 'MEI Teste' });
  await dialog.getByRole('button', { name: 'Confirmar transferência' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByText('Ver histórico', { exact: true }).click();
  const history = page.locator('#lead-history-dialog');
  await expect(history.getByText('Responsável transferido')).toBeVisible();
  await expect(history).toContainText('Colaborador Teste para MEI Teste');
});

test('renders the compact registration fields and product payment options', async ({ page }) => {
  await signIn(page, 'admin@leadflow.test');

  await page.getByRole('button', { name: /Nova abordagem/ }).click();
  await expect(page).toHaveURL(/#\/new$/);
  await page.getByLabel('Loja de destino').selectOption('loja-02');
  await expect(page.getByLabel('Interesse principal')).toBeEnabled();

  const examPrice = page.getByLabel('Valor do exame');
  expect(Number(await examPrice.inputValue())).toBeGreaterThan(0);
  await expect(examPrice).toHaveCSS('border-top-width', '0px');
  await expect(examPrice).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const priceInputBox = await examPrice.boundingBox();
  const priceDisplayBox = await page.locator('.exam-price-display').boundingBox();
  expect(priceInputBox.height).toBeLessThan(priceDisplayBox.height);
  await examPrice.fill('0');
  await expect(page.getByLabel('Tipo do exame')).toHaveValue('courtesy');
  await expect(page.locator('[data-exam-price-detail]')).toHaveText('Cortesia');
  await expect(page.locator('[data-exam-payment-method-row]')).toBeHidden();
  await examPrice.fill('175.50');
  await expect(page.getByLabel('Tipo do exame')).toHaveValue('paid');
  await expect(examPrice).toHaveValue('175.5');
  await expect(page.locator('[data-exam-payment-method-row]')).toBeVisible();

  const pairedFields = [
    ['#customerRg', '#customerCpf'],
    ['#birthDate', '#sex'],
    ['#preferredName', '#postalCode']
  ];
  for (const [firstSelector, secondSelector] of pairedFields) {
    const first = await page.locator(firstSelector).boundingBox();
    const second = await page.locator(secondSelector).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(Math.abs(first.y - second.y)).toBeLessThan(16);
  }

  await expect(page.locator('[name="pathologyIds"][value="unknown"]')).toHaveCount(0);
  const productPayment = page.locator('[data-product-payment]');
  await expect(productPayment).toBeHidden();
  await page.getByLabel('Interesse principal').selectOption('complete-glasses');
  await expect(productPayment).toBeVisible();
  await productPayment.getByLabel('Pix').check();
  await expect(productPayment.getByLabel('Pix')).toBeChecked();
});

test('opens the lead archive workflow only from active management records', async ({ page }) => {
  await signIn(page, 'admin@leadflow.test');

  await page.getByRole('button', { name: /Painel de gestão/ }).click();
  await expect(page).toHaveURL(/#\/management$/);
  await expect(page.getByLabel('Registros')).toHaveValue('active');
  const archiveButton = page.getByRole('button', { name: 'Arquivar leads' });
  await expect(archiveButton).toBeEnabled();
  await archiveButton.click();

  const dialog = page.locator('#management-archive-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Arquivar leads' })).toBeVisible();
  await expect(dialog.getByText('O histórico é preservado.')).toBeVisible();
  await expect(dialog.locator('input[name="leadId"]').first()).toBeVisible();
});

test('keeps team access cards compact on mobile', async ({ page }) => {
  await signIn(page, 'admin@leadflow.test');

  await page.getByRole('button', { name: /Acessos da equipe/ }).click();
  await expect(page).toHaveURL(/#\/access$/);
  const firstCard = page.locator('.access-row').first();
  await expect(firstCard).toBeVisible();

  if ((page.viewportSize()?.width || 0) <= 600) {
    const cardBox = await firstCard.boundingBox();
    const detailBoxes = await firstCard.locator('.access-detail').evaluateAll((details) => (
      details.map((detail) => detail.getBoundingClientRect()).map(({ x, y, width, height }) => ({ x, y, width, height }))
    ));
    const actionsBox = await firstCard.locator('.access-actions').boundingBox();

    expect(cardBox.height).toBeLessThan(190);
    expect(Math.max(...detailBoxes.map((box) => box.y)) - Math.min(...detailBoxes.map((box) => box.y))).toBeLessThan(4);
    expect(actionsBox.y).toBeGreaterThan(detailBoxes[0].y + detailBoxes[0].height);
  }
});

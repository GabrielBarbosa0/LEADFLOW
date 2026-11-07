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

  const walkInCard = page.locator('.action-card-walk-in');
  const externalCard = page.locator('.action-card-external');
  await expect(walkInCard).toBeVisible();
  await expect(externalCard).toBeVisible();
  await expect.poll(async () => {
    const [walkInBox, externalBox] = await Promise.all([walkInCard.boundingBox(), externalCard.boundingBox()]);
    if (!walkInBox || !externalBox) return false;
    return page.viewportSize().width >= 720
      ? Math.abs(walkInBox.y - externalBox.y) < 2 && Math.abs(walkInBox.width - externalBox.width) < 2
      : externalBox.y > walkInBox.y;
  }).toBe(true);
});

test('fills the address from a complete CEP without changing the street number', async ({ page }) => {
  await page.route('https://viacep.com.br/ws/50000123/json/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        cep: '50000-123',
        logradouro: 'Rua do Teste',
        bairro: 'Centro',
        localidade: 'Recife',
        uf: 'PE'
      })
    });
  });
  await signIn(page, 'admin@leadflow.test');
  await page.getByRole('button', { name: /Nova abordagem/ }).click();
  await page.getByLabel('Loja de destino').selectOption('loja-02');
  await expect(page.getByLabel('Número')).toBeEnabled({ timeout: 10000 });

  await page.getByLabel('Número').fill('42');
  await page.getByLabel('CEP').fill('50000123');

  await expect(page.getByLabel('CEP')).toHaveValue('50000-123');
  await expect(page.getByLabel('Rua')).toHaveValue('Rua do Teste');
  await expect(page.getByLabel('Bairro')).toHaveValue('Centro');
  await expect(page.getByLabel('Cidade')).toHaveValue('Recife');
  await expect(page.getByLabel('UF')).toHaveValue('PE');
  await expect(page.getByLabel('Número')).toHaveValue('42');
  await expect(page.getByText('Endereço preenchido automaticamente.')).toBeVisible();
});

test('loads store-scoped logistics for an external collaborator', async ({ page }) => {
  await signIn(page, 'externa@leadflow.test');

  await page.getByRole('button', { name: /Operação externa/ }).click();
  await expect(page).toHaveURL(/#\/external-operations$/);
  await expect(page.getByRole('button', { name: 'Voltar ao início' })).toBeVisible();
  await expect(page.getByLabel('Transporte')).toBeVisible();
  await expect(page.getByLabel('Acompanhante')).toBeVisible();
  await expect(page.getByText('Dona Lucia').first()).toBeVisible();
  const transportWidths = await page.locator('.external-operation-tag-transport').evaluateAll((tags) => tags.map((tag) => tag.getBoundingClientRect().width));
  const companionWidths = await page.locator('.external-operation-tag-companion').evaluateAll((tags) => tags.map((tag) => tag.getBoundingClientRect().width));
  expect(new Set(transportWidths).size).toBe(1);
  expect(new Set(companionWidths).size).toBe(1);
  await expect(page.getByText(/Portao azul/).first()).toBeVisible();
  await expect(page.getByText('Seu Jose').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('CPF');
  await page.locator('[data-external-detail-open]').first().click();
  const detailDialog = page.locator('#external-operation-detail-dialog');
  await expect(detailDialog).toBeVisible();
  await expect(detailDialog.getByRole('button', { name: 'Fechar', exact: true })).toHaveCount(0);
  await detailDialog.getByRole('button', { name: 'Fechar detalhes' }).click();
  await expect(detailDialog).toHaveCount(0);

  await page.getByLabel('Transporte').selectOption('without');
  await expect(page.getByText('Cliente Compareceu Hoje').first()).toBeVisible();
  await expect(page.getByText('Dona Lucia')).toHaveCount(0);

  await page.getByLabel('Transporte').selectOption('with');
  await page.getByLabel('Acompanhante').selectOption('with');
  await expect(page.getByText('Dona Lucia').first()).toBeVisible();
  await expect(page.getByText('Seu Jose').first()).toBeVisible();
  await expect(page.getByText('Cliente Compareceu Hoje')).toHaveCount(0);
});

test('lists active store captors when creating a quick walk-in', async ({ page }) => {
  await signIn(page, 'admin@leadflow.test');
  await page.goto('/#/walk-ins');

  const captorSelect = page.getByLabel('Quem trouxe o cliente');
  await expect(captorSelect).toBeVisible();
  await expect(captorSelect.locator('option')).toContainText([
    'Atendimento espontâneo / sem indicação',
    'Colaborador Teste',
    'MEI Teste'
  ]);
  await expect(captorSelect).not.toContainText('Usuario Bloqueado');
  await expect(page.getByText('não altera o captador original do cadastro')).toBeVisible();
  await expect(page.locator('.walk-in-more summary')).toHaveCount(2);
  await expect(page.locator('.walk-in-more summary svg.lucide-ellipsis')).toHaveCount(2);
  await expect(page.locator('[data-walk-in-transition="called"] svg.lucide-megaphone')).toBeVisible();

  const startBox = await page.locator('[data-walk-in-transition="in_service"]').boundingBox();
  const callBox = await page.locator('[data-walk-in-transition="called"]').boundingBox();
  const gaveUpBox = await page.locator('[data-walk-in-transition="gave_up"]').boundingBox();
  const menuBoxes = await page.locator('.walk-in-more summary').evaluateAll((elements) => (
    elements.map((element) => element.getBoundingClientRect().toJSON())
  ));

  expect(startBox).not.toBeNull();
  expect(callBox).not.toBeNull();
  expect(gaveUpBox).not.toBeNull();
  expect(Math.abs(startBox.x - callBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs((startBox.x + startBox.width) - (gaveUpBox.x + gaveUpBox.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(menuBoxes[0].x - menuBoxes[1].x)).toBeLessThanOrEqual(1);
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

test('loads the real appointment flow for an internal collaborator', async ({ page }, testInfo) => {
  await signIn(page, 'balcao@leadflow.test');

  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await expect(page).toHaveURL(/#\/appointments$/);
  await expect(page.getByText('Agenda de exames')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compareceu' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Não compareceu' }).first()).toBeVisible();

  if (testInfo.project.name === 'desktop-chrome') {
    const appointmentList = page.locator('.appointment-list');
    await expect(page.locator('.agenda-layout')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByText('Joao Batista')).toBeAttached();
    await appointmentList.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const scrollTop = await appointmentList.evaluate((element) => element.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
    await page.evaluate(() => {
      window.__appointmentListBeforeAttendance = document.querySelector('.appointment-list');
    });

    await page.getByRole('group', { name: 'Comparecimento de Joao Batista' }).getByRole('button', { name: 'Compareceu', exact: true }).click();
    await expect(page.getByText('Comparecimento registrado.')).toBeVisible();
    await expect.poll(() => appointmentList.evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(scrollTop - 2);
    expect(await page.evaluate(() => document.querySelector('.appointment-list') === window.__appointmentListBeforeAttendance)).toBe(true);

    await page.getByRole('group', { name: 'Comparecimento de Joao Batista' }).getByRole('button', { name: 'Compareceu', exact: true }).click();
    await expect(page.getByText('Comparecimento removido.')).toBeVisible();
    await expect.poll(() => appointmentList.evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(scrollTop - 2);
    expect(await page.evaluate(() => document.querySelector('.appointment-list') === window.__appointmentListBeforeAttendance)).toBe(true);
  }
});

test('keeps the confirmation period beside a compact back button', async ({ page }) => {
  await signIn(page, 'admin@leadflow.test');
  await page.locator('[data-route="confirmations"]').click();
  await expect(page).toHaveURL(/#\/confirmations$/);

  const period = page.locator('.reminder-period');
  const backButton = page.locator('.reminder-back-button');
  await expect(period).toBeVisible();
  await expect(backButton).toBeVisible();
  await expect(backButton).toHaveAttribute('aria-label', 'Voltar ao início');
  await expect(backButton.locator('span')).toHaveCount(0);
  await expect.poll(async () => {
    const [periodBox, backBox] = await Promise.all([period.boundingBox(), backButton.boundingBox()]);
    if (!periodBox || !backBox) return null;
    return {
      sameRow: Math.abs(periodBox.y - backBox.y) < 2,
      backWidth: Math.round(backBox.width)
    };
  }).toEqual({ sameRow: true, backWidth: 54 });
});

test('validates appointment cancellation reasons for an internal collaborator', async ({ page }) => {
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

test('requires formal confirmation when an internal collaborator reschedules a cancelled appointment', async ({ page }) => {
  await signIn(page, 'balcao@leadflow.test');

  await page.goto('/#/search');
  await expect(page.getByLabel('Nome ou CPF')).toBeVisible();
  await page.waitForTimeout(750);
  await page.getByLabel('Nome ou CPF').fill('Cliente Cancelado');
  await page.getByRole('button', { name: 'Pesquisar' }).click();
  await expect(page.getByText('Cancelado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir cadastro de Cliente Cancelado' }).click();

  const form = page.locator('#edit-lead-form');
  await expect(form).toBeVisible();
  const dateInput = form.getByLabel('Data do pré-agendamento');
  const currentDate = await dateInput.inputValue();
  const targetDate = new Date(`${currentDate}T12:00:00.000Z`);
  targetDate.setUTCDate(targetDate.getUTCDate() + 7);
  if (targetDate.getUTCDay() === 0) targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  await dateInput.fill(targetDate.toISOString().slice(0, 10));
  const time = form.getByLabel('Horário disponível');
  await expect(time).toBeEnabled();
  await time.selectOption({ index: 1 });
  await form.getByRole('button', { name: /Salvar (reagendamento|alterações)/ }).click();

  const dialog = page.locator('#appointment-reschedule-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Reagendar cliente?' })).toBeVisible();
  await expect(dialog).toContainText('Cliente Cancelado');
  await expect(dialog).toContainText('11:20');
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
  const closeButton = dialog.getByRole('button', { name: 'Fechar histórico' });
  await expect(closeButton.locator('.lucide-x')).toBeVisible();
  await expect(closeButton.locator('.lucide-circle-x')).toHaveCount(0);
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

test('lets a MEI schedule an unscheduled lead transferred by a store manager', async ({ page }, testInfo) => {
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
  await expect(history.locator('svg.lucide-user-round-cog')).toBeVisible();
  await expect(history).toContainText('Colaborador Teste para MEI Teste');
  await history.getByRole('button', { name: 'Fechar histórico' }).click();

  await page.getByRole('button', { name: 'Sair' }).click();
  await page.getByLabel('E-mail').fill('mei@leadflow.test');
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar com e-mail' }).click();
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();
  await page.goto('/#/leads');
  await page.getByRole('button', { name: 'Ver cadastro de Cliente Sem Agendamento' }).click();

  const form = page.locator('#edit-lead-form');
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  if (targetDate.getDay() === 0) targetDate.setDate(targetDate.getDate() + 1);
  await form.getByLabel('Data do pré-agendamento').fill(targetDate.toISOString().slice(0, 10));
  const time = form.getByLabel('Horário disponível');
  await expect(time).toBeEnabled();
  await time.selectOption({ index: 1 });
  await form.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page.getByText('Agendamento salvo com sucesso.')).toBeVisible();
  await page.getByRole('button', { name: 'Ver cadastro de Cliente Sem Agendamento' }).click();
  await page.getByText('Ver histórico', { exact: true }).click();
  const updatedHistory = page.locator('#lead-history-dialog');
  await expect(updatedHistory.getByText('Agendamento realizado')).toBeVisible();
  await expect(updatedHistory.locator('svg.lucide-calendar-plus')).toBeVisible();
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

  const purchaseHolder = page.locator('[data-purchase-holder]');
  await expect(purchaseHolder.getByLabel('Titular da compra')).toHaveValue('customer');
  await expect(purchaseHolder.locator('[data-purchase-holder-details]')).toBeHidden();
  await purchaseHolder.getByLabel('Titular da compra').selectOption('other');
  await expect(purchaseHolder.locator('[data-purchase-holder-details]')).toBeVisible();
  await purchaseHolder.getByLabel('Nome do titular').fill('Responsável Exemplo');
  await purchaseHolder.getByLabel('CPF do titular').fill('52998224725');
  await expect(purchaseHolder.getByLabel('CPF do titular')).toHaveValue('529.982.247-25');

  const holderNameBox = await purchaseHolder.getByLabel('Nome do titular').boundingBox();
  const holderCpfBox = await purchaseHolder.getByLabel('CPF do titular').boundingBox();
  const holderRelationshipBox = await purchaseHolder.getByLabel('Vínculo').boundingBox();
  const holderPhoneBox = await purchaseHolder.getByLabel('Telefone do titular').boundingBox();
  expect(holderNameBox).not.toBeNull();
  expect(holderCpfBox).not.toBeNull();
  expect(holderRelationshipBox).not.toBeNull();
  expect(holderPhoneBox).not.toBeNull();
  expect(holderCpfBox.width).toBeLessThan(holderNameBox.width);
  expect(holderRelationshipBox.width).toBeGreaterThanOrEqual(135);
  if (test.info().project.name === 'mobile-chrome') {
    expect(Math.abs(holderPhoneBox.width - holderNameBox.width)).toBeLessThan(2);
  }
});

test('opens the lead archive workflow only from active management records', async ({ page }) => {
  await signIn(page, 'admin@leadflow.test');

  await page.getByRole('button', { name: /Painel de gestão/ }).click();
  await expect(page).toHaveURL(/#\/management$/);
  await expect(page.getByLabel('Registros')).toHaveValue('active');
  if ((page.viewportSize()?.width || 0) <= 600) {
    const managementCard = page.locator('.management-card').first();
    await expect(managementCard).toBeVisible();
    const cardBox = await managementCard.boundingBox();
    const detailRows = await managementCard.locator('dl > div').evaluateAll((details) => details.map((detail) => detail.getBoundingClientRect().y));
    expect(cardBox.height).toBeLessThan(160);
    expect(Math.max(...detailRows) - Math.min(...detailRows)).toBeLessThan(4);
  }
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
  const toggleWidths = await page.locator('.access-toggle').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().width));
  expect(new Set(toggleWidths).size).toBe(1);

  await page.locator('[data-access-new]').click();
  const roleOptions = await page.locator('#access-role-profile option').allTextContents();
  expect(roleOptions).toEqual(['Colaborador Interno', 'Colaborador Externo', 'MEI', 'Gestor', 'Administrador']);
  await page.locator('[data-access-editor-close]').first().click();

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

  const searchInput = page.locator('[data-access-search]');
  await searchInput.evaluate((input) => { window.accessSearchInputBeforeTyping = input; });
  await searchInput.pressSequentially('colaborador', { delay: 20 });
  expect(await searchInput.evaluate((input) => input === window.accessSearchInputBeforeTyping)).toBe(true);
  await expect(searchInput).toBeFocused();
  await expect(searchInput).toHaveValue('colaborador');
});

test('aligns service store checkboxes with their labels', async ({ page }) => {
  await signIn(page, 'admin@leadflow.test');
  await page.locator('[data-route="settings"]').click();
  await expect(page).toHaveURL(/#\/settings$/);
  await page.locator('[data-settings-section="services"]').click();
  await page.locator('[data-service-new]').click();

  const dialog = page.locator('#service-editor-dialog');
  await expect(dialog).toBeVisible();
  const alignmentOffsets = await dialog.locator('.service-store-option').evaluateAll((options) => options.map((option) => {
    const input = option.querySelector('input').getBoundingClientRect();
    const text = option.querySelector('span').getBoundingClientRect();
    return Math.abs((input.top + input.height / 2) - (text.top + text.height / 2));
  }));
  expect(Math.max(...alignmentOffsets)).toBeLessThan(1);
});

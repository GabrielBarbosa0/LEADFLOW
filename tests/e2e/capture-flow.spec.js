import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/');
});

test('warns twice before creating another appointment for the same CPF', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify([{
      id: 'existing-cpf-appointment',
      fullName: 'Cliente Ja Agendado',
      phoneSearch: '81999991234',
      customerCpf: '52998224725',
      storeId: 'loja-06',
      capturedByUid: 'demo-user',
      capturedByName: 'Equipe Fascinante',
      capturedAtClient: '2026-10-30T09:00:00-03:00',
      appointmentDate: '2099-11-05',
      appointmentTime: '08:20',
      appointmentAttendance: 'pending',
      appointmentServiceName: 'Exame de vista',
      syncState: 'demo'
    }]));
  });
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Nova abordagem/ }).first().click();

  const cpf = page.getByLabel('CPF', { exact: true });
  await cpf.fill('52998224725');
  await expect(page.locator('[data-cpf-appointment-status]')).toHaveText('Já existe um agendamento ativo vinculado a este CPF.');

  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  const confirmation = page.getByRole('dialog', { name: 'CPF já possui agendamento' });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('Deseja realmente continuar e criar outro agendamento?');
  await page.screenshot({ path: testInfo.outputPath('duplicate-cpf-appointment-warning.png'), fullPage: true });
  await confirmation.getByRole('button', { name: 'Voltar e revisar' }).click();
  await expect(cpf).toHaveValue('529.982.247-25');
});

test('searches whether a client already has an appointment', async ({ page }, testInfo) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleErrors.push(message.text());
  });
  await page.evaluate(() => {
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify([
      {
        id: 'search-scheduled',
        fullName: 'Maria Agendada',
        phoneSearch: '81999991234',
        customerCpf: '52998224725',
        storeId: 'loja-06',
        capturedByUid: 'demo-user',
        capturedByName: 'Equipe Fascinante',
        capturedAtClient: '2026-10-30T09:00:00-03:00',
        appointmentDate: '2026-11-05',
        appointmentTime: '08:20',
        appointmentServiceName: 'Exame de vista',
        syncState: 'demo'
      },
      {
        id: 'search-unscheduled',
        fullName: 'Mariana Sem Agenda',
        phoneSearch: '81988887777',
        customerCpf: '12345678909',
        storeId: 'loja-06',
        capturedByUid: 'outro-captor',
        capturedByName: 'Outro colaborador',
        capturedAtClient: '2026-10-30T08:00:00-03:00',
        appointmentDate: '',
        appointmentTime: '',
        syncState: 'demo'
      }
    ]));
  });
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();

  const navigation = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(navigation.getByRole('button', { name: 'Pesquisa' })).toBeVisible();
  await navigation.getByRole('button', { name: 'Pesquisa' }).click();
  await expect(page.getByRole('heading', { name: 'Pesquisa' })).toBeVisible();

  await page.getByLabel('Nome ou CPF').fill('maria');
  await page.getByRole('button', { name: 'Pesquisar' }).click();
  await expect(page.getByText('Agendado', { exact: true })).toBeVisible();
  await expect(page.getByText('Sem agendamento', { exact: true })).toBeVisible();
  await expect(page.getByText(/05 de novembro às 08:20/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir cadastro de Maria Agendada' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir cadastro de Mariana Sem Agenda' })).toHaveCount(0);
  await page.getByLabel('Nome ou CPF').fill('529.982.247-25');
  await page.getByRole('button', { name: 'Pesquisar' }).click();
  await expect(page.getByText('1 resultado encontrado')).toBeVisible();
  await expect(page.getByText('CPF 529.982.247-25')).toBeVisible();
  await expect(page.getByText('Mariana Sem Agenda')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('lead-appointment-search.png'), fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test('keeps the header fixed while wide pages and Kanban use their intended widths', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'manager'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();

  const homeLayout = await page.evaluate(() => ({
    headerWidth: document.querySelector('.header-inner').getBoundingClientRect().width,
    contentWidth: document.querySelector('.app-main').getBoundingClientRect().width
  }));

  await page.getByRole('button', { name: /Painel de gest/ }).click();
  await expect(page.getByRole('heading', { name: 'Painel de leads' })).toBeVisible();
  const managementLayout = await page.evaluate(() => ({
    headerWidth: document.querySelector('.header-inner').getBoundingClientRect().width,
    contentWidth: document.querySelector('.app-main').getBoundingClientRect().width
  }));

  expect(homeLayout.headerWidth).toBeCloseTo(managementLayout.headerWidth, 0);
  expect(homeLayout.headerWidth).toBeCloseTo(1180, 0);
  expect(homeLayout.contentWidth).toBeCloseTo(760, 0);
  expect(managementLayout.contentWidth).toBeCloseTo(1180, 0);

  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kanban de leads' })).toBeVisible();
  const kanbanLayout = await page.evaluate(() => {
    const main = document.querySelector('.app-main').getBoundingClientRect();
    const board = document.querySelector('.kanban-board').getBoundingClientRect();
    const dock = document.querySelector('.kanban-scrollbar-dock').getBoundingClientRect();
    return {
      mainWidth: main.width,
      boardLeft: board.left,
      boardRight: board.right,
      dockWidth: dock.width
    };
  });

  expect(kanbanLayout.mainWidth).toBeCloseTo(1440, 0);
  expect(kanbanLayout.boardLeft).toBeCloseTo(20, 0);
  expect(kanbanLayout.boardRight).toBeCloseTo(1420, 0);
  expect(kanbanLayout.dockWidth).toBeCloseTo(1440, 0);
  await page.screenshot({ path: testInfo.outputPath('kanban-full-width.png'), fullPage: false });
});

test('keeps the full-width Kanban contained on compact screens', async ({ page }, testInfo) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'manager'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Painel de gest/ }).click();
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kanban de leads' })).toBeVisible();

  const layout = await page.evaluate(() => {
    const main = document.querySelector('.app-main').getBoundingClientRect();
    const board = document.querySelector('.kanban-board').getBoundingClientRect();
    const dock = document.querySelector('.kanban-scrollbar-dock').getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      mainWidth: main.width,
      boardLeft: board.left,
      boardRight: board.right,
      dockWidth: dock.width
    };
  });

  expect(layout.mainWidth).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.documentWidth).toBe(layout.viewportWidth);
  expect(layout.boardLeft).toBeGreaterThanOrEqual(15);
  expect(layout.boardRight).toBeLessThanOrEqual(layout.viewportWidth - 15);
  expect(layout.dockWidth).toBeCloseTo(layout.viewportWidth, 0);
  await page.screenshot({ path: testInfo.outputPath('kanban-compact-width.png'), fullPage: false });
});

test('shows only menus allowed for the front desk profile', async ({ page }, testInfo) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'receptionist'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();

  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();
  await expect(page.getByLabel('Lojas: Loja 06')).toHaveText(/Loja 06/);
  await expect(page.locator('.profile-card').getByText('Atendente Balcão', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Nova abordagem/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Meus cadastros/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Agenda de exames/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Confirmações/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Retornos da equipe/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Retornos pendentes/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Painel de gestão/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Metas/ })).toHaveCount(0);

  const navigation = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(navigation.getByRole('button', { name: 'Gestão' })).toHaveCount(0);
  await expect(navigation.getByRole('button', { name: 'Retornos' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('receptionist-home-menus.png'), fullPage: true });

  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await expect(page.getByRole('heading', { name: 'Agenda de exames' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo agendamento' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Voltar ao início' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('receptionist-permitted-menus.png'), fullPage: true });

  await page.goto('/#/management');
  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();
  await expect(page.getByText('Seu perfil não possui acesso aos dados gerenciais.')).toHaveCount(0);
});

test('lists upcoming appointments and prepares the manual WhatsApp reminder', async ({ page }, testInfo) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'receptionist'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  const appointmentDate = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  await page.evaluate(({ appointmentDate }) => {
    const lead = {
      id: 'appointment-confirmation',
      fullName: 'Clara de Teste',
      preferredName: 'Clara',
      phone: '(81) 99999-1234',
      phoneSearch: '81999991234',
      storeId: 'loja-06',
      capturedByUid: 'demo-receptionist',
      appointmentDate,
      appointmentTime: '14:30',
      appointmentAttendance: 'pending',
      careRoute: 'ophthalmologist',
      capturedAtClient: new Date().toISOString()
    };
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify([lead]));
    window.dispatchEvent(new Event('fascinlead:demo-leads'));
  }, { appointmentDate });

  await page.getByRole('button', { name: /Confirma/ }).click();
  await expect(page.getByRole('heading', { name: /Confirma/ })).toBeVisible();
  await expect(page.getByText('Clara de Teste', { exact: true })).toBeVisible();
  await expect(page.getByText('(81) 99999-1234', { exact: true })).toBeVisible();
  const confirmationDays = page.locator('[data-confirmation-days]');
  await expect(confirmationDays).toHaveValue('7');
  await confirmationDays.fill('14');
  await confirmationDays.press('Tab');
  await expect(confirmationDays).toHaveValue('14');
  await page.screenshot({ path: testInfo.outputPath('custom-confirmation-period.png'), fullPage: false });
  await confirmationDays.fill('7');
  await confirmationDays.press('Tab');
  const whatsAppLink = page.getByRole('link', { name: 'Abrir WhatsApp' });
  const href = await whatsAppLink.getAttribute('href');
  const preparedMessage = new URL(href).searchParams.get('text');
  expect(href).toContain('wa.me/5581999991234');
  expect(preparedMessage).toContain('Olá, Clara! Tudo bem? Sou Atendente de Teste, da ConsultVision, parceira das Óticas Fascinante.');
  expect(preparedMessage).toContain('atendimento com o oftalmologista');
  expect(preparedMessage).toContain('às 14:30, na Loja 06 - Surubim.');
  expect(preparedMessage).toContain('Podemos confirmar sua presença?');
  const summary = page.locator('.confirmation-metrics');
  await expect(summary.locator('[data-confirmation-filter="pending"] strong')).toHaveText('1');
  await expect(summary.locator('[data-confirmation-filter="done"] strong')).toHaveText('0');
  await page.getByRole('button', { name: 'Marcar como feito' }).click();
  await expect(page.getByText('Lembrete marcado como feito.')).toBeVisible();
  await expect(summary.locator('[data-confirmation-filter="pending"] strong')).toHaveText('0');
  await expect(summary.locator('[data-confirmation-filter="done"] strong')).toHaveText('1');
  await expect(page.getByText('Clara de Teste', { exact: true })).toHaveCount(0);
  await summary.locator('[data-confirmation-filter="done"]').click();
  await expect(page.getByText('Clara de Teste', { exact: true })).toBeVisible();
  await expect(page.getByText(/Marcado por Atendente de Teste em/)).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByText('Conclusão do lembrete desfeita.')).toBeVisible();
  await expect(summary.locator('[data-confirmation-filter="pending"] strong')).toHaveText('1');
  await expect(summary.locator('[data-confirmation-filter="done"] strong')).toHaveText('0');
  await expect(page.getByText('Clara de Teste', { exact: true })).toHaveCount(0);
  await summary.locator('[data-confirmation-filter="pending"]').click();
  await expect(page.getByText('Clara de Teste', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Marcar como feito' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('manual-whatsapp-confirmations.png'), fullPage: true });
});

test('requires a destination store for a multi-store MEI capture', async ({ page }, testInfo) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'mei'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Nova abordagem/ }).click();

  const store = page.getByLabel('Loja de destino');
  await expect(store).toHaveValue('');
  await expect(store.locator('option')).toHaveCount(5);
  await expect(store.locator('option[value="loja-02"]')).toHaveText('Loja 02 - Surubim');
  await expect(store.locator('option[value="loja-04"]')).toHaveText('Loja 04 - Carpina');
  await expect(store.locator('option[value="loja-05"]')).toHaveText('Loja 05 - Limoeiro');
  await expect(store.locator('option[value="loja-06"]')).toHaveText('Loja 06 - Surubim');
  await expect(page.getByLabel('Data do pré-agendamento')).toBeDisabled();
  await store.selectOption('loja-02');
  await expect(store).toHaveValue('loja-02');
  await expect(page.getByLabel('Serviço do agendamento')).toBeEnabled();
  await expect(page.getByLabel('Data do pré-agendamento')).toBeEnabled();
  const careRoute = page.getByLabel('Encaminhamento');
  await expect(careRoute).toBeVisible();
  await expect(careRoute.locator('option')).toHaveText(['Automático', 'Optometrista', 'Oftalmologista']);
  await careRoute.selectOption('optometrist');
  await expect(careRoute).toHaveValue('optometrist');
  const examPaymentType = page.getByLabel('Tipo do exame');
  const examPaymentMethods = page.getByRole('group', { name: 'Forma de pagamento do exame' });
  const examPrice = page.locator('[data-exam-price]');
  if (testInfo.project.name === 'desktop-chrome') {
    const [routeBox, typeBox, priceBox] = await Promise.all([
      careRoute.boundingBox(),
      examPaymentType.boundingBox(),
      page.locator('.exam-price-display').boundingBox()
    ]);
    expect(Math.abs(routeBox.y - typeBox.y)).toBeLessThan(2);
    expect(Math.abs(routeBox.y - priceBox.y)).toBeLessThan(2);
  } else {
    const billingLayout = await page.locator('.exam-billing-fields').evaluate((element) => {
      const container = element.getBoundingClientRect();
      const route = element.querySelector('[name="careRouteOverride"]').getBoundingClientRect();
      const type = element.querySelector('[name="examPaymentType"]').getBoundingClientRect();
      const price = element.querySelector('.exam-price-display').getBoundingClientRect();
      return {
        routeBottom: route.bottom,
        typeTop: type.top,
        priceTop: price.top,
        priceWidth: price.width,
        priceRight: price.right,
        containerRight: container.right
      };
    });
    expect(billingLayout.typeTop).toBeGreaterThanOrEqual(billingLayout.routeBottom);
    expect(Math.abs(billingLayout.typeTop - billingLayout.priceTop)).toBeLessThan(2);
    expect(billingLayout.priceWidth).toBeGreaterThanOrEqual(123);
    expect(billingLayout.priceRight).toBeLessThanOrEqual(billingLayout.containerRight + 1);
  }
  await expect(examPaymentType).toHaveValue('paid');
  await expect(examPaymentMethods).toBeVisible();
  await expect(examPaymentMethods.getByRole('checkbox')).toHaveCount(6);
  await expect(examPaymentMethods.getByLabel('Boleto')).toHaveCount(0);
  await expect(examPaymentMethods.getByLabel('Carnê')).toBeVisible();
  await examPaymentMethods.getByLabel('Pix').check();
  await examPaymentMethods.getByLabel('Dinheiro').check();
  await expect(examPrice).toHaveText('R$ 150,00');
  await careRoute.selectOption('ophthalmologist');
  await expect(examPrice).toHaveText('R$ 200,00');
  await examPaymentType.selectOption('courtesy');
  await expect(examPrice).toHaveText('R$ 0,00');
  await expect(examPaymentMethods).toBeHidden();
  await examPaymentType.selectOption('paid');
  await expect(examPaymentMethods).toBeVisible();
  await examPaymentMethods.getByLabel('Pix').check();
  await examPaymentMethods.getByLabel('Dinheiro').check();
  await careRoute.selectOption('automatic');
  await page.getByLabel('Nome *').fill('Cliente preservado');
  await page.getByLabel('Telefone ou WhatsApp *').fill('81999991234');
  await page.getByLabel('RG', { exact: true }).fill('1234567');
  await page.getByLabel('CPF', { exact: true }).fill('52998224725');
  await page.getByLabel('Data de nascimento *').fill('1960-04-12');
  await page.getByLabel('Como prefere ser chamado').fill('Cliente');
  await page.getByLabel('Referência do endereço').fill('Ao lado da praça');
  await page.getByLabel('Catarata', { exact: true }).check();
  await page.getByLabel('Já realizou cirurgia nos olhos? *').selectOption('yes');
  await page.getByLabel('Qual cirurgia? *').selectOption('cataract');
  await page.getByLabel('Observação rápida').fill('Manter estas informações');
  const serviceId = await page.getByLabel('Serviço do agendamento').inputValue();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  await page.getByLabel('Data do pré-agendamento').fill(futureDate.toISOString().slice(0, 10));

  await store.selectOption('loja-04');
  await expect(page.getByLabel('Nome *')).toHaveValue('Cliente preservado');
  await expect(page.getByLabel('Telefone ou WhatsApp *')).toHaveValue('(81) 99999-1234');
  await expect(page.getByLabel('RG', { exact: true })).toHaveValue('1234567');
  await expect(page.getByLabel('CPF', { exact: true })).toHaveValue('529.982.247-25');
  await expect(page.getByRole('group', { name: 'Forma de pagamento do exame' }).getByLabel('Pix')).toBeChecked();
  await expect(page.getByRole('group', { name: 'Forma de pagamento do exame' }).getByLabel('Dinheiro')).toBeChecked();
  await expect(page.getByLabel('Data de nascimento *')).toHaveValue('1960-04-12');
  await expect(page.getByLabel('Como prefere ser chamado')).toHaveValue('Cliente');
  await expect(page.getByLabel('Referência do endereço')).toHaveValue('Ao lado da praça');
  await expect(page.getByLabel('Catarata', { exact: true })).toBeChecked();
  await expect(page.getByLabel('Já realizou cirurgia nos olhos? *')).toHaveValue('yes');
  await expect(page.getByLabel('Qual cirurgia? *')).toHaveValue('cataract');
  await expect(page.getByLabel('Observação rápida')).toHaveValue('Manter estas informações');
  await expect(page.getByLabel('Serviço do agendamento')).toHaveValue(serviceId);
  await expect(page.getByLabel('Data do pré-agendamento')).toHaveValue('');
});

test('captures and lists a lead in development mode', async ({ page }, testInfo) => {
  await expect(page.getByRole('heading', { name: 'LeadFlow' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();

  await expect(page.getByRole('heading', { name: 'Início' })).toBeVisible();
  await expect(page.getByLabel('Lojas: Loja 06')).toHaveText(/Loja 06/);
  await page.screenshot({
    path: testInfo.outputPath('home.png'),
    fullPage: true
  });

  await page.getByRole('button', { name: /Nova abordagem/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Cadastro' })).toBeVisible();
  await expect(page.locator('[data-offline-capture-notice]')).toBeHidden();
  await expect(page.getByLabel('RG', { exact: true })).toHaveAttribute('placeholder', '0.000.000');
  const standardContactLayout = await page.locator('#lead-form').evaluate((form) => {
    const phone = form.elements.phone.getBoundingClientRect();
    const rg = form.elements.customerRg.getBoundingClientRect();
    return { viewportWidth: window.innerWidth, phoneTop: phone.top, phoneBottom: phone.bottom, phoneRight: phone.right, rgTop: rg.top, rgLeft: rg.left };
  });
  if (standardContactLayout.viewportWidth > 560) {
    expect(Math.abs(standardContactLayout.phoneTop - standardContactLayout.rgTop)).toBeLessThanOrEqual(2);
    expect(standardContactLayout.rgLeft).toBeGreaterThanOrEqual(standardContactLayout.phoneRight);
  } else {
    expect(standardContactLayout.rgTop).toBeGreaterThanOrEqual(standardContactLayout.phoneBottom);
  }
  const standardPairLayout = await page.locator('#lead-form').evaluate((form) => {
    const interest = form.elements.interestId.getBoundingClientRect();
    const service = form.elements.appointmentServiceId.getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      interestTop: interest.top,
      interestBottom: interest.bottom,
      interestRight: interest.right,
      serviceTop: service.top,
      serviceLeft: service.left
    };
  });
  if (standardPairLayout.viewportWidth > 760) {
    expect(Math.abs(standardPairLayout.interestTop - standardPairLayout.serviceTop)).toBeLessThanOrEqual(2);
    expect(standardPairLayout.serviceLeft).toBeGreaterThanOrEqual(standardPairLayout.interestRight);
  } else {
    expect(standardPairLayout.serviceTop).toBeGreaterThanOrEqual(standardPairLayout.interestBottom);
  }

  await page.getByLabel('Nome *').fill('Cliente Exemplo');
  await page.getByLabel('Telefone ou WhatsApp *').fill('81999991234');
  await page.getByLabel('RG', { exact: true }).fill('12.345.678-X');
  await page.getByLabel('CPF', { exact: true }).fill('52998224725');
  await expect(page.getByLabel('CPF', { exact: true })).toHaveValue('529.982.247-25');
  await expect(page.getByLabel('RG', { exact: true })).toHaveValue('12.345.678-X');
  await page.getByLabel('Data de nascimento').fill('1985-04-12');
  await expect(page.locator('[data-birth-age]')).toHaveText(/\d+ anos/);
  await page.getByLabel('Sexo').selectOption('female');
  await page.getByLabel('Rua', { exact: true }).fill('Rua das Flores');
  await page.getByLabel('Número', { exact: true }).fill('SN');
  await page.getByLabel('Referência do endereço').fill('Próximo à praça central');
  await page.getByLabel('Interesse principal').selectOption('complete-glasses');
  await expect(page.getByRole('group', { name: 'Ametropias' })).toHaveCount(0);
  for (const removedPathology of ['Olho seco', 'Degeneracao macular', 'Descolamento de retina']) {
    await expect(page.getByLabel(removedPathology, { exact: true })).toHaveCount(0);
  }
  await page.getByLabel('Glaucoma').check();
  await page.getByLabel('Diabetes').check();
  await page.getByLabel('Data do pré-agendamento').fill('2026-10-02');
  await page.getByLabel('Horário disponível').selectOption('14:20');
  await page.screenshot({
    path: testInfo.outputPath('new-lead.png'),
    fullPage: true
  });

  await page.getByRole('button', { name: 'Salvar cadastro' }).click();

  await expect(page.getByRole('heading', { name: 'Meus cadastros' })).toBeVisible();
  await expect(page.getByText('Cliente Exemplo')).toBeVisible();
  await expect(page.getByText('Somente neste navegador', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Ver cadastro de Cliente Exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Cliente Exemplo', level: 2 })).toBeVisible();
  await expect(page.getByLabel('Data do pré-agendamento')).toHaveValue('2026-10-02');
  await expect(page.getByLabel('Horário')).toHaveValue('14:20');
  await expect(page.getByLabel('CPF', { exact: true })).toHaveValue('529.982.247-25');
  await expect(page.getByLabel('Data de nascimento')).toHaveValue('1985-04-12');
  await expect(page.locator('[data-birth-age]')).toHaveText(/\d+ anos/);
  await expect(page.getByLabel('Sexo')).toHaveValue('female');
  await expect(page.getByLabel('Rua', { exact: true })).toHaveValue('Rua das Flores');
  await expect(page.getByLabel('Número', { exact: true })).toHaveValue('S/N');
  await expect(page.getByLabel('Referência do endereço')).toHaveValue('Próximo à praça central');
  await expect(page.getByRole('group', { name: 'Ametropias' })).toHaveCount(0);
  await expect(page.getByLabel('Glaucoma')).toBeChecked();
  await expect(page.getByLabel('Diabetes')).toBeChecked();
  const pathologies = page.getByRole('group', { name: 'Patologias e condições de saúde' });
  await pathologies.getByLabel('Não possui').check();
  await expect(page.getByLabel('Glaucoma')).not.toBeChecked();
  await expect(page.getByLabel('Diabetes')).not.toBeChecked();
  await page.screenshot({
    path: testInfo.outputPath('lead-details.png'),
    fullPage: true
  });
  await page.getByLabel('Nome *').fill('Cliente Corrigido');
  await page.getByLabel('Observação rápida').fill('Prefere contato pela tarde');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page.getByRole('heading', { name: 'Meus cadastros' })).toBeVisible();
  await expect(page.getByText('Cliente Corrigido')).toBeVisible();
});

test('keeps the mobile form filled and explains why a registration was not saved', async ({ page }) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Nova abordagem/ }).first().click();
  await page.getByLabel('Loja de destino').selectOption('loja-06');
  await page.getByLabel('Nome *').fill('Cliente Mobile');
  await page.getByLabel('Telefone ou WhatsApp *').fill('81999991234');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();

  await expect(page.getByRole('status')).toContainText('Revise os campos destacados');
  await expect(page.getByLabel('Nome *')).toHaveValue('Cliente Mobile');
  await expect(page.getByLabel('Telefone ou WhatsApp *')).toHaveValue('(81) 99999-1234');
  await expect(page.getByLabel('Data de nascimento *')).toBeFocused();

  await page.getByLabel('Data de nascimento *').fill('1985-04-12');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByRole('heading', { name: 'Meus cadastros' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Cadastro salvo');
  await expect(page.getByText('Cliente Mobile')).toBeVisible();
});

test('allows completing the service and scheduling a synchronized offline registration', async ({ page }) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'receptionist'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.evaluate(() => {
    const lead = {
      id: 'synced-offline-without-service',
      fullName: 'Cliente Sincronizado',
      preferredName: '',
      phone: '+5581999991234',
      phoneSearch: '81999991234',
      customerCpf: '',
      customerRg: '',
      birthDate: '1985-04-12',
      sex: '',
      street: '',
      streetNumber: '',
      neighborhood: '',
      city: '',
      state: 'PE',
      interestId: 'eye-exam',
      interestLabel: 'Exame de vista',
      ametropiaIds: [],
      pathologyIds: [],
      eyeSurgeryStatus: '',
      eyeSurgeryType: '',
      eyeSurgeryDetails: '',
      careRoute: 'optometrist',
      careRouteOverride: 'optometrist',
      careRouteReasons: [],
      examPaymentType: 'paid',
      needsTransport: false,
      hasCompanion: false,
      transportSeats: 0,
      appointmentDate: '',
      appointmentTime: '',
      appointmentSchedulingMode: 'controlled',
      appointmentDurationMinutes: 20,
      notes: '',
      source: 'street',
      capturedAtClient: new Date().toISOString(),
      capturedByUid: 'demo-receptionist',
      capturedByName: 'Atendente de Teste',
      storeId: 'loja-06',
      installationId: 'test-installation',
      appVersion: '0.1.0',
      schemaVersion: 1,
      syncState: 'synced',
      fromCache: false
    };
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify([lead]));
    window.dispatchEvent(new Event('fascinlead:demo-leads'));
  });

  await page.getByRole('button', { name: 'Cadastros', exact: true }).click();
  await page.getByRole('button', { name: 'Ver cadastro de Cliente Sincronizado' }).click();
  const service = page.getByLabel('Serviço do agendamento');
  await expect(service).toBeVisible();
  await expect(service).toBeEnabled();
  await expect(service).not.toHaveValue('');

  const scheduleDate = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 10);
  });
  await page.getByLabel('Data do pré-agendamento').fill(scheduleDate);
  const time = page.getByLabel('Horário disponível');
  await expect(time).toBeEnabled();
  await time.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page.getByRole('heading', { name: 'Meus cadastros' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText(/Cadastro atualizado neste navegador|Agendamento salvo com sucesso/);
  await page.getByRole('button', { name: 'Ver cadastro de Cliente Sincronizado' }).click();
  await expect(page.getByLabel('Serviço do agendamento')).not.toHaveValue('');
  await expect(page.getByLabel('Data do pré-agendamento')).toHaveValue(scheduleDate);
});

test('blocks new offline registrations while the store feature is disabled', async ({ page }) => {
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.context().setOffline(true);
  await page.getByRole('button', { name: /Nova abordagem/ }).click();

  await expect(page.getByText('Cadastro offline desativado', { exact: true })).toBeVisible();
  await expect(page.locator('#lead-form')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sync', exact: true })).toHaveCount(0);

  await page.context().setOffline(false);
});

test('shows lead deletion below save wherever an authorized user opens the details', async ({ page }) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Nova abordagem/ }).first().click();
  await page.getByLabel('Loja de destino').selectOption('loja-06');
  await page.getByLabel('Nome *').fill('Lead com exclusão');
  await page.getByLabel('Telefone ou WhatsApp *').fill('81999991234');
  await page.getByLabel('Data de nascimento').fill('1985-04-12');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await page.getByRole('button', { name: 'Ver cadastro de Lead com exclusão' }).click();

  const saveButton = page.getByRole('button', { name: 'Salvar alterações' });
  const deleteButton = page.getByRole('button', { name: 'Excluir lead', exact: true });
  await expect(deleteButton).toBeVisible();
  const positions = await Promise.all([
    saveButton.evaluate((element) => element.getBoundingClientRect().top),
    deleteButton.evaluate((element) => element.getBoundingClientRect().top)
  ]);
  expect(positions[1]).toBeGreaterThan(positions[0]);
});

test('routes cataract clients to configured ophthalmology days', async ({ page }, testInfo) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Nova abordagem/ }).first().click();
  await page.getByLabel('Loja de destino').selectOption('loja-06');

  await page.getByLabel('Data de nascimento').fill('1960-01-01');
  await expect(page.getByLabel('Já realizou cirurgia nos olhos? *')).toBeVisible();
  await expect(page.getByLabel('Qual cirurgia? *')).toBeVisible();
  await expect(page.getByLabel('Qual cirurgia? *')).toBeDisabled();
  await page.getByLabel('Já realizou cirurgia nos olhos? *').selectOption('yes');
  await expect(page.getByLabel('Qual cirurgia? *')).toBeEnabled();
  await page.getByLabel('Qual cirurgia? *').selectOption('cataract');
  await page.getByLabel('Catarata', { exact: true }).check();
  await expect(page.getByText('Encaminhamento para oftalmologista. A agenda mostrará somente os dias configurados.')).toBeVisible();

  await page.getByLabel('Data do pré-agendamento').fill('2026-10-22');
  await expect(page.getByLabel('Horário disponível')).toBeDisabled();
  await expect(page.getByText('O oftalmologista não atende neste dia.')).toBeVisible();

  await page.getByLabel('Data do pré-agendamento').fill('2026-10-24');
  const timeSelect = page.getByLabel('Horário disponível');
  await expect(timeSelect).toBeEnabled();
  await expect(timeSelect.locator('option[value="08:00"]')).toHaveCount(1);
  await expect(timeSelect.locator('option[value="11:40"]')).toHaveCount(1);
  await expect(timeSelect.locator('option[value="12:00"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('ophthalmology-triage.png'), fullPage: true });
});

test('opens the personal goals screen on mobile and desktop', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Metas/ }).click();

  await expect(page.getByRole('heading', { name: 'Metas', exact: true })).toBeVisible();
  await expect(page.getByText('Minhas metas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Atualizar' })).toHaveCount(0);
  await expect(page.getByText('Nenhuma meta cadastrada')).toBeVisible();
  const personalOrder = await page.evaluate(() => ({
    goalsTop: document.querySelector('.goals-results').getBoundingClientRect().top,
    metricsTop: document.querySelector('.goal-metrics').getBoundingClientRect().top
  }));
  expect(personalOrder.metricsTop).toBeLessThan(personalOrder.goalsTop);
  await page.screenshot({ path: testInfo.outputPath('goals.png'), fullPage: true });

  await page.locator('.goals-results').evaluate((element) => {
    element.insertAdjacentHTML('beforebegin', `<fieldset class="goal-members field">
      <legend>Colaboradores <span>1 selecionado</span></legend>
      <div class="goal-member-list"><label class="goal-member-option">
        <input type="checkbox" checked />
        <span class="avatar">GB</span>
        <span><strong>Gabriel Barbosa</strong><small>Loja 06</small></span>
      </label></div>
    </fieldset>`);
  });
  await expect(page.locator('.goal-member-option')).toHaveCSS('display', 'grid');
  await expect(page.locator('.goal-member-option > span').last()).toHaveCSS('color', 'rgb(20, 32, 51)');
  await page.locator('.goals-results').evaluate((element) => {
    element.insertAdjacentHTML('beforeend', `<div class="goal-person">
      <span class="avatar">GG</span>
      <div><strong>Gabriel Gomes Barbosa</strong><span>Loja 02</span></div>
    </div>`);
  });
  await expect(page.locator('.goal-person .avatar')).toHaveCSS('display', 'grid');
  await expect(page.locator('.goal-person .avatar')).toHaveCSS('align-items', 'center');
  await expect(page.locator('.goal-person .avatar')).toHaveCSS('justify-items', 'center');
  await page.screenshot({ path: testInfo.outputPath('goals-member-layout.png'), fullPage: true });
});

test('opens goal creation in a modal from the goals heading', async ({ page }, testInfo) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Metas/ }).click();

  const newGoalButton = page.getByRole('button', { name: 'Nova meta' });
  await expect(newGoalButton).toBeVisible();
  await expect(page.locator('#goal-form')).toHaveCount(0);
  const headingLayout = await page.locator('.goals-heading').evaluate((heading) => {
    const title = heading.querySelector('h2').getBoundingClientRect();
    const button = heading.querySelector('[data-goal-new]').getBoundingClientRect();
    return { viewportWidth: window.innerWidth, titleRight: title.right, buttonLeft: button.left };
  });
  if (headingLayout.viewportWidth > 440) expect(headingLayout.buttonLeft).toBeGreaterThan(headingLayout.titleRight);

  await newGoalButton.click();
  const dialog = page.getByRole('dialog', { name: 'Nova meta' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Título')).toHaveValue('Meta de captações');
  await expect(dialog.getByLabel('Quantidade')).toHaveValue('20');
  await expect(dialog.getByLabel('Início')).toBeVisible();
  await expect(dialog.getByLabel('Fim')).toBeVisible();
  await expect(dialog.getByLabel('Loja')).toBeVisible();
  await expect(dialog.getByRole('group', { name: /Colaboradores/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('new-goal-dialog.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).not.toBeVisible();
});

test('configures multiple permitted stores for a manager access', async ({ page }, testInfo) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await expect(page.getByLabel('Lojas: Todas as unidades')).toHaveText(/Todas/);
  await page.getByRole('button', { name: /Acessos da equipe/ }).click();

  await page.getByRole('button', { name: 'Novo acesso' }).click();
  await expect(page.getByRole('dialog', { name: 'Novo acesso' })).toBeVisible();
  await expect(page.getByLabel('Nome')).toBeVisible();
  await expect(page.getByLabel('E-mail')).toBeVisible();
  await expect(page.getByLabel('Senha inicial')).toBeVisible();
  await expect(page.getByLabel('Senha inicial')).toHaveValue('mudar123');
  await expect(page.getByLabel('Senha inicial')).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('Telefone')).toBeVisible();
  await expect(page.getByLabel('Código SavWin')).toBeVisible();
  await page.getByLabel('Perfil / cargo').selectOption('system-admin');
  await expect(page.getByLabel('Senha inicial')).toHaveValue('');
  await expect(page.getByLabel('Senha inicial')).not.toHaveAttribute('readonly', '');
  await page.getByLabel('Perfil / cargo').selectOption('system-manager');
  await expect(page.getByLabel('Senha inicial')).toHaveValue('mudar123');
  await expect(page.getByLabel('Senha inicial')).toHaveAttribute('readonly', '');
  await expect(page.getByText('Unidades permitidas', { exact: true })).toBeVisible();
  await page.getByLabel('Loja 02').check();
  await page.getByLabel('Loja 06').check();
  await expect(page.getByLabel('Loja 02')).toBeChecked();
  await expect(page.getByLabel('Loja 06')).toBeChecked();
  await page.getByLabel('Loja 02').uncheck();
  await expect(page.getByLabel('Unidade principal')).toHaveValue('loja-06');
  await expect(page.getByLabel('Loja 02')).not.toBeChecked();
  await expect(page.getByLabel('Loja 06')).toBeChecked();
  await page.getByLabel('Perfil / cargo').selectOption('system-mei');
  await expect(page.getByLabel('Unidade principal')).toBeHidden();
  await expect(page.getByText('Unidades permitidas', { exact: true })).toBeVisible();
  for (const store of ['Loja 02', 'Loja 04', 'Loja 05', 'Loja 06']) {
    await expect(page.getByLabel(store)).toBeChecked();
  }
  await page.screenshot({ path: testInfo.outputPath('access-store-picker.png'), fullPage: true });
});

test('keeps management actions and filters organized at intermediate widths', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Uses a controlled intermediate desktop viewport.');
  await page.setViewportSize({ width: 1120, height: 820 });
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Painel de gestão/ }).click();
  await expect(page.getByRole('heading', { name: 'Painel de leads' })).toBeVisible();
  await page.getByLabel('Nome ou telefone').pressSequentially('pedro');
  await expect(page.getByLabel('Nome ou telefone')).toHaveValue('pedro');

  const layout = await page.evaluate(() => {
    const heading = document.querySelector('.management-dashboard-heading').getBoundingClientRect();
    const actions = document.querySelector('.management-heading-actions').getBoundingClientRect();
    const filter = document.querySelector('.management-filters').getBoundingClientRect();
    const search = document.querySelector('.management-search-field').getBoundingClientRect();
    const filterButton = document.querySelector('.management-filter-button').getBoundingClientRect();
    const actionButtons = [...document.querySelectorAll('.management-heading-actions .button')]
      .map((button) => button.getBoundingClientRect());
    const metricCards = [...document.querySelectorAll('.management-metrics > div')]
      .map((card) => {
        const cardRect = card.getBoundingClientRect();
        const labelRect = card.querySelector('span').getBoundingClientRect();
        const valueRect = card.querySelector('strong').getBoundingClientRect();
        const iconRect = card.querySelector('svg').getBoundingClientRect();
        const contentCenter = (labelRect.top + valueRect.bottom) / 2;
        return {
          cardCenter: cardRect.top + cardRect.height / 2,
          contentCenter,
          iconCenter: iconRect.top + iconRect.height / 2
        };
      });
    return {
      headingRight: heading.right,
      actionsTop: actions.top,
      headingTop: heading.top,
      filterRight: filter.right,
      searchWidth: search.width,
      filterButtonWidth: filterButton.width,
      actionButtonsRight: Math.max(...actionButtons.map((button) => button.right)),
      actionRows: new Set(actionButtons.map((button) => Math.round(button.top))).size,
      metricCards
    };
  });

  expect(layout.actionsTop).toBeGreaterThanOrEqual(layout.headingTop);
  expect(layout.actionButtonsRight).toBeLessThanOrEqual(layout.headingRight + 1);
  expect(layout.actionRows).toBe(2);
  expect(layout.searchWidth).toBeGreaterThan(layout.filterButtonWidth * 2);
  expect(layout.filterButtonWidth).toBeGreaterThanOrEqual(160);
  expect(layout.filterRight).toBeLessThanOrEqual(1120);
  for (const metric of layout.metricCards) {
    expect(Math.abs(metric.contentCenter - metric.cardCenter)).toBeLessThanOrEqual(2);
    expect(Math.abs(metric.iconCenter - metric.contentCenter)).toBeLessThanOrEqual(2);
  }
  await page.screenshot({ path: testInfo.outputPath('management-responsive.png'), fullPage: true });
});

test('hides disabled ametropias in management details without erasing saved values', async ({ page }) => {
  await page.evaluate(() => {
    sessionStorage.setItem('fascinlead:demo-role', 'admin');
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify([{
      id: 'management-hidden-ametropia',
      fullName: 'Cliente com ametropia oculta',
      preferredName: '',
      phone: '+5581999993333',
      phoneSearch: '81999993333',
      customerCpf: '',
      birthDate: '',
      sex: '',
      street: '',
      streetNumber: '',
      neighborhood: '',
      city: '',
      state: 'PE',
      interestId: '',
      interestLabel: '',
      ametropiaIds: ['myopia'],
      ametropiaLabels: ['Miopia'],
      pathologyIds: [],
      pathologyLabels: [],
      appointmentDate: '',
      appointmentTime: '',
      appointmentSchedulingMode: 'free',
      appointmentDurationMinutes: 20,
      notes: '',
      capturedAtClient: new Date().toISOString(),
      capturedByUid: 'demo-admin',
      capturedByName: 'Administrador',
      storeId: 'loja-06',
      syncState: 'demo'
    }]));
  });

  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Painel de gestão/ }).click();
  await page.getByRole('button', { name: /Cliente com ametropia oculta/ }).click();

  await expect(page.getByRole('heading', { name: 'Cliente com ametropia oculta', level: 2 })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Ametropias' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Patologias e condições de saúde' })).toBeVisible();
  await page.getByLabel('Observação rápida').fill('Cadastro revisado pela gestão');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  const savedAmetropias = await page.evaluate(() => JSON.parse(localStorage.getItem('fascinlead:demo-leads'))[0].ametropiaIds);
  expect(savedAmetropias).toEqual(['myopia']);
});

test('shows the management dashboard grouped by store and captor', async ({ page }, testInfo) => {
  const capturedAtClient = new Date().toISOString();
  const consoleIssues = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') consoleIssues.push(message.text());
  });
  page.on('pageerror', (error) => consoleIssues.push(error.message));
  let savwinRequest = null;
  await page.route('**/api/savwin/products-by-os', async (route) => {
    savwinRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, count: 4, osCount: 2, records: [] })
    });
  });
  await page.evaluate(({ capturedAtClient }) => {
    sessionStorage.setItem('fascinlead:demo-role', 'admin');
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify([
      {
        id: 'report-attended',
        fullName: 'Cliente Presente',
        phoneSearch: '81999991111',
        capturedAtClient,
        capturedByUid: 'captor-06',
        capturedByName: 'Captador Loja 06',
        storeId: 'loja-06',
        appointmentDate: capturedAtClient.slice(0, 10),
        appointmentTime: '08:00',
        appointmentAttendance: 'attended',
        careRoute: 'ophthalmologist',
        examPaymentType: 'paid',
        needsTransport: true,
        transportSeats: 2,
        hasCompanion: true,
        birthDate: '1960-10-20',
        pathologyIds: ['cataract', 'retinopathy'],
        interestId: 'complete-glasses',
        syncState: 'demo'
      },
      {
        id: 'report-missed',
        fullName: 'Cliente Ausente',
        phoneSearch: '81999992222',
        capturedAtClient,
        capturedByUid: 'captor-06',
        capturedByName: 'Captador Loja 06',
        storeId: 'loja-06',
        appointmentDate: capturedAtClient.slice(0, 10),
        appointmentTime: '09:00',
        appointmentAttendance: 'missed',
        careRoute: 'optometrist',
        examPaymentType: 'courtesy',
        needsTransport: false,
        birthDate: '1980-01-01',
        pathologyIds: ['glaucoma'],
        interestId: 'frames',
        syncState: 'demo'
      },
      {
        id: 'report-unscheduled',
        fullName: 'Cliente Sem Agenda',
        phoneSearch: '81999993333',
        capturedAtClient,
        capturedByUid: 'captor-02',
        capturedByName: 'Captador Loja 02',
        storeId: 'loja-02',
        appointmentDate: '',
        appointmentTime: '',
        appointmentAttendance: 'pending',
        careRoute: 'ophthalmologist',
        examPaymentType: 'courtesy',
        needsTransport: true,
        hasCompanion: false,
        birthDate: '2000-01-01',
        pathologyIds: ['diabetes'],
        interestId: 'complete-glasses',
        syncState: 'demo'
      }
    ]));
  }, { capturedAtClient });

  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Painel de gest/ }).click();
  const reportDate = capturedAtClient.slice(0, 10);
  await page.getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const dashboardMetrics = page.getByRole('region', { name: 'Indicadores do dashboard' });
  await expect(dashboardMetrics.locator(':scope > div > strong')).toHaveText(['3', '2', '1', '67%', '2', '2', '1', '2']);
  await expect(page.getByRole('heading', { name: 'Cadastros por dia' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agendamentos por dia da semana' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agendamentos por horário' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Situação dos agendamentos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Optometrista x Oftalmologista' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Principais patologias' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Faixas etárias' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Transporte por dia' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Interesses principais' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pagos x gratuitos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Desempenho por unidade' })).toBeVisible();
  const unitPerformance = page.locator('article.dashboard-panel', { has: page.getByRole('heading', { name: 'Desempenho por unidade' }) });
  await expect(unitPerformance.getByRole('columnheader')).toHaveText(['Nome', 'Cadastros', 'Agendados', 'Compareceram', 'Faltaram', 'Taxa']);
  await expect(unitPerformance.getByText('Loja 02', { exact: true })).toBeVisible();
  await expect(unitPerformance.getByText('Loja 06', { exact: true })).toBeVisible();
  await page.locator('#dashboard-store').selectOption('loja-06');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(dashboardMetrics.locator(':scope > div > strong')).toHaveText(['2', '2', '0', '100%', '1', '2', '1', '1']);
  await expect(unitPerformance.getByText('Loja 02', { exact: true })).toBeVisible();
  await expect(unitPerformance.getByText('Loja 06', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ranking de captadores' })).toBeVisible();
  const rankingButton = page.getByRole('button', { name: 'Ver ranking completo' });
  await expect(rankingButton.locator('svg.lucide-trophy')).toBeVisible();
  await rankingButton.click();
  const rankingDialog = page.getByRole('dialog', { name: 'Ranking completo' });
  await expect(rankingDialog).toBeVisible();
  const firstRankingRow = rankingDialog.locator('.dashboard-ranking-dialog-row').first();
  await expect(firstRankingRow.locator('dt')).toHaveText(['Cadastros', 'Agendados', 'Compareceram', 'Faltaram', 'Taxa']);
  await expect(firstRankingRow.locator('dd')).toHaveText(['2', '2', '1', '1', '50%']);
  const populatedRankingHeight = await rankingDialog.evaluate((dialog) => dialog.getBoundingClientRect().height);
  await rankingDialog.screenshot({ path: testInfo.outputPath('dashboard-ranking.png') });
  await rankingDialog.getByLabel('Loja').selectOption('loja-04');
  await expect(page.getByText('Nenhum captador encontrado')).toBeVisible();
  const emptyRankingHeight = await rankingDialog.evaluate((dialog) => dialog.getBoundingClientRect().height);
  expect(Math.abs(populatedRankingHeight - emptyRankingHeight)).toBeLessThanOrEqual(1);
  await rankingDialog.getByRole('button', { name: 'Fechar ranking' }).click();
  await expect(page.getByRole('heading', { name: 'Resultados por captador' })).toHaveCount(0);
  await expect(page.getByText('50% dos agendamentos')).toHaveCount(2);
  await page.getByLabel('Data inicial').fill(reportDate);
  await page.getByLabel('Data final').fill(reportDate);
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page.getByLabel('Data inicial')).toHaveValue(reportDate);
  await expect(page.getByLabel('Data final')).toHaveValue(reportDate);
  await expect(dashboardMetrics.locator(':scope > div > strong')).toHaveText(['2', '2', '0', '100%', '1', '2', '1', '1']);
  await page.getByRole('button', { name: 'Consultar SavWin' }).click();
  await expect(page.getByText('SavWin conectado localmente')).toBeVisible();
  await expect(page.getByText('4 item(ns) encontrados em 2 OS no período.')).toBeVisible();
  expect(savwinRequest.storeCodes).toEqual(['6']);
  expect(savwinRequest.startDate).toBe(reportDate);
  expect(savwinRequest.endDate).toBe(reportDate);
  expect(consoleIssues).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
});

test('groups appointments by day and registers attendance', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00-03:00'));
  await page.reload();
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await expect(page.getByText('Nenhum exame neste dia')).toBeVisible();
  const toolbarAlignment = await page.locator('.calendar-toolbar-actions').evaluate((toolbar) => {
    const store = toolbar.querySelector('select')?.getBoundingClientRect();
    const today = toolbar.querySelector('.calendar-today').getBoundingClientRect();
    return store ? {
      topDifference: Math.abs(store.top - today.top),
      bottomDifference: Math.abs(store.bottom - today.bottom)
    } : null;
  });
  if (toolbarAlignment) {
    expect(toolbarAlignment.topDifference).toBeLessThanOrEqual(1);
    expect(toolbarAlignment.bottomDifference).toBeLessThanOrEqual(1);
  }

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const appointmentDate = `${now.getFullYear()}-${month}-19`;
  const nextDate = `${now.getFullYear()}-${month}-20`;

  async function createAppointment(name, date, time) {
    await page.getByRole('button', { name: 'Novo', exact: true }).click();
    await page.getByLabel('Loja de destino').selectOption('loja-06');
    await page.getByLabel('Nome *').fill(name);
    await page.getByLabel('Telefone ou WhatsApp *').fill('81999991234');
    await page.getByLabel('Data de nascimento *').fill('1985-04-12');
    await page.getByLabel('Data do pré-agendamento').fill(date);
    await page.getByLabel('Horário disponível').selectOption(time);
    await page.getByRole('button', { name: 'Salvar cadastro' }).click();
    await expect(page.getByRole('heading', { name: 'Meus cadastros' })).toBeVisible();
  }

  await createAppointment('Cliente Agenda A', appointmentDate, '08:20');
  await createAppointment('Cliente Agenda B', appointmentDate, '10:00');
  await createAppointment('Cliente Outro Dia', nextDate, '09:00');

  await page.getByRole('button', { name: 'Início', exact: true }).click();
  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  const selectedDay = page.locator(`[data-appointment-date="${appointmentDate}"]`);
  await expect(selectedDay).toContainText('2 exames');
  await selectedDay.click();
  await expect(page.getByText('Cliente Agenda A', { exact: true })).toBeVisible();
  await expect(page.getByText('Cliente Agenda B', { exact: true })).toBeVisible();
  await expect(page.getByText('Cliente Outro Dia', { exact: true })).not.toBeVisible();

  await page.getByRole('button', { name: 'Novo agendamento' }).click();
  const appointmentDialog = page.getByRole('dialog', { name: 'Novo agendamento' });
  await expect(appointmentDialog).toBeVisible();
  await expect(appointmentDialog.getByLabel('Horário disponível').locator('option[value="08:20"]')).toHaveCount(0);
  await appointmentDialog.getByLabel('Nome *').fill('Cliente Direto Agenda');
  await appointmentDialog.getByLabel('Telefone ou WhatsApp *').fill('81988887777');
  await appointmentDialog.getByLabel('Data de nascimento *').fill('1985-04-12');
  await appointmentDialog.getByLabel('Horário disponível').selectOption('08:40');
  await page.screenshot({ path: testInfo.outputPath('appointment-create-modal.png'), fullPage: true });
  await appointmentDialog.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(appointmentDialog).not.toBeVisible();
  await expect(selectedDay).toContainText('3 exames');
  await expect(page.getByText('Cliente Direto Agenda', { exact: true })).toBeVisible();

  const attendance = page.getByRole('group', { name: 'Comparecimento de Cliente Agenda A' });
  await attendance.getByRole('button', { name: 'Compareceu', exact: true }).click();
  await expect(attendance.getByRole('button', { name: 'Compareceu', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Comparecimento registrado.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('appointments-attendance.png'), fullPage: true });

  await page.getByRole('button', { name: 'Início', exact: true }).click();
  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await page.locator(`[data-appointment-date="${appointmentDate}"]`).click();
  const persistedAttendance = page.getByRole('group', { name: 'Comparecimento de Cliente Agenda A' });
  await expect(persistedAttendance.getByRole('button', { name: 'Compareceu', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('keeps a long appointment list inside the calendar height', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Desktop sidebar uses its own scroll área.');

  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const appointmentDate = `${now.getFullYear()}-${month}-18`;
  await page.evaluate(({ appointmentDate }) => {
    const leads = Array.from({ length: 14 }, (_, index) => ({
      id: `appointment-scroll-${index}`,
      fullName: `Cliente Agenda ${index + 1}`,
      preferredName: '',
      phoneSearch: `8199999${String(index).padStart(4, '0')}`,
      appointmentDate,
      appointmentTime: `${String(8 + Math.floor(index / 3)).padStart(2, '0')}:${String((index % 3) * 20).padStart(2, '0')}`,
      appointmentAttendance: 'pending',
      capturedByName: 'Gestor de Teste',
      capturedByUid: 'demo-admin',
      storeId: 'loja-06',
      syncState: 'demo'
    }));
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify(leads));
    window.dispatchEvent(new Event('fascinlead:demo-leads'));
  }, { appointmentDate });

  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await page.locator(`[data-appointment-date="${appointmentDate}"]`).click();
  await expect(page.locator('.appointment-item')).toHaveCount(14);

  const layout = await page.evaluate(() => {
    const calendar = document.querySelector('.calendar-panel').getBoundingClientRect();
    const sidebar = document.querySelector('.agenda-sidebar').getBoundingClientRect();
    const details = document.querySelector('.agenda-day-details').getBoundingClientRect();
    const list = document.querySelector('.appointment-list');
    return {
      calendarHeight: calendar.height,
      calendarBottom: calendar.bottom,
      sidebarHeight: sidebar.height,
      detailsBottom: details.bottom,
      listClientHeight: list.clientHeight,
      listScrollHeight: list.scrollHeight,
      listOverflowY: getComputedStyle(list).overflowY
    };
  });

  expect(Math.abs(layout.sidebarHeight - layout.calendarHeight)).toBeLessThanOrEqual(2);
  expect(layout.detailsBottom).toBeLessThanOrEqual(layout.calendarBottom + 2);
  expect(layout.listScrollHeight).toBeGreaterThan(layout.listClientHeight);
  expect(layout.listOverflowY).toBe('auto');
  await page.screenshot({ path: testInfo.outputPath('appointments-scroll.png'), fullPage: true });
});

test('shows complete transport details in appointment cards', async ({ page }, testInfo) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const appointmentDate = `${now.getFullYear()}-${month}-18`;
  await page.evaluate(({ appointmentDate }) => {
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify([{
      id: 'appointment-transport',
      fullName: 'Cliente com transporte',
      phoneSearch: '81999991234',
      appointmentDate,
      appointmentTime: '09:00',
      appointmentAttendance: 'pending',
      capturedByName: 'Captador de Teste',
      capturedByUid: 'demo-admin',
      storeId: 'loja-06',
      needsTransport: true,
      hasCompanion: true,
      transportSeats: 2,
      syncState: 'demo'
    }]));
    window.dispatchEvent(new Event('fascinlead:demo-leads'));
  }, { appointmentDate });

  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await page.locator(`[data-appointment-date="${appointmentDate}"]`).click();
  const transport = page.locator('.appointment-transport');
  await expect(transport).toContainText('Transporte + Acompanhante');
  await expect(page.locator('.transport-day-summary')).toContainText('1 cliente · 2 assentos');
  expect(await transport.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('appointment-transport.png'), fullPage: true });
});

test('keeps new registration beside the management return action', async ({ page }, testInfo) => {
  await page.setViewportSize(testInfo.project.name === 'desktop-chrome'
    ? { width: 1024, height: 720 }
    : { width: 390, height: 844 });
  const now = new Date();
  const appointmentDate = now.toISOString().slice(0, 10);
  await page.evaluate(({ date }) => {
    sessionStorage.setItem('fascinlead:demo-role', 'admin');
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify([{
      id: 'lead-sale-test',
      fullName: 'Cliente Venda',
      phone: '+5581999991234',
      phoneSearch: '81999991234',
      appointmentDate: date,
      appointmentTime: '10:00',
      appointmentAttendance: 'attended',
      capturedAtClient: `${date}T09:00:00.000Z`,
      capturedByUid: 'demo-admin',
      capturedByName: 'ADM',
      storeId: 'loja-06',
      source: 'street',
      schemaVersion: 1,
      syncState: 'demo'
    }]));
  }, { date: appointmentDate });
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await page.locator(`[data-appointment-date="${appointmentDate}"]`).click();
  const heading = page.locator('.agenda-heading');
  await expect(heading.getByRole('button', { name: 'Voltar para gestão' })).toBeVisible();
  await expect(heading.getByRole('button', { name: 'Novo agendamento' })).toBeVisible();
  await expect(page.locator('.agenda-day-heading').getByRole('button', { name: 'Novo agendamento' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Informar CPF|Atualizar CPF/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('appointment-header-actions.png'), fullPage: true });
  await heading.getByRole('button', { name: 'Novo agendamento' }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo agendamento' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Salvar cadastro' })).toBeVisible();
  await expect(dialog.getByText('Informações adicionais')).toHaveCount(0);
  await expect(dialog.getByLabel('CPF', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Data de nascimento')).toBeVisible();
  await expect(dialog.getByLabel('Sexo')).toBeVisible();
  await expect(dialog.getByLabel('RG', { exact: true })).toHaveAttribute('placeholder', '0.000.000');
  const modalContactLayout = await dialog.evaluate((element) => {
    const phone = element.querySelector('[name="phone"]').getBoundingClientRect();
    const rg = element.querySelector('[name="customerRg"]').getBoundingClientRect();
    return { viewportWidth: window.innerWidth, phoneTop: phone.top, phoneBottom: phone.bottom, phoneRight: phone.right, rgTop: rg.top, rgLeft: rg.left };
  });
  if (modalContactLayout.viewportWidth > 560) {
    expect(Math.abs(modalContactLayout.phoneTop - modalContactLayout.rgTop)).toBeLessThanOrEqual(2);
    expect(modalContactLayout.rgLeft).toBeGreaterThanOrEqual(modalContactLayout.phoneRight);
  } else {
    expect(modalContactLayout.rgTop).toBeGreaterThanOrEqual(modalContactLayout.phoneBottom);
  }
  for (const removedPathology of ['Olho seco', 'Degeneracao macular', 'Descolamento de retina']) {
    await expect(dialog.getByLabel(removedPathology, { exact: true })).toHaveCount(0);
  }
  const fieldOrder = await dialog.locator('input, select, textarea').evaluateAll((controls) => {
    const tracked = new Set([
      'fullName', 'phone', 'customerRg', 'customerCpf', 'birthDate', 'sex', 'preferredName',
      'street', 'streetNumber', 'neighborhood', 'city', 'state', 'addressReference', 'interestId',
      'storeId', 'appointmentServiceId', 'ametropiaIds', 'pathologyIds',
      'appointmentDate', 'appointmentTime', 'notes'
    ]);
    const seen = new Set();
    return controls.reduce((order, control) => {
      const name = control.name || (control.id === 'agenda-lead-date' ? 'appointmentDate' : '');
      if (tracked.has(name) && !seen.has(name)) {
        seen.add(name);
        order.push(name);
      }
      return order;
    }, []);
  });
  expect(fieldOrder).toEqual([
    'fullName', 'phone', 'customerRg', 'customerCpf', 'birthDate', 'sex', 'preferredName',
    'street', 'streetNumber', 'neighborhood', 'city', 'state', 'addressReference', 'storeId',
    'interestId', 'appointmentServiceId', 'pathologyIds', 'appointmentDate',
    'appointmentTime', 'notes'
  ]);
  const modalPairLayout = await dialog.evaluate((element) => {
    const interest = element.querySelector('[name="interestId"]').getBoundingClientRect();
    const service = element.querySelector('[name="appointmentServiceId"]').getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      interestTop: interest.top,
      interestBottom: interest.bottom,
      interestRight: interest.right,
      serviceTop: service.top,
      serviceLeft: service.left
    };
  });
  if (modalPairLayout.viewportWidth > 760) {
    expect(Math.abs(modalPairLayout.interestTop - modalPairLayout.serviceTop)).toBeLessThanOrEqual(2);
    expect(modalPairLayout.serviceLeft).toBeGreaterThanOrEqual(modalPairLayout.interestRight);
  } else {
    expect(modalPairLayout.serviceTop).toBeGreaterThanOrEqual(modalPairLayout.interestBottom);
  }
  await dialog.getByLabel('Nome *').fill('Cliente preservado');
  await dialog.getByLabel('RG', { exact: true }).fill('98.765.432-1');
  await dialog.getByLabel('Loja').selectOption('loja-02');
  await expect(dialog.getByLabel('Nome *')).toHaveValue('Cliente preservado');
  await expect(dialog.getByLabel('RG', { exact: true })).toHaveValue('98.765.432-1');
  const identityLayout = await dialog.evaluate((element) => {
    const cpf = element.querySelector('[data-field="customerCpf"]').getBoundingClientRect();
    const birthDate = element.querySelector('[data-field="birthDate"]').getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      cpfTop: cpf.top,
      cpfBottom: cpf.bottom,
      cpfRight: cpf.right,
      birthTop: birthDate.top,
      birthLeft: birthDate.left
    };
  });
  if (identityLayout.viewportWidth > 640) {
    expect(Math.abs(identityLayout.cpfTop - identityLayout.birthTop)).toBeLessThanOrEqual(2);
    expect(identityLayout.birthLeft).toBeGreaterThanOrEqual(identityLayout.cpfRight);
  } else {
    expect(identityLayout.birthTop).toBeGreaterThanOrEqual(identityLayout.cpfBottom);
  }
  const modalLayout = await dialog.evaluate((element) => {
    const dialogRect = element.getBoundingClientRect();
    const actionsRect = element.querySelector('.appointment-create-actions').getBoundingClientRect();
    const saveRect = element.querySelector('button[type="submit"]').getBoundingClientRect();
    const content = element.querySelector('.appointment-create-content');
    return {
      dialogBottom: dialogRect.bottom,
      actionsBottom: actionsRect.bottom,
      saveBottom: saveRect.bottom,
      saveHeight: saveRect.height,
      contentClientHeight: content.clientHeight,
      contentScrollHeight: content.scrollHeight,
      contentOverflowY: getComputedStyle(content).overflowY
    };
  });
  expect(modalLayout.actionsBottom).toBeLessThanOrEqual(modalLayout.dialogBottom + 1);
  expect(modalLayout.saveBottom).toBeLessThanOrEqual(modalLayout.dialogBottom + 1);
  expect(modalLayout.saveHeight).toBeGreaterThanOrEqual(40);
  expect(modalLayout.contentOverflowY).toBe('auto');
  expect(modalLayout.contentScrollHeight).toBeGreaterThan(modalLayout.contentClientHeight);
  await dialog.screenshot({ path: testInfo.outputPath('appointment-create-dialog.png') });
  await dialog.getByLabel('CPF', { exact: true }).scrollIntoViewIfNeeded();
  await dialog.screenshot({ path: testInfo.outputPath('appointment-create-identity.png') });
});

test('alerts the captor about a missed appointment and prepares WhatsApp follow-up', async ({ page }, testInfo) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const missedDate = yesterday.toISOString().slice(0, 10);
  const futureDate = tomorrow.toISOString().slice(0, 10);

  await page.evaluate(({ missedDate, futureDate }) => {
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify([
      {
        id: 'missed-owned-lead',
        fullName: 'Cliente Retorno',
        preferredName: 'Clara',
        phone: '+5581999991234',
        phoneSearch: '81999991234',
        appointmentDate: missedDate,
        appointmentTime: '08:00',
        appointmentAttendance: 'missed',
        appointmentSchedulingMode: 'controlled',
        appointmentDurationMinutes: 20,
        capturedByUid: 'demo-user',
        capturedByName: 'Equipe Fascinante',
        capturedAtClient: new Date().toISOString(),
        storeId: 'loja-teste',
        notes: '',
        syncState: 'demo'
      },
      {
        id: 'future-missed-lead',
        fullName: 'Cliente Futuro',
        phone: '+5581999999999',
        phoneSearch: '81999999999',
        appointmentDate: futureDate,
        appointmentTime: '08:00',
        appointmentAttendance: 'missed',
        capturedByUid: 'demo-user',
        capturedByName: 'Equipe Fascinante',
        storeId: 'loja-teste',
        notes: '',
        syncState: 'demo'
      }
    ]));
  }, { missedDate, futureDate });

  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await expect(page.getByRole('button', { name: /Retornos pendentes/ })).toContainText('1 cliente');
  await page.getByRole('button', { name: /Retornos pendentes/ }).click();
  await expect(page.getByRole('heading', { name: 'Retornos pendentes' })).toBeVisible();
  await expect(page.getByText('Cliente Retorno', { exact: true })).toBeVisible();
  await expect(page.getByText('Cliente Futuro', { exact: true })).not.toBeVisible();

  const whatsAppLink = page.getByRole('link', { name: 'Chamar no WhatsApp' });
  await expect(whatsAppLink).toHaveAttribute('href', /wa\.me\/5581999991234/);
  await expect(whatsAppLink).toHaveAttribute('href', /reagendar/);
  await whatsAppLink.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
    element.click();
  });
  await expect(page.getByText('Reagendamento recomendado', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('missed-follow-up.png'), fullPage: true });

  await page.getByRole('button', { name: 'Reagendar' }).click();
  await page.getByLabel('Data do pré-agendamento').fill(futureDate);
  await page.getByLabel('Horário').selectOption('10:00');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await page.getByRole('button', { name: 'Retornos', exact: true }).click();
  await expect(page.getByText('Nenhum retorno pendente')).toBeVisible();
});

test('lets a manager monitor follow-ups grouped by collaborator', async ({ page }, testInfo) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const appointmentDate = yesterday.toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const rescheduleDate = tomorrow.toISOString().slice(0, 10);

  await page.evaluate(({ appointmentDate }) => {
    sessionStorage.setItem('fascinlead:demo-role', 'manager');
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify([
      {
        id: 'team-awaiting',
        fullName: 'Cliente Aguardando',
        phone: '+5581999991111',
        phoneSearch: '81999991111',
        appointmentDate,
        appointmentTime: '08:00',
        appointmentAttendance: 'missed',
        capturedByUid: 'captor-ana',
        capturedByName: 'Ana Captadora',
        capturedAtClient: new Date().toISOString(),
        storeId: 'loja-06',
        notes: '',
        syncState: 'demo'
      },
      {
        id: 'team-contacted',
        fullName: 'Cliente Contatado',
        phone: '+5581999992222',
        phoneSearch: '81999992222',
        appointmentDate,
        appointmentTime: '09:00',
        appointmentAttendance: 'missed',
        followUpContactedAt: new Date().toISOString(),
        followUpContactedByUid: 'captor-bruno',
        followUpContactedByName: 'Bruno Captador',
        followUpContactedAppointmentKey: `${appointmentDate}|09:00`,
        capturedByUid: 'captor-bruno',
        capturedByName: 'Bruno Captador',
        capturedAtClient: new Date().toISOString(),
        storeId: 'loja-06',
        notes: '',
        syncState: 'demo'
      },
      {
        id: 'another-store',
        fullName: 'Cliente Outra Loja',
        phone: '+5581999993333',
        phoneSearch: '81999993333',
        appointmentDate,
        appointmentTime: '10:00',
        appointmentAttendance: 'missed',
        capturedByUid: 'captor-outra',
        capturedByName: 'Outra Captadora',
        storeId: 'loja-04',
        notes: '',
        syncState: 'demo'
      }
    ]));
  }, { appointmentDate });

  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Retornos da equipe/ }).click();

  await expect(page.getByRole('heading', { name: 'Retornos da equipe' })).toBeVisible();
  await expect(page.locator('.follow-up-team-heading').getByText('Ana Captadora', { exact: true })).toBeVisible();
  await expect(page.locator('.follow-up-team-heading').getByText('Bruno Captador', { exact: true })).toBeVisible();
  await expect(page.locator('.follow-up-team-heading .avatar').first()).toHaveCSS('display', 'grid');
  await expect(page.locator('.follow-up-team-heading .avatar').first()).toHaveCSS('place-items', 'center');
  await expect(page.getByText('Outra Captadora', { exact: true })).not.toBeVisible();
  await expect(page.locator('.status-badge', { hasText: 'Reagendamento recomendado' }).first()).toBeVisible();
  await expect(page.getByText('Oferecer uma nova data', { exact: true }).first()).toBeVisible();
  await page.locator('[data-follow-up-filter="captors"]').click();
  await expect(page.locator('.follow-up-captor-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ver retornos aguardando de Ana Captadora' }).click();
  const captorDialog = page.getByRole('dialog', { name: 'Ana Captadora' });
  await expect(captorDialog).toBeVisible();
  await expect(captorDialog.getByText('1 lead(s) aguardando contato')).toBeVisible();
  await expect(captorDialog.getByText('Cliente Aguardando', { exact: true })).toBeVisible();
  await expect(captorDialog.getByRole('link', { name: 'Chamar no WhatsApp' })).toBeVisible();
  await expect(captorDialog.getByRole('button', { name: 'Reagendar' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('captor-pending-follow-ups-dialog.png'), fullPage: true });
  await captorDialog.getByRole('button', { name: 'Reagendar' }).click();
  await expect(page.getByRole('heading', { name: 'Cliente Aguardando' })).toBeVisible();
  await expect(page.getByText('Cadastro não encontrado. Volte para a lista e tente novamente.')).not.toBeVisible();
  await page.evaluate(() => { location.hash = '#/follow-ups'; });
  await expect(page.getByRole('heading', { name: 'Retornos da equipe' })).toBeVisible();
  await page.locator('[data-follow-up-filter="contacted"]').click();
  await expect(page.getByText('Cliente Contatado', { exact: true })).toBeVisible();
  await expect(page.getByText('Cliente Aguardando', { exact: true })).not.toBeVisible();
  await page.locator('[data-follow-up-filter="waiting"]').click();
  await expect(page.getByText('Cliente Aguardando', { exact: true })).toBeVisible();
  await expect(page.getByText('Cliente Contatado', { exact: true })).not.toBeVisible();
  await page.locator('[data-follow-up-filter="all"]').click();
  const awaitingCard = page.locator('.follow-up-item').filter({ hasText: 'Cliente Aguardando' });
  const whatsAppLink = awaitingCard.getByRole('link', { name: 'Chamar no WhatsApp' });
  await expect(whatsAppLink).toHaveAttribute('href', /wa\.me\/5581999991111/);
  await whatsAppLink.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
    element.click();
  });
  await expect(awaitingCard.getByText('Reagendamento recomendado', { exact: true })).toBeVisible();
  await expect(awaitingCard.getByText('Gestor de Teste', { exact: true })).toBeVisible();
  await page.locator('[data-follow-up-filter="contacted"]').click();
  await expect(page.getByText('Cliente Aguardando', { exact: true })).toBeVisible();
  await expect(page.getByText('Cliente Contatado', { exact: true })).toBeVisible();
  await page.locator('[data-follow-up-filter="captors"]').click();
  await expect(page.locator('.follow-up-captor-card')).toHaveCount(2);
  await page.locator('[data-follow-up-filter="all"]').click();
  await page.screenshot({ path: testInfo.outputPath('manager-team-follow-ups.png'), fullPage: true });
  await awaitingCard.getByRole('button', { name: 'Reagendar' }).click();
  await expect(page.getByRole('heading', { name: 'Cliente Aguardando' })).toBeVisible();
  await expect(page.getByLabel('Nome *')).toBeDisabled();
  await expect(page.getByLabel('Data do pré-agendamento')).toBeEnabled();
  await page.getByLabel('Data do pré-agendamento').fill(rescheduleDate);
  const rescheduleTimeField = page.getByLabel('Horário');
  if (await rescheduleTimeField.evaluate((element) => element.tagName === 'SELECT')) {
    await rescheduleTimeField.selectOption({ index: 1 });
  } else {
    await rescheduleTimeField.fill('10:30');
  }
  await page.getByRole('button', { name: 'Salvar reagendamento' }).click();
  await expect(page.getByText('Lead atualizado com sucesso.')).toBeVisible();
});

test('lets an administrator monitor follow-ups from every store', async ({ page }, testInfo) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const appointmentDate = yesterday.toISOString().slice(0, 10);

  await page.evaluate(({ appointmentDate }) => {
    sessionStorage.setItem('fascinlead:demo-role', 'admin');
    localStorage.setItem('fascinlead:demo-leads', JSON.stringify([
      {
        id: 'admin-store-02',
        fullName: 'Cliente Loja 02',
        phone: '+5581999991111',
        phoneSearch: '81999991111',
        appointmentDate,
        appointmentTime: '08:00',
        appointmentAttendance: 'missed',
        capturedByUid: 'captor-02',
        capturedByName: 'Captador Loja 02',
        storeId: 'loja-02',
        notes: '',
        syncState: 'demo'
      },
      {
        id: 'admin-store-06',
        fullName: 'Cliente Loja 06',
        phone: '+5581999992222',
        phoneSearch: '81999992222',
        appointmentDate,
        appointmentTime: '09:00',
        appointmentAttendance: 'missed',
        capturedByUid: 'captor-06',
        capturedByName: 'Captador Loja 06',
        storeId: 'loja-06',
        notes: '',
        syncState: 'demo'
      }
    ]));
  }, { appointmentDate });

  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Retornos da equipe/ }).click();

  await expect(page.getByRole('heading', { name: 'Retornos da equipe' })).toBeVisible();
  const store02Card = page.locator('.follow-up-item').filter({ hasText: 'Cliente Loja 02' });
  const store06Card = page.locator('.follow-up-item').filter({ hasText: 'Cliente Loja 06' });
  await expect(store02Card.getByText('Loja 02', { exact: true })).toBeVisible();
  await expect(store06Card.getByText('Loja 06', { exact: true })).toBeVisible();
  await expect(store02Card.getByRole('link', { name: 'Chamar no WhatsApp' })).toBeVisible();
  await expect(store02Card.getByRole('button', { name: 'Reagendar' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('admin-all-store-follow-ups.png'), fullPage: true });
});

test('configures the schedule and hides occupied slots', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Configurações/ }).click();
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  await expect(page.getByText('Configurações da agenda', { exact: true })).toBeVisible();

  await page.getByLabel('Loja', { exact: true }).selectOption('loja-06');
  await page.getByRole('button', { name: 'Configurar agenda' }).click();
  const generalScheduleDialog = page.getByRole('dialog', { name: 'Configurações gerais' });
  const revealDialogControl = async (locator) => locator.evaluate((element) => {
    const scroller = element.closest('.schedule-rule-dialog-body');
    const elementRect = element.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    scroller.scrollTop += elementRect.top - scrollerRect.top - 32;
  });
  const storeScheduleGap = await generalScheduleDialog.evaluate((dialog) => {
    const availability = dialog.querySelector('[name="schedulingMode"]').getBoundingClientRect();
    const legend = dialog.querySelector('[data-field="storeHoursRules"] legend').getBoundingClientRect();
    return legend.top - availability.bottom;
  });
  expect(storeScheduleGap).toBeGreaterThanOrEqual(40);
  expect(storeScheduleGap).toBeLessThanOrEqual(80);
  await expect(generalScheduleDialog.getByLabel('Exibir ametropias no cadastro')).not.toBeChecked();
  await revealDialogControl(generalScheduleDialog.getByLabel('Exibir ametropias no cadastro'));
  await generalScheduleDialog.locator('label[for="settings-show-ametropias"]').click();
  await revealDialogControl(generalScheduleDialog.getByLabel('Alertar atraso após'));
  await generalScheduleDialog.getByLabel('Alertar atraso após').fill('5');
  await revealDialogControl(generalScheduleDialog.getByLabel('Sugerir reagendamento após'));
  await generalScheduleDialog.getByLabel('Sugerir reagendamento após').fill('30');
  const graceLayout = await generalScheduleDialog.evaluate((dialog) => {
    const help = dialog.querySelector('#settings-no-show-help').getBoundingClientRect();
    const input = dialog.querySelector('#settings-no-show-grace').getBoundingClientRect();
    return { helpBottom: help.bottom, inputTop: input.top };
  });
  expect(graceLayout.helpBottom).toBeLessThanOrEqual(graceLayout.inputTop);
  await revealDialogControl(generalScheduleDialog.getByLabel('Gerar retorno automaticamente'));
  await generalScheduleDialog.locator('label[for="settings-automatic-follow-up"]').click();
  await revealDialogControl(generalScheduleDialog.getByLabel('Início de Quinta'));
  await generalScheduleDialog.getByLabel('Início de Quinta').fill('09:00');
  await generalScheduleDialog.getByLabel('Fim de Quinta').fill('17:00');
  await revealDialogControl(generalScheduleDialog.getByLabel('Início de Sabado'));
  await generalScheduleDialog.getByLabel('Início de Sabado').fill('08:00');
  await generalScheduleDialog.getByLabel('Fim de Sabado').fill('12:00');
  await page.screenshot({ path: testInfo.outputPath('general-schedule-dialog.png') });
  await generalScheduleDialog.getByRole('button', { name: 'Aplicar configurações' }).click();
  await expect(generalScheduleDialog).not.toBeVisible();
  await expect(page.getByText('7 dias abertos')).toBeVisible();
  await page.getByRole('button', { name: 'Configurar limite' }).click();
  const limitedDaysDialog = page.getByRole('dialog', { name: 'Limite de vagas' });
  await expect(limitedDaysDialog.getByLabel('Limitar vagas em dias específicos')).not.toBeChecked();
  await limitedDaysDialog.getByLabel('Limitar vagas em dias específicos').check();
  const limitedDaysGroup = limitedDaysDialog.getByRole('group', { name: 'Limite por dia da semana' });
  await expect(limitedDaysGroup.getByRole('checkbox', { name: 'Quarta', exact: true })).toBeChecked();
  await expect(limitedDaysGroup.getByRole('checkbox', { name: 'Sabado', exact: true })).toBeChecked();
  await limitedDaysDialog.getByLabel('Vagas de Quarta').fill('6');
  await limitedDaysDialog.getByLabel('Vagas de Sabado').fill('4');
  await page.screenshot({ path: testInfo.outputPath('limited-days-dialog.png') });
  await limitedDaysDialog.getByRole('button', { name: 'Aplicar limite' }).click();
  await expect(limitedDaysDialog).not.toBeVisible();
  await expect(page.getByText('2 dias configurados')).toBeVisible();
  await page.getByRole('button', { name: 'Configurar cotas' }).click();
  const meiQuotaDialog = page.getByRole('dialog', { name: 'Cotas do MEI' });
  await meiQuotaDialog.getByLabel('Aplicar cotas ao cargo MEI').check();
  const meiQuotaGroup = meiQuotaDialog.getByRole('group', { name: 'Cotas por dia da semana' });
  await expect(meiQuotaGroup.getByRole('checkbox', { name: 'Quarta', exact: true })).toBeChecked();
  await expect(meiQuotaGroup.getByRole('checkbox', { name: 'Sabado', exact: true })).toBeChecked();
  await meiQuotaDialog.getByLabel('Cota da manhã de Quarta').fill('4');
  await meiQuotaDialog.getByLabel('Cota da tarde de Quarta').fill('6');
  await meiQuotaDialog.getByLabel('Cota da manhã de Sabado').fill('2');
  await meiQuotaDialog.getByLabel('Cota da tarde de Sabado').fill('2');
  await page.screenshot({ path: testInfo.outputPath('mei-quota-dialog.png') });
  await meiQuotaDialog.getByRole('button', { name: 'Aplicar cotas' }).click();
  await expect(meiQuotaDialog).not.toBeVisible();
  await expect(page.getByText('2 dias configurados')).toHaveCount(2);
  await page.getByRole('button', { name: 'Configurar', exact: true }).click();
  const ophthalmologyDialog = page.getByRole('dialog', { name: 'Triagem e valores de consulta' });
  const professionalOrder = await ophthalmologyDialog.evaluate((dialog) => [
    dialog.querySelector('[name="ophthalmologyMinimumAge"]'),
    dialog.querySelector('#settings-optometrist-enabled'),
    dialog.querySelector('[data-field="optometristHoursRules"] legend'),
    dialog.querySelector('#settings-ophthalmology-enabled'),
    dialog.querySelector('[data-field="ophthalmologyHoursRules"] legend')
  ].map((element) => element.getBoundingClientRect().top));
  expect(professionalOrder).toEqual([...professionalOrder].sort((a, b) => a - b));
  await expect(ophthalmologyDialog.getByLabel('Ativar atendimento com optometrista')).toBeChecked();
  await expect(ophthalmologyDialog.getByLabel('Ativar triagem para oftalmologista')).toBeChecked();
  await expect(ophthalmologyDialog.getByLabel('Perguntar sobre cirurgia a partir de')).toHaveValue('55');
  const ophthalmologySchedule = ophthalmologyDialog.getByRole('group', { name: 'Escala do oftalmologista' });
  await ophthalmologySchedule.getByRole('checkbox', { name: 'Quinta', exact: true }).check();
  await expect(ophthalmologyDialog).toBeVisible();
  await ophthalmologyDialog.getByLabel('Início do oftalmologista em Quinta').fill('08:00');
  await expect(ophthalmologyDialog).toBeVisible();
  await ophthalmologyDialog.getByLabel('Fim do oftalmologista em Quinta').fill('18:00');
  await expect(ophthalmologyDialog).toBeVisible();
  await expect(ophthalmologySchedule.getByRole('checkbox', { name: 'Sabado', exact: true })).toBeChecked();
  await ophthalmologyDialog.getByLabel('Início do oftalmologista em Sabado').fill('08:00');
  await ophthalmologyDialog.getByLabel('Fim do oftalmologista em Sabado').fill('12:00');
  await expect(ophthalmologyDialog.getByLabel('Fim do oftalmologista em Sabado')).toHaveValue('12:00');
  await page.screenshot({ path: testInfo.outputPath('ophthalmology-weekly-schedule-dialog.png') });
  await ophthalmologyDialog.getByRole('button', { name: 'Aplicar configurações' }).click();
  await expect(ophthalmologyDialog).not.toBeVisible();
  await expect(page.locator('[data-ophthalmology-summary]')).toContainText('Optometrista');
  await page.getByRole('button', { name: 'Configurar transporte' }).click();
  const transportDialog = page.getByRole('dialog', { name: 'Transporte' });
  await transportDialog.getByLabel('Disponibilizar transporte').check();
  await transportDialog.getByRole('checkbox', { name: 'Quarta', exact: true }).check();
  await transportDialog.getByLabel('Início do transporte em Quarta').fill('13:00');
  await transportDialog.getByLabel('Fim do transporte em Quarta').fill('17:00');
  await transportDialog.getByRole('checkbox', { name: 'Sabado', exact: true }).check();
  await transportDialog.getByLabel('Início do transporte em Sabado').fill('08:00');
  await transportDialog.getByLabel('Fim do transporte em Sabado').fill('12:00');
  await page.screenshot({ path: testInfo.outputPath('transport-weekly-schedule-dialog.png') });
  await transportDialog.getByRole('button', { name: 'Aplicar transporte' }).click();
  await expect(transportDialog).not.toBeVisible();
  await expect(page.locator('[data-transport-summary]')).toHaveText('2 dias configurados');
  await page.getByRole('button', { name: 'Salvar configuração' }).click();
  await expect(page.getByText('Configuração da agenda salva.')).toBeVisible();
  if (!testInfo.project.name.includes('mobile')) {
    await page.getByRole('button', { name: 'Configurar agenda' }).click();
    await expect(generalScheduleDialog.getByLabel('Alertar atraso após')).toHaveValue('5');
    await expect(generalScheduleDialog.getByLabel('Sugerir reagendamento após')).toHaveValue('30');
    await expect(generalScheduleDialog.getByLabel('Gerar retorno automaticamente')).toBeChecked();
    await expect(generalScheduleDialog.getByLabel('Exibir ametropias no cadastro')).toBeChecked();
    await expect(generalScheduleDialog.getByLabel('Início de Quinta')).toHaveValue('09:00');
    await expect(generalScheduleDialog.getByLabel('Fim de Quinta')).toHaveValue('17:00');
    await expect(generalScheduleDialog.getByLabel('Fim de Sabado')).toHaveValue('12:00');
    await generalScheduleDialog.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Configurar limite' }).click();
    await expect(limitedDaysDialog.getByLabel('Vagas de Quarta')).toHaveValue('6');
    await expect(limitedDaysDialog.getByLabel('Vagas de Sabado')).toHaveValue('4');
    await limitedDaysDialog.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Configurar cotas' }).click();
    await expect(meiQuotaDialog.getByLabel('Cota da manhã de Quarta')).toHaveValue('4');
    await expect(meiQuotaDialog.getByLabel('Cota da tarde de Quarta')).toHaveValue('6');
    await expect(meiQuotaDialog.getByLabel('Cota da manhã de Sabado')).toHaveValue('2');
    await expect(meiQuotaDialog.getByLabel('Cota da tarde de Sabado')).toHaveValue('2');
    await meiQuotaDialog.getByRole('button', { name: 'Cancelar' }).click();
  }
  await page.screenshot({ path: testInfo.outputPath('schedule-settings.png'), fullPage: true });

  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByLabel('Loja de destino').selectOption('loja-06');
  await expect(page.getByRole('group', { name: 'Ametropias' })).toBeVisible();
  await expect(page.getByLabel('Quantidade de acompanhantes')).toBeDisabled();
  await page.getByLabel('Transporte', { exact: true }).selectOption('true');
  await expect(page.getByLabel('Quantidade de acompanhantes')).toBeEnabled();
  await page.getByLabel('Quantidade de acompanhantes').selectOption('1');
  await page.getByLabel('Data do pré-agendamento').fill('2026-10-24');
  await expect(page.getByText('Transporte disponível das 08:00 às 12:00.')).toBeVisible();
  await expect(page.getByLabel('Horário disponível').locator('option[value="08:00"]')).toHaveCount(1);
  await expect(page.getByLabel('Horário disponível').locator('option[value="11:40"]')).toHaveCount(1);
  await expect(page.getByLabel('Horário disponível').locator('option[value="12:00"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('transport-lead-fields.png'), fullPage: true });
  await page.getByLabel('Transporte', { exact: true }).selectOption('false');
  await expect(page.getByLabel('Quantidade de acompanhantes')).toBeDisabled();
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const appointmentDate = date.toISOString().slice(0, 10);
  await page.getByLabel('Data do pré-agendamento').fill(appointmentDate);
  const timeSelect = page.getByLabel('Horário disponível');
  await expect(timeSelect.locator('option[value="08:00"]')).toHaveCount(1);
  await expect(timeSelect.locator('option[value="08:10"]')).toHaveCount(0);
  await expect(timeSelect.locator('option[value="08:20"]')).toHaveCount(1);
  await expect(timeSelect.locator('option[value="08:30"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('available-slots.png'), fullPage: true });

  await page.getByLabel('Nome *').fill('Cliente Horário Ocupado');
  await page.getByLabel('Telefone ou WhatsApp *').fill('81999991234');
  await page.getByLabel('Data de nascimento *').fill('1985-04-12');
  await timeSelect.selectOption('08:00');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByLabel('Loja de destino').selectOption('loja-06');
  await page.getByLabel('Data do pré-agendamento').fill(appointmentDate);
  await expect(page.getByLabel('Horário disponível').locator('option[value="08:00"]')).toHaveCount(0);
  await expect(page.getByLabel('Horário disponível').locator('option[value="08:10"]')).toHaveCount(0);
});

test('hides transport fields from new registrations when transport is disabled', async ({ page }) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByLabel('Loja de destino').selectOption('loja-06');

  await expect(page.getByLabel('Transporte', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Tem acompanhante?')).toHaveCount(0);
});

test('uses the available width in schedule settings', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'Intermediate desktop layout only.');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Configurações/ }).click();
  const layout = await page.locator('.settings-layout').evaluate((element) => {
    const form = element.querySelector('.settings-form').getBoundingClientRect();
    const cards = [...element.querySelectorAll('.schedule-config-launch')].map((item) => item.getBoundingClientRect());
    return {
      formWidth: form.width,
      cardCount: cards.length,
      cardTops: cards.map((card) => card.top),
      cardsInsideForm: cards.every((card) => card.left >= form.left && card.right <= form.right),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  expect(layout.formWidth).toBeGreaterThan(900);
  expect(layout.cardCount).toBe(6);
  expect(new Set(layout.cardTops.map((top) => Math.round(top))).size).toBeLessThanOrEqual(3);
  expect(layout.cardsInsideForm).toBe(true);
  expect(layout.overflow).toBeLessThanOrEqual(1);
  await expect(page.locator('.schedule-preview')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Configurar agenda' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Configurações gerais' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Configurar limite' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Limite de vagas' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Configurar cotas' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Cotas do MEI' })).not.toBeVisible();
  await page.getByLabel('Loja', { exact: true }).selectOption('loja-06');
  await expect(page.getByRole('button', { name: 'Configurar modo offline' })).toBeVisible();
  await expect(page.locator('.schedule-config-launch').filter({ hasText: 'Cadastro offline' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Configurar modo offline' }).click();
  const offlineDialog = page.getByRole('dialog', { name: 'Cadastro offline' });
  await expect(offlineDialog).toBeVisible();
  await expect(offlineDialog.getByLabel('Permitir cadastros sem internet')).not.toBeChecked();
  await offlineDialog.getByLabel('Permitir cadastros sem internet').check();
  await offlineDialog.getByRole('button', { name: 'Aplicar configuração' }).click();
  await page.getByRole('button', { name: 'Salvar configuração' }).click();
  await expect(page.getByRole('button', { name: 'Sync', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('schedule-settings-intermediate.png'), fullPage: true });
  await page.setViewportSize({ width: 900, height: 768 });
  const compactOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(compactOverflow).toBeLessThanOrEqual(1);
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await expect(page.locator('#lead-form')).toBeVisible();
  await page.getByLabel('Loja de destino').selectOption('loja-06');
  await expect(page.getByLabel('Data do pré-agendamento')).toBeHidden();
  await expect(page.getByLabel('Horário disponível')).toBeHidden();
  await expect(page.getByText(/somente os dados do lead serão salvos/i)).toBeVisible();
  await page.getByLabel('Nome *').fill('Cliente Offline');
  await page.getByLabel('Telefone ou WhatsApp *').fill('81999990000');
  await page.getByLabel('Data de nascimento').fill('1980-01-01');
  await page.getByRole('button', { name: 'Salvar cadastro' }).click();
  await expect(page.getByRole('heading', { name: 'Meus cadastros' })).toBeVisible();
  const offlineLead = page.getByRole('button', { name: 'Ver cadastro de Cliente Offline' });
  await expect(offlineLead).toContainText('Somente neste navegador');
  await page.context().setOffline(false);
  await expect(offlineLead).toContainText('Somente neste navegador');
  await offlineLead.click();
  await expect(page.getByLabel('Data do pré-agendamento')).toBeEnabled();
  const scheduleDate = new Date();
  scheduleDate.setDate(scheduleDate.getDate() + 7);
  await page.getByLabel('Data do pré-agendamento').fill(scheduleDate.toISOString().slice(0, 10));
  await expect(page.getByLabel('Horário disponível')).toBeVisible();
  await expect(page.getByLabel('Horário disponível')).toBeEnabled();
  expect(await page.getByLabel('Horário disponível').locator('option').count()).toBeGreaterThan(1);
});

test('shows the role and permission editor on desktop and mobile', async ({ page }, testInfo) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Configurações/ }).click();
  await page.getByRole('tab', { name: 'Perfis e permissões' }).click();

  await expect(page.getByText('Cargos cadastrados', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adicionar cargo' })).toBeVisible();
  await expect(page.locator('#role-profile-form')).toHaveCount(0);
  await expect(page.getByText('Colaborador', { exact: true })).toBeVisible();
  await expect(page.getByText('Gestor loja', { exact: true })).toBeVisible();
  await expect(page.getByText('Atendente Balcão', { exact: true })).toBeVisible();
  await expect(page.getByText('Administrador', { exact: true })).toBeVisible();
  await expect(page.getByText('MEI', { exact: true })).toBeVisible();
  await expect(page.locator('.role-catalog-row')).toHaveCount(5);
  await page.getByRole('button', { name: 'Visualizar permissões do perfil Atendente Balcão' }).click();
  const receptionistDialog = page.getByRole('dialog', { name: 'Atendente Balcão' });
  await expect(receptionistDialog.locator('.role-details-permission.is-active')).toHaveCount(6);
  await expect(receptionistDialog.getByText('6 de 17 permissões ativadas')).toBeVisible();
  await receptionistDialog.getByLabel('Registrar comparecimento e falta').uncheck();
  await expect(receptionistDialog.getByText('5 de 17 permissões ativadas')).toBeVisible();
  await receptionistDialog.getByRole('button', { name: 'Salvar permissões' }).click();
  await page.getByRole('button', { name: 'Visualizar permissões do perfil Atendente Balcão' }).click();
  await expect(receptionistDialog.getByLabel('Registrar comparecimento e falta')).not.toBeChecked();
  await receptionistDialog.getByRole('button', { name: 'Restaurar padrão' }).click();
  await page.getByRole('button', { name: 'Visualizar permissões do perfil Atendente Balcão' }).click();
  await expect(receptionistDialog.getByLabel('Registrar comparecimento e falta')).toBeChecked();
  await receptionistDialog.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Visualizar permissões do perfil Administrador' }).click();
  const administratorDialog = page.getByRole('dialog', { name: 'Administrador' });
  await expect(administratorDialog.locator('.role-details-permission.is-active')).toHaveCount(17);
  await expect(administratorDialog.locator('[data-system-role-permission]:enabled')).toHaveCount(0);
  await administratorDialog.getByRole('button', { name: 'Concluir' }).click();
  await page.getByRole('button', { name: 'Visualizar permissões do perfil Colaborador' }).click();
  const detailsDialog = page.getByRole('dialog', { name: 'Colaborador' });
  await expect(detailsDialog).toBeVisible();
  await expect(detailsDialog.locator('.role-details-permission')).toHaveCount(17);
  await expect(detailsDialog.locator('.role-details-permission.is-active')).toHaveCount(5);
  await expect(detailsDialog.getByText('5 de 17 permissões ativadas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('role-permissions-details.png') });
  await detailsDialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(detailsDialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Adicionar cargo' }).click();
  const editorDialog = page.getByRole('dialog', { name: 'Novo cargo' });
  await expect(editorDialog).toBeVisible();
  await expect(editorDialog.locator('.role-details-permission')).toHaveCount(17);
  await expect(editorDialog.locator('.role-details-permission.is-active')).toHaveCount(6);
  await expect(editorDialog.getByLabel('Cadastrar leads')).toBeChecked();
  await expect(editorDialog.getByLabel('Acessar a gestão de leads')).toBeDisabled();
  await expect(editorDialog.getByText('6 de 17 permissões ativadas')).toBeVisible();
  await editorDialog.getByLabel('Alcance dos dados').selectOption('stores');
  await expect(editorDialog.getByLabel('Acessar a gestão de leads')).toBeEnabled();
  await expect(editorDialog.getByLabel('Acessar a gestão de leads')).not.toBeChecked();
  await editorDialog.getByLabel('Visualizar dashboard').check();
  await expect(editorDialog.getByLabel('Acessar a gestão de leads')).toBeChecked();
  await expect(editorDialog.getByText('8 de 17 permissões ativadas')).toBeVisible();
  await editorDialog.getByLabel('Nome do cargo').fill('Supervisor de teste');
  await editorDialog.getByRole('button', { name: 'Criar cargo' }).click();
  const customCard = page.locator('.role-catalog-row').filter({ hasText: 'Supervisor de teste' });
  await expect(customCard).toBeVisible();

  await customCard.getByTitle('Editar cargo').click();
  const editDialog = page.getByRole('dialog', { name: 'Editar cargo' });
  await expect(editDialog).toBeVisible();
  await expect(editDialog.locator('.role-details-permission')).toHaveCount(17);
  await expect(editDialog.locator('.role-details-permission.is-active')).toHaveCount(8);
  await expect(editDialog.getByLabel('Visualizar dashboard')).toBeChecked();
  await expect(editDialog.getByLabel('Nome do cargo')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('custom-role-editor.png') });
  await editDialog.getByLabel('Nome do cargo').fill('Supervisor atualizado');
  await editDialog.getByRole('button', { name: 'Salvar alterações' }).click();
  const updatedCard = page.locator('.role-catalog-row').filter({ hasText: 'Supervisor atualizado' });
  await expect(updatedCard).toBeVisible();

  await updatedCard.getByTitle('Excluir cargo').click();
  const deleteDialog = page.getByRole('dialog', { name: 'Excluir cargo?' });
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog).toHaveJSProperty('open', true);
  await deleteDialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(deleteDialog).not.toBeVisible();

  await updatedCard.getByTitle('Excluir cargo').click();
  await page.getByRole('dialog', { name: 'Excluir cargo?' }).getByRole('button', { name: 'Excluir cargo' }).click();
  await expect(updatedCard).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('role-profiles-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.role-catalog-panel')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('role-profiles-mobile.png'), fullPage: true });
});

test('creates a service and uses its duration in new appointments', async ({ page }, testInfo) => {
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();
  await page.getByRole('button', { name: /Configurações/ }).click();
  await page.getByRole('tab', { name: 'Serviços' }).click();

  await expect(page.getByText('Serviços cadastrados')).toBeVisible();
  await expect(page.getByText('Exame de vista')).toHaveCount(1);
  await page.getByRole('button', { name: 'Novo serviço' }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo serviço' });
  const serviceFieldsLayout = await dialog.evaluate((element) => {
    const name = element.querySelector('.service-name-field').getBoundingClientRect();
    const duration = element.querySelector('.service-duration-field').getBoundingClientRect();
    return { viewportWidth: window.innerWidth, nameTop: name.top, nameBottom: name.bottom, nameWidth: name.width, durationTop: duration.top, durationWidth: duration.width };
  });
  if (serviceFieldsLayout.viewportWidth > 760) {
    expect(Math.abs(serviceFieldsLayout.nameTop - serviceFieldsLayout.durationTop)).toBeLessThanOrEqual(2);
    expect(serviceFieldsLayout.nameWidth).toBeGreaterThan(serviceFieldsLayout.durationWidth);
  } else {
    expect(serviceFieldsLayout.durationTop).toBeGreaterThanOrEqual(serviceFieldsLayout.nameBottom);
  }
  await dialog.getByLabel('Nome do serviço').fill('Avaliacao especializada');
  await dialog.getByLabel('Duração').fill('40');
  await expect(dialog.getByText('Loja 02', { exact: true })).toHaveCSS('color', 'rgb(20, 32, 51)');
  await dialog.getByLabel('Loja 02').uncheck();
  await dialog.getByLabel('Loja 06').check();
  await dialog.getByLabel('Loja 04').check();
  await dialog.getByRole('button', { name: 'Salvar serviço' }).click();

  const serviceRow = page.locator('.service-catalog-row').filter({ hasText: 'Avaliacao especializada' });
  await expect(serviceRow).toBeVisible();
  await expect(serviceRow.getByText('40 min')).toBeVisible();
  await expect(serviceRow).toContainText('Loja 04 · Loja 06');
  await page.screenshot({ path: testInfo.outputPath('service-catalog.png'), fullPage: true });

  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByLabel('Loja de destino').selectOption('loja-06');
  await page.getByLabel('Serviço do agendamento').selectOption({ label: 'Avaliacao especializada - 40 min' });
  const date = new Date();
  date.setDate(date.getDate() + 1);
  await page.getByLabel('Data do pré-agendamento').fill(date.toISOString().slice(0, 10));
  const timeSelect = page.getByLabel('Horário disponível');
  await expect(timeSelect.locator('option[value="08:00"]')).toHaveCount(1);
  await expect(timeSelect.locator('option[value="08:10"]')).toHaveCount(0);
  await expect(timeSelect.locator('option[value="08:20"]')).toHaveCount(0);
  await expect(timeSelect.locator('option[value="08:40"]')).toHaveCount(1);

  await page.evaluate(() => { window.location.hash = '#/settings'; });
  await page.getByRole('tab', { name: 'Serviços' }).click();
  const savedServiceRow = page.locator('.service-catalog-row').filter({ hasText: 'Avaliacao especializada' });
  await savedServiceRow.getByTitle('Excluir serviço').click();
  const deleteDialog = page.getByRole('dialog', { name: 'Excluir serviço?' });
  await expect(deleteDialog).toContainText('Os agendamentos já cadastrados serão preservados.');
  await deleteDialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(savedServiceRow).toBeVisible();

  await savedServiceRow.getByTitle('Excluir serviço').click();
  await page.getByRole('dialog', { name: 'Excluir serviço?' }).getByRole('button', { name: 'Excluir serviço' }).click();
  await expect(savedServiceRow).toHaveCount(0);
});

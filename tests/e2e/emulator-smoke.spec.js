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

test('renders the compact registration fields and product payment options', async ({ page }) => {
  await signIn(page, 'admin@leadflow.test');

  await page.getByRole('button', { name: /Nova abordagem/ }).click();
  await expect(page).toHaveURL(/#\/new$/);
  await page.getByLabel('Loja de destino').selectOption('loja-02');
  await expect(page.getByLabel('Interesse principal')).toBeEnabled();

  const examPrice = page.getByLabel('Valor do exame');
  expect(Number(await examPrice.inputValue())).toBeGreaterThan(0);
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

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

test('loads the real appointment flow for a receptionist profile', async ({ page }) => {
  await signIn(page, 'balcao@leadflow.test');

  await page.getByRole('button', { name: /Agenda de exames/ }).click();
  await expect(page).toHaveURL(/#\/appointments$/);
  await expect(page.getByText('Agenda de exames')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Compareceu' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Não compareceu' }).first()).toBeVisible();
});

test('renders the compact registration fields and product payment options', async ({ page }) => {
  await signIn(page, 'admin@leadflow.test');

  await page.getByRole('button', { name: /Nova abordagem/ }).click();
  await expect(page).toHaveURL(/#\/new$/);
  await page.getByLabel('Loja de destino').selectOption('loja-02');
  await expect(page.getByLabel('Interesse principal')).toBeEnabled();

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

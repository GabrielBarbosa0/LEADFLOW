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

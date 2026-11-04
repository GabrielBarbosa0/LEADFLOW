import { expect, test } from '@playwright/test';

test('opens the external operations screen for an administrator in development mode', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();

  const action = page.getByRole('button', { name: /Operação externa/ });
  await expect(action).toBeVisible();
  await action.click();

  await expect(page.getByRole('heading', { name: 'Leads externa' })).toBeVisible();
  await expect(page.locator('#external-operations-start-date')).toBeVisible();
  await expect(page.locator('#external-operations-end-date')).toBeVisible();
  await expect(page.locator('#external-operations-transport')).toHaveValue('all');
  await expect(page.getByRole('button', { name: 'Atualizar rotas' })).toBeVisible();
  await page.locator('#external-operations-end-date').fill('2026-11-04');
  await page.locator('#external-operations-start-date').fill('2026-11-04');
  await expect(page.locator('#external-operations-start-date')).toHaveValue('2026-11-04');
  await page.getByRole('button', { name: 'Atualizar rotas' }).click();
  await expect(page.getByRole('heading', { name: /Rotas de/ })).toContainText('04 de novembro');
  await expect(page.locator('body')).not.toContainText('CPF');
  await page.screenshot({ path: testInfo.outputPath('external-operations.png'), fullPage: true });
});

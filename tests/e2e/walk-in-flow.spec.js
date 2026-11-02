import { expect, test } from '@playwright/test';

test('opens the daily walk-in queue from a full-width standard home action', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('fascinlead:demo-role', 'admin'));
  await page.getByRole('button', { name: 'Abrir modo de desenvolvimento' }).click();

  const primary = page.getByRole('button', { name: /Nova abordagem/ });
  const walkIn = page.getByRole('button', { name: /Novo encaixe rapido/ });
  await expect(primary).toBeVisible();
  await expect(walkIn).toBeVisible();
  await expect(walkIn.locator('.action-icon svg')).toBeVisible();
  const [primaryBox, walkInBox] = await Promise.all([primary.boundingBox(), walkIn.boundingBox()]);
  expect(walkInBox.width).toBeCloseTo(primaryBox.width, 0);
  const colors = await page.evaluate(() => {
    const standardCard = document.querySelector('.action-card:not(.action-card-primary):not(.action-card-walk-in)');
    const walkInCard = document.querySelector('.action-card-walk-in');
    const walkInIcon = walkInCard.querySelector('.action-icon svg');
    return {
      standard: getComputedStyle(standardCard).backgroundColor,
      walkIn: getComputedStyle(walkInCard).backgroundColor,
      icon: getComputedStyle(walkInCard.querySelector('.action-icon')).backgroundColor,
      iconOpacity: getComputedStyle(walkInIcon).opacity
    };
  });
  expect(colors.walkIn).toBe(colors.standard);
  expect(colors.icon).not.toBe('rgba(0, 0, 0, 0)');
  expect(colors.iconOpacity).toBe('1');
  await page.screenshot({ path: testInfo.outputPath('walk-in-home-action.png'), fullPage: true });

  await walkIn.click();
  await expect(page.getByRole('heading', { name: 'Novo encaixe' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fila de encaixes' })).toBeVisible();
  await expect(page.getByPlaceholder('Nome ou CPF')).toBeVisible();
  const today = page.locator('.walk-in-today');
  const back = page.getByRole('button', { name: 'Voltar ao início' });
  const [todayBox, backBox] = await Promise.all([today.boundingBox(), back.boundingBox()]);
  expect(todayBox.x).toBeLessThan(backBox.x);

  const addToQueue = page.getByRole('button', { name: 'Adicionar a fila de encaixes' });
  await expect(addToQueue).toBeDisabled();
  await expect(addToQueue).toHaveClass(/button-primary/);

  const [storeBox, professionalBox] = await Promise.all([
    page.locator('#walk-in-store').boundingBox(),
    page.locator('#walk-in-professional').boundingBox()
  ]);
  expect(storeBox.width).toBeCloseTo(professionalBox.width, 0);
  const headerIconColor = await page.locator('.walk-in-create-panel > header svg').evaluate((element) => getComputedStyle(element).color);
  expect(headerIconColor).toBe('rgb(0, 48, 112)');

  const storeFilter = page.getByLabel('Unidade').last();
  await expect(storeFilter).toHaveValue('');
  const filterStyle = await storeFilter.evaluate((element) => {
    const style = getComputedStyle(element);
    return { height: style.height, background: style.backgroundColor, borderRadius: style.borderRadius };
  });
  expect(filterStyle.height).toBe('50px');
  expect(filterStyle.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(filterStyle.borderRadius).toBe('7px');
  await page.screenshot({ path: testInfo.outputPath('walk-in-queue.png'), fullPage: true });

  await page.getByPlaceholder('Nome ou CPF').fill('Cliente de Encaixe');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText('Nenhum cadastro encontrado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cadastrar cliente rapidamente' }).click();
  await expect(page.getByText('CADASTRO RÁPIDO', { exact: true })).toBeVisible();
  await expect(page.locator('#walk-in-quick-name')).toHaveValue('Cliente de Encaixe');
  await page.locator('#walk-in-quick-phone').fill('81999994321');
  await page.locator('#walk-in-quick-cpf').fill('52998224725');
  await page.locator('#walk-in-reason').selectOption({ index: 1 });
  const quickSubmit = page.getByRole('button', { name: 'Cadastrar e adicionar a fila' });
  await expect(quickSubmit).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('walk-in-quick-registration.png'), fullPage: true });
  await quickSubmit.click();
  await expect(page.getByText('Cliente de Encaixe', { exact: true })).toBeVisible();
  await expect(page.getByText('Cliente cadastrado e adicionado a fila de encaixes.', { exact: true })).toBeVisible();
});

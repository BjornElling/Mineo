import { expect, test, type Page } from '@playwright/test';

import { setFieldValue, setFieldValueAndSettle } from './support/mineoTest';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

test.describe('Bekræftelsesdialog', () => {
  test('holder fokus i dialogen, lukker med Escape og bevarer en åben draft', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Renteberegning' }).click();

    const date = page.locator("input[name='beregningsdato']");
    const deleteAll = page.getByRole('button', { name: 'Slet alle indtastninger' });
    await expect(date).toBeVisible();

    await setFieldValueAndSettle(date, '01-01-2026');
    await expect(date).toHaveValue('01-01-2026');
    await expect(deleteAll).toBeEnabled();

    await setFieldValue(date, '02-02-2026');
    await deleteAll.click();

    const dialog = page.getByRole('dialog');
    const cancel = dialog.getByRole('button', { name: 'Annuller' });
    const confirm = dialog.getByRole('button', { name: 'Ja, slet' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(cancel).toBeFocused();
    await cancel.press('Tab');
    await expect(confirm).toBeFocused();
    await confirm.press('Tab');
    await expect(cancel).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(date).toBeFocused();
    await expect(date).toHaveValue('02-02-2026');

    await date.press('Tab');
    await deleteAll.click();
    await dialog.getByRole('button', { name: 'Ja, slet' }).click();
    await expect(dialog).toBeHidden();
    await expect(date).toHaveValue('');
    await expect(deleteAll).toBeDisabled();

    expect(runtimeErrors).toEqual([]);
  });
});

test.describe('Slet alt-bekræftelse', () => {
  /**
   * `Slet alt` brugte tidligere en native `window.confirm`. Den kunne ikke måles fra Playwright uden en
   * `page.on('dialog')`-handler, så den globale sletning stod helt uden browserdækning — og auditens
   * påstande om «reset-dialogens fokus-/Tab-/Escape-adfærd» kunne ikke efterprøves. Med programmets egen
   * dialog er flowet en almindelig brugerrejse, og netop de tre fælder, §Popup-fokus-restore findes for
   * (WebKits manglende klik-fokus, Escape på dialogens container, MUI-transitionen), kræver rigtige
   * browsere for at kunne fanges.
   */
  test('bevarer data ved Annuller og Escape, rydder ved Ja, slet, og returnerer fokus til menuknappen', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Stamdata' }).click();

    // Et afsluttet felt, der skal overleve begge annulleringsveje og forsvinde ved bekræftelse.
    const navn = page.locator("input[name='skadelidte']");
    await expect(navn).toBeVisible();
    await setFieldValueAndSettle(navn, 'Slet Alt Testperson');
    await expect(navn).toHaveValue('Slet Alt Testperson');

    const sletAlt = page.getByRole('button', { name: /^Slet\salt$/ });
    const dialog = page.getByRole('dialog');

    // Lukkevej 1: Annuller bevarer sagen.
    await sletAlt.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('ADVARSEL: Dette sletter alle ikke-gemte indtastninger i Mineo!');
    await dialog.getByRole('button', { name: 'Annuller' }).click();
    await expect(dialog).toBeHidden();
    await expect(navn).toHaveValue('Slet Alt Testperson');
    await expect(sletAlt).toBeFocused();

    // Lukkevej 2: Escape bevarer sagen. Fokus står i dialogen, ikke på menuknappen, før tasten trykkes.
    await sletAlt.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(navn).toHaveValue('Slet Alt Testperson');
    await expect(sletAlt).toBeFocused();

    // Bekræftelse rydder sagen og afslutter inde i appen på Stamdata.
    await sletAlt.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Ja, slet' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/stamdata$/);
    await expect(page.locator("input[name='skadelidte']")).toHaveValue('');

    expect(runtimeErrors).toEqual([]);
  });
});

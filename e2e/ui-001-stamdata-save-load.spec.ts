import { readFile } from 'node:fs/promises';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('UI-001 – Stamdata Gem/Hent', () => {
  test('viser en synlig besked og åbner ikke filflowet for en urørt ny sag', async ({
    page,
    runtimeErrors,
  }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    await page.getByRole('button', { name: 'Gem', exact: true }).click();

    await expect(page.getByText('Ingen data fundet at gemme', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/stamdata$/);
    expect(runtimeErrors).toEqual([]);
  });

  test('gemmer alle stamdatafelter og gendanner dem efter synlig Hent-rejse', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    const journalnr = page.locator('input[name="journalnr"]');
    const advokat = page.locator('input[name="advokat"]');
    const sagsbehandler = page.locator('input[name="sagsbehandler"]');
    const skadelidte = page.locator('input[name="skadelidte"]');
    const foedselsdato = page.locator('input[name="skadelidteFodselsdato"]');
    const skadetype = page.getByRole('combobox', { name: 'Skadestype' });
    const skadedato = page.locator('input[name="skadedato"]');

    await setFieldValueAndSettle(journalnr, 'UI001-FIKTIV-SAG');
    await setFieldValueAndSettle(advokat, 'AB');
    await setFieldValueAndSettle(sagsbehandler, 'CD');
    await setFieldValueAndSettle(skadelidte, 'Fiktiv person');
    await setFieldValueAndSettle(foedselsdato, '01-01-1980');
    await skadetype.click();
    await page.getByRole('option', { name: 'Arbejdsulykke', exact: true }).click();
    await setFieldValueAndSettle(skadedato, '01-02-2020');

    const saveDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Gem', exact: true }).click();
    const savedDownload = await saveDownloadPromise;
    expect(savedDownload.suggestedFilename()).toMatch(/\.eo$/i);

    const savedPath = await savedDownload.path();
    expect(savedPath).not.toBeNull();
    if (savedPath === null) throw new Error('Den gemte .eo-fil blev ikke skrevet til en lokal fil.');

    const savedBytes = await readFile(savedPath);
    expect(savedBytes.length).toBeGreaterThan(100);
    expect(savedBytes.toString('utf8')).toContain('"alg": "A256GCM"');
    await expect(page.getByText('Din browser kan ikke overskrive en eksisterende .eo-fil.', { exact: false })).toBeVisible();

    await setFieldValueAndSettle(journalnr, 'UI001-ANDEN-SAG');
    await setFieldValueAndSettle(skadelidte, 'En anden fiktiv person');
    await expect(journalnr).toHaveValue('UI001-ANDEN-SAG');
    await expect(skadelidte).toHaveValue('En anden fiktiv person');

    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Hent', exact: true }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'gemt-sag.eo',
      mimeType: 'application/octet-stream',
      buffer: savedBytes,
    });

    const overwriteDialog = page.getByRole('dialog').filter({
      hasText: 'Erstat de aktuelle indtastninger?',
    });
    await expect(overwriteDialog).toBeVisible();
    await expect(overwriteDialog).toContainText('Handlingen kan ikke fortrydes.');
    await overwriteDialog.getByRole('button', { name: 'Erstat', exact: true }).click();
    await expect(overwriteDialog).toBeHidden();

    await expect(page.locator('.page-title')).toHaveText('Stamdata');
    await expect(journalnr).toHaveValue('UI001-FIKTIV-SAG');
    await expect(advokat).toHaveValue('AB');
    await expect(sagsbehandler).toHaveValue('CD');
    await expect(skadelidte).toHaveValue('Fiktiv person');
    await expect(foedselsdato).toHaveValue('01-01-1980');
    await expect(skadetype).toHaveValue('Arbejdsulykke');
    await expect(skadedato).toHaveValue('01-02-2020');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

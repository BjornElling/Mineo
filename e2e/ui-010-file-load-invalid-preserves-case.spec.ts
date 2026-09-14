import {
  expect,
  login,
  openPage,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const installInvalidFilePickerFixture = async (page: Parameters<typeof login>[0]): Promise<void> => {
  await page.evaluate(() => {
    const file = new File(['ikke en Mineo-fil'], 'forkert.yml', { type: 'text/yaml' });
    const fileHandle = {
      kind: 'file' as const,
      name: file.name,
      getFile: async () => file,
    };

    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => [fileHandle],
    });
  });
};

test.describe('UI-010 – ugyldig fil ændrer ikke aktiv sag', () => {
  test('viser filfejlen og bevarer aktivt journalnummer', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    const journalnr = page.getByRole('textbox', { name: 'Journalnr.' });
    await setVerbatimFieldValueAndSettle(journalnr, 'AKTIV-FØR-UGYLDIG-FIL');
    await expect(journalnr).toHaveValue('AKTIV-FØR-UGYLDIG-FIL');

    await installInvalidFilePickerFixture(page);
    await page.getByRole('button', { name: 'Hent', exact: true }).click();

    await expect(page.getByText('Valgt fil er ikke en .eo fil', { exact: true })).toBeVisible();
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(/\/stamdata$/);
    await expect(journalnr).toHaveValue('AKTIV-FØR-UGYLDIG-FIL');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

import {
  expect,
  login,
  openPage,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const installCancelledSaveFilePickerFixture = async (page: Parameters<typeof login>[0]): Promise<void> => {
  await page.evaluate(() => {
    const probe = { calls: 0 };
    Object.defineProperty(window, '__mineoCancelledSavePickerProbe', {
      configurable: true,
      value: probe,
    });
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => {
        probe.calls += 1;
        throw Object.assign(new Error('Bruger lukkede filvælgeren'), { name: 'AbortError' });
      },
    });
  });
};

test.describe('UI-010 – annulleret Gem-filvælger ændrer ikke aktiv sag', () => {
  test('bevarer aktivt journalnummer når brugeren lukker Gem-picker uden filvalg', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    const journalnr = page.getByRole('textbox', { name: 'Journalnr.' });
    await setVerbatimFieldValueAndSettle(journalnr, 'AKTIV-FØR-ANNULLERET-GEM-PICKER');
    await expect(journalnr).toHaveValue('AKTIV-FØR-ANNULLERET-GEM-PICKER');

    await installCancelledSaveFilePickerFixture(page);
    await page.getByRole('button', { name: 'Gem', exact: true }).click();

    await expect.poll(() => page.evaluate(() => (
      (window as Window & {
        __mineoCancelledSavePickerProbe?: { calls: number };
      }).__mineoCancelledSavePickerProbe?.calls ?? 0
    ))).toBe(1);
    await expect(page).toHaveURL(/\/stamdata$/);
    await expect(journalnr).toHaveValue('AKTIV-FØR-ANNULLERET-GEM-PICKER');
    await expect(page.getByText('Gemt', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Teknisk advarsel registreret', { exact: true })).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  test,
} from './support/mineoTest';

const installCancelledFilePickerFixture = async (page: Parameters<typeof login>[0]): Promise<void> => {
  await page.evaluate(() => {
    const probe = { calls: 0 };
    Object.defineProperty(window, '__mineoCancelledPickerProbe', {
      configurable: true,
      value: probe,
    });
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => {
        probe.calls += 1;
        throw Object.assign(new Error('Bruger lukkede filvælgeren'), { name: 'AbortError' });
      },
    });
  });
};

test.describe('UI-010 – annulleret filvælger ændrer ikke aktiv sag', () => {
  test('bevarer aktivt journalnummer når brugeren lukker Hent-picker uden filvalg', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    const journalnr = page.locator('input[name="journalnr"]');
    await setFieldValueAndSettle(journalnr, 'AKTIV-FØR-ANNULLERET-PICKER');
    await expect(journalnr).toHaveValue('AKTIV-FØR-ANNULLERET-PICKER');

    await installCancelledFilePickerFixture(page);
    await page.getByRole('button', { name: 'Hent', exact: true }).click();

    await expect.poll(() => page.evaluate(() => (
      (window as Window & {
        __mineoCancelledPickerProbe?: { calls: number };
      }).__mineoCancelledPickerProbe?.calls ?? 0
    ))).toBe(1);
    await expect(page).toHaveURL(/\/stamdata$/);
    await expect(journalnr).toHaveValue('AKTIV-FØR-ANNULLERET-PICKER');
    await expect(page.getByText('Hentet', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

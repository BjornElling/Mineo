import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  test,
} from './support/mineoTest';
import { BROWSER_LANE_TAG } from './support/lanes';
import { APP_SETTINGS_LOCAL_STORAGE_KEY } from '../src/settings/themeBootstrap';

test.describe('UI-009 – device-lokale indstillinger', () => {
  test('bevarer og synkroniserer valg mellem to faner', async ({ page, context, runtimeErrors, runtimeSignals }) => {
    await login(page);
    await openPage(page, 'Indstillinger');
    const other = await context.newPage();
    const otherErrors: string[] = [];
    other.on('pageerror', (error) => otherErrors.push(error.message));
    other.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') otherErrors.push(message.text());
    });
    const holdWrites = async () => {
      await page.evaluate((key) => new Promise<void>((acquired) => {
        void navigator.locks.request(key, async () => {
          acquired();
          await new Promise<void>((release) => window.addEventListener('release-settings-lock', () => release(), { once: true }));
        });
      }), APP_SETTINGS_LOCAL_STORAGE_KEY);
    };
    const releaseWrites = () => page.evaluate(() => window.dispatchEvent(new Event('release-settings-lock')));
    try {
      await other.goto('/');
      await openPage(other, 'Indstillinger');
      // Hold skriveadgangen tilbage, så testen beviser, at handlingen venter på fælleslåsen.
      await holdWrites();
      try {
        await other.getByRole('radio', { name: 'Mørkt', exact: true }).click();
        await expect(other.getByRole('radio', { name: 'Mørkt', exact: true })).not.toBeChecked();
      } finally {
        await releaseWrites();
      }
      await expect(page.getByRole('radio', { name: 'Mørkt', exact: true })).toBeChecked();
      const bilagsvalg = other.getByRole('checkbox', { name: 'Bilagsnumre i erstatningsopgørelser', exact: true });
      await bilagsvalg.click();
      await expect(bilagsvalg).toBeChecked();
      await expect(other.getByRole('radio', { name: 'Mørkt', exact: true })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: 'Bilagsnumre i erstatningsopgørelser', exact: true })).toBeChecked();

      // Begge handlinger står nu i kø samtidig, uden at browserens to musemarkører konkurrerer.
      await holdWrites();
      try {
        await page.bringToFront();
        await page.getByRole('checkbox', { name: 'SH-dage', exact: true }).click();
        await other.bringToFront();
        await other.getByRole('checkbox', { name: 'Satser', exact: true }).click();
        await expect(page.getByRole('checkbox', { name: 'SH-dage', exact: true })).not.toBeChecked();
        await expect(other.getByRole('checkbox', { name: 'Satser', exact: true })).not.toBeChecked();
      } finally {
        await releaseWrites();
      }
      const stored = await page.evaluate((key) => navigator.locks.request(key, () => localStorage.getItem(key)), APP_SETTINGS_LOCAL_STORAGE_KEY);
      expect(JSON.parse(stored ?? '{}')).toMatchObject({ brevhovedIndstillinger: { shDage: true, satser: true } });
      for (const tab of [page, other]) {
        await expect(tab.getByRole('checkbox', { name: 'SH-dage', exact: true })).toBeChecked();
        await expect(tab.getByRole('checkbox', { name: 'Satser', exact: true })).toBeChecked();
      }
      await page.reload();
      await expect(page.locator('.page-title')).toHaveText('Indstillinger');
      await expect(page.getByRole('radio', { name: 'Mørkt', exact: true })).toBeChecked();
      await expect(page.getByRole('checkbox', { name: 'Bilagsnumre i erstatningsopgørelser', exact: true })).toBeChecked();
      expect(otherErrors).toEqual([]);
      expect(runtimeErrors).toEqual([]);
      expect(runtimeSignals).toEqual([]);
    } finally {
      await other.close();
    }
  });

  // Mappevælgeren findes ikke i Firefox/WebKit; den faktiske browser-capability skal måles.
  test('forklarer manglende mappevalg uden teknisk advarsel', { tag: BROWSER_LANE_TAG }, async ({ page, runtimeErrors, runtimeSignals }, testInfo) => {
    await login(page);
    await openPage(page, 'Indstillinger');
    const supported = await page.evaluate(() => 'showDirectoryPicker' in window && typeof window.showDirectoryPicker === 'function');
    const button = page.getByRole('button', { name: 'Vælg mappe' });
    if (supported) {
      await expect(button).toBeEnabled();
    } else {
      await expect(button).toBeDisabled();
      await button.locator('..').hover();
      await expect(page.getByRole('tooltip')).toHaveText('Denne browser understøtter ikke valg af en fast mappe til gemte filer.');
      await expect(page.getByText('Skrivebord (standard)', { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('mappevalg-uden-understoettelse.png') });
    }
    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
  });

  test('bevarer tema og dokumentformat efter reload uden at miste sagsinput', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    const journalnr = page.getByRole('textbox', { name: 'Journalnr.' });
    await setFieldValueAndSettle(journalnr, 'UI009-FIKTIV-SAG');
    await expect(journalnr).toHaveValue('UI009-FIKTIV-SAG');

    await openPage(page, 'Indstillinger');

    const darkTheme = page.getByRole('radio', { name: 'Mørkt', exact: true });
    await darkTheme.click();
    await expect(darkTheme).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-mineo-theme', 'dark');

    const documentFormat = page.getByRole('combobox', { name: 'Download-format for dokumenter' });
    await documentFormat.click();
    await page.getByRole('option', { name: 'Word', exact: true }).click();
    await expect(documentFormat).toHaveValue('Word');

    await page.reload();

    await expect(page.locator('.page-title')).toHaveText('Indstillinger');
    await expect(page.getByRole('radio', { name: 'Mørkt', exact: true })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-mineo-theme', 'dark');
    await expect(
      page.getByRole('combobox', { name: 'Download-format for dokumenter' }),
    ).toHaveValue('Word');

    await openPage(page, 'Stamdata');
    await expect(page.getByRole('textbox', { name: 'Journalnr.' })).toHaveValue('UI009-FIKTIV-SAG');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('viser valgt mappe og vender tilbage til skrivebordet ved nulstilling', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Indstillinger');

    await expect(page.getByText('Skrivebord (standard)', { exact: true })).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(window, 'showDirectoryPicker', {
        configurable: true,
        value: async () => ({ kind: 'directory', name: 'E2E-sager' }),
      });
    });

    await page.getByRole('button', { name: 'Vælg mappe' }).click();
    await expect(page.getByText('E2E-sager', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nulstil til skrivebord' })).toBeVisible();

    await page.getByRole('button', { name: 'Nulstil til skrivebord' }).click();
    await expect(page.getByText('Skrivebord (standard)', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nulstil til skrivebord' })).not.toBeVisible();

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

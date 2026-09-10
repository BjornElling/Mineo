import { expect, login, openPage, setVerbatimFieldValueAndSettle, test } from './support/mineoTest';

test.describe('Sessionbevaring ved browser-reload', () => {
  test('bevarer afsluttet input og valgt fane efter reload', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');

    const eoNummer = page.locator("input[name='eoNummer']");
    const loenindkomstTab = page.getByRole('tab', { name: 'Lønindkomst', exact: true });

    await setVerbatimFieldValueAndSettle(eoNummer, 'EO-42');
    await expect(eoNummer).toHaveValue('EO-42');

    await loenindkomstTab.click();
    await expect(loenindkomstTab).toHaveAttribute('aria-selected', 'true');

    await page.reload();

    await expect(page.locator('.page-title')).toHaveText('Erstatningsopgørelse');
    await expect(loenindkomstTab).toHaveAttribute('aria-selected', 'true');
    await expect(eoNummer).toHaveValue('EO-42');
    expect(runtimeErrors).toEqual([]);
  });
});

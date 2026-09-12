import {
  expect,
  login,
  openPage,
  test,
} from './support/mineoTest';

test.describe('TD-029 – kontrolfaner slås fra på aktiv kontrolfane', () => {
  test('skjuler kontrolfanerne og falder tilbage til EO oplysninger', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);

    await openPage(page, 'Erstatningsopgørelse');
    await openPage(page, 'Indstillinger');

    const showControlTabs = page.getByRole('checkbox', {
      name: 'Vis kontrolfaner på Erstatningsopgørelse-side',
    });
    await expect(showControlTabs).not.toBeChecked();
    await showControlTabs.click();
    await expect(showControlTabs).toBeChecked();

    await openPage(page, 'Erstatningsopgørelse');
    const inspectionTab = page.getByRole('button', { name: 'EO-kontrol', exact: true });
    await expect(inspectionTab).toBeVisible();
    await inspectionTab.click();
    await expect(page.getByRole('tab', { name: 'EO oplysninger', exact: true }))
      .toHaveAttribute('aria-selected', 'false');

    await openPage(page, 'Indstillinger');
    await showControlTabs.click();
    await expect(showControlTabs).not.toBeChecked();

    await openPage(page, 'Erstatningsopgørelse');
    await expect(page.getByRole('button', { name: 'EO-kontrol', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Kontroltabel', exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'EO oplysninger', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[role="tabpanel"]:visible .section-header').first())
      .toHaveText('Erstatningsopgørelse');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

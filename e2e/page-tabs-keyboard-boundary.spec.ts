import { expect, login, test } from './support/mineoTest';

test.describe('PageTabs og indholdets tastaturgrænse', () => {
  test('faner kan betjenes, mens indholdets Tab-sekvens ikke rammer fanerne', async ({
    page,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await page.getByRole('button', { name: 'Varige mén', exact: true }).click();
    await expect(page).toHaveURL(/\/varigemen$/);

    const menberegningTab = page.getByRole('tab', { name: 'Ménberegning', exact: true });
    const satserTab = page.getByRole('tab', { name: 'Satser', exact: true });

    await menberegningTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(satserTab).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(satserTab).toHaveAttribute('aria-selected', 'true');

    await menberegningTab.focus();
    await page.keyboard.press('Enter');
    await expect(menberegningTab).toHaveAttribute('aria-selected', 'true');

    const firstContentControl = page.locator('main input[name="mengrad"]');
    await expect(firstContentControl).toBeVisible();
    await firstContentControl.focus();
    await page.keyboard.press('Shift+Tab');

    const readFocusBoundary = () => page.evaluate(() => {
      const active = document.activeElement;
      return {
        inMain: active?.closest('main') !== null,
        isTabNavigation: active?.getAttribute('data-mineo-tab-navigation') === 'true',
      };
    });
    await expect.poll(readFocusBoundary).toEqual({ inMain: true, isTabNavigation: false });

    await page.keyboard.press('Tab');
    await expect(firstContentControl).toBeFocused();

    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

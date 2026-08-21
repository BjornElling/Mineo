import { BROWSER_LANE_TAG } from './support/lanes';
import { expect, login, openPage, test } from './support/mineoTest';

// Browserbanen: Tab-rækkefølgen mellem faner og indhold afgøres af motorens egen traversering, og
// den er ikke ens i Chromium, Gecko og WebKit. Grænsen skal derfor måles i alle fire.
test.describe('PageTabs og indholdets tastaturgrænse', { tag: BROWSER_LANE_TAG }, () => {
  test('faner kan betjenes, mens indholdets Tab-sekvens ikke rammer fanerne', async ({
    page,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Varige mén');
    await expect(page).toHaveURL(/\/varigemen$/);

    const menberegningTab = page.getByRole('tab', { name: 'Beregning', exact: true });
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

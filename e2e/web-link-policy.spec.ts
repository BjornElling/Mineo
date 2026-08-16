import { expect, login, test } from './support/mineoTest';

test.describe('web-link-politik', () => {
  test('eksterne links åbner i ny fane og er ude af Tab-rækkefølgen', async ({ page }) => {
    await login(page);

    const externalLinks = page.locator('a[href^="http://"], a[href^="https://"]');
    await expect(externalLinks).not.toHaveCount(0);
    for (const link of await externalLinks.all()) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(link).toHaveAttribute('tabindex', '-1');
    }

    await page.evaluate(() => document.body.focus());
    const focusedExternalHrefs: string[] = [];
    for (let index = 0; index < 32; index += 1) {
      await page.keyboard.press('Tab');
      const href = await page.evaluate(() => {
        const active = document.activeElement;
        return active instanceof HTMLAnchorElement && /^https?:/.test(active.href) ? active.href : null;
      });
      if (href !== null) focusedExternalHrefs.push(href);
    }
    expect(focusedExternalHrefs).toEqual([]);
  });

  test('klik på et eksternt link bevarer Mineo-fanen', async ({ page }) => {
    await login(page);
    await page.route('https://github.com/**', (route) => route.abort());

    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'github.com/BjornElling/Mineo' }).click();
    const popup = await popupPromise;

    await expect(page).toHaveURL(/\/mineo$/);
    await popup.close();
    await page.unroute('https://github.com/**');
  });

  test('Retsinfo-henvisninger følger samme eksterne linkregel', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Satser' }).click();

    const referenceLink = page.locator('main a[href^="https://www.retsinformation.dk/"]').first();
    await expect(referenceLink).toBeVisible();
    await expect(referenceLink).toHaveAttribute('target', '_blank');
    await expect(referenceLink).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(referenceLink).toHaveAttribute('tabindex', '-1');
  });
});

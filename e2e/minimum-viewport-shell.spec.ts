import { expect, test, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';
const MENU_BUTTON_NAMES = [
  'Stamdata',
  'Erstatningsopgørelse',
  'Erhvervsevnetab',
  'Varige mén',
  'Forsørgertab',
  'Årslønsberegning',
  'Renteberegning',
  'Satser',
  'Gem',
  'Hent',
  'Slet alt',
  'Indstillinger',
  'Om',
] as const;

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
  await expect(page.getByRole('button', { name: 'Om' })).toBeVisible();
};

const readMenuGeometry = async (page: Page) => {
  const menuToggle = page.getByRole('button', { name: /Fold menuen/ });
  const menu = menuToggle.locator('xpath=../..');

  return menu.evaluate((element) => {
    const menuRect = element.getBoundingClientRect();
    const descendants = [element, ...Array.from(element.querySelectorAll('*'))];
    const internalScrollRegions = descendants
      .filter((node) => {
        const style = window.getComputedStyle(node);
        return style.overflowY === 'auto' || style.overflowY === 'scroll'
          || style.overflow === 'auto' || style.overflow === 'scroll';
      })
      .map((node) => ({
        tagName: node.tagName,
        className: typeof node.className === 'string' ? node.className : '',
      }));
    const buttons = Array.from(element.querySelectorAll('button')).map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        name: button.getAttribute('aria-label') ?? '',
        visible: Boolean(button.offsetWidth || button.offsetHeight || button.getClientRects().length),
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      };
    });

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio,
      menu: {
        top: menuRect.top,
        bottom: menuRect.bottom,
        left: menuRect.left,
        right: menuRect.right,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      },
      buttons,
      internalScrollRegions,
    };
  });
};

test.describe('Mineo-shell ved minimumsviewporten 1536×864', () => {
  test('alle sidemenu- og globalhandlinger er synlige og nåbare uden intern sidemenu-scroll', async ({ page }) => {
    await login(page);

    for (const expanded of [true, false]) {
      if (expanded) {
        await expect(page.getByRole('button', { name: 'Fold menuen sammen' })).toHaveAttribute('aria-expanded', 'true');
      } else {
        await page.getByRole('button', { name: 'Fold menuen sammen' }).click();
        await expect(page.getByRole('button', { name: 'Fold menuen ud' })).toHaveAttribute('aria-expanded', 'false');
      }

      const geometry = await readMenuGeometry(page);
      expect(geometry.viewport.width).toBeGreaterThanOrEqual(1536);
      expect(geometry.viewport.height).toBeGreaterThanOrEqual(864);
      expect(geometry.devicePixelRatio).toBeGreaterThan(0);
      expect(geometry.internalScrollRegions).toEqual([]);
      expect(geometry.menu.scrollHeight).toBe(geometry.menu.clientHeight);
      expect(geometry.buttons.map((button) => button.name.replace(/\u00a0/g, ' ')).slice(1)).toEqual(MENU_BUTTON_NAMES);
      expect(geometry.buttons.every((button) => (
        button.visible
        && button.top >= geometry.menu.top
        && button.bottom <= geometry.menu.bottom
        && button.left >= geometry.menu.left
        && button.right <= geometry.menu.right
      ))).toBe(true);
    }
  });

  test('Tab når det sidste menupunkt, og menuen kan aktiveres med tastatur', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'Fold menuen sammen' }).focus();
    for (let i = 0; i < MENU_BUTTON_NAMES.length; i += 1) {
      await page.keyboard.press('Tab');
    }

    await expect(page.getByRole('button', { name: 'Om' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/mineo$/);
    await expect(page.getByRole('button', { name: 'Om' })).toBeFocused();
  });
});

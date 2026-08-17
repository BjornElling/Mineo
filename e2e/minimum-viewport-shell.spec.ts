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
        layoutHeight: getComputedStyle(button).height,
        marginBottom: getComputedStyle(button).marginBottom,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      };
    });
    const menuContent = element.querySelector<HTMLElement>('[data-mineo-menu-content-scale-root="true"]');

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
      menuContent: menuContent === null
        ? null
        : {
          scale: getComputedStyle(menuContent).zoom,
          top: menuContent.getBoundingClientRect().top,
          bottom: menuContent.getBoundingClientRect().bottom,
        },
      buttons,
      internalScrollRegions,
    };
  });
};

test.describe('Mineo-shell ved minimumsviewporter', () => {
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
      expect(geometry.viewport.width).toBeGreaterThanOrEqual(1366);
      expect(geometry.viewport.height).toBeGreaterThanOrEqual(620);
      expect(geometry.devicePixelRatio).toBeGreaterThan(0);
      expect(geometry.internalScrollRegions).toEqual([]);
      expect(geometry.menuContent).not.toBeNull();
      expect(Number(geometry.menuContent?.scale)).toBeGreaterThanOrEqual(0.78);
      expect(Number(geometry.menuContent?.scale)).toBeLessThanOrEqual(1);
      expect(geometry.buttons.map((button) => button.name.replace(/\u00a0/g, ' ')).slice(1)).toEqual(MENU_BUTTON_NAMES);
      if (geometry.viewport.height >= 864) {
        expect(geometry.menuContent?.scale).toBe('1');
        expect(geometry.buttons.slice(1).every((button) => (
          button.layoutHeight === '44px' && button.marginBottom === '4px'
        ))).toBe(true);
      }
      expect(geometry.buttons.every((button) => (
        button.visible
        && button.top >= geometry.menu.top
        && button.bottom <= geometry.menu.bottom
        && button.left >= geometry.menu.left
        && button.right <= geometry.menu.right
      ))).toBe(true);
    }
  });

  test('menuen går tavst ud over vinduet under den dækkede minimumshøjde', async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1366, height: 580 });

    const geometry = await readMenuGeometry(page);
    expect(geometry.internalScrollRegions).toEqual([]);
    expect(Number(geometry.menuContent?.scale)).toBe(0.78);
    const aboutButton = geometry.buttons.find((button) => button.name === 'Om');
    expect(aboutButton).toBeDefined();
    expect(aboutButton?.bottom).toBeGreaterThan(geometry.menu.bottom);
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

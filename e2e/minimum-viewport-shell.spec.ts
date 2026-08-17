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
  // Hamburgerens wrapper ligger under indholdsroden. Forankr målingen i den eksisterende
  // autoritative markerede rod, så en intern omlægning af menuheaderen ikke ændrer testens mål.
  const menu = page.locator('[data-mineo-menu-content-scale-root="true"]').locator('xpath=..');

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
      const iconRect = button.querySelector('svg')?.getBoundingClientRect();
      return {
        name: button.getAttribute('aria-label') ?? '',
        visible: Boolean(button.offsetWidth || button.offsetHeight || button.getClientRects().length),
        layoutHeight: getComputedStyle(button).height,
        marginBottom: getComputedStyle(button).marginBottom,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        iconCenterX: iconRect === undefined ? null : (iconRect.left + iconRect.right) / 2,
      };
    });
    const menuContent = element.querySelector<HTMLElement>('[data-mineo-menu-content-scale-root="true"]');
    const firstDivider = menuContent?.querySelector<HTMLElement>('.MuiDivider-root');

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
        width: menuRect.width,
      },
      menuContent: menuContent === null
        ? null
        : {
          scale: getComputedStyle(menuContent).zoom,
          top: menuContent.getBoundingClientRect().top,
          bottom: menuContent.getBoundingClientRect().bottom,
          firstDividerTop: firstDivider?.getBoundingClientRect().top ?? null,
        },
      buttons,
      internalScrollRegions,
    };
  });
};

test.describe('Mineo-shell ved minimumsviewporter', () => {
  test('alle sidemenu- og globalhandlinger er synlige og nåbare uden intern sidemenu-scroll', async ({ page }) => {
    await login(page);
    let expandedIconCenters: ReadonlyMap<string, number> | null = null;

    for (const expanded of [true, false]) {
      if (expanded) {
        await expect(page.getByRole('button', { name: 'Fold menuen sammen' })).toHaveAttribute('aria-expanded', 'true');
        await expect.poll(async () => {
          const geometry = await readMenuGeometry(page);
          const contentScale = Number(geometry.menuContent?.scale);
          const expectedWidth = 190 + 60 * ((Math.max(0.78, Math.min(1, contentScale)) - 0.78) / 0.22);
          return Math.abs(geometry.menu.width - expectedWidth) < 1;
        }).toBe(true);
      } else {
        await page.getByRole('button', { name: 'Fold menuen sammen' }).click();
        await expect(page.getByRole('button', { name: 'Fold menuen ud' })).toHaveAttribute('aria-expanded', 'false');
        await expect.poll(async () => {
          const geometry = await readMenuGeometry(page);
          return Math.abs(geometry.menu.width - 70) < 1;
        }).toBe(true);
      }

      let geometry = await readMenuGeometry(page);
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
      if (expanded) {
        const contentScale = Number(geometry.menuContent?.scale);
        const expectedWidth = 190 + 60 * ((Math.max(0.78, Math.min(1, contentScale)) - 0.78) / 0.22);
        expect(geometry.menu.width).toBeCloseTo(expectedWidth, 1);
        const hamburger = geometry.buttons[0];
        expect(hamburger).toBeDefined();
        // Hamburgeren er altid ikon-only. Også udfoldet må dens hoverflade derfor være kvadratisk
        // og have samme luft omkring ikonet som i den kollapsede menu.
        expect(Math.abs((hamburger?.width ?? 0) - (hamburger?.height ?? 0))).toBeLessThanOrEqual(1);
        expandedIconCenters = new Map(geometry.buttons.map((button) => [button.name, button.iconCenterX ?? Number.NaN]));
      }
      if (!expanded) {
        await expect.poll(async () => {
          const collapsedGeometry = await readMenuGeometry(page);
          const contentScale = Number(collapsedGeometry.menuContent?.scale);
          const expectedIconButtonSize = 44 * contentScale;
          const menuCenter = (collapsedGeometry.menu.left + collapsedGeometry.menu.right) / 2;
          return collapsedGeometry.buttons.every((button) => (
            Math.abs(button.width - button.height) <= 1
            && Math.abs(button.width - expectedIconButtonSize) <= 1
            && Math.abs(((button.left + button.right) / 2) - menuCenter) <= 1
          ));
        }).toBe(true);
        geometry = await readMenuGeometry(page);
        const hamburger = geometry.buttons[0];
        expect(hamburger).toBeDefined();
        expect(geometry.menuContent?.firstDividerTop).not.toBeNull();
        expect(((hamburger.top + hamburger.bottom) / 2)).toBeCloseTo((geometry.menuContent?.firstDividerTop ?? 0) / 2, 1);
        for (const button of geometry.buttons) {
          const expandedCenter = expandedIconCenters?.get(button.name === 'Fold menuen ud' ? 'Fold menuen sammen' : button.name);
          expect(button.iconCenterX).not.toBeNull();
          expect(expandedCenter).toBeDefined();
          // Ikonaksen er den samme på begge sider af foldningen. En mærkbar afvigelse her er et
          // reelt spring; browsernes afrunding af delvis zoom må højst give en kvart px.
          expect(Math.abs((button.iconCenterX ?? 0) - (expandedCenter ?? 0))).toBeLessThanOrEqual(0.25);
        }
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

  test('kollaps flytter ikke menuikonerne under animationen', async ({ page }) => {
    await login(page);

    const frames = await page.evaluate(async () => {
      const menuContent = document.querySelector<HTMLElement>('[data-mineo-menu-content-scale-root="true"]');
      const menu = menuContent?.parentElement;
      if (menu === undefined || menu === null) throw new Error('Mangler sidemenu.');

      const readButtonGeometry = () => Array.from(menu.querySelectorAll<HTMLButtonElement>(
        'button[aria-label]',
      )).map((button) => {
        const buttonRect = button.getBoundingClientRect();
        const iconRect = button.querySelector('svg')?.getBoundingClientRect();
        return {
          name: button.getAttribute('aria-label'),
          top: buttonRect.top,
          iconCenterX: iconRect === undefined ? null : (iconRect.left + iconRect.right) / 2,
        };
      });
      const toggle = document.querySelector<HTMLButtonElement>('[aria-label="Fold menuen sammen"]');
      if (toggle === null) throw new Error('Mangler menuknap.');

      toggle.click();
      const capturedFrames: ReturnType<typeof readButtonGeometry>[] = [];
      for (let index = 0; index < 20; index += 1) {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        capturedFrames.push(readButtonGeometry());
      }
      return capturedFrames;
    });

    const initialFrame = frames[0];
    for (const frame of frames) {
      expect(frame).toHaveLength(initialFrame.length);
      for (const [index, button] of frame.entries()) {
        expect(button.name).toBe(initialFrame[index].name);
        // Layoutmotoren kan afrunde zoomede px forskelligt mellem frames. Under en halv px er
        // det ikke en synlig omorganisering af menuen; større flytning er en regression.
        expect(Math.abs(button.top - initialFrame[index].top)).toBeLessThanOrEqual(0.5);
        // Hamburgeren må, præcis som de øvrige ikoner, skifte layout atomisk. Ellers animerer
        // dens indrykning fra et kort venstrespring tilbage til dens faste ikonakse.
        expect(Math.abs((button.iconCenterX ?? 0) - (initialFrame[index].iconCenterX ?? 0))).toBeLessThanOrEqual(1);
      }
    }
  });
});

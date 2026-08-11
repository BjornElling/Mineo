import { expect, test, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';
const TOOLTIP_TEXT = 'Juridisk omtvistet, men nyere retspraksis hælder mod fuld sats';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

const lineWidths = async (page: Page): Promise<number[]> => page.locator('[role="tooltip"] > .MuiTooltip-tooltip').evaluate((element) => {
  const textNode = element.firstChild;
  if (!(textNode instanceof Text)) return [];

  const range = document.createRange();
  range.selectNodeContents(textNode);
  return [...range.getClientRects()]
    .reduce<Array<{ left: number; top: number; width: number }>>((lines, rect) => {
      const previous = lines.at(-1);
      if (previous && Math.abs(previous.top - rect.top) < 0.5) {
        previous.width = Math.max(previous.width, rect.right - previous.left);
      } else {
        lines.push({ left: rect.left, top: rect.top, width: rect.width });
      }
      return lines;
    }, [])
    .map((line) => line.width);
});

test.describe('fælles tooltip-ombrydning', () => {
  test('balancerer lange beskeder og bevarer hele ord', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Erstatningsopgørelse' }).click();

    const infoIcon = page
      .getByText('Svie/smerte-sats ved delvis sygemelding:')
      .locator('svg[data-testid="InfoOutlinedIcon"]');
    await infoIcon.hover();

    const tooltip = page.getByRole('tooltip', { name: TOOLTIP_TEXT });
    await expect(tooltip).toBeVisible();
    const tooltipContent = tooltip.locator('.MuiTooltip-tooltip');
    expect(await tooltipContent.textContent()).toBe(TOOLTIP_TEXT);
    const alignment = await tooltipContent.evaluate((element) => {
      const style = getComputedStyle(element);
      return { direction: style.direction, textAlign: style.textAlign };
    });
    expect(alignment.direction).toBe('ltr');
    // CSSOM kan rapportere venstrejustering som den logiske værdi `start` i stedet for `left`.
    expect(['left', 'start']).toContain(alignment.textAlign);
    await expect(tooltipContent).toHaveCSS('white-space', 'normal');
    // MUI/Emotion serialiserer shorthand-værdien som CSS-longhanden `text-wrap-style`.
    await expect(tooltipContent).toHaveCSS('text-wrap-style', 'balance');
    await expect(tooltipContent).toHaveCSS('overflow-wrap', 'break-word');
    await expect(tooltipContent).toHaveCSS('word-break', 'normal');

    const widths = await lineWidths(page);
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBeGreaterThan(140);
    expect(widths[1]).toBeGreaterThan(140);
    expect(Math.abs((widths[0] ?? 0) - (widths[1] ?? 0))).toBeLessThan(40);

    const longTokenLayout = await tooltipContent.evaluate((element) => {
      const probe = element.cloneNode(false) as HTMLDivElement;
      probe.textContent = 'X'.repeat(800);
      probe.style.position = 'fixed';
      probe.style.left = '0';
      probe.style.top = '0';
      probe.style.visibility = 'hidden';
      document.body.append(probe);
      const result = {
        clientWidth: probe.clientWidth,
        scrollWidth: probe.scrollWidth,
        height: probe.getBoundingClientRect().height,
      };
      probe.remove();
      return result;
    });
    expect(longTokenLayout.scrollWidth).toBeLessThanOrEqual(longTokenLayout.clientWidth + 1);
    expect(longTokenLayout.height).toBeGreaterThan(20);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});

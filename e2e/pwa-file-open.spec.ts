import { expect, test } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

test.describe('PWA-filåbning', () => {
  test('registrerer launchQueue-consumeren før den synlige loginrejse er afsluttet', async ({ page }) => {
    const runtimeSignals: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        runtimeSignals.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => runtimeSignals.push(`pageerror: ${error.message}`));

    await page.addInitScript(() => {
      const probe = { consumerRegistered: false };
      Object.defineProperty(window, '__mineoPwaFileOpenProbe', {
        configurable: true,
        value: probe,
      });
      Object.defineProperty(window, 'launchQueue', {
        configurable: true,
        value: {
          setConsumer: () => {
            probe.consumerRegistered = true;
          },
        },
      });
    });

    await page.goto('/open');
    await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Log ind' }).click();

    await expect.poll(() => page.evaluate(() => {
      const probe = (window as Window & {
        __mineoPwaFileOpenProbe?: { consumerRegistered: boolean };
      }).__mineoPwaFileOpenProbe;
      return probe?.consumerRegistered ?? false;
    })).toBe(true);
    await expect(page.getByText('Indlæsning af fil blev afbrudt')).toBeVisible();

    expect(runtimeSignals).toEqual([]);
  });
});

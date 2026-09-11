import { expect, TEST_PASSWORD, test } from './support/mineoTest';

test.describe('PWA-filåbning', () => {
  test('registrerer launchQueue-consumeren før den synlige loginrejse er afsluttet', async ({
    page,
    runtimeSignals,
  }) => {

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
    // /open er kun filhandlerens landing. Den må ikke vise en kunstig fejl, mens den
    // durable PWA-request fortsætter i app-shellen efter login.
    await expect(page).toHaveURL(/\/stamdata$/);

    expect(runtimeSignals).toEqual([]);
  });
});

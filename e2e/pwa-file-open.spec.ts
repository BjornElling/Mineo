import { expect, login, test } from './support/mineoTest';
import { BROWSER_LANE_TAG } from './support/lanes';

/**
 * Dette er kun et native kapabilitetsbevis. Playwright kan starte en browser og registrere en
 * consumer, men kan ikke starte den installerede PWA fra operativsystemets filassociation og
 * dermed ikke levere en virkelig `.eo`-fil til køen. Selve filafleveringen er derfor fortsat
 * dækket af appens deterministiske unit-tests og den syntetiske registreringsprøve nedenfor.
 */
test.describe('Native launchQueue-kapabilitet', { tag: BROWSER_LANE_TAG }, () => {
  test('Chromium eksponerer det native LaunchQueue-objekt', async ({
    page,
    browserName,
    runtimeErrors,
  }) => {
    test.skip(browserName !== 'chromium', 'Det native LaunchQueue-bevis hører til Chromium-laget.');

    await page.goto('/');

    const launchQueueShape = await page.evaluate(() => {
      const queue = (window as Window & { launchQueue?: unknown }).launchQueue;
      return {
        objectTag: Object.prototype.toString.call(queue),
        setConsumer: typeof (queue as { setConsumer?: unknown } | null)?.setConsumer,
      };
    });

    expect(launchQueueShape).toEqual({
      objectTag: '[object LaunchQueue]',
      setConsumer: 'function',
    });
    expect(runtimeErrors).toEqual([]);
  });
});

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

    await login(page, '/open');

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

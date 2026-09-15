import { expect, login, openPage, setFieldValueAndSettle, test } from './support/mineoTest';
import { BROWSER_LANE_TAG } from './support/lanes';

const pasteText = async (
  input: Parameters<typeof setFieldValueAndSettle>[0],
  text: string,
): Promise<boolean> => input.evaluate((element, value) => {
    // Firefox ignorerer `clipboardData` i en syntetisk ClipboardEvent-konstruktør. En almindelig bubbling-
    // event giver produktets onPaste-handler den samme clipboardData-kontrakt i alle browserbaner.
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { getData: (format: string) => (format === 'text' || format === 'text/plain' ? value : '') },
    });
    element.dispatchEvent(pasteEvent);
    return pasteEvent.defaultPrevented;
  }, text);

// Copy/paste er en browserafhængig brugerrejse: både den native clipboard og tastaturgenvejene skal
// fungere i alle de motorer, Mineo understøtter.
test.describe('kopi og indsæt i inputfelter', { tag: BROWSER_LANE_TAG }, () => {
  test('kopierer en beløbsformel og indsætter den fra første tegn', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Renteberegning');

    const firstRow = page.locator('tbody tr').first();
    const source = firstRow.getByRole('textbox', { name: 'Beløb' });
    await setFieldValueAndSettle(source, '1000+250');
    await expect(source).toHaveValue('1.250,00');

    const secondRow = page.locator('tbody tr').nth(1);
    const target = secondRow.getByRole('textbox', { name: 'Beløb' });
    await setFieldValueAndSettle(target, '9');
    await expect(target).toHaveValue('9,00');

    await page.evaluate(() => {
      window.addEventListener('copy', (event) => {
        document.body.dataset.mineoCopiedText = event.clipboardData?.getData('text/plain') ?? '';
      });
    });
    await source.click();
    await source.press('Control+C');
    await expect.poll(() => page.locator('body').getAttribute('data-mineo-copied-text')).toBe('1000+250');
    await target.click();
    expect(await pasteText(target, '1000+250')).toBe(true);

    // Lukket paste committer straks. En ny copy af målfeltet er derfor den stærkeste browserkontrol:
    // den viser, at den fulde formel blev indsat og bevaret, ikke kun det beregnede resultat.
    await expect(target).toHaveValue('1.250,00');
    await target.press('Control+C');
    await expect.poll(() => page.locator('body').getAttribute('data-mineo-copied-text')).toBe('1000+250');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

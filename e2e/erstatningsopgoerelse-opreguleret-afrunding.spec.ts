import { readFile } from 'node:fs/promises';

import caseFixture from './fixtures/manuel-regulering-med-tillaeg.json' with { type: 'json' };
import { encryptToString } from '../src/utils/encryption';
import { extractPdfText } from '../src/__tests__/utils/pdf/pdfTextExtractor';
import { expect, login, openPage, test } from './support/mineoTest';

test('opreguleret TAF viser samme afrundingslinje som TAF fordelt på år', async ({
  page, runtimeErrors, runtimeSignals, externalRequests,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
  });
  await login(page);
  await openPage(page, 'Stamdata');
  // Årsskiftet og forliget giver tilsammen en afrundingsforskel på én øre.
  const fixture = {
    ...caseFixture,
    data: {
      ...caseFixture.data,
      erstatningsopgoerelse: {
        ...caseFixture.data.erstatningsopgoerelse,
        vedroererPeriodeFra: '2025-12-03',
        forligAnsvarsgradProcent: 17,
        tafPerioder: [{ id: 'taf-afrunding', fra: '2025-12-03', til: '2026-09-20' }],
      },
    },
  };
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Hent', exact: true }).click();
  await (await chooser).setFiles({
    name: 'fiktiv-afrundingssag.eo', mimeType: 'application/octet-stream',
    buffer: Buffer.from(await encryptToString(fixture)),
  });
  await expect(page.locator('input[name="journalnr"]')).toHaveValue('REGULERING-FIKTIV');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openPage(page, 'Erstatningsopgørelse');
  await page.getByRole('tab', { name: 'Beregning', exact: true }).click();

  for (const label of ['TAF fordelt på kalenderår', 'TAF opreguleret til beregningsåret']) {
    const row = page.locator('.row--label-right-hover').filter({ hasText: label });
    await expect(row.getByRole('button')).toBeEnabled();
    const download = page.waitForEvent('download');
    await row.getByRole('button').click();
    const path = await (await download).path();
    if (path === null) throw new Error('TAF-dokumentet mangler.');
    const pdf = await readFile(path);
    const text = (await extractPdfText(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }))).replace(/\s+/g, ' ');
    expect(text).toMatch(/Afrunding\s+-\s*0,01 kr\./);
    expect(text.indexOf('Afrunding')).toBeLessThan(text.indexOf(label === 'TAF fordelt på kalenderår' ? 'Samlet TAF-krav' : 'Samlet TAF opreguleret'));
    await testInfo.attach(label, { body: pdf, contentType: 'application/pdf' });
  }
  await testInfo.attach('afrunding-download-desktop', { body: await page.screenshot(), contentType: 'image/png' });
  expect(runtimeErrors).toEqual([]);
  expect(runtimeSignals).toEqual([]);
  expect(externalRequests).toEqual([]);
});

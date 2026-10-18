import { readFile } from 'node:fs/promises';

import caseFixture from './fixtures/manuel-regulering-med-tillaeg.json' with { type: 'json' };
import { encryptToString } from '../src/utils/encryption';
import { expect, login, openPage, setFieldValueAndSettle, setVerbatimFieldValueAndSettle, test } from './support/mineoTest';

test('TAF-grafen kan hentes med midlertidigt EET fra Erhvervsevnetab-siden', async ({
  page, runtimeErrors, runtimeSignals, externalRequests,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
  });
  await login(page);
  await openPage(page, 'Stamdata');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Hent', exact: true }).click();
  await (await chooser).setFiles({
    name: 'fiktiv-grafsag.eo', mimeType: 'application/octet-stream',
    buffer: Buffer.from(await encryptToString(caseFixture)),
  });
  await expect(page.locator('input[name="journalnr"]')).toHaveValue('REGULERING-FIKTIV');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await openPage(page, 'Erhvervsevnetab');
  await page.getByRole('tab', { name: 'EET oplysninger', exact: true }).click();
  await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '25-09-2026');
  await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '300000');
  await setVerbatimFieldValueAndSettle(page.getByRole('textbox', { name: 'Afgørelsesdato', exact: true }).first(), '01-06-2026');
  await setVerbatimFieldValueAndSettle(page.getByRole('textbox', { name: 'Virkningsdato', exact: true }).first(), '01-06-2026');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'EET %', exact: true }).first(), '20');
  await page.getByRole('combobox', { name: 'Afgørelsestype', exact: true }).first().click();
  await page.getByRole('option', { name: 'Midlertidig', exact: true }).click();

  await openPage(page, 'Erstatningsopgørelse');
  await page.locator("[data-section-id='aes'] input[name='midlertidigtEETAfgorelse']").check();
  await setVerbatimFieldValueAndSettle(page.locator('input[name="midlertidigEETAfgoerelseDato"]'), '01-06-2026');
  await page.getByRole('tab', { name: 'Offentlige ydelser', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden', exact: true }).check();
  await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Midlertidig EET', exact: true })).toBeChecked();
  const graf = page.locator('.row--label-right-hover').filter({ hasText: 'Visuel graf over indtægtsniveau' });
  const button = graf.getByRole('button');
  await expect(button).toBeEnabled();
  await graf.scrollIntoViewIfNeeded();
  await testInfo.attach('graf-download-desktop', { body: await page.screenshot(), contentType: 'image/png' });
  const download = page.waitForEvent('download');
  await button.click();
  const path = await (await download).path();
  if (path === null) throw new Error('Grafens PDF mangler.');
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  await testInfo.attach('taf-graf-med-eet', { body: bytes, contentType: 'application/pdf' });
  expect(runtimeErrors).toEqual([]);
  expect(runtimeSignals).toEqual([]);
  expect(externalRequests).toEqual([]);
});

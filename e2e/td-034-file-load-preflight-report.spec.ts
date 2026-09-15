import { type Page } from '@playwright/test';

import {
  expect,
  login,
  openPage,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const buildLegacyPartialFile = async (page: Page): Promise<Buffer> => {
  const container = {
    version: '1.0.0',
    _metadata: {
      exportDate: '2026-08-17T00:00:00.000Z',
      appVersion: 'e2e-regression',
      persistedDataVersion: '3.12',
      fieldCount: 2,
    },
    data: {
      stamdata: {
        journalnr: 'LEGACY-42',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Indlæst fra ældre fil',
        skadestype: undefined,
        skadedato: undefined,
        fjernetLegacyFelt: 'kan ikke længere indlæses',
      },
    },
  };

  // Testfilen krypteres i browseren med samme containerformat som en rigtig `.eo`-fil.
  const encrypted = await page.evaluate(async (loadContainer) => {
    const toBase64 = (bytes: Uint8Array): string => {
      let binary = '';
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return btoa(binary);
    };

    const material = new TextEncoder().encode('MINEO_OBFUSCATION_KEY_V1');
    const hash = await crypto.subtle.digest('SHA-256', material);
    const key = await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(loadContainer, null, 2));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      plaintext,
    );

    return JSON.stringify({
      version: 1,
      alg: 'A256GCM',
      ivB64: toBase64(iv),
      ctB64: toBase64(new Uint8Array(ciphertext)),
    }, null, 2);
  }, container);

  return Buffer.from(encrypted);
};

const installOpenPickerFixture = async (page: Page, bytes: Buffer): Promise<void> => {
  await page.evaluate((fileBytes) => {
    const file = new File(
      [Uint8Array.from(fileBytes)],
      'aeldre-sag.eo',
      { type: 'application/octet-stream' },
    );
    const fileHandle = {
      kind: 'file' as const,
      name: file.name,
      getFile: async () => file,
    };

    // Chrome viser ellers en native picker, som ikke kan få en testfil fra Playwright. Klikket på
    // Hent går stadig gennem appens synlige File System Access-vej – kun browserens dialogresultat
    // erstattes af den samme filhandle, som brugeren ville have valgt.
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: async () => [fileHandle],
    });
  }, [...bytes]);
};

test.describe('TD-034 – lokal fejlrapport fra load-preflight', () => {
  test('viser lokalt fejlrapport-preview fra preflight uden automatisk afsendelse', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    const journalnr = page.getByRole('textbox', { name: 'Journalnr.' });
    await setVerbatimFieldValueAndSettle(journalnr, 'AKTIV-FØR-FEJLRAPPORT');

    await installOpenPickerFixture(page, await buildLegacyPartialFile(page));
    await page.getByRole('button', { name: 'Hent' }).click();

    const preflightDialog = page.getByRole('dialog').filter({
      hasText: 'Nogle felter blev sat til standardværdier',
    });
    await expect(preflightDialog).toBeVisible();
    const reportButton = preflightDialog.getByRole('button', { name: 'Send fejloplysninger', exact: true });
    await expect(reportButton).toBeVisible();

    await reportButton.click();

    const reportDialog = page.getByRole('dialog').filter({
      hasText: 'Fejlrapport (gennemgå før du sender)',
    });
    await expect(reportDialog).toBeVisible();
    await expect(reportDialog.getByRole('alert')).toContainText(
      'Rapporten kan indeholde persondata eller sagsoplysninger.',
    );
    const reportPreview = reportDialog.locator('textarea');
    await expect(reportPreview).toHaveValue(/Hent fil: Preflight advarsel/);
    await expect(reportPreview).toHaveValue(/Fil: aeldre-sag\.eo/);
    await expect(reportDialog.getByRole('button', { name: 'Åbn email' })).toBeEnabled();

    // Udviklerbeslutning TD-088: Luk afslutter hele fejlrapportforløbet, inklusive den
    // underliggende preflight-dialog.
    await reportDialog.getByRole('button', { name: 'Luk', exact: true }).click();
    await expect(reportDialog).toBeHidden();
    await expect(preflightDialog).toBeHidden();

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

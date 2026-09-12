import { type Page } from '@playwright/test';
import { expect, login, openPage, setVerbatimFieldValueAndSettle, test } from './support/mineoTest';

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
        // Simulerer et fjernet felt: load skal give preflight, men de øvrige data skal stadig kunne erstatte
        // den aktive sag efter begge eksplicitte bekræftelser.
        fjernetLegacyFelt: 'kan ikke længere indlæses',
      },
    },
  };

  // Fixtures krypteres i den kørende browser med samme AES-GCM-format som `.eo`-filer. Test-runneren
  // kan ikke importere Vites client-moduler (de bruger `import.meta.env`), så protokollen ligger lokalt
  // her i stedet for at gøre testkørslen afhængig af runnerens modulformat.
  const encrypted = await page.evaluate(async (loadContainer) => {
    const toBase64 = (bytes: Uint8Array): string => {
      let binary = '';
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return btoa(binary);
    };
    const subtle = crypto.subtle;
    const material = new TextEncoder().encode('MINEO_OBFUSCATION_KEY_V1');
    const hash = await subtle.digest('SHA-256', material);
    const key = await subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(loadContainer, null, 2));
    const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plaintext);
    return JSON.stringify({
      version: 1,
      alg: 'A256GCM',
      ivB64: toBase64(iv),
      ctB64: toBase64(new Uint8Array(ciphertext)),
    }, null, 2);
  }, container);

  return Buffer.from(encrypted);
};

// Chrome/Edge bruger den native File System Access-picker, som Playwright ikke kan sende en fil til.
// Denne fil tildeles derfor WebKit-projektet i playwright.config.ts og kører dér uden at skippe.
test.describe('Filvalidering ved Hent', () => {

  test('viser forventelig filfejl uden teknisk fejlregistrering', async ({ page, runtimeErrors }) => {
    await login(page);
    await page.getByRole('button', { name: 'Hent' }).click();

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles({
      name: 'forkert.yml',
      mimeType: 'text/yaml',
      buffer: Buffer.from('ikke en Mineo-fil'),
    });

    await expect(page.getByText('Valgt fil er ikke en .eo fil', { exact: true })).toBeVisible();
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);
    expect(runtimeErrors).toEqual([]);
  });

  test('en ældre fil erstatter den aktive sag efter preflight og overskrivelsesbekræftelse', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    const nameInput = page.locator("input[name='skadelidte']");
    await setVerbatimFieldValueAndSettle(nameInput, 'Aktiv sag før indlæsning');

    await page.getByRole('button', { name: 'Hent' }).click();
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles({
      name: 'aeldre-sag.eo',
      mimeType: 'application/octet-stream',
      buffer: await buildLegacyPartialFile(page),
    });

    const preflightDialog = page.getByRole('dialog').filter({
      hasText: 'Nogle felter blev sat til standardværdier',
    });
    await expect(preflightDialog).toBeVisible();
    await preflightDialog.getByRole('button', { name: 'Indlæs trods fejl' }).click();

    // Preflight er ikke i sig selv en erstatning. Den aktive sag må først ændres efter den anden,
    // særskilte bekræftelse – det er præcis den kombination, der tidligere blev meldt som usikker.
    const overwriteDialog = page.getByRole('dialog').filter({
      hasText: 'Erstat de aktuelle indtastninger?',
    });
    await expect(overwriteDialog).toBeVisible();
    await expect(overwriteDialog).toContainText('Handlingen kan ikke fortrydes.');
    await expect(nameInput).toHaveValue('Aktiv sag før indlæsning');
    // Det er en brugerhandling: den almindelige actionability-kontrol må ikke omgås, fordi et overlay
    // eller en animation, der blokerer klikket, netop ville være en reel fejl i denne bekræftelsesrejse.
    await overwriteDialog.getByRole('button', { name: 'Erstat' }).click();

    await expect(overwriteDialog).toBeHidden();
    await expect.poll(() => runtimeErrors).toEqual([]);
    await expect(page).toHaveURL(/\/stamdata$/);
    await expect(nameInput).toHaveValue('Indlæst fra ældre fil');
    await expect(page.getByText('Filen er indlæst – nogle felter blev sat til standardværdier.')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });

  test('bevarer den aktive sag, når brugeren stopper direkte i preflight', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    const nameInput = page.locator("input[name='skadelidte']");
    await setVerbatimFieldValueAndSettle(nameInput, 'Aktiv sag før afvisning');

    await page.getByRole('button', { name: 'Hent' }).click();
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles({
      name: 'aeldre-sag.eo',
      mimeType: 'application/octet-stream',
      buffer: await buildLegacyPartialFile(page),
    });

    const preflightDialog = page.getByRole('dialog').filter({
      hasText: 'Nogle felter blev sat til standardværdier',
    });
    await expect(preflightDialog).toBeVisible();
    await expect(preflightDialog.getByRole('button', { name: 'Stop og gør intet' })).toBeVisible();

    await preflightDialog.getByRole('button', { name: 'Stop og gør intet' }).click();

    await expect(preflightDialog).toBeHidden();
    await expect(page).toHaveURL(/\/stamdata$/);
    await expect(nameInput).toHaveValue('Aktiv sag før afvisning');
    await expect(page.getByText('Filen er indlæst – nogle felter blev sat til standardværdier.')).toHaveCount(0);
    expect(runtimeErrors).toEqual([]);
  });
});

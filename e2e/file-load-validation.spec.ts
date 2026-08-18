import { expect, test, type Page } from '@playwright/test';
import { setVerbatimFieldValueAndSettle } from './support/mineoTest';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

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

test.describe('Filvalidering ved Hent', () => {
  test('viser forventelig filfejl uden teknisk fejlregistrering', async ({ page, browserName }) => {
    // Chrome/Edge bruger den native File System Access-picker, mens WebKit gennemløber den testbare
    // fallback-inputflade, som er den konkrete OBS-008-reproduktion.
    test.skip(browserName !== 'webkit', 'OBS-008-fallbacken testes i WebKit');
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

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

  test('en ældre fil erstatter den aktive sag efter preflight og overskrivelsesbekræftelse', async ({
    page,
    browserName,
  }) => {
    // Kun WebKit bruger den testbare fallback-filvælger. Chromium-browsere bruger den native
    // File System Access-dialog, som Playwright ikke kan sende en fil til.
    test.skip(browserName !== 'webkit', 'Den ægte fallback-filvælger testes i WebKit');
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Stamdata' }).click();

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
    // særskilte bekræftelse — det er præcis den kombination, der tidligere blev meldt som usikker.
    const overwriteDialog = page.getByRole('dialog').filter({
      hasText: 'Erstat de aktuelle indtastninger?',
    });
    await expect(overwriteDialog).toBeVisible();
    await expect(nameInput).toHaveValue('Aktiv sag før indlæsning');
    // Bekræftelsen erstatter synkront dialogfasen med apply-fasen. I WebKit kan MUI derfor unmount'e
    // knappen mellem Playwrights actionability-tjek og mouseup. Force bevarer den normale musehændelsesvej,
    // men lader ikke portal-animationens layoutskift blive fejlagtigt til en testtimeout.
    await overwriteDialog.getByRole('button', { name: 'Erstat' }).click({ force: true });

    await expect(overwriteDialog).toBeHidden();
    await expect.poll(() => runtimeErrors).toEqual([]);
    await expect(page).toHaveURL(/\/stamdata$/);
    await expect(nameInput).toHaveValue('Indlæst fra ældre fil');
    await expect(page.getByText('Filen er indlæst — nogle felter blev sat til standardværdier.')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });
});

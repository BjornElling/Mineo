import { createCipheriv, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, login, openPage, setVerbatimFieldValueAndSettle, test } from './support/mineoTest';
import type { Page } from '@playwright/test';

const buildEncryptedFile = (dataJson: string): string => {
  // Uafhængig format-fixture. Rå JSON tillader angrebsdybder, som JSON.stringify selv afviser.
  const json = `{"version":"1.0.0","_metadata":{"exportDate":"2026-10-27T00:00:00.000Z","appVersion":"sikkerhedstest","fieldCount":2},"data":${dataJson}}`;
  const iv = Buffer.alloc(12, 7);
  const key = createHash('sha256').update('MINEO_OBFUSCATION_KEY_V1').digest();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(json, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return JSON.stringify({ version: 1, alg: 'A256GCM', ivB64: iv.toString('base64'), ctB64: ciphertext.toString('base64') });
};

const installLaunchQueueFixture = (page: Page) => page.addInitScript(() => {
  Object.defineProperty(window, 'launchQueue', {
    configurable: true,
    value: {
      setConsumer: (consumer: (params: { files: FileSystemFileHandle[] }) => void) => {
        Object.defineProperty(window, '__mineoSecurityLaunch', { configurable: true, value: consumer });
      },
    },
  });
});

const openFile = async (page: Page, source: 'manual' | 'pwa', content: string): Promise<void> => {
  await page.evaluate(async ({ source, content }) => {
    // En rigtig browser-handle kan gemmes i IndexedDB. Kun operativsystemets
    // levering/picker-resultat erstattes; indlæsning og PWA-kø kører som i produktet.
    const directory = await navigator.storage.getDirectory();
    const handle = await directory.getFileHandle('sikkerhedstest.eo', { create: true });
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    if (source === 'manual') {
      Object.defineProperty(window, 'showOpenFilePicker', {
        configurable: true, value: async () => [handle],
      });
    } else {
      const launch = (window as Window & {
        __mineoSecurityLaunch?: (params: { files: FileSystemFileHandle[] }) => void;
      }).__mineoSecurityLaunch;
      if (!launch) throw new Error('PWA-consumeren skal være registreret');
      launch({ files: [handle] });
    }
  }, { source, content });
  if (source === 'manual') await page.getByRole('button', { name: 'Hent', exact: true }).click();
};

test.describe('.eo-filer med ondsindet struktur', () => {
  for (const source of ['manual', 'pwa'] as const) {
    test(`afviser ekstrem indlejring via ${source} og kan derefter indlæse en historisk fil`, async ({
      page, runtimeErrors, runtimeSignals, externalRequests,
    }) => {
      if (source === 'pwa') await installLaunchQueueFixture(page);
      await login(page);
      await openPage(page, 'Stamdata');
      const journal = page.getByRole('textbox', { name: 'Journalnr.' });
      await setVerbatimFieldValueAndSettle(journal, 'AKTIV-SAG');

      const deep = '{"x":'.repeat(10000) + '1' + '}'.repeat(10000);
      await openFile(page, source, buildEncryptedFile(`{"stamdata":{"journalnr":"ANGREB"},"ukendt":${deep}}`));

      await expect(page.getByText('Kunne ikke indlæse fil. Tjek at filen er gyldig.', { exact: true })).toBeVisible();
      await expect(journal).toHaveValue('AKTIV-SAG');
      await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);

      const historicalFile = readFileSync('src/__tests__/fixtures/persistence/legacy-unversioned-cross-section.eo', 'utf8');
      await openFile(page, source, historicalFile);
      const overwrite = page.getByRole('dialog').filter({ hasText: 'Erstat de aktuelle indtastninger?' });
      await expect(overwrite).toBeVisible();
      await expect(page.getByText('Nogle felter blev sat til standardværdier', { exact: true })).toHaveCount(0);
      await overwrite.getByRole('button', { name: 'Erstat', exact: true }).click();
      await expect(journal).toHaveValue('J-HISTORISK');

      expect(runtimeErrors).toEqual([]);
      expect(runtimeSignals).toEqual([]);
      expect(externalRequests).toEqual([]);
    });
  }

  test('rapporterer særlige feltnavne og bevarer gyldig tekst ved accepteret delvis indlæsning', async ({
    page, runtimeErrors, runtimeSignals, externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    const text = '<script>uønsket kode</script> – constructor og __proto__';
    await openFile(page, 'manual', buildEncryptedFile(JSON.stringify({
      stamdata: {
        journalnr: 'J-SIKKER', skadelidte: text,
        ['__proto__']: { skadelidte: 'FORFALSKET' },
        constructor: { prototype: { skadelidte: 'FORFALSKET' } },
      },
    })));

    const preflight = page.getByRole('dialog').filter({ hasText: 'Nogle felter blev sat til standardværdier' });
    await expect(preflight).toBeVisible();
    await preflight.getByRole('button', { name: 'Indlæs trods fejl', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Journalnr.' })).toHaveValue('J-SIKKER');
    await expect(page.getByRole('textbox', { name: 'Skadelidtes navn', exact: true })).toHaveValue(text);
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);
    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

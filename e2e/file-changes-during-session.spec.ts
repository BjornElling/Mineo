import { expect, login, openPage, setFieldValueAndSettle, test } from './support/mineoTest';

type FileProbe = { current: FileSystemFileHandle; next: FileSystemFileHandle; pickerCalls: number; cancel: boolean };

const installFileSystem = async (page: Parameters<typeof login>[0], folder?: string): Promise<void> => {
  await page.evaluate(async (folderName) => {
    // Ægte browserhandles kan serialiseres til IndexedDB. Kun de native filvælgere erstattes;
    // sletning, skrivning, read-back og handle-persistens kører gennem browserens filsystem.
    const root = await navigator.storage.getDirectory();
    const directory = folderName ? await root.getDirectoryHandle(folderName, { create: true }) : root;
    const probe = {
      current: await directory.getFileHandle('sag.eo', { create: true }),
      next: await directory.getFileHandle('ny-sag.eo', { create: true }),
      pickerCalls: 0,
      cancel: false,
    };
    Object.defineProperty(window, '__mineoFileProbe', { configurable: true, value: probe });
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: async () => [probe.current] });
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () => {
        probe.pickerCalls += 1;
        if (probe.cancel) throw new DOMException('Annulleret', 'AbortError');
        return probe.pickerCalls === 1 ? probe.current : probe.next;
      },
    });
  }, folder);
};

test.describe('Ændringer af .eo-filen under en åben sag', () => {
  test('en ventende fil fra gammel udgivelse kræver et aktivt valg og genafspilles ikke efter Annuller', async ({ page, runtimeErrors, runtimeSignals }, testInfo) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await setFieldValueAndSettle(page.locator('input[name="skadelidte"]'), 'Fiktiv person');
    await installFileSystem(page);
    await page.getByRole('button', { name: 'Gem', exact: true }).click();
    await expect(page.getByText('Gemt', { exact: true })).toBeVisible();
    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BEVARES UDEN INDLÆSNING');
    await page.evaluate(async () => {
      const handle = (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe.current;
      // Tilstanden svarer til den tidligere offentliggjorte udgivelses ID og pending-record.
      // Login og sagsinput etableres gennem den synlige brugerrejse ovenfor.
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('mineo_file_handles', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('handles', 'readwrite');
          transaction.objectStore('handles').put({
            id: 'pwa-open-legacy-1', createdAtEpochMs: Date.now(), fileHandle: handle,
            fileName: handle.name, ignoredFileCount: 0,
          }, 'client:client-legacy-session-1234:pending-pwa-open-request');
          transaction.objectStore('handles').put(handle, 'client:client-legacy-session-1234:current-file-handle');
          transaction.oncomplete = () => { db.close(); resolve(); };
          transaction.onerror = () => { db.close(); reject(transaction.error); };
        };
      });
      sessionStorage.setItem('mineo_fileOperationClientSession', 'client-legacy-session-1234');
    });
    await page.reload();
    const offer = page.getByRole('dialog').filter({ hasText: 'venter fra en tidligere Mineo-session' });
    await expect(offer).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('ventende-fil.png'), animations: 'disabled' });
    await expect(page.locator('input[name="journalnr"]')).toHaveValue('BEVARES UDEN INDLÆSNING');
    await offer.getByRole('button', { name: 'Annuller', exact: true }).click();
    await expect(offer).toBeHidden();
    await page.reload();
    await expect(page.locator('.page-title')).toHaveText('Stamdata');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Journalnr.' })).toHaveValue('BEVARES UDEN INDLÆSNING');
    await installFileSystem(page);
    await page.getByRole('button', { name: 'Gem', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe.pickerCalls)).toBe(1);
    await expect(page.getByText('Gemt', { exact: true })).toBeVisible();
    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
  });

  test('en duplikeret fane kan ikke flytte den oprindelige fanes Gem til en identisk kopi', async ({ page, runtimeErrors, runtimeSignals }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await setFieldValueAndSettle(page.locator('input[name="skadelidte"]'), 'Fiktiv person');
    await installFileSystem(page);
    await page.getByRole('button', { name: 'Gem', exact: true }).click();
    await expect(page.getByText('Gemt', { exact: true })).toBeVisible();
    const original = await page.evaluate(async () => (await (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe.current.getFile()).text());

    // window.open kopierer browserens sessionStorage gennem den rigtige browservej.
    // To kunstigt separate browserkontekster ville skjule netop denne klient-ID-kollision.
    const popupPromise = page.waitForEvent('popup');
    await page.evaluate(() => { window.open('/stamdata', '_blank'); });
    const copy = await popupPromise;
    await expect(copy.locator('.page-title')).toHaveText('Stamdata');
    await installFileSystem(copy, 'anden-mappe');
    await copy.evaluate(async (content) => {
      const probe = (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe;
      const stream = await probe.current.createWritable();
      await stream.write(content);
      await stream.close();
    }, original);
    await copy.getByRole('button', { name: 'Hent', exact: true }).click();
    const replace = copy.getByRole('dialog').filter({ hasText: 'Erstat de aktuelle indtastninger?' });
    await expect(replace).toBeVisible();
    await replace.getByRole('button', { name: 'Erstat', exact: true }).click();
    await expect(replace).toBeHidden();

    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'ÆNDRING I OPRINDELIG FANE');
    await page.getByRole('button', { name: 'Gem', exact: true }).click();
    await expect.poll(() => page.evaluate(async () => (await (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe.current.getFile()).text())).not.toBe(original);
    expect(await copy.evaluate(async () => (await (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe.current.getFile()).text())).toBe(original);
    expect(await page.evaluate(() => (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe.pickerCalls)).toBe(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(copy.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);
    await expect(copy.getByText('Teknisk advarsel registreret', { exact: true })).toHaveCount(0);
    await copy.close();
    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
  });

  test('afviser en samtidig browserstream uden at overskrive eller tænde teknisk alarm', async ({ page, runtimeErrors, runtimeSignals }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await setFieldValueAndSettle(page.locator('input[name="skadelidte"]'), 'Fiktiv person');
    await installFileSystem(page);
    await page.getByRole('button', { name: 'Gem', exact: true }).click();
    await expect(page.getByText('Gemt', { exact: true })).toBeVisible();
    const before = await page.evaluate(async () => {
      const probe = (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe;
      const content = await (await probe.current.getFile()).text();
      const stream = await probe.current.createWritable();
      Object.defineProperty(window, '__mineoExternalStream', { configurable: true, value: stream });
      return content;
    });
    await page.getByRole('button', { name: 'Gem', exact: true }).click();
    await expect(page.getByText('Filen kan ikke overskrives lige nu', { exact: false })).toBeVisible();
    const after = await page.evaluate(async () => {
      await (window as unknown as Window & { __mineoExternalStream: FileSystemWritableFileStream }).__mineoExternalStream.abort();
      return (await (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe.current.getFile()).text();
    });
    expect(after).toBe(before);
    await page.getByRole('button', { name: 'Gem', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe.pickerCalls)).toBe(2);
    await expect(page.getByText('Gemt', { exact: true })).toBeVisible();
    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
  });

  for (const cancel of [false, true]) {
    test(`slettet indlæst fil giver nyt filvalg uden teknisk alarm, annullering=${cancel}`, async ({ page, runtimeErrors, runtimeSignals }) => {
      await login(page);
      await openPage(page, 'Stamdata');
      const name = page.locator('input[name="skadelidte"]');
      await setFieldValueAndSettle(name, 'Fiktiv person');
      await installFileSystem(page);
      await page.getByRole('button', { name: 'Gem', exact: true }).click();
      await expect(page.getByText('Gemt', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Hent', exact: true }).click();
      const replace = page.getByRole('dialog').filter({ hasText: 'Erstat de aktuelle indtastninger?' });
      await expect(replace).toBeVisible();
      await replace.getByRole('button', { name: 'Erstat', exact: true }).click();
      await expect(replace).toBeHidden();

      await page.evaluate(async (cancelPicker) => {
        const probe = (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe;
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(probe.current.name);
        probe.cancel = cancelPicker;
      }, cancel);
      await page.getByRole('button', { name: 'Gem', exact: true }).click();
      await expect.poll(() => page.evaluate(() => (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe.pickerCalls)).toBe(2);
      if (!cancel) {
        await expect(page.getByText('Den tidligere valgte fil blev ikke fundet', { exact: false })).toBeVisible();
        expect(await page.evaluate(async () => (await (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe.next.getFile()).size)).toBeGreaterThan(100);
      }
      await expect(name).toHaveValue('Fiktiv person');
      expect(runtimeErrors).toEqual([]);
      expect(runtimeSignals).toEqual([]);
    });
  }

  for (const choice of ['Annuller', 'Overskriv', 'Gem i en anden fil'] as const) {
    test(`ekstern ændring bevares indtil brugeren vælger ${choice}`, async ({ page, runtimeErrors, runtimeSignals }, testInfo) => {
      await login(page);
      await openPage(page, 'Stamdata');
      await setFieldValueAndSettle(page.locator('input[name="skadelidte"]'), 'Fiktiv person');
      await installFileSystem(page);
      await page.getByRole('button', { name: 'Gem', exact: true }).click();
      await expect(page.getByText('Gemt', { exact: true })).toBeVisible();
      if (choice === 'Annuller') {
        // F5 skal bevare sammenligningsgrundlaget. Filvælger-fixturen installeres igen,
        // men målet genfindes gennem produktets egen IndexedDB og browsermetadata.
        await page.reload();
        await expect(page.locator('.page-title')).toHaveText('Stamdata');
        await installFileSystem(page);
        await page.evaluate(() => { (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe.pickerCalls = 1; });
      }
      await page.evaluate(async () => {
        const { current } = (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe;
        const stream = await current.createWritable();
        await stream.write('Ekstern ændring');
        await stream.close();
      });
      await page.getByRole('button', { name: 'Gem', exact: true }).click();
      const dialog = page.getByRole('dialog').filter({ hasText: 'Filen er ændret' });
      await expect(dialog).toBeVisible();
      for (const button of ['Annuller', 'Overskriv', 'Gem i en anden fil']) {
        await expect(dialog.getByRole('button', { name: button, exact: true })).toBeVisible();
      }
      if (choice === 'Annuller') await page.screenshot({ path: testInfo.outputPath('filkonflikt.png') });
      await dialog.getByRole('button', { name: choice, exact: true }).click();
      await expect(dialog).toBeHidden();
      if (choice !== 'Annuller') await expect(page.getByText('Gemt', { exact: true })).toBeVisible();
      const files = await page.evaluate(async () => {
        const { current, next, pickerCalls } = (window as unknown as Window & { __mineoFileProbe: FileProbe }).__mineoFileProbe;
        return { original: await (await current.getFile()).text(), nextSize: (await next.getFile()).size, pickerCalls };
      });
      if (choice === 'Overskriv') expect(files.original).toContain('A256GCM');
      else expect(files.original).toBe('Ekstern ændring');
      if (choice === 'Gem i en anden fil') {
        expect(files.nextSize).toBeGreaterThan(100);
        expect(files.pickerCalls).toBe(2);
      } else expect(files.pickerCalls).toBe(1);
      expect(runtimeErrors).toEqual([]);
      expect(runtimeSignals).toEqual([]);
    });
  }
});

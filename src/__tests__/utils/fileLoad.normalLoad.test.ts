// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { loadFromFile, loadFromFileHandle } from '../../utils/fileLoad';
import { FileHandleAccessError } from '../../utils/fileSystemAccess';
import { encryptToString } from '../../utils/encryption';
import { countFilledFields } from '../../utils/dataCollection';
import { VERSION } from '../../config/buildInfo';
import { FILE_FORMAT_VERSION } from '../../config/version';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { toISODateString } from '../../types/branded';

const readFromFileHandleMock = vi.fn();

vi.mock('../../utils/fileSystemAccess', async (importOriginal) => {
  // Bevar de ægte exports (bl.a. FileHandleAccessError + ensureFileHandleReadPermission, som
  // loadFromFileHandle nu bruger) og override kun det, testen styrer.
  const actual = await importOriginal<typeof import('../../utils/fileSystemAccess')>();
  return {
    ...actual,
    isFileSystemAccessSupported: () => false,
    openFileWithPicker: vi.fn(),
    readFromFileHandle: (...args: unknown[]) => readFromFileHandleMock(...args),
  };
});
const selectFileMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('../../utils/fileHelpers', () => ({
  selectFile: (...args: unknown[]) => selectFileMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args),
  getStartInValue: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

beforeAll(() => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as unknown as Crypto;
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const encryptLoadContainer = async (
  data: Record<string, unknown>,
  persistedDataVersion: string | null = PERSISTED_DATA_VERSION
): Promise<string> => {
  return encryptToString({
    version: FILE_FORMAT_VERSION,
    _metadata: {
      exportDate: '2026-03-20T00:00:00.000Z',
      appVersion: VERSION,
      fieldCount: countFilledFields(data),
      ...(persistedDataVersion === null ? {} : { persistedDataVersion }),
    },
    data,
  });
};

const makeValidContainer = async (overrides: Record<string, unknown> = {}): Promise<string> => {
  return encryptLoadContainer({
    stamdata: {
      journalnr: 'J-2024-001',
      advokat: '',
      sagsbehandler: '',
      skadelidte: 'Testperson',
      skadestype: 'Arbejdsulykke',
      skadedato: toISODateString('2024-01-15'),
    },
    ...overrides,
  });
};

// ─── loadFromFile – success ───────────────────────────────────────────────────

describe('fileLoad – normalLoadFlow', () => {
  it('returnerer success med snapshot ved gyldig fil', async () => {
    const content = await makeValidContainer();
    const file = new File([content], 'sag.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.filename).toBe('sag.eo');
    expect(result.source).toBe('manual');
    expect(result.snapshot).toBeDefined();
    if (!result.snapshot) return;
    expect(result.snapshot.stamdata).toBeDefined();
  });

  it('returnerer cancelled=true når bruger annullerer fil-valg', async () => {
    selectFileMock.mockResolvedValueOnce(null);

    const result = await loadFromFile();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.cancelled).toBe(true);
  });

  it('kaster fejl for forkert filendelse', async () => {
    const file = new File(['data'], 'forkert.txt', { type: 'text/plain' });
    selectFileMock.mockResolvedValueOnce(file);

    await expect(loadFromFile()).rejects.toThrow('ikke en .eo fil');
  });

  it('kaster fejl for for stor fil', async () => {
    // MAX_FILE_SIZE er 1 MB = 1048576 bytes
    const bigContent = 'x'.repeat(2 * 1024 * 1024);
    // Simulér stor fil med size-overskridelse via mock
    const file = {
      name: 'stor.eo',
      size: 2 * 1024 * 1024,
    } as File;
    selectFileMock.mockResolvedValueOnce(file);

    await expect(loadFromFile()).rejects.toThrow('for stor');
    // Supress unused variable lint
    void bigContent;
  });

  it('kaster fejl for krypteret fil med ugyldig container-struktur', async () => {
    // Krypteret content med ugyldig container (mangler version)
    const badContainer = await encryptToString({ data: { stamdata: { journalnr: 'X' } } });
    const file = new File([badContainer], 'bad.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(badContainer);

    await expect(loadFromFile()).rejects.toThrow();
  });

  it('kaster fejl for fil med nul udfyldte felter', async () => {
    // Container med kun tomme felter → fileFieldCount === 0
    const emptyContainer = await encryptLoadContainer({
      stamdata: { journalnr: '', advokat: '', sagsbehandler: '', skadelidte: '', skadestype: undefined, skadedato: undefined },
    });
    const file = new File([emptyContainer], 'tom.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(emptyContainer);

    await expect(loadFromFile()).rejects.toThrow();
  });

  it('returnerer preflight-advarsel og bevarer kendte sektioner ved ukendt sektion', async () => {
    const content = await encryptToString({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2026-03-20T00:00:00.000Z',
        appVersion: VERSION,
        fieldCount: 1,
      },
      data: {
        stamdata: {
          journalnr: 'J-001',
          advokat: '',
          sagsbehandler: '',
          skadelidte: 'Test',
          skadestype: undefined,
          skadedato: undefined,
        },
        ukendtSektion: { noget: 'data' },
      },
    });
    const file = new File([content], 'sag.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.snapshot?.stamdata).toBeDefined();
    expect(result.preflightWarning?.issues).toContainEqual(expect.objectContaining({
      kind: 'unknownSection',
      path: 'ukendtSektion',
    }));
  });

  it('stripper ukendt felt i kendt sektion, loader resten og rapporterer tabet via preflight', async () => {
    // Et felt der findes i filen men ikke i current schema er gemt brugerdata, som ikke kan indlæses.
    // Feltet strippes (sættes til standardværdi) og resten loades — men tabet rapporteres til brugeren
    // via preflight. Stille datatab er uacceptabelt (AGENTS.md save/load, persistence-contract §6.3).
    const content = await encryptLoadContainer({
      stamdata: {
        journalnr: 'J-001',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Test',
        skadestype: undefined,
        skadedato: undefined,
        uventetFelt: 'fjernes',
      },
    });
    const file = new File([content], 'sag.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.snapshot?.stamdata as Record<string, unknown>)?.uventetFelt).toBeUndefined();
    // Det strippede felt rapporteres som tab via preflight.
    expect(result.preflightWarning?.issues).toContainEqual(expect.objectContaining({
      kind: 'strippedUnknownField',
      path: 'stamdata.uventetFelt',
    }));
    // Regnestykket går op: indlæst + sat-til-standard = felter i filen (journalnr, skadelidte, uventetFelt = 3).
    const warning = result.preflightWarning;
    expect(warning).toBeDefined();
    if (!warning) return;
    expect(warning.expectedCount).toBe(3);
    expect(warning.failedCount).toBe(1);
    expect(warning.loadedCount).toBe(2);
    expect((warning.loadedCount) + (warning.failedCount ?? 0)).toBe(warning.expectedCount);
  });

  it('loader en gammel fil der mangler nyere schema-felter uden at blokere eller advare (forward-tolerance)', async () => {
    // Invariant (persistence-contract §5 / AGENTS.md save/load): nye schema-felter der mangler i en
    // ældre `.eo`-fil må ALDRIG blokere load eller udløse en preflight-advarsel. En gammel fil med kun
    // et delvist udfyldt stamdata (resten af de nyere felter helt fraværende) skal loade rent.
    const content = await encryptLoadContainer({
      stamdata: {
        journalnr: 'J-GAMMEL',
        skadelidte: 'Gammel Sag',
      },
    }, null);
    const file = new File([content], 'gammel.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.snapshot?.stamdata as Record<string, unknown>)?.journalnr).toBe('J-GAMMEL');
    // Ingen advarsel: manglende nyere felter er ikke en fejl eller et delvist load.
    expect(result.preflightWarning).toBeUndefined();
  });

  it('loader current-kompatible data fra en ukendt nyere dataversion uden advarsel', async () => {
    const content = await encryptLoadContainer({
      stamdata: {
        journalnr: 'J-FREMTID',
        skadelidte: 'Fremtidig Sag',
      },
    }, '99.0');
    const file = new File([content], 'fremtid.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.snapshot?.stamdata).toEqual(expect.objectContaining({ journalnr: 'J-FREMTID' }));
    expect(result.preflightWarning).toBeUndefined();
  });

  it('rapporterer faellesPersondata som ukendt sektion uden at migrere data', async () => {
    const content = await encryptLoadContainer({
      stamdata: {
        journalnr: 'J-001',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Test',
        skadestype: undefined,
        skadedato: toISODateString('2024-01-15'),
      },
      faellesPersondata: {
        skadelidteFodselsdato: toISODateString('1990-01-01'),
      },
    });
    const file = new File([content], 'ukendt-fodselsdato-sektion.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.snapshot?.stamdata as Record<string, unknown>)?.skadelidteFodselsdato).toBeUndefined();
    expect(result.preflightWarning?.issues).toContainEqual(expect.objectContaining({
      kind: 'unknownSection',
      path: 'faellesPersondata',
    }));
  });

  it('springer ugyldig sektion over og bevarer øvrige gyldige sektioner', async () => {
    const content = await encryptLoadContainer({
      stamdata: {
        journalnr: 'J-001',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Test',
        skadestype: undefined,
        skadedato: undefined,
      },
      renteberegning: {
        rentekravRows: 'forkert-type',
      },
    });
    const file = new File([content], 'delvist-gyldig.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.snapshot?.stamdata).toBeDefined();
    expect(result.snapshot?.renteberegning).toBeUndefined();
    expect(result.preflightWarning?.issues).toContainEqual(expect.objectContaining({
      kind: 'sectionDropped',
      path: expect.stringMatching(/^renteberegning/),
    }));
    // Tallene er felt-baserede og går op: indlæst-fra-fil + ikke-indlæst = felter i filen.
    const warning = result.preflightWarning;
    expect(warning).toBeDefined();
    if (!warning) return;
    expect((warning.loadedCount) + (warning.failedCount ?? 0)).toBe(warning.expectedCount);
  });

  it('afviser filer hvor kun ukendte sektioner har indhold', async () => {
    const content = await encryptToString({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2026-03-20T00:00:00.000Z',
        appVersion: VERSION,
        fieldCount: 2,
      },
      data: {
        ukendtSektion: { noget: 'data' },
      },
    });
    const file = new File([content], 'kun-ukendt-sektion.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    await expect(loadFromFile()).rejects.toThrow('ingen data der kan indlæses');
  });

  it('afviser forkert filversion eksplicit', async () => {
    const content = await encryptToString({
      version: '0.9.0',
      _metadata: {
        exportDate: '2026-03-20T00:00:00.000Z',
        appVersion: VERSION,
        fieldCount: 1,
      },
      data: {
        stamdata: {
          journalnr: 'J-001',
          advokat: '',
          sagsbehandler: '',
          skadelidte: 'Test',
          skadestype: undefined,
          skadedato: undefined,
        },
      },
    });
    const file = new File([content], 'forkert-version.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    await expect(loadFromFile()).rejects.toThrow(`format ${FILE_FORMAT_VERSION}`);
  });

  it('afviser filer uden obligatorisk metadata i nyt format', async () => {
    const content = await encryptToString({
      version: FILE_FORMAT_VERSION,
      data: {
        stamdata: {
          journalnr: 'J-001',
          advokat: '',
          sagsbehandler: '',
          skadelidte: 'Test',
          skadestype: undefined,
          skadedato: undefined,
        },
      },
    });
    const file = new File([content], 'mangler-metadata.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    await expect(loadFromFile()).rejects.toThrow('ugyldig .eo-struktur');
  });
});

describe('loadFromFileHandle', () => {
  it('returnerer success med snapshot ved gyldig PWA-fil', async () => {
    const content = await makeValidContainer();
    const handle = {
      getFile: vi.fn().mockResolvedValue(new File([content], 'pwa.eo', { type: 'application/octet-stream' })),
    } as unknown as FileSystemFileHandle;
    readFromFileHandleMock.mockResolvedValueOnce(content);

    const result = await loadFromFileHandle(handle, { requestId: 'req-1' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.source).toBe('pwa');
    expect(result.requestId).toBe('req-1');
    expect(result.snapshot?.stamdata).toBeDefined();
  });

  it('afviser med handlingsanvisende dansk besked når læse-tilladelsen er trukket tilbage', async () => {
    // En persisteret PWA-handle kan have mistet sin read-permission efter app-genstart.
    // ensureFileHandleReadPermission skal fejle fail-closed FØR nogen fil læses/anvendes,
    // så brugeren ser en dansk handlingsanvisning i stedet for en rå DOMException.
    const getFile = vi.fn();
    const handle = {
      getFile,
      queryPermission: vi.fn().mockResolvedValue('denied'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    } as unknown as FileSystemFileHandle;

    await expect(loadFromFileHandle(handle, { requestId: 'req-perm' })).rejects.toBeInstanceOf(
      FileHandleAccessError,
    );
    // Ingen sagsdata er rørt: vi fejler før filen overhovedet åbnes/læses
    // (getFile er en frisk mock pr. test og er det stærke signal på, at permission-tjekket
    // afbrød flowet før fil-I/O).
    expect(getFile).not.toHaveBeenCalled();
  });
});

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
import { FileSelectionError } from '../../utils/fileLoadSource';
import { logError } from '../../utils/logger';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

vi.mock('../../utils/fileSystemAccess', async (importOriginal) => {
  // Bevar de ægte exports (bl.a. FileHandleAccessError + ensureFileHandleReadPermission, som
  // loadFromFileHandle nu bruger) og override kun det, testen styrer.
  const actual = await importOriginal<typeof import('../../utils/fileSystemAccess')>();
  return {
    ...actual,
    isFileSystemAccessSupported: () => false,
    openFileWithPicker: vi.fn(),
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
  beforeEach(() => vi.clearAllMocks());

  it('returnerer success med snapshot ved gyldig fil', async () => {
    const content = await makeValidContainer();
    const file = new File([content], 'sag.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.filename).toBe('sag.eo');
    expect(result.source).toBe('manual');
    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.stamdata).toBeDefined();
  });

  it('indlæser historiske EO-feltnavne uden ny preflight', async () => {
    const legacySection = createErstatningsopgoerelseInitialValues() as Record<string, unknown>;
    delete legacySection.kravPaaSvieSmerteGodtgoerelse;
    delete legacySection.kravPaaTabtArbejdsfortjeneste;
    legacySection.beregnesSvieSmerteGodtgoerelse = 'Nej';
    legacySection.beregnesTabtArbejdsfortjeneste = 'Nej';
    legacySection.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden = true;
    legacySection.allowReguleringMedUdloebMedMaaneder = 9;
    legacySection.opsagtFraStilling = 'Ja';
    legacySection.sfggSygeperioderFoer2015 = [{ id: 'sfg-1', fra: '2014-01-01', til: '2014-01-15' }];

    const content = await encryptLoadContainer({ erstatningsopgoerelse: legacySection }, '2.0');
    const file = new File([content], 'historisk-sag.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.snapshot.erstatningsopgoerelse).toEqual(expect.objectContaining({
      kravPaaSvieSmerteGodtgoerelse: 'Nej',
      kravPaaTabtArbejdsfortjeneste: 'Nej',
    }));
    expect(result.snapshot.erstatningsopgoerelse).not.toHaveProperty(
      'allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden'
    );
    expect(result.snapshot.erstatningsopgoerelse).not.toHaveProperty('allowReguleringMedUdloebMedMaaneder');
    expect(result.snapshot.erstatningsopgoerelse).not.toHaveProperty('opsagtFraStilling');
    expect(result.snapshot.erstatningsopgoerelse).not.toHaveProperty('sfggSygeperioderFoer2015');
    const accountedLegacySection = { ...legacySection };
    delete accountedLegacySection.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden;
    delete accountedLegacySection.allowReguleringMedUdloebMedMaaneder;
    delete accountedLegacySection.opsagtFraStilling;
    delete accountedLegacySection.sfggSygeperioderFoer2015;
    expect(result.expectedFieldCount).toBe(countFilledFields({ erstatningsopgoerelse: accountedLegacySection }));
  });

  it('holder tavst ignorerede gamle felter ude af preflight-tallene ved et selvstændigt datatab', async () => {
    const legacySection = createErstatningsopgoerelseInitialValues() as Record<string, unknown>;
    legacySection.opsagtFraStilling = 'Ja';
    legacySection.sfggSygeperioderFoer2015 = [{ id: 'sfg-1', fra: '2014-01-01', til: '2014-01-15' }];
    const data = {
      stamdata: {
        journalnr: 'J-001',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Test',
        skadestype: undefined,
        skadedato: undefined,
        uventetFelt: 'fjernes',
      },
      erstatningsopgoerelse: legacySection,
    };
    const accountedData = {
      ...data,
      erstatningsopgoerelse: { ...legacySection },
    };
    delete accountedData.erstatningsopgoerelse.opsagtFraStilling;
    delete accountedData.erstatningsopgoerelse.sfggSygeperioderFoer2015;
    const expectedCount = countFilledFields(accountedData);

    const content = await encryptLoadContainer(data);
    const file = new File([content], 'historisk-med-reelt-tab.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.status).toBe('preflight');
    if (result.status !== 'preflight') return;
    expect(result.preflightWarning.expectedCount).toBe(expectedCount);
    expect(result.preflightWarning.failedCount).toBe(1);
    expect(result.preflightWarning.loadedCount).toBe(expectedCount - 1);
    expect(result.preflightWarning.loadedCount + (result.preflightWarning.failedCount ?? 0))
      .toBe(result.preflightWarning.expectedCount);
    expect(result.preflightWarning.issues).toContainEqual(expect.objectContaining({
      kind: 'strippedUnknownField',
      path: 'stamdata.uventetFelt',
    }));
    expect(result.preflightWarning.issues).not.toContainEqual(expect.objectContaining({
      path: 'erstatningsopgoerelse.opsagtFraStilling',
    }));
    expect(result.preflightWarning.issues).not.toContainEqual(expect.objectContaining({
      path: 'erstatningsopgoerelse.sfggSygeperioderFoer2015',
    }));
  });

  it('behandler en fil med kun tavst ignorerede gamle felter som en tom fil', async () => {
    const content = await encryptLoadContainer({
      erstatningsopgoerelse: {
        allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: false,
        allowReguleringMedUdloebMedMaaneder: 0,
        opsagtFraStilling: 'Ja',
        sfggSygeperioderFoer2015: [{ id: 'sfg-1', fra: '2014-01-01', til: '2014-01-15' }],
      },
    });
    const file = new File([content], 'kun-gamle-udviklingsfelter.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    await expect(loadFromFile()).rejects.toThrow('ingen udfyldte felter');
  });

  it('returnerer cancelled når bruger annullerer fil-valg', async () => {
    selectFileMock.mockResolvedValueOnce(null);

    const result = await loadFromFile();

    expect(result.status).toBe('cancelled');
    if (result.status !== 'cancelled') return;
    expect(result.source).toBe('manual');
  });

  it('kaster fejl for forkert filendelse', async () => {
    const file = new File(['data'], 'forkert.txt', { type: 'text/plain' });
    selectFileMock.mockResolvedValueOnce(file);

    await expect(loadFromFile()).rejects.toMatchObject({
      name: FileSelectionError.name,
      message: 'Valgt fil er ikke en .eo fil',
    });
    expect(logError).not.toHaveBeenCalled();
  });

  it('logger stadig en reel fejl fra fil-læsningen', async () => {
    const file = new File(['data'], 'sag.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockRejectedValueOnce(new Error('Læseren fejlede'));

    await expect(loadFromFile()).rejects.toThrow('Læseren fejlede');
    expect(logError).toHaveBeenCalledWith(
      'Hent-operation fejlede',
      expect.objectContaining({ context: 'loadFromFile' }),
    );
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

    await expect(loadFromFile()).rejects.toBeInstanceOf(FileSelectionError);
    expect(logError).not.toHaveBeenCalled();
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
    expect(result.status).toBe('preflight');
    if (result.status !== 'preflight') return;
    expect(result.snapshot.stamdata).toBeDefined();
    expect(result.preflightWarning.issues).toContainEqual(expect.objectContaining({
      kind: 'unknownSection',
      path: 'ukendtSektion',
    }));
  });

  it('rapporterer også ukendte data-sektioner med underscore-prefix', async () => {
    const content = await encryptLoadContainer({
      stamdata: {
        journalnr: 'J-001', advokat: '', sagsbehandler: '', skadelidte: 'Test',
        skadestype: undefined, skadedato: undefined,
      },
      _fremtidigSektion: { bevaretHosAfsender: 'data' },
    });
    const file = new File([content], 'underscore.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();
    expect(result.status).toBe('preflight');
    if (result.status !== 'preflight') return;
    expect(result.preflightWarning.issues).toContainEqual(expect.objectContaining({
      kind: 'unknownSection', path: '_fremtidigSektion',
    }));
  });

  it('advarer ikke om tomme historiske felter eller sektioner uden brugerdata', async () => {
    const content = await encryptLoadContainer({
      stamdata: {
        journalnr: 'J-001',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Test',
        skadestype: undefined,
        skadedato: undefined,
        fjernetTomtFelt: '',
      },
      fjernetTomSektion: { gammelTomVaerdi: '' },
    });
    const file = new File([content], 'historisk-tom.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.snapshot.stamdata).toEqual(expect.objectContaining({ journalnr: 'J-001' }));
  });

  it('stripper ukendt felt i kendt sektion, loader resten og rapporterer tabet via preflight', async () => {
    // Et felt der findes i filen men ikke i current schema er gemt brugerdata, som ikke kan indlæses.
    // Feltet strippes (sættes til standardværdi) og resten loades – men tabet rapporteres til brugeren
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
    expect(result.status).toBe('preflight');
    if (result.status !== 'preflight') return;
    expect((result.snapshot.stamdata as Record<string, unknown>)?.uventetFelt).toBeUndefined();
    // Det strippede felt rapporteres som tab via preflight.
    expect(result.preflightWarning.issues).toContainEqual(expect.objectContaining({
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

  it('rapporterer ukendt felt inde i et union-baseret beløbsudtryk via preflight', async () => {
    // `optionalAmountValueSchema` ender i en ZodUnion. Uden union-traversering strippede Zod selv
    // feltet ved parse, men load-pipelinen så aldrig stien og kunne derfor ikke vise preflight.
    const content = await encryptLoadContainer({
      renteberegning: {
        rentekravRows: [{
          id: 'rentekrav-1',
          belob: {
            kind: 'expression',
            expression: '1+1',
            value: 2,
            fremtidigtFelt: 'må ikke forsvinde tavst',
          },
          renterFra: '2024-01-01',
          tillaegstid: 0,
          enhed: 'dage',
        }],
      },
    });
    const file = new File([content], 'union-felt.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.status).toBe('preflight');
    if (result.status !== 'preflight') return;
    expect(result.preflightWarning.issues).toContainEqual(expect.objectContaining({
      kind: 'strippedUnknownField',
      path: 'renteberegning.rentekravRows[1].belob.fremtidigtFelt',
    }));
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
    // Ingen advarsel: manglende nyere felter er ikke en fejl eller et delvist load → rent 'loaded'.
    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect((result.snapshot.stamdata as Record<string, unknown>)?.journalnr).toBe('J-GAMMEL');
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

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.snapshot.stamdata).toEqual(expect.objectContaining({ journalnr: 'J-FREMTID' }));
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

    expect(result.status).toBe('preflight');
    if (result.status !== 'preflight') return;
    expect((result.snapshot.stamdata as Record<string, unknown>)?.skadelidteFodselsdato).toBeUndefined();
    expect(result.preflightWarning.issues).toContainEqual(expect.objectContaining({
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

    expect(result.status).toBe('preflight');
    if (result.status !== 'preflight') return;
    expect(result.snapshot.stamdata).toBeDefined();
    expect(result.snapshot.renteberegning).toBeUndefined();
    expect(result.preflightWarning.issues).toContainEqual(expect.objectContaining({
      kind: 'sectionDropped',
      path: expect.stringMatching(/^renteberegning/),
    }));
    // Tallene er felt-baserede og går op: indlæst-fra-fil + ikke-indlæst = felter i filen.
    const warning = result.preflightWarning;
    expect(warning).toBeDefined();
    if (!warning) return;
    expect((warning.loadedCount) + (warning.failedCount ?? 0)).toBe(warning.expectedCount);
  });

  it('bevarer gyldige felter fra en sektion med ét ugyldigt felt og viser preflight', async () => {
    const content = await encryptLoadContainer({
      stamdata: {
        journalnr: 'J-001',
        advokat: 'Advokat A',
        sagsbehandler: '',
        skadelidte: 'Test',
        skadestype: 'Arbejdsulykke',
        skadedato: 'ikke-en-dato',
      },
    });
    const file = new File([content], 'et-ugyldigt-felt.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.status).toBe('preflight');
    if (result.status !== 'preflight') return;
    expect(result.snapshot.stamdata).toEqual(expect.objectContaining({
      journalnr: 'J-001',
      advokat: 'Advokat A',
      skadelidte: 'Test',
    }));
    expect((result.snapshot.stamdata as Record<string, unknown>).skadedato).toBeUndefined();
    expect(result.preflightWarning.issues).toContainEqual(expect.objectContaining({
      kind: 'invalidField',
      path: 'stamdata.skadedato',
    }));
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
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFileHandle(handle, { requestId: 'req-1' });

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.source).toBe('pwa');
    expect(result.requestId).toBe('req-1');
    expect(result.snapshot.stamdata).toBeDefined();
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

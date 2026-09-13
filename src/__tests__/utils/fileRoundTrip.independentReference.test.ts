// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { loadFromFile } from '../../utils/fileLoad';
import { saveToFile } from '../../utils/fileSave';
import type { SaveSnapshot } from '../../utils/fileSaveTypes';
import { toISODateString } from '../../types/branded';
import { AARSLOEN_INITIAL_VALUES } from '../../domain/aarsloen/aarsloenInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

const selectFileMock = vi.fn();
const readFileMock = vi.fn();
const downloadFileMock = vi.fn();

vi.mock('../../utils/fileSystemAccess', () => ({
  isFileSystemAccessSupported: () => false,
  isFileSystemFileHandle: vi.fn(),
  openFileWithPicker: vi.fn(),
  readFromFileHandle: vi.fn(),
  saveFileWithPicker: vi.fn(),
  writeToFileHandle: vi.fn(),
}));

vi.mock('../../utils/fileHelpers', () => ({
  downloadFile: (...args: unknown[]) => downloadFileMock(...args),
  generateFilename: () => 'uafhaengig-reference',
  getStartInValue: vi.fn(),
  readFile: (...args: unknown[]) => readFileMock(...args),
  selectFile: (...args: unknown[]) => selectFileMock(...args),
}));

vi.mock('../../utils/fileHandleStorage', () => ({
  deleteFileHandleFromIndexedDB: vi.fn(),
  loadFileHandleFromIndexedDB: vi.fn(),
  requestPersistentStorage: vi.fn(),
  saveFileHandleToIndexedDB: vi.fn(),
  verifyFileHandleDetailed: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  getTimestamp: () => '2026-09-10T12:00:00.000Z',
  logError: vi.fn(),
  logWarning: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

beforeAll(() => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as unknown as Crypto;
  }
});

const independentSaveSnapshot = {
  stamdata: {
    journalnr: 'J-UAFH-1',
    skadelidte: 'Uafhængig reference',
    skadestype: 'Arbejdsulykke',
    skadedato: toISODateString('2024-06-15'),
  },
  satser: { aargang: 2025 },
  aarsloen: {
    ...AARSLOEN_INITIAL_VALUES,
    feriePct: 12.5,
    loenperiode: 'dag',
    tableData: [{ id: 'loen-1', col2: { kind: 'number', value: 1000 } }],
  },
  faellesAarsloen: {
    aslAarsloen: { kind: 'number', value: 100000 },
    ealAarsloen: { kind: 'expression', expression: '200000+50000', value: 250000 },
  },
  renteberegning: {
    beregningsdato: toISODateString('2024-07-01'),
    kommentarer: 'Uafhængig kontrol',
    rentekravRows: [],
  },
  varigemen: { mengrad: 15, beregningsdato: toISODateString('2025-01-15') },
  forsoergertab: {
    beregningsdato: toISODateString('2025-01-15'),
    tilkendtForPeriodeAar: 5,
  },
  erstatningsopgoerelse: {
    ...createErstatningsopgoerelseInitialValues(),
    eoNummer: 'EO-UAFH-1',
    svieSmertePerioder: [],
    tafPerioder: [],
    ferieperioder: [],
    fravaerPerioder: [],
    oevrigeKravPerioder: [],
    offentligeYdelserRows: [],
    sfggAnsaettelsesforhold: [],
    loenindkomstAnsaettelsesforhold: [],
  },
  erhvervsevnetab: {
    beregningsdato: toISODateString('2025-01-15'),
    aslAfgoerelser: [],
    ealEetPct: 20,
    eetDifferencekravBilagSelection: {
      opgoerelse: true,
      loebendeYdelser: true,
      kapitalisering: false,
      eetEfterEal: true,
      proformaKapitalisering: false,
      merErstatningPensionsalder: true,
      visUdvidetSpecifikation: true,
      visUdvidetSpecifikationLoebendeYdelserBilag: false,
    },
    endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: true,
    indregnMerErstatningVedForhoejetPensionsalder: true,
  },
} satisfies SaveSnapshot;

// Denne reference er skrevet ud fra den forventede filstruktur, ikke bygget gennem et schema eller
// en produktionsfactory. Den skal derfor fejle, hvis save eller load mister eller tilføjer et felt.
const EXPECTED_LOADED_SNAPSHOT = {
  stamdata: {
    journalnr: 'J-UAFH-1',
    skadelidte: 'Uafhængig reference',
    skadestype: 'Arbejdsulykke',
    skadedato: '2024-06-15',
  },
  satser: { aargang: 2025 },
  aarsloen: {
    feriePct: 12.5,
    loenperiode: 'dag',
    tillaegAngivesSom: 'procent',
    tableData: [{ id: 'loen-1', col2: { kind: 'number', value: 1000 } }],
    omregningTilFuldtAar: false,
    fuldLoenUnderFerie: true,
    retTilSjetteFerieuge: true,
    loenPaaHelligdage: 'Almindelig løn',
  },
  faellesAarsloen: {
    aslAarsloen: { kind: 'number', value: 100000 },
    ealAarsloen: { kind: 'expression', expression: '200000+50000', value: 250000 },
  },
  renteberegning: {
    beregningsdato: '2024-07-01',
    kommentarer: 'Uafhængig kontrol',
    rentekravRows: [],
  },
  varigemen: { mengrad: 15, beregningsdato: '2025-01-15' },
  forsoergertab: {
    beregningsdato: '2025-01-15',
    tilkendtForPeriodeAar: 5,
  },
  erstatningsopgoerelse: {
    eoNummer: 'EO-UAFH-1',
    indsaetUdkastStempel: 'Ja',
    revideretOpgoerelse: 'Nej',
    midlertidigtEetFraEetSiden: 'Nej',
    regulerOffentligeYdelser: 'Ja',
    erstatningsopgoerelseAfsluttesMed: 'Bekræftet godkendt',
    kravPaaOevrigeErstatningskrav: 'Skjul',
    oevrigeKravPerioder: [],
    offentligeYdelserRows: [],
    eoBilagSelection: {
      opgoerelse: true,
      loenindkomst: true,
      offentligeYdelser: true,
      midlertidigEet: true,
      shDage: false,
      regulering: true,
      okSatser: true,
      sygeferiegodtgoerelse: false,
    },
    eoBilagLoenindkomstOgOffentligeYdelserIndgaar: 'Perioden',
    varigeMenAfgorelse: 'Nej',
    verserendeKlageMen: 'Nej',
    midlertidigtEETAfgorelse: 'Nej',
    endeligtEETAfgorelse: 'Nej',
    verserendeKlageEet: 'Nej',
    kravPaaSvieSmerteGodtgoerelse: 'Ja',
    tidligereSsMax: 'Nej',
    svieSmertePerioder: [],
    svieSmerteDelvisSygemeldingSats: 'halv',
    kravPaaTabtArbejdsfortjeneste: 'Ja',
    tafPerioder: [],
    ferieperioder: [],
    komprimerBeregningEfterFoersteOpgoerelse: 'Ja',
    beregnesUdFra: 'Beregningsperiode',
    fravaerPerioder: [],
    oevrigtFravaerUdenLoen: 'Nej',
    sfggAnsaettelsesforhold: [],
    loenindkomstAnsaettelsesforhold: [],
    eoAngivetLoenLoenudvikling: {
      harAnciennitetstillaegEfterSkadedatoen: false,
      anciennitetstillaegSatsAngivesPer: 'Måned',
      loenPaaHelligdage: 'Almindelig løn',
      // Nyt eksplicit tilvalg; save-modellen bar det allerede som `false`, så loaden bevarer det
      // uden at ramme migreringen for filer helt uden feltet (indskudte-loentillaeg-contract.md §2a).
      beregnStoreBededagstillaeg: false,
      loenudviklingManuelTableData: [],
      loenudviklingManuelProcentsatsTableData: [],
      offentligLoenType: 'Månedsløn',
      overenskomstFilter: {},
    },
    visBilagsnumre: 'Nej',
  },
  erhvervsevnetab: {
    beregningsdato: '2025-01-15',
    aslAfgoerelser: [],
    ealEetPct: 20,
    eetDifferencekravBilagSelection: {
      opgoerelse: true,
      loebendeYdelser: true,
      kapitalisering: false,
      eetEfterEal: true,
      proformaKapitalisering: false,
      merErstatningPensionsalder: true,
      visUdvidetSpecifikation: true,
      visUdvidetSpecifikationLoebendeYdelserBilag: false,
    },
    endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: true,
    indregnMerErstatningVedForhoejetPensionsalder: true,
  },
} as const;

describe('uafhængig save→codec→load-reference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('bevarer hele den loadede struktur mod et håndskrevet facit', async () => {
    const saveResult = await saveToFile(independentSaveSnapshot);
    expect(saveResult).toMatchObject({ status: 'saved', verified: true });

    const savedContent = downloadFileMock.mock.calls[0]?.[0];
    expect(downloadFileMock).toHaveBeenCalledTimes(1);
    expect(typeof savedContent).toBe('string');
    if (typeof savedContent !== 'string') return;

    const file = new File([savedContent], 'uafhaengig-reference.eo', {
      type: 'application/octet-stream',
    });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(savedContent);

    const loadResult = await loadFromFile();
    expect(loadResult.status).toBe('loaded');
    if (loadResult.status !== 'loaded') return;

    expect(loadResult.snapshot).toEqual(EXPECTED_LOADED_SNAPSHOT);
  });
});

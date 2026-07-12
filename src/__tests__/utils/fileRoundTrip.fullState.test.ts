// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { loadFromFile } from '../../utils/fileLoad';
import { encryptToString } from '../../utils/encryption';
import { buildAllDataRawFromSnapshot } from '../../utils/fileSaveInternals';
import { eoFileDataSchema } from '../../schemas/eoFileSchema';
import { countFilledFields } from '../../utils/dataCollection';
import { VERSION } from '../../config/buildInfo';
import { FILE_FORMAT_VERSION } from '../../config/version';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { PERSISTED_SECTION_KEYS } from '../../config/persistenceRegistry';
import type { SaveSnapshot } from '../../utils/fileSaveTypes';
import { toISODateString } from '../../types/branded';

import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { SATSER_INITIAL_VALUES } from '../../domain/satser/satserInitialValues';
import { AARSLOEN_INITIAL_VALUES } from '../../domain/aarsloen/aarsloenInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { createRenteberegningInitialValues } from '../../domain/renteberegning/renteberegningInitialValues';
import { VARIGE_MEN_INITIAL_VALUES } from '../../domain/varigemen/varigeMenInitialValues';
import { FORSOERGERTAB_INITIAL_VALUES } from '../../domain/forsoergertab/forsoergertabInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';

/**
 * Ende-til-ende save→load-round-trip på FULDT populeret tilstand.
 *
 * De eksisterende tests dækker save og load hver for sig (med mocket kryptering) plus
 * encrypt/decrypt isoleret. Ingen test kørte HELE kæden — alle sektioner gennem ægte
 * kryptering, dekryptering og schema-valideret load — og hævdede streng round-trip-lighed.
 * Det er præcis den "stille datatab"-risiko AGENTS.md kalder uacceptabel (et felt der
 * tabes i serialiseringen ville passere de stykvise tests).
 *
 * Sandhedsgrundlaget for "hvad der gemmes" er `eoFileDataSchema.parse(buildAllDataRawFromSnapshot(...))`
 * — den kanoniske save-repræsentation. Efter ægte kryptering → fil → ægte load skal det loadede
 * snapshot deep-equal den kanoniske save pr. sektion. Kun fil-picker-I/O mockes (som i de øvrige tests).
 */

const selectFileMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('../../utils/fileSystemAccess', async () => ({
  isFileSystemAccessSupported: () => false,
  openFileWithPicker: vi.fn(),
  readFromFileHandle: vi.fn(),
}));

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

// Et snapshot hvor HVER sektion har mindst ét brugerudfyldt felt oven på initialværdierne.
// Inkluderer dato, enum, tal, tabelrække og et udtryks-beløb (kind: 'expression').
const buildFullSnapshot = (): SaveSnapshot => {
  const eo = createErstatningsopgoerelseInitialValues();
  eo.vedroererPeriodeFra = toISODateString('2024-01-01');
  eo.vedroererPeriodeTil = toISODateString('2024-12-31');
  eo.oevrigeKravPerioder = [
    {
      id: 'o-rt',
      dato: toISODateString('2024-03-10'),
      udgiftTil: 'Medicin',
      beloeb: { kind: 'expression', expression: '500+250', value: 750 },
    },
  ];

  return {
    stamdata: {
      ...STAMDATA_INITIAL_VALUES,
      journalnr: 'J-2024-RT',
      skadelidte: 'Round Trip',
      skadestype: 'Arbejdsulykke',
      skadedato: toISODateString('2024-06-15'),
    },
    satser: { ...SATSER_INITIAL_VALUES, aargang: 2025 },
    aarsloen: {
      ...AARSLOEN_INITIAL_VALUES,
      loenperiode: 'maaned',
      tableData: [
        { id: 'a-rt', col2: { kind: 'expression', expression: '40000+5000', value: 45000 } },
      ],
    },
    faellesAarsloen: {
      ...FAELLES_AARSLOEN_INITIAL_VALUES,
      aslAarsloen: { kind: 'number', value: 400000 },
      ealAarsloen: { kind: 'expression', expression: '420000+30000', value: 450000 },
    },
    renteberegning: {
      ...createRenteberegningInitialValues(),
      rentekravRows: [
        { id: 'r-rt', belob: { kind: 'number', value: 12000 }, renterFra: toISODateString('2024-02-01'), tillaegstid: 30, enhed: 'dage' },
      ],
    },
    varigemen: { ...VARIGE_MEN_INITIAL_VALUES, mengrad: 15, beregningsdato: toISODateString('2025-01-15') },
    forsoergertab: {
      ...FORSOERGERTAB_INITIAL_VALUES,
      tilkendtForPeriodeAar: 5,
      beregningsdato: toISODateString('2025-01-15'),
    },
    erstatningsopgoerelse: eo,
    erhvervsevnetab: { ...ERHVERVSEVNETAB_INITIAL_VALUES, beregningsdato: toISODateString('2025-01-15') },
  } as SaveSnapshot;
};

describe('save→load fuld-tilstands-round-trip', () => {
  it('alle sektioner overlever ægte kryptering→fil→load uden datatab', async () => {
    const snapshot = buildFullSnapshot();

    // 1. Kanonisk save-repræsentation (det eneste der LOVLIGT må persisteres).
    const canonical = eoFileDataSchema.parse(buildAllDataRawFromSnapshot(snapshot));

    // 2. Ægte kryptering til en fil-streng (samme container-form som save bygger).
    const content = await encryptToString({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2026-06-02T00:00:00.000Z',
        appVersion: VERSION,
        persistedDataVersion: PERSISTED_DATA_VERSION,
        fieldCount: countFilledFields(canonical as Record<string, unknown>),
      },
      data: canonical,
    });

    // 3. Ægte load (kun fil-picker mockes).
    const file = new File([content], 'round-trip.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();
    expect(result.success).toBe(true);
    if (!result.success) return;

    // 4. Pr. sektion: loadet snapshot skal deep-equal den kanoniske save.
    // (Sektioner uden indhold udelades af canonical; de skal også være fraværende/undefined efter load.)
    for (const key of PERSISTED_SECTION_KEYS) {
      const saved = (canonical as Record<string, unknown>)[key];
      const loaded = (result.snapshot as Record<string, unknown>)[key];
      if (saved === undefined) {
        expect(loaded === undefined || loaded === null).toBe(true);
      } else {
        expect(loaded, `Sektion '${key}' skal round-trippe uændret`).toEqual(saved);
      }
    }
  });

  it('udtryks-beløb bevarer formel og værdi gennem hele kæden (ingen kollaps til tal)', async () => {
    const snapshot = buildFullSnapshot();
    const canonical = eoFileDataSchema.parse(buildAllDataRawFromSnapshot(snapshot));
    const content = await encryptToString({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2026-06-02T00:00:00.000Z',
        appVersion: VERSION,
        persistedDataVersion: PERSISTED_DATA_VERSION,
        fieldCount: 1,
      },
      data: canonical,
    });
    const file = new File([content], 'round-trip.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const eoLoaded = (result.snapshot as Record<string, unknown>).erstatningsopgoerelse as
      | { oevrigeKravPerioder?: ReadonlyArray<{ beloeb?: unknown }> }
      | undefined;
    const beloeb = eoLoaded?.oevrigeKravPerioder?.[0]?.beloeb;
    expect(beloeb).toEqual({ kind: 'expression', expression: '500+250', value: 750 });

    const ealLoaded = (result.snapshot as Record<string, unknown>).faellesAarsloen as
      | { ealAarsloen?: unknown }
      | undefined;
    expect(ealLoaded?.ealAarsloen).toEqual({ kind: 'expression', expression: '420000+30000', value: 450000 });
  });
});

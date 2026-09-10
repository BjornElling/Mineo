// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadFromFile } from '../../utils/fileLoad';

const FIXTURE_DIRECTORY = resolve(process.cwd(), 'src/__tests__/fixtures/persistence');
const selectFileMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('../../utils/fileSystemAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/fileSystemAccess')>();
  return {
    ...actual,
    isFileSystemAccessSupported: () => false,
    openFileWithPicker: vi.fn(),
    readFromFileHandle: vi.fn(),
  };
});

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

const loadFixture = async (filename: string) => {
  const content = readFileSync(resolve(FIXTURE_DIRECTORY, filename), 'utf8');
  selectFileMock.mockResolvedValueOnce(new File([content], filename, { type: 'application/octet-stream' }));
  readFileMock.mockResolvedValueOnce(content);
  return loadFromFile();
};

describe('historiske .eo-fixtures – ægte bytes gennem loadgrænsen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loader legacy-unversioned tværgående felter med bevaret sagsdata', async () => {
    const result = await loadFixture('legacy-unversioned-cross-section.eo');

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.snapshot.stamdata).toEqual(expect.objectContaining({
      journalnr: 'J-HISTORISK',
      skadelidteFodselsdato: '1970-01-01',
    }));
    expect(result.snapshot.faellesAarsloen).toEqual({
      aslAarsloen: { kind: 'number', value: 400000 },
      ealAarsloen: { kind: 'number', value: 450000 },
    });
    expect(result.snapshot.erhvervsevnetab).not.toHaveProperty('aslAarsloen');
    expect(result.snapshot.erhvervsevnetab).not.toHaveProperty('ealAarsloen');
  });

  it('loader 1.0.4-EO-aliaser til de aktuelle feltnavne uden preflight', async () => {
    const result = await loadFixture('1.0.4-eo-aliases.eo');

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.snapshot.erstatningsopgoerelse).toEqual(expect.objectContaining({
      kravPaaSvieSmerteGodtgoerelse: 'Nej',
      kravPaaTabtArbejdsfortjeneste: 'Nej',
      tafBeregningsperiodeFra: '2024-01-01',
      tafBeregningsperiodeTil: '2024-12-31',
    }));
    expect(result.snapshot.erstatningsopgoerelse).not.toHaveProperty('beregnesSvieSmerteGodtgoerelse');
    expect(result.snapshot.erstatningsopgoerelse).not.toHaveProperty('beregnesTabtArbejdsfortjeneste');
  });

  it('loader 3.10-filen uden det afledte Store Bededag-slot som tab', async () => {
    const result = await loadFixture('3.10-derived-store-bededag.eo');

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    const rows = (result.snapshot.erstatningsopgoerelse as {
      loenindkomstAnsaettelsesforhold?: ReadonlyArray<Record<string, unknown>>;
    }).loenindkomstAnsaettelsesforhold;
    expect(rows).toEqual([expect.objectContaining({ id: 'af-1', pensionPct: 7.5 })]);
    expect(rows?.[0]).not.toHaveProperty('storeBededagPct');
  });

  it('loader 3.12-filen som forløber for den aktuelle 3.13-form', async () => {
    const result = await loadFixture('3.12-predecessor.eo');

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.snapshot.stamdata).toEqual(expect.objectContaining({ journalnr: 'J-312' }));
  });

  it('loader en 3.13-fil med udtryksbeløb uændret', async () => {
    const result = await loadFixture('3.13-current.eo');

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') return;
    expect(result.snapshot.faellesAarsloen).toEqual(expect.objectContaining({
      aslAarsloen: { kind: 'number', value: 400000 },
      ealAarsloen: { kind: 'expression', expression: '420000+30000', value: 450000 },
    }));
  });
});

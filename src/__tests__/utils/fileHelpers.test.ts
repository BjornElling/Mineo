import {
  generateFilename,
  getStartInValue,
  resolveDefaultDirectoryHandle,
  sanitizeFilename,
} from '../../utils/fileHelpers';
import type { AppSettings } from '../../settings/appSettingsSchema';
import { logWarning } from '../../utils/logger';

const loadDefaultDirectoryHandleMock = vi.fn();
const verifyDirectoryHandleMock = vi.fn();

vi.mock('../../utils/fileHandleStorage', () => ({
  loadDefaultDirectoryHandle: (...args: unknown[]) => loadDefaultDirectoryHandleMock(...args),
  verifyDirectoryHandle: (...args: unknown[]) => verifyDirectoryHandleMock(...args),
}));

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

const baseSettings: AppSettings = {
  themeMode: 'light',
  defaultStartsideErStamdata: false,
  showContentBoxReportButton: false,
  showEOInspektionMenu: false,
  fontStyleColorDebug: false,
  erstatningsopgoerelseAfsluttesMed: 'Bekræftet godkendt',
  defaultFuldLoenUnderFerie: true,
  defaultLoenPaaHelligdage: 'Almindelig løn',
  defaultOverenskomstLoenmodtager: 'ALLE',
  defaultOverenskomstArbejdsgiver: 'ALLE',
  defaultSvieSmerteDelvisSygemeldingSats: 'halv',
  defaultLoenIndtastesSom: 'maaned',
  defaultIndsaetUdkastStempel: true,
  defaultVisBilagsnumre: false,
  allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: false,
  allowReguleringMedUdloebMedMaaneder: 6,
  defaultDirectoryHandleId: 'dir-1',
  documentDownloadFormat: 'pdf',
  brevhovedIndstillinger: {
    erstatningsopgoerelse: true,
    shDage: false,
    renteberegning: true,
    regulering: false,
    varigeMen: true,
    satser: false,
    aarsloensberegning: true,
    erhvervsevnetab: true,
    forsoergertab: true,
  },
};

describe('resolveDefaultDirectoryHandle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bevarer brugerens standardmappe når den kan bruges som læsbar startplacering', async () => {
    const directoryHandle = {
      name: 'Sager',
      queryPermission: vi.fn(),
    } as unknown as FileSystemDirectoryHandle;

    loadDefaultDirectoryHandleMock.mockResolvedValue(directoryHandle);
    verifyDirectoryHandleMock.mockResolvedValue(true);

    const result = await resolveDefaultDirectoryHandle(baseSettings);

    expect(verifyDirectoryHandleMock).toHaveBeenCalledWith(directoryHandle, {
      mode: 'read',
      allowRequestPermission: true,
    });
    expect(result).toEqual({
      handle: directoryHandle,
      wellKnown: 'desktop',
      isFallback: false,
    });
  });

  it('falder tilbage til skrivebord når standardmappen ikke kan bruges som læsbar startplacering', async () => {
    const directoryHandle = {
      name: 'Sager',
      queryPermission: vi.fn(),
    } as unknown as FileSystemDirectoryHandle;

    loadDefaultDirectoryHandleMock.mockResolvedValue(directoryHandle);
    verifyDirectoryHandleMock.mockResolvedValue(false);

    const result = await resolveDefaultDirectoryHandle(baseSettings);

    expect(result).toEqual({
      handle: null,
      wellKnown: 'desktop',
      isFallback: true,
    });
  });

  it('falder tilbage til skrivebord når standardmappen ikke findes i storage', async () => {
    loadDefaultDirectoryHandleMock.mockResolvedValue(null);

    await expect(resolveDefaultDirectoryHandle(baseSettings)).resolves.toEqual({
      handle: null,
      wellKnown: 'desktop',
      isFallback: true,
    });
    expect(verifyDirectoryHandleMock).not.toHaveBeenCalled();
  });

  it('forsøger at anmode om permission før fallback til skrivebord', async () => {
    const directoryHandle = {
      name: 'Arkiv',
      queryPermission: vi.fn(),
      requestPermission: vi.fn(),
    } as unknown as FileSystemDirectoryHandle;

    loadDefaultDirectoryHandleMock.mockResolvedValue(directoryHandle);
    verifyDirectoryHandleMock.mockResolvedValue(true);

    const result = await resolveDefaultDirectoryHandle(baseSettings);

    expect(verifyDirectoryHandleMock).toHaveBeenCalledWith(directoryHandle, {
      mode: 'read',
      allowRequestPermission: true,
    });
    expect(result.isFallback).toBe(false);
    // Målet er, at det VERIFICEREDE handle bæres igennem – ikke blot at et fallback undgås.
    expect(result.handle).toBe(directoryHandle);
  });

  it('bruger desktop-fallback uden settings eller standardmappe', async () => {
    await expect(resolveDefaultDirectoryHandle()).resolves.toEqual({
      handle: null,
      wellKnown: 'desktop',
      isFallback: true,
    });

    await expect(resolveDefaultDirectoryHandle({
      ...baseSettings,
      defaultDirectoryHandleId: undefined,
    })).resolves.toEqual({
      handle: null,
      wellKnown: 'desktop',
      isFallback: true,
    });
    expect(loadDefaultDirectoryHandleMock).not.toHaveBeenCalled();
  });

  it('bruger desktop-fallback og logger ved uventet storage-fejl', async () => {
    loadDefaultDirectoryHandleMock.mockRejectedValue(new Error('IndexedDB fejlede'));

    await expect(resolveDefaultDirectoryHandle(baseSettings)).resolves.toEqual({
      handle: null,
      wellKnown: 'desktop',
      isFallback: true,
    });
    expect(logWarning).toHaveBeenCalledWith(
      'Fejl ved resolve af standard-placering - falder tilbage til skrivebord',
      expect.objectContaining({
        context: 'resolveDefaultDirectoryHandle',
        data: { error: 'IndexedDB fejlede' },
      }),
    );
  });
});

describe('sanitizeFilename', () => {
  it('returnerer fallback for tomme eller udelukkende ugyldige navne', () => {
    expect(sanitizeFilename(null)).toBe('Erstatningsopgørelse');
    expect(sanitizeFilename(undefined, 'Nyt navn')).toBe('Nyt navn');
    expect(sanitizeFilename('???///', 'Nyt navn')).toBe('Nyt navn');
  });

  it('renser tegn, whitespace og Windows-reserverede navne', () => {
    expect(sanitizeFilename('  Sag<>: 2024...  ')).toBe('Sag 2024');
    expect(sanitizeFilename('CON')).toBe('CON_');
  });

  it('begrænser lange navne efter rensning', () => {
    const result = sanitizeFilename('a'.repeat(151));

    expect(result).toHaveLength(150);
    expect(result).toBe('a'.repeat(150));
  });
});

describe('generateFilename og getStartInValue', () => {
  it('bygger filnavn med skadelidte, skadestype og dansk dato', () => {
    expect(generateFilename({
      stamdata: {
        skadelidte: '  Anna<> Jensen  ',
        skadestype: 'Arbejdsulykke',
        skadedato: '2024-01-15',
      },
    })).toBe('Mineo - Anna Jensen - Arbejdsulykke - 15-01-2024');
  });

  it('udelader placeholder for skadestype', () => {
    expect(generateFilename({
      stamdata: {
        skadelidte: 'Anna',
        skadestype: 'Vælg skadestype',
      },
    })).toBe('Mineo - Anna');
  });

  it('returnerer et verificeret handle og ellers well-known fallback', () => {
    const directoryHandle = { name: 'Sager' } as FileSystemDirectoryHandle;

    expect(getStartInValue({
      handle: directoryHandle,
      wellKnown: 'desktop',
      isFallback: false,
    })).toBe(directoryHandle);
    expect(getStartInValue({
      handle: directoryHandle,
      wellKnown: 'desktop',
      isFallback: true,
    })).toBe('desktop');
    expect(getStartInValue({
      handle: null,
      wellKnown: 'desktop',
      isFallback: true,
    })).toBe('desktop');
  });
});

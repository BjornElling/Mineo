import { resolveDefaultDirectoryHandle } from '../../utils/fileHelpers';
import type { AppSettings } from '../../settings/appSettingsSchema';

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
    // Målet er, at det VERIFICEREDE handle bæres igennem — ikke blot at et fallback undgås.
    expect(result.handle).toBe(directoryHandle);
  });
});

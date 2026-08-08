// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import DefaultDirectoryRow from '../../../../components/pages/indstillinger/DefaultDirectoryRow';
import { AppSettingsProvider } from '../../../../contexts/AppSettingsContext';
import { DEFAULT_APP_SETTINGS } from '../../../../settings/appSettingsSchema';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../../../../settings/appSettingsStorage';
import {
  DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME,
  resolveDefaultDirectoryLocation,
} from '../../../../utils/file/defaultDirectoryLocation';

/**
 * Standardplacerings-rækken. Den havde INGEN testdækning før dette spor.
 *
 * Det, der måles her, er præcis den fejl, opdelingen af rækkens to halvdele gav: navnet kom fra
 * IndexedDB-metadata, mens kursivering og «Nulstil» kom fra `settings.defaultDirectoryHandleId` i
 * localStorage. De to lagre kan ryddes hver for sig, så rækken kunne vise standardens navn stylet
 * som et intakt brugervalg. `utilgaengelig` er den tilstand, den gamle form ikke kunne udtrykke.
 */

const getDirectoryDisplayInfoMock = vi.fn();
const saveDefaultDirectoryHandleMock = vi.fn();
const deleteDefaultDirectoryHandleMock = vi.fn();

vi.mock('../../../../utils/fileHandleStorage', () => ({
  getDirectoryDisplayInfo: (...args: unknown[]) => getDirectoryDisplayInfoMock(...args),
  saveDefaultDirectoryHandle: (...args: unknown[]) => saveDefaultDirectoryHandleMock(...args),
  deleteDefaultDirectoryHandle: (...args: unknown[]) => deleteDefaultDirectoryHandleMock(...args),
}));

const renderRow = (defaultDirectoryHandleId: string | undefined) => {
  writeLocalStorage(
    LOCAL_STORAGE_KEY,
    JSON.stringify({ ...DEFAULT_APP_SETTINGS, defaultDirectoryHandleId })
  );
  return render(
    <ThemeProvider theme={createTheme()}>
      <AppSettingsProvider>
        <DefaultDirectoryRow />
      </AppSettingsProvider>
    </ThemeProvider>
  );
};

/** Elementet der viser placeringens navn — slås op på selve det viste navn. */
const navnElement = (visetNavn: string): HTMLElement => screen.getByText(visetNavn);

beforeEach(() => {
  vi.clearAllMocks();
  deleteDefaultDirectoryHandleMock.mockResolvedValue(true);
});

describe('DefaultDirectoryRow — navn og udseende har én kilde', () => {
  it('uden valgt mappe vises standardnavnet i kursiv og uden Nulstil', async () => {
    renderRow(undefined);

    await waitFor(() => {
      expect(screen.getByText(DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME)).toBeInTheDocument();
    });
    expect(navnElement(DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME)).toHaveStyle({ fontStyle: 'italic' });
    expect(screen.queryByText('Nulstil')).not.toBeInTheDocument();
    // Passiv observatør: en visning må aldrig gå i storet, når settings intet valg bærer.
    expect(getDirectoryDisplayInfoMock).not.toHaveBeenCalled();
  });

  it('med en registreret mappe vises mappens navn ikke-kursivt og med Nulstil', async () => {
    getDirectoryDisplayInfoMock.mockResolvedValue({
      id: 'dir-1',
      displayName: 'Sager',
      savedAt: 0,
      source: 'user',
    });
    renderRow('dir-1');

    await waitFor(() => expect(screen.getByText('Sager')).toBeInTheDocument());
    expect(navnElement('Sager')).toHaveStyle({ fontStyle: 'normal' });
    expect(screen.getByText('Nulstil')).toBeInTheDocument();
  });

  /**
   * KERNEN. Id'et overlevede sin registrering (IndexedDB ryddet, localStorage ikke). Før havde
   * rækken to kilder, så den viste standardens NAVN med brugervalgets UDSEENDE — en påstand om en
   * valgt mappe, gem-vejen samtidig ikke kunne indfri.
   */
  it('overlever id\'et sin registrering, vises standarden som standard — men Nulstil bevares', async () => {
    getDirectoryDisplayInfoMock.mockResolvedValue(null);
    renderRow('dir-forsvundet');

    await waitFor(() => {
      expect(screen.getByText(DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME)).toBeInTheDocument();
    });
    // Navn OG udseende siger nu det samme: filer havner på skrivebordet.
    expect(navnElement(DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME)).toHaveStyle({ fontStyle: 'italic' });
    // Men det døde valg skal kunne ryddes, så linket bliver.
    expect(screen.getByText('Nulstil')).toBeInTheDocument();
  });
});

describe('DefaultDirectoryRow — handlinger', () => {
  it('Nulstil sletter registreringen og rydder settings-id\'et', async () => {
    const user = userEvent.setup();
    getDirectoryDisplayInfoMock.mockResolvedValue({
      id: 'dir-1',
      displayName: 'Sager',
      savedAt: 0,
      source: 'user',
    });
    renderRow('dir-1');

    await waitFor(() => expect(screen.getByText('Sager')).toBeInTheDocument());
    await user.click(screen.getByText('Nulstil'));

    expect(deleteDefaultDirectoryHandleMock).toHaveBeenCalledTimes(1);
    // Settings-id'et er ryddet ⇒ rækken falder tilbage til standarden uden Nulstil.
    await waitFor(() => {
      expect(screen.getByText(DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME)).toBeInTheDocument();
    });
    expect(screen.queryByText('Nulstil')).not.toBeInTheDocument();
  });

  /**
   * Fejler sletningen, ville et BEVARET id efterlade rækken i `utilgaengelig` uden vej ud:
   * Nulstil var netop den vej. Derfor ryddes settings uanset udfaldet.
   */
  it('Nulstil rydder settings-id\'et også når sletningen fejler', async () => {
    const user = userEvent.setup();
    getDirectoryDisplayInfoMock.mockResolvedValue({
      id: 'dir-1',
      displayName: 'Sager',
      savedAt: 0,
      source: 'user',
    });
    deleteDefaultDirectoryHandleMock.mockResolvedValue(false);
    renderRow('dir-1');

    await waitFor(() => expect(screen.getByText('Sager')).toBeInTheDocument());
    await user.click(screen.getByText('Nulstil'));

    await waitFor(() => {
      expect(screen.getByText(DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME)).toBeInTheDocument();
    });
    expect(screen.queryByText('Nulstil')).not.toBeInTheDocument();
  });

  /**
   * Mislykkes SKRIVNINGEN af registreringen (`null`-id), må rækken ikke påstå et gemt valg. Den
   * gamle form satte navnet optimistisk fra `directoryHandle.name` UDEN at se på returværdien, og
   * viste dermed «Sager» som valgt mappe, selv når intet var registreret.
   */
  it('viser ikke et valg når registreringen ikke kunne gemmes', async () => {
    const user = userEvent.setup();
    const directoryHandle = { name: 'Sager' } as unknown as FileSystemDirectoryHandle;
    saveDefaultDirectoryHandleMock.mockResolvedValue(null);
    vi.stubGlobal('showDirectoryPicker', vi.fn(async () => directoryHandle));
    renderRow(undefined);

    await waitFor(() => {
      expect(screen.getByText(DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME)).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(saveDefaultDirectoryHandleMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Sager')).not.toBeInTheDocument();
    expect(screen.getByText(DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('resolveDefaultDirectoryLocation — de tre tilstande', () => {
  it('uden id: standard, uden opslag i storet', async () => {
    const result = await resolveDefaultDirectoryLocation(undefined);
    expect(result).toEqual({ kind: 'standard', displayName: DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME });
    expect(getDirectoryDisplayInfoMock).not.toHaveBeenCalled();
  });

  it('med id og metadata: valgt, med mappens eget navn', async () => {
    getDirectoryDisplayInfoMock.mockResolvedValue({
      id: 'dir-1',
      displayName: 'Arkiv',
      savedAt: 0,
      source: 'user',
    });
    expect(await resolveDefaultDirectoryLocation('dir-1')).toEqual({
      kind: 'valgt',
      displayName: 'Arkiv',
    });
  });

  it('med id uden metadata: utilgaengelig, med standardens navn', async () => {
    getDirectoryDisplayInfoMock.mockResolvedValue(null);
    expect(await resolveDefaultDirectoryLocation('dir-1')).toEqual({
      kind: 'utilgaengelig',
      displayName: DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME,
    });
  });
});

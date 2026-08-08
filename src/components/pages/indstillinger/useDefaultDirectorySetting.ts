import React from 'react';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { saveDefaultDirectoryHandle, deleteDefaultDirectoryHandle } from '../../../utils/fileHandleStorage';
import {
  DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME,
  resolveDefaultDirectoryLocation,
  type DefaultDirectoryLocation,
} from '../../../utils/file/defaultDirectoryLocation';
import { logWarning } from '../../../utils/logger';

/**
 * Standardplacerings-rækken på Indstillinger: hele dens tilstand og dens to handlinger.
 *
 * Dette var sidens største enkeltansvar (~143 af 605 linjer) og lå inline i sidekroppen som to
 * `useState`, en `useEffect` med tre fallback-grene, to async-handlere og en JSX-blok, der
 * udledte sin styling af en ANDEN kilde end sit navn. Rækken er device-lokal filplacering — ikke
 * en indstillingsværdi som sidens øvrige rækker — og hører derfor i sit eget modul frem for at
 * fylde halvdelen af en side, hvis øvrige rækker er ét felt hver.
 *
 * Tilstanden er ÉN `DefaultDirectoryLocation` frem for `displayName` + `defaultDirectoryHandleId`
 * læst hver for sig; se modulets docstring for den fejl, den opdeling gav.
 */
export type DefaultDirectorySetting = Readonly<{
  /** `null` mens placeringen resolveres første gang (og ved skift af valg). */
  location: DefaultDirectoryLocation | null;
  chooseDirectory: () => Promise<void>;
  resetToDefault: () => Promise<void>;
}>;

export const useDefaultDirectorySetting = (): DefaultDirectorySetting => {
  const { settings, updateSettings } = useAppSettings();
  const { defaultDirectoryHandleId } = settings;
  const [location, setLocation] = React.useState<DefaultDirectoryLocation | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLocation(null);

    void resolveDefaultDirectoryLocation(defaultDirectoryHandleId)
      // Resolveren er selv fail-safe, så en rejection er en programmeringsfejl og ikke en
      // forventelig tilstand. Den må stadig ikke efterlade rækken i «Indlæser...» for evigt.
      .catch((error: unknown) => {
        logWarning('Kunne ikke resolvere standardplacering', {
          context: 'useDefaultDirectorySetting',
          data: { error: error instanceof Error ? error.message : String(error) },
        });
        return null;
      })
      .then((resolved) => {
        // Et nyt valg kan nå at ændre `defaultDirectoryHandleId`, mens denne læsning er i luften;
        // uden vagten ville den forældede læsning kunne overskrive den friske.
        if (!cancelled) {
          setLocation(
            resolved ?? { kind: 'standard', displayName: DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME }
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [defaultDirectoryHandleId]);

  const chooseDirectory = React.useCallback(async () => {
    try {
      const showDirectoryPicker = window.showDirectoryPicker;
      if (!showDirectoryPicker) {
        logWarning('showDirectoryPicker ikke tilgængelig i denne browser');
        return;
      }

      // VIGTIGT: Bevidst UDEN `mode: 'readwrite'`. Med write-mode blokerer browseren
      // special-mapper (Downloads, Skrivebord, OneDrive). Write-permission requesteres først,
      // når filen faktisk gemmes.
      const directoryHandle = await showDirectoryPicker({ startIn: 'desktop' });

      // ID'et kommer fra storage-laget, IKKE herfra: registreringen og settings-værdien skal
      // pege på hinanden, og kun den skrivende side kender den nøgle, den faktisk skrev.
      const handleId = await saveDefaultDirectoryHandle(directoryHandle);
      updateSettings({ defaultDirectoryHandleId: handleId ?? undefined });
      // Ingen `setLocation` her: settings-ændringen kører effekten, som læser den registrering,
      // der FAKTISK blev skrevet. Et optimistisk navn ville påstå et gemt valg, selv når
      // skrivningen fejlede (`handleId === null`).
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Brugeren annullerede — ingen handling.
        return;
      }
      logWarning('Fejl ved valg af standardplacering', {
        context: 'useDefaultDirectorySetting.chooseDirectory',
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }, [updateSettings]);

  const resetToDefault = React.useCallback(async () => {
    try {
      await deleteDefaultDirectoryHandle();
    } catch (error) {
      logWarning('Fejl ved nulstilling af standardplacering', {
        context: 'useDefaultDirectorySetting.resetToDefault',
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }
    // Settings ryddes UANSET om sletningen lykkedes: lykkedes den ikke, er registreringen
    // forældreløs device-lokal cache, mens et bevaret id ville efterlade rækken i
    // `utilgaengelig` uden nogen vej ud. Effekten resolverer den nye tilstand.
    updateSettings({ defaultDirectoryHandleId: undefined });
  }, [updateSettings]);

  return { location, chooseDirectory, resetToDefault };
};

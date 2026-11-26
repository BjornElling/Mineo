import { getDirectoryDisplayInfo } from '../fileHandleStorage';

/**
 * Standardplaceringen for gemte filer, som ÉN resolveret værdi.
 *
 * **Hvorfor dette modul findes.** Begrebet «hvor gemmes filer, og hvad hedder den mappe» har
 * tre berøringsflader – gem/hent (`resolveDefaultDirectoryHandle`), visningen i `Indstillinger.tsx`
 * og skrivningen (`saveDefaultDirectoryHandle`) – og de skal give samme svar og samme navn.
 *
 * **Defekten, en adskillelse ville skjule.** NAVNET kommer af metadata i IndexedDB, men om der
 * overhovedet ER valgt en mappe (kursivering + «Nulstil»-linket) af
 * `settings.defaultDirectoryHandleId` i localStorage. De to ligger i hver sit lager, og et
 * browser-lager kan ryddes uden det andet. Overlever id'et sin metadata, ville en visning, der
 * læste de to hver for sig, vise «Skrivebord (standard)» stylet som et brugervalg med et
 * Nulstil-link – en påstand om en valgt mappe og navnet på standarden i samme linje – mens
 * gem-vejen tavst faldt tilbage.
 *
 * Derfor er staten her ÉN diskrimineret union udledt af begge kilder samtidig, ikke to felter der
 * kan modsige hinanden. `'utilgaengelig'` er netop den tilstand.
 */

/** Navnet på standardplaceringen. Ét sted, så det ikke kan staves forskelligt. */
export const DEFAULT_DIRECTORY_FALLBACK_NAME = 'Skrivebord';

/** Visningsnavnet når ingen mappe er valgt: standarden, markeret som netop standard. */
export const DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME = `${DEFAULT_DIRECTORY_FALLBACK_NAME} (standard)`;

export type DefaultDirectoryLocation = Readonly<
  | {
      /** Ingen mappe valgt: filer gemmes på skrivebordet. */
      kind: 'standard';
      displayName: typeof DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME;
    }
  | {
      /** Brugeren har valgt en mappe, og den er stadig registreret. */
      kind: 'valgt';
      displayName: string;
    }
  | {
      /**
       * Der ER registreret et valg i settings, men mappens registrering findes ikke længere
       * (device-lokal cache ryddet, andet lager, anden browserprofil). Gem-vejen falder tilbage
       * til skrivebordet, og fladen skal sige det – ikke pynte det som et intakt valg.
       */
      kind: 'utilgaengelig';
      displayName: typeof DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME;
    }
>;

const STANDARD: DefaultDirectoryLocation = {
  kind: 'standard',
  displayName: DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME,
};

const UTILGAENGELIG: DefaultDirectoryLocation = {
  kind: 'utilgaengelig',
  displayName: DEFAULT_DIRECTORY_FALLBACK_DISPLAY_NAME,
};

/**
 * Resolverer standardplaceringen til visning.
 *
 * PASSIV OBSERVATØR: læser kun den cachede metadata (`getDirectoryDisplayInfo`) og foretager
 * derfor ALDRIG en permission-request. Den må kaldes ved mount og re-render. Den reparerer
 * heller ikke: en `utilgaengelig`-tilstand rapporteres, den ryddes ikke bag brugerens ryg.
 *
 * `resolveDefaultDirectoryHandle` er den ANDEN, bevidst adskilte vej: den bruges af gem/hent,
 * må requestere permissions og svarer på «hvilket handle skal pickeren starte i». De to er ikke
 * slået sammen, fordi netop permission-adfærden skiller dem – men navnet stammer nu ét sted fra.
 */
export const resolveDefaultDirectoryLocation = async (
  defaultDirectoryHandleId: string | undefined
): Promise<DefaultDirectoryLocation> => {
  if (defaultDirectoryHandleId === undefined) {
    return STANDARD;
  }

  const meta = await getDirectoryDisplayInfo();
  // Settings-id'et og IndexedDB-recorden er to device-lokale kilder, der skal pege på samme
  // registrering. Et gyldigt, men andet id er ikke et gyldigt match; ellers kunne en gammel cache
  // vise den forkerte mappe som den aktuelle.
  if (meta === null || meta.id !== defaultDirectoryHandleId) {
    return UTILGAENGELIG;
  }

  return { kind: 'valgt', displayName: meta.displayName };
};

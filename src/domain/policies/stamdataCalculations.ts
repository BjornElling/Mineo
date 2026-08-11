import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export type StamdataValues = PersistedSectionMap['stamdata'];

export type SkadestypeDatoLabel = 'Anmeldelsesdato' | 'Skadedato';

/**
 * Feltnavnet, når skadestypen er ukendt — og dermed `stamdata.skadedato`-descriptorens kontekstfrie `label`.
 * Konstanten findes, så descriptoren og denne regel ikke kan erklære forskellige udgangspunkter.
 */
export const SKADESTYPE_DATO_LABEL_DEFAULT: SkadestypeDatoLabel = 'Skadedato';

/**
 * DET ENE navnevalg for `stamdata.skadedato`:
 *   - "Skadedato"       (uden s) — ved Arbejdsulykke og ukendt skadestype
 *   - "Anmeldelsesdato" (med s)  — ved Erhvervssygdom
 *
 * Reglen er feltets `contextualLabel` (§3.2a) og forbruges derigennem af BÅDE den synlige label og enhver
 * besked om feltet. Skriv den aldrig som en inline ternary: gjorde fire kaldssteder det tidligere, og et
 * felt, der hed «Anmeldelsesdato» på skærmen, bad brugeren rette «Skadedato».
 */
export const resolveSkadestypeDatoLabel = (
  skadestype: StamdataValues['skadestype'] | undefined
): SkadestypeDatoLabel =>
  skadestype === 'Erhvervssygdom' ? 'Anmeldelsesdato' : 'Skadedato';

/** Sektionsformen af {@link resolveSkadestypeDatoLabel} — for consumers, der holder hele `stamdata`. */
export const resolveStamdataDatoLabel = (
  stamdata: StamdataValues | null
): SkadestypeDatoLabel => resolveSkadestypeDatoLabel(stamdata?.skadestype);

export const hasStamdataAny = (stamdata: StamdataValues | null): boolean => {
  if (!stamdata) return false;
  return (
    (typeof stamdata.journalnr === 'string' && stamdata.journalnr.trim().length > 0) ||
    (typeof stamdata.advokat === 'string' && stamdata.advokat.trim().length > 0) ||
    (typeof stamdata.sagsbehandler === 'string' && stamdata.sagsbehandler.trim().length > 0) ||
    (typeof stamdata.skadelidte === 'string' && stamdata.skadelidte.trim().length > 0) ||
    stamdata.skadestype !== undefined ||
    stamdata.skadedato !== undefined ||
    // skadelidteFodselsdato er et selvstændigt brugerfelt i stamdataSchema; udelades
    // det her, rapporteres en sektion hvor KUN fødselsdatoen er udfyldt fejlagtigt som tom.
    stamdata.skadelidteFodselsdato !== undefined
  );
};

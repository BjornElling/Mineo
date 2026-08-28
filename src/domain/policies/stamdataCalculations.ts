import type { PersistedSectionMap } from '../../config/persistenceRegistry';

export type StamdataValues = PersistedSectionMap['stamdata'];

export type SkadestypeDatoLabel = 'Anmeldelsesdato' | 'Skadedato';

export type StamdataDatoReference = Readonly<{
  kind: 'skadedato' | 'anmeldelsesdato';
  label: SkadestypeDatoLabel;
  labelLower: 'anmeldelsesdatoen' | 'skadedatoen';
  /**
   * Tidspunktsformen: «Skadelidtes alder på **skadestidspunkt**» / «… **anmeldelsestidspunkt**» (BB-121).
   *
   * Formen lå før som en inline ternary på `kind` i `MenberegningTab.tsx` og `varigeMenDocument.ts`, mens
   * seks andre brugervendte tekster hardkodede «skadestidspunkt» – på flader, hvor rækken lige ovenfor
   * korrekt sagde «Anmeldelsesdato». Referencen bærer derfor formen, så et nyt kaldssted arver den frem
   * for at skrive sin egen.
   */
  tidspunkt: 'anmeldelsestidspunkt' | 'skadestidspunkt';
  /** Bestemt form af {@link tidspunkt}: «på anmeldelsestidspunktet». */
  tidspunktBestemt: 'anmeldelsestidspunktet' | 'skadestidspunktet';
  /** Årsformen: «Regulering fra **skadesår** 2020» / «… **anmeldelsesår** 2020». */
  aar: 'anmeldelsesår' | 'skadesår';
}>;

/**
 * Feltnavnet, når skadestypen er ukendt – og dermed `stamdata.skadedato`-descriptorens kontekstfrie `label`.
 * Konstanten findes, så descriptoren og denne regel ikke kan erklære forskellige udgangspunkter.
 */
export const SKADESTYPE_DATO_LABEL_DEFAULT: SkadestypeDatoLabel = 'Skadedato';

/**
 * DET ENE navnevalg for `stamdata.skadedato`:
 *   - "Skadedato"       (uden s) – ved Arbejdsulykke og ukendt skadestype
 *   - "Anmeldelsesdato" (med s)  – ved Erhvervssygdom
 *
 * Reglen er feltets `contextualLabel` (§3.2a) og forbruges derigennem af BÅDE den synlige label og enhver
 * besked om feltet. Skriv den aldrig som en inline ternary: gjorde fire kaldssteder det tidligere, og et
 * felt, der hed «Anmeldelsesdato» på skærmen, bad brugeren rette «Skadedato».
 */
export const resolveSkadestypeDatoLabel = (
  skadestype: StamdataValues['skadestype'] | undefined
): SkadestypeDatoLabel =>
  skadestype === 'Erhvervssygdom' ? 'Anmeldelsesdato' : 'Skadedato';

/** Samler også den bøjede form, så fejltekster ikke kan vælge et andet navn end feltets label. */
export const resolveStamdataDatoReference = (
  skadestype: StamdataValues['skadestype'] | undefined
): StamdataDatoReference => {
  const label = resolveSkadestypeDatoLabel(skadestype);
  return label === 'Anmeldelsesdato'
    ? {
      kind: 'anmeldelsesdato',
      label,
      labelLower: 'anmeldelsesdatoen',
      tidspunkt: 'anmeldelsestidspunkt',
      tidspunktBestemt: 'anmeldelsestidspunktet',
      aar: 'anmeldelsesår',
    }
    : {
      kind: 'skadedato',
      label,
      labelLower: 'skadedatoen',
      tidspunkt: 'skadestidspunkt',
      tidspunktBestemt: 'skadestidspunktet',
      aar: 'skadesår',
    };
};

/** Navnet bruges af EO-prosa og re-eksporteres derfra for eksisterende forbrugere. */
export const resolveSkadeEllerAnmeldelsesdatoReference = resolveStamdataDatoReference;

/** Sektionsformen af {@link resolveSkadestypeDatoLabel} – for consumers, der holder hele `stamdata`. */
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

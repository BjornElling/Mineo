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
  /**
   * Begivenheden som tidsreference i prosa: «lønoplysninger før **skaden**», «Da **anmeldelsen** er før
   * 1/1-2011». Bruges kun, hvor ordet står for datoen – ikke hvor det betyder selve skaden som sådan.
   */
  haendelse: 'anmeldelsen' | 'skaden';
  /** Ubestemt form af {@link haendelse} i korte inspektionsetiketter: «(**skade** før 16-06-2011)». */
  haendelseUbestemt: 'anmeldelse' | 'skade';
  /** «**Skaden er sket** før 1. juli 2024» / «**Erhvervssygdommen er anmeldt** før …» (sætningsstart via `capitalizeFirstCharDa`). */
  haendelseSket: 'erhvervssygdommen er anmeldt' | 'skaden er sket';
  /** «**Skaden er indtrådt** før 16. juni 2011» / «**Erhvervssygdommen er anmeldt** før …». */
  haendelseIndtraadt: 'erhvervssygdommen er anmeldt' | 'skaden er indtrådt';
  /** Forbindelsen mellem skadestype og dato: «Erhvervssygdom **anmeldt den** …» / «Arbejdsulykke **den** …». */
  datoForbindelse: 'anmeldt den' | 'den';
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

/**
 * DEN ENE KILDE til enhver brugervendt formulering om sagens skade-/anmeldelsesdato – navnet, de bøjede
 * former, tidspunkts- og årsformen og sætningsleddene «skaden er sket/indtrådt» / «erhvervssygdommen er
 * anmeldt». Udviklerens regel (2026-08-16, M-02): formuleringen følger ALTID den indtastede skadestype –
 * «anmeld…» ved Erhvervssygdom, ellers «skade…».
 *
 * Værnet `src/__tests__/quality/skadedatoTerminologyGuard.test.ts` afviser disse ord som tekstliteraler
 * alle andre steder i `src/`, så en ny tekst ikke kan hardkode den ene form. Mangler en form, tilføjes den
 * HER – ikke som en inline ternary ved kaldsstedet.
 */
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
      haendelse: 'anmeldelsen',
      haendelseUbestemt: 'anmeldelse',
      haendelseSket: 'erhvervssygdommen er anmeldt',
      haendelseIndtraadt: 'erhvervssygdommen er anmeldt',
      datoForbindelse: 'anmeldt den',
    }
    : {
      kind: 'skadedato',
      label,
      labelLower: 'skadedatoen',
      tidspunkt: 'skadestidspunkt',
      tidspunktBestemt: 'skadestidspunktet',
      aar: 'skadesår',
      haendelse: 'skaden',
      haendelseUbestemt: 'skade',
      haendelseSket: 'skaden er sket',
      haendelseIndtraadt: 'skaden er indtrådt',
      datoForbindelse: 'den',
    };
};

/** Referencen ud fra et allerede valgt datonavn – for modeller, der kun bærer `SkadestypeDatoLabel`. */
export const resolveStamdataDatoReferenceForLabel = (label: SkadestypeDatoLabel): StamdataDatoReference =>
  resolveStamdataDatoReference(label === 'Anmeldelsesdato' ? 'Erhvervssygdom' : undefined);

/** Referencen, når skadestypen er ukendt – den kontekstfrie form, en descriptors statiske `label` bærer. */
export const STAMDATA_DATO_REFERENCE_DEFAULT: StamdataDatoReference = resolveStamdataDatoReference(undefined);

/** Begge referencer – til kode, der skal GENKENDE en allerede formuleret tekst uanset skadestype. */
export const STAMDATA_DATO_REFERENCES: readonly StamdataDatoReference[] = [
  resolveStamdataDatoReference('Arbejdsulykke'),
  resolveStamdataDatoReference('Erhvervssygdom'),
];

/** Skadestype og dato i én linje: «Arbejdsulykke den 1. juni 2020» / «Erhvervssygdom anmeldt den 1. juni 2020». */
export const formatSkadestypeMedDato = (
  skadestype: NonNullable<StamdataValues['skadestype']>,
  datoTekst: string
): string => `${skadestype} ${resolveStamdataDatoReference(skadestype).datoForbindelse} ${datoTekst}`;

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

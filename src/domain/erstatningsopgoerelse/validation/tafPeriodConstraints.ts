import type { TafPeriodeRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isISODateString, isoToDanish } from '../../../types/branded';
import { minISO, maxISO, type IsoRange as CanonicalIsoRange } from '../../../utils/isoDateHelpers';
import { TAF_MIDLERTIDIG_EET_SKAERINGSDATO } from '../helpers/eoConstants';
import { getDayBeforeIso } from '../../../utils/isoDateHelpers';

export type { IsoRange } from '../../../utils/isoDateHelpers';

export type TafConstraintSource = Readonly<{
  vedroererPeriodeFra?: ISODateString | undefined;
  vedroererPeriodeTil?: ISODateString | undefined;
  differencekravDato?: ISODateString | undefined;
  endeligtEETAfgorelse?: 'Ja' | 'Nej' | undefined;
  endeligEETVirkningsdato?: ISODateString | undefined;
  endeligEETAfgoerelseDato?: ISODateString | undefined;
  midlertidigtEETAfgorelse?: 'Ja' | 'Nej' | undefined;
  midlertidigEETVirkningsdato?: ISODateString | undefined;
  midlertidigEETAfgoerelseDato?: ISODateString | undefined;
  verserendeKlageEet?: 'Ja' | 'Nej' | undefined;
  /** Skadedato fra stamdata – bruges til at afgøre om midlertidig EET afgrænser TAF. */
  skadedatoISO?: ISODateString | undefined;
}>;

export type TafConstraintBounds = Readonly<{
  minStart?: ISODateString;
  maxEnd?: ISODateString;
}>;

const minDefined = (...values: Array<ISODateString | undefined>): ISODateString | undefined => {
  let current: ISODateString | undefined = undefined;
  for (const value of values) {
    if (!value) continue;
    if (!current || value < current) current = value;
  }
  return current;
};

const resolveEndeligEetDato = (values: TafConstraintSource): ISODateString | undefined => {
  if (values.endeligtEETAfgorelse !== 'Ja') return undefined;
  return values.endeligEETVirkningsdato ?? values.endeligEETAfgoerelseDato;
};

/**
 * OPLYSNINGEN: den midlertidige EET-afgørelses beregnede dato (virkningsdato, ellers afgørelsesdato), når
 * afgørelsen er truffet – uden 2011-grænsen og uden klagen.
 *
 * Holdes adskilt fra ANVENDELSEN (`resolveMidlertidigEetDatoHvisAktiv`, afskæringen af TAF). En regel, der
 * spørger «findes der en afgørelse, og hvornår?», må ikke låne afskæringsprædikatet: det svarer `undefined`
 * for alle skader fra 16. juni 2011, og advarslen om manglende midlertidige EET-ydelser var derfor slukket
 * netop dér, hvor ydelsen skal fradrages (BB-240, mønster M-34).
 */
export const resolveMidlertidigEetDato = (values: TafConstraintSource): ISODateString | undefined => {
  if (values.midlertidigtEETAfgorelse !== 'Ja') return undefined;
  return values.midlertidigEETVirkningsdato ?? values.midlertidigEETAfgoerelseDato;
};

/**
 * ANVENDELSEN: den midlertidige EET-afgørelses dato, hvis den er aktiv som TAF-afgrænsning.
 *
 * Betingelser:
 * - `midlertidigtEETAfgorelse = 'Ja'`
 * - Skadedato er angivet og ligger **før** TAF_MIDLERTIDIG_EET_SKAERINGSDATO (2011-06-16)
 *
 * Checker IKKE `verserendeKlageEet` – det er kalderens ansvar at udelade resultatet ved aktiv klage.
 *
 * Hvis blot én betingelse mangler, returneres undefined (ingen afgrænsning). Skal du blot kende
 * afgørelsens dato, er det `resolveMidlertidigEetDato`.
 */
export const resolveMidlertidigEetDatoHvisAktiv = (values: TafConstraintSource): ISODateString | undefined => {
  if (!values.skadedatoISO || values.skadedatoISO >= TAF_MIDLERTIDIG_EET_SKAERINGSDATO) return undefined;
  return resolveMidlertidigEetDato(values);
};

/**
 * De AKTIVE cutoff-datoer (ikke grænserne, men selve skæringsdatoerne) i én opslag.
 *
 * `buildTafCutoffErrorMessage` skal have præcis de datoer, der er aktive lige nu – inkl. klage-suspensionen
 * og 2011-skæringsdatoen. Kalderne udledte dem tidligere hver for sig, hvilket er nøjagtig den duplikering,
 * der lader to steder svare forskelligt på samme spørgsmål. Ét opslag, én sandhed.
 */
export const resolveTafCutoffDates = (values: TafConstraintSource): Readonly<{
  differencekravDato: ISODateString | undefined;
  endeligEETDato: ISODateString | undefined;
  midlertidigEETDato: ISODateString | undefined;
}> => {
  const klageSuspenderer = values.verserendeKlageEet === 'Ja';
  return {
    differencekravDato: values.differencekravDato,
    endeligEETDato: klageSuspenderer ? undefined : resolveEndeligEetDato(values),
    midlertidigEETDato: klageSuspenderer ? undefined : resolveMidlertidigEetDatoHvisAktiv(values),
  };
};

const resolveEetMaxBounds = (values: TafConstraintSource): TafConstraintBounds => {
  const endeligEetDato = resolveEndeligEetDato(values);
  const endeligEetMax = values.verserendeKlageEet === 'Ja' ? undefined : getDayBeforeIso(endeligEetDato);

  const midlertidigEetDato = resolveMidlertidigEetDatoHvisAktiv(values);
  const midlertidigEetMax = values.verserendeKlageEet === 'Ja' ? undefined : getDayBeforeIso(midlertidigEetDato);

  return { maxEnd: minDefined(endeligEetMax, midlertidigEetMax) };
};

type TafCutoffKilde = 'differencekrav' | 'endeligEet' | 'midlertidigEet';

type TafCutoffDatoer = Readonly<{
  differencekravDato?: ISODateString | undefined;
  endeligEETDato?: ISODateString | undefined;
  midlertidigEETDato?: ISODateString | undefined;
}>;

/**
 * Hver afskæringskildes to beskedformer. «Efter»-formen siger, at en dato ligger efter afskæringen;
 * «hele perioden»-formen bruges i periodens samlede besked, når også fra-datoen gør det (BB-244).
 * Differencekravets dato er den dato, kravet er opgjort PR. (feltet «Evt. differencekrav opgjort per») –
 * ikke den dag, det blev udregnet (BB-245).
 */
const TAF_CUTOFF_TEKST: Readonly<Record<TafCutoffKilde, Readonly<{
  efter: (dateText: string) => string;
  helePerioden: (dateText: string) => string;
}>>> = {
  differencekrav: {
    efter: (d) => `Der er angivet tabt arbejdsfortjeneste efter den dato, differencekravet er opgjort pr. (${d})`,
    helePerioden: (d) => `Hele perioden ligger efter den dato, differencekravet er opgjort pr. (${d})`,
  },
  endeligEet: {
    efter: (d) => `Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (${d})`,
    helePerioden: (d) => `Hele perioden ligger efter afgørelsen om endeligt erhvervsevnetab (${d})`,
  },
  midlertidigEet: {
    efter: (d) => `Der er angivet tabt arbejdsfortjeneste efter afgørelse om midlertidigt erhvervsevnetab (${d})`,
    helePerioden: (d) => `Hele perioden ligger efter afgørelsen om midlertidigt erhvervsevnetab (${d})`,
  },
};

/**
 * Samme afskæringer set fra en ferieperiode. En ferie, der ligger efter afskæringen, fradrages aldrig, men
 * spærrer fortsat opgørelsen (udviklerafgørelse 2026-09-25, BB-248): brugeren skal have et incitament til at
 * rette den, før en senere ændret periode gør den virksom. Beskeden siger derfor, HVORFOR datoen ikke går.
 */
const FERIE_CUTOFF_TEKST: Readonly<Record<TafCutoffKilde, (dateText: string) => string>> = {
  differencekrav: (d) => `Ferien ligger efter den dato, differencekravet er opgjort pr. (${d})`,
  endeligEet: (d) => `Ferien ligger efter afgørelsen om endeligt erhvervsevnetab (${d})`,
  midlertidigEet: (d) => `Ferien ligger efter afgørelsen om midlertidigt erhvervsevnetab (${d})`,
};

/** De afskæringer, `value` ligger på eller efter, i datoorden. */
const collectTafCutoffsRamtAf = (
  value: ISODateString | undefined,
  datoer: TafCutoffDatoer
): Array<Readonly<{ kilde: TafCutoffKilde; dato: ISODateString }>> => {
  if (!value) return [];
  const kandidater: Array<Readonly<{ kilde: TafCutoffKilde; dato: ISODateString | undefined }>> = [
    { kilde: 'differencekrav', dato: datoer.differencekravDato },
    { kilde: 'endeligEet', dato: datoer.endeligEETDato },
    { kilde: 'midlertidigEet', dato: datoer.midlertidigEETDato },
  ];
  return kandidater
    .filter((k): k is Readonly<{ kilde: TafCutoffKilde; dato: ISODateString }> => k.dato !== undefined && value >= k.dato)
    .sort((left, right) => left.dato.localeCompare(right.dato));
};

const formatCutoffDato = (dato: ISODateString): string => isoToDanish(dato) ?? dato;

/** Én datos afskæringsbesked – cellens tooltip. */
export const buildTafCutoffErrorMessage = (args: TafCutoffDatoer & Readonly<{
  value: ISODateString | undefined;
}>): string | undefined => {
  const ramt = collectTafCutoffsRamtAf(args.value, args);
  if (ramt.length === 0) return undefined;
  return ramt.map((cutoff) => TAF_CUTOFF_TEKST[cutoff.kilde].efter(formatCutoffDato(cutoff.dato))).join('; ');
};

/** En ferieperiodedatos afskæringsbesked – cellens tooltip (BB-248). */
export const buildFerieCutoffErrorMessage = (args: TafCutoffDatoer & Readonly<{
  value: ISODateString | undefined;
}>): string | undefined => {
  const ramt = collectTafCutoffsRamtAf(args.value, args);
  if (ramt.length === 0) return undefined;
  return ramt.map((cutoff) => FERIE_CUTOFF_TEKST[cutoff.kilde](formatCutoffDato(cutoff.dato))).join('; ');
};

/**
 * Periodens samlede afskæringsbesked – linjen i «Fejl og advarsler».
 *
 * Fra- og til-cellen har hver sin besked, men periodens linje må ikke blot sammenføje dem: ligger begge
 * datoer efter samme afskæring, stod samme sætning to gange i én linje (BB-244). Hver afskæring nævnes
 * derfor én gang – i «hele perioden»-formen, når også fra-datoen ligger efter den.
 */
export const buildTafPeriodeCutoffErrorMessage = (args: TafCutoffDatoer & Readonly<{
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
}>): string | undefined => {
  const fraKilder = new Set(collectTafCutoffsRamtAf(args.fra, args).map((cutoff) => cutoff.kilde));
  const samlet = new Map<TafCutoffKilde, ISODateString>();
  for (const cutoff of [...collectTafCutoffsRamtAf(args.fra, args), ...collectTafCutoffsRamtAf(args.til, args)]) {
    samlet.set(cutoff.kilde, cutoff.dato);
  }
  if (samlet.size === 0) return undefined;
  return [...samlet.entries()]
    .sort(([, left], [, right]) => left.localeCompare(right))
    .map(([kilde, dato]) => {
      const tekst = TAF_CUTOFF_TEKST[kilde];
      return (fraKilder.has(kilde) ? tekst.helePerioden : tekst.efter)(formatCutoffDato(dato));
    })
    .join('; ');
};

/**
 * Fejlgivende øvre grænse for TAF-perioder: strengeste af differencekravDato−1,
 * endelig EET-virkningsdato−1 og (ved skadedato < 2011-06-16) midlertidig EET-virkningsdato−1
 * (jf. eo-snapshot-contract.md §2.2).
 *
 * Korrekt adfærd: til-dato >= disse grænser er fejlgivende bounds – feltfejl (rød kant +
 * tooltip) vises i TAFPeriodeTable og fejlen gengives på EOBeregningTab, der blokerer download.
 * Engineen clamper stadig til den beregnede maxEnd for at producere korrekte resultater.
 */
export const resolveTafFejlgivendeBounds = (values: TafConstraintSource): TafConstraintBounds => {
  const differencekravMax = getDayBeforeIso(values.differencekravDato);
  const eetBounds = resolveEetMaxBounds(values);

  const maxEnd = minDefined(differencekravMax, eetBounds.maxEnd);
  return { maxEnd };
};

/**
 * Stille clamping-grænser for TAF-perioder: kun EO-periodens grænser.
 *
 * Stille clamping (jf. eo-snapshot-contract.md §2.1): ingen fejlindikation.
 */
export const resolveTafEoPeriodeBounds = (values: TafConstraintSource): TafConstraintBounds => {
  return { minStart: values.vedroererPeriodeFra, maxEnd: values.vedroererPeriodeTil };
};

/**
 * Kombineret bounds-resolver der returnerer strengeste grænse fra alle kilder.
 * Bruges af kontrolvisninger og UI-komponenter der skal vise den endelige clampede dato.
 *
 * Til `buildTafRanges` bruges i stedet `resolveTafFejlgivendeBounds` + `resolveTafEoPeriodeBounds`
 * separat, da rækkefølgen af clampingen her er semantisk vigtig.
 */
export const resolveTafConstraintBounds = (
  values: TafConstraintSource,
  options?: Readonly<{ skadedatoISO?: ISODateString | undefined }>
): TafConstraintBounds => {
  const source = options ? { ...values, skadedatoISO: options.skadedatoISO } : values;
  const minStart = source.vedroererPeriodeFra;
  const erstatningsTil = source.vedroererPeriodeTil;

  const differencekravMax = getDayBeforeIso(source.differencekravDato);
  const eetBounds = resolveEetMaxBounds(source);

  const maxEnd = minDefined(erstatningsTil, differencekravMax, eetBounds.maxEnd);
  return { minStart, maxEnd };
};

/**
 * Clamper en TAF-range til bounds. Returnerer null hvis perioden reduceres til ingenting.
 *
 * Denne funktion er bounds-agnostisk – den kender ikke forskel på stille og fejlgivende clamping.
 * Kalderen er ansvarlig for at anvende korrekte bounds i korrekt rækkefølge
 * (jf. eo-snapshot-contract.md §2.3 og buildTafRanges i indtaegtPerioder.ts).
 */
export const clampTafRange = (range: CanonicalIsoRange, bounds: TafConstraintBounds): CanonicalIsoRange | null => {
  let fra = range.fra;
  let til = range.til;

  if (bounds.minStart) {
    fra = maxISO(fra, bounds.minStart);
  }

  if (bounds.maxEnd) {
    til = minISO(til, bounds.maxEnd);
  }

  if (fra > til) return null;

  return { fra, til };
};

export const getValidTafRange = (row: Readonly<{ fra?: string | undefined; til?: string | undefined }>): CanonicalIsoRange | null => {
  if (!isISODateString(row.fra) || !isISODateString(row.til)) return null;
  if (row.fra > row.til) return null;
  return { fra: row.fra, til: row.til };
};

export const clampTafRow = (row: Readonly<{ fra?: string | undefined; til?: string | undefined }>, bounds: TafConstraintBounds): CanonicalIsoRange | null => {
  const range = getValidTafRange(row);
  if (!range) return null;
  return clampTafRange(range, bounds);
};

export const buildClampedTafRanges = (rows: readonly TafPeriodeRow[], bounds: TafConstraintBounds): CanonicalIsoRange[] => {
  const ranges: CanonicalIsoRange[] = [];
  for (const row of rows) {
    const clamped = clampTafRow(row, bounds);
    if (clamped) ranges.push(clamped);
  }
  return ranges;
};

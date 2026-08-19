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
 * Returnerer den beregnede virkningsdato for midlertidig EET, hvis den er aktiv som TAF-afgrænsning.
 *
 * Betingelser:
 * - `midlertidigtEETAfgorelse = 'Ja'`
 * - Skadedato er angivet og ligger **før** TAF_MIDLERTIDIG_EET_SKAERINGSDATO (2011-06-16)
 *
 * Checker IKKE `verserendeKlageEet` – det er kalderens ansvar at udelade resultatet ved aktiv klage.
 *
 * Hvis blot én betingelse mangler, returneres undefined (ingen afgrænsning).
 */
export const resolveMidlertidigEetDatoHvisAktiv = (values: TafConstraintSource): ISODateString | undefined => {
  if (values.midlertidigtEETAfgorelse !== 'Ja') return undefined;
  if (!values.skadedatoISO || values.skadedatoISO >= TAF_MIDLERTIDIG_EET_SKAERINGSDATO) return undefined;
  return values.midlertidigEETVirkningsdato ?? values.midlertidigEETAfgoerelseDato;
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

export const buildTafCutoffErrorMessage = (args: Readonly<{
  value: ISODateString | undefined;
  differencekravDato?: ISODateString | undefined;
  endeligEETDato?: ISODateString | undefined;
  midlertidigEETDato?: ISODateString | undefined;
}>): string | undefined => {
  const { value, differencekravDato, endeligEETDato, midlertidigEETDato } = args;
  if (!value) return undefined;

  const candidates: Array<{ dato: ISODateString; message: string }> = [];

  if (differencekravDato && value >= differencekravDato) {
    const dateText = isoToDanish(differencekravDato) ?? differencekravDato;
    candidates.push({ dato: differencekravDato, message: `Der er angivet tabt arbejdsfortjeneste, efter differencekrav er opgjort (${dateText})` });
  }

  if (endeligEETDato && value >= endeligEETDato) {
    const dateText = isoToDanish(endeligEETDato) ?? endeligEETDato;
    candidates.push({ dato: endeligEETDato, message: `Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (${dateText})` });
  }

  if (midlertidigEETDato && value >= midlertidigEETDato) {
    const dateText = isoToDanish(midlertidigEETDato) ?? midlertidigEETDato;
    candidates.push({ dato: midlertidigEETDato, message: `Der er angivet tabt arbejdsfortjeneste efter afgørelse om midlertidigt erhvervsevnetab (${dateText})` });
  }

  if (candidates.length === 0) return undefined;
  return candidates
    .sort((left, right) => left.dato.localeCompare(right.dato))
    .map((candidate) => candidate.message)
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

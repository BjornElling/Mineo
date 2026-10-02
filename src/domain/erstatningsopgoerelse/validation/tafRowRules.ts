import type { ErstatningsopgoerelseValues, TafPeriodeRow } from '../../../schemas/formSchemas';
import { isISODateString, isoToDanish, type ISODateString } from '../../../types/branded';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import type { IsoRange } from '../../../utils/isoDateHelpers';
import { formatCountWithUnit } from '../../../utils/formatUtils';
import { calculateTafArbejdsdageBreakdown } from '../engines/tafCalculations';
import { calculateFerieHverdageMinusSHDage } from '../engines/ferieCalculations';
import { clampTafRow, resolveTafConstraintBounds } from './tafPeriodConstraints';

/**
 * TAF- og ferierækkernes regler og deres ordlyd – ÉN kilde for cellen, «Fejl og advarsler» og validatoren.
 *
 * Rækkerne blev før vurderet af to lag hver for sig (M-33): rækkebyggeren og validatoren. Samme mangel fik to
 * ordlyde («Til-dato er ikke angivet» / «Til-dato mangler»), og en regel, der kun stod i validatoren, kunne
 * hverken farve cellen eller linkes (BB-252, BB-253). Reglerne bor nu her, og alle lag læser dem.
 */

/** Den faglige betegnelse for rækkens løse fridage: de kan være både feriedage og feriefridage (BB-256). */
export const TAF_LOSE_FERIEDAGE_LABEL = 'Løse ferie-/feriefridage';

export const buildTafLoseFeriedageMaxMessage = (maksimum: number): string =>
  `${TAF_LOSE_FERIEDAGE_LABEL} overstiger mulige arbejdsdage i perioden (maksimalt ${maksimum})`;

/**
 * Det største antal løse feriedage, rækkens periode kan rumme, når det indtastede antal er for stort – ellers
 * `undefined`. Perioden er rækkens del inden for opgørelsen (samme clamping som TAF-kolonnen), og kun TAF-
 * afsnittets EGNE ferieperioder fylder dagene op: det er dem, beregningen fradrager løse feriedage efter.
 * Ferie i beregningsperioden talte før med her og kunne dermed sænke maksimum under det, beregningen brugte.
 *
 * En række, der ligger helt uden for opgørelsen, bidrager ikke og kan ikke overskride noget.
 */
export const resolveTafLoseFeriedageMaksimum = (
  row: TafPeriodeRow,
  values: Pick<ErstatningsopgoerelseValues, 'ferieperioder'> & Parameters<typeof resolveTafConstraintBounds>[0],
  skadedatoISO: ISODateString | undefined,
): number | undefined => {
  if (typeof row.loseFeriedage !== 'number') return undefined;
  const clamped = clampTafRow(row, resolveTafConstraintBounds(values, { skadedatoISO }));
  if (!clamped) return undefined;
  const breakdown = calculateTafArbejdsdageBreakdown(
    clamped.fra,
    clamped.til,
    values.ferieperioder ?? [],
    row.loseFeriedage,
    { kind: 'taf' }
  );
  if (!breakdown || row.loseFeriedage <= breakdown.loseFeriedage) return undefined;
  return breakdown.loseFeriedage;
};

/**
 * En TAF-periode uden en eneste arbejdsdag inden for opgørelsen – fx en weekend. Den er næsten altid en
 * tastefejl, og i arbejdsdage bidrager den med nul (BB-257). Advarslen er IKKE-blokerende. En række, der
 * ligger helt uden for opgørelsen, er normaltilstanden fra 2. opgørelse og advares ikke.
 */
export const TAF_PERIODE_UDEN_ARBEJDSDAGE_MESSAGE = 'Perioden indeholder ingen arbejdsdage';

export const harTafPeriodeIngenArbejdsdage = (clamped: IsoRange | null): boolean =>
  clamped !== null && calculateFerieHverdageMinusSHDage(clamped.fra, clamped.til) === 0;

// ── Komplethed ──────────────────────────────────────────────────────────────────────────────────

export const FRA_DATO_IKKE_ANGIVET_MESSAGE = 'Fra-dato er ikke angivet';
export const TIL_DATO_IKKE_ANGIVET_MESSAGE = 'Til-dato er ikke angivet';
export const FRA_OG_TIL_DATO_IKKE_ANGIVET_MESSAGE = 'Fra- og til-dato er ikke angivet';

/**
 * Rækkens manglende datoer som ÉN besked. `harFra`/`harTil` er sande også for en celle med en rød værdi:
 * readeren giver den som tom, men den er udfyldt – forkert – og meldes med sin egen tekst.
 */
export const assessPeriodeDatoMangler = (
  harFra: boolean,
  harTil: boolean,
): Readonly<{ message: string; field: 'fra' | 'til' }> | undefined => {
  if (harFra && harTil) return undefined;
  if (!harFra && !harTil) return { message: FRA_OG_TIL_DATO_IKKE_ANGIVET_MESSAGE, field: 'fra' };
  return harFra
    ? { message: TIL_DATO_IKKE_ANGIVET_MESSAGE, field: 'til' }
    : { message: FRA_DATO_IKKE_ANGIVET_MESSAGE, field: 'fra' };
};

// ── Rækkens navn i «Fejl og advarsler» ─────────────────────────────────────────────────────────

const danish = (iso: ISODateString): string => isoToDanish(iso) ?? iso;

/**
 * Rækkens navn, så to rækker med samme mangel aldrig giver ordret samme linje – «Fejl og advarsler» folder
 * ens linjer til én (BB-218), og den anden række forsvandt da uden at blive nævnt (BB-231, BB-253). Navnet
 * er det, brugeren ser i rækken: datoerne, og for en TAF-række uden datoer de løse feriedage.
 */
export const buildPeriodeRaekkeNavn = (
  tabel: 'TAF-perioden' | 'Ferieperioden',
  row: Readonly<{ fra?: ISODateString | undefined; til?: ISODateString | undefined; loseFeriedage?: number | undefined }>,
): string => {
  if (row.fra !== undefined && row.til !== undefined) return `${tabel} ${danish(row.fra)} - ${danish(row.til)}`;
  if (row.fra !== undefined) return `${tabel} fra ${danish(row.fra)}`;
  if (row.til !== undefined) return `${tabel} til ${danish(row.til)}`;
  if (typeof row.loseFeriedage === 'number') {
    return `${tabel} med ${formatCountWithUnit(row.loseFeriedage, 'løs ferie-/feriefridag', 'løse ferie-/feriefridage')}`;
  }
  return `${tabel} uden datoer`;
};

/**
 * Rækkens datoer til navnet, også når de er røde. Readeren giver en rød dato som tom, så en omvendt række hed
 * før «Ferieperioden uden datoer», selv om begge datoer står i cellerne (BB-265). Kronologifejlen bærer
 * modpartens dato (`detail.counterpart`): fra-cellens issue kender til-datoen og omvendt.
 */
export const resolvePeriodeNavneDatoer = (
  row: Readonly<{ fra?: ISODateString | undefined; til?: ISODateString | undefined }>,
  cellIssues: Readonly<{ fra?: Pick<FieldIssue, 'detail'> | undefined; til?: Pick<FieldIssue, 'detail'> | undefined }>,
): Readonly<{ fra?: ISODateString; til?: ISODateString }> => {
  const counterpart = (issue: Pick<FieldIssue, 'detail'> | undefined): ISODateString | undefined => {
    const value = issue?.detail?.counterpart;
    return typeof value === 'string' && isISODateString(value) ? value : undefined;
  };
  const fra = row.fra ?? counterpart(cellIssues.til);
  const til = row.til ?? counterpart(cellIssues.fra);
  return { ...(fra === undefined ? {} : { fra }), ...(til === undefined ? {} : { til }) };
};

/** Én linje pr. tabel om overlap: den røde celles tooltip navngiver modparten (BB-251). */
export const TAF_OVERLAP_LINJE = 'Der er overlappende TAF-perioder';
export const FERIE_OVERLAP_LINJE = 'Der er overlappende ferieperioder';
export const BEREGNINGSPERIODE_FERIE_OVERLAP_LINJE = 'Der er overlappende ferieperioder i beregningsperioden';

import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { formatAsAmount } from '../../../utils/formatUtils';
import { formatISOToDanish } from '../../../utils/dateFormatting';
import { formatStandardLoenRowPeriodLabel } from '../../standardLoen/standardLoenRowWarnings';
import {
  buildBeregningsperiodeRange,
  buildIncomeRowSharesForRanges,
  type IsoRange,
} from './indtaegtPerioder';
import { calculateLoenindkomstRowDerived } from './loenindkomstRowDerived';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from './tafBeregningsenhed';

// Bilagets linje om lønsedler og ydelser, som kun delvist ligger i beregningsperioden eller erstatningsperioden
// (BB-293, udviklerafgørelse 2026-10-19).
//
// Bilagets rækker står præcis som lønsedlerne – med hele beløbet – mens beregningen kun medregner den del af en
// række, der ligger i perioden. Uden en forklaring kan modparten ikke komme fra bilagets beløb til grundlagets.
// Udvikleren ville hverken have ekstra linjer inde i tabellen eller en tung tekst: én kort sætning under tabellen
// pr. række, der er skåret over, og KUN når det er relevant for netop denne opgørelse.
//
// Tallene kommer fra `buildIncomeRowSharesForRanges`, som beregningen selv summerer, så linjen og beregningen kan
// ikke tælle dagene eller fordele beløbet forskelligt.

export type EoBilagDelvisPeriodeNavn = 'beregningsperioden' | 'erstatningsperioden';

export type EoBilagDelvisPeriode = Readonly<{
  navn: EoBilagDelvisPeriodeNavn;
  ranges: readonly IsoRange[];
}>;

/**
 * De perioder, en delvist medregnet række skal forklares for i DENNE opgørelse:
 *
 * - **Beregningsperioden** kun ved «Beregnes ud fra: Beregningsperiode», når opgørelsen har en erstatningsperiode
 *   (ellers regnes grundlaget ikke) og grundlaget vises i fuld form. Ved en senere opgørelse med «Skjul beregning
 *   efter første opgørelse» står kun det tidligere beregnede beløb – der er ingen udregning at afstemme med.
 * - **Erstatningsperioden** når der er krav på tabt arbejdsfortjeneste og mindst én TAF-periode. `tafRanges` skal
 *   være beregningens egne perioder (`model.tafRanges`), ikke bilagsfiltrets: de er beskåret med skadedatoen.
 */
export const resolveEoBilagDelvisePerioder = (params: Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  tafRanges: readonly IsoRange[];
  skalKomprimereIndkomstBeregning: boolean;
}>): readonly EoBilagDelvisPeriode[] => {
  const { eoValues, tafRanges, skalKomprimereIndkomstBeregning } = params;
  if (eoValues.kravPaaTabtArbejdsfortjeneste !== 'Ja' || tafRanges.length === 0) return [];
  const perioder: EoBilagDelvisPeriode[] = [];
  const beregningsperiode = eoValues.beregnesUdFra === 'Beregningsperiode'
    ? buildBeregningsperiodeRange(eoValues)
    : undefined;
  if (beregningsperiode && !skalKomprimereIndkomstBeregning) {
    perioder.push({ navn: 'beregningsperioden', ranges: [beregningsperiode] });
  }
  perioder.push({ navn: 'erstatningsperioden', ranges: tafRanges });
  return perioder;
};

const formatKr = (amount: number): string => `${formatAsAmount(amount, 2)} kr.`;

const buildLinje = (params: Readonly<{
  periodeLabel: string;
  periode: EoBilagDelvisPeriodeNavn;
  medregnedeDage: number;
  alleDage: number;
  enhed: string;
  medregnetBeloeb: number;
  heleBeloebet: number;
}>): string =>
  `${params.periodeLabel}: ${params.medregnedeDage} af ${params.alleDage} ${params.enhed} i ${params.periode}, `
  + `${formatAsAmount(params.medregnetBeloeb, 2)} af ${formatKr(params.heleBeloebet)}`;

// Én indledning og derefter én kort linje pr. række holder teksten på én linje pr. række; en hel sætning pr.
// række ombrødes til to linjer på papiret og gjorde bilaget tungt (BB-293, udviklerens krav om en kort tekst).
const LOEN_INDLEDNING = 'Lønperioder, der kun delvist indgår, medregnes forholdsmæssigt:';
const YDELSE_INDLEDNING = 'Ydelser, der kun delvist indgår, medregnes forholdsmæssigt:';

const medIndledning = (indledning: string, linjer: readonly string[]): readonly string[] =>
  linjer.length === 0 ? [] : [indledning, ...linjer];

/**
 * Linjerne under ét ansættelsesforholds tabel i bilaget «Lønindkomst» – én pr. trykt række og periode, hvor kun en
 * del af rækkens dage ligger i perioden. Beløbene er rækkens «Samlet løn» som i tabellens sidste kolonne: hele
 * beløbet og den medregnede del.
 */
export const buildLoenindkomstDelvisePerioderLinjer = (params: Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  ansaettelsesforholdIndex: number;
  /** De rækker, bilaget trykker, i bilagets rækkefølge. */
  trykteRaekkeIds: readonly string[];
  perioder: readonly EoBilagDelvisPeriode[];
  skadedato: ISODateString | undefined;
}>): readonly string[] => {
  const { eoValues, ansaettelsesforholdIndex, trykteRaekkeIds, perioder, skadedato } = params;
  const ansaettelsesforhold = eoValues.loenindkomstAnsaettelsesforhold?.[ansaettelsesforholdIndex];
  if (!ansaettelsesforhold || perioder.length === 0) return [];
  const enhed = computeTafBeregningsenhed(eoValues) === TAF_BEREGNES_SOM.ARBEJDSDAGE ? 'arbejdsdage' : 'kalenderdage';

  const delvisePerPeriode = perioder.map((periode) => ({
    periode,
    rows: new Map(
      buildIncomeRowSharesForRanges(eoValues, periode.ranges, undefined, skadedato).loenRows
        .filter((share) =>
          share.employmentIndex === ansaettelsesforholdIndex
          && share.selectedDayCount < share.allocationDayCount
        )
        .map((share) => [share.row.id, share] as const)
    ),
  }));

  const linjer: string[] = [];
  for (const rowId of trykteRaekkeIds) {
    for (const { periode, rows } of delvisePerPeriode) {
      const share = rows.get(rowId);
      if (!share) continue;
      const heleBeloebet = calculateLoenindkomstRowDerived({
        row: share.row,
        ansaettelsesforhold,
        context: {
          beregnesUdFra: eoValues.beregnesUdFra,
          tafBeregningsperiodeFra: eoValues.tafBeregningsperiodeFra,
          tafBeregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
          loenindkomstAnsaettelsesforhold: eoValues.loenindkomstAnsaettelsesforhold ?? [],
          ferieperioder: eoValues.ferieperioder,
          fravaerPerioder: eoValues.fravaerPerioder,
          tafPerioder: eoValues.tafPerioder,
        },
      }).samlet;
      // En række med 0 kr. har intet beløb at fordele.
      if (heleBeloebet === 0) continue;
      const periodeLabel = formatStandardLoenRowPeriodLabel(share.row, ansaettelsesforhold.loenperiode);
      if (periodeLabel === undefined) continue;
      linjer.push(buildLinje({
        periodeLabel,
        periode: periode.navn,
        medregnedeDage: share.selectedDayCount,
        alleDage: share.allocationDayCount,
        // Fald-tilbage-dagene er hverken rækkens arbejdsdage eller alle dens kalenderdage (periodisering-contract.md
        // §3A); et neutralt «dage» er det eneste, der er sandt.
        enhed: share.usesFallbackDays ? 'dage' : enhed,
        medregnetBeloeb: share.projected.samlet,
        heleBeloebet,
      }));
    }
  }
  return medIndledning(LOEN_INDLEDNING, linjer);
};

/**
 * Linjerne under én tabel i bilaget «Offentlige ydelser» – én pr. trykt række og periode, hvor kun en del af
 * ydelsens dage ligger i perioden. Enheden er ydelsestypens egen (kalenderdage eller arbejdsdage).
 *
 * Importeret midlertidig EET («Midlertidig EET fra EET-siden») fradrages ikke ud fra rækkerne, men ud fra
 * EET-beregningen pr. periode (bilaget «Midlertidig EET»), og forklares derfor ikke her.
 */
export const buildOffentligeYdelserDelvisePerioderLinjer = (params: Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  /** De rækker, tabellen trykker, i tabellens rækkefølge. */
  trykteRaekker: readonly OffentligeYdelserRow[];
  perioder: readonly EoBilagDelvisPeriode[];
}>): readonly string[] => {
  const { eoValues, trykteRaekker, perioder } = params;
  if (perioder.length === 0 || trykteRaekker.length === 0) return [];
  const springMidlertidigtEetOver = eoValues.midlertidigtEetFraEetSiden === 'Ja';

  const delvisePerPeriode = perioder.map((periode) => ({
    periode,
    rows: new Map(
      buildIncomeRowSharesForRanges(eoValues, periode.ranges).ydelseRows
        .filter((share) => share.overlapDage < share.periodiseringsDage)
        .map((share) => [share.row.id, share] as const)
    ),
  }));

  const linjer: string[] = [];
  for (const row of trykteRaekker) {
    for (const { periode, rows } of delvisePerPeriode) {
      const share = rows.get(row.id);
      if (!share) continue;
      if (springMidlertidigtEetOver && share.typeKey === 'midlertidigt_eet') continue;
      linjer.push(buildLinje({
        periodeLabel: `${formatISOToDanish(row.fraDato)} - ${formatISOToDanish(row.tilDato)}`,
        periode: periode.navn,
        medregnedeDage: share.overlapDage,
        alleDage: share.periodiseringsDage,
        enhed: share.usesFallbackDays ? 'dage' : share.periodisering,
        medregnetBeloeb: share.periodiseretAmount,
        heleBeloebet: share.amount,
      }));
    }
  }
  return medIndledning(YDELSE_INDLEDNING, linjer);
};

import { beregnOmregnetAarsloen } from './aarsloenCalculations';
import { calculateStandardLoenRowDerived, roundStandardLoenAmountToTwoDecimals } from './standardLoenRowCalculations';
import {
  beregnFejlmeddelelser,
  harTabelData,
  resolveAarsloenCanonicalRangeIssues,
} from './aarsloenValidationPolicies';
import { erAarsloenFerieFelterRelevant } from '../policies/aarsloenPolicy';
import { beregnSHDageForDatoSet } from '../dates/shDageBeregning';
import type { AarsloenValues } from '../../schemas/formSchemas';
import type { AarsloenBeregningResult } from '../../types/calculation';
import { LOENPERIODE, LOEN_PAA_HELLIGDAGE } from '../../types/loen';
import { isErr, type Result } from '../../types/result';
import {
  beregnDagPeriode,
  beregnMaanedPeriode,
  beregnUgePeriode,
  type PeriodeResult,
} from '../../utils/periodeBeregning';
import { safeCompute } from '../../utils/safeComputation';

export type AarsloenBeregningState = Readonly<{
  periodeData: PeriodeResult | null;
  shDageAntal: number | null;
  beregnetAarsloen: number;
  beregningsData: AarsloenBeregningResult;
  fejlmeddelelser: string[];
  beregningsFejl: string | null;
  harFatalBeregningsFejl: boolean;
}>;

export type AarsloenBeregningInput = Readonly<{
  values: AarsloenValues;
  omregningAktiveret: boolean;
}>;

const valueOrNull = <T>(result: Result<T> | null): T | null =>
  result === null || isErr(result) ? null : result.value;

/**
 * Ren, synkron årslønsberegning – årslønsdomænets ene beregningsindgang.
 *
 * Modulet lå tidligere i `src/hooks/useAarsloenBeregning.ts` og eksponerede desuden en `useAarsloenBeregning`-
 * hook. Hook-wrapperen havde INGEN produktionscallsites: efter reader-projektionens indførelse
 * kalder `aarsloenProjection.ts` den rene funktion, og memoiseringen ejes af projektionen. Kun hookens egne
 * tests holdt den levende – de kørte altså en vej, ingen bruger kunne nå, og en fejl i den rene beregnings
 * kontrolflow kunne derfor bevises "dækket" gennem en død adapter. Hook + fil-placering er væk, og
 * beregningen bor nu ved sin domænegrænse, hvor dens eneste consumer også bor (`src/hooks` importeres ikke
 * længere fra `src/domain`).
 */
export const computeAarsloenBeregning = ({
  values,
  omregningAktiveret,
}: AarsloenBeregningInput): AarsloenBeregningState => {
  const {
    tableData,
    loenperiode,
    tillaegAngivesSom,
    feriePct,
    fritvalgPct,
    shSoPct,
    storeBededagPct,
    pensionPct,
    fuldLoenUnderFerie,
    retTilSjetteFerieuge,
    antalFeriedage,
    loenPaaHelligdage,
  } = values;
  const canonicalRangeIssues = resolveAarsloenCanonicalRangeIssues(values, { omregningAktiveret });

  let periodeDataResult: Result<PeriodeResult | null> | null = null;
  if (tableData.length > 0 && harTabelData(tableData, loenperiode)) {
    periodeDataResult = safeCompute(() => {
      if (loenperiode === LOENPERIODE.MAANED) return beregnMaanedPeriode(tableData);
      if (loenperiode === LOENPERIODE.UGE) return beregnUgePeriode(tableData);
      if (loenperiode === LOENPERIODE.DAG) return beregnDagPeriode(tableData);
      return null;
    }, 'aarsloenBeregning.periodeBeregning');
  }
  const periodeData = valueOrNull(periodeDataResult);

  let shDageAntalResult: Result<number> | null = null;
  if (
    omregningAktiveret
    && periodeData !== null
    && (loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.SH_UDBETALING || loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.INGEN)
  ) {
    shDageAntalResult = safeCompute(() => {
      const datoSet = periodeData.datoSet;
      return datoSet === undefined || datoSet.size === 0 ? 0 : beregnSHDageForDatoSet(datoSet);
    }, 'aarsloenBeregning.shDageBeregning');
  }
  const shDageAntal = valueOrNull(shDageAntalResult);

  const beregnetAarsloenResult = tableData.length === 0
    ? null
    : safeCompute(
        () => tableData.reduce((sum, row) => {
          const derived = calculateStandardLoenRowDerived(row, {
            feriePct,
            fritvalgPct,
            shSoPct,
            storeBededagPct,
            pensionPct,
          }, { mode: tillaegAngivesSom });
          return sum + roundStandardLoenAmountToTwoDecimals(derived.samlet);
        }, 0),
        'aarsloenBeregning.aarsloenBeregning'
      );
  const beregnetAarsloen = valueOrNull(beregnetAarsloenResult) ?? 0;

  let beregningsDataResult: Result<AarsloenBeregningResult> | null = null;
  if (periodeData !== null && omregningAktiveret) {
    beregningsDataResult = safeCompute(() => {
      const ferieFelterRelevante = erAarsloenFerieFelterRelevant(fuldLoenUnderFerie);
      return beregnOmregnetAarsloen({
        periodeData,
        loenperiode,
        retTilSjetteFerieuge: ferieFelterRelevante ? retTilSjetteFerieuge : false,
        antalFeriedage: ferieFelterRelevante ? antalFeriedage : undefined,
        shDageAntal,
        fuldLoenUnderFerie,
        loenPaaHelligdage,
        beregnetAarsloen,
      });
    }, 'aarsloenBeregning.omregnetAarsloenBeregning');
  }
  const beregningsData = valueOrNull(beregningsDataResult) ?? { metode: 'ingen' as const, erEtAar: false };

  const fejlmeddelelser = omregningAktiveret && periodeData !== null
    ? beregnFejlmeddelelser(feriePct, shSoPct, fuldLoenUnderFerie, retTilSjetteFerieuge, loenPaaHelligdage)
    : [];

  let beregningsFejl: string | null = null;
  if (canonicalRangeIssues.length > 0) beregningsFejl = canonicalRangeIssues[0]?.message ?? 'Ugyldigt beregningsinput';
  else if (periodeDataResult && isErr(periodeDataResult)) beregningsFejl = 'Fejl ved beregning af periode-data';
  else if (shDageAntalResult && isErr(shDageAntalResult)) beregningsFejl = 'Fejl ved beregning af SH-dage';
  else if (beregnetAarsloenResult && isErr(beregnetAarsloenResult)) beregningsFejl = 'Fejl ved beregning af årsløn';
  else if (beregningsDataResult && isErr(beregningsDataResult)) beregningsFejl = 'Fejl ved beregning af omregnet årsløn';

  return {
    periodeData,
    shDageAntal,
    beregnetAarsloen,
    beregningsData,
    fejlmeddelelser,
    beregningsFejl,
    harFatalBeregningsFejl: beregningsFejl !== null,
  };
};

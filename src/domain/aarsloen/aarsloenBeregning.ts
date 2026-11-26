import { resolveHoejFeriePctAdvarsel } from '../loen/feriePctYdelse';
import { resolveFravalgtStoreBededagstillaegAdvarsel } from '../loen/storeBededagstillaeg';
import { resolveAarsloenSatsBindings, resolveAarsloenTillaegsMode } from './aarsloenTillaeg';
import { beregnOmregnetAarsloen } from './aarsloenCalculations';
import { calculateStandardLoenRowDerived, roundStandardLoenAmountToTwoDecimals } from './standardLoenRowCalculations';
import {
  AARSLOEN_INGEN_OMREGNINGSDAGE_BESKED,
  beregnFejlmeddelelser,
  harAarsloenIngenOmregningsdage,
  harTabelData,
  resolveAarsloenCanonicalRangeIssues,
} from './aarsloenValidationPolicies';
import { erAarsloenFerieFelterRelevant, erAarsloenLoenforholdValgRelevante, erAarsloenSatsFelterRelevante } from '../policies/aarsloenPolicy';
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
import { formatAsAmount } from '../../utils/formatUtils';

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
 * `aarsloenProjection.ts` kalder den rene funktion og ejer memoiseringen; der findes bevidst ingen
 * `useAarsloenBeregning`-hook. En hook-wrapper uden produktionscallsites holdes kun levende af sine egne tests,
 * så en fejl i beregningens kontrolflow kan bevises "dækket" gennem en død adapter. Beregningen bor ved sin
 * domænegrænse, hvor dens eneste consumer også bor (`src/domain` importerer ikke fra `src/hooks`).
 */
type AarsloenPeriodeInput = Readonly<{
  tableData: AarsloenBeregningInput['values']['tableData'];
  loenperiode: AarsloenBeregningInput['values']['loenperiode'];
  loenPaaHelligdage: AarsloenBeregningInput['values']['loenPaaHelligdage'];
  omregningAktiveret: boolean;
}>;

const computeAarsloenPeriodeOgShDageResults = ({
  tableData,
  loenperiode,
  loenPaaHelligdage,
  omregningAktiveret,
}: AarsloenPeriodeInput): Readonly<{
  periodeDataResult: Result<PeriodeResult | null> | null;
  shDageAntalResult: Result<number> | null;
}> => {
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
  return { periodeDataResult, shDageAntalResult };
};

/**
 * Periodedata og SH-dage alene – det SH-dage-dokumentet bygger på. Læser kun periodecellerne, valget «Løn på
 * helligdage» og om omregningen er slået til, så en rød sats, overenskomst eller et beløb, som SH-dage ikke bruger,
 * ikke kan spærre dokumentet: et dokument blokeres kun af de felter, det selv bruger.
 */
export const computeAarsloenPeriodeOgShDage = (input: AarsloenPeriodeInput): Readonly<{
  periodeData: PeriodeResult | null;
  shDageAntal: number | null;
}> => {
  const { periodeDataResult, shDageAntalResult } = computeAarsloenPeriodeOgShDageResults(input);
  return { periodeData: valueOrNull(periodeDataResult), shDageAntal: valueOrNull(shDageAntalResult) };
};

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

  const { periodeDataResult, shDageAntalResult } = computeAarsloenPeriodeOgShDageResults({
    tableData, loenperiode, loenPaaHelligdage, omregningAktiveret,
  });
  const periodeData = valueOrNull(periodeDataResult);
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
          }, { mode: resolveAarsloenTillaegsMode(tillaegAngivesSom) });
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

  // Advarslerne handler UDELUKKENDE om satserne, og satserne bruges i Procent- og Overenskomst-tilstand. I
  // Beløb-tilstand er procentfelterne både skjulte og neutraliserede i beregningen, så en advarsel om dem
  // ville pege på et felt, brugeren ikke kan se, om en sats programmet ikke bruger. Betingelsen er samme
  // relevans-prædikat, som styrer feltsynligheden (`aarsloen-contract.md` §2-regel 5) – ikke en parallel
  // regel: descriptorernes `relevance` og `resolveAarsloenCanonicalRangeIssues` spørger om præcis det samme.
  const satserErIBrug = erAarsloenSatsFelterRelevante(tillaegAngivesSom);
  // Ferie-/SH-advarslerne holder satserne op mod «Fuld løn under ferie» og «Løn på helligdage» og følger derfor
  // samme relevans som de to valgs synlighed – ens i Procent og Overenskomst. Skjulte
  // ferieugevalg må ikke advare. En SH/SO-sats, overenskomsten selv har fastsat og låst, kan brugeren ikke rette;
  // den er overenskomstens egen og vurderes ikke.
  const shSoErLaast = tillaegAngivesSom === 'overenskomst' && resolveAarsloenSatsBindings(values).shSoPct.kind !== 'bruger';
  const fejlmeddelelser = satserErIBrug && erAarsloenLoenforholdValgRelevante({ tillaegAngivesSom, omregningAktiveret }) && periodeData !== null
    ? beregnFejlmeddelelser(feriePct, shSoErLaast ? undefined : shSoPct, fuldLoenUnderFerie, retTilSjetteFerieuge, loenPaaHelligdage, { medtagFerieuge: omregningAktiveret })
    : [];

  // Den høje feriesats vurderes, når satserne bruges – i Procent som i Overenskomst og som på Lønindkomst.
  // Gælder bevidst også tidligere gemte sager (en ny, ikke-blokerende advarsel efter load).
  if (satserErIBrug && periodeData !== null) {
    const hoejFerie = resolveHoejFeriePctAdvarsel(feriePct);
    if (hoejFerie !== undefined) fejlmeddelelser.push(hoejFerie);
  }
  if (tillaegAngivesSom === 'overenskomst' && periodeData !== null) {
    const fravalgtBededag = resolveFravalgtStoreBededagstillaegAdvarsel(values.reguleringsdato, {
      loenPaaHelligdage, beregnStoreBededagstillaeg: values.beregnStoreBededagstillaeg,
    });
    if (fravalgtBededag !== undefined) fejlmeddelelser.push(fravalgtBededag);
  }

  let beregningsFejl: string | null = null;
  if (canonicalRangeIssues.length > 0) beregningsFejl = canonicalRangeIssues[0]?.message ?? 'Ugyldigt beregningsinput';
  else if (periodeDataResult && isErr(periodeDataResult)) beregningsFejl = 'Fejl ved beregning af periode-data';
  else if (shDageAntalResult && isErr(shDageAntalResult)) beregningsFejl = 'Fejl ved beregning af SH-dage';
  else if (beregnetAarsloenResult && isErr(beregnetAarsloenResult)) beregningsFejl = 'Fejl ved beregning af årsløn';
  // En samlet negativ løn kan ikke danne en årsløn. Den spærrer med en navngiven linje som en samlet negativ kilde
  // på EO; ellers kunne dokumentet hentes med fx «Omregnet årsløn -360.000 kr.».
  else if (beregnetAarsloen < 0) beregningsFejl = `Lønnen i tabellen er samlet negativ (${formatAsAmount(beregnetAarsloen, 2)} kr.) – kontrollér lønrækkerne`;
  else if (beregningsDataResult && isErr(beregningsDataResult)) beregningsFejl = 'Fejl ved beregning af omregnet årsløn';
  // Ingen dage at dele med: omregningen ville vise `0,00 kr.` som en årsløn. Fatal, så resultatet er «—»
  // og dokumentet spærret. Er det feriedagene, der æder dagene, er det i stedet feltets røde grænse.
  else if (omregningAktiveret && harAarsloenIngenOmregningsdage(beregningsData, loenperiode)) beregningsFejl = AARSLOEN_INGEN_OMREGNINGSDAGE_BESKED;

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

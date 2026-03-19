/**
 * Custom hook for årsløn-beregninger
 *
 * Ansvar:
 * - Alle useMemo beregninger (periode, SH-dage, årsløn, omregning)
 * - Fatal error tracking
 * - Fejlmeddelelser
 *
 * Dette hook er ren beregningslogik uden UI state management.
 */

import React from 'react';
import { LOENPERIODE, LOEN_PAA_HELLIGDAGE } from '../types/loen';
import type { AarsloenValues } from '../schemas/formSchemas';
import { safeCompute } from '../utils/safeComputation';
import { isErr, type Result } from '../types/result';
import { calculateAarsloenRowDerived, roundAarsloenAmountToTwoDecimals } from '../domain/aarsloen/aarsloenRowCalculations';
import {
  beregnMaanedPeriode,
  beregnUgePeriode,
  beregnDagPeriode,
  type PeriodeResult
} from '../utils/periodeBeregning';
import { beregnSHDageForDatoSet } from '../domain/dates/shDageBeregning';
import { beregnOmregnetAarsloen } from '../domain/aarsloen/aarsloenCalculations';
import type { AarsloenBeregningResult } from '../types/calculation';
import { beregnFejlmeddelelser, harTabelData } from '../domain/aarsloen/aarsloenValidationPolicies';

export type AarsloenBeregningState = {
  // Beregnings-resultater
  periodeData: PeriodeResult | null;
  shDageAntal: number | null;
  beregnetAarsloen: number;
  beregningsData: AarsloenBeregningResult;

  // Fejl-tracking
  fejlmeddelelser: string[];
  beregningsFejl: string | null;
  harFatalBeregningsFejl: boolean;
};

type UseAarsloenBeregningProps = {
  values: AarsloenValues;
  omregningAktiveret: boolean;
};

/**
 * Hook der håndterer alle årslønsberegninger
 *
 * @param values - Form values fra usePersistedForm
 * @param omregningAktiveret - Om omregning til fuldt år er aktiveret
 * @returns Beregnings-state og fejl-tracking
 */
export const useAarsloenBeregning = ({
  values,
  omregningAktiveret,
}: UseAarsloenBeregningProps): AarsloenBeregningState => {
  const {
    tableData,
    loenperiode,
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

  // ============================================================================
  // BEREGNING 1: Periode-data fra tabellen
  // ============================================================================
  const periodeDataResult = React.useMemo((): Result<PeriodeResult | null> | null => {
    if (!tableData || tableData.length === 0) {
      return null;
    }

    // Tjek om der er nogen ikke-tomme perioder i tabellen
    if (!harTabelData(tableData, loenperiode)) {
      return null;
    }

    // Beregn samlet periode og unikke enheder
    return safeCompute(() => {
      if (loenperiode === LOENPERIODE.MAANED) {
        return beregnMaanedPeriode(tableData);
      } else if (loenperiode === LOENPERIODE.UGE) {
        return beregnUgePeriode(tableData);
      } else if (loenperiode === LOENPERIODE.DAG) {
        return beregnDagPeriode(tableData);
      }
      return null;
    }, 'useAarsloenBeregning.periodeBeregning');
  }, [tableData, loenperiode]);

  // Udpak periodeData fra Result
  const periodeData = React.useMemo((): PeriodeResult | null => {
    if (!periodeDataResult) return null;
    if (isErr(periodeDataResult)) return null;
    return periodeDataResult.value;
  }, [periodeDataResult]);

  // ============================================================================
  // BEREGNING 2: SH-dage (kun hvis omregning aktiveret)
  // ============================================================================
  const shDageAntalResult = React.useMemo((): Result<number> | null => {
    // Kun beregn hvis omregning er aktiveret
    if (!omregningAktiveret || !periodeData) {
      return null;
    }

    // Kun beregn hvis SH-dage er relevant for valgt helligdagstype
    if (
      loenPaaHelligdage !== LOEN_PAA_HELLIGDAGE.SH_UDBETALING &&
      loenPaaHelligdage !== LOEN_PAA_HELLIGDAGE.INGEN
    ) {
      return null;
    }

    return safeCompute(() => {
      const datoSet = periodeData.datoSet;
      if (!datoSet || datoSet.size === 0) {
        return 0;
      }
      return beregnSHDageForDatoSet(datoSet);
    }, 'useAarsloenBeregning.shDageBeregning');
  }, [omregningAktiveret, periodeData, loenPaaHelligdage]);

  // Udpak shDageAntal fra Result (null = fejl eller ikke relevant)
  const shDageAntal = React.useMemo((): number | null => {
    if (!shDageAntalResult) return null;
    if (isErr(shDageAntalResult)) return null;
    return shDageAntalResult.value;
  }, [shDageAntalResult]);

  // ============================================================================
  // BEREGNING 3: Beregnet årsløn (sum af tabel)
  // ============================================================================
  const beregnetAarsloenResult = React.useMemo((): Result<number> | null => {
    if (!tableData || tableData.length === 0) {
      return null;
    }

    return safeCompute(() => {
      return tableData.reduce((acc, row) => {
        if (!row) {
          return acc;
        }
        const derived = calculateAarsloenRowDerived(row, {
          feriePct,
          fritvalgPct,
          shSoPct,
          storeBededagPct,
          pensionPct,
        });

        return acc + roundAarsloenAmountToTwoDecimals(derived.samlet);
      }, 0);
    }, 'useAarsloenBeregning.aarsloenBeregning');
  }, [tableData, feriePct, fritvalgPct, shSoPct, storeBededagPct, pensionPct]);

  // Udpak beregnetAarsloen fra Result (fallback til 0 hvis fejl)
  const beregnetAarsloen = React.useMemo((): number => {
    if (!beregnetAarsloenResult) return 0;
    if (isErr(beregnetAarsloenResult)) return 0;
    return beregnetAarsloenResult.value;
  }, [beregnetAarsloenResult]);

  // ============================================================================
  // BEREGNING 4: Omregnet årsløn (kun hvis omregning aktiveret)
  // ============================================================================
  const beregningsDataResult = React.useMemo((): Result<AarsloenBeregningResult> | null => {
    // Hvis ingen data eller omregning ikke aktiveret
    if (!periodeData || !omregningAktiveret) {
      return null;
    }

    return safeCompute(() => {
      // Ignorér værdier fra skjulte felter
      // "Ret til 6. ferieuge" og "Antal feriedage" er kun synlige hvis !fuldLoenUnderFerie
      const retTilSjetteFerieugeFinal = !fuldLoenUnderFerie ? retTilSjetteFerieuge : false;
      const antalFeriedageFinal = !fuldLoenUnderFerie ? antalFeriedage : undefined;

      return beregnOmregnetAarsloen({
        periodeData,
        loenperiode,
        retTilSjetteFerieuge: retTilSjetteFerieugeFinal,
        antalFeriedage: antalFeriedageFinal,
        shDageAntal, // Sender null hvis beregning fejlede - domain-lag håndterer det
        fuldLoenUnderFerie,
        loenPaaHelligdage,
        beregnetAarsloen,
      });
    }, 'useAarsloenBeregning.omregnetAarsloenBeregning');
  }, [
    periodeData,
    loenperiode,
    retTilSjetteFerieuge,
    antalFeriedage,
    shDageAntal,
    fuldLoenUnderFerie,
    loenPaaHelligdage,
    omregningAktiveret,
    beregnetAarsloen,
  ]);

  // Udpak beregningsData fra Result
  const beregningsData = React.useMemo((): AarsloenBeregningResult => {
    if (!beregningsDataResult) {
      return { metode: 'ingen' as const, erEtAar: false };
    }
    if (isErr(beregningsDataResult)) {
      return { metode: 'ingen' as const, erEtAar: false };
    }
    return beregningsDataResult.value;
  }, [beregningsDataResult]);

  // ============================================================================
  // FEJL-TRACKING
  // ============================================================================

  // Fejlmeddelelser (kun når omregning aktiveret)
  const fejlmeddelelser = React.useMemo((): string[] => {
    // Kun valider hvis omregnings-sektionen er synlig
    if (!omregningAktiveret || !periodeData) {
      return [];
    }

    return beregnFejlmeddelelser(
      feriePct,
      shSoPct,
      fuldLoenUnderFerie,
      retTilSjetteFerieuge,
      loenPaaHelligdage
    );
  }, [omregningAktiveret, periodeData, feriePct, shSoPct, fuldLoenUnderFerie, loenPaaHelligdage, retTilSjetteFerieuge]);

  // Beregningsfejl (samlet)
  const beregningsFejl = React.useMemo((): string | null => {
    if (periodeDataResult && isErr(periodeDataResult)) return 'Fejl ved beregning af periode-data';
    if (shDageAntalResult && isErr(shDageAntalResult)) return 'Fejl ved beregning af SH-dage';
    if (beregnetAarsloenResult && isErr(beregnetAarsloenResult)) return 'Fejl ved beregning af årsløn';
    if (beregningsDataResult && isErr(beregningsDataResult)) return 'Fejl ved beregning af omregnet årsløn';
    return null;
  }, [beregningsDataResult, beregnetAarsloenResult, periodeDataResult, shDageAntalResult]);

  // Fatal gate: Én samlet check for om beregninger er gyldige
  const harFatalBeregningsFejl = React.useMemo((): boolean => {
    return beregningsFejl !== null;
  }, [beregningsFejl]);

  return {
    periodeData,
    shDageAntal,
    beregnetAarsloen,
    beregningsData,
    fejlmeddelelser,
    beregningsFejl,
    harFatalBeregningsFejl,
  };
};

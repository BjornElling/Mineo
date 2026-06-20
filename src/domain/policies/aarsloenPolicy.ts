import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, type Loenperiode } from '../../types/loen';
import { isStandardLoenRowEffectivelyEmpty } from '../aarsloen/standardLoenRowCalculations';

export type AarsloenValues = PersistedSectionMap['aarsloen'];

// UI-policy-hjælpere for Aarsloen.
// Disse funktioner udtrykker synligheds-/advarselsregler, ikke økonomiske beregninger.

export const resolveAarsloenDefaultLoenperiode = (aarsloen: AarsloenValues | null): Loenperiode => {
  return aarsloen?.loenperiode ?? LOENPERIODE.MAANED;
};

export const hasAarsloenEffectiveRows = (aarsloen: AarsloenValues | null): boolean => {
  if (!aarsloen) return false;
  if (!Array.isArray(aarsloen.tableData) || aarsloen.tableData.length === 0) return false;
  return aarsloen.tableData.some((row) => !isStandardLoenRowEffectivelyEmpty(row, aarsloen.loenperiode, aarsloen.tillaegAngivesSom));
};

export const shouldShowAarsloenFerieFields = (aarsloen: AarsloenValues | null): boolean => {
  if (!aarsloen) return false;
  return !aarsloen.fuldLoenUnderFerie;
};

export const shouldShowAarsloenShDageFields = (aarsloen: AarsloenValues | null): boolean => {
  if (!aarsloen) return false;
  return (
    aarsloen.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.SH_UDBETALING ||
    aarsloen.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.INGEN
  );
};

export const shouldWarnAarsloenFeriePct = (aarsloen: AarsloenValues | null): boolean => {
  if (!aarsloen) return false;
  if (aarsloen.feriePct === undefined) return false;
  return aarsloen.feriePct >= 15 && !aarsloen.fuldLoenUnderFerie && !aarsloen.retTilSjetteFerieuge;
};

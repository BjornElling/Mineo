import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, type Loenperiode } from '../../types/loen';
import type { TillaegAngivesSom } from '../../schemas/formSchemas';
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

/**
 * Relevans for ferie-felterne ("Ret til 6. ferieuge", "Antal feriedage"): de er relevante,
 * når der IKKE er fuld løn under ferie. Dette er det ENESTE sande sted for betingelsen –
 * både UI-synligheden (shouldShowAarsloenFerieFields) og beregnings-gatingen
 * (computeAarsloenBeregning) læser herfra, så "skjult i UI" og "ignoreret i beregning" ikke
 * kan divergere.
 */
export const erAarsloenFerieFelterRelevant = (fuldLoenUnderFerie: boolean): boolean =>
  !fuldLoenUnderFerie;

/**
 * Relevans for de fem SATSFELTER (Feriegodtgørelse/-tillæg, Fritvalg, SH/SO, Store Bededag,
 * Arbejdsgivers pensionsbidrag): de er kun i brug i Procent-tilstand.
 *
 * I Beløb-tilstand angiver brugeren tillægsbeløbene direkte, og satserne er både skjulte i Satser-boksen
 * og neutraliserede i beregningen (tilstands-isolation, jf. `aarsloen-contract.md` §2a). Dette er det ENESTE
 * sande sted for betingelsen: descriptorernes `relevance`, `resolveAarsloenCanonicalRangeIssues` og sidens
 * satsadvarsler spørger alle om det samme – uden prædikatet kunne en advarsel om en sats blive stående,
 * efter at programmet var holdt op med at bruge den, og pege på et felt, brugeren ikke længere kan se.
 */
export const erAarsloenSatsFelterRelevante = (tillaegAngivesSom: TillaegAngivesSom): boolean =>
  tillaegAngivesSom !== 'beloeb';

export const shouldShowAarsloenFerieFields = (aarsloen: AarsloenValues | null): boolean => {
  if (!aarsloen) return false;
  return erAarsloenFerieFelterRelevant(aarsloen.fuldLoenUnderFerie);
};

export const shouldShowAarsloenShDageFields = (aarsloen: AarsloenValues | null): boolean => {
  if (!aarsloen) return false;
  return (
    aarsloen.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.SH_UDBETALING ||
    aarsloen.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.INGEN
  );
};


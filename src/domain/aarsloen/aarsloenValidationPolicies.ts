/**
 * Validerings- og beregningslogik for årslønsberegning
 *
 * Disse funktioner er rene (ingen side effects) og kan testes isoleret.
 */

import type { AarsloenValues, StandardLoenTableRow, LoenPaaHelligdage, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE } from '../../types/loen';
import { formatPercent } from '../../utils/formatUtils';
import { hasCompletePeriodForLoenperiode } from './standardLoenRowCalculations';
import { getStandardLoenTableValidation } from './standardLoenTableValidation';
import type { StandardLoenTableValidationSummary } from '../../types/table';

export type AarsloenCanonicalRangeIssue = Readonly<{
  field: 'feriePct' | 'fritvalgPct' | 'shSoPct' | 'storeBededagPct' | 'pensionPct' | 'antalFeriedage';
  message: string;
}>;

const AARSLOEN_PERCENT_FIELDS = [
  'feriePct',
  'fritvalgPct',
  'shSoPct',
  'storeBededagPct',
  'pensionPct',
] as const;

/**
 * Ren range-gate for canonical årslønsinput. Kun input der er relevant for den
 * aktuelle beregning medtages; skjulte satser har ingen virkning i beløbstilstand.
 */
export const resolveAarsloenCanonicalRangeIssues = (
  values: AarsloenValues,
  options: Readonly<{ omregningAktiveret: boolean }>
): readonly AarsloenCanonicalRangeIssue[] => {
  const issues: AarsloenCanonicalRangeIssue[] = [];

  if (values.tillaegAngivesSom === 'procent') {
    for (const field of AARSLOEN_PERCENT_FIELDS) {
      const value = values[field];
      if (value !== undefined && (value < 0 || value > 100)) {
        issues.push({ field, message: 'Procenten skal være mellem 0 og 100 %.' });
      }
    }
  }

  if (
    options.omregningAktiveret
    && !values.fuldLoenUnderFerie
    && values.antalFeriedage !== undefined
    && (values.antalFeriedage < 0 || values.antalFeriedage > 99)
  ) {
    issues.push({ field: 'antalFeriedage', message: 'Antal feriedage skal være mellem 0 og 99.' });
  }

  return issues;
};

/**
 * Feriedage kan ikke overstige periodens EGNE hverdage.
 *
 * Feltets erklærede grænse (0–99) er valgt efter feltets ART – et antal dage – ikke efter det tal, det
 * bliver trukket fra. Uden denne regel gav «99 feriedage» i en enkelt måned et negativt antal arbejdsdage
 * (23 − 99 = −76), og omregningen klampede resultatet til `0,00 kr.` og præsenterede nullet som et beløb.
 *
 * Grænsen kendes præcist: det er det hverdagstal, siden selv skriver i samme linje. Reglen er derfor en
 * AFLEDT grænse, ikke en indtastningsbegrænsning – værdien committes canonical, og feltet bliver rødt med
 * den konkrete grænse i tooltippet (udviklerbeslutning 2026-08-26: ingen egentlig begrænsning i
 * indtastningen, men rød ring og en tooltip, der forklarer fejlen).
 *
 * Reglen kan ikke bo i en descriptor-validator: grænsen udledes af TABELLENS rækker, og `CanonicalView`
 * kan kun læse et enkelt felt ad gangen – den kan ikke opregne en collections rækker.
 */
export const resolveAarsloenFeriedageOverskriderPeriodenIssue = (
  values: AarsloenValues,
  options: Readonly<{ omregningAktiveret: boolean; hverdageIPeriode: number }>
): AarsloenCanonicalRangeIssue | null => {
  if (!options.omregningAktiveret) return null;
  if (values.fuldLoenUnderFerie) return null;
  if (values.antalFeriedage === undefined) return null;
  // Den statiske 0–99-grænse svarer først; to samtidige beskeder på ét felt ville konkurrere.
  if (values.antalFeriedage < 0 || values.antalFeriedage > 99) return null;
  // Uden en beregnet periode findes grænsen ikke endnu – tabellen bærer selv sine egne fejl.
  if (!Number.isFinite(options.hverdageIPeriode) || options.hverdageIPeriode <= 0) return null;
  if (values.antalFeriedage <= options.hverdageIPeriode) return null;

  return {
    field: 'antalFeriedage',
    message: `Antal feriedage kan højst være ${options.hverdageIPeriode} (hverdage i de indtastede perioder).`,
  };
};

/**
 * Tjekker om der er valideringsfejl i tabeldata
 *
 * @param tableData - Tabeldata
 * @param loenperiode - Lønperiode type
 * @returns sand hvis der er valideringsfejl
 */
export const harTabelValideringsFejl = (
  tableData: StandardLoenTableRow[],
  loenperiode: Loenperiode,
  tillaegAngivesSom: TillaegAngivesSom = 'procent'
): boolean => {
  if (!tableData || tableData.length === 0) {
    return false;
  }

  return getStandardLoenTableValidation({
    rows: tableData,
    loenperiode,
    tillaegAngivesSom,
    emptyCompletePeriodLevel: 'error',
  }).summary.hasErrors;
};

/**
 * Feltets eget navn i advarselsteksterne (§3.2a: et felt ejer sit navn ÉT sted).
 *
 * Teksterne kaldte tidligere feltet «feriepengesats» og «feriegodtgørelsessats» – to ord, hvoraf ingen stod
 * på skærmen, hvor feltet hedder «Feriegodtgørelse/-tillæg». En advarsel skal føre brugeren hen til det
 * felt, den handler om, og kan derfor kun bruge feltets synlige navn.
 *
 * Se `aarsloen-contract.md` §5 for de kanoniske feriepenge-begreber: 'feriegodtgørelse' og 'ferietillæg' er
 * de to konkrete ydelser (aldrig begge på én gang), mens 'feriepenge' kun bruges om den generelle RET, hvor
 * det kan være den ene eller den anden. Når der som her er tale om selve PROCENTSATSEN, er feltets eget
 * navn det korrekte – ikke fællesbetegnelsen.
 */
const FERIE_SATS_FELTNAVN = 'Feriegodtgørelse/-tillæg';

/**
 * Beregner advarselsteksterne for årslønsberegning.
 *
 * ALLE sidens advarsler dannes her – også den om 6. ferieuge, der tidligere stod som løs, hardkodet prosa i
 * `AarsloenMeddelelserSections.tsx` og dermed uden om både den kanoniske procentformattering og feltnavnet.
 *
 * @param feriePct - Feriegodtgørelse/-tillæg i procent
 * @param shSoPct - SH/SO procent
 * @param fuldLoenUnderFerie - Har fuld løn under ferie
 * @param retTilSjetteFerieuge - Ret til 6. ferieuge
 * @param loenPaaHelligdage - Løn på helligdage type
 * @returns Array af advarselstekster
 */
export const beregnFejlmeddelelser = (
  feriePct: number | undefined,
  shSoPct: number | undefined,
  fuldLoenUnderFerie: boolean,
  retTilSjetteFerieuge: boolean,
  loenPaaHelligdage: LoenPaaHelligdage
): string[] => {
  const errors: string[] = [];

  const parsePct = (pct: number | undefined) => (typeof pct === 'number' && Number.isFinite(pct) ? pct : 0);

  const ferieProcent = parsePct(feriePct);
  const shProcent = parsePct(shSoPct);

  // FEJL 1: Feriegodtgørelse konflik (for høj sats MED fuld løn)
  if (ferieProcent >= 12.0 && fuldLoenUnderFerie) {
    errors.push(
      `En sats for ${FERIE_SATS_FELTNAVN} på ${formatPercent(ferieProcent)} gør det højst usandsynligt, at der er ret til løn under ferie.`
    );
  }

  // FEJL 2: Feriegodtgørelse konflik (for lav sats UDEN fuld løn)
  if (ferieProcent > 0 && ferieProcent < 12.0 && !fuldLoenUnderFerie) {
    errors.push(
      `En sats for ${FERIE_SATS_FELTNAVN} på ${formatPercent(ferieProcent)} gør det usandsynligt, at der ikke er ret til fuld løn under ferie.`
    );
  }

  // FEJL 3: SH/SO-sats konflik (for høj sats)
  if (shProcent > 2.5) {
    if (loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG) {
      errors.push(
        `En SH/SO-sats på ${formatPercent(shProcent)} gør det usandsynligt, at der betales almindelig løn på SH-dage.`
      );
    } else if (loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.INGEN) {
      errors.push(
        `En SH/SO-sats på ${formatPercent(shProcent)} gør det usandsynligt, at der ikke er ret til SH-betaling på helligdage.`
      );
    }
  }

  // FEJL 4: SH/SO-sats konflik (for lav sats)
  if (shProcent > 0 && shProcent < 2.5 && loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.SH_UDBETALING) {
    errors.push(
      `En SH/SO-sats på ${formatPercent(shProcent)} gør det yderst tvivlsomt, at der er ret til SH-betaling på helligdage.`
    );
  }

  // FEJL 5: 6. ferieuge med for lav feriegodtgørelse
  if (!fuldLoenUnderFerie && retTilSjetteFerieuge && ferieProcent > 0 && ferieProcent < 15.0) {
    errors.push(
      'Retten til 6. ferieuge vil typisk skulle omsættes til feriegodtgørelse med 15 %.'
    );
  }

  // FEJL 6: en høj sats UDEN ret til 6. ferieuge peger den anden vej.
  //
  // Teksten stod tidligere som løs prosa i `AarsloenMeddelelserSections.tsx` – uden om denne funktion, uden
  // om `formatPercent` (den skrev den rå værdi, så `12,5` blev til «12,5 %», mens de øvrige advarsler
  // skriver den formatterede) og med feltnavnet «feriegodtgørelsessats», som ikke står nogen steder på
  // skærmen. Betingelsen er uændret; kun ejerskabet og ordlyden er samlet.
  if (!fuldLoenUnderFerie && !retTilSjetteFerieuge && ferieProcent >= 15.0) {
    errors.push(
      `En sats for ${FERIE_SATS_FELTNAVN} på ${formatPercent(ferieProcent)} skaber en klar formodning for, at der er ret til 6. ferieuge.`
    );
  }

  return errors;
};

/**
 * Tjekker om der er data i tabellen for den valgte lønperiode
 *
 * @param tableData - Tabeldata
 * @param loenperiode - Lønperiode type
 * @returns sand hvis der er data
 */
export const harTabelData = (
  tableData: StandardLoenTableRow[],
  loenperiode: Loenperiode
): boolean => {
  if (!tableData || tableData.length === 0) {
    return false;
  }

  return tableData.some((row) => hasCompletePeriodForLoenperiode(row, loenperiode));
};

export type AarsloenOmregningGate = Readonly<{
  checked: boolean;
  effectiveEnabled: boolean;
  canEnable: boolean;
  hasValidPeriod: boolean;
  hasBlockingTableIssue: boolean;
  validationSummary: StandardLoenTableValidationSummary;
}>;

export const EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY: StandardLoenTableValidationSummary = {
  rowIssues: [],
  hasErrors: false,
  hasWarnings: false,
};

export const resolveAarsloenOmregningGate = (args: Readonly<{
  requestedEnabled: boolean;
  tableData: StandardLoenTableRow[];
  loenperiode: Loenperiode;
  validationSummary: StandardLoenTableValidationSummary;
}>): AarsloenOmregningGate => {
  const hasValidPeriod = harTabelData(args.tableData, args.loenperiode);
  const hasBlockingTableIssue = args.validationSummary.hasErrors || !hasValidPeriod;
  const checked = args.requestedEnabled && !hasBlockingTableIssue;

  return {
    checked,
    effectiveEnabled: checked,
    canEnable: !hasBlockingTableIssue,
    hasValidPeriod,
    hasBlockingTableIssue,
    validationSummary: args.validationSummary,
  };
};

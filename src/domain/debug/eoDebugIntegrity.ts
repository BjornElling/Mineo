/**
 * Integrity validation for EODebug
 *
 * Niveau A invariants (implementeret nu):
 * 1. PERIOD_OVERLAP - TAF-perioder overlapper
 * 2. DATE_HOLES - Huller i debug-tabel ift. forventet interval
 * 3. BASE_DATE_INCONSISTENT - Reguleringsdato > beregningsperiode-slut
 * 4. TAF_DAYS_MISMATCH - Antal TAF-dage i perioder vs. antal markerede dage i tabel
 * 5. SVIE_SMERTE_MISMATCH - Antal svie/smerte-dage i felter vs. tabel
 */

import { IntegrityInvariant, type DebugDay, type IntegrityIssue, type DateRange } from './eoDebugTypes';
import type { DebugModelInput } from './eoDebugCoreModel';
import { getOverlap, getIsoRange, tryParseIso } from './eoDebugDateUtils';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';
import { clampTafRange, resolveTafConstraintBounds } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';

/**
 * Tjek for overlappende TAF-perioder
 */
const checkPeriodOverlap = (input: DebugModelInput): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];
  const tafPerioder = input.erstatningsopgoerelseValues.tafPerioder ?? [];

  // Konverter til DateRange array
  const ranges: Array<{ range: DateRange; id: string; index: number }> = [];
  for (let i = 0; i < tafPerioder.length; i++) {
    const periode = tafPerioder[i];
    if (!periode) continue;

    const fra = tryParseIso(periode.fra);
    const til = tryParseIso(periode.til);

    if (!fra || !til) continue;
    if (fra > til) continue;

    ranges.push({ range: { start: fra, end: til }, id: periode.id, index: i });
  }

  // Tjek alle par for overlap
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i];
      const b = ranges[j];

      if (!a || !b) continue;

      const overlap = getOverlap(a.range, b.range);

      if (overlap.overlaps) {
        issues.push({
          severity: 'error',
          invariant: IntegrityInvariant.PERIOD_OVERLAP,
          message: `TAF-periode ${a.id} og ${b.id} overlapper (${overlap.start} til ${overlap.end})`,
        });
      }
    }
  }

  return issues;
};

/**
 * Tjek for huller i debug-tabel
 *
 * Verificer at alle dage mellem min og max er inkluderet
 */
const checkDateHoles = (debugDays: readonly DebugDay[]): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];

  if (debugDays.length === 0) return issues;

  const firstIso = debugDays[0]?.iso;
  const lastIso = debugDays[debugDays.length - 1]?.iso;

  if (!firstIso || !lastIso) return issues;

  // Generer forventet range
  const expectedDates = getIsoRange(firstIso, lastIso);

  // Byg Set af faktiske datoer
  const actualDates = new Set(debugDays.map((d) => d.iso));

  // Find manglende datoer
  const missing = expectedDates.filter((iso) => !actualDates.has(iso));

  if (missing.length > 0) {
    issues.push({
      severity: 'error',
      invariant: IntegrityInvariant.DATE_HOLES,
      message: `Debug-tabel mangler ${missing.length} dag(e): ${missing
        .slice(0, 5)
        .join(', ')}${missing.length > 5 ? ' ...' : ''}`,
    });
  }

  return issues;
};

/**
 * Tjek for inkonsistente basisdatoer
 *
 * Eksempel: Reguleringsdato > slutdato for beregningsperiode
 */
const checkBaseDateConsistency = (
  input: DebugModelInput
): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];

  const periodeTil = tryParseIso(
    input.erstatningsopgoerelseValues.vedroererPeriodeTil
  );

  // Tjek menAfgoerelseDato (hvis udfyldt)
  const menAfgoerelseDato = tryParseIso(
    input.erstatningsopgoerelseValues.menAfgoerelseDato
  );
  if (menAfgoerelseDato && periodeTil && menAfgoerelseDato > periodeTil) {
    issues.push({
      severity: 'warning',
      invariant: IntegrityInvariant.BASE_DATE_INCONSISTENT,
      message: `Mén-afgørelsesdato (${menAfgoerelseDato}) er efter beregningsperiode-slut (${periodeTil})`,
    });
  }

  // Tjek forligsdato (hvis udfyldt)
  const forligDato = tryParseIso(
    input.erstatningsopgoerelseValues.forligDato
  );
  if (forligDato && periodeTil && forligDato > periodeTil) {
    issues.push({
      severity: 'warning',
      invariant: IntegrityInvariant.BASE_DATE_INCONSISTENT,
      message: `Forligsdato (${forligDato}) er efter beregningsperiode-slut (${periodeTil})`,
    });
  }

  return issues;
};

/**
 * Tjek TAF-dage mismatch
 *
 * Sammenlign antal dage i TAF-perioder med antal dage markeret i debug-model
 */
const checkTafDaysMismatch = (
  debugDays: readonly DebugDay[],
  input: DebugModelInput
): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];
  const tafPerioder = input.erstatningsopgoerelseValues.tafPerioder ?? [];
  const eo = input.erstatningsopgoerelseValues;
  const tafBounds = resolveTafConstraintBounds({
    vedroererPeriodeFra: tryParseIso(eo.vedroererPeriodeFra),
    vedroererPeriodeTil: tryParseIso(eo.vedroererPeriodeTil),
    differencekravDato: tryParseIso(eo.differencekravDato),
    endeligtEETAfgorelse: eo.endeligtEETAfgorelse,
    endeligEETVirkningsdato: tryParseIso(eo.endeligEETVirkningsdato),
    endeligEETAfgoerelseDato: tryParseIso(eo.endeligEETAfgoerelseDato),
    verserendeKlageEet: eo.verserendeKlageEet,
  });

  for (const periode of tafPerioder) {
    const fra = tryParseIso(periode.fra);
    const til = tryParseIso(periode.til);

    if (!fra || !til) continue;
    if (fra > til) continue;

    const clamped = clampTafRange({ fra, til }, tafBounds);
    if (!clamped) continue;

    // Forventet antal dage (inklusiv-inklusiv)
    const expectedRange = getIsoRange(clamped.fra, clamped.til);
    const expectedCount = expectedRange.length;

    // Faktisk antal dage markeret i debug-model
    const actualCount = debugDays.filter((d) => d.tafFlags.has(periode.id))
      .length;

    if (actualCount !== expectedCount) {
      issues.push({
        severity: 'error',
        invariant: IntegrityInvariant.TAF_DAYS_MISMATCH,
        message: `TAF-periode ${periode.id}: Forventet ${expectedCount} dage, fandt ${actualCount} i debug-tabel`,
        expected: expectedCount,
        actual: actualCount,
      });
    }
  }

  return issues;
};

/**
 * Tjek svie/smerte mismatch
 *
 * Sammenlign antal dage i svie/smerte-perioder med antal dage markeret i debug-model
 */
const checkSvieSmerteMismatch = (
  debugDays: readonly DebugDay[],
  input: DebugModelInput
): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];
  const ssPerioder = input.erstatningsopgoerelseValues.svieSmertePerioder ?? [];
  const erstatningsFra = tryParseIso(input.erstatningsopgoerelseValues.vedroererPeriodeFra);
  const erstatningsTil = tryParseIso(input.erstatningsopgoerelseValues.vedroererPeriodeTil);
  const erstatningsRange =
    erstatningsFra && erstatningsTil && erstatningsFra <= erstatningsTil
      ? { fra: erstatningsFra, til: erstatningsTil }
      : undefined;
  const menStopDato =
    input.erstatningsopgoerelseValues.varigeMenAfgorelse === 'Ja' &&
    input.erstatningsopgoerelseValues.verserendeKlageMen === 'Nej'
      ? getDayBeforeIso(tryParseIso(input.erstatningsopgoerelseValues.menAfgoerelseDato))
      : undefined;

  for (const periode of ssPerioder) {
    const fra = tryParseIso(periode.fra);
    const til = tryParseIso(periode.til);

    if (!fra || !til) continue;
    if (fra > til) continue;

    let clampedFra = fra;
    let clampedTil = til;
    if (erstatningsRange) {
      if (clampedFra < erstatningsRange.fra) clampedFra = erstatningsRange.fra;
      if (clampedTil > erstatningsRange.til) clampedTil = erstatningsRange.til;
    }
    if (menStopDato && clampedTil > menStopDato) clampedTil = menStopDato;
    if (clampedFra > clampedTil) continue;

    // Forventet antal dage
    const expectedRange = getIsoRange(clampedFra, clampedTil);
    const expectedCount = expectedRange.length;

    // Forventet niveau
    let expectedNiveau: 'Fuld' | 'Delvis' | 'Ingen';
    switch (periode.tilstand) {
      case 'sygemeldt':
        expectedNiveau = 'Fuld';
        break;
      case 'delvist-sygemeldt':
        expectedNiveau = 'Delvis';
        break;
      default:
        expectedNiveau = 'Ingen';
    }

    // Faktisk antal dage med dette niveau i perioden
    const actualCount = debugDays.filter((d) => {
      const inRange = d.iso >= clampedFra && d.iso <= clampedTil;
      return inRange && d.svieSmerte === expectedNiveau;
    }).length;

    // Hvis perioden har "Ingen", checker vi ikke mismatch (det er default)
    if (expectedNiveau === 'Ingen') continue;

    if (actualCount !== expectedCount) {
      issues.push({
        severity: 'error',
        invariant: IntegrityInvariant.SVIE_SMERTE_MISMATCH,
        message: `Svie/smerte-periode ${periode.id} (${expectedNiveau}): Forventet ${expectedCount} dage, fandt ${actualCount} i debug-tabel`,
        expected: expectedCount,
        actual: actualCount,
      });
    }
  }

  return issues;
};

/**
 * Validér debug-model for integrity issues
 *
 * Kører alle Niveau A integrity checks automatisk.
 *
 * @param debugDays - DebugDay array fra buildDebugCoreModel
 * @param input - Original input data
 * @returns Array af integrity issues (tom hvis alt OK)
 */
export function validateDebugModel(
  debugDays: readonly DebugDay[],
  input: DebugModelInput
): readonly IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  // Niveau A checks
  issues.push(...checkPeriodOverlap(input));
  issues.push(...checkDateHoles(debugDays));
  issues.push(...checkBaseDateConsistency(input));
  issues.push(...checkTafDaysMismatch(debugDays, input));
  issues.push(...checkSvieSmerteMismatch(debugDays, input));

  return issues;
}

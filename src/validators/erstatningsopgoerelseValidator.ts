/**
 * Central validator for Erstatningsopgørelse
 *
 * Arkitektur:
 * 1. Schema-validering (Zod) - datatyper, required fields
 * 2. Felt-uafhængige regler - single-field constraints
 * 3. Cross-field validering - regler der afhænger af flere felter
 *
 * Sektions-valideringer:
 * - Svie/smerte: perioder, satser, helbredsstatus
 * - TAF: perioder, beregnesUdFra, lønudvikling
 * - Øvrige krav: række-completeness
 * - Forlig: brøk-format, procent/brøk-eksklusivitet
 *
 * VIGTIGT: Alle validerings-funktioner er pure (ingen side effects)
 */

import type { ErstatningsopgoerelseValues, SvieSmertePeriodeRow, TafPeriodeRow, OevrigeKravRow } from '../schemas/formSchemas';
import { erstatningsopgoerelseSchema } from '../schemas/formSchemas';
import type { FormValidator, ValidationError, ValidationResult } from '../types/validation';
import { isISODateString } from '../types/branded';
import { svieSmertePrDag, svieSmerteMax, satserAngivAarYearBounds } from '../data/lovbestemteRates';
import { amountValueToNumber } from '../utils/expressionAmount';
import { isSvieSmerteRowEmpty, isTafRowEmpty, isOevrigeKravRowEmpty } from '../domain/erstatningsopgoerelse/helpers/rowEmpty';
import { detectOverlappingPeriods } from '../domain/erstatningsopgoerelse/engines/periodOverlapDetection';
import { resolveLoenudviklingKilde, LoenudviklingKildeError } from '../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { isAslStatistikModel, resolveStatistikModelId } from '../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { hasIndtastetLoenoplysninger } from '../domain/erstatningsopgoerelse/helpers/loenoplysningerInput';
import {
  getFirstIndtastedeTafFraDato,
  resolveSfggReferenceperiodeDayCount,
  resolveSfggSource,
} from '../domain/erstatningsopgoerelse/engines/sygeferiegodtgoerelse';
import { buildSfggNoEligibleDaysReason } from '../domain/erstatningsopgoerelse/helpers/sygeferiegodtgoerelsePresentation';
import {
  clampTafRow,
  getValidTafRange,
  resolveTafConstraintBounds,
} from '../domain/erstatningsopgoerelse/validation/tafPeriodConstraints';
import { calculateTafArbejdsdageBreakdown } from '../domain/erstatningsopgoerelse/engines/tafCalculations';
import { getOffentligOverenskomstTypeById, getOverenskomstSfggPolicy } from '../data/overenskomstRates';
import { DEFAULT_FRACTION_MAX_DIGITS, parseFractionString } from '../utils/fraction';
import { isoToDanish } from '../types/branded';

export const TAF_OVERLAP_ERROR_MESSAGE = 'TAF-perioder overlapper';

// =============================================================================
// LAG 1: SCHEMA-VALIDERING
// =============================================================================

/**
 * Schema-validering via Zod
 *
 * Validerer:
 * - Datatyper
 * - Required felter
 * - Simple constraints (min/max, format, etc.)
 */
function validateSchema(values: unknown): ValidationError[] {
  const result = erstatningsopgoerelseSchema.safeParse(values);

  if (result.success) return [];

  return result.error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
    severity: 'error' as const,
  }));
}

// =============================================================================
// LAG 2: FELT-UAFHÆNGIGE REGLER
// =============================================================================

/**
 * Dato-interval validering
 */
function validateStandaloneRules(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];

  // Dato-interval validering: periodeFra <= periodeTil
  if (
    values.vedroererPeriodeFra &&
    values.vedroererPeriodeTil &&
    values.vedroererPeriodeFra > values.vedroererPeriodeTil
  ) {
    errors.push({
      path: 'vedroererPeriodeFra',
      message: 'Fra-dato må ikke være efter til-dato',
      severity: 'error',
    });
  }

  return errors;
}

// =============================================================================
// LAG 3: CROSS-FIELD / SEKTIONS-VALIDERING
// =============================================================================

// ---- Forlig ----

/**
 * Forlig ansvarsgrad: Enten procent ELLER brøk - ikke begge
 */
function validateForligAnsvarsgrad(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];
  const hasProcent = values.forligAnsvarsgradProcent !== undefined;
  const broekTrimmed = values.forligAnsvarsgradBroek?.trim() ?? '';
  const hasBroek = broekTrimmed !== '';

  if (hasProcent && hasBroek) {
    errors.push(
      { path: 'forligAnsvarsgradProcent', message: 'Angiv enten procent eller brøk – ikke begge', severity: 'error' },
      { path: 'forligAnsvarsgradBroek', message: 'Angiv enten procent eller brøk – ikke begge', severity: 'error' },
    );
  }

  // Brøk format-validering
  if (hasBroek) {
    const parsedBroek = parseFractionString(broekTrimmed, {
      maxDigits: DEFAULT_FRACTION_MAX_DIGITS,
      allowNegative: false,
      allowZeroNumerator: false,
      canonicalizeOnCommit: false,
    });
    if (!parsedBroek.ok) {
      let message = 'Brøk skal angives som fx "1/3"';
      switch (parsedBroek.reason) {
        case 'negative-not-allowed':
          message = 'Negative brøker er ikke tilladt';
          break;
        case 'zero-denominator':
          message = 'Nævner kan ikke være 0';
          break;
        case 'zero-numerator':
          message = 'Tæller kan ikke være 0 (ville nulstille erstatningen)';
          break;
        default:
          break;
      }

      errors.push({
        path: 'forligAnsvarsgradBroek',
        message,
        severity: 'error',
      });
    } else if (parsedBroek.parsed.numerator > parsedBroek.parsed.denominator) {
      errors.push({
        path: 'forligAnsvarsgradBroek',
        message: 'Brøk kan ikke overstige 1 (tæller > nævner)',
        severity: 'error',
      });
    }
  }

  return errors;
}

// ---- Svie/smerte ----

/**
 * Validerer svie/smerte-perioder og satser
 *
 * Regler:
 * - Ikke-tomme perioder skal have alle felter udfyldt (fra, til, tilstand)
 * - fra <= til
 * - Perioder må ikke overlappe
 * - Sats-år skal have tilgængelige satser (2005-2026)
 * - Vedrører-periode skal være udfyldt når der er perioder
 */
function validateSvieSmerte(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];
  const beregnes = values.beregnesSvieSmerteGodtgoerelse === 'Ja';
  if (!beregnes) return errors;

  const periodeSynlig = values.tidligereSsMax === 'Nej';
  if (!periodeSynlig) return errors;

  const perioder = values.svieSmertePerioder ?? [];
  const nonEmpty = perioder.filter((row) => !isSvieSmerteRowEmpty(row));

  // Validér at ikke-tomme rækker er fuldt udfyldt
  for (let i = 0; i < perioder.length; i += 1) {
    const row = perioder[i];
    if (isSvieSmerteRowEmpty(row)) continue;
    const errors_ = validateSvieSmerteRowCompleteness(row, i, values);
    errors.push(...errors_);
  }

  // Validér overlap
  if (nonEmpty.length > 1) {
    const overlapIds = detectOverlappingPeriods(nonEmpty);
    if (overlapIds.size > 0) {
      for (let i = 0; i < perioder.length; i += 1) {
        if (overlapIds.has(perioder[i].id)) {
          errors.push({
            path: `svieSmertePerioder[${i}].fra`,
            message: 'Svie/smerte-perioder overlapper',
            severity: 'error',
          });
        }
      }
    }
  }

  // Validér at sats-år har tilgængelige satser
  if (nonEmpty.length > 0) {
    const satserAar = values.svieSmerteSatserAar;
    if (typeof satserAar !== 'number') {
      errors.push({
        path: 'svieSmerteSatserAar',
        message: 'År for svie/smerte-sats mangler',
        severity: 'error',
      });
    } else {
      const harPrDag = satserAar in svieSmertePrDag;
      const harMax = satserAar in svieSmerteMax;
      if (!harPrDag || !harMax) {
        errors.push({
          path: 'svieSmerteSatserAar',
          message: `Satser findes ikke for år ${satserAar} (tilgængelige: ${satserAngivAarYearBounds.minYear}–${satserAngivAarYearBounds.maxYear})`,
          severity: 'error',
        });
      }
    }

    // Vedrører-periode skal være udfyldt
    if (!values.vedroererPeriodeFra || !values.vedroererPeriodeTil) {
      errors.push({
        path: 'vedroererPeriodeFra',
        message: 'Vedrører-perioden skal udfyldes når der beregnes svie/smerte',
        severity: 'error',
      });
    }

    // Sats ved delvis sygemelding skal være valgt
    if (!values.svieSmerteDelvisSygemeldingSats) {
      errors.push({
        path: 'svieSmerteDelvisSygemeldingSats',
        message: 'Sats ved delvis sygemelding mangler',
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * Validér at en ikke-tom svie/smerte-række er fuldt udfyldt og har gyldige datoer.
 * menAfgoerelseDato-grænsen er en fejlgivende bound (jf. eo-snapshot-contract.md §2.2):
 * svie/smerte til-dato >= menAfgoerelseDato (når afgørelse ikke er påklaget) giver feltfejl.
 * Format-validering (isISODateString) er redundant her da validateParsed modtager
 * schema-validerede værdier, men bevares som defensivt invariant-check.
 */
function validateSvieSmerteRowCompleteness(
  row: SvieSmertePeriodeRow,
  index: number,
  values: ErstatningsopgoerelseValues
): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `svieSmertePerioder[${index}]`;

  const hasFra = typeof row.fra === 'string' && row.fra.trim() !== '';
  const hasTil = typeof row.til === 'string' && row.til.trim() !== '';
  const hasTilstand = typeof row.tilstand === 'string' && row.tilstand.trim() !== '';

  if (!hasFra) {
    errors.push({ path: `${prefix}.fra`, message: 'Fra-dato mangler', severity: 'error' });
  }
  if (!hasTil) {
    errors.push({ path: `${prefix}.til`, message: 'Til-dato mangler', severity: 'error' });
  }
  if (!hasTilstand) {
    errors.push({ path: `${prefix}.tilstand`, message: 'Tilstand mangler', severity: 'error' });
  }

  // Dato-interval validering. isISODateString-guards er type narrowing — ikke format-validering.
  // Format er garanteret af Zod-schema (validateParsed modtager kun schema-validerede værdier).
  if (hasFra && hasTil && isISODateString(row.fra) && isISODateString(row.til)) {
    if (row.fra > row.til) {
      errors.push({ path: `${prefix}.fra`, message: 'Fra-dato må ikke være efter til-dato', severity: 'error' });
    } else {
      // Fejlgivende bound: til-dato >= menAfgoerelseDato når afgørelse er truffet og ikke påklaget.
      // Gælder uanset skadestype (jf. eo-snapshot-contract.md §2.2 og form-contract.md §13.2).
      // Stille clamping mod vedroererPeriodeTil sker i engineen — det er ikke en feltfejl.
      const menAfgoerelseDato = isISODateString(values.menAfgoerelseDato) ? values.menAfgoerelseDato : undefined;
      const menBoundActive =
        values.varigeMenAfgorelse === 'Ja' &&
        values.verserendeKlageMen === 'Nej' &&
        menAfgoerelseDato !== undefined;
      if (menBoundActive && menAfgoerelseDato !== undefined && row.til >= menAfgoerelseDato) {
        errors.push({
          path: `${prefix}.til`,
          message: `Til-dato kan ikke være på eller efter afgørelsesdato for varige mén (${menAfgoerelseDato})`,
          severity: 'error',
        });
      }
    }
  }

  return errors;
}

// ---- TAF (Tabt arbejdsfortjeneste) ----

/**
 * Validerer TAF-perioder og relaterede indstillinger
 *
 * Regler:
 * - Ikke-tomme perioder skal have fra og til udfyldt
 * - fra <= til
 * - beregnesUdFra skal have matchende data udfyldt
 * - Lønudviklingsstrategi skal være valgt og konsistent
 */
function validateTAF(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];
  const beregnes = values.beregnesTabtArbejdsfortjeneste === 'Ja';
  if (!beregnes) return errors;

  const tafPerioder = values.tafPerioder ?? [];
  const nonEmpty = tafPerioder.filter((row) => !isTafRowEmpty(row));

  // Validér ikke-tomme rækker er fuldt udfyldt
  for (let i = 0; i < tafPerioder.length; i += 1) {
    const row = tafPerioder[i];
    if (isTafRowEmpty(row)) continue;
    const errors_ = validateTafRowCompleteness(row, i);
    errors.push(...errors_);
  }

  if (nonEmpty.length > 1) {
    const overlapIds = detectOverlappingPeriods(nonEmpty);
    for (let i = 0; i < tafPerioder.length; i += 1) {
      if (!overlapIds.has(tafPerioder[i].id)) continue;
      errors.push({
        path: `tafPerioder[${i}].fra`,
        message: TAF_OVERLAP_ERROR_MESSAGE,
        severity: 'error',
      });
    }
  }

  errors.push(...validateTafLoseFeriedage(values));
  errors.push(...validateBeregningsperiodeLoseFeriedage(values));

  // Validér beregnesUdFra matchende felter
  errors.push(...validateBeregnesUdFra(values));

  // Validér lønudvikling konsistens
  errors.push(...validateLoenudviklingKonsistens(values));
  errors.push(...validateLoenudviklingsKravForAktivKilde(values));

  return errors;
}

function validateSygeferiegodtgoerelse(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];

  (values.loenindkomstAnsaettelsesforhold ?? []).forEach((employment) => {
    const index = (values.sfggAnsaettelsesforhold ?? []).findIndex((entry) => entry.ansaettelsesforholdId === employment.id);
    const row = index >= 0 ? values.sfggAnsaettelsesforhold[index] : undefined;
    const errorPathPrefix = index >= 0
      ? `sfggAnsaettelsesforhold[${index}]`
      : 'sfggAnsaettelsesforhold';
    const firstTafFraDato = getFirstIndtastedeTafFraDato(values);
    const firstTafFraDatoDisplay = firstTafFraDato ? (isoToDanish(firstTafFraDato) ?? firstTafFraDato) : undefined;

    if (!row?.sfggBeregningskilde) {
      errors.push({
        path: `${errorPathPrefix}.sfggBeregningskilde`,
        message: 'Beregningsgrundlag for SFGG ikke valgt',
        severity: 'error',
      });
      return;
    }

    if (row.sfggBeregningskilde === 'Ingen') return;

    const overenskomstPolicy =
      row.sfggBeregningskilde === 'Overenskomst' && employment?.overenskomstId && !getOffentligOverenskomstTypeById(employment.overenskomstId)
        ? getOverenskomstSfggPolicy(employment.overenskomstId)
        : undefined;
    const requiresReferenceperiode =
      row.sfggBeregningskilde === 'Ferieloven'
      || (row.sfggBeregningskilde === 'Overenskomst' && overenskomstPolicy?.model !== 'direkte_sats');

    if (row.sfggBeregningskilde === 'Manuelt angivet' && amountValueToNumber(row.sfggManuelDagssats) === undefined) {
      errors.push({
        path: `${errorPathPrefix}.sfggManuelDagssats`,
        message: 'Dagssats for sygeferiegodtgørelse mangler',
        severity: 'error',
      });
    }

    if (row.sfggBeregningskilde === 'Overenskomst' && (!employment?.harOverenskomst || !employment.overenskomstId)) {
      errors.push({
        path: `${errorPathPrefix}.sfggBeregningskilde`,
        message: 'Der skal være valgt en overenskomst på ansættelsesforholdet for at beregne sygeferiegodtgørelse ud fra overenskomst',
        severity: 'error',
      });
    }

    if (requiresReferenceperiode && !row.sfggReferenceperiodeFra) {
      errors.push({
        path: `${errorPathPrefix}.sfggReferenceperiodeFra`,
        message: 'Referenceperiode fra-dato mangler',
        severity: 'error',
      });
    }

    if (requiresReferenceperiode && !row.sfggReferenceperiodeTil) {
      errors.push({
        path: `${errorPathPrefix}.sfggReferenceperiodeTil`,
        message: 'Referenceperiode til-dato mangler',
        severity: 'error',
      });
    }

    if (
      requiresReferenceperiode &&
      row.sfggReferenceperiodeFra &&
      row.sfggReferenceperiodeTil &&
      row.sfggReferenceperiodeFra > row.sfggReferenceperiodeTil
    ) {
      errors.push({
        path: `${errorPathPrefix}.sfggReferenceperiodeFra`,
        message: 'Referenceperiode fra-dato må ikke være efter til-dato',
        severity: 'error',
      });
    }

    if (
      requiresReferenceperiode &&
      firstTafFraDato &&
      row.sfggReferenceperiodeFra &&
      row.sfggReferenceperiodeFra >= firstTafFraDato
    ) {
      errors.push({
        path: `${errorPathPrefix}.sfggReferenceperiodeFra`,
        message: `Referenceperioden skal ligge før første TAF-periode (${firstTafFraDatoDisplay})`,
        severity: 'error',
      });
    }

    if (
      requiresReferenceperiode &&
      firstTafFraDato &&
      row.sfggReferenceperiodeTil &&
      row.sfggReferenceperiodeTil >= firstTafFraDato
    ) {
      errors.push({
        path: `${errorPathPrefix}.sfggReferenceperiodeTil`,
        message: `Referenceperioden skal ligge før første TAF-periode (${firstTafFraDatoDisplay})`,
        severity: 'error',
      });
    }

    if (row.sfggBeregningskilde === 'Overenskomst' && overenskomstPolicy?.model === 'direkte_sats' && overenskomstPolicy.direkteSatsErDifferentieret && !row.sfggSatsvalg) {
      errors.push({
        path: `${errorPathPrefix}.sfggSatsvalg`,
        message: 'Satsvalg mangler',
        severity: 'error',
      });
    }

    if (requiresReferenceperiode && row.sfggReferenceperiodeFra && row.sfggReferenceperiodeTil) {
      const referenceDayCount = resolveSfggReferenceperiodeDayCount(values, row, resolveSfggSource(row, employment));
      const availableRelevantDays = referenceDayCount?.divisorLabel === 'kalenderdage'
        ? referenceDayCount.kalenderdage
        : (referenceDayCount?.divisorDage ?? 0);

      if (availableRelevantDays <= 0) {
        errors.push({
          path: `${errorPathPrefix}.sfggReferenceperiodeFra`,
          message: buildSfggNoEligibleDaysReason(referenceDayCount?.divisorLabel === 'kalenderdage' ? 'kalenderdage' : 'arbejdsdage'),
          severity: 'error',
        });
      } else if (
        typeof row.sfggReferenceperiodeFravaersdageUdenLoen === 'number' &&
        row.sfggReferenceperiodeFravaersdageUdenLoen > availableRelevantDays
      ) {
        errors.push({
          path: `${errorPathPrefix}.sfggReferenceperiodeFravaersdageUdenLoen`,
          message:
            referenceDayCount?.divisorLabel === 'kalenderdage'
              ? `Ferie- og fraværsdage uden løn overstiger mulige kalenderdage i referenceperioden (maksimalt ${availableRelevantDays})`
              : `Ferie- og fraværsdage uden løn overstiger mulige arbejdsdage i referenceperioden (maksimalt ${availableRelevantDays})`,
          severity: 'error',
        });
      }
    }
  });

  return errors;
}

export function validateTafLoseFeriedage(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];
  const ferieperioder = [...(values.ferieperioder ?? []), ...(values.fravaerPerioder ?? [])];
  const tafBounds = resolveTafConstraintBounds(values);

  for (let i = 0; i < (values.tafPerioder ?? []).length; i += 1) {
    const row = values.tafPerioder[i];
    if (typeof row.loseFeriedage !== 'number') continue;
    const clampedRange = clampTafRow(row, tafBounds);
    if (!clampedRange) {
      // Rå rækker uden gyldig dato håndteres af rækkevalideringen ovenfor.
      // Når en ellers gyldig TAF-række clampes helt bort, følger vi EO-kontrakten:
      // perioden indgår ikke i den autoritative beregning, og løse feriedage må ikke blokere.
      if (!getValidTafRange(row)) continue;
      continue;
    }

    const breakdown = calculateTafArbejdsdageBreakdown(
      clampedRange.fra,
      clampedRange.til,
      ferieperioder,
      row.loseFeriedage,
      { kind: 'taf' }
    );
    if (!breakdown) continue;
    if (row.loseFeriedage <= breakdown.loseFeriedage) continue;

    errors.push({
      path: `tafPerioder[${i}].loseFeriedage`,
      message: `Løse feriedage overstiger mulige arbejdsdage i perioden (maksimalt ${breakdown.loseFeriedage})`,
      severity: 'error',
    });
  }

  return errors;
}

export function validateBeregningsperiodeLoseFeriedage(values: ErstatningsopgoerelseValues): ValidationError[] {
  if (values.beregnesUdFra !== 'Beregningsperiode') return [];
  if (typeof values.uspecificeredeFerieFridage !== 'number') return [];
  if (!values.periodeTilBeregningFra || !values.periodeTilBeregningTil) return [];

  const breakdown = calculateTafArbejdsdageBreakdown(
    values.periodeTilBeregningFra,
    values.periodeTilBeregningTil,
    values.fravaerPerioder ?? [],
    values.uspecificeredeFerieFridage,
    {
      kind: 'beregningsgrundlag',
      oevrigeFravaersdage:
        values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
          ? values.oevrigeFravaersdage
          : 0,
    }
  );
  if (!breakdown) return [];
  if (values.uspecificeredeFerieFridage <= breakdown.loseFeriedage) return [];

  return [{
    path: 'uspecificeredeFerieFridage',
    message: `Uspecificerede ferie-/feriefridage overstiger mulige arbejdsdage i beregningsperioden (maksimalt ${breakdown.loseFeriedage})`,
    severity: 'error',
  }];
}

/**
 * Validér at en ikke-tom TAF-række er fuldt udfyldt
 */
function validateTafRowCompleteness(row: TafPeriodeRow, index: number): ValidationError[] {
  return validateFerieperiodeRowCompleteness(row, `tafPerioder[${index}]`);
}

function validateFerieperiodeRowCompleteness(
  row: Readonly<{ fra?: string; til?: string }>,
  prefix: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  const hasFra = typeof row.fra === 'string' && row.fra.trim() !== '';
  const hasTil = typeof row.til === 'string' && row.til.trim() !== '';

  if (!hasFra) {
    errors.push({ path: `${prefix}.fra`, message: 'Fra-dato mangler', severity: 'error' });
  }
  if (!hasTil) {
    errors.push({ path: `${prefix}.til`, message: 'Til-dato mangler', severity: 'error' });
  }

  // isISODateString-guards er type narrowing — format er garanteret af Zod-schema.
  if (hasFra && hasTil && isISODateString(row.fra) && isISODateString(row.til)) {
    if (row.fra > row.til) {
      errors.push({ path: `${prefix}.fra`, message: 'Fra-dato må ikke være efter til-dato', severity: 'error' });
    }
  }

  return errors;
}

/**
 * Validér at beregnesUdFra har matchende data udfyldt
 */
function validateBeregnesUdFra(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];
  const beregnesUdFra = values.beregnesUdFra;

  if (beregnesUdFra === 'Angivet månedsløn') {
    const value = amountValueToNumber(values.maanedsloenenUdgoer);
    if (value === undefined) {
      errors.push({
        path: 'maanedsloenenUdgoer',
        message: 'Månedsløn skal udfyldes når "Angivet månedsløn" er valgt',
        severity: 'error',
      });
    }
  }

  if (beregnesUdFra === 'Angivet dagsløn') {
    const value = amountValueToNumber(values.dagsloenenUdgoer);
    if (value === undefined) {
      errors.push({
        path: 'dagsloenenUdgoer',
        message: 'Dagsløn skal udfyldes når "Angivet dagsløn" er valgt',
        severity: 'error',
      });
    }
  }

  if (beregnesUdFra === 'Beregningsperiode') {
    if (!values.periodeTilBeregningFra) {
      errors.push({
        path: 'periodeTilBeregningFra',
        message: 'Beregningsperiode fra-dato mangler',
        severity: 'error',
      });
    }
    if (!values.periodeTilBeregningTil) {
      errors.push({
        path: 'periodeTilBeregningTil',
        message: 'Beregningsperiode til-dato mangler',
        severity: 'error',
      });
    }
    if (
      values.periodeTilBeregningFra &&
      values.periodeTilBeregningTil &&
      values.periodeTilBeregningFra > values.periodeTilBeregningTil
    ) {
      errors.push({
        path: 'periodeTilBeregningFra',
        message: 'Beregningsperiode fra-dato må ikke være efter til-dato',
        severity: 'error',
      });
    }
  }

  return errors;
}

function validateLoenudviklingKonsistens(values: ErstatningsopgoerelseValues): ValidationError[] {
  try {
    resolveLoenudviklingKilde(values);
    return [];
  } catch (error) {
    return [buildLoenudviklingsKildeResolutionError(error)];
  }
}

// ---- Øvrige krav ----

/**
 * Validerer øvrige krav-rækker
 *
 * Regler:
 * - Ikke-tomme rækker skal have dato, udgiftTil og beløb udfyldt
 * - Beløb kan ikke være negativt
 */
function validateLoenudviklingsKravForAktivKilde(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];
  let loenudviklingsKilde: ReturnType<typeof resolveLoenudviklingKilde>;
  try {
    loenudviklingsKilde = resolveLoenudviklingKilde(values);
  } catch (error) {
    errors.push(buildLoenudviklingsKildeResolutionError(error));
    return errors;
  }

  loenudviklingsKilde.forEach((af, index) => {
    const path = (field: string): string =>
      values.beregnesUdFra === 'Beregningsperiode'
        ? `loenindkomstAnsaettelsesforhold[${index}].${field}`
        : `eoAngivetLoenLoenudvikling.${field}`;

    const grundlag = af.loenudviklingBeregningsgrundlag;
    if (!grundlag) {
      errors.push({
        path: path('loenudviklingBeregningsgrundlag'),
        message: 'Lønregulering skal vælges, evt. "Ingen"',
        severity: 'error',
      });
      return;
    }
    if (grundlag === 'Ingen') return;

    const kræverFeriePct = values.beregnesUdFra === 'Beregningsperiode'
      && hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []);

    if (grundlag === 'Overenskomst') {
      if (!af.overenskomstId) {
        errors.push({ path: path('overenskomstId'), message: 'Overenskomst skal vælges', severity: 'error' });
      }
      if (kræverFeriePct && !Number.isFinite(af.feriePct)) {
        errors.push({ path: path('feriePct'), message: 'Feriegodtgørelse/-tillæg skal udfyldes', severity: 'error' });
      }
      if (!af.loenPaaHelligdage) {
        errors.push({ path: path('loenPaaHelligdage'), message: 'Løn på helligdage skal vælges', severity: 'error' });
      }
    }

    if (grundlag === 'Statistik') {
      const modelLabel = (af.loenudviklingStatistikModel ?? '').trim();
      const erAsl = isAslStatistikModel(modelLabel);
      const mappedModel = resolveStatistikModelId(modelLabel);
      if (modelLabel === '' || (!erAsl && !mappedModel)) {
        errors.push({
          path: path('loenudviklingStatistikModel'),
          message: 'Statistisk beregningsmodel skal vælges',
          severity: 'error',
        });
      }
    }

    if (grundlag === 'KRL satstabel' && !af.loenudviklingKRLSatstabel) {
      errors.push({ path: path('loenudviklingKRLSatstabel'), message: 'KRL satstabel skal vælges', severity: 'error' });
    }

    if (grundlag === 'Manuelt angivet') {
      if (kræverFeriePct && !Number.isFinite(af.feriePct)) {
        errors.push({ path: path('feriePct'), message: 'Feriegodtgørelse/-tillæg skal udfyldes', severity: 'error' });
      }

      const rows = af.loenudviklingManuelTableData ?? [];
      const aktiveRows = rows.filter((row) => {
        const dato = (row.dato ?? '').trim();
        const feriepenge = (row.feriepenge ?? '').trim();
        const shSoSats = (row.shSoSats ?? '').trim();
        const fritvalg = (row.fritvalg ?? '').trim();
        const agPension = (row.agPension ?? '').trim();
        return (
          dato !== '' ||
          feriepenge !== '' ||
          shSoSats !== '' ||
          fritvalg !== '' ||
          agPension !== '' ||
          row.grundloen !== undefined
        );
      });

      if (aktiveRows.length === 0) {
        errors.push({
          path: path('loenudviklingManuelTableData'),
          message: 'Mindst én manuel reguleringsrække skal udfyldes',
          severity: 'error',
        });
      } else if (aktiveRows.some((row) => row.grundloen === undefined)) {
        errors.push({
          path: path('loenudviklingManuelTableData'),
          message: 'Grundløn skal udfyldes på alle manuelle reguleringsrækker',
          severity: 'error',
        });
      }
    }
  });

  return errors;
}

const buildLoenudviklingsKildeResolutionError = (error: unknown): ValidationError => {
  const message = error instanceof Error ? error.message : 'Ugyldig lønudviklingskilde';
  const errorPath = error instanceof LoenudviklingKildeError && error.code === 'invalid_beregnes_udfra'
    ? 'beregnesUdFra'
    : 'eoAngivetLoenLoenudvikling.loenPaaHelligdage';

  return {
    path: errorPath,
    message,
    severity: 'error',
  };
};

function validateOevrigeKrav(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];
  const rows = values.oevrigeKravPerioder ?? [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (isOevrigeKravRowEmpty(row)) continue;
    const errors_ = validateOevrigeKravRowCompleteness(row, i);
    errors.push(...errors_);
  }

  return errors;
}

/**
 * Validér at en ikke-tom øvrige krav-række er fuldt udfyldt
 */
function validateOevrigeKravRowCompleteness(row: OevrigeKravRow, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `oevrigeKravPerioder[${index}]`;

  const hasDato = typeof row.dato === 'string' && row.dato.trim() !== '';
  const hasUdgiftTil = typeof row.udgiftTil === 'string' && row.udgiftTil.trim() !== '';
  const amountValue = amountValueToNumber(row.beloeb);

  if (!hasDato) {
    errors.push({ path: `${prefix}.dato`, message: 'Dato mangler', severity: 'error' });
  }
  if (!hasUdgiftTil) {
    errors.push({ path: `${prefix}.udgiftTil`, message: 'Udgift til mangler', severity: 'error' });
  }
  if (amountValue === undefined) {
    errors.push({ path: `${prefix}.beloeb`, message: 'Beløb mangler', severity: 'error' });
  } else if (amountValue < 0) {
    errors.push({ path: `${prefix}.beloeb`, message: 'Beløb kan ikke være negativt', severity: 'error' });
  }

  return errors;
}

// =============================================================================
// SAMLET VALIDATOR
// =============================================================================

/**
 * Samlet validator for Erstatningsopgørelse
 *
 * Kører alle validerings-lag sekventielt og kombinerer errors.
 * Sektions-valideringer kører uafhængigt, så alle fejl rapporteres samlet.
 */
type ErstatningsopgoerelseValidator = FormValidator<ErstatningsopgoerelseValues> & Readonly<{
  validateParsed(values: ErstatningsopgoerelseValues): ValidationResult;
}>;

export const erstatningsopgoerelseValidator: ErstatningsopgoerelseValidator = {
  validateParsed(values: ErstatningsopgoerelseValues): ValidationResult {
    const errors: ValidationError[] = [
      ...validateStandaloneRules(values),
      ...validateForligAnsvarsgrad(values),
      ...validateSvieSmerte(values),
      ...validateTAF(values),
      ...validateSygeferiegodtgoerelse(values),
      ...validateOevrigeKrav(values),
    ];

    return {
      errors,
      isValid: errors.filter((e) => e.severity !== 'warning').length === 0,
    };
  },
  validate(values: ErstatningsopgoerelseValues): ValidationResult {
    const errors: ValidationError[] = [
      ...validateSchema(values),
      ...erstatningsopgoerelseValidator.validateParsed(values).errors,
    ];

    return {
      errors,
      isValid: errors.filter((e) => e.severity !== 'warning').length === 0,
    };
  },
};

export default erstatningsopgoerelseValidator;

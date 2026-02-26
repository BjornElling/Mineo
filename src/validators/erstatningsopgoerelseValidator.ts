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
import { svieSmertePrDag, svieSmerteMax, satserAngivAarYearBounds } from '../data/regulationRates';
import { amountValueToNumber } from '../utils/expressionAmount';
import { isSvieSmerteRowEmpty, isTafRowEmpty, isOevrigeKravRowEmpty } from '../domain/erstatningsopgoerelse/rowEmpty';
import { detectOverlappingPeriods } from '../domain/erstatningsopgoerelse/periodOverlapDetection';
import { resolveLoenudviklingKilde, LoenudviklingKildeError } from '../domain/erstatningsopgoerelse/angivetLoenHelpers';
import { resolveStatistikModelId } from '../domain/erstatningsopgoerelse/sharedPdfUtils';
import { hasIndtastetLoenoplysninger } from '../domain/erstatningsopgoerelse/loenoplysningerInput';

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

  // Brøk format-validering: skal matche "tæller/nævner" med positive heltal
  if (hasBroek) {
    const broekPattern = /^\s*(\d+)\s*\/\s*(\d+)\s*$/;
    const match = broekTrimmed.match(broekPattern);
    if (!match) {
      errors.push({
        path: 'forligAnsvarsgradBroek',
        message: 'Brøk skal angives som fx "1/3" (positive heltal)',
        severity: 'error',
      });
    } else {
      const taeller = Number.parseInt(match[1], 10);
      const naevner = Number.parseInt(match[2], 10);
      if (naevner === 0) {
        errors.push({
          path: 'forligAnsvarsgradBroek',
          message: 'Nævner kan ikke være 0',
          severity: 'error',
        });
      } else if (taeller === 0) {
        errors.push({
          path: 'forligAnsvarsgradBroek',
          message: 'Tæller kan ikke være 0 (ville nulstille erstatningen)',
          severity: 'error',
        });
      } else if (taeller > naevner) {
        errors.push({
          path: 'forligAnsvarsgradBroek',
          message: 'Brøk kan ikke overstige 1 (tæller > nævner)',
          severity: 'error',
        });
      }
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
    const errors_ = validateSvieSmerteRowCompleteness(row, i);
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
 * Validér at en ikke-tom svie/smerte-række er fuldt udfyldt og har gyldige datoer
 */
function validateSvieSmerteRowCompleteness(row: SvieSmertePeriodeRow, index: number): ValidationError[] {
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

  // Dato-interval validering
  if (hasFra && hasTil && row.fra && row.til) {
    if (!isISODateString(row.fra)) {
      errors.push({ path: `${prefix}.fra`, message: 'Ugyldig dato', severity: 'error' });
    } else if (!isISODateString(row.til)) {
      errors.push({ path: `${prefix}.til`, message: 'Ugyldig dato', severity: 'error' });
    } else if (row.fra > row.til) {
      errors.push({ path: `${prefix}.fra`, message: 'Fra-dato må ikke være efter til-dato', severity: 'error' });
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

  // Validér ikke-tomme rækker er fuldt udfyldt
  for (let i = 0; i < tafPerioder.length; i += 1) {
    const row = tafPerioder[i];
    if (isTafRowEmpty(row)) continue;
    const errors_ = validateTafRowCompleteness(row, i);
    errors.push(...errors_);
  }

  // Validér beregnesUdFra matchende felter
  errors.push(...validateBeregnesUdFra(values));

  // Validér lønudvikling konsistens
  errors.push(...validateLoenudviklingKonsistens(values));
  errors.push(...validateLoenudviklingsKravForAktivKilde(values));

  return errors;
}

/**
 * Validér at en ikke-tom TAF-række er fuldt udfyldt
 */
function validateTafRowCompleteness(row: TafPeriodeRow, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `tafPerioder[${index}]`;

  const hasFra = typeof row.fra === 'string' && row.fra.trim() !== '';
  const hasTil = typeof row.til === 'string' && row.til.trim() !== '';

  if (!hasFra) {
    errors.push({ path: `${prefix}.fra`, message: 'Fra-dato mangler', severity: 'error' });
  }
  if (!hasTil) {
    errors.push({ path: `${prefix}.til`, message: 'Til-dato mangler', severity: 'error' });
  }

  if (hasFra && hasTil && row.fra && row.til) {
    if (!isISODateString(row.fra)) {
      errors.push({ path: `${prefix}.fra`, message: 'Ugyldig dato', severity: 'error' });
    } else if (!isISODateString(row.til)) {
      errors.push({ path: `${prefix}.til`, message: 'Ugyldig dato', severity: 'error' });
    } else if (row.fra > row.til) {
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

/**
 * Validér at lønudviklingsindstillinger er konsistente på tværs af ansættelsesforhold
 *
 * Alle aktive ansættelsesforhold (med lønudvikling != 'Ingen') skal have:
 * - Samme beregningsgrundlag
 * - Samme overenskomst (ved overenskomst)
 * - Samme statistikmodel (ved statistik)
 * - Samme feriepct (ved overenskomst/manuelt)
 * - Samme loenPaaHelligdage (ved overenskomst)
 */
function validateLoenudviklingKonsistens(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];
  let loenudviklingsKilde: ReturnType<typeof resolveLoenudviklingKilde>;
  try {
    loenudviklingsKilde = resolveLoenudviklingKilde(values);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ugyldig lønudviklingskilde';
    const errorPath = error instanceof LoenudviklingKildeError && error.code === 'invalid_beregnes_udfra'
      ? 'beregnesUdFra'
      : 'eoAngivetLoenLoenudvikling.loenPaaHelligdage';
    errors.push({
      path: errorPath,
      message,
      severity: 'error',
    });
    return errors;
  }

  const active = loenudviklingsKilde.filter(
    (af) => af.loenudviklingBeregningsgrundlag && af.loenudviklingBeregningsgrundlag !== 'Ingen'
  );
  if (active.length <= 1) return errors;
  const activeMedLoenoplysninger = values.beregnesUdFra === 'Beregningsperiode'
    ? active.filter((af) => hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []))
    : active;

  // Alle aktive skal have samme beregningsgrundlag
  const firstGrundlag = active[0].loenudviklingBeregningsgrundlag;
  for (let i = 1; i < active.length; i += 1) {
    if (active[i].loenudviklingBeregningsgrundlag !== firstGrundlag) {
      errors.push({
        path: `loenindkomstAnsaettelsesforhold[${i}].loenudviklingBeregningsgrundlag`,
        message: 'Lønudviklingsgrundlag skal være ens på tværs af ansættelsesforhold',
        severity: 'error',
      });
    }
  }

  // Grundlag-specifikke konsistens-checks
  if (firstGrundlag === 'Overenskomst') {
    const firstOverenskomst = active[0].overenskomstId ?? '';
    const firstLoenPaaHelligdage = active[0].loenPaaHelligdage ?? '';
    const firstFeriePct = activeMedLoenoplysninger[0]?.feriePct;
    for (let i = 1; i < active.length; i += 1) {
      if ((active[i].overenskomstId ?? '') !== firstOverenskomst) {
        errors.push({
          path: `loenindkomstAnsaettelsesforhold[${i}].overenskomstId`,
          message: 'Overenskomst skal være ens på tværs af ansættelsesforhold',
          severity: 'error',
        });
      }
      if ((active[i].loenPaaHelligdage ?? '') !== firstLoenPaaHelligdage) {
        errors.push({
          path: `loenindkomstAnsaettelsesforhold[${i}].loenPaaHelligdage`,
          message: 'Løn på helligdage skal være ens på tværs af ansættelsesforhold',
          severity: 'error',
        });
      }
      const shouldCompareFeriePct = values.beregnesUdFra !== 'Beregningsperiode'
        || hasIndtastetLoenoplysninger(active[i].indtaegtsoplysningerTableData ?? []);
      if (firstFeriePct !== undefined && shouldCompareFeriePct && active[i].feriePct !== firstFeriePct) {
        errors.push({
          path: `loenindkomstAnsaettelsesforhold[${i}].feriePct`,
          message: 'Ferieprocent skal være ens på tværs af ansættelsesforhold',
          severity: 'error',
        });
      }
    }
  }

  if (firstGrundlag === 'Statistik') {
    const firstModel = (active[0].loenudviklingStatistikModel ?? '').trim();
    for (let i = 1; i < active.length; i += 1) {
      if ((active[i].loenudviklingStatistikModel ?? '').trim() !== firstModel) {
        errors.push({
          path: `loenindkomstAnsaettelsesforhold[${i}].loenudviklingStatistikModel`,
          message: 'Statistikmodel skal være ens på tværs af ansættelsesforhold',
          severity: 'error',
        });
      }
    }
  }

  if (firstGrundlag === 'KRL satstabel') {
    const firstKrl = active[0].loenudviklingKRLSatstabel ?? '';
    for (let i = 1; i < active.length; i += 1) {
      if ((active[i].loenudviklingKRLSatstabel ?? '') !== firstKrl) {
        errors.push({
          path: `loenindkomstAnsaettelsesforhold[${i}].loenudviklingKRLSatstabel`,
          message: 'KRL satstabel skal være ens på tværs af ansættelsesforhold',
          severity: 'error',
        });
      }
    }
  }

  return errors;
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
    const message = error instanceof Error ? error.message : 'Ugyldig lønudviklingskilde';
    const errorPath = error instanceof LoenudviklingKildeError && error.code === 'invalid_beregnes_udfra'
      ? 'beregnesUdFra'
      : 'eoAngivetLoenLoenudvikling.loenPaaHelligdage';
    errors.push({
      path: errorPath,
      message,
      severity: 'error',
    });
    return errors;
  }

  loenudviklingsKilde.forEach((af, index) => {
    const path = (field: string): string =>
      values.beregnesUdFra === 'Beregningsperiode'
        ? `loenindkomstAnsaettelsesforhold[${index}].${field}`
        : `eoAngivetLoenLoenudvikling.${field}`;

    const grundlag = af.loenudviklingBeregningsgrundlag;
    if (!grundlag || grundlag === 'Ingen') return;

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
      const erAsl = modelLabel.startsWith('ASL-');
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
export const erstatningsopgoerelseValidator: FormValidator<ErstatningsopgoerelseValues> = {
  validate(values: ErstatningsopgoerelseValues): ValidationResult {
    const errors: ValidationError[] = [
      ...validateSchema(values),
      ...validateStandaloneRules(values),
      ...validateForligAnsvarsgrad(values),
      ...validateSvieSmerte(values),
      ...validateTAF(values),
      ...validateOevrigeKrav(values),
    ];

    return {
      errors,
      isValid: errors.filter((e) => e.severity !== 'warning').length === 0,
    };
  },
};

export default erstatningsopgoerelseValidator;



/**
 * Central validator for erstatningsopgørelsen
 *
 * Arkitektur:
 * 1. Schema-validering (Zod) - syntaks, form og sikker numerisk repræsentation
 * 2. Felt-uafhængige regler - enkeltfeltsregler, herunder canonical grænser
 * 3. Tværfeltsvalidering - regler der afhænger af flere felter
 *
 * Sektions-valideringer:
 * - Svie/smerte: perioder, satser, helbredsstatus
 * - TAF: perioder, beregnesUdFra, lønudvikling
 * - Øvrige krav: række-completeness (beskrivelse og beløb; datoen er valgfri)
 * - Forlig: brøk-format, procent/brøk-eksklusivitet
 *
 * VIGTIGT: Alle validerings-funktioner er pure (ingen side effects)
 */

import {
  formatReguleringsdatoEfterKildeBesked,
  formatReguleringsdatoFoerKildeBesked,
  formatTafStartFoerKildeBesked,
  formatTafStartFoerManuelReguleringsdatoBesked,
} from '../domain/erstatningsopgoerelse/loenudviklingReguleringsdatoIssues';
import { resolveReguleringskildeNavn } from '../domain/erstatningsopgoerelse/helpers/loenudviklingDisplay';
import type { ErstatningsopgoerelseValues, StamdataValues, OevrigeKravRow } from '../schemas/formSchemas';
import type { AmountValue } from '../schemas/amountExpressionSchema';
import { erstatningsopgoerelseSchema } from '../schemas/formSchemas';
import type { FormValidator, ValidationError, ValidationResult } from '../types/validation';
import { isISODateString, isoToDanish, type ISODateString } from '../types/branded';
import { aarsloenAslMax, getYearBoundsForYearlyRate, reguleringssats, satserAngivAarYearBounds } from '../data/lovbestemteRates';
import { hasSvieSmerteSatserForAar } from '../domain/erstatningsopgoerelse/helpers/svieSmerteSatsAar';
import { resolveKildeReguleringsIntervalIso } from '../domain/erstatningsopgoerelse/helpers/reguleringKildeCoverage';
import { amountValueToNumber } from '../utils/expressionAmount';
import { isSvieSmerteRowEmpty } from '../domain/erstatningsopgoerelse/helpers/rowEmpty';
import {
  buildTafLoseFeriedageMaxMessage,
  resolveTafLoseFeriedageMaksimum,
  TAF_OVERLAP_LINJE,
} from '../domain/erstatningsopgoerelse/validation/tafRowRules';
import { assessTafPeriodeRows } from '../domain/erstatningsopgoerelse/validation/tafPeriodeValidation';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde, LoenudviklingKildeError } from '../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { isAslStatistikModel, resolveStatistikModelId } from '../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import {
  hasFinitePct,
  isManuelAngivetRowAktiv,
  isManuelAngivetRowDatoUdfyldt,
  isManuelProcentsatsRowAktiv,
  isManualRegulationDateOnOrBeforeBasis,
} from '../domain/erstatningsopgoerelse/helpers/manuelReguleringRowPredicates';
import { resolveAnvendtReguleringsdato } from '../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { resolveAnvendtReguleringsdatoReferenceText } from '../domain/erstatningsopgoerelse/helpers/eoDateReferenceText';
import { FERIE_PCT_MANGLER_BESKED, isFeriePctPaakraevet } from '../domain/erstatningsopgoerelse/validation/loenindkomstSatsAssessment';
import {
  erDatoUdenOverenskomstSatser,
  formatReguleringsdatoUdenOverenskomstSatserBesked,
  erReguleringsdatoUdenOverenskomstSatserMeldt,
  resolvePrivatOverenskomstDaekning,
} from '../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { shouldRequireSygeferiegodtgoerelseInput } from '../domain/erstatningsopgoerelse/helpers/sygeferiegodtgoerelseEligibility';
import { erOevrigeKravSektionAktiv } from '../domain/erstatningsopgoerelse/helpers/eoInputRelevance';
import {
  OEVRIGE_KRAV_BELOEB_MANGLER_MESSAGE,
  OEVRIGE_KRAV_UDGIFT_TIL_MANGLER_MESSAGE,
  assessOevrigeKravRow,
  type OevrigeKravRowAssessment,
} from '../domain/erstatningsopgoerelse/validation/oevrigeKravRowValidation';
import { resolveSfggSource, sfggKildeUsesReferenceperiode } from '../domain/erstatningsopgoerelse/engines/sfggKilde';
import { erSfggFeltRelevant } from '../domain/erstatningsopgoerelse/helpers/eoLoenindkomstRelevance';
import {
  SFGG_BEREGNINGSKILDE_MANGLER_MESSAGE,
  SFGG_MANUEL_DAGSSATS_MANGLER_MESSAGE,
  SFGG_SATSVALG_MANGLER_MESSAGE,
  buildSfggOverenskomstManglerBesked,
} from '../domain/erstatningsopgoerelse/helpers/sygeferiegodtgoerelseTexts';
import { resolveSvieSmerteCutoffDate } from '../domain/erstatningsopgoerelse/validation/svieSmerteConstraints';
import { assessSvieSmertePerioder } from '../domain/erstatningsopgoerelse/validation/svieSmertePeriodeValidation';
import {
  BEREGNINGSPERIODE_MANGLER_MESSAGE,
  INGEN_INDKOMST_I_BEREGNINGSPERIODEN_MESSAGE,
} from '../domain/erstatningsopgoerelse/validation/beregningsgrundlagFradragRules';
import {
  buildMissingLoenudviklingReguleringsdatoMessage,
  OVERENSKOMST_SKAL_SLAAS_TIL_BESKED,
} from '../domain/erstatningsopgoerelse/validation/loenudviklingReguleringsdato';
import { getOffentligOverenskomstTypeById, getOverenskomstMetaById, getOverenskomstSfggPolicy } from '../data/overenskomstRates';
import {
  parseOffentligLoenSelection,
  type OffentligLoenSelectionFailure,
} from '../domain/erstatningsopgoerelse/helpers/offentligLoenSelection';
import { harAktivOverenskomst, harModstridendeOverenskomstValg } from '../domain/erstatningsopgoerelse/helpers/aktivOverenskomst';
import { hasIndtastetLoenoplysninger } from '../domain/erstatningsopgoerelse/helpers/loenoplysningerInput';
import { DEFAULT_FRACTION_MAX_DIGITS, parseFractionString } from '../utils/fraction';
import { DATE_ORDER_ERROR_MESSAGE, hasDateOrderError } from '../utils/dateOrderValidation';
import { buildBeregningsperiodeRange, buildIncomeForRanges, buildTafRanges } from '../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { resolveNegativeIndkomstkilder } from '../domain/erstatningsopgoerelse/validation/negativeIndkomstkilder';
import {
  opregulerMedAkkumuleretReguleringssats,
  opregulerMedAslAarsloensmaksimum,
} from '../domain/satser/opreguleringsmotorer';
import { formatAslAarsloensmaksimumMissingForYears } from '../domain/satser/aslAarsloensmaksimum';

// Samme ordlyd som «Fejl og advarsler»s linje, så de to lag aldrig siger to ting om samme overlap (M-33).
export const TAF_OVERLAP_ERROR_MESSAGE = TAF_OVERLAP_LINJE;

// =============================================================================
// LAG 1: SCHEMA-VALIDERING
// =============================================================================

/**
 * Schema-validering via Zod
 *
 * Validerer:
 * - Datatyper
 * - Canonical syntaks, form og sikker numerisk repræsentation
 *
 * Fortegn, min/max og øvrige domæneregler valideres i de rene lag nedenfor, så
 * parsebare værdier uden for grænsen kan bevares canonical uden at nå beregningsmotorerne.
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

  // Her stod kortvarigt advarslen om fravalgt Store Bededagstillæg. Den hører IKKE i validatoren:
  // «Fejl og advarsler» på EO-beregningsfanen fodres udelukkende af række-byggerne i
  // `src/domain/eoRowEvaluation/`, så en `severity: 'warning'` herfra blev aldrig vist – den blev
  // kun en ikke-blokerende snapshot-invariant uden læser. Advarslen bor nu i `buildEoIndkomstRows`.

  // Dato-interval validering: periodeFra <= periodeTil
  if (
    values.vedroererPeriodeFra &&
    values.vedroererPeriodeTil &&
    hasDateOrderError(values.vedroererPeriodeFra, values.vedroererPeriodeTil)
  ) {
    errors.push({
      path: 'vedroererPeriodeFra',
      message: DATE_ORDER_ERROR_MESSAGE,
      severity: 'error',
    });
  }

  return errors;
}

const PERCENTAGE_RANGE_ERROR_MESSAGE = 'Procent skal være mellem 0 og 100';
const NON_NEGATIVE_AMOUNT_ERROR_MESSAGE = 'Beløb kan ikke være negativt';

const percentageRangeError = (path: string, value: number | undefined): ValidationError | undefined => {
  if (value === undefined || (value >= 0 && value <= 100)) return undefined;
  return { path, message: PERCENTAGE_RANGE_ERROR_MESSAGE, severity: 'error' };
};

const nonNegativeAmountError = (path: string, value: AmountValue | undefined): ValidationError | undefined => {
  const amount = amountValueToNumber(value);
  if (amount === undefined || (amount >= 0 && !Object.is(amount, -0))) return undefined;
  return { path, message: NON_NEGATIVE_AMOUNT_ERROR_MESSAGE, severity: 'error' };
};

const LOENTRIN_RANGE_ERROR_MESSAGE = 'Løntrin skal være mellem 1 og 55';
const LOENGRUPPE_RANGE_ERROR_MESSAGE = 'Løngruppe skal være mellem 0 og 4';

/**
 * Feltplacering + besked for hver måde, en offentlig løn-indplacering kan være ufuldstændig på.
 *
 * Nøglerne er `OffentligLoenSelectionFailure` – motorens EGEN udfaldstype. Tilføjes en ny årsag
 * dér, fejler dette record typecheck, indtil den også har en synlig validatorfejl. Det er værnet
 * mod at motoren igen kan kaste på et input, validatoren fandt gyldigt (`trin-mangler` var netop
 * sådan et hul: intervallet blev tjekket, men ikke tilstedeværelsen).
 *
 * De to `-ugyldig`-årsager deler beskeds-konstant med `validateLoenudviklingCanonicalRanges`, som
 * også dækker interval-overtrædelser på de samme feltstier. Validatorens samlede resultat
 * deduplikerer den identiske fejl, så parseren stadig har en synlig ejer for hver motorårsag uden
 * at sende samme felt/besked to gange videre til validatorens forbrugere.
 */
const OFFENTLIG_LOEN_SELECTION_VALIDATION_ISSUE: Readonly<
  Record<OffentligLoenSelectionFailure, Readonly<{ field: string; message: string }>>
> = {
  'trin-mangler': { field: 'offentligLoenTrin', message: 'Løntrin skal udfyldes' },
  'trin-ugyldig': { field: 'offentligLoenTrin', message: LOENTRIN_RANGE_ERROR_MESSAGE },
  'gruppe-mangler': { field: 'offentligLoenGruppe', message: 'Gruppe skal udfyldes' },
  'gruppe-ugyldig': { field: 'offentligLoenGruppe', message: LOENGRUPPE_RANGE_ERROR_MESSAGE },
};

const validateLoenudviklingCanonicalRanges = (
  loenudvikling: ErstatningsopgoerelseValues['eoAngivetLoenLoenudvikling'],
  prefix: string
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const addPercentage = (path: string, value: number | undefined): void => {
    const error = percentageRangeError(path, value);
    if (error) errors.push(error);
  };

  addPercentage(`${prefix}.feriePct`, loenudvikling.feriePct);

  loenudvikling.loenudviklingManuelTableData.forEach((row, rowIndex) => {
    const rowPrefix = `${prefix}.loenudviklingManuelTableData[${rowIndex}]`;
    addPercentage(`${rowPrefix}.feriepenge`, row.feriepenge);
    addPercentage(`${rowPrefix}.shSoSats`, row.shSoSats);
    addPercentage(`${rowPrefix}.fritvalg`, row.fritvalg);
    addPercentage(`${rowPrefix}.agPension`, row.agPension);
  });

  loenudvikling.loenudviklingManuelProcentsatsTableData.forEach((row, rowIndex) => {
    addPercentage(`${prefix}.loenudviklingManuelProcentsatsTableData[${rowIndex}].procent`, row.procent);
  });

  const extraGrundloenError = nonNegativeAmountError(
    `${prefix}.offentligLoenEkstraGrundloen`,
    loenudvikling.offentligLoenEkstraGrundloen
  );
  if (extraGrundloenError) errors.push(extraGrundloenError);

  const anciennitetError = nonNegativeAmountError(
    `${prefix}.anciennitetstillaegSats`,
    loenudvikling.anciennitetstillaegSats
  );
  if (anciennitetError) errors.push(anciennitetError);

  if (
    loenudvikling.offentligLoenTrin !== undefined &&
    (loenudvikling.offentligLoenTrin < 1 || loenudvikling.offentligLoenTrin > 55)
  ) {
    errors.push({
      path: `${prefix}.offentligLoenTrin`,
      message: LOENTRIN_RANGE_ERROR_MESSAGE,
      severity: 'error',
    });
  }
  if (
    loenudvikling.offentligLoenGruppe !== undefined &&
    (loenudvikling.offentligLoenGruppe < 0 || loenudvikling.offentligLoenGruppe > 4)
  ) {
    errors.push({
      path: `${prefix}.offentligLoenGruppe`,
      message: LOENGRUPPE_RANGE_ERROR_MESSAGE,
      severity: 'error',
    });
  }

  return errors;
};

/**
 * De persistente schemas accepterer alle syntaktisk gyldige canonical værdier. De tidligere
 * schema-grænser ligger derfor samlet her, så snapshot- og dokumentgates også ser fejl i
 * felter, som ikke aktuelt er mountet i formularen.
 *
 * «Ikke mountet» er ikke det samme som «skjult»: et felt bag et valg (fx «Nej»/«Skjul») er ikke
 * udfyldt og må ikke blokere (BB-222/BB-228). Værdierne her kommer fra readeren, som giver et
 * sådant felt dets tomværdi gennem descriptorens `relevance`; grænserne rammer derfor kun felter,
 * brugeren kan se og rette.
 */
function validateCanonicalRanges(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];
  const addPercentage = (path: string, value: number | undefined): void => {
    const error = percentageRangeError(path, value);
    if (error) errors.push(error);
  };
  const addNonNegativeAmount = (path: string, value: AmountValue | undefined): void => {
    const error = nonNegativeAmountError(path, value);
    if (error) errors.push(error);
  };
  const addDayCount = (path: string, value: number | undefined, max: number): void => {
    if (value === undefined || (value >= 0 && value <= max)) return;
    errors.push({ path, message: `Antal dage skal være mellem 0 og ${max}`, severity: 'error' });
  };

  addPercentage('forligAnsvarsgradProcent', values.forligAnsvarsgradProcent);

  addNonNegativeAmount('svieSmerteTidligereTotal', values.svieSmerteTidligereTotal);
  addNonNegativeAmount('svieSmerteAktuelPeriode', values.svieSmerteAktuelPeriode);
  addNonNegativeAmount('tidligereModtagetTaf', values.tidligereModtagetTaf);
  addNonNegativeAmount('maanedsloenenUdgoer', values.maanedsloenenUdgoer);
  addNonNegativeAmount('dagsloenenUdgoer', values.dagsloenenUdgoer);

  // «Løse ferie-/feriefridage» og «Antal fraværsdage» bærer selv deres loft på descriptoren (BB-264): her
  // spærrede reglen uden rød celle, og ved 400 gav den en anden linje oven i periodens egen grænse.
  values.tafPerioder.forEach((row, index) => {
    addDayCount(`tafPerioder[${index}].loseFeriedage`, row.loseFeriedage, 999);
  });

  // SFGG-fraværsdagenes loft (366) bærer feltet selv på descriptoren: her spærrede det uden rød ring.
  values.sfggAnsaettelsesforhold.forEach((row, index) => {
    const prefix = `sfggAnsaettelsesforhold[${index}]`;
    addNonNegativeAmount(`${prefix}.sfggManuelDagssats`, row.sfggManuelDagssats);
    addNonNegativeAmount(`${prefix}.sfggAlleredeBetaltBeloeb`, row.sfggAlleredeBetaltBeloeb);
  });

  values.loenindkomstAnsaettelsesforhold.forEach((ansaettelsesforhold, index) => {
    const prefix = `loenindkomstAnsaettelsesforhold[${index}]`;
    addPercentage(`${prefix}.fritvalgPct`, ansaettelsesforhold.fritvalgPct);
    addPercentage(`${prefix}.shSoPct`, ansaettelsesforhold.shSoPct);
    addPercentage(`${prefix}.storeBededagPct`, ansaettelsesforhold.storeBededagPct);
    addPercentage(`${prefix}.pensionPct`, ansaettelsesforhold.pensionPct);
    errors.push(...validateLoenudviklingCanonicalRanges(ansaettelsesforhold, prefix));
  });

  errors.push(...validateLoenudviklingCanonicalRanges(
    values.eoAngivetLoenLoenudvikling,
    'eoAngivetLoenLoenudvikling'
  ));

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
  const beregnes = values.kravPaaSvieSmerteGodtgoerelse === 'Ja';
  if (!beregnes) return errors;

  const periodeSynlig = values.tidligereSsMax === 'Nej';
  if (!periodeSynlig) return errors;

  const perioder = values.svieSmertePerioder ?? [];
  const nonEmpty = perioder.filter((row) => !isSvieSmerteRowEmpty(row));
  const rowAssessments = assessSvieSmertePerioder(perioder, {
    menAfgoerelseDato: resolveSvieSmerteCutoffDate(values),
    verserendeKlageMen: values.verserendeKlageMen === 'Ja',
  });

  // Downloadvalidator og rækkevisningen deler vurderingen af fuldstændighed, datoorden og ménafgørelses-cutoff.
  // Her oversættes den til validatorens eksisterende feltnavne og fejltekster.
  for (let i = 0; i < perioder.length; i += 1) {
    const assessment = rowAssessments.get(perioder[i].id);
    if (assessment === undefined || assessment.kind === 'skip') continue;
    const prefix = `svieSmertePerioder[${i}]`;
    for (const field of assessment.missingFields) {
      const label = field === 'fra' ? 'Fra-dato' : field === 'til' ? 'Til-dato' : 'Tilstand';
      errors.push({ path: `${prefix}.${field}`, message: `${label} mangler`, severity: 'error' });
    }
    if (assessment.dateOrderError) {
      errors.push({ path: `${prefix}.fra`, message: DATE_ORDER_ERROR_MESSAGE, severity: 'error' });
    }
    // Som før vurderes cutoff kun, når begge datoer findes, og datoordenen er gyldig.
    if (!assessment.missingFields.includes('fra')
      && !assessment.missingFields.includes('til')
      && !assessment.dateOrderError
      && assessment.tilCutoffError !== undefined) {
      errors.push({ path: `${prefix}.til`, message: assessment.tilCutoffError, severity: 'error' });
    }
  }

  // Bevar validatorens hidtidige rækkefølge: række-fejl først, overlap derefter.
  if (nonEmpty.length > 1) {
    for (let i = 0; i < perioder.length; i += 1) {
      if (rowAssessments.get(perioder[i].id)?.hasOverlap === true) {
        errors.push({
          path: `svieSmertePerioder[${i}].fra`,
          message: 'Svie/smerte-perioder overlapper',
          severity: 'error',
        });
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
      if (!hasSvieSmerteSatserForAar(satserAar)) {
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
function validateTAF(
  values: ErstatningsopgoerelseValues,
  options?: ErstatningsopgoerelseValidationOptions
): ValidationError[] {
  const errors: ValidationError[] = [];
  const beregnes = values.kravPaaTabtArbejdsfortjeneste === 'Ja';
  if (!beregnes) return errors;

  const tafPerioder = values.tafPerioder ?? [];
  const rowAssessments = assessTafPeriodeRows(tafPerioder);

  // Vurderingerne deles med rækkevisningen, så gate og synlig række ikke kan drive fra hinanden.
  for (let i = 0; i < tafPerioder.length; i += 1) {
    const row = tafPerioder[i];
    const assessment = rowAssessments.get(row.id);
    if (!assessment?.isActive) continue;
    if (assessment.missingDate) {
      errors.push({
        path: `tafPerioder[${i}].${assessment.missingDate.field}`,
        message: assessment.missingDate.message,
        severity: 'error',
      });
    } else if (assessment.dateOrderError) {
      errors.push({
        path: `tafPerioder[${i}].fra`,
        message: DATE_ORDER_ERROR_MESSAGE,
        severity: 'error',
      });
    }
  }

  for (let i = 0; i < tafPerioder.length; i += 1) {
    if (rowAssessments.get(tafPerioder[i].id)?.hasOverlap !== true) continue;
    errors.push({
      path: `tafPerioder[${i}].fra`,
      message: TAF_OVERLAP_ERROR_MESSAGE,
      severity: 'error',
    });
  }

  errors.push(...validateTafLoseFeriedage(values, options));
  // Beregningsperiodens løse dage og fravær vurderes i `beregningsgrundlagCellIssues.ts`, som farver feltet
  // (BB-264) og også fanger den nævner på 0, der før førte til en intern undtagelse (BB-258).

  // Validér beregnesUdFra matchende felter
  errors.push(...validateBeregnesUdFra(values));

  // Validér lønudvikling konsistens
  errors.push(...validateLoenudviklingKonsistens(values));
  errors.push(...validateLoenudviklingsKravForAktivKilde(values, options));
  errors.push(...validateLoenindkomstSatsKrav(values, options));
  errors.push(...validateOffentligeYdelserReguleringssatser(values, options));
  // En kilde med samlet negativ indtægt i en periode standser motoren (BB-290). Linjen i «Fejl og advarsler» er
  // rækkens (`eoRowIndkomstRows.ts`); stien er bevidst ikke et top-level felt, så sikkerhedsnettet ikke gentager den.
  errors.push(...resolveNegativeIndkomstkilder(values, options?.skadedatoISO).map((fund) => ({
    path: fund.source.kind === 'employer' ? `loenindkomstAnsaettelsesforhold.${fund.source.id}` : 'offentligeYdelserRows',
    message: fund.message,
    severity: 'error' as const,
  })));
  // SIDST og kun uden andre TAF-fejl: reglen er et værn, der standser motoren, når INTET andet gør det. Spærrer en
  // anden regel allerede (fx manglende indtægtsoplysninger), er den overflødig.
  if (errors.length === 0) errors.push(...validateBeregningsperiodeIndkomst(values, options));
  // BEMÆRK: Satsdækning for "TAF opreguleret til beregningsåret" valideres IKKE her.
  // Den hører hjemme i compute-laget (buildTafPerYearOpreguleretBuildOutcome), som er
  // den eneste sandhed for hvilke år der reelt skal opreguleres: kun kalenderår med et
  // nettobeløb ≠ 0 (0-beløbs-år springes over). En pre-compute validator på rå
  // række-intervaller kan ikke kende de afledte per-år-beløb og ville derfor over-
  // rapportere (falsk-positiv blokerende feltfejl på et 0-beløbs-år). Manglende
  // reguleringssats fanges fail-closed af compute-invarianten
  // buildTafPerYearOpreguleretManglendeReguleringssatsInvariant, der korrekt KUN
  // blokerer TAF-opreguleret-PDF'en (ikke hele EO-beregningen). Jf. 4.12-review.

  return errors;
}

const formatMissingYears = (years: readonly number[]): string =>
  years.length === 1 ? `${years[0]}` : years.join(', ');

function validateOffentligeYdelserReguleringssatser(
  values: ErstatningsopgoerelseValues,
  options?: ErstatningsopgoerelseValidationOptions
): ValidationError[] {
  if (values.beregnesUdFra !== 'Beregningsperiode') return [];
  if (values.regulerOffentligeYdelser !== 'Ja') return [];

  const beregningsperiode = buildBeregningsperiodeRange(values);
  if (!beregningsperiode) return [];
  const income = buildIncomeForRanges(values, [beregningsperiode], undefined, options?.skadedatoISO);
  if (income.benefits.length === 0) return [];

  const tafRanges = buildTafRanges(values, { skadedatoISO: options?.skadedatoISO });
  if (tafRanges.length === 0) return [];
  const maxTafYear = tafRanges.reduce((max, range) => Math.max(max, Number.parseInt(range.til.slice(0, 4), 10)), 0);
  const bounds = getYearBoundsForYearlyRate(reguleringssats);
  if (!bounds) return [];

  const errors: ValidationError[] = [];
  // Ydelsesniveauet følger beregningsperioden, uafhængigt af jobkortenes rækkefølge og særlige datoer.
  const reguleringsBaseIso = values.tafBeregningsperiodeTil;
  const minReguleringsdatoIso = `${bounds.minYear}-01-01`;
  if (reguleringsBaseIso !== undefined && reguleringsBaseIso < minReguleringsdatoIso) {
    errors.push({
      path: 'regulerOffentligeYdelser',
      message: `Der kan ikke indtastes datoer før 1. januar ${bounds.minYear} ved regulering af offentlige ydelser.`,
      severity: 'error',
    });
  }
  const maxTafYearExceedsRateBounds = maxTafYear > bounds.maxYear;
  let missingRateYears: readonly number[] = [];
  if (reguleringsBaseIso !== undefined) {
    const baseYear = Number.parseInt(reguleringsBaseIso.slice(0, 4), 10);
    if (Number.isInteger(baseYear) && maxTafYear >= baseYear) {
      const { manglendeAar } = opregulerMedAkkumuleretReguleringssats(
        { kildeAar: baseYear, maalAar: maxTafYear },
        reguleringssats
      );
      missingRateYears = manglendeAar;
    }
  }
  if (missingRateYears.length > 0) {
    // Når slutåret også ligger efter den kendte satsdækning, beskriver de to fund samme
    // manglende sats. Én samlet fejl er mere forståelig; en særskilt fejl for en dato før
    // den tidligste sats er fortsat relevant og vises derfor ovenfor.
    const upperBoundExplanation = maxTafYearExceedsRateBounds
      ? ` Der kan ikke beregnes regulering efter ${bounds.maxYear}.`
      : '';
    errors.push({
      path: 'regulerOffentligeYdelser',
      message: `Regulering af offentlige ydelser kan ikke beregnes, fordi der mangler reguleringssats for ${formatMissingYears(missingRateYears)}.${upperBoundExplanation}`,
      severity: 'error',
    });
  } else if (maxTafYearExceedsRateBounds) {
    errors.push({
      path: 'regulerOffentligeYdelser',
      message: `Regulering af offentlige ydelser kan ikke beregnes efter ${bounds.maxYear}, fordi reguleringssatsen mangler.`,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * «Mangler»-beskederne for SFGG-referenceperioden. Eksporteret, fordi en rød (maskeret) dato også læses som tom
 * her; `suppressMaskedMissingInvariants` fjerner da den usande «mangler»-linje om en dato, der står i feltet.
 */
export const SFGG_REFERENCEPERIODE_FRA_MANGLER_MESSAGE = 'Referenceperiode fra-dato mangler';
export const SFGG_REFERENCEPERIODE_TIL_MANGLER_MESSAGE = 'Referenceperiode til-dato mangler';

function validateSygeferiegodtgoerelse(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];

  (values.loenindkomstAnsaettelsesforhold ?? []).forEach((employment) => {
    if (!shouldRequireSygeferiegodtgoerelseInput(values, employment)) return;

    const index = (values.sfggAnsaettelsesforhold ?? []).findIndex((entry) => entry.ansaettelsesforholdId === employment.id);
    const row = index >= 0 ? values.sfggAnsaettelsesforhold[index] : undefined;
    const errorPathPrefix = index >= 0
      ? `sfggAnsaettelsesforhold[${index}]`
      : 'sfggAnsaettelsesforhold';

    if (!row?.sfggBeregningskilde) {
      errors.push({
        path: `${errorPathPrefix}.sfggBeregningskilde`,
        message: SFGG_BEREGNINGSKILDE_MANGLER_MESSAGE,
        severity: 'error',
      });
      return;
    }

    if (row.sfggBeregningskilde === 'Ingen') return;

    // Rut kildeforståelsen gennem den kanoniske resolveSfggSource – samme opløsning som motoren.
    // Slå kun overenskomstens direkte-sats-policy op, når kilden faktisk lander i det direkte
    // overenskomstspor (resolveSfggSource kræver bl.a. harOverenskomst). At genudlede policyen
    // uafhængigt her gav tidligere selvmodsigende valideringsbeskeder – krav om satsvalg og
    // sprunget referenceperiode – når et privat overenskomst-ID blev hængende efter at
    // harOverenskomst var slået fra, hvor motoren behandler sporet som ferielov.
    const source = resolveSfggSource(row, employment);
    const overenskomstDirekteSatsPolicy =
      source.kind === 'overenskomst_direkte' && employment.overenskomstId
        ? getOverenskomstSfggPolicy(employment.overenskomstId)
        : undefined;
    // Referenceperioden kræves kun, når den også VISES. Ved «Overenskomst» uden en aktiv overenskomst regner
    // motoren i ferielov-sporet, men sektionen skjuler felterne; kravet gav da «Referenceperiode fra-dato
    // mangler» om et felt, brugeren ikke kunne se, oven i den egentlige fejl om den manglende overenskomst.
    const requiresReferenceperiode = sfggKildeUsesReferenceperiode(source.kind)
      && erSfggFeltRelevant('referenceperiode', {
        kravPaaTabtArbejdsfortjeneste: values.kravPaaTabtArbejdsfortjeneste,
        employment,
        sfggBeregningskilde: row.sfggBeregningskilde,
      });
    // En referenceperiode, der slutter før reguleringsgrundlagets første sats, ejes af
    // `collectLoenudviklingCoverageIssues`: den giver feltet rød ring og spærrer. Samme regel stod også her og
    // gav samme linje to gange i «Fejl og advarsler».


    if (row.sfggBeregningskilde === 'Manuelt angivet' && amountValueToNumber(row.sfggManuelDagssats) === undefined) {
      errors.push({
        path: `${errorPathPrefix}.sfggManuelDagssats`,
        message: SFGG_MANUEL_DAGSSATS_MANGLER_MESSAGE,
        severity: 'error',
      });
    }

    // Aktiv-prædikatet er ét sted (`harAktivOverenskomst`) – ikke stavet i hånden her, hvor en
    // manglende `.trim()` ellers ville lade et blankt id tælle som en valgt overenskomst.
    if (row.sfggBeregningskilde === 'Overenskomst' && !(employment && harAktivOverenskomst(employment))) {
      errors.push({
        path: `${errorPathPrefix}.sfggBeregningskilde`,
        message: buildSfggOverenskomstManglerBesked(employment),
        severity: 'error',
      });
    }

    if (requiresReferenceperiode && !row.sfggReferenceperiodeFra) {
      errors.push({
        path: `${errorPathPrefix}.sfggReferenceperiodeFra`,
        message: SFGG_REFERENCEPERIODE_FRA_MANGLER_MESSAGE,
        severity: 'error',
      });
    }

    if (requiresReferenceperiode && !row.sfggReferenceperiodeTil) {
      errors.push({
        path: `${errorPathPrefix}.sfggReferenceperiodeTil`,
        message: SFGG_REFERENCEPERIODE_TIL_MANGLER_MESSAGE,
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
        message: DATE_ORDER_ERROR_MESSAGE,
        severity: 'error',
      });
    }

    // Grænsen før første TAF-periode, fraværsdagenes loft og en periode uden løn ejes af
    // `collectSfggReferenceperiodeIssues`: de giver feltet rød ring og én linje med link. Her stod de to første og
    // gav to ens linjer uden link (BB-322, BB-323).

    if (source.kind === 'overenskomst_direkte' && overenskomstDirekteSatsPolicy?.direkteSatsErDifferentieret && !row.sfggSatsvalg) {
      errors.push({
        path: `${errorPathPrefix}.sfggSatsvalg`,
        message: SFGG_SATSVALG_MANGLER_MESSAGE,
        severity: 'error',
      });
    }
  });

  return errors;
}

type ErstatningsopgoerelseValidationOptions = Readonly<{
  skadedatoISO?: ISODateString | undefined;
  skadestype?: StamdataValues['skadestype'] | undefined;
  /**
   * Markerer at validatoren kaldes med den faktiske Stamdata-sektion. Det er vigtigt at skelne mellem en
   * manglende Stamdata-dato i en sag og en isoleret EO-validator, som med vilje ikke har den sektion med.
   */
  stamdataContext?: Pick<StamdataValues, 'skadedato' | 'skadestype'>;
}>;

/**
 * For mange løse feriedage i en TAF-række. Reglen og dens ordlyd ligger i `tafRowRules.ts`, som også
 * projekterer den til cellen (`tafRowCellIssues.ts`), så validatoren og den røde celle aldrig er uenige.
 */
export function validateTafLoseFeriedage(
  values: ErstatningsopgoerelseValues,
  options?: ErstatningsopgoerelseValidationOptions
): ValidationError[] {
  return (values.tafPerioder ?? []).flatMap((row, i) => {
    const maksimum = resolveTafLoseFeriedageMaksimum(row, values, options?.skadedatoISO);
    return maksimum === undefined
      ? []
      : [{ path: `tafPerioder[${i}].loseFeriedage`, message: buildTafLoseFeriedageMaxMessage(maksimum), severity: 'error' as const }];
  });
}

/**
 * En beregningsperiode uden en eneste indtægt over 0 kr., hvor en lønudvikling skal regulere den. Rækken «Ingen
 * indkomst i beregningsperioden» viste det allerede, men kun som en række: beregningen kørte alligevel, og
 * lønudviklingen endte i en intern undtagelse (BB-258). Reglen er derfor også en valideringsfejl, der standser
 * beregningen før motoren. Betingelsen er netop motorens (`loenudviklingBeregning.ts`): uden indtægt og ydelser
 * går det kun godt, når alle ansættelsesforhold har lønudvikling «Ingen» – da regnes der nul-segmenter, og rækken
 * alene spærrer downloaden. Linjen i «Fejl og advarsler» er rækkens; sikkerhedsnettet viser ikke denne oveni.
 */
function validateBeregningsperiodeIndkomst(
  values: ErstatningsopgoerelseValues,
  options?: ErstatningsopgoerelseValidationOptions
): ValidationError[] {
  if (values.beregnesUdFra !== 'Beregningsperiode') return [];
  const beregningsperiode = buildBeregningsperiodeRange(values);
  if (!beregningsperiode) return [];
  // Et ansættelsesforhold uden valgt lønudvikling spærrer allerede gennem sin egen regel.
  const kanReguleres = values.loenindkomstAnsaettelsesforhold
    .some((af) => af.loenudviklingBeregningsgrundlag !== undefined && af.loenudviklingBeregningsgrundlag !== 'Ingen');
  if (!kanReguleres) return [];
  const income = buildIncomeForRanges(values, [beregningsperiode], undefined, options?.skadedatoISO);
  if (income.employers.length > 0 || income.benefits.length > 0) return [];
  return [{ path: 'tafBeregningsperiodeFra', message: INGEN_INDKOMST_I_BEREGNINGSPERIODEN_MESSAGE, severity: 'error' }];
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
    // Én mangel, én linje: rækken i «Fejl og advarsler» siger det samme, og sikkerhedsnettet viser nu en
    // validatorregel, som ingen række dækker (BB-265). To beskeder – én pr. dato – gav da en ekstra linje.
    if (!values.tafBeregningsperiodeFra || !values.tafBeregningsperiodeTil) {
      errors.push({
        path: !values.tafBeregningsperiodeFra ? 'tafBeregningsperiodeFra' : 'tafBeregningsperiodeTil',
        message: BEREGNINGSPERIODE_MANGLER_MESSAGE,
        severity: 'error',
      });
    }
    if (
      values.tafBeregningsperiodeFra &&
      values.tafBeregningsperiodeTil &&
      hasDateOrderError(values.tafBeregningsperiodeFra, values.tafBeregningsperiodeTil)
    ) {
      errors.push({
        path: 'tafBeregningsperiodeFra',
        message: DATE_ORDER_ERROR_MESSAGE,
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

// ---- Lønindkomst ----

/**
 * Et overenskomst-id, som valglisten ikke kan give, men en indlæst `.eo` kan bære: overenskomsten er siden fjernet
 * eller omdøbt i overenskomstdataene. Samme besked fra satskravene og lønreguleringen, så dedupliceringen samler dem.
 */
const UKENDT_OVERENSKOMST_BESKED = 'Den valgte overenskomst findes ikke i Mineo – vælg overenskomsten igen';

/**
 * Satskravene på hvert ansættelsesforhold, uafhængigt af reguleringsform og beregningsmåde.
 *
 * - Feriegodtgørelsen skal være udfyldt, når kortet har lønoplysninger i procent-tilstand (BB-274). Samme
 *   prædikat (`isFeriePctPaakraevet`) driver den synlige satslinje i «Fejl og advarsler».
 * - Ligger datoen, en privat overenskomsts satser slås op på, før overenskomstens første satsperiode, kan
 *   beregningsgrundlaget ikke regnes (BB-275). Den synlige linje er satslinjen eller den særlige fra-datos ring.
 */
function validateLoenindkomstSatsKrav(
  values: ErstatningsopgoerelseValues,
  options?: ErstatningsopgoerelseValidationOptions
): ValidationError[] {
  const errors: ValidationError[] = [];
  (values.loenindkomstAnsaettelsesforhold ?? []).forEach((af, index) => {
    const path = (field: string): string => `loenindkomstAnsaettelsesforhold[${index}].${field}`;
    if (isFeriePctPaakraevet(af) && !Number.isFinite(af.feriePct)) {
      errors.push({ path: path('feriePct'), message: FERIE_PCT_MANGLER_BESKED, severity: 'error' });
    }
    if (
      values.beregnesUdFra !== 'Beregningsperiode'
      || af.tillaegAngivesSom === 'beloeb'
      || !hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? [])
    ) {
      return;
    }
    const daekning = resolvePrivatOverenskomstDaekning(af);
    if (daekning !== null && getOverenskomstMetaById(daekning.overenskomstId) === undefined) {
      // Et ukendt id har ingen satser på nogen dato; dæknings-beskeden ville bede om en senere reguleringsdato,
      // som intet kan rette.
      errors.push({ path: path('overenskomstId'), message: UKENDT_OVERENSKOMST_BESKED, severity: 'error' });
      return;
    }
    const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
      beregnesUdFra: values.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: undefined,
      saerligFraDatoRegulering: isISODateString(af.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : undefined,
      beregningsperiodeTil: values.tafBeregningsperiodeTil,
      skadedato: options?.skadedatoISO,
    });
    if (daekning !== null && anvendtReguleringsdato !== undefined && erDatoUdenOverenskomstSatser(daekning, anvendtReguleringsdato)) {
      errors.push({
        path: path('overenskomstId'),
        message: formatReguleringsdatoUdenOverenskomstSatserBesked(daekning),
        severity: 'error',
      });
    }
  });
  return errors;
}

function validateLoenudviklingsKravForAktivKilde(
  values: ErstatningsopgoerelseValues,
  options?: ErstatningsopgoerelseValidationOptions
): ValidationError[] {
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
    const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
      beregnesUdFra: values.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
      saerligFraDatoRegulering: isISODateString(af.saerligFraDatoRegulering)
        ? af.saerligFraDatoRegulering
        : undefined,
      beregningsperiodeTil: values.tafBeregningsperiodeTil,
      skadedato: options?.skadedatoISO,
    });
    if (
      options?.stamdataContext !== undefined &&
      anvendtReguleringsdato === undefined &&
      (values.beregnesUdFra === 'Angivet månedsløn' || values.beregnesUdFra === 'Angivet dagsløn')
    ) {
      const field = values.beregnesUdFra === 'Angivet månedsløn'
        ? 'angivetMaanedsloenOpreguleresFraDato'
        : 'angivetDagsloenOpreguleresFraDato';
      errors.push({
        path: path(field),
        message: buildMissingLoenudviklingReguleringsdatoMessage(values.beregnesUdFra, options.stamdataContext.skadestype),
        severity: 'error',
      });
    }
    const manualDateErrorMessage = anvendtReguleringsdato === undefined
      ? undefined
      : `Datoen skal være senere end datoen i den låste første række (${isoToDanish(anvendtReguleringsdato) ?? anvendtReguleringsdato})`;

    // Enhver AKTIV reguleringsform regulerer en løn – uden indtastede lønoplysninger findes der
    // intet at regulere, og motoren fail-closer ("mangler beregningsgrundlag"). Kravet hører til
    // her, hvor brugeren kan se hvilket felt der mangler, i stedet for i en defensiv invariant.
    // Gælder alle grundlag undtagen 'Ingen', som netop udtrykker "der reguleres ikke".
    //
    // Fejlen tilføjes UDEN at afbryde resten af rækkens kontroller: de øvrige regler (dæknings-
    // interval, anciennitetsdato, satskrav) er uafhængige af, om lønnen er indtastet endnu, og et
    // tidligt `return` ville skjule dem, indtil tabellen var udfyldt.
    if (
      values.beregnesUdFra === 'Beregningsperiode'
      && !hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? [])
    ) {
      errors.push({
        path: path('indtaegtsoplysningerTableData'),
        message: 'Lønoplysninger skal udfyldes, når lønudviklingen reguleres',
        severity: 'error',
      });
    }

    if (grundlag === 'Overenskomst') {
      if (!af.overenskomstId) {
        errors.push({ path: path('overenskomstId'), message: 'Overenskomst skal vælges', severity: 'error' });
      } else if (getOverenskomstMetaById(af.overenskomstId) === undefined) {
        // Valglisten kan ikke give et ukendt id, men en indlæst `.eo` kan bære et id på en overenskomst, der
        // siden er fjernet eller omdøbt i overenskomstdataene. Uden reglen endte satsopslaget i en intern
        // beregningsfejl (angivet løn og Beløb-tilstand) eller i en misvisende besked om reguleringsdatoen.
        errors.push({ path: path('overenskomstId'), message: UKENDT_OVERENSKOMST_BESKED, severity: 'error' });
      } else if (harModstridendeOverenskomstValg(af)) {
        // Id valgt, men togglen slået fra. Satsopslaget falder tilbage til ULÅST, så
        // overenskomstens SH/SO- og pensionssatser IKKE udledes – tidligere skete det tavst,
        // med et snapshot der meldte `ok` og regnede videre på ufuldstændige satser.
        errors.push({
          path: path('harOverenskomst'),
          message: OVERENSKOMST_SKAL_SLAAS_TIL_BESKED,
          severity: 'error',
        });
      }
      const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
        beregnesUdFra: values.beregnesUdFra,
        angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
        saerligFraDatoRegulering: isISODateString(af.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : undefined,
        beregningsperiodeTil: values.tafBeregningsperiodeTil,
        skadedato: options?.skadedatoISO,
      });
      if (
        af.harAnciennitetstillaegEfterSkadedatoen &&
        isISODateString(af.anciennitetstillaegDato) &&
        anvendtReguleringsdato &&
        af.anciennitetstillaegDato <= anvendtReguleringsdato
      ) {
        const reference = resolveAnvendtReguleringsdatoReferenceText({
          anvendtReguleringsdato,
          skadedato: options?.skadedatoISO,
          skadestype: options?.skadestype,
          beregnesUdFra: values.beregnesUdFra,
          beregningsperiodeTil: values.tafBeregningsperiodeTil,
          saerligFraDatoRegulering: isISODateString(af.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : undefined,
          angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
        });
        // Samme tekst som feltets røde ring (`collectAnciennitetstillaegDatoIssues`), så sikkerhedsnettet genkender
        // linjen som dækket og ikke gentager den uden link (BB-305).
        errors.push({
          path: path('anciennitetstillaegDato'),
          message: `Datoen skal være efter ${reference}`,
          severity: 'error',
        });
      }
      // Ingen "Løn på helligdage skal vælges"-regel: feltet er required-with-default i det persisterede
      // schema for BEGGE lønkilder (ansættelsesforhold og EO-angivet løn), så `undefined` ikke kan nå hertil.
      // Reglen stod her som et værn, der aldrig kunne fyre – og den skjulte samtidig, at angivet løn manglede
      // en default og derfor fail-closede som systemfejl i stedet.
      // Offentlig overenskomst kræver en fuld løn-indplacering (løntype + løntrin + gruppe).
      // Validatoren afgør det med SAMME parser som motoren (`parseOffentligLoenSelection`), så de to
      // ikke kan divergere: hver `reason` motoren ville kaste på, er her en synlig feltfejl.
      const offentligType = af.overenskomstId
        ? getOffentligOverenskomstTypeById(af.overenskomstId)
        : undefined;
      if (offentligType) {
        const selection = parseOffentligLoenSelection({
          offentligType,
          offentligLoenType: af.offentligLoenType,
          offentligLoenTrin: af.offentligLoenTrin,
          offentligLoenGruppe: af.offentligLoenGruppe,
        });
        if (!selection.ok) {
          const issue = OFFENTLIG_LOEN_SELECTION_VALIDATION_ISSUE[selection.reason];
          errors.push({ path: path(issue.field), message: issue.message, severity: 'error' });
        }
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

    errors.push(...validateLoenudviklingDataCoverage(values, af, path, options));

    // 'Manuelt angivet' er tilgængelig i begge tillægs-tilstande. Grundløn/dato-krav gælder ens;
    // i Beløb-tilstand kommer basis-satserne fra første tabelrække, ikke fra det skjulte feriePct-felt.
    if (grundlag === 'Manuelt angivet') {
      const rows = af.loenudviklingManuelTableData ?? [];
      const aktiveRows = rows.filter(isManuelAngivetRowAktiv);

      // Basisrækken (rows[0]) har låst dato (= reguleringsdatoen); dato-kravet gælder derfor kun
      // de efterfølgende rækker. Uden dato ville motoren ellers stille droppe rækken, og
      // reguleringen ville udeblive uden synlig fejl.
      const aktiveRowsEfterBasis = rows.slice(1).filter((row) => aktiveRows.includes(row));
      // Basisrækkens grundløn er nævneren i hele reguleringen, så den kræves, så snart tabellen er i brug – også
      // når rækken ellers står tom. I Beløb-tilstand og ved angivet løn udfyldes dens satser ikke automatisk, og
      // en tom basisrække talte derfor ikke som aktiv: motoren fik en basispakke på 0 og endte i en intern
      // beregningsfejl i stedet for denne valideringsfejl.
      const basisRow = rows[0];
      const grundloenRows = basisRow !== undefined && aktiveRows.length > 0 && !aktiveRows.includes(basisRow)
        ? [basisRow, ...aktiveRows]
        : aktiveRows;

      rows.slice(1).forEach((row, rowIndex) => {
        if (isManualRegulationDateOnOrBeforeBasis(row.dato, anvendtReguleringsdato)) {
          errors.push({
            path: path(`loenudviklingManuelTableData[${rowIndex + 1}].dato`),
            message: manualDateErrorMessage ?? 'Datoen skal være senere end datoen i den låste første række',
            severity: 'error',
          });
        }
      });

      if (aktiveRows.length === 0) {
        errors.push({
          path: path('loenudviklingManuelTableData'),
          message: 'Mindst én manuel reguleringsrække skal udfyldes',
          severity: 'error',
        });
      } else if (grundloenRows.some((row) => row.grundloen === undefined)) {
        errors.push({
          path: path('loenudviklingManuelTableData'),
          message: 'Grundløn skal udfyldes på alle manuelle reguleringsrækker',
          severity: 'error',
        });
      } else if (grundloenRows.some((row) => (amountValueToNumber(row.grundloen) ?? 0) <= 0)) {
        errors.push({
          path: path('loenudviklingManuelTableData'),
          message: 'Grundløn skal være større end 0 på alle manuelle reguleringsrækker',
          severity: 'error',
        });
      } else if (aktiveRowsEfterBasis.some((row) => !isManuelAngivetRowDatoUdfyldt(row))) {
        errors.push({
          path: path('loenudviklingManuelTableData'),
          message: 'Dato skal udfyldes på alle manuelle reguleringsrækker',
          severity: 'error',
        });
      }
    }

    if (grundlag === 'Manuel procentsats') {
      const rows = (af.loenudviklingManuelProcentsatsTableData ?? []).slice(1);
      const aktiveRows = rows.filter(isManuelProcentsatsRowAktiv);
      rows.forEach((row, rowIndex) => {
        if (isManualRegulationDateOnOrBeforeBasis(row.dato, anvendtReguleringsdato)) {
          errors.push({
            path: path(`loenudviklingManuelProcentsatsTableData[${rowIndex + 1}].dato`),
            message: manualDateErrorMessage ?? 'Datoen skal være senere end datoen i den låste første række',
            severity: 'error',
          });
        }
      });
      if (aktiveRows.some((row) => row.dato === undefined)) {
        errors.push({
          path: path('loenudviklingManuelProcentsatsTableData'),
          message: 'Dato skal udfyldes på alle manuelle procentsatsrækker',
          severity: 'error',
        });
      } else if (aktiveRows.some((row) => !hasFinitePct(row.procent))) {
        errors.push({
          path: path('loenudviklingManuelProcentsatsTableData'),
          message: 'Procent skal udfyldes på alle manuelle procentsatsrækker',
          severity: 'error',
        });
      }
    }
  });

  return errors;
}

const resolveLoenudviklingCoveragePath = (
  values: ErstatningsopgoerelseValues,
  af: ReturnType<typeof resolveLoenudviklingKilde>[number],
  path: (field: string) => string
): string => {
  if (values.beregnesUdFra === 'Beregningsperiode') {
    return af.saerligFraDatoRegulering ? path('saerligFraDatoRegulering') : 'tafBeregningsperiodeTil';
  }
  if (values.beregnesUdFra === 'Angivet dagsløn') {
    return values.angivetDagsloenOpreguleresFraDato ? 'angivetDagsloenOpreguleresFraDato' : 'beregnesUdFra';
  }
  return values.angivetMaanedsloenOpreguleresFraDato ? 'angivetMaanedsloenOpreguleresFraDato' : 'beregnesUdFra';
};

const validateLoenudviklingDataCoverage = (
  values: ErstatningsopgoerelseValues,
  af: ReturnType<typeof resolveLoenudviklingKilde>[number],
  path: (field: string) => string,
  options?: ErstatningsopgoerelseValidationOptions
): ValidationError[] => {
  const grundlag = af.loenudviklingBeregningsgrundlag;
  if (!grundlag || grundlag === 'Ingen') return [];

  const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
    beregnesUdFra: values.beregnesUdFra,
    angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
    saerligFraDatoRegulering: isISODateString(af.saerligFraDatoRegulering) ? af.saerligFraDatoRegulering : undefined,
    beregningsperiodeTil: values.tafBeregningsperiodeTil,
    skadedato: options?.skadedatoISO,
  });
  if (!anvendtReguleringsdato) return [];

  const coverage = resolveKildeReguleringsIntervalIso(af);
  const errors: ValidationError[] = [];
  const tafRanges = buildTafRanges(values, { skadedatoISO: options?.skadedatoISO });
  if ((grundlag === 'Manuelt angivet' || grundlag === 'Manuel procentsats') &&
    tafRanges.some((range) => range.fra < anvendtReguleringsdato)) {
    return [{ path: path('loenudviklingBeregningsgrundlag'), severity: 'error',
      message: formatTafStartFoerManuelReguleringsdatoBesked(anvendtReguleringsdato) }];
  }
  // Den nedre grænse er altid blokerende. Sluttolerancen må aldrig føre en sats bagud. Beskederne deles med
  // `collectLoenudviklingCoverageIssues`, som giver linjen og den røde ring; samme tekst her gør, at
  // sikkerhedsnettet genkender den som dækket (BB-306).
  const kildeNavn = resolveReguleringskildeNavn(af);
  if (coverage?.fraIso) {
    const coverageStart = coverage.fraIso;
    if (anvendtReguleringsdato < coverageStart) {
      // Kortets satsregel melder allerede en privat overenskomst uden satser på datoen (BB-306).
      const meldtAfSatserne = grundlag === 'Overenskomst' && values.beregnesUdFra === 'Beregningsperiode'
        && erReguleringsdatoUdenOverenskomstSatserMeldt(af, anvendtReguleringsdato);
      if (!meldtAfSatserne) {
        errors.push({ path: resolveLoenudviklingCoveragePath(values, af, path), severity: 'error',
          message: formatReguleringsdatoFoerKildeBesked(kildeNavn, anvendtReguleringsdato, coverageStart) });
      }
    } else if (tafRanges.some((range) => range.fra < coverageStart)) {
      errors.push({ path: path('loenudviklingBeregningsgrundlag'), severity: 'error',
        message: formatTafStartFoerKildeBesked(kildeNavn, coverageStart) });
    }
  }
  if (errors.length > 0) return errors;
  if (grundlag === 'Statistik' && isAslStatistikModel((af.loenudviklingStatistikModel ?? '').trim())) {
    const baseYear = Number.parseInt(anvendtReguleringsdato.slice(0, 4), 10);
    const maxTafYear = tafRanges.reduce((max, range) => Math.max(max, Number.parseInt(range.til.slice(0, 4), 10)), baseYear);
    const { manglendeAar } = opregulerMedAslAarsloensmaksimum(
      { kildeAar: baseYear, maalAar: maxTafYear },
      aarsloenAslMax
    );
    if (manglendeAar.length > 0) {
      return [{
        path: resolveLoenudviklingCoveragePath(values, af, path),
        message: `Lønregulering kan ikke beregnes, fordi ${formatAslAarsloensmaksimumMissingForYears(manglendeAar)}`,
        severity: 'error',
      }];
    }
  }
  if (!coverage?.tilIso) return [];

  if (anvendtReguleringsdato <= coverage.tilIso) return [];

  return [{
    path: resolveLoenudviklingCoveragePath(values, af, path),
    message: formatReguleringsdatoEfterKildeBesked(kildeNavn, coverage.tilIso),
    severity: 'error',
  }];
};

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

// ---- Øvrige krav ----

/**
 * Validerer øvrige krav-rækker
 *
 * Regler:
 * - Ikke-tomme rækker skal have udgiftTil og beløb udfyldt (datoen er valgfri, BB-229)
 * - Beløb kan ikke være negativt
 */
function validateOevrigeKrav(values: ErstatningsopgoerelseValues): ValidationError[] {
  const errors: ValidationError[] = [];
  // Samme gate som søskendene `validateSvieSmerte`/`validateTAF`. Uden den blev en halvudfyldt række bag
  // «Nej»/«Skjul» ved med at spærre opgørelsen med en linje, der hverken havde link eller nævnte sektionen
  // (BB-228). Readerens relevansgrænse giver allerede tomme celler her; gaten står som forsvar i dybden for
  // kald uden reader og for at gøre afhængigheden læsbar.
  if (!erOevrigeKravSektionAktiv(values)) return errors;
  const rows = values.oevrigeKravPerioder ?? [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const assessment = assessOevrigeKravRow(row, {}, undefined);
    if (assessment.kind === 'empty') continue;
    const errors_ = validateOevrigeKravRowCompleteness(row, i, assessment);
    errors.push(...errors_);
  }

  return errors;
}

/**
 * Validér at en ikke-tom øvrige krav-række har beskrivelse og beløb.
 *
 * Datoen er bevidst VALGFRI (udviklerafgørelse 2026-09-23, BB-229): en udgift kan mangle en nøjagtig dato,
 * og dokumentet trykker den da uden datopræfiks. Et beløb på 0 kr. afvises af feltet selv
 * (`eoOevrigeKravBeloebField`), så cellen bliver rød; reglen stod før kun her, uden rød celle (BB-232).
 * `assessOevrigeKravRow` afgør både tomhed og hvilke påkrævede felter der mangler; validatoren omsætter
 * samme vurdering til feltadresser, mens rækkebyggeren samler den i én brugerrettet linje.
 */
function validateOevrigeKravRowCompleteness(
  row: OevrigeKravRow,
  index: number,
  assessment: OevrigeKravRowAssessment,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `oevrigeKravPerioder[${index}]`;
  const amountValue = amountValueToNumber(row.beloeb);

  if (assessment.kind !== 'empty' && assessment.kind !== 'ok') {
    for (const column of assessment.missingColumns) {
      if (column === 'udgiftTil') {
        errors.push({ path: `${prefix}.udgiftTil`, message: OEVRIGE_KRAV_UDGIFT_TIL_MANGLER_MESSAGE, severity: 'error' });
      } else if (column === 'beloeb') {
        errors.push({ path: `${prefix}.beloeb`, message: OEVRIGE_KRAV_BELOEB_MANGLER_MESSAGE, severity: 'error' });
      }
    }
  }
  if (amountValue !== undefined && (amountValue < 0 || Object.is(amountValue, -0))) {
    errors.push({ path: `${prefix}.beloeb`, message: 'Beløb kan ikke være negativt', severity: 'error' });
  }

  return errors;
}

// =============================================================================
// SAMLET VALIDATOR
// =============================================================================

const deduplicateValidationErrors = (errors: readonly ValidationError[]): ValidationError[] => {
  const seen = new Set<string>();
  return errors.filter((error) => {
    // Identiske path/besked/severity-kombinationer er samme brugerrettede fejl, også når to
    // uafhængige valideringslag opdager den samme ugyldige canonical værdi.
    const key = `${error.path}\u0000${error.message}\u0000${error.severity ?? 'error'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Samlet validator for Erstatningsopgørelse
 *
 * Kører alle validerings-lag sekventielt og kombinerer errors.
 * Sektions-valideringer kører uafhængigt, så alle fejl rapporteres samlet.
 */
type ErstatningsopgoerelseValidator = FormValidator<ErstatningsopgoerelseValues> & Readonly<{
  validateParsed(values: ErstatningsopgoerelseValues, options?: ErstatningsopgoerelseValidationOptions): ValidationResult;
}>;

export const erstatningsopgoerelseValidator: ErstatningsopgoerelseValidator = {
  validateParsed(values: ErstatningsopgoerelseValues, options?: ErstatningsopgoerelseValidationOptions): ValidationResult {
    const errors = deduplicateValidationErrors([
      ...validateCanonicalRanges(values),
      ...validateStandaloneRules(values),
      ...validateForligAnsvarsgrad(values),
      ...validateSvieSmerte(values),
      ...validateTAF(values, options),
      ...validateSygeferiegodtgoerelse(values),
      ...validateOevrigeKrav(values),
    ]);

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

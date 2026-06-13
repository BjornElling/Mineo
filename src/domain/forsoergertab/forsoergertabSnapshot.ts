import { maxISO, minISO } from '../../utils/isoDateHelpers';
import type {
  FaellesAarsloenValues,
  ForsoergertabValues,
  Koen,
  StamdataValues,
} from '../../schemas/formSchemas';
import { dateRanges_forsoergertab } from '../../config/dateRanges';
import type { FormFieldError } from '../../types/fieldErrors';
import { coerceToISODateString, type ISODateString } from '../../types/branded';
import { computeForsoergertabCalculation } from './forsoergertabCalculation';
import { PRE_2015_CUTOFF } from './forsoergertabConstants';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { asError } from '../../utils/typeGuards';
import type { ForsoergertabCalculationResult } from './forsoergertabTypes';
import { allowPdfDownload, blockPdfDownload, type PdfDownloadGateResult, type PdfDownloadGateReason } from '../../pdf/pdfGateTypes';

type FieldErrorMessage = Pick<FormFieldError, 'message'> | undefined;

type ForsoergertabFieldErrors = Readonly<{
  forsoergertab: Partial<Record<keyof ForsoergertabValues, FieldErrorMessage>>;
  faellesAarsloen: Partial<Record<keyof FaellesAarsloenValues, FieldErrorMessage>>;
  stamdata: Partial<Record<keyof StamdataValues, FieldErrorMessage>>;
}>;

export type ForsoergertabSnapshotInput = Readonly<{
  values: ForsoergertabValues;
  faellesAarsloen: FaellesAarsloenValues;
  stamdata: StamdataValues | null;
  fieldErrors: ForsoergertabFieldErrors;
}>;

type FieldUiState = Readonly<{
  hasError: boolean;
  helperText: string;
}>;

const EAL_AARSLOEN_ASL_MAX_ERROR_MESSAGE =
  'Når årsløn efter ASL svarer til maksimum, skal den faktiske årsløn indtastes.';

const EAL_AARSLOEN_ASL_MAX_ISSUE_IDS = ['warn-eal-aarsloen-is-max', 'warn-asl-aarsloen-is-max'] as const;

const createRuntimeExceptionCalculation = (error: unknown): ForsoergertabCalculationResult => {
  const normalizedError = asError(error);
  reportSystemIssue({
    code: 'forsoergertab_snapshot:runtime_exception',
    area: 'calculation',
    context: 'forsoergertabSnapshot.computeForsoergertabSnapshot',
    userMessage: 'Uventet runtimefejl i forsørgertabsberegning',
    developerMessage: normalizedError.message,
    error: normalizedError,
    diagnostics: {
      errorName: normalizedError.name,
    },
  });

  return {
    issues: [{
      id: 'runtime-exception',
      severity: 'error',
      message: 'Beregningen kan ikke gennemføres på grund af en intern beregningsfejl.',
    }],
    ealComputation: null,
    aslComputation: null,
    foersoergertabEalMinSats: null,
    foersoergertabForhoejtetTilMin: false,
    result: null,
  };
};

export type ForsoergertabPdfProjection = Readonly<{
  grundlaeggende: Readonly<{
    beregningsdato: ISODateString | undefined;
    skadelidteFodselsdato: ISODateString | undefined;
    efterladteFodselsdato: ISODateString | undefined;
    koen: Koen | undefined;
    visKoenValg: boolean;
    aslAarsloen: number | undefined;
    ealAarsloen: number | undefined;
    virkningsdato: ISODateString | undefined;
    tilkendtForPeriodeAar: number | undefined;
  }>;
  result: ForsoergertabCalculationResult['result'];
  ealComputation: ForsoergertabCalculationResult['ealComputation'];
  aslComputation: ForsoergertabCalculationResult['aslComputation'];
  foersoergertabEalMinSats: number | null;
  foersoergertabForhoejtetTilMin: boolean;
}>;

export type ForsoergertabSnapshot = Readonly<{
  calculation: ForsoergertabCalculationResult;
  visKoenValg: boolean;
  inputBounds: Readonly<{
    skadedatoMin: ISODateString;
    beregningsdatoMin: ISODateString;
    virkningsdatoMax: ISODateString;
  }>;
  fieldUi: Readonly<{
    beregningsdato: FieldUiState;
    beregningsdatoForEal: FieldUiState;
    efterladteFodselsdato: FieldUiState;
    virkningsdato: FieldUiState;
    koen: FieldUiState;
    tilkendtForPeriodeAar: FieldUiState;
    aslAarsloen: FieldUiState;
    ealAarsloen: FieldUiState;
    skadedato: FieldUiState;
    skadelidteFodselsdato: FieldUiState;
  }>;
  canShowEal: boolean;
  canShowAsl: boolean;
  canShowResult: boolean;
  pdfGate: PdfDownloadGateResult;
  pdfProjection: ForsoergertabPdfProjection;
}>;

const getIssueMessage = (
  issues: ForsoergertabCalculationResult['issues'],
  ids: readonly string[]
): string | undefined => {
  const message = issues.find((issue) => ids.includes(issue.id))?.message;
  return message && message.trim() !== '' ? message : undefined;
};

const hasIssue = (
  issues: ForsoergertabCalculationResult['issues'],
  ids: readonly string[]
): boolean => {
  return issues.some((issue) => ids.includes(issue.id));
};

const resolveHelperText = (
  fieldError: FieldErrorMessage,
  helperIssue: string | undefined
): string => {
  return fieldError?.message ?? helperIssue ?? '';
};

const createDownloadBlockingReason = (code: string, message: string): PdfDownloadGateReason => ({
  code: `forsoergertab:${code}`,
  message,
});

export const computeForsoergertabSnapshot = (input: ForsoergertabSnapshotInput): ForsoergertabSnapshot => {
  const { values, faellesAarsloen, stamdata, fieldErrors } = input;
  const skadedatoMin = coerceToISODateString(stamdata?.skadedato) ?? dateRanges_forsoergertab.virkningsdato.fallbackMin;
  const beregningsdatoMin = (() => {
    const virkningsdato = coerceToISODateString(values.virkningsdato);
    return virkningsdato ? maxISO(skadedatoMin, virkningsdato) : skadedatoMin;
  })();
  const virkningsdatoMax = (() => {
    const beregningsdato = coerceToISODateString(values.beregningsdato);
    const maxDato = dateRanges_forsoergertab.virkningsdato.max;
    return beregningsdato ? minISO(maxDato, beregningsdato) : maxDato;
  })();

  const calculation = (() => {
    try {
      return computeForsoergertabCalculation({
        skadedato: coerceToISODateString(stamdata?.skadedato),
        skadelidteFodselsdato: coerceToISODateString(stamdata?.skadelidteFodselsdato),
        efterladteFodselsdato: coerceToISODateString(values.efterladteFodselsdato),
        beregningsdato: coerceToISODateString(values.beregningsdato),
        virkningsdato: coerceToISODateString(values.virkningsdato),
        koen: values.koen,
        tilkendtForPeriodeAar: values.tilkendtForPeriodeAar,
        aslAarsloen: faellesAarsloen.aslAarsloen,
        ealAarsloen: faellesAarsloen.ealAarsloen,
      });
    } catch (error) {
      return createRuntimeExceptionCalculation(error);
    }
  })();

  const visKoenValg = (() => {
    const beregningsdato = coerceToISODateString(values.beregningsdato);
    return beregningsdato !== undefined && beregningsdato < PRE_2015_CUTOFF;
  })();

  const hasEalAarsloenAslMaxIssue = hasIssue(calculation.issues, EAL_AARSLOEN_ASL_MAX_ISSUE_IDS);
  const ealAarsloenBlockingIssue = getIssueMessage(calculation.issues, ['eal-aarsloen-zero']);
  const ealAarsloenHelperIssue =
    ealAarsloenBlockingIssue ?? (hasEalAarsloenAslMaxIssue ? EAL_AARSLOEN_ASL_MAX_ERROR_MESSAGE : undefined);

  const helperIssues = {
    efterladteFodselsdato: getIssueMessage(calculation.issues, ['forsoergertab-alder-unresolved', 'forsoergertab-alder-missing']),
    beregningsdato: getIssueMessage(calculation.issues, [
      'aarsloen-max-missing-beregningsaar',
      'beregningsdato-before-virkningsdato',
      'kapitaliseringsbekendtgoerelse-missing',
      'folkepensionsalder-unresolved',
      'forsoergertab-tabel-missing',
      'forsoergertab-tabel-rows-missing',
      'forsoergertab-faktor-unresolved',
      'runtime-exception',
    ]),
    beregningsdatoForEal: getIssueMessage(calculation.issues, [
      'aarsloen-max-missing-beregningsaar',
      'kapitaliseringsbekendtgoerelse-missing',
      'folkepensionsalder-unresolved',
      'forsoergertab-tabel-missing',
      'forsoergertab-tabel-rows-missing',
      'forsoergertab-faktor-unresolved',
    ]),
    virkningsdato: getIssueMessage(calculation.issues, ['beregningsdato-before-virkningsdato']),
    koen: getIssueMessage(calculation.issues, ['missing-koen']),
    tilkendtForPeriodeAar: getIssueMessage(calculation.issues, ['tilkendt-for-periode-invalid']),
    aslAarsloen: getIssueMessage(calculation.issues, ['asl-aarsloen-zero']),
    ealAarsloen: ealAarsloenHelperIssue,
    skadedato: getIssueMessage(calculation.issues, ['skadedato-missing', 'aarsloen-max-missing-skadesaar']),
  };

  const fieldUi = {
    beregningsdato: {
      hasError: Boolean(fieldErrors.forsoergertab.beregningsdato?.message || helperIssues.beregningsdato),
      helperText: resolveHelperText(fieldErrors.forsoergertab.beregningsdato, helperIssues.beregningsdato),
    },
    beregningsdatoForEal: {
      hasError: Boolean(fieldErrors.forsoergertab.beregningsdato?.message || helperIssues.beregningsdatoForEal),
      helperText: resolveHelperText(fieldErrors.forsoergertab.beregningsdato, helperIssues.beregningsdatoForEal),
    },
    efterladteFodselsdato: {
      hasError: Boolean(fieldErrors.forsoergertab.efterladteFodselsdato?.message || helperIssues.efterladteFodselsdato),
      helperText: resolveHelperText(fieldErrors.forsoergertab.efterladteFodselsdato, helperIssues.efterladteFodselsdato),
    },
    virkningsdato: {
      hasError: Boolean(fieldErrors.forsoergertab.virkningsdato?.message || helperIssues.virkningsdato),
      helperText: resolveHelperText(fieldErrors.forsoergertab.virkningsdato, helperIssues.virkningsdato),
    },
    koen: {
      hasError: Boolean(fieldErrors.forsoergertab.koen?.message || helperIssues.koen),
      helperText: resolveHelperText(fieldErrors.forsoergertab.koen, helperIssues.koen),
    },
    tilkendtForPeriodeAar: {
      hasError: Boolean(fieldErrors.forsoergertab.tilkendtForPeriodeAar?.message || helperIssues.tilkendtForPeriodeAar),
      helperText: resolveHelperText(fieldErrors.forsoergertab.tilkendtForPeriodeAar, helperIssues.tilkendtForPeriodeAar),
    },
    aslAarsloen: {
      hasError: Boolean(fieldErrors.faellesAarsloen.aslAarsloen?.message || helperIssues.aslAarsloen),
      helperText: resolveHelperText(fieldErrors.faellesAarsloen.aslAarsloen, helperIssues.aslAarsloen),
    },
    ealAarsloen: {
      hasError: Boolean(fieldErrors.faellesAarsloen.ealAarsloen?.message || helperIssues.ealAarsloen),
      helperText: resolveHelperText(fieldErrors.faellesAarsloen.ealAarsloen, helperIssues.ealAarsloen),
    },
    skadedato: {
      hasError: Boolean(fieldErrors.stamdata.skadedato?.message || helperIssues.skadedato),
      helperText: resolveHelperText(fieldErrors.stamdata.skadedato, helperIssues.skadedato),
    },
    skadelidteFodselsdato: {
      hasError: Boolean(fieldErrors.stamdata.skadelidteFodselsdato?.message),
      helperText: fieldErrors.stamdata.skadelidteFodselsdato?.message ?? '',
    },
  } as const;

  const hasBlockingEalAarsloenError =
    Boolean(fieldErrors.faellesAarsloen.ealAarsloen?.message) || Boolean(ealAarsloenBlockingIssue);

  // Beslutningsnote: Max-årslønsfejlen på EAL-årslønnen er bevidst ikke download- eller
  // beregningsblokerende. Feltet skal markeres rødt, fordi ASL-maksimum oftest betyder, at den
  // faktiske EAL-årsløn mangler. Forsørgertab har dog den sjældne legitime situation, at den
  // faktiske EAL-årsløn faktisk er præcis ASL-maksimum i skadesåret. Hvis denne UI-fejl blokerede
  // PDF eller beregning, ville brugeren ikke kunne færdiggøre en korrekt forsørgertabsberegning i
  // netop de sager. Derfor blokerer kun egentlige commit-/beregningsfejl her; denne konkrete
  // max-årslønsmarkering er en auditabel opmærksomhedsfejl, ikke en stop-fejl.
  const canShowEal =
    Boolean(values.beregningsdato) &&
    !fieldUi.skadelidteFodselsdato.hasError &&
    !fieldUi.beregningsdatoForEal.hasError &&
    !fieldUi.skadedato.hasError &&
    !hasBlockingEalAarsloenError &&
    calculation.ealComputation !== null;

  const canShowAsl =
    Boolean(stamdata?.skadelidteFodselsdato) &&
    Boolean(values.efterladteFodselsdato) &&
    Boolean(values.beregningsdato) &&
    !fieldUi.efterladteFodselsdato.hasError &&
    !fieldUi.beregningsdato.hasError &&
    !fieldUi.skadedato.hasError &&
    Boolean(faellesAarsloen.aslAarsloen) &&
    Boolean(values.virkningsdato) &&
    values.tilkendtForPeriodeAar !== undefined &&
    !fieldUi.aslAarsloen.hasError &&
    !fieldUi.virkningsdato.hasError &&
    !fieldUi.tilkendtForPeriodeAar.hasError &&
    !fieldUi.koen.hasError &&
    calculation.aslComputation !== null;

  const canShowResult = canShowEal && canShowAsl && calculation.result !== null;
  const hasDownloadBlockingFieldError =
    fieldUi.beregningsdato.hasError ||
    fieldUi.beregningsdatoForEal.hasError ||
    fieldUi.efterladteFodselsdato.hasError ||
    fieldUi.virkningsdato.hasError ||
    fieldUi.koen.hasError ||
    fieldUi.tilkendtForPeriodeAar.hasError ||
    fieldUi.aslAarsloen.hasError ||
    hasBlockingEalAarsloenError ||
    fieldUi.skadedato.hasError ||
    fieldUi.skadelidteFodselsdato.hasError;
  const pdfGate = (() => {
    const reasons: PdfDownloadGateReason[] = [];
    if (!canShowEal && !canShowAsl) {
      reasons.push(createDownloadBlockingReason('no-pdf-projection', 'Der er ikke beregnet en PDF-klar EAL- eller ASL-del.'));
    }
    if (hasDownloadBlockingFieldError) {
      reasons.push(createDownloadBlockingReason('blocking-input-error', 'Et eller flere nødvendige felter har blokerende fejl.'));
    }
    if (reasons.length === 0) {
      return allowPdfDownload();
    }
    const [firstReason, ...additionalReasons] = reasons;
    return {
      ...blockPdfDownload(firstReason),
      reasons: [firstReason, ...additionalReasons],
    };
  })();

  return {
    calculation,
    visKoenValg,
    inputBounds: {
      skadedatoMin,
      beregningsdatoMin,
      virkningsdatoMax,
    },
    fieldUi,
    canShowEal,
    canShowAsl,
    canShowResult,
    pdfGate,
    pdfProjection: {
      grundlaeggende: {
        beregningsdato: coerceToISODateString(values.beregningsdato),
        skadelidteFodselsdato: coerceToISODateString(stamdata?.skadelidteFodselsdato),
        efterladteFodselsdato: coerceToISODateString(values.efterladteFodselsdato),
        koen: values.koen,
        visKoenValg,
        aslAarsloen: faellesAarsloen.aslAarsloen?.value,
        ealAarsloen: faellesAarsloen.ealAarsloen?.value,
        virkningsdato: coerceToISODateString(values.virkningsdato),
        tilkendtForPeriodeAar: values.tilkendtForPeriodeAar,
      },
      result: canShowResult ? calculation.result : null,
      ealComputation: canShowEal ? calculation.ealComputation : null,
      aslComputation: canShowAsl ? calculation.aslComputation : null,
      foersoergertabEalMinSats: calculation.foersoergertabEalMinSats,
      foersoergertabForhoejtetTilMin: calculation.foersoergertabForhoejtetTilMin,
    },
  };
};

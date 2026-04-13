import type {
  FaellesAarsloenValues,
  ForsoergertabValues,
  Koen,
  StamdataValues,
} from '../../schemas/formSchemas';
import type { FormFieldError } from '../../types/fieldErrors';
import { coerceToISODateString, type ISODateString } from '../../types/branded';
import { computeForsoergertabCalculation } from './forsoergertabCalculation';
import { PRE_2015_CUTOFF } from './forsoergertabConstants';

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
  result: ReturnType<typeof computeForsoergertabCalculation>['result'];
  ealComputation: ReturnType<typeof computeForsoergertabCalculation>['ealComputation'];
  aslComputation: ReturnType<typeof computeForsoergertabCalculation>['aslComputation'];
  foersoergertabEalMinSats: number | null;
  foersoergertabForhoejtetTilMin: boolean;
}>;

export type ForsoergertabSnapshot = Readonly<{
  calculation: ReturnType<typeof computeForsoergertabCalculation>;
  visKoenValg: boolean;
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
  canDownloadPdf: boolean;
  pdfProjection: ForsoergertabPdfProjection;
}>;

const getIssueMessage = (
  issues: ReturnType<typeof computeForsoergertabCalculation>['issues'],
  ids: readonly string[]
): string | undefined => {
  const message = issues.find((issue) => ids.includes(issue.id))?.message;
  return message && message.trim() !== '' ? message : undefined;
};

const resolveHelperText = (
  fieldError: FieldErrorMessage,
  helperIssue: string | undefined
): string => {
  return fieldError?.message ?? helperIssue ?? '';
};

export const computeForsoergertabSnapshot = (input: ForsoergertabSnapshotInput): ForsoergertabSnapshot => {
  const { values, faellesAarsloen, stamdata, fieldErrors } = input;

  const calculation = computeForsoergertabCalculation({
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

  const visKoenValg = (() => {
    const beregningsdato = coerceToISODateString(values.beregningsdato);
    return beregningsdato !== undefined && beregningsdato < PRE_2015_CUTOFF;
  })();

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
    ealAarsloen: getIssueMessage(calculation.issues, ['eal-aarsloen-zero']),
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

  const canShowEal =
    Boolean(values.beregningsdato) &&
    !fieldUi.skadelidteFodselsdato.hasError &&
    !fieldUi.beregningsdatoForEal.hasError &&
    !fieldUi.skadedato.hasError &&
    !fieldUi.ealAarsloen.hasError &&
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
  const canDownloadPdf = canShowEal || canShowAsl;

  return {
    calculation,
    visKoenValg,
    fieldUi,
    canShowEal,
    canShowAsl,
    canShowResult,
    canDownloadPdf,
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

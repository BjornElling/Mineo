import type {
  ErhvervsevnetabComposedValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../schemas/formSchemas';
import {
  evaluateForligsgrad,
  type ForligAnsvarsgradInput,
} from '../erstatningsopgoerelse/engines/forligsgrad';
import type { FormFieldError } from '../../types/fieldErrors';
import type { ISODateString } from '../../types/branded';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import {
  aarsloenAslMax,
  erhvervsevnetabEalMax,
  reguleringssats,
} from '../../data/lovbestemteRates';
import { computeEetDifferencekravCalculation } from './eetDifferencekravCalculation';
import { computeEetEalCalculation } from './eetEalCalculation';
import { navigationSortKey, toFieldIssue } from './eetFormatUtils';
import { computeEetKapitaliseringCalculation } from './eetKapitaliseringCalculation';
import { computeEetLoebendeYdelser } from './eetLoebendeYdelserCalculation';
import type { EetIssue } from './eetTypes';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { asError } from '../../utils/typeGuards';

type FieldErrorMessage = Pick<FormFieldError, 'message'> | undefined;

type EetFieldErrors = Readonly<{
  stamdata: Partial<Record<keyof StamdataValues, FieldErrorMessage>>;
  erhvervsevnetab: Partial<Record<string, FieldErrorMessage>>;
  faellesAarsloen: Partial<Record<keyof FaellesAarsloenValues, FieldErrorMessage>>;
}>;

// Forlig om ansvarsgrad er delt kilde med EO-fanen (felterne bor i erstatningsopgoerelse-sektionen).
// `hasInvalidDraft` afspejler en ikke-committbar rå draft i et af forligs-felterne (læst fra
// invalidDrafts-storen på siden) — committede værdier er altid schema-gyldige, så et "ugyldigt
// input" kan kun observeres via denne kanal og via evaluateForligsgrad ("begge udfyldt"/brøk > 1).
export type EetForligInput = Readonly<{
  values: ForligAnsvarsgradInput;
  // Forligsdato (delt kilde med EO) — kun til prosa-sætningen i specifikationen. Udeladt = ingen dato.
  dato?: ISODateString;
  hasInvalidDraft: boolean;
}>;

export type EetSnapshotInput = Readonly<{
  values: ErhvervsevnetabComposedValues;
  stamdata: StamdataValues | null;
  fieldErrors: EetFieldErrors;
  // Udeladt = intet forlig (bagudkompatibelt for eksisterende kald/tests).
  forlig?: EetForligInput;
}>;

type EetTabProjection<TComputation> = Readonly<{
  issues: readonly EetIssue[];
  hasBlockingErrors: boolean;
  computation: TComputation | null;
}>;

export type EetSnapshot = Readonly<{
  loebendeYdelser: EetTabProjection<ReturnType<typeof computeEetLoebendeYdelser>['computation']>;
  kapitalisering: EetTabProjection<ReturnType<typeof computeEetKapitaliseringCalculation>['computation']>;
  efterEal: EetTabProjection<ReturnType<typeof computeEetEalCalculation>['computation']>;
  differencekrav: EetTabProjection<ReturnType<typeof computeEetDifferencekravCalculation>['computation']>;
}>;

const sortAndDedupeIssues = (issues: readonly EetIssue[]): readonly EetIssue[] => {
  return dedupeIssuesBySeverityAndMessage([...issues]).sort(
    (a, b) => navigationSortKey(a.id) - navigationSortKey(b.id)
  );
};

const createRuntimeExceptionIssue = (message: string): readonly EetIssue[] => [{
  id: 'runtime-exception',
  severity: 'error',
  message,
}];

const safeBuildProjection = <TComputation>(
  build: () => EetTabProjection<TComputation>,
  context: string
): EetTabProjection<TComputation> => {
  try {
    return build();
  } catch (error) {
    const normalizedError = asError(error);
    reportSystemIssue({
      code: `eet_snapshot:${context}`,
      area: 'calculation',
      context: `eetSnapshot.${context}`,
      userMessage: 'Uventet runtimefejl i EET-beregning',
      developerMessage: normalizedError.message,
      error: normalizedError,
      diagnostics: {
        errorName: normalizedError.name,
      },
    });
    return {
      issues: createRuntimeExceptionIssue('Beregningen kan ikke gennemføres på grund af en intern beregningsfejl.'),
      hasBlockingErrors: true,
      computation: null,
    };
  }
};

const createFieldIssues = (
  fieldErrors: EetFieldErrors,
  ids: ReadonlyArray<Readonly<{ id: string; message: string | undefined }>>
): readonly EetIssue[] => {
  return ids
    .map(({ id, message }) => toFieldIssue(id, message))
    .filter((issue): issue is EetIssue => issue !== null);
};

const buildLoebendeYdelserProjection = (input: EetSnapshotInput): EetSnapshot['loebendeYdelser'] => {
  const calculationResult = computeEetLoebendeYdelser({
    erhvervsevnetab: input.values,
    skadedato: input.stamdata?.skadedato,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
  });

  const fieldIssues = createFieldIssues(input.fieldErrors, [
    { id: 'field-beregningsdato', message: input.fieldErrors.erhvervsevnetab.beregningsdato?.message },
    { id: 'field-aarsloen-asl', message: input.fieldErrors.faellesAarsloen.aslAarsloen?.message },
    { id: 'field-asl-afgoerelser', message: input.fieldErrors.erhvervsevnetab.aslAfgoerelser?.message },
    { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
    { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
  ]);

  const issues = sortAndDedupeIssues([...calculationResult.issues, ...fieldIssues]);
  return {
    issues,
    hasBlockingErrors: issues.some((issue) => issue.severity === 'error'),
    computation: calculationResult.computation,
  };
};

const buildKapitaliseringProjection = (input: EetSnapshotInput): EetSnapshot['kapitalisering'] => {
  const calculationResult = computeEetKapitaliseringCalculation({
    erhvervsevnetab: input.values,
    skadedato: input.stamdata?.skadedato,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
  });

  const fieldIssues = createFieldIssues(input.fieldErrors, [
    { id: 'field-aarsloen-asl', message: input.fieldErrors.faellesAarsloen.aslAarsloen?.message },
    { id: 'field-asl-afgoerelser', message: input.fieldErrors.erhvervsevnetab.aslAfgoerelser?.message },
    { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
    { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
  ]);

  const issues = sortAndDedupeIssues([...calculationResult.issues, ...fieldIssues]);
  return {
    issues,
    hasBlockingErrors: issues.some((issue) => issue.severity === 'error'),
    computation: calculationResult.computation,
  };
};

const buildEfterEalProjection = (input: EetSnapshotInput): EetSnapshot['efterEal'] => {
  const calculationResult = computeEetEalCalculation({
    erhvervsevnetab: input.values,
    skadedato: input.stamdata?.skadedato,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
    reguleringssats,
    erhvervsevnetabEalMax,
    aarsloenAslMax,
  });

  const fieldIssues = createFieldIssues(input.fieldErrors, [
    { id: 'field-beregningsdato', message: input.fieldErrors.erhvervsevnetab.beregningsdato?.message },
    { id: 'field-eal-eet-pct', message: input.fieldErrors.erhvervsevnetab.ealEetPct?.message },
    { id: 'field-aarsloen-eal', message: input.fieldErrors.faellesAarsloen.ealAarsloen?.message },
    { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
    { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
  ]);

  const issues = sortAndDedupeIssues([...calculationResult.issues, ...fieldIssues]);
  return {
    issues,
    hasBlockingErrors: issues.some((issue) => issue.severity === 'error'),
    computation: calculationResult.computation,
  };
};

// Forlig om ansvarsgrad-fejl (delt kilde med EO-fanen). Et ugyldigt forlig — "begge udfyldt",
// en brøk over 1, eller et ikke-committbart rå draft — skal blokere hele differencekrav-outputtet.
const resolveForligBlocking = (forlig: EetForligInput | undefined): Readonly<{
  forligFactor: Parameters<typeof computeEetDifferencekravCalculation>[0]['forlig'];
  issue: EetIssue | null;
}> => {
  if (!forlig) return { forligFactor: null, issue: null };
  const evaluation = evaluateForligsgrad(forlig.values);
  if (forlig.hasInvalidDraft) {
    return {
      forligFactor: null,
      issue: { id: 'forlig-ansvarsgrad-invalid', severity: 'error', message: 'Forlig om ansvarsgrad indeholder en ugyldig værdi.' },
    };
  }
  if (evaluation.status === 'invalid') {
    return {
      forligFactor: null,
      issue: { id: 'forlig-ansvarsgrad-invalid', severity: 'error', message: `Forlig om ansvarsgrad: ${evaluation.message}.` },
    };
  }
  return { forligFactor: evaluation.status === 'valid' ? evaluation.forlig : null, issue: null };
};

const buildDifferencekravProjection = (input: EetSnapshotInput): EetSnapshot['differencekrav'] => {
  const forligBlocking = resolveForligBlocking(input.forlig);

  const calculationResult = computeEetDifferencekravCalculation({
    erhvervsevnetab: input.values,
    skadedato: input.stamdata?.skadedato,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
    endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft:
      input.values.endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft,
    indregnMerErstatningVedForhoejetPensionsalder:
      input.values.indregnMerErstatningVedForhoejetPensionsalder,
    forlig: forligBlocking.forligFactor,
    forligDato: input.forlig?.dato,
  });

  const fieldIssues = createFieldIssues(input.fieldErrors, [
    { id: 'field-beregningsdato', message: input.fieldErrors.erhvervsevnetab.beregningsdato?.message },
    { id: 'field-aarsloen-asl', message: input.fieldErrors.faellesAarsloen.aslAarsloen?.message },
    { id: 'field-asl-afgoerelser', message: input.fieldErrors.erhvervsevnetab.aslAfgoerelser?.message },
    { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
    { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
  ]);

  const issues = sortAndDedupeIssues([
    ...calculationResult.issues,
    ...fieldIssues,
    ...(forligBlocking.issue ? [forligBlocking.issue] : []),
  ]);
  // calculationResult.hasBlockingErrors indgår her fordi eetDifferencekravCalculation har en
  // EAL-afhængighed der kan blokere beregningen (og sætte computation = null) uden at
  // producere et issue med severity 'error' — blocking opdages da ikke af issues.some() alene.
  // De øvrige projektioner har ikke denne afhængighed og kan nøjes med issues.some().
  return {
    issues,
    hasBlockingErrors: calculationResult.hasBlockingErrors || issues.some((issue) => issue.severity === 'error'),
    computation: calculationResult.computation,
  };
};

// Bemærk: Row-level valideringsfejl på individuelle ASL-afgørelsesrækker indgår IKKE i
// snapshot-issuerne. De beregnes i Erhvervsevnetab.tsx og rapporteres til error-bus via
// useEffect. Kun den første tabelblokerende fejl vises i EetIssuesBox; øvrige row-fejl
// vises inline i tabellen. Dette er en bevidst afgrænsning: snapshot håndterer
// feltvalidering, ikke tabelrækkernes indbyrdes konsistens.
export const computeEetSnapshot = (input: EetSnapshotInput): EetSnapshot => {
  return {
    loebendeYdelser: safeBuildProjection(() => buildLoebendeYdelserProjection(input), 'loebende_ydelser'),
    kapitalisering: safeBuildProjection(() => buildKapitaliseringProjection(input), 'kapitalisering'),
    efterEal: safeBuildProjection(() => buildEfterEalProjection(input), 'efter_eal'),
    differencekrav: safeBuildProjection(() => buildDifferencekravProjection(input), 'differencekrav'),
  };
};

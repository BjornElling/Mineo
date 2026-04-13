import type {
  ErhvervsevnetabComposedValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../schemas/formSchemas';
import type { FormFieldError } from '../../types/fieldErrors';
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

type FieldErrorMessage = Pick<FormFieldError, 'message'> | undefined;

type EetFieldErrors = Readonly<{
  stamdata: Partial<Record<keyof StamdataValues, FieldErrorMessage>>;
  erhvervsevnetab: Partial<Record<string, FieldErrorMessage>>;
  faellesAarsloen: Partial<Record<keyof FaellesAarsloenValues, FieldErrorMessage>>;
}>;

export type EetSnapshotInput = Readonly<{
  values: ErhvervsevnetabComposedValues;
  stamdata: StamdataValues | null;
  fieldErrors: EetFieldErrors;
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

const buildDifferencekravProjection = (input: EetSnapshotInput): EetSnapshot['differencekrav'] => {
  const calculationResult = computeEetDifferencekravCalculation({
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
    loebendeYdelser: buildLoebendeYdelserProjection(input),
    kapitalisering: buildKapitaliseringProjection(input),
    efterEal: buildEfterEalProjection(input),
    differencekrav: buildDifferencekravProjection(input),
  };
};

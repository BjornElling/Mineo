import { z } from 'zod';
import type { ErhvervsevnetabComposedValues } from '../../schemas/formSchemas';
import { isoDateString } from '../../schemas/formSchemas/baseSchemas';
import type { ISODateString } from '../../types/branded';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { asError } from '../../utils/typeGuards';
import type { InputEvaluation } from '../../inputCore/inputReader';
import { STAMDATA_DATE_ORDER_ERROR_MESSAGE } from '../stamdata/stamdataDateOrder';
import { buildErhvervsevnetabReaderProjection } from './erhvervsevnetabReaderProjection';
import { eetIssueSchema, type EetIssue } from './eetTypes';
import { isAslAfgoerelseRowEmpty } from './eetAslAfgoerelser';
import {
  computeEetLoebendeYdelserForEoImport,
  EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS,
  eetLoebendePeriodeRowSchema,
} from './eetLoebendeYdelserCalculation';

const eetImportGroupSchema = z.object({
  afgoerelsesdato: isoDateString,
  eetPct: z.number().finite(),
  perioder: z.array(eetLoebendePeriodeRowSchema).readonly(),
}).strict().readonly();

export const eetImportContextSchema = z.object({
  revision: z.string().min(1),
  groups: z.array(eetImportGroupSchema).readonly(),
  issues: z.array(eetIssueSchema).readonly(),
}).strict().readonly();

export type EetImportContext = z.infer<typeof eetImportContextSchema>;

export type EetImportSource = Readonly<{
  revision: string;
  eetValues: ErhvervsevnetabComposedValues;
  skadedato: ISODateString | undefined;
  issues?: readonly EetIssue[];
}>;

const hasFieldIssueInSection = (
  evaluation: InputEvaluation,
  section: 'stamdata' | 'erhvervsevnetab' | 'faellesAarsloen'
): boolean => evaluation.issues.all.some((issue) => issue.field.address.section === section);

/** Bygger den eneste EO-læsning af EET-input fra et tokenbundet reader-snapshot. */
export const buildMidlertidigtEetInsertSource = (evaluation: InputEvaluation): EetImportSource => {
  const projection = buildErhvervsevnetabReaderProjection(evaluation.reader);
  const sourceIssues: EetIssue[] = [];

  if (hasFieldIssueInSection(evaluation, 'erhvervsevnetab')) {
    sourceIssues.push({
      id: 'midlertidigt-eet-source-schema-invalid',
      severity: 'error',
      message: 'Afgørelsen er ikke gyldigt udfyldt.',
    });
  }
  if (hasFieldIssueInSection(evaluation, 'faellesAarsloen')) {
    sourceIssues.push({
      id: 'midlertidigt-eet-faelles-aarsloen-schema-invalid',
      severity: 'error',
      message: 'Årslønnen er ikke gyldigt udfyldt.',
    });
  }
  const hasStamdataDateOrderIssue = evaluation.issues.all.some(
    (issue) => issue.code === 'stamdata.skadedato.bounds'
      && issue.message.toLocaleLowerCase('da').includes('fødselsdato')
  );
  if (hasStamdataDateOrderIssue) {
    sourceIssues.push({
      id: 'midlertidigt-eet-stamdata-date-order',
      severity: 'error',
      message: STAMDATA_DATE_ORDER_ERROR_MESSAGE,
    });
  } else if (hasFieldIssueInSection(evaluation, 'stamdata')) {
    sourceIssues.push({
      id: 'midlertidigt-eet-stamdata-schema-invalid',
      severity: 'error',
      message: 'Stamdata kunne ikke valideres og kan derfor ikke importeres som midlertidigt EET.',
    });
  }

  return Object.freeze({
    revision: `input-${String(evaluation.reader.sourceToken.inputRevision)}-settings-${String(evaluation.reader.sourceToken.settingsRevision)}`,
    eetValues: projection.values,
    skadedato: projection.skadedato,
    ...(sourceIssues.length === 0 ? {} : { issues: Object.freeze(sourceIssues) }),
  });
};

const failedContext = (
  revision: string,
  issue: EetIssue
): EetImportContext => eetImportContextSchema.parse({
  revision,
  groups: [],
  issues: [issue],
});

export const buildEetImportContext = (
  source: EetImportSource,
  slutdato: ISODateString
): EetImportContext => {
  if (source.issues && source.issues.length > 0) {
    return eetImportContextSchema.parse({
      revision: source.revision,
      groups: [],
      issues: source.issues,
    });
  }

  const hasImportRelevantRow = source.eetValues.aslAfgoerelser.some((row) =>
    !isAslAfgoerelseRowEmpty(row)
    && (row.afgoerelseType === 'Midlertidig' || row.afgoerelseType === 'Delvist endelig')
  );
  if (!hasImportRelevantRow) {
    return eetImportContextSchema.parse({
      revision: source.revision,
      groups: [],
      issues: [],
    });
  }

  try {
    // Importen er en særskilt canonical context: TAF-slutdatoen afgrænser ydelsen og kan
    // erstatte en manglende EET-beregningsdato. Selve beregningskernen er den samme som siden.
    const result = computeEetLoebendeYdelserForEoImport({
      erhvervsevnetab: source.eetValues,
      skadedato: source.skadedato,
      skadelidteFodselsdato: source.eetValues.skadelidteFodselsdato,
      slutdato,
    });
    const issues = result.issues.filter(
      (issue) => !EET_LOEBENDE_BEREGNINGSDATO_RELATIVE_WARNING_IDS.has(issue.id)
    );
    const groups = (result.computation?.afgoerelser ?? []).flatMap((afgoerelse) => {
      if (afgoerelse.afgoerelseType === 'Endelig') return [];
      if (afgoerelse.afgoerelseType !== 'Midlertidig' && afgoerelse.afgoerelseType !== 'Delvist endelig') {
        throw new Error('Ukendt EET-afgørelsestype i midlertidigt EET-import');
      }
      return afgoerelse.perioder.length === 0 ? [] : [{
        afgoerelsesdato: afgoerelse.afgoerelsesdato,
        eetPct: afgoerelse.eetPct,
        perioder: afgoerelse.perioder,
      }];
    });

    const parsed = eetImportContextSchema.safeParse({
      revision: source.revision,
      groups,
      issues,
    });
    if (parsed.success) return parsed.data;
    throw new Error(parsed.error.message);
  } catch (error) {
    const normalizedError = asError(error);
    reportSystemIssue({
      code: 'eet_import_port:runtime',
      area: 'calculation',
      context: 'eetImportPort.buildEetImportContext',
      userMessage: 'Uventet fejl i EET-importen',
      developerMessage: normalizedError.message,
      error: normalizedError,
    });
    return failedContext(source.revision, {
      id: 'midlertidigt-eet-import-invariant',
      severity: 'error',
      message: 'EET-oplysningerne kunne ikke klargøres sikkert til Erstatningsopgørelsen.',
    });
  }
};

export const buildUnavailableEetImportContext = (
  source: EetImportSource | null | undefined,
  reason: 'source_missing' | 'taf_slutdato_missing'
): EetImportContext => {
  const manglerEetBeregningsdato = source !== null
    && source !== undefined
    && !source.eetValues.beregningsdato;
  const issue: EetIssue = reason === 'source_missing'
    ? {
      id: 'midlertidigt-eet-source-missing',
      severity: 'error',
      message: 'EET-oplysningerne kunne ikke indlæses sikkert til Erstatningsopgørelsen.',
    }
    : manglerEetBeregningsdato
      ? {
        id: 'beregningsdato-missing',
        severity: 'error',
        message: 'Beregningsdato er ikke udfyldt',
      }
      : {
        id: 'midlertidigt-eet-slutdato-missing',
        severity: 'error',
        message: 'Midlertidigt EET kan ikke importeres, fordi erstatningsperiodens slutdato mangler.',
      };
  return failedContext(source?.revision ?? 'missing-source', issue);
};

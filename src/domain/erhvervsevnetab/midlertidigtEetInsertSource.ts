/**
 * EO's importkilde for midlertidigt EET — ren domænelogik, uden React (Fase 5, pass 0).
 *
 * Lå tidligere i `src/hooks/useMidlertidigtEetInsertSource.ts` sammen med sin hook. Builderen var
 * altid ren, men FILEN importerede React og `useInputEvaluation`, så enhver ikke-React-konsument
 * trak hele hook-grafen med sig. Det blev et problem, da EO's dokumentdefinition begyndte at kalde
 * builderen: definitionen ville dermed statisk afhænge af React gennem et hook-modul, som den
 * hverken bruger eller må afhænge af.
 *
 * Builderen bor derfor her, og hooken importerer den. Ingen adfærdsændring — koden er flyttet uændret.
 */
import type { EetImportSource } from './eetImportPort';
import type { EetIssue } from './eetTypes';
import { buildErhvervsevnetabReaderProjection } from './erhvervsevnetabReaderProjection';
import { STAMDATA_DATE_ORDER_ERROR_MESSAGE } from '../stamdata/stamdataDateOrder';
import type { InputEvaluation } from '../../inputCore/inputReader';

const hasFieldIssueInSection = (
  evaluation: InputEvaluation,
  section: 'stamdata' | 'erhvervsevnetab' | 'faellesAarsloen'
): boolean => evaluation.issues.all.some((issue) => issue.field.address.section === section);

/**
 * Bygger EO-importkilden fra den samme tokenbundne reader som EET-siden. Dermed kan en rejected værdi aldrig
 * omgå readerens feltissues via den gamle rå persistence-store, og EO ser præcis samme afsluttede revision som
 * den øvrige greenfield-runtime.
 */
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
    (issue) => issue.code === 'stamdata.skadedato.bounds' && issue.message.toLocaleLowerCase('da').includes('fødselsdato')
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

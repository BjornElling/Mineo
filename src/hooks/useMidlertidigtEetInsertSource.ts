import React from 'react';
import type { EetImportSource } from '../domain/erhvervsevnetab/eetImportPort';
import type { EetIssue } from '../domain/erhvervsevnetab/eetTypes';
import { buildErhvervsevnetabReaderProjection } from '../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { STAMDATA_DATE_ORDER_ERROR_MESSAGE } from '../domain/stamdata/stamdataDateOrder';
import type { InputEvaluation } from '../inputCore/inputReader';
import { useInputEvaluation } from '../inputCore/react';

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

export const useMidlertidigtEetInsertSource = (): EetImportSource => {
  const evaluation = useInputEvaluation();
  return React.useMemo(() => buildMidlertidigtEetInsertSource(evaluation), [evaluation]);
};

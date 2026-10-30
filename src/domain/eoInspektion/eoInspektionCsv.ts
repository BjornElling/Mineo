import { formatCurrency } from '../../utils/formatUtils';
import { CSV_DELIMITER, escapeCsvCell, toCsvScalar } from './csvUtils';
import type { EOInspektionModel } from './eoInspektionKontrolModel';
import { isAmountColumnId, parseEmploymentIndexFromColumnId } from './eoInspektionLoenTypes';

/** Byte order mark, så dansk Excel læser filen som UTF-8. */
const UTF8_BOM = String.fromCharCode(0xfeff);

/** Titlen i CSV-filens navn: `{journalnr} - Kontroltabel.csv` efter dokumenternes filnavnsregel (BB-382). */
export const KONTROLTABEL_CSV_TITEL = 'Kontroltabel';

/**
 * Kolonnenavnene i CSV-filen.
 *
 * På skærmen står ansættelsesforholdets navn som gruppeoverskrift over dets kolonner; den overskrift findes ikke i
 * en CSV-fil. Med to ansættelsesforhold stod «Løn», «Samlet løn» osv. derfor to gange uden at sige, hvilket
 * ansættelsesforhold de hørte til, og et regneark, der slår op på kolonnenavn, tog den første (BB-381). Navnet
 * står nu foran hver af ansættelsesforholdets kolonner: «Fiktivt arbejdssted – Løn».
 *
 * Har to ansættelsesforhold samme navn, får de deres nummer bag navnet, så kolonnenavnene stadig er entydige.
 */
export const buildKontrolTabelCsvHeaders = (
  columns: EOInspektionModel['columns'],
  resolveEmploymentName: (employmentIndex: number) => string
): readonly string[] => {
  const employmentIndexes = Array.from(new Set(
    columns
      .map((column) => parseEmploymentIndexFromColumnId(column.id))
      .filter((index): index is number => index !== null)
  ));
  const names = new Map(employmentIndexes.map((index) => [index, resolveEmploymentName(index).trim()]));
  const nameCounts = new Map<string, number>();
  for (const name of names.values()) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  const entydigtNavn = (index: number): string => {
    const name = names.get(index) ?? '';
    return (nameCounts.get(name) ?? 0) > 1 ? `${name} (${index + 1})` : name;
  };

  return columns.map((column) => {
    const employmentIndex = parseEmploymentIndexFromColumnId(column.id);
    return employmentIndex === null ? column.name : `${entydigtNavn(employmentIndex)} – ${column.name}`;
  });
};

/**
 * Hele CSV-filen: UTF-8 med BOM, semikolon og CRLF, så den åbner korrekt i dansk Excel.
 *
 * Beløbsceller formateres fra modellens rå tal med den kanoniske `formatCurrency` og spejler tabellens visning
 * (0 → tom celle), så filen er identisk med skærmen uden at parse den allerede formaterede streng.
 */
export const buildKontrolTabelCsv = (
  model: EOInspektionModel,
  resolveEmploymentName: (employmentIndex: number) => string
): string => {
  const lines: string[] = [
    buildKontrolTabelCsvHeaders(model.columns, resolveEmploymentName).map(escapeCsvCell).join(CSV_DELIMITER),
  ];

  for (let rowIndex = 0; rowIndex < model.rowCount; rowIndex += 1) {
    const cells = model.columns.map((column) => {
      if (isAmountColumnId(column.id)) {
        const rawValue = model.columnRawValues.get(column.id)?.[rowIndex];
        return escapeCsvCell(rawValue === undefined || rawValue === 0 ? '' : formatCurrency(rawValue));
      }
      return escapeCsvCell(toCsvScalar(column.getCell(rowIndex)));
    });
    lines.push(cells.join(CSV_DELIMITER));
  }

  return `${UTF8_BOM}${lines.join('\r\n')}`;
};

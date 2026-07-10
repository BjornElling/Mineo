/**
 * PDF Generator for Procesrente – oversigt
 *
 * Genererer en samlet oversigt over alle udfyldte renteberegninger:
 * én tabel med beløb, rentedato (Rente fra) og beregnet rente pr. linje
 * samt en sammentalt i alt-linje.
 */

import { formatAmount } from '../../layout/documentLayoutHelpers';
import type { DocumentWriter } from '../../writer';
import {
  buildStamdataBrevhovedData,
  initStandardDocumentWriter,
  type StandardDocumentMetadata,
} from '../documentGeneratorSetup';
import { buildSummedTotalRowSpec, renderTableSpec, type ColumnSpec, type RowSpec } from '../../layout/tableSpec';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import type { DocumentCommonOptions, DocumentStamdata } from '../../layout/documentOptions';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { parseISODate, type ISODateString } from '../../../types/branded';
import { addCalculationPrinciples, addHypotheticalInterestWarning } from './renteDocument';

const PDF_TITLE = 'Procesrente – oversigt';

/**
 * Én linje i oversigten, projiceret fra en gyldig renteberegning.
 */
export type RenteOversigtRow = Readonly<{
  beloeb: number;
  renterFra: ISODateString;
  beregnetRente: number;
}>;

type RenteOversigtDocumentOptions = DocumentCommonOptions & Readonly<{
  stamdata?: DocumentStamdata | null;
  kommentarer?: string;
  latestReferenceRateDate?: ISODateString | null;
  metadata?: StandardDocumentMetadata;
}>;

export const buildRenteOversigtDocumentFilename = (journalnr?: string): string => {
  return resolveDocumentArtifactFileName(PDF_TITLE, false, journalnr);
};

const addDateLine = (writer: DocumentWriter, beregningsdato: ISODateString): void => {
  writer.writeWrappedText(`Rente beregnes til og med ${formatIsoDateLong(beregningsdato)}.`);
  writer.addSectionSpacer();
};

const addOversigtTable = (
  writer: DocumentWriter,
  rows: ReadonlyArray<RenteOversigtRow>,
  beregningsdato: ISODateString,
  latestReferenceRateDate: ISODateString | null,
): void => {
  const doc = writer.getDoc();
  let startY = writer.getY();

  // Kolonner: fast Beløb (45 mm) | flex Rente fra | fast Beregnet rente (45 mm, højre).
  const columns: readonly ColumnSpec[] = [
    { width: { kind: 'fixed', mm: 45 }, align: 'left' },
    { width: { kind: 'flex' }, align: 'left' },
    { width: { kind: 'fixed', mm: 45 }, align: 'right' },
  ];

  const dataRows: RowSpec[] = rows.map((row) => ({
    cells: [
      { text: `${formatAmount(row.beloeb)} kr.` },
      { text: formatIsoDateLong(row.renterFra) },
      { text: `${formatAmount(row.beregnetRente)} kr.` },
    ],
  }));

  const totalRow = buildSummedTotalRowSpec(
    'Samlet rentebeløb',
    rows.map((row) => row.beregnetRente),
    {
      columnCount: 3,
      valueColumnIndex: 2,
      formatValue: (total) => `${formatAmount(total)} kr.`,
      valueHasKrSuffix: true,
    }
  );

  const endDate = parseISODate(beregningsdato);
  const latestRateDate = latestReferenceRateDate ? parseISODate(latestReferenceRateDate) : undefined;
  if (endDate && latestRateDate) {
    if (addHypotheticalInterestWarning(writer, endDate, latestRateDate)) {
      startY = writer.getY();
    }
  }

  const { endY } = renderTableSpec(doc, startY, {
    columns,
    hasHeaderRow: true,
    rows: [
      { kind: 'header', cells: [{ text: 'Beløb' }, { text: 'Rente fra' }, { text: 'Beregnet rente' }] },
      ...dataRows,
      ...(totalRow ? [totalRow] : []),
    ],
  });

  writer.setY(endY);
};

/**
 * Skriver oversigts-indholdet til en eksisterende DocumentWriter.
 * Kalder ikke addFooter eller save — det er kalderens ansvar.
 */
export const writeRenteOversigtDocumentContent = (
  writer: DocumentWriter,
  beregningsdato: ISODateString,
  rows: ReadonlyArray<RenteOversigtRow>,
  options: RenteOversigtDocumentOptions = {}
): void => {
  if (rows.length === 0) {
    throw new Error('Ingen renteberegninger fundet for oversigt');
  }

  const { visBrevhoved = false, stamdata = null, kommentarer, latestReferenceRateDate = null } = options;

  if (visBrevhoved) {
    writer.writeBrevhoved(buildStamdataBrevhovedData(stamdata));
  }

  writer.writeTitle(PDF_TITLE);
  addDateLine(writer, beregningsdato);
  addOversigtTable(writer, rows, beregningsdato, latestReferenceRateDate);
  addCalculationPrinciples(writer, kommentarer);
};

/**
 * Generer og download oversigts-PDF for renteberegninger.
 *
 * @param beregningsdato - Datoen renter beregnes til og med (ISO).
 * @param rows - Projektion af de gyldige renteberegninger.
 * @param options - Valgfrie indstillinger (brevhoved/stamdata/kommentarer).
 */
export const generateRenteOversigtDocument = (
  beregningsdato: ISODateString,
  rows: ReadonlyArray<RenteOversigtRow>,
  options: RenteOversigtDocumentOptions = {}
): void => {
  const writer = initStandardDocumentWriter({
    title: PDF_TITLE,
    metadata: options.metadata,
  });

  writeRenteOversigtDocumentContent(writer, beregningsdato, rows, options);

  writer.addFooter();

  writer.save(buildRenteOversigtDocumentFilename(options.stamdata?.journalnr));
};

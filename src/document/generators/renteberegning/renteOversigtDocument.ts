/**
 * PDF Generator for Procesrente – oversigt
 *
 * Genererer en samlet oversigt over alle udfyldte renteberegninger:
 * én tabel med beløb, rentedato (Rente fra) og beregnet rente pr. linje
 * samt en sammentalt i alt-linje.
 */

import {
  resolveDocumentSectionEndY,
  formatAmount,
  getDocumentCreatorBrand,
  type BrevhovedData,
} from '../../layout/documentLayoutHelpers';
import { createStandardPdfWriter, type DocumentWriter } from '../../writer';
import type { RowInput } from 'jspdf-autotable';
import {
  createDocumentDistributedColumnStyles,
  createDocumentTableCell,
  createDocumentTableHeaderCell,
  createDocumentTableSummedTotalRow,
  renderDocumentTable,
} from '../../layout/documentTableRenderer';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { TODAY } from '../../../config/dateRanges';
import type { DocumentCommonOptions, DocumentStamdata } from '../../layout/documentOptions';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import type { ISODateString } from '../../../types/branded';
import { addCalculationPrinciples } from './renteDocument';

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
): void => {
  const doc = writer.getDoc();
  const startY = writer.getY();
  const tableData: RowInput[] = [];

  tableData.push([
    createDocumentTableHeaderCell('Beløb', 'left'),
    createDocumentTableHeaderCell('Rente fra', 'left'),
    createDocumentTableHeaderCell('Beregnet rente', 'right'),
  ]);

  for (const row of rows) {
    tableData.push([
      createDocumentTableCell(`${formatAmount(row.beloeb)} kr.`, { halign: 'left' }),
      createDocumentTableCell(formatIsoDateLong(row.renterFra), { halign: 'left' }),
      createDocumentTableCell(`${formatAmount(row.beregnetRente)} kr.`, { halign: 'right' }),
    ]);
  }

  const totalRow = createDocumentTableSummedTotalRow(
    'Samlet rentebeløb',
    rows.map((row) => row.beregnetRente),
    {
      columnCount: 3,
      valueColumnIndex: 2,
      formatValue: (total) => `${formatAmount(total)} kr.`,
      valueHasKrSuffix: true,
    }
  );
  const totalRowIndex = totalRow ? tableData.length : null;
  if (totalRow) {
    tableData.push(totalRow.row);
  }

  const finalY = renderDocumentTable({
    doc,
    startY,
    body: tableData,
    columnStyles: createDocumentDistributedColumnStyles(3, {
      fixedColumns: {
        0: 45,
        2: 45,
      },
    }),
    underlinedCellPositions: totalRowIndex === null || totalRow === null
      ? []
      : [{ rowIndex: totalRowIndex, columnIndex: totalRow.valueCellColumnIndex }],
  });

  writer.setY(resolveDocumentSectionEndY(finalY, startY));
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

  const { visBrevhoved = false, stamdata = null, kommentarer } = options;

  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  writer.writeTitle(PDF_TITLE);
  addDateLine(writer, beregningsdato);
  addOversigtTable(writer, rows);
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
  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  writer.setProperties({
    title: PDF_TITLE,
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: getDocumentCreatorBrand(),
  });

  writeRenteOversigtDocumentContent(writer, beregningsdato, rows, options);

  writer.addFooter();

  writer.save(buildRenteOversigtDocumentFilename(options.stamdata?.journalnr));
};

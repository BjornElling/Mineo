/**
 * PDF Generator for Procesrente – oversigt
 *
 * Genererer en samlet oversigt over alle udfyldte renteberegninger:
 * én tabel med beløb, rentedato (Rente fra) og beregnet rente pr. linje
 * samt en sammentalt i alt-linje.
 */

import {
  resolvePdfSectionEndY,
  formatAmount,
  getPdfCreatorBrand,
  type BrevhovedData,
} from '../../shared/pdfHelpers';
import { createStandardPdfWriter, type PdfWriter } from '../../infrastructure/pdfWriter';
import type { RowInput } from 'jspdf-autotable';
import {
  createPdfDistributedColumnStyles,
  createPdfTableCell,
  createPdfTableHeaderCell,
  createPdfTableSummedTotalRow,
  renderPdfTable,
} from '../../shared/pdfTableRenderer';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { TODAY } from '../../../config/dateRanges';
import type { PdfCommonOptions, PdfStamdata } from '../../shared/pdfOptions';
import { resolvePdfFileName } from '../../shared/pdfFormatUtils';
import type { ISODateString } from '../../../types/branded';
import { addCalculationPrinciples } from './rentePdf';

const PDF_TITLE = 'Procesrente – oversigt';

/**
 * Én linje i oversigten, projiceret fra en gyldig renteberegning.
 */
export type RenteOversigtRow = Readonly<{
  beloeb: number;
  renterFra: ISODateString;
  beregnetRente: number;
}>;

type RenteOversigtPdfOptions = PdfCommonOptions & Readonly<{
  stamdata?: PdfStamdata | null;
  kommentarer?: string;
}>;

export const buildRenteOversigtPdfFilename = (journalnr?: string): string => {
  return resolvePdfFileName(PDF_TITLE, false, journalnr);
};

const addDateLine = (writer: PdfWriter, beregningsdato: ISODateString): void => {
  writer.writeWrappedText(`Rente beregnes til og med ${formatIsoDateLong(beregningsdato)}.`);
  writer.addSectionSpacer();
};

const addOversigtTable = (
  writer: PdfWriter,
  rows: ReadonlyArray<RenteOversigtRow>,
): void => {
  const doc = writer.getDoc();
  const startY = writer.getY();
  const tableData: RowInput[] = [];

  tableData.push([
    createPdfTableHeaderCell('Beløb', 'left'),
    createPdfTableHeaderCell('Rente fra', 'left'),
    createPdfTableHeaderCell('Beregnet rente', 'right'),
  ]);

  for (const row of rows) {
    tableData.push([
      createPdfTableCell(`${formatAmount(row.beloeb)} kr.`, { halign: 'left' }),
      createPdfTableCell(formatIsoDateLong(row.renterFra), { halign: 'left' }),
      createPdfTableCell(`${formatAmount(row.beregnetRente)} kr.`, { halign: 'right' }),
    ]);
  }

  const totalRow = createPdfTableSummedTotalRow(
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

  const finalY = renderPdfTable({
    doc,
    startY,
    body: tableData,
    columnStyles: createPdfDistributedColumnStyles(3, {
      fixedColumns: {
        0: 45,
        2: 45,
      },
    }),
    underlinedCellPositions: totalRowIndex === null || totalRow === null
      ? []
      : [{ rowIndex: totalRowIndex, columnIndex: totalRow.valueCellColumnIndex }],
  });

  writer.setY(resolvePdfSectionEndY(finalY, startY));
};

/**
 * Skriver oversigts-indholdet til en eksisterende PdfWriter.
 * Kalder ikke addFooter eller save — det er kalderens ansvar.
 */
export const writeRenteOversigtPdfContent = (
  writer: PdfWriter,
  beregningsdato: ISODateString,
  rows: ReadonlyArray<RenteOversigtRow>,
  options: RenteOversigtPdfOptions = {}
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
export const generateRenteOversigtPdf = (
  beregningsdato: ISODateString,
  rows: ReadonlyArray<RenteOversigtRow>,
  options: RenteOversigtPdfOptions = {}
): void => {
  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  writer.setProperties({
    title: PDF_TITLE,
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: getPdfCreatorBrand(),
  });

  writeRenteOversigtPdfContent(writer, beregningsdato, rows, options);

  writer.addFooter();

  writer.save(buildRenteOversigtPdfFilename(options.stamdata?.journalnr));
};

/**
 * PDF Generator for Procesrenteberegning
 *
 * Genererer detaljeret specifikation af renteberegning med halvårlige perioder
 */

import {
  PDF_TABLE_NARROW_COLUMN_WIDTH,
} from '../../layout/pdfConfig';
import {
  resolveDocumentSectionEndY,
  formatAmount,
  formatPercent,
} from '../../layout/documentLayoutHelpers';
import type { DocumentWriter } from '../../writer';
import { buildStamdataBrevhovedData, initStandardDocumentWriter } from '../documentGeneratorSetup';
import type { RowInput } from 'jspdf-autotable';
import {
  createDocumentDistributedColumnStyles,
  createDocumentTableCell,
  createDocumentTableHeaderCell,
  createDocumentTableSummedTotalRow,
  renderDocumentTable,
} from '../../layout/documentTableRenderer';
import { formatDanishDate, parseDanishDate } from '../../../utils/dateUtils';
import type { DocumentCommonOptions, DocumentStamdata } from '../../layout/documentOptions';
import { RENTE_CALCULATION_PRINCIPLES } from '../../../domain/renteberegning/renteCalculationPrinciples';
import { resolveDocumentArtifactFileName, sanitizeFilenamePart } from '../../layout/documentFormatUtils';
import type { ProcessInterestPeriod } from '../../../domain/renteberegning/procesrenteCalculator';

/**
 * Stamdata til Rente PDF
 */
type RenteDocumentOptions = DocumentCommonOptions & Readonly<{
  stamdata?: DocumentStamdata | null;
  kommentarer?: string;
  latestReferenceRateDate?: string | null;
}>;

const RIGHT_ALIGNED_INSET_RENTEDAGE_MM = 10;
const RIGHT_ALIGNED_INSET_RENTESATS_MM = 8;
const COLUMN_INDEX_RENTEDAGE = 1;
const COLUMN_INDEX_RENTESATS = 2;

export const buildRenteDocumentFilename = (
  baseTitle: string,
  journalnr?: string
): string => {
  return resolveDocumentArtifactFileName(baseTitle, false, journalnr);
};

export const buildRenteDocumentBaseTitle = (amount: number, startDate: Date, endDate: Date): string => {
  return sanitizeFilenamePart(`Procesrente, ${formatAmount(amount)} kr. (${formatDanishDate(startDate)} - ${formatDanishDate(endDate)})`);
};

const addDescription = (
  writer: DocumentWriter,
  amount: number,
  startDate: Date,
  endDate: Date
): void => {
  const lines = [
    `Hovedstol: ${formatAmount(amount)} kr.`,
    `Periode: ${formatDanishDate(startDate)} - ${formatDanishDate(endDate)} (begge dage inkl.)`,
  ];

  for (const line of lines) {
    writer.writeWrappedText(line);
  }
  writer.addSectionSpacer();
};

const addSpecificationTable = (
  writer: DocumentWriter,
  periods: ReadonlyArray<ProcessInterestPeriod>,
  endDate: Date,
  latestReferenceRateDate: Date | null
): void => {
  const doc = writer.getDoc();
  const startY = writer.getY();
  const tableData: RowInput[] = [];

  tableData.push([
    createDocumentTableHeaderCell('Periode', 'left'),
    createDocumentTableHeaderCell('Rentedage', 'center'),
    createDocumentTableHeaderCell('Rentesats', 'center'),
    createDocumentTableHeaderCell('Beregnet rente', 'right'),
  ]);

  for (const period of periods) {
    tableData.push([
      createDocumentTableCell(`${formatDanishDate(period.startDate)} - ${formatDanishDate(period.endDate)}`, { halign: 'left' }),
      createDocumentTableCell(`${period.days}`, { halign: 'center' }),
      createDocumentTableCell(formatPercent(period.totalRatePct), { halign: 'center' }),
      createDocumentTableCell(`${formatAmount(period.interest)} kr.`, { halign: 'right' }),
    ]);
  }

  const isHypothetical = latestReferenceRateDate !== null && endDate > latestReferenceRateDate;

  const totalRow = createDocumentTableSummedTotalRow(
    'Samlet rentebeløb',
    periods.map((period) => period.interest),
    {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => `${formatAmount(total)} kr.`,
      valueHasKrSuffix: true,
    }
  );
  const totalRowIndex = totalRow ? tableData.length : null;
  if (totalRow) {
    tableData.push(totalRow.row);
  }

  let tableStartY = startY;

  if (isHypothetical && latestReferenceRateDate !== null) {
    writer.writeBoldWrappedText(
      `Der er kun fastsat procesrente frem til ${formatDanishDate(latestReferenceRateDate)}. Beregning derefter er hypotetisk!`
    );
    writer.addSectionSpacer();
    tableStartY = writer.getY();
  }

  const finalY = renderDocumentTable({
    doc,
    startY: tableStartY,
    body: tableData,
    columnStyles: createDocumentDistributedColumnStyles(4, {
      fixedColumns: {
        1: PDF_TABLE_NARROW_COLUMN_WIDTH,
        2: PDF_TABLE_NARROW_COLUMN_WIDTH,
        3: 35,
      },
    }),
    underlinedCellPositions: totalRowIndex === null || totalRow === null
      ? []
      : [{ rowIndex: totalRowIndex, columnIndex: totalRow.valueCellColumnIndex }],
    // Word matcher PDF'ens højrejustering af rentedage/rentesats (insettet nedenfor
    // er rent visuelt og udelades bevidst i Word).
    dataRowColumnHalign: {
      [COLUMN_INDEX_RENTEDAGE]: 'right',
      [COLUMN_INDEX_RENTESATS]: 'right',
    },
    didParseCell: (data) => {
      const isDataRow = data.row.index >= 1 && data.row.index <= periods.length;
      if (!isDataRow) return;
      if (data.column.index !== COLUMN_INDEX_RENTEDAGE && data.column.index !== COLUMN_INDEX_RENTESATS) return;

      data.cell.styles.halign = 'right';
      const rightInset = data.column.index === COLUMN_INDEX_RENTEDAGE
        ? RIGHT_ALIGNED_INSET_RENTEDAGE_MM
        : RIGHT_ALIGNED_INSET_RENTESATS_MM;

      data.cell.styles.cellPadding = {
        top: 1.5,
        bottom: 1.5,
        left: 1.5,
        right: rightInset,
      };
    },
  });

  writer.setY(resolveDocumentSectionEndY(finalY, tableStartY));
};

/**
 * Skriver "Kommentarer" (hvis udfyldt) efterfulgt af "Beregningsprincipper".
 * Kanonisk for både per-række-specifikationer og oversigts-PDF'en, så de to
 * dokumenttyper deler præcis samme afsnit.
 */
export const addCalculationPrinciples = (
  writer: DocumentWriter,
  kommentarer: string | undefined
): void => {
  const normalizedKommentarer = typeof kommentarer === 'string' ? kommentarer.trim() : '';

  if (normalizedKommentarer !== '') {
    writer.writeBoldSubheaderWithWrappedText('Kommentarer', normalizedKommentarer);
  }

  writer.writeBoldSubheader('Beregningsprincipper');
  const principles = RENTE_CALCULATION_PRINCIPLES;

  for (const principle of principles) {
    writer.writeWrappedText(principle);
  }
};

/**
 * Skriver én rente-specifikation-sektion til en eksisterende DocumentWriter.
 * Kalder ikke addFooter eller save — det er kalderens ansvar.
 */
export const writeRenteDocumentContent = (
  writer: DocumentWriter,
  amount: number,
  startDate: Date,
  endDate: Date,
  periods: ReadonlyArray<ProcessInterestPeriod>,
  options: RenteDocumentOptions
): void => {
  const {
    visBrevhoved = false,
    stamdata = null,
    kommentarer,
    latestReferenceRateDate = null,
  } = options;

  if (visBrevhoved) {
    writer.writeBrevhoved(buildStamdataBrevhovedData(stamdata));
  }

  writer.writeTitle('Procesrente');
  addDescription(writer, amount, startDate, endDate);
  addSpecificationTable(
    writer,
    periods,
    endDate,
    latestReferenceRateDate ? parseDanishDate(latestReferenceRateDate) : null
  );
  addCalculationPrinciples(writer, kommentarer);
};

/**
 * Generer og download PDF for procesrenteberegning
 *
 * @param {number} amount - Hovedstol
 * @param {string} interestStartDate - Rentens startdato (dd-mm-åååå)
 * @param {string} calculationDate - Beregningens slutdato (dd-mm-åååå)
 * @param {ReadonlyArray<ProcessInterestPeriod>} periods - Periode-output fra motoren
 * @param {RenteDocumentOptions} options - Valgfrie indstillinger
 */
export const generateRenteDocument = (
  amount: number,
  interestStartDate: string,
  calculationDate: string,
  periods: ReadonlyArray<ProcessInterestPeriod>,
  options: RenteDocumentOptions = {}
): void => {
  if (!periods || periods.length === 0) {
    throw new Error('Ingen perioder fundet for renteberegning');
  }

  const startDate = parseDanishDate(interestStartDate);
  const endDate = parseDanishDate(calculationDate);

  if (!startDate || !endDate) {
    throw new Error('Ugyldige datoer for renteberegning');
  }

  const writer = initStandardDocumentWriter({ title: 'Procesrente' });

  writeRenteDocumentContent(writer, amount, startDate, endDate, periods, options);
  writer.addFooter();

  const baseTitle = buildRenteDocumentBaseTitle(amount, startDate, endDate);
  const filename = buildRenteDocumentFilename(baseTitle, options.stamdata?.journalnr);
  writer.save(filename);
};

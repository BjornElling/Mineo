/**
 * PDF Generator for SH-dage (Søgnehelligdage på hverdage)
 *
 * Genererer PDF-dokument med oversigt over danske helligdage der falder på hverdage
 */

import {
  PDF_MUTED_TEXT_COLOR,
  PDF_TABLE_NARROW_COLUMN_WIDTH,
} from '../../infrastructure/pdfConfig';
import { findNamedHolidaysInDateRanges } from '../../../domain/dates/shDageOversigt';
import {
  resolvePdfSectionEndY,
  type BrevhovedData,
} from '../../shared/pdfHelpers';
import { createStandardPdfWriter, type PdfWriter } from '../../infrastructure/pdfWriter';
import {
  TABLE_FONT_SIZE,
  createPdfDistributedColumnStyles,
  createPdfTableCell,
  createPdfTableHeaderCell,
  createPdfTableSummedTotalRow,
  renderPdfTable,
} from '../../shared/pdfTableRenderer';
import { formatDanishDate } from '../../../utils/dateUtils';
import { formatUtcDateLong, WEEKDAY_NAMES_DA } from '../../../utils/dateFormatting';
import { TODAY } from '../../../config/dateRanges';
import type { PdfCommonOptions } from '../../shared/pdfOptions';
import type { CellHookData, RowInput } from 'jspdf-autotable';
import { resolvePdfFileName } from '../../shared/pdfFormatUtils';
import { mergeDateRanges } from '../../../domain/erstatningsopgoerelse/engines/periodMerging';

type SHDagePdfOptions = PdfCommonOptions;
type SHDagePeriod = { start: Date; end: Date };
type SHDagEntry = Readonly<{
  dato: Date;
  ugedag: (typeof WEEKDAY_NAMES_DA)[number];
  helligdagNavn: string;
  erHverdag: boolean;
}>;
type SHDageTableBuildResult = Readonly<{
  body: RowInput[];
  totalRowIndex: number | null;
  totalValueColumnIndex: number;
}>;

const buildSHDagePeriodLabel = (perioder: ReadonlyArray<SHDagePeriod>): string => {
  return perioder
    .map(({ start, end }) => `${formatDanishDate(start)} - ${formatDanishDate(end)}`)
    .join(' + ');
};

export const buildSHDagePdfFilename = (
  perioder: ReadonlyArray<SHDagePeriod>,
  journalnr?: string
): string => {
  const periodLabel = buildSHDagePeriodLabel(perioder);
  const baseTitle = periodLabel.length > 0 ? `SH-dage (${periodLabel})` : 'SH-dage';
  return resolvePdfFileName(baseTitle, false, journalnr);
};

/**
 * Formater dato til dansk format (d. måned åååå)
 *
 * @param {Date} date - Datoen at formatere
 * @returns {string} Formateret dato
 */
const formatDanskDato = (date: Date): string => formatUtcDateLong(date);

/**
 * Find alle helligdage i de angivne perioder
 *
 * @param {Array} perioder - Array af {start: Date, end: Date}
 * @returns {Array} Array af helligdags-objekter
 */
const findSHDageIPerioder = (perioder: ReadonlyArray<SHDagePeriod>): SHDagEntry[] => {
  return findNamedHolidaysInDateRanges(perioder).map(({ date, navn, erHverdag }) => ({
    dato: date,
    ugedag: WEEKDAY_NAMES_DA[date.getUTCDay()],
    helligdagNavn: navn,
    erHverdag,
  }));
};

/**
 * Sammenlæg overlappende eller sammenhængende perioder
 *
 * @param {Array} perioder - Array af {start: Date, end: Date}
 * @returns {Array} Sammensatte perioder
 */
const sammenlaegPerioder = (perioder: ReadonlyArray<SHDagePeriod>): SHDagePeriod[] => {
  return mergeDateRanges(
    perioder.map((periode) => ({ fra: periode.start, til: periode.end })),
    { mergeAdjacent: true }
  ).map(({ fra, til }) => ({
    start: fra,
    end: til,
  }));
};

/**
 * Formater periode-oversigt som tekst
 *
 * @param {Array} perioder - Array af {start: Date, end: Date}
 * @returns {string} Formateret periode-tekst
 */
const formaterPeriodeOversigt = (perioder: ReadonlyArray<SHDagePeriod>): string => {
  if (!perioder || perioder.length === 0) {
    return '';
  }

  const sammensatte = sammenlaegPerioder(perioder);

  if (sammensatte.length === 1) {
    const { start, end } = sammensatte[0];
    return `${formatDanskDato(start)} - ${formatDanskDato(end)}`;
  } else {
    const periodeTekster = sammensatte.map(({ start, end }) =>
      `${formatDanskDato(start)} - ${formatDanskDato(end)}`
    );
    return periodeTekster.join(', ');
  }
};

export const buildSHDageTableRows = (
  helligdage: ReadonlyArray<SHDagEntry>
): SHDageTableBuildResult => {
  const tableData: RowInput[] = [[
    createPdfTableHeaderCell('Ugedag', 'left'),
    createPdfTableHeaderCell('Dato', 'left'),
    createPdfTableHeaderCell('Helligdag', 'left'),
    createPdfTableHeaderCell('SH-dag', 'center'),
  ]];

  for (const { dato, ugedag, helligdagNavn, erHverdag } of helligdage) {
    tableData.push([
      createPdfTableCell(ugedag, { halign: 'left' }),
      createPdfTableCell(formatDanskDato(dato), { halign: 'left' }),
      createPdfTableCell(helligdagNavn, { halign: 'left' }),
      createPdfTableCell(erHverdag ? 'x' : '', { halign: 'center', valign: 'middle', fontSize: TABLE_FONT_SIZE }),
    ]);
  }

  const totalRow = createPdfTableSummedTotalRow(
    'SH-dage i alt',
    helligdage.map((helligdag) => (helligdag.erHverdag ? 1 : 0)),
    {
      columnCount: 4,
      valueColumnIndex: 3,
      formatValue: (total) => String(total),
      valueAlign: 'center',
      preserveValueColumn: true,
    }
  );
  const totalRowIndex = totalRow ? tableData.length : null;
  if (totalRow) {
    tableData.push(totalRow.row);
  }

  return {
    body: tableData,
    totalRowIndex,
    totalValueColumnIndex: totalRow?.valueCellColumnIndex ?? 3,
  };
};

/**
 * Generer og download PDF for SH-dage
 *
 * @param {Array} perioder - Array af {start: Date, end: Date} periode-objekter
 * @param {SHDagePdfOptions} options - Valgfrie indstillinger (inkl. stamdata og brevhoved)
 */
export const generateSHDagePdf = (
  perioder: ReadonlyArray<SHDagePeriod>,
  options: SHDagePdfOptions = {}
): void => {
  const { visBrevhoved = false } = options;
  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  // Dokumentets metadata
  writer.setProperties({
    title: 'SH-dage',
    subject: 'Erstatningsberegning',
    author: 'MinEO',
    creator: 'mineo.dk',
  });

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: options.stamdata?.journalnr,
      advokat: options.stamdata?.advokat,
      sagsbehandler: options.stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  // Tilføj titel
  writer.writeTitle('SH-dage');

  // Tilføj periode-beskrivelse
  addDescription(writer, perioder);

  // Find alle helligdage
  const helligdage = findSHDageIPerioder(perioder);

  if (helligdage.length === 0) {
    writer.writeWrappedText('Ingen helligdage fundet i de angivne perioder.');
  } else {
    // Tilføj helligdagstabel
    addSHDageTable(writer, helligdage);

    // Tilføj forklaringstekst
    addExplanationText(writer);
  }

  // Tilføj footer med versionsnummer
  writer.addFooter();

  // Download PDF
  writer.save(buildSHDagePdfFilename(perioder, options.stamdata?.journalnr));
};


/**
 * Tilføj periode-beskrivelse
 */
const addDescription = (writer: PdfWriter, perioder: ReadonlyArray<SHDagePeriod>): void => {
  const periodeTekst = formaterPeriodeOversigt(perioder);
  writer.writeWrappedText(`Periode: ${periodeTekst}`);
  writer.addSectionSpacer();
};

/**
 * Tilføj SH-dage tabel
 */
const addSHDageTable = (writer: PdfWriter, helligdage: ReadonlyArray<SHDagEntry>): void => {
  const doc = writer.getDoc();
  const startY = writer.getY();
  const { body: tableData, totalRowIndex, totalValueColumnIndex } = buildSHDageTableRows(helligdage);

  const finalY = renderPdfTable({
    doc,
    startY,
    body: tableData,
    columnStyles: createPdfDistributedColumnStyles(4, {
      fixedColumns: {
        3: PDF_TABLE_NARROW_COLUMN_WIDTH,
      },
    }),
    underlinedCellPositions: totalRowIndex === null
      ? []
      : [{ rowIndex: totalRowIndex, columnIndex: totalValueColumnIndex }],
    didParseCell: (data: CellHookData) => {
      const helligdagIndex = data.row.index - 1;
      if (helligdagIndex >= 0 && helligdagIndex < helligdage.length) {
        const helligdag = helligdage[helligdagIndex];
        if (!helligdag.erHverdag) {
          data.cell.styles.textColor = PDF_MUTED_TEXT_COLOR;
        }
        return;
      }

      if (totalRowIndex !== null && data.row.index === totalRowIndex) {
        data.cell.styles.fillColor = false;
        data.cell.styles.lineWidth = 0;
      }
    },
  });

  writer.setY(resolvePdfSectionEndY(finalY, startY));
};

/**
 * Tilføj forklaringstekst
 */
const addExplanationText = (writer: PdfWriter): void => {
  writer.writeBoldSubheader('Forklaring');

  const explanations = [
    'Søgnehelligdage er helligdage, der falder på hverdage (mandag-fredag).',
    'Helligdage, der falder i weekenden, fremgår af tabellen men medregnes ikke.',
  ];

  for (const explanation of explanations) {
    writer.writeWrappedText(explanation);
  }
};

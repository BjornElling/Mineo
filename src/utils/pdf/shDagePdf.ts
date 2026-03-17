/**
 * PDF Generator for SH-dage (Søgnehelligdage på hverdage)
 *
 * Genererer PDF-dokument med oversigt over danske helligdage der falder på hverdage
 */

import {
  PDF_MUTED_TEXT_COLOR,
  PDF_TABLE_NARROW_COLUMN_WIDTH,
  SECTION_SPACER,
} from './pdfConfig';
import { beregnHelligdageMedNavn } from '../shDageBeregning';
import {
  PDF_BASE_LINE_HEIGHT_MM,
  resolvePdfSectionEndY,
  type BrevhovedData,
} from './pdfHelpers';
import { createStandardPdfWriter, type PdfWriter } from './pdfWriter';
import {
  TABLE_FONT_SIZE,
  createPdfTableCell,
  createPdfTableHeaderCell,
  createPdfTableTransparentRow,
  renderEoStylePdfTable,
} from './pdfTableRenderer';
import { parseISODate, type ISODateString } from '../../types/branded';
import { formatToISO, addDays, formatDanishDate } from '../dateUtils';
import { formatUtcDateLong, WEEKDAY_NAMES_DA } from '../dateFormatting';
import { TODAY } from '../../config/dateRanges';
import type { PdfCommonOptions } from './pdfOptions';
import type { CellHookData, RowInput } from 'jspdf-autotable';
import { resolvePdfFileName } from './pdfFormatUtils';

type SHDagePdfOptions = PdfCommonOptions;
type SHDagePeriod = { start: Date; end: Date };
type SHDagEntry = Readonly<{
  dato: Date;
  ugedag: (typeof WEEKDAY_NAMES_DA)[number];
  helligdagNavn: string;
  erHverdag: boolean;
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
  const helligdageIPeriode: SHDagEntry[] = [];

  // Saml alle datoer fra alle perioder
  const alleDatoer = new Set<ISODateString>();
  perioder.forEach(({ start, end }) => {
    let currentDate = new Date(start);
    while (currentDate <= end) {
      const isoStr = formatToISO(currentDate);
      alleDatoer.add(isoStr);
      currentDate = addDays(currentDate, 1);
    }
  });

  // Find alle år i perioderne
  const aarSet = new Set<number>();
  alleDatoer.forEach(dateStr => {
    const date = parseISODate(dateStr);
    if (date) {
      aarSet.add(date.getUTCFullYear());
    }
  });

  // Find helligdage for alle relevante år
  aarSet.forEach((aar) => {
    const helligdage = beregnHelligdageMedNavn(aar);

    helligdage.forEach(({ date: helligdag, navn }) => {
      const helligdagStr = formatToISO(helligdag);

      // Tjek om helligdagen er i vores datoer
      if (helligdagStr && alleDatoer.has(helligdagStr)) {
        const ugedag = WEEKDAY_NAMES_DA[helligdag.getUTCDay()];
        const erHverdag = helligdag.getUTCDay() >= 1 && helligdag.getUTCDay() <= 5;

        helligdageIPeriode.push({
          dato: helligdag,
          ugedag,
          helligdagNavn: navn,
          erHverdag,
        });
      }
    });
  });

  // Sorter efter dato
  helligdageIPeriode.sort((a, b) => a.dato.getTime() - b.dato.getTime());

  return helligdageIPeriode;
};

/**
 * Sammenlæg overlappende eller sammenhængende perioder
 *
 * @param {Array} perioder - Array af {start: Date, end: Date}
 * @returns {Array} Sammensatte perioder
 */
const sammenlaegPerioder = (perioder: ReadonlyArray<SHDagePeriod>): SHDagePeriod[] => {
  if (!perioder || perioder.length === 0) {
    return [];
  }

  // Sorter perioder
  const sorterede = [...perioder].sort((a, b) => a.start.getTime() - b.start.getTime());

  const sammensatte: SHDagePeriod[] = [{ start: sorterede[0].start, end: sorterede[0].end }];

  for (let i = 1; i < sorterede.length; i++) {
    const { start: fra, end: til } = sorterede[i];
    const sidstePeriode = sammensatte[sammensatte.length - 1];

    // Tjek om perioder overlapper eller er sammenhængende (med 1 dags margin)
    const naesteDag = addDays(sidstePeriode.end, 1);

    if (fra <= naesteDag) {
      // Sammensæt perioder
      sammensatte[sammensatte.length - 1].end = til > sidstePeriode.end ? til : sidstePeriode.end;
    } else {
      // Tilføj som ny periode
      sammensatte.push({ start: fra, end: til });
    }
  }

  return sammensatte;
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
    author: 'Mineo',
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
  writer.addSpacer(PDF_BASE_LINE_HEIGHT_MM);
};

/**
 * Tilføj SH-dage tabel
 */
const addSHDageTable = (writer: PdfWriter, helligdage: ReadonlyArray<SHDagEntry>): void => {
  const doc = writer.getDoc();
  const startY = writer.getY();
  // Beregn total antal SH-dage
  const antalSHDage = helligdage.filter(h => h.erHverdag).length;

  // Forbered tabeldata
  const tableData: RowInput[] = [];

  // Header-række
  tableData.push([
    createPdfTableHeaderCell('Ugedag', 'left'),
    createPdfTableHeaderCell('Dato', 'left'),
    createPdfTableHeaderCell('Helligdag', 'left'),
    createPdfTableHeaderCell('SH-dag', 'center'),
  ]);

  // Data-rækker
  for (const { dato, ugedag, helligdagNavn, erHverdag } of helligdage) {
    tableData.push([
      createPdfTableCell(ugedag, { halign: 'left' }),
      createPdfTableCell(formatDanskDato(dato), { halign: 'left' }),
      createPdfTableCell(helligdagNavn, { halign: 'left' }),
      createPdfTableCell(erHverdag ? 'x' : '', { halign: 'center', valign: 'middle', fontSize: TABLE_FONT_SIZE }),
    ]);
  }

  // Tom række
  tableData.push(createPdfTableTransparentRow(4));

  // Total-række
  tableData.push([
    createPdfTableCell('SH-dage i alt', { halign: 'left', bold: true, transparent: true }),
    createPdfTableCell('', { bold: true, transparent: true }),
    createPdfTableCell('', { bold: true, transparent: true }),
    createPdfTableCell(`${antalSHDage}`, { halign: 'center', bold: true, transparent: true }),
  ]);

  const finalY = renderEoStylePdfTable({
    doc,
    startY,
    body: tableData,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: PDF_TABLE_NARROW_COLUMN_WIDTH },
    },
    transparentRowIndices: [tableData.length - 2, tableData.length - 1],
    didParseCell: (data: CellHookData) => {
      const helligdagIndex = data.row.index - 1;
      if (helligdagIndex >= 0 && helligdagIndex < helligdage.length) {
        const helligdag = helligdage[helligdagIndex];
        if (!helligdag.erHverdag) {
          data.cell.styles.textColor = PDF_MUTED_TEXT_COLOR;
        }
      }
    },
  });

  writer.setY(resolvePdfSectionEndY(finalY, startY));
};

/**
 * Tilføj forklaringstekst
 */
const addExplanationText = (writer: PdfWriter): void => {
  writer.writeSubheader('Forklaring', (2 * PDF_BASE_LINE_HEIGHT_MM) + SECTION_SPACER);

  const explanations = [
    '• Søgnehelligdage er helligdage, der falder på hverdage (mandag-fredag).',
    '• Helligdage, der falder i weekenden, fremgår af tabellen men medregnes ikke.',
  ];

  for (const explanation of explanations) {
    writer.writeWrappedText(explanation);
  }
  writer.addSpacer(SECTION_SPACER);
};

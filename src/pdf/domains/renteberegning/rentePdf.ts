/**
 * PDF Generator for Procesrenteberegning
 *
 * Genererer detaljeret specifikation af renteberegning med halvårlige perioder
 */

import {
  PDF_SECTION_HEADING_GAP,
  PDF_TABLE_NARROW_COLUMN_WIDTH,
  SECTION_SPACER,
} from '../../infrastructure/pdfConfig';
import {
  PDF_BASE_LINE_HEIGHT_MM,
  resolvePdfSectionEndY,
  formatAmount,
  formatPercent,
  type BrevhovedData
} from '../../shared/pdfHelpers';
import { createStandardPdfWriter, type PdfWriter } from '../../infrastructure/pdfWriter';
import type { RowInput } from 'jspdf-autotable';
import {
  createPdfDistributedColumnStyles,
  createPdfTableCell,
  createPdfTableHeaderCell,
  createPdfTableSummedTotalRow,
  renderEoStylePdfTable,
} from '../../shared/pdfTableRenderer';
import { createDate, formatDanishDate, getDaysInYear, parseDanishDate } from '../../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import type { RateEntry } from '../../../data/interestRates';
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import { TODAY } from '../../../config/dateRanges';
import type { PdfCommonOptions, PdfStamdata } from '../../shared/pdfOptions';
import { RENTE_CALCULATION_PRINCIPLES } from '../../../domain/renteberegning/renteCalculationPrinciples';
import { resolvePdfFileName, sanitizeFilenamePart } from '../../shared/pdfFormatUtils';

/**
 * Stamdata til Rente PDF
 */
type RentePdfOptions = PdfCommonOptions & Readonly<{
  stamdata?: PdfStamdata | null;
  kommentarer?: string;
}>;

type RentePeriod = Readonly<{
  startDate: Date;
  endDate: Date;
  amount: number;
  referenceRate: number;
  surchargeRate: number;
  totalRate: number;
  days: number;
  interest: number;
}>;

const RIGHT_ALIGNED_INSET_RENTEDAGE_MM = 10;
const RIGHT_ALIGNED_INSET_RENTESATS_MM = 8;
const COLUMN_INDEX_RENTEDAGE = 1;
const COLUMN_INDEX_RENTESATS = 2;

const parseAmountInput = (value: string | number): number => {
  if (typeof value === 'number') return value;
  return Number.parseFloat(value.replace(/\./g, '').replace(',', '.'));
};

export const buildRentePdfFilename = (
  baseTitle: string,
  journalnr?: string
): string => {
  return resolvePdfFileName(baseTitle, false, journalnr);
};

export const buildRentePdfBaseTitle = (amount: number, startDate: Date, endDate: Date): string => {
  return sanitizeFilenamePart(`Procesrente, ${formatAmount(amount)} kr. (${formatDanishDate(startDate)} - ${formatDanishDate(endDate)})`);
};

/**
 * Finder den gældende sats (procentpoint) på en specifik dato
 */
const findRatePctOnDate = (rates: ReadonlyArray<RateEntry>, targetDate: Date): number => {
  const ratesWithDates = rates
    .map((entry) => ({
      date: parseDanishDate(entry.effectiveDate),
      rate: entry.ratePct,
    }))
    .filter((entry): entry is { date: Date; rate: number } => entry.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let applicableRate: number | null = null;

  for (const entry of ratesWithDates) {
    if (entry.date <= targetDate) {
      applicableRate = entry.rate;
    } else {
      break;
    }
  }

  if (applicableRate === null) {
    throw new Error(`Ingen sats fundet for dato ${targetDate.toLocaleDateString('da-DK')}`);
  }

  return applicableRate;
};

/**
 * Beregner tillægssats baseret på faktisk rentedato
 */
const calculateSurchargeRate = (interestStartDate: Date): number => {
  return findRatePctOnDate(surchargeRates, interestStartDate);
};

/**
 * Beregner rente for en periode med fast rentesats
 */
const calculatePeriodInterest = (amount: number, rate: number, startDate: Date, endDate: Date): number => {
  if (startDate > endDate) {
    return 0.0;
  }

  let totalInterest = 0.0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const yearEnd = createDate(currentDate.getUTCFullYear(), 11, 31);
    const periodEnd = endDate < yearEnd ? new Date(endDate.getTime()) : new Date(yearEnd.getTime());

    const days = countInclusiveUtcDays(currentDate, periodEnd);
    if (days === null) {
      throw new Error('calculatePeriodInterest expected endDate >= startDate');
    }
    const daysInYear = getDaysInYear(currentDate.getUTCFullYear());
    const yearInterest = (amount * rate / 100 * days) / daysInYear;

    totalInterest += yearInterest;

    currentDate = createDate(currentDate.getUTCFullYear() + 1, 0, 1);
    if (currentDate > endDate) {
      break;
    }
  }

  return totalInterest;
};

/**
 * Genererer detaljeret specifikation med halvårlige perioder
 */
const generateDetailedSpecification = (
  amount: string | number,
  interestStartDate: string,
  calculationDate: string
): RentePeriod[] => {
  const startDate = parseDanishDate(interestStartDate);
  const endDate = parseDanishDate(calculationDate);

  if (!startDate || !endDate || startDate > endDate) {
    return [];
  }

  const amountNum = parseAmountInput(amount);

  if (Number.isNaN(amountNum)) {
    return [];
  }

  const surchargeRate = calculateSurchargeRate(startDate);
  const periods: RentePeriod[] = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    let periodEnd;
    if (currentDate.getUTCMonth() < 6) {
      periodEnd = createDate(currentDate.getUTCFullYear(), 5, 30);
    } else {
      periodEnd = createDate(currentDate.getUTCFullYear(), 11, 31);
    }

    if (periodEnd > endDate) {
      periodEnd = new Date(endDate.getTime());
    }

    if (currentDate <= periodEnd) {
      const referenceRate = findRatePctOnDate(referenceRates, currentDate);
      const totalRate = referenceRate + surchargeRate;

      const days = countInclusiveUtcDays(currentDate, periodEnd);
    if (days === null) {
      throw new Error('calculatePeriodInterest expected endDate >= startDate');
    }
      const periodInterest = calculatePeriodInterest(amountNum, totalRate, currentDate, periodEnd);

      periods.push({
        startDate: new Date(currentDate),
        endDate: new Date(periodEnd),
        amount: amountNum,
        referenceRate,
        surchargeRate,
        totalRate,
        days,
        interest: periodInterest,
      });
    }

    if (periodEnd.getUTCMonth() === 5) {
      currentDate = createDate(periodEnd.getUTCFullYear(), 6, 1);
    } else {
      currentDate = createDate(periodEnd.getUTCFullYear() + 1, 0, 1);
    }

    if (currentDate > endDate) {
      break;
    }
  }

  return periods;
};

/**
 * Generer og download PDF for procesrenteberegning
 *
 * @param {string|number} amount - Hovedstol
 * @param {string} interestStartDate - Rentens startdato (dd-mm-åååå)
 * @param {string} calculationDate - Beregningens slutdato (dd-mm-åååå)
 * @param {RentePdfOptions} options - Valgfrie indstillinger
 */
export const generateRentePdf = (
  amount: string | number,
  interestStartDate: string,
  calculationDate: string,
  options: RentePdfOptions = {}
): void => {
  const { visBrevhoved = false, stamdata = null, kommentarer } = options;
  // Generer detaljeret specifikation
  const periods = generateDetailedSpecification(amount, interestStartDate, calculationDate);

  if (!periods || periods.length === 0) {
    throw new Error('Ingen perioder fundet for renteberegning');
  }

  const startDate = parseDanishDate(interestStartDate);
  const endDate = parseDanishDate(calculationDate);

  if (!startDate || !endDate) {
    throw new Error('Ugyldige datoer for renteberegning');
  }

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  writer.setProperties({
    title: 'Procesrente',
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: 'mineo.dk',
  });

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  // Tilføj titel
  writer.writeTitle('Procesrente');

  // Tilføj beregningsbeskrivelse
  addDescription(writer, amount, startDate, endDate);

  // Tilføj specifikationstabel
  addSpecificationTable(writer, periods, endDate);

  // Tilføj beregningsprincipper
  addCalculationPrinciples(writer, kommentarer);

  // Tilføj footer med versionsnummer
  writer.addFooter();

  // Generer filnavn
  const amountNum = parseAmountInput(amount);
  const baseTitle = buildRentePdfBaseTitle(amountNum, startDate, endDate);
  const filename = buildRentePdfFilename(baseTitle, stamdata?.journalnr);

  // Download PDF
  writer.save(filename);
};


/**
 * Tilføj beregningsbeskrivelse
 */
const addDescription = (
  writer: PdfWriter,
  amount: string | number,
  startDate: Date,
  endDate: Date
): void => {
  const amountNum = parseAmountInput(amount);

  const lines = [
    `Hovedstol: ${formatAmount(amountNum)} kr.`,
    `Periode: ${formatDanishDate(startDate)} - ${formatDanishDate(endDate)} (begge dage inkl.)`,
  ];

  for (const line of lines) {
    writer.writeWrappedText(line);
  }
  writer.addSpacer(PDF_BASE_LINE_HEIGHT_MM);
};

/**
 * Finder seneste dato i referenceRates
 */
const findLatestReferenceRateDate = (): Date | null => {
  let latestDate: Date | null = null;

  for (const entry of referenceRates) {
    const entryDate = parseDanishDate(entry.effectiveDate);
    if (!entryDate) continue;

    // Beregn slutdato for denne halvårlige periode
    let periodEnd: Date;
    if (entryDate.getUTCMonth() < 6) {
      // Første halvår (Jan-Jun) - slutter 30. juni
      periodEnd = createDate(entryDate.getUTCFullYear(), 5, 30);
    } else {
      // Andet halvår (Jul-Dec) - slutter 31. december
      periodEnd = createDate(entryDate.getUTCFullYear(), 11, 31);
    }

    if (!latestDate || periodEnd > latestDate) {
      latestDate = periodEnd;
    }
  }

  return latestDate;
};

/**
 * Tilføj specifikationstabel
 */
const addSpecificationTable = (
  writer: PdfWriter,
  periods: ReadonlyArray<RentePeriod>,
  endDate: Date
): void => {
  const doc = writer.getDoc();
  const startY = writer.getY();
  // Forbered tabeldata
  const tableData: RowInput[] = [];

  // Header-række
  tableData.push([
    createPdfTableHeaderCell('Periode', 'left'),
    createPdfTableHeaderCell('Rentedage', 'center'),
    createPdfTableHeaderCell('Rentesats', 'center'),
    createPdfTableHeaderCell('Beregnet rente', 'right'),
  ]);

  // Data-rækker
  for (const period of periods) {
    tableData.push([
      createPdfTableCell(`${formatDanishDate(period.startDate)} - ${formatDanishDate(period.endDate)}`, { halign: 'left' }),
      createPdfTableCell(`${period.days}`, { halign: 'center' }),
      createPdfTableCell(formatPercent(period.totalRate), { halign: 'center' }),
      createPdfTableCell(`${formatAmount(period.interest)} kr.`, { halign: 'right' }),
    ]);
  }

  // Tjek om beregningen rækker ud over kendte satser
  const latestRateDate = findLatestReferenceRateDate();
  const isHypothetical = latestRateDate && endDate > latestRateDate;

  const totalRow = createPdfTableSummedTotalRow(
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

  // Advarsel om hypotetisk beregning (hvis relevant)
  if (isHypothetical) {
    writer.setFontSize(10);
    writer.setFont('helvetica', 'bold');
    writer.writeWrappedText(
      `Der er kun fastsat procesrente frem til ${formatDanishDate(latestRateDate)}. Beregning derefter er hypotetisk!`
    );
    writer.setNormalTextStyle();
    writer.addSpacer(PDF_SECTION_HEADING_GAP);
    tableStartY = writer.getY();
  }

  const finalY = renderEoStylePdfTable({
    doc,
    startY: tableStartY,
    body: tableData,
    columnStyles: createPdfDistributedColumnStyles(4, {
      fixedColumns: {
        1: PDF_TABLE_NARROW_COLUMN_WIDTH,
        2: PDF_TABLE_NARROW_COLUMN_WIDTH,
        3: 35,
      },
    }),
    underlinedCellPositions: totalRowIndex === null || totalRow === null
      ? []
      : [{ rowIndex: totalRowIndex, columnIndex: totalRow.valueCellColumnIndex }],
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

  writer.setY(
    resolvePdfSectionEndY(finalY, tableStartY, {
      spacer: SECTION_SPACER - PDF_BASE_LINE_HEIGHT_MM,
    })
  );
};

/**
 * Tilføj beregningsprincipper
 */
const addCalculationPrinciples = (
  writer: PdfWriter,
  kommentarer: string | undefined
): void => {
  const normalizedKommentarer = typeof kommentarer === 'string' ? kommentarer.trim() : '';

  if (normalizedKommentarer !== '') {
    writer.writeSubheader('Kommentarer', (3 * PDF_BASE_LINE_HEIGHT_MM) + SECTION_SPACER);
    writer.writeWrappedText(normalizedKommentarer);
  }

  writer.writeSubheader('Beregningsprincipper', (3 * PDF_BASE_LINE_HEIGHT_MM) + SECTION_SPACER);
  // Domænebeslutning: PDF viser de overordnede beregningsprincipper.
  // Periode- og satsdetaljer dokumenteres i specifikationstabellen.
  const principles = RENTE_CALCULATION_PRINCIPLES;

  for (const principle of principles) {
    writer.writeWrappedText(principle);
  }
  writer.addSpacer(SECTION_SPACER);
};

/**
 * PDF Generator for Procesrenteberegning
 *
 * Genererer detaljeret specifikation af renteberegning med halvårlige perioder
 */

import {
  PDF_SECTION_HEADING_GAP,
  PDF_TABLE_NARROW_COLUMN_WIDTH,
  SECTION_SPACER,
} from './pdfConfig';
import {
  PDF_BASE_LINE_HEIGHT_MM,
  resolvePdfSectionEndY,
  formatAmount,
  formatPercent,
  type BrevhovedData
} from './pdfHelpers';
import { createStandardPdfWriter, type PdfWriter } from './pdfWriter';
import type { RowInput } from 'jspdf-autotable';
import {
  createPdfTableCell,
  createPdfTableHeaderCell,
  createPdfTableTransparentRow,
  renderEoStylePdfTable,
} from './pdfTableRenderer';
import { createDate, formatDanishDate, getDaysInYear, parseDanishDate } from '../dateUtils';
import { countInclusiveUtcDays } from '../utcDayMath';
import { logError } from '../logger';
import type { RateEntry } from '../../data/interestRates';
import { referenceRates, surchargeRates } from '../../data/interestRates';
import { TODAY } from '../../config/dateRanges';
import type { PdfCommonOptions, PdfStamdata } from './pdfOptions';

/**
 * Stamdata til Rente PDF
 */
type RentePdfOptions = PdfCommonOptions & Readonly<{ stamdata?: PdfStamdata | null }>;

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

const parseAmountInput = (value: string | number): number => {
  if (typeof value === 'number') return value;
  return Number.parseFloat(value.replace(/\./g, '').replace(',', '.'));
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

  if (isNaN(amountNum)) {
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
  const { visBrevhoved = false, stamdata = null } = options;
  // Generer detaljeret specifikation
  const periods = generateDetailedSpecification(amount, interestStartDate, calculationDate);

  if (!periods || periods.length === 0) {
    logError('Ingen perioder fundet for renteberegning', {
      context: 'rentePdf.generateRentePdf',
      error: new Error('No periods generated'),
    });
    return;
  }

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');

  // Dokumentets metadata
  const startDate = parseDanishDate(interestStartDate);
  const endDate = parseDanishDate(calculationDate);

  if (!startDate || !endDate) {
    logError('Ugyldige datoer for renteberegning', {
      context: 'rentePdf.generateRentePdf',
      error: new Error('Invalid interest date range'),
    });
    return;
  }

  writer.setProperties({
    title: 'Procesrente',
    subject: 'Renteberegning',
    author: 'MINEO',
    creator: 'MINEO',
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
  addCalculationPrinciples(writer, startDate);

  // Tilføj footer med versionsnummer
  writer.addFooter();

  // Generer filnavn
  const amountNum = parseAmountInput(amount);
  const filename = `Procesrente af ${formatAmount(amountNum)} kr. - ${formatDanishDate(startDate)} til ${formatDanishDate(endDate)}.pdf`;

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
  // Beregn total rente
  const totalInterest = periods.reduce((sum, p) => sum + p.interest, 0);

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

  // Tom række
  tableData.push(createPdfTableTransparentRow(4));

  // Total-række
  tableData.push([
    createPdfTableCell('Samlet rentebeløb', { halign: 'left', bold: true, transparent: true }),
    createPdfTableCell('', { bold: true, transparent: true }),
    createPdfTableCell('', { bold: true, transparent: true }),
    createPdfTableCell(formatAmount(totalInterest) + ' kr.', { halign: 'right', bold: true, transparent: true }),
  ]);

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
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: PDF_TABLE_NARROW_COLUMN_WIDTH },
      2: { cellWidth: PDF_TABLE_NARROW_COLUMN_WIDTH },
      3: { cellWidth: 35 },
    },
    transparentRowIndices: [tableData.length - 2, tableData.length - 1],
  });

  writer.setY(resolvePdfSectionEndY(finalY, startY));
};

/**
 * Tilføj beregningsprincipper
 */
const addCalculationPrinciples = (
  writer: PdfWriter,
  startDate: Date
): void => {
  writer.writeSubheader('Beregningsprincipper', (3 * PDF_BASE_LINE_HEIGHT_MM) + SECTION_SPACER);
  // Bestem forfaldsdato-tekst og tillægssats
  const surchargeChangeDate = createDate(2013, 2, 1); // 1. marts 2013
  let forfaldText: string;
  let surchargeText: string;

  if (startDate < surchargeChangeDate) {
    forfaldText = 'før 1. marts 2013';
    surchargeText = '7 %';
  } else {
    forfaldText = 'fra 1. marts 2013';
    surchargeText = '8 %';
  }

  const principles = [
    '• Beregning sker på baggrund af 365 årlige rentedage (366 i skudår).',
    '• Forfaldsdato er ' + forfaldText + '. Rentesats udgør derfor nationalbankens udlånsrente tillagt ' + surchargeText + '.',
    '• Der beregnes ikke renters rente.',
  ];

  for (const principle of principles) {
    writer.writeWrappedText(principle);
  }
  writer.addSpacer(SECTION_SPACER);
};

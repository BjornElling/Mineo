/**
 * PDF Generator for Procesrenteberegning
 *
 * Genererer detaljeret specifikation af renteberegning med halvårlige perioder
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COLORS, MARGINS, FONT_SIZES, TABLE_STYLES, SECTION_SPACER } from './pdfConfig';
import { formatCurrency } from './pdfFormatters';
import { VERSION } from '../../config/version';
import { referenceRates } from '../../data/interestRates';

/**
 * Beregner antal dage i et givet år (365 eller 366)
 */
const getDaysInYear = (year) => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
};

/**
 * Beregner antal dage mellem to datoer (inklusiv begge dage)
 * Bruger UTC for at undgå timezone-problemer
 */
const getDaysBetween = (startDate, endDate) => {
  // Brug UTC-versioner af datoerne for at undgå sommertid/vintertid-problemer
  const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  const oneDay = 1000 * 60 * 60 * 24;
  const diffDays = (endUtc - startUtc) / oneDay;

  // +1 fordi begge dage er inkluderet
  return diffDays + 1;
};

/**
 * Parser dansk datoformat (dd-mm-åååå) til Date-objekt
 */
const parseDanishDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    return null;
  }

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  date.setFullYear(year);

  return date;
};

/**
 * Formaterer dato til dansk format (DD-MM-YYYY)
 */
const formatDanishDate = (date) => {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Formaterer beløb til dansk format med tusindtalsseparator
 */
const formatAmount = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0,00';
  }

  return amount.toLocaleString('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Formaterer procent til dansk format
 */
const formatPercent = (percent) => {
  return `${percent.toFixed(2).replace('.', ',')} %`;
};

/**
 * Parser rentesats-string til numerisk værdi
 */
const parseRate = (rateStr) => {
  const cleaned = rateStr.replace(/[%\s]/g, '').replace(',', '.').replace('−', '-');
  return parseFloat(cleaned);
};

/**
 * Finder den gældende referencesats på en specifik dato
 */
const findReferenceRateOnDate = (targetDate) => {
  const ratesWithDates = referenceRates
    .map((entry) => ({
      date: parseDanishDate(entry.effectiveDate),
      rate: parseRate(entry.rate),
    }))
    .filter((entry) => entry.date !== null)
    .sort((a, b) => a.date - b.date);

  let applicableRate = null;

  for (const entry of ratesWithDates) {
    if (entry.date <= targetDate) {
      applicableRate = entry.rate;
    } else {
      break;
    }
  }

  if (applicableRate === null) {
    throw new Error(`Ingen referencesats fundet for dato ${targetDate.toLocaleDateString('da-DK')}`);
  }

  return applicableRate;
};

/**
 * Beregner tillægssats baseret på faktisk rentedato
 */
const calculateSurchargeRate = (interestStartDate) => {
  const surchargeChangeDate = new Date(2013, 2, 1); // 1. marts 2013
  return interestStartDate < surchargeChangeDate ? 7.0 : 8.0;
};

/**
 * Beregner rente for en periode med fast rentesats
 */
const calculatePeriodInterest = (amount, rate, startDate, endDate) => {
  if (startDate > endDate) {
    return 0.0;
  }

  let totalInterest = 0.0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const yearEnd = new Date(currentDate.getFullYear(), 11, 31);
    const periodEnd = endDate < yearEnd ? new Date(endDate.getTime()) : new Date(yearEnd.getTime());

    const days = getDaysBetween(currentDate, periodEnd);
    const daysInYear = getDaysInYear(currentDate.getFullYear());
    const yearInterest = (amount * rate / 100 * days) / daysInYear;

    totalInterest += yearInterest;

    currentDate = new Date(currentDate.getFullYear() + 1, 0, 1);
    if (currentDate > endDate) {
      break;
    }
  }

  return totalInterest;
};

/**
 * Genererer detaljeret specifikation med halvårlige perioder
 */
const generateDetailedSpecification = (amount, interestStartDate, calculationDate) => {
  const startDate = parseDanishDate(interestStartDate);
  const endDate = parseDanishDate(calculationDate);

  if (!startDate || !endDate || startDate > endDate) {
    return [];
  }

  const amountNum = typeof amount === 'string'
    ? parseFloat(amount.replace(/\./g, '').replace(',', '.'))
    : Number(amount);

  if (isNaN(amountNum) || amountNum <= 0) {
    return [];
  }

  const surchargeRate = calculateSurchargeRate(startDate);
  const periods = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    let periodEnd;
    if (currentDate.getMonth() < 6) {
      periodEnd = new Date(currentDate.getFullYear(), 5, 30);
    } else {
      periodEnd = new Date(currentDate.getFullYear(), 11, 31);
    }

    if (periodEnd > endDate) {
      periodEnd = new Date(endDate.getTime());
    }

    if (currentDate <= periodEnd) {
      const referenceRate = findReferenceRateOnDate(currentDate);
      const totalRate = referenceRate + surchargeRate;

      const days = getDaysBetween(currentDate, periodEnd);
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

    if (periodEnd.getMonth() === 5) {
      currentDate = new Date(periodEnd.getFullYear(), 6, 1);
    } else {
      currentDate = new Date(periodEnd.getFullYear() + 1, 0, 1);
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
 */
export const generateRentePdf = (amount, interestStartDate, calculationDate) => {
  // Generer detaljeret specifikation
  const periods = generateDetailedSpecification(amount, interestStartDate, calculationDate);

  if (!periods || periods.length === 0) {
    console.error('Ingen perioder fundet for renteberegning');
    return;
  }

  // Opret nyt PDF-dokument (A4, portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Dokumentets metadata
  const startDate = parseDanishDate(interestStartDate);
  const endDate = parseDanishDate(calculationDate);

  doc.setProperties({
    title: 'Procesrente',
    subject: 'Renteberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  let currentY = MARGINS.top;

  // Tilføj titel
  currentY = addTitle(doc, 'Procesrente', currentY);

  // Tilføj beregningsbeskrivelse
  currentY = addDescription(doc, amount, startDate, endDate, currentY);

  // Tilføj specifikationstabel
  currentY = addSpecificationTable(doc, periods, endDate, currentY);

  // Tilføj beregningsprincipper
  currentY = addCalculationPrinciples(doc, startDate, currentY);

  // Tilføj footer med versionsnummer
  addFooter(doc);

  // Generer filnavn
  const amountNum = typeof amount === 'string'
    ? parseFloat(amount.replace(/\./g, '').replace(',', '.'))
    : Number(amount);
  const filename = `Procesrente af ${formatAmount(amountNum)} kr. - ${formatDanishDate(startDate)} til ${formatDanishDate(endDate)}.pdf`;

  // Download PDF
  doc.save(filename);
};

/**
 * Tilføj titel til dokumentet
 */
const addTitle = (doc, title, startY) => {
  doc.setFontSize(FONT_SIZES.title);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGINS.left, startY);

  return startY + 15;
};

/**
 * Tilføj beregningsbeskrivelse
 */
const addDescription = (doc, amount, startDate, endDate, startY) => {
  const amountNum = typeof amount === 'string'
    ? parseFloat(amount.replace(/\./g, '').replace(',', '.'))
    : Number(amount);

  doc.setFontSize(FONT_SIZES.normal);
  doc.setFont('helvetica', 'normal');

  const lines = [
    `Hovedstol: ${formatAmount(amountNum)} kr.`,
    `Periode: ${formatDanishDate(startDate)} - ${formatDanishDate(endDate)} (begge dage inkl.)`,
  ];

  let y = startY;
  for (const line of lines) {
    doc.text(line, MARGINS.left, y);
    y += 6;
  }

  return y + 6; // Ekstra mellemrum før tabel
};

/**
 * Finder seneste dato i referenceRates
 */
const findLatestReferenceRateDate = () => {
  let latestDate = null;

  for (const entry of referenceRates) {
    const entryDate = parseDanishDate(entry.effectiveDate);
    if (!entryDate) continue;

    // Beregn slutdato for denne halvårlige periode
    let periodEnd;
    if (entryDate.getMonth() < 6) {
      // Første halvår (Jan-Jun) - slutter 30. juni
      periodEnd = new Date(entryDate.getFullYear(), 5, 30);
    } else {
      // Andet halvår (Jul-Dec) - slutter 31. december
      periodEnd = new Date(entryDate.getFullYear(), 11, 31);
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
const addSpecificationTable = (doc, periods, endDate, startY) => {
  // Beregn total rente
  const totalInterest = periods.reduce((sum, p) => sum + p.interest, 0);

  // Forbered tabeldata
  const tableData = [];

  // Header-række
  tableData.push([
    { content: 'Periode', styles: { fontStyle: 'bold', halign: 'left' } },
    { content: 'Rentedage', styles: { fontStyle: 'bold', halign: 'center' } },
    { content: 'Rentesats', styles: { fontStyle: 'bold', halign: 'center' } },
    { content: 'Beregnet rente', styles: { fontStyle: 'bold', halign: 'right' } },
  ]);

  // Data-rækker
  for (const period of periods) {
    tableData.push([
      { content: `${formatDanishDate(period.startDate)} - ${formatDanishDate(period.endDate)}`, styles: { halign: 'left' } },
      { content: `${period.days}`, styles: { halign: 'center' } },
      { content: formatPercent(period.totalRate), styles: { halign: 'center' } },
      { content: `${formatAmount(period.interest)} kr.`, styles: { halign: 'right' } },
    ]);
  }

  // Tjek om beregningen rækker ud over kendte satser
  const latestRateDate = findLatestReferenceRateDate();
  const isHypothetical = latestRateDate && endDate > latestRateDate;

  // Tom række
  tableData.push([
    { content: '', styles: { fillColor: COLORS.white } },
    { content: '', styles: { fillColor: COLORS.white } },
    { content: '', styles: { fillColor: COLORS.white } },
    { content: '', styles: { fillColor: COLORS.white } },
  ]);

  // Total-række
  tableData.push([
    { content: 'Samlet rentebeløb', styles: { fontStyle: 'bold', halign: 'left', fillColor: COLORS.white } },
    { content: '', styles: { fontStyle: 'bold', fillColor: COLORS.white } },
    { content: '', styles: { fontStyle: 'bold', fillColor: COLORS.white } },
    { content: `${formatAmount(totalInterest)} kr.`, styles: { fontStyle: 'bold', halign: 'right', fillColor: COLORS.white } },
  ]);

  let tableStartY = startY;

  // Advarsel om hypotetisk beregning (hvis relevant)
  if (isHypothetical) {
    doc.setFontSize(FONT_SIZES.normal);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Der er kun fastsat procesrente frem til ${formatDanishDate(latestRateDate)}. Beregning derefter er hypotetisk!`,
      MARGINS.left,
      tableStartY,
    );
    tableStartY += 8; // Skab luft mellem advarsel og tabel
  }

  autoTable(doc, {
    startY: tableStartY,
    head: [],
    body: tableData,
    margin: { left: MARGINS.left, right: MARGINS.right },
    styles: {
      font: 'helvetica',
      fontSize: TABLE_STYLES.fontSize,
      cellPadding: 1.5, // Reduceret fra 2 til 1.5 for at spare plads
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 35 },
    },
    didParseCell: function (data) {
      // Header-række får lysegrå baggrund
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
      }
      // Alternerende rækker (ekskl. header, tom række og total)
      else if (data.row.index > 0 && data.row.index < tableData.length - 2) {
        // Alternerende baggrund for data-rækker
        if (data.row.index % 2 === 0) {
          data.cell.styles.fillColor = TABLE_STYLES.alternateRowBackgroundColor;
        } else {
          data.cell.styles.fillColor = COLORS.white;
        }
      }
    },
  });

  const finalY = doc.lastAutoTable?.finalY || startY + 50;
  return finalY + SECTION_SPACER;
};

/**
 * Tilføj beregningsprincipper
 */
const addCalculationPrinciples = (doc, startDate, startY) => {
  doc.setFontSize(FONT_SIZES.normal);
  doc.setFont('helvetica', 'bold');
  doc.text('Beregningsprincipper:', MARGINS.left, startY);

  let y = startY + 6;

  doc.setFont('helvetica', 'normal');

  // Bestem forfaldsdato-tekst og tillægssats
  const surchargeChangeDate = new Date(2013, 2, 1); // 1. marts 2013
  let forfaldText, surchargeText;

  if (startDate < surchargeChangeDate) {
    forfaldText = 'før 1. marts 2013';
    surchargeText = '7 %';
  } else {
    forfaldText = 'fra 1. marts 2013';
    surchargeText = '8 %';
  }

  const principles = [
    '• Beregning sker på baggrund af 365 årlige rentedage (366 i skudår).',
    `• Forfaldsdato er ${forfaldText}. Rentesats udgør derfor nationalbankens udlånsrente tillagt ${surchargeText}.`,
    '• Der beregnes ikke renters rente.',
  ];

  for (const principle of principles) {
    doc.text(principle, MARGINS.left, y);
    y += 6;
  }

  return y + SECTION_SPACER;
};

/**
 * Tilføj footer med versionsnummer
 */
const addFooter = (doc) => {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;

  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);

  const footerText = `Mineo.dk // ${VERSION}`;
  const x = pageWidth - 5;
  const y = pageHeight - 5;

  doc.text(footerText, x, y, { angle: 90 });
};

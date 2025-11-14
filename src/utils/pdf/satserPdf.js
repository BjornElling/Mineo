/**
 * PDF Generator for Arbejdsskadesatser
 *
 * Genererer PDF-dokument med årlige satser for arbejdsskadeområdet
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  COLORS,
  MARGINS,
  FONT_SIZES,
  TABLE_STYLES,
  SECTION_SPACER,
} from './pdfConfig';
import {
  formatCurrency,
  formatCurrencyPerUnit,
  formatPercentage,
  isGreaterThanZero,
  isNonEmptyString,
} from './pdfFormatters';

/**
 * Generer og download PDF for arbejdsskadesatser
 *
 * @param {number} year - Året satserne gælder for
 * @param {Object} satser - Satser data fra getSatserForYear()
 */
export const generateSatserPdf = (year, satser) => {
  // Opret nyt PDF-dokument (A4, portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Dokumentets metadata
  doc.setProperties({
    title: `Arbejdsskadesatser ${year}`,
    subject: 'Erstatningsberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  let currentY = MARGINS.top;

  // Tilføj titel
  currentY = addTitle(doc, `Arbejdsskadesatser ${year}`, currentY);

  // Tilføj Erstatningsansvarsloven sektion
  if (satser && satser.eal) {
    currentY = addEalSection(doc, satser.eal, currentY);
  }

  // Tilføj Arbejdsskadesikringsloven sektion
  if (satser && satser.asl) {
    currentY = addAslSection(doc, satser.asl, currentY);
  }

  // Tilføj Diverse sektion
  if (satser && satser.diverse) {
    currentY = addDiverseSection(doc, satser.diverse, currentY);
  }

  // Tilføj Referencer sektion
  if (satser && satser.referencer) {
    currentY = addReferenserSection(doc, satser.referencer, currentY);
  }

  // Download PDF
  doc.save(`Arbejdsskadesatser ${year}.pdf`);
};

/**
 * Tilføj titel til dokumentet
 */
const addTitle = (doc, title, startY) => {
  doc.setFontSize(FONT_SIZES.title);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGINS.left, startY);

  return startY + 15; // Retur ny Y-position
};

/**
 * Tilføj Erstatningsansvarsloven sektion
 */
const addEalSection = (doc, eal, startY) => {
  const rows = [];

  // Godtgørelse for svie og smerte
  if (isGreaterThanZero(eal.svieSmertePrDag)) {
    rows.push([
      'Godtgørelse for svie og smerte',
      formatCurrencyPerUnit(eal.svieSmertePrDag, 'sygedag'),
    ]);
  }

  // Maksimum for svie og smerte
  if (isGreaterThanZero(eal.svieSmerteMax)) {
    rows.push(['Maksimum for svie og smerte', formatCurrency(eal.svieSmerteMax)]);
  }

  // Maksimum for erhvervsevnetabserstatning
  if (isGreaterThanZero(eal.erhvervsevnetabMax)) {
    rows.push([
      'Maksimum for erhvervsevnetabserstatning',
      formatCurrency(eal.erhvervsevnetabMax),
    ]);
  }

  // Vejledende udtalelse
  if (isGreaterThanZero(eal.vejledendeUdtalelse)) {
    rows.push([
      'Vejledende udtalelse om erhvervsevnetab',
      formatCurrency(eal.vejledendeUdtalelse),
    ]);
  }

  if (rows.length > 0) {
    return addTable(doc, rows, 'Erstatningsansvarsloven', startY);
  }

  return startY;
};

/**
 * Tilføj Arbejdsskadesikringsloven sektion
 */
const addAslSection = (doc, asl, startY) => {
  const rows = [];

  // Godtgørelse for varige mén
  if (isGreaterThanZero(asl.varigeMenPrGrad)) {
    rows.push([
      'Godtgørelse for varige mén',
      formatCurrencyPerUnit(asl.varigeMenPrGrad, 'méngrad'),
    ]);
  }

  // Maksimum årsløn
  if (isGreaterThanZero(asl.aarslonMax)) {
    rows.push(['Maksimum årsløn', formatCurrency(asl.aarslonMax)]);
  }

  // Minimum årsløn
  if (isGreaterThanZero(asl.aarslonMin)) {
    rows.push(['Minimum årsløn', formatCurrency(asl.aarslonMin)]);
  }

  // Minimum årsløn (skader før 1.7.2024)
  if (isGreaterThanZero(asl.aarslonMinFoer2024)) {
    rows.push([
      'Minimum årsløn (skader før 1.7.2024)',
      formatCurrency(asl.aarslonMinFoer2024),
    ]);
  }

  // Minimum årsløn (skader fra 1.7.2024)
  if (isGreaterThanZero(asl.aarslonMinFra2024)) {
    rows.push([
      'Minimum årsløn (skader fra 1.7.2024)',
      formatCurrency(asl.aarslonMinFra2024),
    ]);
  }

  // Overgangsbeløb
  if (isGreaterThanZero(asl.overgangsbelob)) {
    rows.push(['Overgangsbeløb', formatCurrency(asl.overgangsbelob)]);
  }

  // Reguleringsprocent for erhvervsevnetab
  if (isGreaterThanZero(asl.reguleringProcentErhvervsevnetab)) {
    rows.push([
      'Reguleringsprocent for erhvervsevnetab',
      formatPercentage(asl.reguleringProcentErhvervsevnetab),
    ]);
  }

  // Reguleringsprocent for erhvervsevnetab (før 2024)
  if (isGreaterThanZero(asl.reguleringProcentErhvervsevnetabFoer2024)) {
    rows.push([
      'Reguleringsprocent for erhvervsevnetab (før 2024)',
      formatPercentage(asl.reguleringProcentErhvervsevnetabFoer2024),
    ]);
  }

  // Reguleringsprocent for erhvervsevnetab (fra 2024)
  if (isGreaterThanZero(asl.reguleringProcentErhvervsevnetabFra2024)) {
    rows.push([
      'Reguleringsprocent for erhvervsevnetab (fra 2024)',
      formatPercentage(asl.reguleringProcentErhvervsevnetabFra2024),
    ]);
  }

  if (rows.length > 0) {
    return addTable(doc, rows, 'Arbejdsskadesikringsloven', startY);
  }

  return startY;
};

/**
 * Tilføj Diverse sektion
 */
const addDiverseSection = (doc, diverse, startY) => {
  const rows = [];

  // Beløbsgrænse for fri proces
  const enlig = diverse.friProcesEnlig;
  const samlevende = diverse.friProcesSamlevende;
  const barn = diverse.friProcesBarn;

  if (
    isGreaterThanZero(enlig) &&
    isGreaterThanZero(samlevende) &&
    isGreaterThanZero(barn)
  ) {
    const text =
      `${formatCurrency(enlig)} (enlig) / ${formatCurrency(samlevende)} (samlevende)\n` +
      `+ ${formatCurrency(barn)} per barn under 18 år`;
    rows.push(['Beløbsgrænse for fri proces', text]);
  }

  // Reguleringssats
  if (isGreaterThanZero(diverse.reguleringssats)) {
    rows.push(['Reguleringssats', formatPercentage(diverse.reguleringssats)]);
  }

  if (rows.length > 0) {
    return addTable(doc, rows, 'Diverse', startY);
  }

  return startY;
};

/**
 * Tilføj Referencer sektion
 */
const addReferenserSection = (doc, referencer, startY) => {
  const rows = [];

  const mapping = [
    { key: 'ealReference', label: 'Erstatningsansvarsloven' },
    { key: 'aslReference', label: 'Arbejdsskadesikringsloven' },
    { key: 'kapitalisering', label: 'Kapitalisering' },
    {
      key: 'kapitaliseringSkadeFra2011',
      label: 'Kapitalisering (skade fra 1.1.2011)',
    },
    {
      key: 'kapitaliseringSkadeFoer2011',
      label: 'Kapitalisering (skade før 1.1.2011)',
    },
    {
      key: 'kapitaliseringSkadeFra2007',
      label: 'Kapitalisering (skade fra 1.7.2007)',
    },
    {
      key: 'kapitaliseringSkadeFoer2007',
      label: 'Kapitalisering (skade før 1.7.2007)',
    },
    { key: 'friProcesReference', label: 'Fri proces' },
    { key: 'reguleringssatsReference', label: 'Reguleringssatser' },
  ];

  for (const m of mapping) {
    const value = referencer[m.key];
    if (isNonEmptyString(value)) {
      rows.push([m.label, value.trim()]);
    }
  }

  if (rows.length > 0) {
    return addTable(doc, rows, 'Referencer', startY);
  }

  return startY;
};

/**
 * Tilføj tabel med header og data
 */
const addTable = (doc, rows, header, startY) => {
  // Tilføj header-række
  const tableData = [[{ content: header, colSpan: 2, styles: { fontStyle: 'bold' } }], ...rows];

  autoTable(doc, {
    startY: startY,
    head: [],
    body: tableData,
    margin: { left: MARGINS.left, right: MARGINS.right },
    styles: {
      font: 'helvetica',
      fontSize: TABLE_STYLES.fontSize,
      cellPadding: TABLE_STYLES.cellPadding,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 80, halign: 'right' },
    },
    didParseCell: function (data) {
      // Header-række (index 0) får lysegrå baggrund
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
      }
      // Alternerende rækker: lige rækker (2, 4, 6...) får lysegrå, ulige rækker (1, 3, 5...) får hvid
      else if (data.row.index % 2 === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.alternateRowBackgroundColor;
      } else {
        data.cell.styles.fillColor = COLORS.white;
      }
    },
  });

  // Returner ny Y-position efter tabel + spacing
  // autoTable gemmer finalY på doc objektet
  const finalY = doc.lastAutoTable?.finalY || startY + 50;
  return finalY + SECTION_SPACER;
};

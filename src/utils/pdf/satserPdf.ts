/**
 * PDF Generator for Arbejdsskadesatser
 *
 * Genererer PDF-dokument med årlige satser for arbejdsskadeområdet
 */

import {
  PDF_SECTION_HEADING_GAP,
} from './pdfConfig';
import { formatCurrency, formatPercent } from '../formatUtils';
import { addSectionHeading, resolvePdfSectionEndY, type BrevhovedData } from './pdfHelpers';
import { createStandardPdfWriter } from './pdfWriter';
import { createJsPdfAdapter } from './jsPdfAdapter';
import { renderEoStylePdfTable } from './pdfTableRenderer';
import { TODAY } from '../../config/dateRanges';
import { formatCurrencyPerUnit } from './pdfFormatUtils';
import { getSatserForYear } from '../../data/regulationRates';
import type { PdfCommonOptions, PdfStamdata } from './pdfOptions';
import type jsPDF from 'jspdf';

type SatserData = ReturnType<typeof getSatserForYear>;
type SatserPdfOptions = PdfCommonOptions & Readonly<{ stamdata?: PdfStamdata | null }>;

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return formatPercent(value);
};

/**
 * Generer og download PDF for arbejdsskadesatser
 *
 * @param {number} year - Året satserne gælder for
 * @param {Object} satser - Satser data fra getSatserForYear()
 * @param {SatserPdfOptions} options - Valgfrie indstillinger
 */
export const generateSatserPdf = (
  year: number,
  satser: SatserData,
  options: SatserPdfOptions = {}
): void => {
  const { visBrevhoved = false, stamdata = null } = options;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');
  const doc = writer.getDoc();

  // Dokumentets metadata
  writer.setProperties({
    title: `Arbejdsskadesatser ${year}`,
    subject: 'Erstatningsberegning',
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
  writer.writeTitle(`Arbejdsskadesatser ${year}`);

  // Tilføj Erstatningsansvarsloven sektion
  if (satser && satser.eal) {
    writer.setY(addEalSection(doc, satser.eal, writer.getY()));
  }

  // Tilføj Arbejdsskadesikringsloven sektion
  if (satser && satser.asl) {
    writer.setY(addAslSection(doc, satser.asl, writer.getY()));
  }

  // Tilføj Diverse sektion
  if (satser && satser.diverse) {
    writer.setY(addDiverseSection(doc, satser.diverse, writer.getY()));
  }

  // Tilføj Referencer sektion
  if (satser && satser.referencer) {
    writer.setY(addReferenserSection(doc, satser.referencer, writer.getY()));
  }

  // Tilføj footer med versionsnummer
  writer.addFooter();

  // Download PDF
  writer.save(`Arbejdsskadesatser ${year}.pdf`);
};


/**
 * Tilføj Erstatningsansvarsloven sektion
 */
const addEalSection = (
  doc: jsPDF,
  eal: SatserData['eal'],
  startY: number
): number => {
  const rows: string[][] = [];

  // Godtgørelse for svie og smerte
  if (isPositiveFiniteNumber(eal.svieSmertePrDag)) {
    rows.push([
      'Godtgørelse for svie og smerte',
      formatCurrencyPerUnit(eal.svieSmertePrDag, 'sygedag'),
    ]);
  }

  // Maksimum for svie og smerte
  if (isPositiveFiniteNumber(eal.svieSmerteMax)) {
    rows.push(['Maksimum for svie og smerte', formatCurrency(eal.svieSmerteMax)]);
  }

  // Maksimum for erhvervsevnetabserstatning
  if (isPositiveFiniteNumber(eal.erhvervsevnetabMax)) {
    rows.push([
      'Maksimum for erhvervsevnetabserstatning',
      formatCurrency(eal.erhvervsevnetabMax),
    ]);
  }

  // Vejledende udtalelse
  if (isPositiveFiniteNumber(eal.vejledendeUdtalelse)) {
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
const addAslSection = (
  doc: jsPDF,
  asl: SatserData['asl'],
  startY: number
): number => {
  const rows: string[][] = [];

  // Godtgørelse for varige mén
  if (isPositiveFiniteNumber(asl.varigeMenPrGrad)) {
    rows.push([
      'Godtgørelse for varige mén',
      formatCurrencyPerUnit(asl.varigeMenPrGrad, 'méngrad'),
    ]);
  }

  // Maksimum årsløn
  if (isPositiveFiniteNumber(asl.aarsloenMax)) {
    rows.push(['Maksimum årsløn', formatCurrency(asl.aarsloenMax)]);
  }

  // Minimum årsløn
  if (isPositiveFiniteNumber(asl.aarsloenMin)) {
    rows.push(['Minimum årsløn', formatCurrency(asl.aarsloenMin)]);
  }

  // Minimum årsløn (skader før 1.7.2024)
  if (isPositiveFiniteNumber(asl.aarsloenMinFoer2024)) {
    rows.push([
      'Minimum årsløn (skader før 1.7.2024)',
      formatCurrency(asl.aarsloenMinFoer2024),
    ]);
  }

  // Minimum årsløn (skader fra 1.7.2024)
  if (isPositiveFiniteNumber(asl.aarsloenMinFra2024)) {
    rows.push([
      'Minimum årsløn (skader fra 1.7.2024)',
      formatCurrency(asl.aarsloenMinFra2024),
    ]);
  }

  // Overgangsbeløb
  if (isPositiveFiniteNumber(asl.overgangsbelob)) {
    rows.push(['Overgangsbeløb', formatCurrency(asl.overgangsbelob)]);
  }

  // Reguleringsprocent for erhvervsevnetab
  if (isPositiveFiniteNumber(asl.reguleringProcentErhvervsevnetab)) {
    rows.push([
      'Reguleringsprocent for erhvervsevnetab',
      formatPercentage(asl.reguleringProcentErhvervsevnetab),
    ]);
  }

  // Reguleringsprocent for erhvervsevnetab (før 2024)
  if (isPositiveFiniteNumber(asl.reguleringProcentErhvervsevnetabFoer2024)) {
    rows.push([
      'Reguleringsprocent for erhvervsevnetab (før 2024)',
      formatPercentage(asl.reguleringProcentErhvervsevnetabFoer2024),
    ]);
  }

  // Reguleringsprocent for erhvervsevnetab (fra 2024)
  if (isPositiveFiniteNumber(asl.reguleringProcentErhvervsevnetabFra2024)) {
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
const addDiverseSection = (
  doc: jsPDF,
  diverse: SatserData['diverse'],
  startY: number
): number => {
  const rows: string[][] = [];

  // Beløbsgrænse for fri proces
  const enlig = diverse.friProcesEnlig;
  const samlevende = diverse.friProcesSamlevende;
  const barn = diverse.friProcesBarn;

  if (
    isPositiveFiniteNumber(enlig) &&
    isPositiveFiniteNumber(samlevende) &&
    isPositiveFiniteNumber(barn)
  ) {
    const text =
      `${formatCurrency(enlig)} (enlig) / ${formatCurrency(samlevende)} (samlevende)\n` +
      `+ ${formatCurrency(barn)} per barn under 18 år`;
    rows.push(['Beløbsgrænse for fri proces', text]);
  }

  // Reguleringssats
  if (isPositiveFiniteNumber(diverse.reguleringssats)) {
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
const addReferenserSection = (
  doc: jsPDF,
  referencer: SatserData['referencer'],
  startY: number
): number => {
  const rows: string[][] = [];

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
    const value = referencer[m.key as keyof SatserData['referencer']];
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
const addTable = (
  doc: jsPDF,
  rows: string[][],
  header: string,
  startY: number
): number => {
  const headingY = addSectionHeading(createJsPdfAdapter(doc), header, startY);
  const tableStartY = headingY - PDF_SECTION_HEADING_GAP;

  const finalY = renderEoStylePdfTable({
    doc,
    startY: tableStartY,
    body: rows,
    hasHeaderRow: false,
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 80, halign: 'right' },
    },
  });

  // Returner ny Y-position efter tabel + spacing
  return resolvePdfSectionEndY(finalY, startY);
};

/**
 * PDF Generator for Årslønsberegning
 *
 * Genererer detaljeret specifikation af årslønsberegning med satser, indtægtsoplysninger og beregning
 */

import jsPDF from 'jspdf';
import type { CellDef, RowInput } from 'jspdf-autotable';
import { MARGINS } from './pdfConfig';
import { addSectionHeading, PDF_BASE_LINE_HEIGHT_MM, resolvePdfSectionEndY, type BrevhovedData } from './pdfHelpers';
import { createStandardPdfWriter } from './pdfWriter';
import { createJsPdfAdapter } from './jsPdfAdapter';
import {
  cellCenter,
  cellLeft,
  cellRight,
  cellRightBold,
  createPdfTableCell,
  createPdfFixedColumnStyles,
  createPdfTableHeaderCell,
  renderEoStylePdfTable,
} from './pdfTableRenderer';
import { calculateAarsloenRowDerived, type AarsloenSatserInput } from '../aarsloenTableCalculations';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { AarsloenTableRow, LoenPaaHelligdage, Loenperiode, StamdataValues } from '../../schemas/formSchemas';
import type { PeriodeResult } from '../periodeBeregning';
import type { AarsloenBeregningResult } from '../../types/calculation';
import { amountValueToDisplayString, amountValueToNumber } from '../expressionAmount';
import { TODAY } from '../../config/dateRanges';
import { formatAsAmount, formatCountWithUnit, formatPercent } from '../formatUtils';
import { resolvePdfFileName } from './pdfFormatUtils';

type PdfDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};
const NBSP = '\u00A0';
const SECTION_HEADING_TO_TABLE_ADJUSTMENT_MM = PDF_BASE_LINE_HEIGHT_MM;

const resolveTableStartYAfterSectionHeading = (headingY: number): number =>
  headingY - SECTION_HEADING_TO_TABLE_ADJUSTMENT_MM;

export const buildAarsloenPdfFilename = (journalnr?: string): string => {
  return resolvePdfFileName('Årslønsberegning', false, journalnr);
};

/**
 * Formaterer beløb til dansk format med tusindtalsseparator
 * Bevarer præcis formatering som indtastet
 */
const formatDanishAmount = (amount: unknown): string => {
  if (amount === null || amount === undefined || amount === '') return '';

  if (typeof amount === 'object' && amount !== null && 'kind' in amount) {
    return amountValueToDisplayString(amount as AmountValue, 2);
  }

  // Hvis amount allerede er en streng (fra input), returner som den er
  if (typeof amount === 'string') {
    return amount;
  }

  if (typeof amount === 'number') {
    return formatAsAmount(amount, 2);
  }

  return '';
};

/**
 * Tjekker om en værdi er tom eller nul
 */
const isEmptyOrZero = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return true;

  if (typeof value === 'object' && value !== null && 'kind' in value) {
    const numericValue = amountValueToNumber(value as AmountValue);
    return numericValue === undefined || numericValue === 0;
  }

  // Konverter til streng og fjern whitespace
  const str = String(value).trim();
  if (str === '' || str === '0' || str === '0,00' || str === '0.00' || str === '0 %' || str === '0,0 %' || str === '0,00 %') return true;

  return false;
};

/**
 * Formaterer procent-værdi til visning i PDF (med komma og procenttegn)
 */
const formatPdfPercent = (pct: unknown): string => {
  if (pct === null || pct === undefined || pct === '') return '';

  if (typeof pct === 'number') {
    return formatPercent(pct);
  }

  if (typeof pct === 'string') {
    const trimmed = pct.trim();
    if (trimmed === '') return '';
    const normalized = trimmed.endsWith('%') ? trimmed.slice(0, -1).trim() : trimmed;
    const parsed = Number.parseFloat(normalized.replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(parsed)) return formatPercent(parsed);
    return trimmed.includes('%') ? trimmed : `${trimmed} %`;
  }

  return '';
};

/**
 * Parser beløb-værdi til tal for beregninger
 */

/**
 * Tilføj satser-tabel
 * VIGTIGT: Filtrerer tomme/nul satser - returnerer null hvis ingen satser er udfyldt
 */
const addSatserTable = (doc: PdfDoc, satser: AarsloenSatserInput, currentY: number): number | null => {
  // Definer alle mulige satser
  const satsDefinitioner: Array<{ key: keyof AarsloenSatserInput; label: string }> = [
    { key: 'feriePct', label: 'Feriegodtgørelse/-tillæg' },
    { key: 'fritvalgPct', label: 'Fritvalg' },
    { key: 'shSoPct', label: 'SH/SO-sats' },
    { key: 'storeBededagPct', label: 'Store Bededagstillæg' },
    { key: 'pensionPct', label: 'Arbejdsgivers pensionsbidrag' }
  ];

  // Filtrer satser - behold kun udfyldte
  const udfyldteSatser = satsDefinitioner.filter(sats => !isEmptyOrZero(satser[sats.key]));

  // Hvis ingen satser er udfyldt, skip hele sektionen
  if (udfyldteSatser.length === 0) {
    return null;
  }

  const tableData: RowInput[] = [];

  const headingY = addSectionHeading(createJsPdfAdapter(doc), 'Satser', currentY);

  // Data-rækker (kun udfyldte satser)
  for (const sats of udfyldteSatser) {
    tableData.push([
      cellLeft(sats.label),
      cellRight(formatPdfPercent(satser[sats.key])),
    ]);
  }

  const finalY = renderEoStylePdfTable({
    doc,
    startY: resolveTableStartYAfterSectionHeading(headingY),
    body: tableData,
    hasHeaderRow: false,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
  });

  return resolvePdfSectionEndY(finalY, currentY);
};

/**
 * Tilføj indtægtsoplysninger-tabel
 */
const addIndtaegtsoplysningerTable = (
  doc: PdfDoc,
  tableData: readonly AarsloenTableRow[],
  loenperiode: Loenperiode,
  satser: AarsloenSatserInput,
  beregnetAarsloen: number,
  currentY: number
): number => {
  // Filtrer rækker - behold kun rækker hvor MINDST én input-celle er udfyldt
  const filteredData = tableData.filter(row => {
    // Tjek periode-kolonner baseret på loenperiode
    let harPeriode = false;
    if (loenperiode === 'maaned') {
      harPeriode = !isEmptyOrZero(row.col0_maaned) || !isEmptyOrZero(row.col1_maaned);
    } else if (loenperiode === 'uge') {
      harPeriode = !isEmptyOrZero(row.col0_uge) || !isEmptyOrZero(row.col1_uge);
    } else if (loenperiode === 'dag') {
      harPeriode = !isEmptyOrZero(row.col0_dag) || !isEmptyOrZero(row.col1_dag);
    }

    // Tjek beløbsfelter (Grundløn, Tillæg, Ikke-pensionsgivende løn, ATP og anden ikke-FB løn)
    const harLoen = !isEmptyOrZero(row.col2) || !isEmptyOrZero(row.col3) || !isEmptyOrZero(row.col4) ||
                     !isEmptyOrZero(row.col5);

    // Behold række hvis der er data i periode ELLER løn
    return harPeriode || harLoen;
  });

  // Headers afhænger af lønperiode
  const headers: CellDef[] = [];
  if (loenperiode === 'maaned') {
    headers.push(
      createPdfTableHeaderCell('Måned', 'center'),
      createPdfTableHeaderCell('År', 'center'),
    );
  } else if (loenperiode === 'uge') {
    headers.push(
      createPdfTableHeaderCell('Uge fra', 'center'),
      createPdfTableHeaderCell('Uge til', 'center'),
    );
  } else if (loenperiode === 'dag') {
    headers.push(
      createPdfTableHeaderCell('Dato fra', 'center'),
      createPdfTableHeaderCell('Dato til', 'center'),
    );
  }

  // Tilføj resten af headers
  headers.push(
    createPdfTableHeaderCell('Grundløn', 'center'),
    createPdfTableHeaderCell('Tillæg', 'center'),
    createPdfTableHeaderCell('Ikke-pens. giv. løn', 'center'),
    createPdfTableHeaderCell('ATP mv.\nu. FP', 'center'),
    createPdfTableHeaderCell('Ferieber.\nløn', 'center'),
    createPdfTableHeaderCell('FP/FV/SH/\nSO/St.B.', 'center'),
    createPdfTableHeaderCell('Arb.g.\nPension', 'center'),
    createPdfTableHeaderCell('Samlet løn', 'center'),
  );

  const tableRows: RowInput[] = [headers];

  // Beregn satser som decimaler
  // Data-rækker
  for (const row of filteredData) {
    // Hent periode-værdier baseret på loenperiode
    let col0Val = '';
    let col1Val = '';
    if (loenperiode === 'maaned') {
      col0Val = row.col0_maaned || '';
      col1Val = row.col1_maaned || '';
    } else if (loenperiode === 'uge') {
      col0Val = row.col0_uge || '';
      col1Val = row.col1_uge || '';
    } else if (loenperiode === 'dag') {
      col0Val = row.col0_dag || '';
      col1Val = row.col1_dag || '';
    }

    const derived = calculateAarsloenRowDerived(row, {
      feriePct: satser?.feriePct,
      fritvalgPct: satser?.fritvalgPct,
      shSoPct: satser?.shSoPct,
      storeBededagPct: satser?.storeBededagPct,
      pensionPct: satser?.pensionPct,
    });

    tableRows.push([
      cellCenter(col0Val),
      cellCenter(col1Val),
      cellRight(formatDanishAmount(row.col2)),
      cellRight(formatDanishAmount(row.col3)),
      cellRight(formatDanishAmount(row.col4)),
      cellRight(formatDanishAmount(row.col5)),
      cellRight(formatDanishAmount(derived.ferieberet)),
      cellRight(formatDanishAmount(derived.fpFvShSo)),
      cellRight(formatDanishAmount(derived.pension)),
      cellRight(formatDanishAmount(derived.samlet)),
    ]);
  }

  const hasTotalRow = filteredData.length > 1;

  if (hasTotalRow) {
    tableRows.push([
      createPdfTableCell('I alt', { halign: 'center', bold: true }),
      cellCenter(''),
      cellRight(''),
      cellRight(''),
      cellRight(''),
      cellRight(''),
      cellRight(''),
      cellRight(''),
      {
        content: `${formatDanishAmount(beregnetAarsloen)}${NBSP}kr.`,
        colSpan: 2,
        styles: { halign: 'right', fontStyle: 'bold' },
      },
    ]);
  }

  const finalY = renderEoStylePdfTable({
    doc,
    startY: currentY,
    body: tableRows,
    columnStyles: createPdfFixedColumnStyles(10, 17),
    didParseCell: (data) => {
      if (!hasTotalRow) return;
      const lastRowIndex = tableRows.length - 1;
      if (data.row.index === lastRowIndex) {
        data.cell.styles.fillColor = false;
        data.cell.styles.lineWidth = 0;
      }
    },
    didDrawCell: (data) => {
      if (!hasTotalRow) return;
      const lastRowIndex = tableRows.length - 1;
      if (data.row.index === lastRowIndex && data.column.index === 8) {
        const cell = data.cell;
        doc.setLineWidth(0.15);
        doc.setDrawColor(0, 0, 0);
        doc.line(cell.x, cell.y, cell.x + cell.width, cell.y);
      }
    },
  });

  return resolvePdfSectionEndY(finalY, currentY);
};

/**
 * Tilføj beregningsprincipper-tabel
 */
type BeregningsprincipperParams = Readonly<{
  periodeData: PeriodeResult | null;
  fuldLoenUnderFerie: boolean;
  retTilSjetteFerieuge: boolean;
  antalFeriedage: number | undefined;
  loenPaaHelligdage: LoenPaaHelligdage;
  shDageAntal: number | null;
}>;

const addBeregningsprinciperTable = (doc: PdfDoc, params: BeregningsprincipperParams, currentY: number): number => {
  const { periodeData, fuldLoenUnderFerie, retTilSjetteFerieuge, antalFeriedage, loenPaaHelligdage, shDageAntal } = params;

  const tableData: RowInput[] = [];
  const headingY = addSectionHeading(createJsPdfAdapter(doc), 'Beregningsprincipper', currentY);

  // Samlet periode
  tableData.push([
    cellLeft('Samlet periode'),
    cellRight(periodeData?.periodeTekst || ''),
  ]);

  // Andel af samlet periode
  const andelTekst = periodeData
    ? `${periodeData.unikkeEnheder} / ${periodeData.totalEnheder} ${periodeData.enhedNavn}`
    : '';
  tableData.push([
    cellLeft('Andel af samlet periode'),
    cellRight(andelTekst),
  ]);

  // Fuld løn under ferie
  tableData.push([
    cellLeft('Fuld løn under ferie'),
    cellRight(fuldLoenUnderFerie ? 'Ja' : 'Nej'),
  ]);

  // Ret til 6. ferieuge og Antal feriedage (kun hvis ikke fuld løn under ferie)
  if (!fuldLoenUnderFerie) {
    // Ret til 6. ferieuge
    tableData.push([
      cellLeft('Ret til 6. ferieuge'),
      cellRight(retTilSjetteFerieuge ? 'Ja' : 'Nej'),
    ]);

    // Antal feriedage
    const feriedageVal = antalFeriedage === null || antalFeriedage === undefined
      ? '0'
      : String(antalFeriedage);
    tableData.push([
      cellLeft('Antal feriedage (mandag-fredag) i de indtastede perioder'),
      cellRight(feriedageVal),
    ]);
  }

  // Løn på helligdage
  tableData.push([
    cellLeft('Løn på helligdage'),
    cellRight(loenPaaHelligdage || ''),
  ]);

  // Antal SH-dage (kun hvis loenPaaHelligdage === 'SH-udbetaling' eller 'Ingen')
  if (loenPaaHelligdage === 'SH-udbetaling' || loenPaaHelligdage === 'Ingen') {
    tableData.push([
      cellLeft('Antal SH-dage i de indtastede perioder'),
      cellRight(String(shDageAntal || 0)),
    ]);
  }

  const finalY = renderEoStylePdfTable({
    doc,
    startY: resolveTableStartYAfterSectionHeading(headingY),
    body: tableData,
    hasHeaderRow: false,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
  });

  return resolvePdfSectionEndY(finalY, currentY);
};

/**
 * Tilføj beregning-sektion som tabel
 */
type BeregningSectionParams = Readonly<{
  beregningsData: AarsloenBeregningResult;
  beregnetAarsloen: number;
  fuldLoenUnderFerie: boolean;
  shDageAntal: number | null;
  loenperiode: Loenperiode;
  retTilSjetteFerieuge: boolean;
}>;

const addBeregningSection = (doc: PdfDoc, params: BeregningSectionParams, currentY: number): number => {
  const { beregningsData, beregnetAarsloen, fuldLoenUnderFerie, shDageAntal, loenperiode, retTilSjetteFerieuge } = params;

  const tableData: RowInput[] = [];
  const headingY = addSectionHeading(createJsPdfAdapter(doc), 'Beregning', currentY);

  // Første data-række: Sammentælling af løn fra tabellen
  tableData.push([
    cellLeft('Sammentælling af løn fra tabellen'),
    cellRight(`${formatDanishAmount(beregnetAarsloen)} kr.`),
  ]);

  // Tilføj rækker baseret på beregningsmetode
  if (beregningsData.metode === 'A') {
    // METODE A: Arbejdsdage
    let linje1Label = `Arbejdsdage i beregningsperioden (${beregningsData.hverdageIPeriode} hverdage`;
    const feriedageFraInput = beregningsData.feriedageFraInput ?? 0;
    if (!fuldLoenUnderFerie && feriedageFraInput > 0) {
      linje1Label += ` - ${feriedageFraInput} feriedage`;
    }
    const shDageAntalSafe = shDageAntal ?? 0;
    if (shDageAntalSafe > 0) {
      linje1Label += ` - ${shDageAntalSafe} SH-dage`;
    }
    linje1Label += `)`;

    tableData.push([
      cellLeft(linje1Label),
      cellRight(`${beregningsData.arbejdsdageIPeriode} arbejdsdage`),
    ]);

    const linje2Label = fuldLoenUnderFerie
      ? 'Arbejdsdage på et år (261 hverdage - 8 SH-dage)'
      : `Arbejdsdage på et år (261 hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'} - 8 SH-dage)`;

    tableData.push([
      cellLeft(linje2Label),
      cellRight(`${beregningsData.arbejdsdagePaaAar} arbejdsdage`),
    ]);

    const linje3Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.arbejdsdagePaaAar})`;

    tableData.push([
      cellLeft(linje3Label),
      cellRightBold(`${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`),
    ]);

  } else if (beregningsData.metode === 'B') {
    // METODE B: Hverdage
    let linje1Label = `Hverdage i beregningsperioden (${beregningsData.hverdageIPeriode} hverdage`;
    const feriedageFraInput = beregningsData.feriedageFraInput ?? 0;
    if (!fuldLoenUnderFerie && feriedageFraInput > 0) {
      linje1Label += ` - ${feriedageFraInput} feriedage`;
    }
    linje1Label += `)`;

    tableData.push([
      cellLeft(linje1Label),
      cellRight(`${beregningsData.arbejdsdageIPeriode} hverdage`),
    ]);

    const linje2Label = fuldLoenUnderFerie
      ? 'Hverdage på et år (261 hverdage)'
      : `Hverdage på et år (261 hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'})`;

    tableData.push([
      cellLeft(linje2Label),
      cellRight(`${beregningsData.hverdagePaaAar} hverdage`),
    ]);

    const linje3Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar})`;

    tableData.push([
      cellLeft(linje3Label),
      cellRightBold(`${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`),
    ]);

  } else if (beregningsData.metode === 'C') {
    // METODE C: Måneder/Uger/Dage
    if (loenperiode === 'maaned') {
      const antalMaaneder = beregningsData.antalMaaneder ?? 0;
      tableData.push([
        cellLeft('Antal måneder i indtastede perioder'),
        cellRight(formatCountWithUnit(antalMaaneder, 'måned', 'måneder')),
      ]);

      const linje2Label = antalMaaneder === 1
        ? `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} × 12)`
        : `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.antalMaaneder} × 12)`;

      tableData.push([
        cellLeft(linje2Label),
        cellRightBold(`${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`),
      ]);

    } else if (loenperiode === 'uge') {
      tableData.push([
        cellLeft('Antal uger i indtastede perioder'),
        cellRight(formatCountWithUnit(beregningsData.antalMaaneder ?? 0, 'uge', 'uger')),
      ]);

      const linje2Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.antalMaaneder} × 52,14)`;

      tableData.push([
        cellLeft(linje2Label),
        cellRightBold(`${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`),
      ]);

    } else if (loenperiode === 'dag') {
      // Samme som metode B for dag-lønperiode
      let linje1Label = `Hverdage i beregningsperioden (${beregningsData.hverdageIPeriode} hverdage`;
      const feriedageFraInput = beregningsData.feriedageFraInput ?? 0;
      if (!fuldLoenUnderFerie && feriedageFraInput > 0) {
        linje1Label += ` - ${feriedageFraInput} feriedage`;
      }
      linje1Label += `)`;

      tableData.push([
        cellLeft(linje1Label),
        cellRight(`${beregningsData.arbejdsdageIPeriode} hverdage`),
      ]);

      const linje2Label = fuldLoenUnderFerie
        ? 'Hverdage på et år (261 hverdage)'
        : `Hverdage på et år (261 hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'})`;

      tableData.push([
        cellLeft(linje2Label),
        cellRight(`${beregningsData.hverdagePaaAar} hverdage`),
      ]);

      const linje3Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar})`;

      tableData.push([
        cellLeft(linje3Label),
        cellRightBold(`${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`),
      ]);
    }
  }

  const finalY = renderEoStylePdfTable({
    doc,
    startY: resolveTableStartYAfterSectionHeading(headingY),
    body: tableData,
    hasHeaderRow: false,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 45 },
    },
  });

  return resolvePdfSectionEndY(finalY, currentY);
};


/**
 * Generer og download PDF for årslønsberegning
 *
 * @param {object} params - Parameter-objekt med alle nødvendige data
 */
type GenerateAarsloenPdfParams = Readonly<{
  satser: AarsloenSatserInput;
  loenperiode: Loenperiode;
  tableData: readonly AarsloenTableRow[];
  beregnetAarsloen: number;
  omregningTilFuldtAar: boolean;
  periodeData: PeriodeResult | null;
  fuldLoenUnderFerie: boolean;
  retTilSjetteFerieuge: boolean;
  antalFeriedage: number | undefined;
  loenPaaHelligdage: LoenPaaHelligdage;
  shDageAntal: number | null;
  beregningsData: AarsloenBeregningResult;
  stamdata: StamdataValues | null;
  visBrevhoved?: boolean;
}>;

export const generateAarsloenPdf = (params: GenerateAarsloenPdfParams): void => {
  const {
    satser,
    loenperiode,
    tableData,
    beregnetAarsloen,
    omregningTilFuldtAar,
    periodeData,
    fuldLoenUnderFerie,
    retTilSjetteFerieuge,
    antalFeriedage,
    loenPaaHelligdage,
    shDageAntal,
    beregningsData,
    stamdata,
    visBrevhoved = false,
  } = params;

  const writer = createStandardPdfWriter();
  writer.setDisplayMode('fullheight');
  const doc = writer.getDoc() as PdfDoc;

  // Dokumentets metadata
  writer.setProperties({
    title: 'Årslønsberegning',
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: 'mineo.dk',
  });

  let currentY = MARGINS.top;

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdata?.journalnr,
      advokat: stamdata?.advokat,
      sagsbehandler: stamdata?.sagsbehandler,
      dagsDatoISO: TODAY,
    };
    writer.writeBrevhoved(brevhovedData);
    currentY = writer.getY();
  }

  // Tilføj titel
  writer.setY(currentY);
  writer.writeTitle('Årslønsberegning');
  currentY = writer.getY();

  // Tilføj satser-tabel (kun hvis der er udfyldte satser)
  const satserY = addSatserTable(doc, satser, currentY);
  if (satserY !== null) {
    currentY = satserY;
  }

  currentY = addSectionHeading(createJsPdfAdapter(doc), 'Indtægtsoplysninger', currentY);

  // Tilføj indtægtsoplysninger-tabel (inkl. "I alt"-linje)
  currentY = addIndtaegtsoplysningerTable(
    doc,
    tableData,
    loenperiode,
    satser,
    beregnetAarsloen,
    resolveTableStartYAfterSectionHeading(currentY)
  );

  // Betinget: Beregningsprincipper og beregning (kun hvis omregning er aktiveret)
  if (omregningTilFuldtAar && periodeData) {
    // Tilføj beregningsprincipper-tabel
    currentY = addBeregningsprinciperTable(doc, {
      periodeData,
      fuldLoenUnderFerie,
      retTilSjetteFerieuge,
      antalFeriedage,
      loenPaaHelligdage,
      shDageAntal
    }, currentY);

    // Tilføj beregning-sektion (kun hvis der er mellemregning)
    if (beregningsData.metode !== 'ingen' && !beregningsData.erEtAar) {
      currentY = addBeregningSection(doc, {
        beregningsData,
        beregnetAarsloen,
        fuldLoenUnderFerie,
        shDageAntal,
        loenperiode,
        retTilSjetteFerieuge
      }, currentY);
    }
  }

  // Tilføj footer med versionsnummer
  writer.addFooter();

  // Generer filnavn
  const filename = buildAarsloenPdfFilename(stamdata?.journalnr);

  // Download PDF
  writer.save(filename);
};

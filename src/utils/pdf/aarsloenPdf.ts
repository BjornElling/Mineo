/**
 * PDF Generator for Årslønsberegning
 *
 * Genererer detaljeret specifikation af årslønsberegning med satser, indtægtsoplysninger og beregning
 */

import type { CellDef, RowInput } from 'jspdf-autotable';
import type jsPDF from 'jspdf';
import { addSectionHeading, PDF_BASE_LINE_HEIGHT_MM, resolvePdfSectionEndY, type BrevhovedData } from './pdfHelpers';
import { createStandardPdfWriter, type PdfWriter } from './pdfWriter';
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
import { PDF_SECTION_HEADING_GAP, SECTION_SPACER } from './pdfConfig';
import { calculateAarsloenRowDerived, type AarsloenSatserInput } from '../../domain/aarsloen/aarsloenRowCalculations';
import type { PdfCommonOptions } from './pdfOptions';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { AarsloenTableRow, LoenPaaHelligdage, Loenperiode } from '../../schemas/formSchemas';
import type { PeriodeResult } from '../periodeBeregning';
import type { AarsloenBeregningResult } from '../../types/calculation';
import { amountValueToDisplayString, amountValueToNumber } from '../expressionAmount';
import { TODAY } from '../../config/dateRanges';
import { formatAsAmount, formatCountWithUnit, formatPercent } from '../formatUtils';
import { resolvePdfFileName } from './pdfFormatUtils';

const NBSP = '\u00A0';

const resolveTableStartYAfterSectionHeading = (headingY: number): number =>
  headingY - PDF_SECTION_HEADING_GAP;

const writeRows = (
  writer: PdfWriter,
  rows: ReadonlyArray<
    Readonly<{
      label: string;
      value: string;
      rightFontStyle?: 'normal' | 'bold';
      singleLine?: boolean;
    }>
  >
): void => {
  for (const row of rows) {
    if (row.singleLine) {
      writer.writeLeftRightTextSingleLine(row.label, row.value, {
        rightFontStyle: row.rightFontStyle ?? 'normal',
      });
      continue;
    }
    writer.writeLeftRightText(row.label, row.value, {
      rightFontStyle: row.rightFontStyle ?? 'normal',
    });
  }
};

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
 * Tilføj satser-sektion som almindelige tekstlinjer
 * VIGTIGT: Filtrerer tomme/nul satser - skip hele sektionen hvis ingen satser er udfyldt
 */
const addSatserSection = (
  writer: PdfWriter,
  satser: AarsloenSatserInput,
): void => {
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
    return;
  }

  writer.writeSubheader('Satser', PDF_BASE_LINE_HEIGHT_MM);
  writeRows(
    writer,
    udfyldteSatser.map((sats) => ({
      label: sats.label,
      value: formatPdfPercent(satser[sats.key]),
    }))
  );
  writer.addSpacer(SECTION_SPACER);
};

/**
 * Tilføj indtægtsoplysninger-tabel
 */
const addIndtaegtsoplysningerTable = (
  doc: jsPDF,
  tableData: readonly AarsloenTableRow[],
  loenperiode: Loenperiode,
  satser: AarsloenSatserInput,
  beregnetAarsloen: number,
  currentY: number
): number => {
  const headingY = addSectionHeading(createJsPdfAdapter(doc), 'Indtægtsoplysninger', currentY);
  const tableStartY = resolveTableStartYAfterSectionHeading(headingY);

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
    startY: tableStartY,
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
        // Direkte jsPDF-kald er accepteret i autotable-callbacks — PdfDocumentAdapter
        // dækker ikke tegneprimitiverne (setLineWidth, setDrawColor, line), og
        // data.doc er autotable's egen eksponering af jsPDF-instansen.
        doc.setLineWidth(0.15);
        doc.setDrawColor(0, 0, 0);
        doc.line(cell.x, cell.y, cell.x + cell.width, cell.y);
      }
    },
  });

  return resolvePdfSectionEndY(finalY, currentY);
};

/**
 * Tilføj beregningsprincipper-sektion som almindelige tekstlinjer
 */
type BeregningsprincipperParams = Readonly<{
  periodeData: PeriodeResult | null;
  fuldLoenUnderFerie: boolean;
  retTilSjetteFerieuge: boolean;
  antalFeriedage: number | undefined;
  loenPaaHelligdage: LoenPaaHelligdage;
  shDageAntal: number | null;
}>;

const addBeregningsprinciperSection = (
  writer: PdfWriter,
  params: BeregningsprincipperParams,
): void => {
  const { periodeData, fuldLoenUnderFerie, retTilSjetteFerieuge, antalFeriedage, loenPaaHelligdage, shDageAntal } = params;

  const rows: Array<{
    label: string;
    value: string;
  }> = [];

  // Samlet periode
  rows.push({
    label: 'Samlet periode',
    value: periodeData?.periodeTekst || '',
  });

  // Andel af samlet periode
  const andelTekst = periodeData
    ? `${periodeData.unikkeEnheder} / ${periodeData.totalEnheder} ${periodeData.enhedNavn}`
    : '';
  rows.push({
    label: 'Andel af samlet periode',
    value: andelTekst,
  });

  // Fuld løn under ferie
  rows.push({
    label: 'Fuld løn under ferie',
    value: fuldLoenUnderFerie ? 'Ja' : 'Nej',
  });

  // Ret til 6. ferieuge og Antal feriedage (kun hvis ikke fuld løn under ferie)
  if (!fuldLoenUnderFerie) {
    // Ret til 6. ferieuge
    rows.push({
      label: 'Ret til 6. ferieuge',
      value: retTilSjetteFerieuge ? 'Ja' : 'Nej',
    });

    // Antal feriedage
    const feriedageVal = antalFeriedage === null || antalFeriedage === undefined
      ? '0'
      : String(antalFeriedage);
    rows.push({
      label: 'Antal feriedage (mandag-fredag) i de indtastede perioder',
      value: feriedageVal,
    });
  }

  // Løn på helligdage
  rows.push({
    label: 'Løn på helligdage',
    value: loenPaaHelligdage || '',
  });

  // Antal SH-dage (kun hvis loenPaaHelligdage === 'SH-udbetaling' eller 'Ingen')
  if (loenPaaHelligdage === 'SH-udbetaling' || loenPaaHelligdage === 'Ingen') {
    rows.push({
      label: 'Antal SH-dage i de indtastede perioder',
      value: String(shDageAntal || 0),
    });
  }

  writer.writeSubheader('Beregningsprincipper', PDF_BASE_LINE_HEIGHT_MM);
  writeRows(writer, rows);
  writer.addSpacer(SECTION_SPACER);
};

/**
 * Tilføj beregning-sektion som almindelige tekstlinjer
 */
type BeregningSectionParams = Readonly<{
  beregningsData: AarsloenBeregningResult;
  beregnetAarsloen: number;
  fuldLoenUnderFerie: boolean;
  shDageAntal: number | null;
  loenperiode: Loenperiode;
  retTilSjetteFerieuge: boolean;
}>;

const addBeregningSection = (
  writer: PdfWriter,
  params: BeregningSectionParams,
): void => {
  const { beregningsData, beregnetAarsloen, fuldLoenUnderFerie, shDageAntal, loenperiode, retTilSjetteFerieuge } = params;

  const rows: Array<{
    label: string;
    value: string;
    rightFontStyle?: 'normal' | 'bold';
  }> = [];

  // Første data-række: Sammentælling af løn fra tabellen
  rows.push({
    label: 'Sammentælling af løn fra tabellen',
    value: `${formatDanishAmount(beregnetAarsloen)} kr.`,
  });

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

    rows.push({
      label: linje1Label,
      value: `${beregningsData.arbejdsdageIPeriode} arbejdsdage`,
    });

    const linje2Label = fuldLoenUnderFerie
      ? 'Arbejdsdage på et år (261 hverdage - 8 SH-dage)'
      : `Arbejdsdage på et år (261 hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'} - 8 SH-dage)`;

    rows.push({
      label: linje2Label,
      value: `${beregningsData.arbejdsdagePaaAar} arbejdsdage`,
    });

    const linje3Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.arbejdsdagePaaAar})`;

    rows.push({
      label: linje3Label,
      value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
      rightFontStyle: 'bold',
    });

  } else if (beregningsData.metode === 'B') {
    // METODE B: Hverdage
    let linje1Label = `Hverdage i beregningsperioden (${beregningsData.hverdageIPeriode} hverdage`;
    const feriedageFraInput = beregningsData.feriedageFraInput ?? 0;
    if (!fuldLoenUnderFerie && feriedageFraInput > 0) {
      linje1Label += ` - ${feriedageFraInput} feriedage`;
    }
    linje1Label += `)`;

    rows.push({
      label: linje1Label,
      value: `${beregningsData.arbejdsdageIPeriode} hverdage`,
    });

    const linje2Label = fuldLoenUnderFerie
      ? 'Hverdage på et år (261 hverdage)'
      : `Hverdage på et år (261 hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'})`;

    rows.push({
      label: linje2Label,
      value: `${beregningsData.hverdagePaaAar} hverdage`,
    });

    const linje3Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar})`;

    rows.push({
      label: linje3Label,
      value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
      rightFontStyle: 'bold',
    });

  } else if (beregningsData.metode === 'C') {
    // METODE C: Måneder/Uger/Dage
    if (loenperiode === 'maaned') {
      const antalMaaneder = beregningsData.antalMaaneder ?? 0;
      rows.push({
        label: 'Antal måneder i indtastede perioder',
        value: formatCountWithUnit(antalMaaneder, 'måned', 'måneder'),
      });

      const linje2Label = antalMaaneder === 1
        ? `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} × 12)`
        : `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.antalMaaneder} × 12)`;

      rows.push({
        label: linje2Label,
        value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
        rightFontStyle: 'bold',
      });

    } else if (loenperiode === 'uge') {
      rows.push({
        label: 'Antal uger i indtastede perioder',
        value: formatCountWithUnit(beregningsData.antalMaaneder ?? 0, 'uge', 'uger'),
      });

      const linje2Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.antalMaaneder} × 52,14)`;

      rows.push({
        label: linje2Label,
        value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
        rightFontStyle: 'bold',
      });

    } else if (loenperiode === 'dag') {
      // Samme som metode B for dag-lønperiode
      let linje1Label = `Hverdage i beregningsperioden (${beregningsData.hverdageIPeriode} hverdage`;
      const feriedageFraInput = beregningsData.feriedageFraInput ?? 0;
      if (!fuldLoenUnderFerie && feriedageFraInput > 0) {
        linje1Label += ` - ${feriedageFraInput} feriedage`;
      }
      linje1Label += `)`;

      rows.push({
        label: linje1Label,
        value: `${beregningsData.arbejdsdageIPeriode} hverdage`,
      });

      const linje2Label = fuldLoenUnderFerie
        ? 'Hverdage på et år (261 hverdage)'
        : `Hverdage på et år (261 hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'})`;

      rows.push({
        label: linje2Label,
        value: `${beregningsData.hverdagePaaAar} hverdage`,
      });

      const linje3Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar})`;

      rows.push({
        label: linje3Label,
        value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
        rightFontStyle: 'bold',
      });
    }
  }

  writer.writeSubheader('Beregning', PDF_BASE_LINE_HEIGHT_MM);
  writeRows(writer, rows);
};


/**
 * Generer og download PDF for årslønsberegning
 *
 * @param {object} params - Parameter-objekt med alle nødvendige data
 */
type GenerateAarsloenPdfParams = PdfCommonOptions & Readonly<{
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
  const doc = writer.getDoc();

  // Dokumentets metadata
  writer.setProperties({
    title: 'Årslønsberegning',
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
  writer.writeTitle('Årslønsberegning');

  // Tilføj satser-sektion (kun hvis der er udfyldte satser)
  addSatserSection(writer, satser);

  // Tilføj indtægtsoplysninger-tabel (inkl. "I alt"-linje)
  writer.setY(addIndtaegtsoplysningerTable(
    doc,
    tableData,
    loenperiode,
    satser,
    beregnetAarsloen,
    writer.getY()
  ));

  // Betinget: Beregningsprincipper og beregning (kun hvis omregning er aktiveret)
  if (omregningTilFuldtAar && periodeData) {
    // Tilføj beregningsprincipper-sektion
    addBeregningsprinciperSection(writer, {
      periodeData,
      fuldLoenUnderFerie,
      retTilSjetteFerieuge,
      antalFeriedage,
      loenPaaHelligdage,
      shDageAntal
    });

    // Tilføj beregning-sektion (kun hvis der er mellemregning)
    if (beregningsData.metode !== 'ingen' && !beregningsData.erEtAar) {
      addBeregningSection(writer, {
        beregningsData,
        beregnetAarsloen,
        fuldLoenUnderFerie,
        shDageAntal,
        loenperiode,
        retTilSjetteFerieuge
      });
    }
  }

  // Tilføj footer med versionsnummer
  writer.addFooter();

  // Generer filnavn
  const filename = buildAarsloenPdfFilename(stamdata?.journalnr);

  // Download PDF
  writer.save(filename);
};

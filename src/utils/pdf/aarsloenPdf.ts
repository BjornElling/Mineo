/**
 * PDF Generator for Årslønsberegning
 *
 * Genererer detaljeret specifikation af årslønsberegning med satser, indtægtsoplysninger og beregning
 */

import jsPDF from 'jspdf';
import autoTable, { type CellDef, type CellHookData, type RowInput } from 'jspdf-autotable';
import { COLORS, MARGINS, FONT_SIZES, TABLE_STYLES, SECTION_SPACER } from './pdfConfig';
import { addTitle, addFooter, addBrevhoved, type BrevhovedData } from './pdfHelpers';
import { calculateAarsloenRowDerived, type AarsloenSatserInput } from '../aarsloenTableCalculations';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { AarsloenTableRow, LoenPaaHelligdage, Loenperiode, StamdataValues } from '../../schemas/formSchemas';
import type { PeriodeResult } from '../periodeBeregning';
import type { AarsloenBeregningResult } from '../../types/common';
import { amountValueToDisplayString, amountValueToNumber } from '../expressionAmount';
import { TODAY } from '../../config/dateRanges';

type PdfDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};
const NBSP = '\u00A0';

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
    // Hvis amount er et tal, formater med dansk locale
    return amount.toLocaleString('da-DK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return '';
};

/**
 * Mapper lønperiode-key til visningsnavn
 */
const mapLoenperiodeTekst = (loenperiode: Loenperiode): string => {
  const mapping: Record<Loenperiode, string> = {
    maaned: 'Månedsløn',
    uge: 'Ugeløn',
    dag: 'Dagsløn',
  };
  return mapping[loenperiode];
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
const formatPercent = (pct: unknown): string => {
  if (pct === null || pct === undefined || pct === '') return '';

  // Hvis det er et tal (fx 12.5), formater med komma og %
  if (typeof pct === 'number') {
    return `${pct.toString().replace('.', ',')} %`;
  }

  // Hvis det er en streng, tjek om den allerede har %
  if (typeof pct === 'string') {
    const trimmed = pct.trim();
    // Hvis den allerede har %, sørg for komma-separator
    if (trimmed.includes('%')) {
      return trimmed.replace('.', ',');
    }
    // Ellers tilføj %
    return `${trimmed.replace('.', ',')} %`;
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

  // Header-række
  tableData.push([
    { content: 'Satser', styles: { fontStyle: 'bold', halign: 'left' } },
    { content: '', styles: { fontStyle: 'bold', halign: 'right' } }
  ]);

  // Data-rækker (kun udfyldte satser)
  for (const sats of udfyldteSatser) {
    tableData.push([
      { content: sats.label, styles: { halign: 'left' } },
      { content: formatPercent(satser[sats.key]), styles: { halign: 'right' } }
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: tableData,
    margin: { left: MARGINS.left, right: MARGINS.right },
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    styles: {
      font: 'helvetica',
      fontSize: TABLE_STYLES.fontSize,
      cellPadding: 1.5,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
    didParseCell: (data: CellHookData) => {
      // Header-række får lysegrå baggrund
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
        data.cell.styles.overflow = 'ellipsize';
      }
      // Alternerende rækker (ekskl. header)
      else if (data.row.index > 0) {
        if (data.row.index % 2 === 0) {
          data.cell.styles.fillColor = TABLE_STYLES.alternateRowBackgroundColor;
        } else {
          data.cell.styles.fillColor = COLORS.white;
        }
      }
    },
  });

  const finalY = doc.lastAutoTable?.finalY || currentY + 50;
  return finalY + SECTION_SPACER;
};

/**
 * Tilføj lønperiode-linje
 */
const _addLoenperiodeLine = (doc: PdfDoc, loenperiode: Loenperiode, currentY: number): number => {
  doc.setFontSize(FONT_SIZES.normal);

  // Venstrestillet fed tekst
  doc.setFont('helvetica', 'bold');
  doc.text('Lønperiode:', MARGINS.left, currentY);

  // Højrestillet normal tekst
  doc.setFont('helvetica', 'normal');
  const pageWidth = doc.internal.pageSize.width;
  const rightX = pageWidth - MARGINS.right;
  doc.text(mapLoenperiodeTekst(loenperiode), rightX, currentY, { align: 'right' });

  return currentY + 12;
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
      { content: 'Måned', styles: { fontStyle: 'bold', halign: 'center' } },
      { content: 'År', styles: { fontStyle: 'bold', halign: 'center' } }
    );
  } else if (loenperiode === 'uge') {
    headers.push(
      { content: 'Uge fra', styles: { fontStyle: 'bold', halign: 'center' } },
      { content: 'Uge til', styles: { fontStyle: 'bold', halign: 'center' } }
    );
  } else if (loenperiode === 'dag') {
    headers.push(
      { content: 'Dato fra', styles: { fontStyle: 'bold', halign: 'center' } },
      { content: 'Dato til', styles: { fontStyle: 'bold', halign: 'center' } }
    );
  }

  // Tilføj resten af headers
  headers.push(
    { content: 'Grundløn', styles: { fontStyle: 'bold', halign: 'center' } },
    { content: 'Tillæg', styles: { fontStyle: 'bold', halign: 'center' } },
    { content: 'Ikke-pens.-\ngivende løn', styles: { fontStyle: 'bold', halign: 'center' } },
    { content: 'ATP og\nikke-FB løn', styles: { fontStyle: 'bold', halign: 'center' } },
    { content: 'Ferieberet.\nløn', styles: { fontStyle: 'bold', halign: 'center' } },
    { content: 'FP/FV/SH/\nSO/St.B.', styles: { fontStyle: 'bold', halign: 'center' } },
    { content: 'Arb.g.\nPension', styles: { fontStyle: 'bold', halign: 'center' } },
    { content: 'Samlet løn', styles: { fontStyle: 'bold', halign: 'center' } }
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
      { content: col0Val, styles: { halign: 'center' } },
      { content: col1Val, styles: { halign: 'center' } },
      { content: formatDanishAmount(row.col2), styles: { halign: 'right' } },
      { content: formatDanishAmount(row.col3), styles: { halign: 'right' } },
      { content: formatDanishAmount(row.col4), styles: { halign: 'right' } },
      { content: formatDanishAmount(row.col5), styles: { halign: 'right' } },
      { content: formatDanishAmount(derived.ferieberet), styles: { halign: 'right' } },
      { content: formatDanishAmount(derived.fpFvShSo), styles: { halign: 'right' } },
      { content: formatDanishAmount(derived.pension), styles: { halign: 'right' } },
      { content: formatDanishAmount(derived.samlet), styles: { halign: 'right' } }
    ]);
  }

  // Tilføj "I alt"-række
  tableRows.push([
    { content: 'I alt', styles: { halign: 'center', fontStyle: 'bold' } },
    { content: '', styles: { halign: 'center' } },
    { content: '', styles: { halign: 'right' } },
    { content: '', styles: { halign: 'right' } },
    { content: '', styles: { halign: 'right' } },
    { content: '', styles: { halign: 'right' } },
    { content: '', styles: { halign: 'right' } },
    { content: '', styles: { halign: 'right' } },
    {
      content: `${formatDanishAmount(beregnetAarsloen)}${NBSP}kr.`,
      colSpan: 2,
      styles: { halign: 'right', fontStyle: 'bold' },
    },
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: tableRows,
    margin: { left: MARGINS.left, right: MARGINS.right },
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    styles: {
      font: 'helvetica',
      fontSize: 7, // Mindre skriftstørrelse for data
      cellPadding: 1.5,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { cellWidth: 17 },
      1: { cellWidth: 17 },
      2: { cellWidth: 17 },
      3: { cellWidth: 17 },
      4: { cellWidth: 17 },
      5: { cellWidth: 17 },
      6: { cellWidth: 17 },
      7: { cellWidth: 17 },
      8: { cellWidth: 17 },
      9: { cellWidth: 17 }
    },
    didParseCell: (data: CellHookData) => {
      const lastRowIndex = tableRows.length - 1;

      // Header-række får lysegrå baggrund (font forbliver 8pt)
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
        data.cell.styles.overflow = 'ellipsize';
      }
      // "I alt"-række (sidste række) - fjern borders
      else if (data.row.index === lastRowIndex) {
        data.cell.styles.fillColor = COLORS.white;
        data.cell.styles.lineWidth = 0;
      }
      // Alternerende rækker (ekskl. header og "I alt")
      else if (data.row.index > 0) {
        if (data.row.index % 2 === 0) {
          data.cell.styles.fillColor = TABLE_STYLES.alternateRowBackgroundColor;
        } else {
          data.cell.styles.fillColor = COLORS.white;
        }
      }
    },
    didDrawCell: (data: CellHookData) => {
      const lastRowIndex = tableRows.length - 1;

      // Tegn tynd streg over beløbet i "I alt"-rækken.
      // Beløbet står i sidste celle, som spænder over de to sidste kolonner.
      if (data.row.index === lastRowIndex && data.column.index === 8) {
        const cell = data.cell;
        doc.setLineWidth(0.15);
        doc.setDrawColor(0, 0, 0);
        doc.line(cell.x, cell.y, cell.x + cell.width, cell.y);
      }
    },
  });

  const finalY = doc.lastAutoTable?.finalY || currentY + 50;
  return finalY + SECTION_SPACER;
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

  // Header-række
  tableData.push([
    { content: 'Beregningsprincipper', styles: { fontStyle: 'bold', halign: 'left' } },
    { content: '', styles: { fontStyle: 'bold', halign: 'right' } }
  ]);

  // Samlet periode
  tableData.push([
    { content: 'Samlet periode', styles: { halign: 'left' } },
    { content: periodeData?.periodeTekst || '', styles: { halign: 'right' } }
  ]);

  // Andel af samlet periode
  const andelTekst = periodeData
    ? `${periodeData.unikkeEnheder} / ${periodeData.totalEnheder} ${periodeData.enhedNavn}`
    : '';
  tableData.push([
    { content: 'Andel af samlet periode', styles: { halign: 'left' } },
    { content: andelTekst, styles: { halign: 'right' } }
  ]);

  // Fuld løn under ferie
  tableData.push([
    { content: 'Fuld løn under ferie', styles: { halign: 'left' } },
    { content: fuldLoenUnderFerie ? 'Ja' : 'Nej', styles: { halign: 'right' } }
  ]);

  // Ret til 6. ferieuge og Antal feriedage (kun hvis ikke fuld løn under ferie)
  if (!fuldLoenUnderFerie) {
    // Ret til 6. ferieuge
    tableData.push([
      { content: 'Ret til 6. ferieuge', styles: { halign: 'left' } },
      { content: retTilSjetteFerieuge ? 'Ja' : 'Nej', styles: { halign: 'right' } }
    ]);

    // Antal feriedage
    const feriedageVal = antalFeriedage === null || antalFeriedage === undefined
      ? '0'
      : String(antalFeriedage);
    tableData.push([
      { content: 'Antal feriedage (mandag-fredag) i de indtastede perioder', styles: { halign: 'left' } },
      { content: feriedageVal, styles: { halign: 'right' } }
    ]);
  }

  // Løn på helligdage
  tableData.push([
    { content: 'Løn på helligdage', styles: { halign: 'left' } },
    { content: loenPaaHelligdage || '', styles: { halign: 'right' } }
  ]);

  // Antal SH-dage (kun hvis loenPaaHelligdage === 'SH-udbetaling' eller 'Ingen')
  if (loenPaaHelligdage === 'SH-udbetaling' || loenPaaHelligdage === 'Ingen') {
    tableData.push([
      { content: 'Antal SH-dage i de indtastede perioder', styles: { halign: 'left' } },
      { content: String(shDageAntal || 0), styles: { halign: 'right' } }
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [],
    body: tableData,
    margin: { left: MARGINS.left, right: MARGINS.right },
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    styles: {
      font: 'helvetica',
      fontSize: TABLE_STYLES.fontSize,
      cellPadding: 1.5,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60 },
    },
    didParseCell: (data: CellHookData) => {
      // Header-række får lysegrå baggrund
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
        data.cell.styles.overflow = 'ellipsize';
      }
      // Alternerende rækker (ekskl. header)
      else if (data.row.index > 0) {
        if (data.row.index % 2 === 0) {
          data.cell.styles.fillColor = TABLE_STYLES.alternateRowBackgroundColor;
        } else {
          data.cell.styles.fillColor = COLORS.white;
        }
      }
    },
  });

  const finalY = doc.lastAutoTable?.finalY || currentY + 50;
  return finalY + SECTION_SPACER;
};

/**
 * Tilføj beregning-sektion som tabel
 */
type BeregningSectionParams = Readonly<{
  beregningsData: AarsloenBeregningResult;
  beregnetAarsloen: number;
  fejlmeddelelser: readonly string[];
  fuldLoenUnderFerie: boolean;
  shDageAntal: number | null;
  loenperiode: Loenperiode;
  retTilSjetteFerieuge: boolean;
}>;

const addBeregningSection = (doc: PdfDoc, params: BeregningSectionParams, currentY: number): number => {
  const { beregningsData, beregnetAarsloen, fejlmeddelelser, fuldLoenUnderFerie, shDageAntal, loenperiode, retTilSjetteFerieuge } = params;

  const tableData: RowInput[] = [];
  const harFejl = fejlmeddelelser.length > 0;

  // Header-række med "Beregning" (uden stjerne - den tilføjes manuelt bagefter)
  tableData.push([
    { content: 'Beregning', styles: { fontStyle: 'bold', halign: 'left' } },
    { content: '', styles: { fontStyle: 'bold', halign: 'right' } }
  ]);

  // Første data-række: Sammentælling af løn fra tabellen
  tableData.push([
    { content: 'Sammentælling af løn fra tabellen', styles: { halign: 'left' } },
    { content: `${formatDanishAmount(beregnetAarsloen)} kr.`, styles: { halign: 'right' } }
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
      { content: linje1Label, styles: { halign: 'left' } },
      { content: `${beregningsData.arbejdsdageIPeriode} arbejdsdage`, styles: { halign: 'right' } }
    ]);

    const linje2Label = fuldLoenUnderFerie
      ? 'Arbejdsdage på et år (261 hverdage - 8 SH-dage)'
      : `Arbejdsdage på et år (261 hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'} - 8 SH-dage)`;

    tableData.push([
      { content: linje2Label, styles: { halign: 'left' } },
      { content: `${beregningsData.arbejdsdagePaaAar} arbejdsdage`, styles: { halign: 'right' } }
    ]);

    const linje3Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.arbejdsdagePaaAar})`;

    tableData.push([
      { content: linje3Label, styles: { halign: 'left' } },
      { content: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`, styles: { halign: 'right', fontStyle: 'bold' } }
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
      { content: linje1Label, styles: { halign: 'left' } },
      { content: `${beregningsData.arbejdsdageIPeriode} hverdage`, styles: { halign: 'right' } }
    ]);

    const linje2Label = fuldLoenUnderFerie
      ? 'Hverdage på et år (261 hverdage)'
      : `Hverdage på et år (261 hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'})`;

    tableData.push([
      { content: linje2Label, styles: { halign: 'left' } },
      { content: `${beregningsData.hverdagePaaAar} hverdage`, styles: { halign: 'right' } }
    ]);

    const linje3Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar})`;

    tableData.push([
      { content: linje3Label, styles: { halign: 'left' } },
      { content: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`, styles: { halign: 'right', fontStyle: 'bold' } }
    ]);

  } else if (beregningsData.metode === 'C') {
    // METODE C: Måneder/Uger/Dage
    if (loenperiode === 'maaned') {
      tableData.push([
        { content: 'Antal måneder i indtastede perioder', styles: { halign: 'left' } },
        { content: `${beregningsData.antalMaaneder} måneder`, styles: { halign: 'right' } }
      ]);

      const linje2Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.antalMaaneder} × 12)`;

      tableData.push([
        { content: linje2Label, styles: { halign: 'left' } },
        { content: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`, styles: { halign: 'right', fontStyle: 'bold' } }
      ]);

    } else if (loenperiode === 'uge') {
      tableData.push([
        { content: 'Antal uger i indtastede perioder', styles: { halign: 'left' } },
        { content: `${beregningsData.antalMaaneder} uger`, styles: { halign: 'right' } }
      ]);

      const linje2Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.antalMaaneder} × 52,14)`;

      tableData.push([
        { content: linje2Label, styles: { halign: 'left' } },
        { content: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`, styles: { halign: 'right', fontStyle: 'bold' } }
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
        { content: linje1Label, styles: { halign: 'left' } },
        { content: `${beregningsData.arbejdsdageIPeriode} hverdage`, styles: { halign: 'right' } }
      ]);

      const linje2Label = fuldLoenUnderFerie
        ? 'Hverdage på et år (261 hverdage)'
        : `Hverdage på et år (261 hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'})`;

      tableData.push([
        { content: linje2Label, styles: { halign: 'left' } },
        { content: `${beregningsData.hverdagePaaAar} hverdage`, styles: { halign: 'right' } }
      ]);

      const linje3Label = `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar})`;

      tableData.push([
        { content: linje3Label, styles: { halign: 'left' } },
        { content: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`, styles: { halign: 'right', fontStyle: 'bold' } }
      ]);
    }
  }

  // Generer tabel
  autoTable(doc, {
    startY: currentY,
    head: [],
    body: tableData,
    margin: { left: MARGINS.left, right: MARGINS.right },
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    styles: {
      font: 'helvetica',
      fontSize: TABLE_STYLES.fontSize,
      cellPadding: 1.5,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { cellWidth: 'auto' }, // Tekstkolonne - elastisk, får resten af pladsen
      1: { cellWidth: 45 },      // Talkolonne - kompakt, så teksten får mere plads
    },
    didParseCell: (data: CellHookData) => {
      // Header-række får lysegrå baggrund
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
        data.cell.styles.overflow = 'ellipsize';
      }
      // Alternerende rækker (ekskl. header)
      else if (data.row.index > 0) {
        if (data.row.index % 2 === 0) {
          data.cell.styles.fillColor = TABLE_STYLES.alternateRowBackgroundColor;
        } else {
          data.cell.styles.fillColor = COLORS.white;
        }
      }
    },
  });

  // Tilføj stjerne manuelt hvis der er fejl
  if (harFejl) {
    const tableStartY = currentY + 1.5; // cellPadding
    const headerTextY = tableStartY + TABLE_STYLES.fontSize / 2 + 1; // Cirka vertikal center af header

    doc.setFontSize(TABLE_STYLES.fontSize);
    doc.setFont('helvetica', 'bold');
    const textWidth = doc.getTextWidth('Beregning');

    doc.setTextColor(150, 150, 150);
    doc.text('*', MARGINS.left + textWidth, headerTextY - 1);

    // Reset farve
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  }

  const finalY = doc.lastAutoTable?.finalY || currentY + 50;
  return finalY + SECTION_SPACER;
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
  fejlmeddelelser: readonly string[];
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
    fejlmeddelelser,
    stamdata,
    visBrevhoved = false,
  } = params;

  // Opret nyt PDF-dokument (A4, portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as PdfDoc;
  doc.setDisplayMode('100%');

  // Dokumentets metadata
  doc.setProperties({
    title: 'Årslønsberegning',
    subject: 'Årslønsberegning',
    author: 'MINEO',
    creator: 'MINEO',
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
    currentY = addBrevhoved(doc, brevhovedData);
  }

  // Tilføj titel
  currentY = addTitle(doc, 'Årslønsberegning', currentY);

  // Tilføj satser-tabel (kun hvis der er udfyldte satser)
  const satserY = addSatserTable(doc, satser, currentY);
  if (satserY !== null) {
    currentY = satserY;
  }

  // Tilføj overskrift "Indtægtsoplysninger"
  doc.setFontSize(FONT_SIZES.normal);
  doc.setFont('helvetica', 'bold');
  doc.text('Indtægtsoplysninger', MARGINS.left, currentY);
  currentY += 8;

  // Tilføj indtægtsoplysninger-tabel (inkl. "I alt"-linje)
  currentY = addIndtaegtsoplysningerTable(doc, tableData, loenperiode, satser, beregnetAarsloen, currentY);

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
        fejlmeddelelser,
        fuldLoenUnderFerie,
        shDageAntal,
        loenperiode,
        retTilSjetteFerieuge
      }, currentY);
    }
  }

  // Tilføj footer med versionsnummer
  addFooter(doc);

  // Generer filnavn
  let filename = 'Årslønsberegning.pdf';
  if (stamdata) {
    const journalnr = stamdata.journalnr || '';
    const navn = stamdata.skadelidte || '';
    if (journalnr && navn) {
      filename = `${journalnr} - ${navn} - Årslønsberegning.pdf`;
    } else if (journalnr) {
      filename = `${journalnr} - Årslønsberegning.pdf`;
    } else if (navn) {
      filename = `${navn} - Årslønsberegning.pdf`;
    }
  }

  // Download PDF
  doc.save(filename);
};

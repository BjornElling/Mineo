/**
 * PDF Generator for Erstatningsopgørelse
 *
 * Genererer PDF-dokument med komplet erstatningsopgørelse
 */

import jsPDF from 'jspdf';
import { FONT_SIZES, MARGINS } from './pdfConfig';
import { addFooter, addBrevhoved, type BrevhovedData } from './pdfHelpers';
import type { ISODateString } from '../../types/branded';
import { isISODateString, isoToDanish, subtractOneDay } from '../../types/branded';
import type { FieldErrorBySource } from '../../types/fieldErrors';
import type { ErstatningsopgoerelseValues, StamdataValues, SvieSmertePeriodeRow } from '../../schemas/formSchemas';
import { buildEODebugSvieSmerteRows } from '../../domain/erstatningsopgoerelse/eoDebugErstatningsopgoerelseModel';
import { beregnArbejdsdageOgMaaneder } from '../../domain/debug/eoDebugRegulationCore';
import { calculateAarsloenRowDerived, isAarsloenRowEffectivelyEmpty } from '../aarsloenTableCalculations';
import { formatCurrency, formatPercent, parseAmount } from '../formatUtils';
import { MONTH_NAMES_DA } from '../dateFormatting';
import { aarsloenMax } from '../../data/regulationRates';
import { TODAY } from '../../config/dateRanges';
import { calculateTafAntalMaaneder } from '../../domain/erstatningsopgoerelse/tafCalculations';
import { buildIncomeForRanges, buildTafRanges } from '../../domain/erstatningsopgoerelse/indtaegtPerioder';

const NBSP = '\u00A0';

const ensureNonBreakingKr = (value: string): string => {
  return value.replace(/(-?\d[\d.,]*)\s+kr\./g, `$1${NBSP}kr.`);
};

const addWrappedText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  lineHeight: number,
  maxWidth: number
): number => {
  const safeText = ensureNonBreakingKr(text);
  const lines = doc.splitTextToSize(safeText, maxWidth);
  const pageHeight = doc.internal.pageSize.height;
  const contentBottom = pageHeight - MARGINS.bottom;

  let currentY = y;
  let startIndex = 0;
  while (startIndex < lines.length) {
    const availableLines = Math.floor((contentBottom - currentY) / lineHeight);
    if (availableLines <= 0) {
      doc.addPage();
      currentY = MARGINS.top;
      continue;
    }
    const endIndex = Math.min(lines.length, startIndex + availableLines);
    const chunk = lines.slice(startIndex, endIndex);
    doc.text(chunk, x, currentY);
    currentY += lineHeight * chunk.length;
    startIndex = endIndex;
    if (startIndex < lines.length) {
      doc.addPage();
      currentY = MARGINS.top;
    }
  }

  return currentY;
};

const addLeftRightText = (
  doc: jsPDF,
  leftText: string,
  rightText: string,
  x: number,
  y: number,
  lineHeight: number,
  rightPadding: number,
  maxRightWidth: number,
  options?: Readonly<{
    rightFontStyle?: 'normal' | 'bold';
    lineAboveRightWidth?: number;
    lineAboveRightOffset?: number;
    leftNoWrap?: boolean;
  }>
): number => {
  const pageHeight = doc.internal.pageSize.height;
  const contentBottom = pageHeight - MARGINS.bottom;
  const pageWidth = doc.internal.pageSize.width;
  const rightWidth = Math.min(maxRightWidth, doc.getTextWidth(rightText));
  const wrapPadding = doc.getTextWidth('000000');
  const leftMaxWidth = Math.max(30, pageWidth - x - rightPadding - rightWidth - 5 - wrapPadding);
  const leftLines = options?.leftNoWrap ? [ensureNonBreakingKr(leftText)] : doc.splitTextToSize(ensureNonBreakingKr(leftText), leftMaxWidth);
  let currentY = y;
  const neededHeight = lineHeight * leftLines.length;
  if (currentY + neededHeight > contentBottom) {
    doc.addPage();
    currentY = MARGINS.top;
  }
  doc.text(leftLines, x, currentY);
  const rightY = currentY + lineHeight * (leftLines.length - 1);
  const rightFontStyle = options?.rightFontStyle ?? 'bold';
  doc.setFont('helvetica', rightFontStyle);
  doc.text(rightText, pageWidth - rightPadding, rightY, { align: 'right' });
  if (options?.lineAboveRightWidth) {
    const lineWidth = options.lineAboveRightWidth;
    const lineEnd = pageWidth - rightPadding;
    const lineStart = lineEnd - lineWidth;
    const offset = options.lineAboveRightOffset ?? 2;
    doc.setLineWidth(0.2);
    doc.line(lineStart, rightY - offset, lineEnd, rightY - offset);
  }
  doc.setFont('helvetica', 'normal');
  return currentY + lineHeight * leftLines.length;
};

const addLeftRightTextSingleLine = (
  doc: jsPDF,
  leftText: string,
  rightText: string,
  x: number,
  y: number,
  lineHeight: number,
  rightPadding: number,
  options?: Readonly<{
    rightFontStyle?: 'normal' | 'bold';
    lineAboveRightWidth?: number;
    lineAboveRightOffset?: number;
  }>
): number => {
  const pageHeight = doc.internal.pageSize.height;
  const contentBottom = pageHeight - MARGINS.bottom;
  const pageWidth = doc.internal.pageSize.width;

  let currentY = y;
  if (currentY + lineHeight > contentBottom) {
    doc.addPage();
    currentY = MARGINS.top;
  }

  doc.text(ensureNonBreakingKr(leftText), x, currentY);
  const rightFontStyle = options?.rightFontStyle ?? 'bold';
  doc.setFont('helvetica', rightFontStyle);
  doc.text(rightText, pageWidth - rightPadding, currentY, { align: 'right' });
  if (options?.lineAboveRightWidth) {
    const lineWidth = options.lineAboveRightWidth;
    const lineEnd = pageWidth - rightPadding;
    const lineStart = lineEnd - lineWidth;
    const offset = options.lineAboveRightOffset ?? 2;
    doc.setLineWidth(0.2);
    doc.line(lineStart, currentY - offset, lineEnd, currentY - offset);
  }
  doc.setFont('helvetica', 'normal');
  return currentY + lineHeight;
};

const fitTextToWidth = (doc: jsPDF, text: string, maxWidth: number): string => {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  const ellipsis = '…';
  const ellipsisWidth = doc.getTextWidth(ellipsis);
  if (ellipsisWidth >= maxWidth) return '';
  let trimmed = text;
  while (trimmed.length > 0 && doc.getTextWidth(trimmed) + ellipsisWidth > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed.length > 0 ? `${trimmed}${ellipsis}` : '';
};

const addSectionHeader = (
  doc: jsPDF,
  text: string,
  currentY: number,
  lineHeight: number,
  doubleLineHeight: number,
  maxWidth: number
): number => {
  let nextY = currentY + doubleLineHeight;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZES.header);
  nextY = addWrappedText(doc, text, MARGINS.left, nextY, lineHeight, maxWidth);
  nextY += lineHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZES.normal);
  return nextY;
};

const addSubheader = (
  doc: jsPDF,
  text: string,
  currentY: number,
  lineHeight: number,
  maxWidth: number,
  options?: Readonly<{ addTopSpacing?: boolean }>
): number => {
  const addTopSpacing = options?.addTopSpacing ?? true;
  let nextY = addTopSpacing ? currentY + lineHeight : currentY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZES.normal);
  nextY = addWrappedText(doc, text, MARGINS.left, nextY, lineHeight, maxWidth);
  doc.setFont('helvetica', 'normal');
  return nextY;
};

const formatMaanederTrimmed = (value: number): string => {
  const rounded = Math.round(value * 10000) / 10000;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

const formatPercentDelta = (value: number): string => {
  const abs = Math.abs(value);
  const rounded = Math.round(abs * 100) / 100;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatPercentFixed2 = (value: number): string => {
  if (!Number.isFinite(value)) return '-';
  return `${value.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
};

type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

const resolveReguleringsdato = (
  eoValues: ErstatningsopgoerelseValues,
  af: Ansaettelsesforhold | undefined,
  skadesdato: ISODateString | undefined
): ISODateString | undefined => {
  const saerligDato = isISODateString(af?.saerligFraDatoRegulering)
    ? af?.saerligFraDatoRegulering
    : undefined;
  const angivetLoenDato = isISODateString(eoValues.angivetLoenOpreguleresFraDato)
    ? eoValues.angivetLoenOpreguleresFraDato
    : undefined;
  if (eoValues.beregnesUdFra !== 'Beregningsperiode') {
    return angivetLoenDato ?? skadesdato;
  }
  return saerligDato ?? skadesdato;
};

const resolveMaanedsloenBase = (
  eoValues: ErstatningsopgoerelseValues
): number | null => {
  if (eoValues.beregnesUdFra === 'Angivet månedsløn') {
    const value = eoValues.maanedsloenenUdgoer;
    return value !== undefined ? parseAmount(value) : null;
  }
  if (eoValues.beregnesUdFra !== 'Beregningsperiode') return null;

  let total = 0;
  for (const af of eoValues.loenindkomstAnsaettelsesforhold ?? []) {
    const rows = af.indtaegtsoplysningerTableData ?? [];
    const satser = {
      feriePct: af.feriePct,
      fritvalgPct: af.fritvalgPct,
      shSoPct: af.shSoPct,
      storeBededagPct: af.storeBededagPct,
      pensionPct: af.pensionPct,
    };
    for (const row of rows) {
      if (isAarsloenRowEffectivelyEmpty(row)) continue;
      const derived = calculateAarsloenRowDerived(row, satser);
      total += derived.samlet;
    }
  }

  const periodeFra = eoValues.periodeTilBeregningFra;
  const periodeTil = eoValues.periodeTilBeregningTil;
  if (!periodeFra || !periodeTil || periodeFra > periodeTil) return null;
  const oevrigeFravaersdageValue =
    eoValues.oevrigtFravaerUdenLoen === 'Ja' && typeof eoValues.oevrigeFravaersdage === 'number'
      ? eoValues.oevrigeFravaersdage
      : 0;
  const maaneder = calculateMaanederForInterval(periodeFra, periodeTil, oevrigeFravaersdageValue, eoValues);
  if (!maaneder || maaneder <= 0) return null;
  return total / maaneder;
};

const calculateMaanederForInterval = (
  fra: ISODateString,
  til: ISODateString,
  oevrigeFravaersdage: number,
  eoValues: ErstatningsopgoerelseValues
): number | null => {
  if (fra > til) return null;
  return calculateTafAntalMaaneder(
    fra,
    til,
    eoValues.fravaerPerioder ?? [],
    typeof eoValues.uspecificeredeFerieFridage === 'number' ? eoValues.uspecificeredeFerieFridage : 0,
    oevrigeFravaersdage
  );
};

const buildAslReguleringsSegments = (ranges: readonly IsoRange[]): ReadonlyArray<IsoRange & { year: number }> => {
  const segments: Array<IsoRange & { year: number }> = [];
  for (const range of ranges) {
    let currentStart = range.fra;
    while (currentStart <= range.til) {
      const year = Number(currentStart.slice(0, 4));
      if (!Number.isFinite(year)) break;
      const yearEnd = `${year}-12-31` as ISODateString;
      const segmentEnd = range.til < yearEnd ? range.til : yearEnd;
      segments.push({ fra: currentStart, til: segmentEnd, year });
      const nextStartDate = getDayAfter(segmentEnd);
      if (nextStartDate <= currentStart) break;
      currentStart = nextStartDate;
    }
  }
  return segments;
};

/**
 * Månedsnavn på dansk (med små bogstaver)
 */
/**
 * Formaterer ISO-dato til dansk datoformat (dd-mm-yyyy)
 *
 * @param {ISODateString} isoDate - Dato i ISO-format (yyyy-mm-dd)
 * @returns {string} Formateret dato (dd-mm-yyyy)
 */
const formatDateShort = (isoDate: ISODateString | undefined): string => {
  if (!isoDate) return '';

  const danish = isoToDanish(isoDate);
  if (!danish) return '';

  // danish er allerede i dd-mm-yyyy format, så returner direkte
  return danish;
};


/**
 * Formaterer ISO-dato til fuldt dansk format (d. måned yyyy)
 *
 * @param {ISODateString} isoDate - Dato i ISO-format (yyyy-mm-dd)
 * @returns {string} Formateret dato (d. måned yyyy)
 */
const formatDateLong = (isoDate: ISODateString | undefined): string => {
  if (!isoDate) return '';

  const danish = isoToDanish(isoDate);
  if (!danish) return '';

  // Konverter dd-mm-yyyy til d. måned yyyy
  const [day, month, year] = danish.split('-');
  const d = parseInt(day, 10); // Fjern leading zero
  const m = parseInt(month, 10) - 1; // Array er 0-indexed

  return `${d}. ${MONTH_NAMES_DA[m]} ${year}`;
};

/**
 * Interface for valgte elementer
 */
interface SelectedElements {
  opgoerelse: boolean;
  loenindkomst: boolean;
  offentligeYdelser: boolean;
  shDage: boolean;
  regulering: boolean;
  okSatser: boolean;
  sygeferiegodtgoerelse: boolean;
}

/**
 * Options for erstatningsopgørelse PDF
 */
interface ErstatningsopgoerelsePdfOptions {
  visBrevhoved?: boolean;
  erstatningsopgoerelseAfsluttesMed?: 'Bekræftet godkendt' | 'Underskrift-linje';
}

/**
 * Generer og download PDF for erstatningsopgørelse
 *
 * @param {StamdataValues} stamdataValues - Stamdata fra FormPersistence
 * @param {ErstatningsopgoerelseValues} eoValues - EO-oplysninger fra FormPersistence
 * @param {SelectedElements} selectedElements - Valgte elementer til PDF
 * @param {ErstatningsopgoerelsePdfOptions} options - Valgfrie indstillinger
 */
export const generateErstatningsopgoerelsePdf = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  _selectedElements: SelectedElements,
  options: ErstatningsopgoerelsePdfOptions = {}
) => {
  const { visBrevhoved = false } = options;
  const afsluttesMed = options.erstatningsopgoerelseAfsluttesMed;
  const lineHeight = 5;
  const doubleLineHeight = lineHeight * 2;

  // Opret nyt PDF-dokument (A4, portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  doc.setDisplayMode('100%');

  // Byg titel
  const erRevideret = eoValues.revideretOpgoerelse === 'Ja';
  const revideretPrefix = erRevideret ? 'Revideret ' : '';
  const erstatningsord = erRevideret ? 'erstatningsopgørelse' : 'Erstatningsopgørelse';
  const nummer = eoValues.eoNummer || '';
  const ledsagetekst = eoValues.eoLedsagetekst ? ` (${eoValues.eoLedsagetekst})` : '';
  const titel = `${revideretPrefix}${erstatningsord} ${nummer}${ledsagetekst}`;

  // Dokumentets metadata
  doc.setProperties({
    title: titel,
    subject: 'Erstatningsberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  let currentY = MARGINS.top;

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: stamdataValues.journalnr,
      advokat: stamdataValues.advokat,
      sagsbehandler: stamdataValues.sagsbehandler,
      // UND TAGELSE: EOberegning-tab bruger "Opgørelse lavet den" i stedet for dags dato.
      dagsDatoISO: eoValues.opgørelseLavetDen ?? TODAY,
    };
    currentY = addBrevhoved(doc, brevhovedData);
  }

  // Tilføj titel (fed skrift)
  doc.setFontSize(FONT_SIZES.title);
  doc.setFont('helvetica', 'bold');
  const fullWidth = doc.internal.pageSize.width - MARGINS.left - MARGINS.right;
  currentY = addWrappedText(doc, titel, MARGINS.left, currentY, lineHeight, fullWidth);

  // Tilføj erstatningsperiode-datoer direkte under titel
  doc.setFontSize(FONT_SIZES.normal);
  doc.setFont('helvetica', 'normal');
  const periodeFra = eoValues.vedroererPeriodeFra;
  const periodeTil = eoValues.vedroererPeriodeTil;
  if (periodeFra && periodeTil) {
    const periodeFraLang = formatDateShort(periodeFra);
    const periodeTilLang = formatDateShort(periodeTil);
    currentY = addWrappedText(
      doc,
      `${periodeFraLang} - ${periodeTilLang}`,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );
    currentY += lineHeight;
  }

  // Tilføj skadelidtes navn (fed skrift)
  doc.setFont('helvetica', 'bold');
  const navn = stamdataValues.skadelidte || '';
  if (navn) {
    currentY = addWrappedText(doc, navn, MARGINS.left, currentY, lineHeight, fullWidth);
  }

  // Tilføj skadestype og skadesdato (normal skrift)
  doc.setFont('helvetica', 'normal');
  const skadestype = stamdataValues.skadestype || '';
  const skadesdato = formatDateLong(stamdataValues.skadesdato);

  if (skadestype && skadesdato) {
    const erErhvervssygdom = skadestype === 'Erhvervssygdom';
    const anmeldt = erErhvervssygdom ? 'anmeldt ' : '';
    const skadestypeTekst = `${skadestype} ${anmeldt}den ${skadesdato}`;

    currentY = addWrappedText(doc, skadestypeTekst, MARGINS.left, currentY, lineHeight, fullWidth);
    currentY += lineHeight;
  }

  // ============================================================================
  // SVIE- OG SMERTEGODTGØRELSE SEKTION
  // ============================================================================

  currentY = addSectionHeader(
    doc,
    'Svie- og smertegodtgørelse',
    currentY,
    lineHeight,
    doubleLineHeight,
    fullWidth
  );

  currentY = addSubheader(doc, 'Status', currentY, lineHeight, fullWidth, { addTopSpacing: false });

  // Normal skrift for resten
  doc.setFont('helvetica', 'normal');

  // Helbredsstatus-tekst
  const helbredsstatus = eoValues.svieSmerteHelbredsstatus;
  const periodeTilISO = eoValues.vedroererPeriodeTil;

  if (helbredsstatus && periodeTilISO) {
    const dagenEfterPeriodeTil = formatDateLong(getDayAfter(periodeTilISO));

    if (helbredsstatus === 'Sygemeldt') {
      currentY = addWrappedText(
        doc,
        `Den ${dagenEfterPeriodeTil} var skadelidte fortsat sygemeldt.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (helbredsstatus === 'Delvist Sygemeldt') {
      currentY = addWrappedText(
        doc,
        `Den ${dagenEfterPeriodeTil} var skadelidte fortsat delvist sygemeldt.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (helbredsstatus === 'Raskmeldt') {
      // Tjek om svie/smerte er opgjort helt frem til periodeTil
      const erOpgjortFrem = erSvieSmerteopgjortFremTil(eoValues.svieSmertePerioder, periodeTilISO);

      if (erOpgjortFrem) {
        currentY = addWrappedText(
          doc,
          `Den ${dagenEfterPeriodeTil} blev skadelidte raskmeldt.`,
          MARGINS.left,
          currentY,
          lineHeight,
          fullWidth
        );
      } else {
        currentY = addWrappedText(
          doc,
          `Den ${dagenEfterPeriodeTil} var skadelidte raskmeldt.`,
          MARGINS.left,
          currentY,
          lineHeight,
          fullWidth
        );
      }
    }
  }

  // Mén-afgørelse-tekst
  const varigeMenAfgorelse = eoValues.varigeMenAfgorelse;
  const opgørelseLavetDen = eoValues.opgørelseLavetDen;
  const menAfgoerelseDato = eoValues.menAfgoerelseDato;
  const verserendeKlageMen = eoValues.verserendeKlageMen;

  if (varigeMenAfgorelse === 'Nej' && opgørelseLavetDen) {
    const dato = formatDateLong(opgørelseLavetDen);
    const tekst = `Der er den ${dato} ikke truffet afgørelse om varige mén.`;
    const medKlage = verserendeKlageMen === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
    currentY = addWrappedText(
      doc,
      medKlage,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );
  } else if (varigeMenAfgorelse === 'Ja' && menAfgoerelseDato) {
    const dato = formatDateLong(menAfgoerelseDato);
    const tekst = `Der er den ${dato} truffet afgørelse om varige mén.`;
    const medKlage = verserendeKlageMen === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
    currentY = addWrappedText(
      doc,
      medKlage,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );

    if (menAfgoerelseDato && isISODateString(menAfgoerelseDato)) {
      const ophoerDato = subtractOneDay(menAfgoerelseDato as ISODateString);
      if (ophoerDato) {
        const erOpgjortTilDagenFoer = erSvieSmerteopgjortFremTil(eoValues.svieSmertePerioder, ophoerDato);
        if (erOpgjortTilDagenFoer) {
          currentY = addWrappedText(
            doc,
            'Afgørelsen bringer retten til svie- og smertegodtgørelse til ophør.',
            MARGINS.left,
            currentY,
            lineHeight,
            fullWidth
          );
        }
      }
    }
  }

  const emptyErrors: Partial<Record<keyof ErstatningsopgoerelseValues, FieldErrorBySource>> = {};
  const svieSmerteContext = {
    skadesdatoISO: stamdataValues.skadesdato,
    erErhvervssygdom: stamdataValues.skadestype === 'Erhvervssygdom',
    menAfgoerelseDatoForTabel:
      eoValues.varigeMenAfgorelse === 'Ja' ? subtractOneDay(eoValues.menAfgoerelseDato) : undefined,
    verserendeKlageMen: eoValues.verserendeKlageMen === 'Ja',
  };

  const svieSmerteRows = buildEODebugSvieSmerteRows(eoValues, emptyErrors, svieSmerteContext);
  const beregnetPeriodeRow = svieSmerteRows.find((row) => row.id === 'sviesmerte.beregnetPeriode');
  const satserPerDagMaxRow = svieSmerteRows.find((row) => row.id === 'sviesmerte.satserPerDagMax');
  const antalDageRow = svieSmerteRows.find((row) => row.id === 'sviesmerte.antalDage');
  const beregnetBeloebRow = svieSmerteRows.find((row) => row.id === 'sviesmerte.beregnetBeloeb');
  const svieSmerteTotal = (() => {
    const raw = beregnetBeloebRow?.displayValue ?? '';
    const parsed = parseAmount(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  })();

  const periodeDisplay = beregnetPeriodeRow?.displayValue ?? '-';
  const periodeLines = periodeDisplay
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const hasSvieSmertePerioder = periodeDisplay.trim() !== '-' && periodeLines.length > 0;
  const periodeHeading =
    periodeLines.length > 1
      ? 'Sygeperioder, hvor der beregnes svie- og smertegodtgørelse'
      : 'Sygeperiode, hvor der beregnes svie- og smertegodtgørelse';

  currentY = addSubheader(doc, periodeHeading, currentY, lineHeight, fullWidth);
  if (!hasSvieSmertePerioder) {
    currentY = addWrappedText(doc, 'Ingen', MARGINS.left, currentY, lineHeight, fullWidth);
  }
  if (hasSvieSmertePerioder) {
    for (const line of periodeLines) {
      currentY = addWrappedText(doc, line, MARGINS.left, currentY, lineHeight, fullWidth);
    }

    currentY = addSubheader(doc, 'Beregningsgrundlag', currentY, lineHeight, fullWidth);
    const satserAar = eoValues.svieSmerteSatserAar !== undefined ? String(eoValues.svieSmerteSatserAar) : '-';
    currentY = addWrappedText(
      doc,
      `Beregningen af godtgørelse foretages ud fra satserne i år ${satserAar}.`,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );

    const satserDisplay = satserPerDagMaxRow?.displayValue ?? '-';
    const parsedSatser = parseSatserPerDagMax(satserDisplay);
    const perDagDisplay = parsedSatser.perDag ?? '-';
    const maxDisplay = parsedSatser.max ?? '-';
    const perDagDisplayWithKr = perDagDisplay === '-' ? perDagDisplay : `${perDagDisplay}${NBSP}kr.`;
    const maxDisplayWithKr = maxDisplay === '-' ? maxDisplay : `${maxDisplay}${NBSP}kr.`;
    currentY = addWrappedText(
      doc,
      `Taksten udgør ${perDagDisplayWithKr} pr. sygedag, dog højst ${maxDisplayWithKr}`,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );

    const tidligereValue = eoValues.svieSmerteTidligereTotal;
    const aktuelValue = eoValues.svieSmerteAktuelPeriode;
    const tidligereDefined = tidligereValue !== undefined;
    const aktuelDefined = aktuelValue !== undefined;
    const tidligereAmount = tidligereDefined ? parseAmount(tidligereValue) : 0;
    const aktuelAmount = aktuelDefined ? parseAmount(aktuelValue) : 0;
    if (tidligereDefined || aktuelDefined) {
      const tidligereDisplay = tidligereDefined ? `${formatCurrency(parseAmount(tidligereValue))}${NBSP}kr.` : '';
      const aktuelDisplay = aktuelDefined ? `${formatCurrency(parseAmount(aktuelValue))}${NBSP}kr.` : '';
      let tekst = '';
      if (tidligereDefined && aktuelDefined) {
        tekst = `Der er opgjort svie- og smertegodtgørelse med ${tidligereDisplay} for tidligere perioder samt modtaget ${aktuelDisplay} for denne periode.`;
      } else if (tidligereDefined) {
        tekst = `Der er opgjort svie- og smertegodtgørelse med ${tidligereDisplay} for tidligere perioder.`;
      } else if (aktuelDefined) {
        tekst = `Der er tidligere modtaget ${aktuelDisplay} for denne periode.`;
      }
      if (tekst) {
        currentY = addWrappedText(doc, tekst, MARGINS.left, currentY, lineHeight, fullWidth);
      }
    }

    currentY = addSubheader(doc, 'Beregnet krav på svie- og smertegodtgørelse', currentY, lineHeight, fullWidth);
    const counts = parseSvieSmerteCounts(antalDageRow?.displayValue ?? '');
    const perDagNumber = parsedSatser.perDag ? parseAmount(parsedSatser.perDag) : NaN;
    const perDagAmount = Number.isFinite(perDagNumber) ? perDagNumber : null;
    const delvisFaktor = eoValues.svieSmerteDelvisSygemeldingSats === 'fuld' ? 1 : 0.5;
    const delvisAmount = perDagAmount !== null ? perDagAmount * delvisFaktor : null;
    const maxNumber = parsedSatser.max ? parseAmount(parsedSatser.max) : NaN;
    const maxAmount = Number.isFinite(maxNumber) ? maxNumber : null;

    const formatCount = (value: number): string => value.toLocaleString('da-DK');
    const perDagText = perDagAmount !== null ? formatCurrency(perDagAmount) : '-';
    const delvisText = delvisAmount !== null ? formatCurrency(delvisAmount) : '-';
    const withKr = (value: string): string => (value === '-' ? value : `${value}${NBSP}kr.`);
    const perDagTextWithKr = withKr(perDagText);
    const delvisTextWithKr = withKr(delvisText);

    const lineLeft = (() => {
      if (!counts) return antalDageRow?.displayValue ?? '-';
      const sygedage = counts.sygedage;
      const delviseSygedage = counts.delviseSygedage;
      if (sygedage === 0 && delviseSygedage === 0) return '-';

      let base = '';
      if (delvisFaktor === 1) {
        const combined = [
          sygedage > 0 ? `${formatCount(sygedage)} sygedage` : '',
          delviseSygedage > 0 ? `${formatCount(delviseSygedage)} delvise sygedage` : '',
        ].filter((part) => part !== '').join(' og ');
        base = combined === '' ? '-' : `${combined} á ${perDagTextWithKr}`;
      } else {
        const parts: string[] = [];
        if (sygedage > 0) {
          parts.push(`${formatCount(sygedage)} sygedage á ${perDagTextWithKr}`);
        }
        if (delviseSygedage > 0) {
          parts.push(`${formatCount(delviseSygedage)} delvise sygedage á ${delvisTextWithKr}`);
        }
        base = parts.join(' og ');
      }

      if (base === '' || base === '-') return '-';

      const deductions: string[] = [];
      if (aktuelDefined) {
        deductions.push(`-${NBSP}${formatCurrency(aktuelAmount)}${NBSP}kr.`);
      }
      const rawAmount =
        perDagAmount !== null && delvisAmount !== null
          ? (sygedage * perDagAmount) + (delviseSygedage * delvisAmount)
          : null;
      const restPlads = maxAmount !== null ? maxAmount - tidligereAmount : null;
      const maxApplied = rawAmount !== null && restPlads !== null && rawAmount > Math.max(0, restPlads);
      const maxSuffix = maxApplied ? ' (reduceret til max)' : '';
      return `${base}${deductions.length > 0 ? ` ${deductions.join(' ')}` : ''}${maxSuffix} =`;
    })();

    const pageWidth = doc.internal.pageSize.width;
    const beloebDisplay = beregnetBeloebRow?.displayValue ?? '-';
    const beloebWidth = doc.getTextWidth(beloebDisplay);
    const wrapPadding = doc.getTextWidth('0000000000');
    const leftMaxWidth = Math.max(30, pageWidth - MARGINS.left - MARGINS.right - beloebWidth - 5 - wrapPadding);
    const leftLines = doc.splitTextToSize(ensureNonBreakingKr(lineLeft), leftMaxWidth);
    doc.text(leftLines, MARGINS.left, currentY);
    const beloebY = currentY + lineHeight * (leftLines.length - 1);
    doc.setFont('helvetica', 'bold');
    doc.text(beloebDisplay, pageWidth - MARGINS.right, beloebY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    currentY += lineHeight * leftLines.length;
  }

  // ============================================================================
  // TABT ARBEJDSFORTJENESTE SEKTION
  // ============================================================================

  currentY = addSectionHeader(
    doc,
    'Tabt arbejdsfortjeneste',
    currentY,
    lineHeight,
    doubleLineHeight,
    fullWidth
  );

  currentY = addSubheader(doc, 'Status', currentY, lineHeight, fullWidth, { addTopSpacing: false });

  // Normal skrift for resten
  doc.setFont('helvetica', 'normal');

  // Arbejdsstatus-tekst
  const arbejdsstatus = eoValues.tafArbejdsstatus;

  if (arbejdsstatus && periodeTilISO) {
    const dagenEfterPeriodeTil = formatDateLong(getDayAfter(periodeTilISO));

    if (arbejdsstatus === 'Uarbejdsdygtig') {
      currentY = addWrappedText(
        doc,
        `Den ${dagenEfterPeriodeTil} var skadelidte fortsat uarbejdsdygtig.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (arbejdsstatus === 'Delvist raskmeldt') {
      currentY = addWrappedText(
        doc,
        `Den ${dagenEfterPeriodeTil} var skadelidte fortsat delvist uarbejdsdygtig.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (arbejdsstatus === 'Fuldt arbejdsdygtig') {
      currentY = addWrappedText(
        doc,
        `Den ${dagenEfterPeriodeTil} var skadelidte fuldt arbejdsdygtig.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (arbejdsstatus === 'Fleksjob') {
      currentY = addWrappedText(
        doc,
        `Den ${dagenEfterPeriodeTil} var skadelidte i fleksjob.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (arbejdsstatus === 'Revalidering') {
      currentY = addWrappedText(
        doc,
        `Den ${dagenEfterPeriodeTil} var skadelidte i revalidering.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (arbejdsstatus === 'Uddannelse') {
      currentY = addWrappedText(
        doc,
        `Den ${dagenEfterPeriodeTil} var skadelidte i uddannelse.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (arbejdsstatus === 'Førtidspension') {
      currentY = addWrappedText(
        doc,
        `Den ${dagenEfterPeriodeTil} var skadelidte på førtidspension.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (arbejdsstatus === 'Seniorpension') {
      currentY = addWrappedText(
        doc,
        `Den ${dagenEfterPeriodeTil} var skadelidte på seniorpension.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (arbejdsstatus === 'Folkepension') {
      currentY = addWrappedText(
        doc,
        `Den ${dagenEfterPeriodeTil} var skadelidte på folkepension.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    }
  }

  // Erhvervsevnetabsafgørelse-tekst
  const endeligtEetAfgorelse = eoValues.endeligtEetAfgorelse;
  const midlertidigtEetAfgorelse = eoValues.midlertidigtEetAfgorelse;
  const verserendeKlageEet = eoValues.verserendeKlageEet;
  const differencekravDato = eoValues.differencekravDato;

  if (endeligtEetAfgorelse === 'Ja') {
    const virkningsdato = eoValues.endeligEETVirkningsdato;
    const afgoerelseDato = eoValues.endeligEETAfgoerelseDato;

    if (virkningsdato) {
      const virkningsdatoFormateret = formatDateLong(virkningsdato);
      const tekst = `Der er truffet endelig erhvervsevnetabsafgørelse med virkning fra ${virkningsdatoFormateret}.`;
      const medKlage = verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
      currentY = addWrappedText(
        doc,
        medKlage,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (afgoerelseDato) {
      const afgoerelseDatoFormateret = formatDateLong(afgoerelseDato);
      const tekst = `Der er den ${afgoerelseDatoFormateret} truffet endelig erhvervsevnetabsafgørelse.`;
      const medKlage = verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
      currentY = addWrappedText(
        doc,
        medKlage,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    }
  } else if (midlertidigtEetAfgorelse === 'Ja') {
    const virkningsdato = eoValues.midlertidigEETVirkningsdato;
    const afgoerelseDato = eoValues.midlertidigEETAfgoerelseDato;

    if (virkningsdato) {
      const virkningsdatoFormateret = formatDateLong(virkningsdato);
      const tekst = `Der er truffet midlertidig erhvervsevnetabsafgørelse med virkning fra ${virkningsdatoFormateret}.`;
      const medKlage = verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
      currentY = addWrappedText(
        doc,
        medKlage,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    } else if (afgoerelseDato) {
      const afgoerelseDatoFormateret = formatDateLong(afgoerelseDato);
      const tekst = `Der er den ${afgoerelseDatoFormateret} truffet midlertidig erhvervsevnetabsafgørelse.`;
      const medKlage = verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
      currentY = addWrappedText(
        doc,
        medKlage,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
    }
  } else if (opgørelseLavetDen) {
    // Hvis hverken endelig eller midlertidig afgørelse er truffet
    const dato = formatDateLong(opgørelseLavetDen);
    const tekst = `Der er den ${dato} ikke truffet afgørelse om erhvervsevnetab med 15 % eller derover.`;
    const medKlage = verserendeKlageEet === 'Ja' ? `${tekst} Afgørelsen er påklaget.` : tekst;
    currentY = addWrappedText(
      doc,
      medKlage,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );
  }

  // Differencekrav-tekst
  if (differencekravDato) {
    const differencekravDatoFormateret = formatDateLong(differencekravDato);
    currentY = addWrappedText(
      doc,
      `Der er opgjort differencekrav i sagen den ${differencekravDatoFormateret}.`,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );
  }

  // TAF-perioder
  currentY = addSubheader(
    doc,
    'Erstatningsperiode, hvor der beregnes tabt arbejdsfortjeneste',
    currentY,
    lineHeight,
    fullWidth
  );

  const tafPerioder = eoValues.tafPerioder || [];
  const tafPerioderLines: string[] = [];

  for (const periode of tafPerioder) {
    if (periode.fra && periode.til) {
      const fra = formatDateShort(periode.fra);
      const til = formatDateShort(periode.til);
      if (fra && til) {
        tafPerioderLines.push(`${fra} - ${til}`);
      }
    }
  }

  const hasTafPerioder = tafPerioderLines.length > 0;
  let loenudviklingTotal: number | null = null;
  let tafIndtaegterTotal: number | null = null;
  let tabtArbejdsfortjenesteTotal = 0;

  if (!hasTafPerioder) {
    currentY = addWrappedText(doc, 'Ingen', MARGINS.left, currentY, lineHeight, fullWidth);
  } else {
    for (const line of tafPerioderLines) {
      currentY = addWrappedText(doc, line, MARGINS.left, currentY, lineHeight, fullWidth);
    }

      // Kun hvis der ER TAF-perioder, vis resten af indholdet
      currentY = addSubheader(doc, 'Indkomst på skadestidspunktet', currentY, lineHeight, fullWidth);

    const beregnesUdFra = eoValues.beregnesUdFra;
    const loenBaseretPaa = eoValues.loenBaseretPaa;
    const skadesdato = stamdataValues.skadesdato;

      if (beregnesUdFra === 'Beregningsperiode') {
        const periodeTilBeregningFra = eoValues.periodeTilBeregningFra;
        const periodeTilBeregningTil = eoValues.periodeTilBeregningTil;

        if (periodeTilBeregningFra && periodeTilBeregningTil) {
          const fraFormateret = formatDateShort(periodeTilBeregningFra);
          const tilFormateret = formatDateShort(periodeTilBeregningTil);
          if (fraFormateret && tilFormateret) {
            currentY = addWrappedText(
              doc,
              `Beregnes på baggrund af indkomsten i perioden ${fraFormateret} - ${tilFormateret}.`,
              MARGINS.left,
              currentY,
              lineHeight,
              fullWidth
            );
            currentY += lineHeight;
          }
        }

        const ansaettelser = eoValues.loenindkomstAnsaettelsesforhold ?? [];
        const ansaettelserMedData = ansaettelser.filter((af) =>
          (af.indtaegtsoplysningerTableData ?? []).some((row) => !isAarsloenRowEffectivelyEmpty(row))
        );
        const ansaettelserNavne = ansaettelserMedData
          .map((af) => (af.navnPaaArbejdssted ?? '').trim())
          .filter((value, index, arr) => value !== '' && arr.indexOf(value) === index);

        for (const navnAf of ansaettelserNavne) {
          doc.text(navnAf, MARGINS.left, currentY);
          const nameWidth = doc.getTextWidth(navnAf);
          doc.setLineWidth(0.2);
          doc.line(MARGINS.left, currentY + 1, MARGINS.left + nameWidth, currentY + 1);
          currentY += lineHeight;
        }

        type IndkomstBreakdown = {
          ferieberet: number;
          fpFvShSo: number;
          pension: number;
          atp: number;
          samlet: number;
        };

        const breakdown: IndkomstBreakdown = ansaettelserMedData.reduce<IndkomstBreakdown>((acc, af) => {
          const satser = {
            feriePct: af.feriePct,
            fritvalgPct: af.fritvalgPct,
            shSoPct: af.shSoPct,
            storeBededagPct: af.storeBededagPct,
            pensionPct: af.pensionPct,
          };
          for (const row of af.indtaegtsoplysningerTableData ?? []) {
            if (isAarsloenRowEffectivelyEmpty(row)) continue;
            const derived = calculateAarsloenRowDerived(row, satser);
            const atp = parseAmount(row.col5);
            acc.ferieberet += derived.ferieberet;
            acc.fpFvShSo += derived.fpFvShSo;
            acc.pension += derived.pension;
            acc.atp += atp;
            acc.samlet += derived.samlet;
          }
          return acc;
        }, {
          ferieberet: 0,
          fpFvShSo: 0,
          pension: 0,
          atp: 0,
          samlet: 0,
        });

        if (ansaettelserMedData.length > 0) {
          const primaryAf = ansaettelserMedData[0];
          const feriePct = typeof primaryAf.feriePct === 'number' ? primaryAf.feriePct : 0;
          const fritvalgPct = typeof primaryAf.fritvalgPct === 'number' ? primaryAf.fritvalgPct : 0;
          const shSoPct = typeof primaryAf.shSoPct === 'number' ? primaryAf.shSoPct : 0;
          const storeBededagPct = typeof primaryAf.storeBededagPct === 'number' ? primaryAf.storeBededagPct : 0;
          const pensionPct = typeof primaryAf.pensionPct === 'number' ? primaryAf.pensionPct : 0;

          const pctParts: string[] = [];
          if (feriePct !== 0) pctParts.push(`Feriepenge (${formatPercent(feriePct)})`);
          if (fritvalgPct !== 0) pctParts.push(`Fritvalg (${formatPercent(fritvalgPct)})`);
          if (shSoPct !== 0) pctParts.push(`S/H (${formatPercent(shSoPct)})`);
          if (storeBededagPct !== 0) pctParts.push(`Store Bededag (${formatPercentFixed2(storeBededagPct)})`);
          const fpLabel = pctParts.length > 0
            ? pctParts.join(' + ')
            : 'Feriepenge m.v.';

          currentY = addLeftRightText(
            doc,
            'Ferieberettiget indkomst i beregningsperioden',
            `${formatCurrency(breakdown.ferieberet)}${NBSP}kr.`,
            MARGINS.left,
            currentY,
            lineHeight,
            MARGINS.right,
            doc.getTextWidth('000.000.000,00'),
            { rightFontStyle: 'normal' }
          );

          currentY = addLeftRightText(
            doc,
            fpLabel,
            `${formatCurrency(breakdown.fpFvShSo)}${NBSP}kr.`,
            MARGINS.left,
            currentY,
            lineHeight,
            MARGINS.right,
            doc.getTextWidth('000.000.000,00'),
            { rightFontStyle: 'normal' }
          );

          const pensionLabel = pensionPct !== 0
            ? `Arbejdsgivers pensionsbidrag (${formatPercent(pensionPct)} af løn + tillæg)`
            : 'Arbejdsgivers pensionsbidrag';
          currentY = addLeftRightText(
            doc,
            pensionLabel,
            `${formatCurrency(breakdown.pension)}${NBSP}kr.`,
            MARGINS.left,
            currentY,
            lineHeight,
            MARGINS.right,
            doc.getTextWidth('000.000.000,00'),
            { rightFontStyle: 'normal' }
          );

          currentY = addLeftRightText(
            doc,
            'Arbejdsgivers ATP-bidrag og anden indkomst uden tillæg',
            `${formatCurrency(breakdown.atp)}${NBSP}kr.`,
            MARGINS.left,
            currentY,
            lineHeight,
            MARGINS.right,
            doc.getTextWidth('000.000.000,00'),
            { rightFontStyle: 'normal' }
          );

          currentY = addLeftRightText(
            doc,
            'I alt:',
            `${formatCurrency(breakdown.samlet)}${NBSP}kr.`,
            MARGINS.left,
            currentY,
            lineHeight,
            MARGINS.right,
            doc.getTextWidth('000.000.000,00'),
            { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
          );
          currentY += lineHeight;

          const oevrigeFravaersdageValue =
            eoValues.oevrigtFravaerUdenLoen === 'Ja' && typeof eoValues.oevrigeFravaersdage === 'number'
              ? eoValues.oevrigeFravaersdage
              : 0;
          if (periodeTilBeregningFra && periodeTilBeregningTil) {
            const maaneder = calculateMaanederForInterval(
              periodeTilBeregningFra,
              periodeTilBeregningTil,
              oevrigeFravaersdageValue,
              eoValues
            );
              if (maaneder !== null && maaneder > 0) {
                const maanederText = formatMaanederTrimmed(maaneder);
                const maanedsloen = breakdown.samlet / maaneder;
                currentY = addLeftRightText(
                  doc,
                  `Månedsløn: ${formatCurrency(breakdown.samlet)}${NBSP}kr. / ${maanederText} måneder =`,
                  `${formatCurrency(maanedsloen)}${NBSP}kr.`,
                  MARGINS.left,
                  currentY,
                  lineHeight,
                  MARGINS.right,
                  doc.getTextWidth('000.000.000,00'),
                  { rightFontStyle: 'normal' }
                );
              }
          }
        }
      } else if (beregnesUdFra === 'Angivet månedsløn') {
      if (skadesdato) {
        const skadesdatoFormateret = formatDateShort(skadesdato);
        if (skadesdatoFormateret) {
          const maanedsloenenUdgoer = eoValues.maanedsloenenUdgoer;
          const beloebDisplay = maanedsloenenUdgoer !== undefined ? `${formatCurrency(parseAmount(maanedsloenenUdgoer))}${NBSP}kr.` : '';

          let leftText = '';
          if (loenBaseretPaa && loenBaseretPaa.trim() !== '') {
            leftText = `Månedslønnen er på baggrund af ${loenBaseretPaa} fastsat per ${skadesdatoFormateret} til`;
          } else {
            leftText = `Månedslønnen er fastsat per ${skadesdatoFormateret} til`;
          }

          const pageWidth = doc.internal.pageSize.width;
          const beloebWidth = doc.getTextWidth(beloebDisplay);
          const wrapPadding = doc.getTextWidth('0000000000');
          const leftMaxWidth = Math.max(30, pageWidth - MARGINS.left - MARGINS.right - beloebWidth - 5 - wrapPadding);
          const leftLines = doc.splitTextToSize(ensureNonBreakingKr(leftText), leftMaxWidth);
          doc.text(leftLines, MARGINS.left, currentY);
          const beloebY = currentY + lineHeight * (leftLines.length - 1);
          doc.setFont('helvetica', 'bold');
          doc.text(beloebDisplay, pageWidth - MARGINS.right, beloebY, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          currentY += lineHeight * leftLines.length;
        }
      }
      } else if (beregnesUdFra === 'Angivet dagsløn') {
        if (skadesdato) {
          const skadesdatoFormateret = formatDateShort(skadesdato);
          if (skadesdatoFormateret) {
            const dagsloenenUdgoer = eoValues.dagsloenenUdgoer;
          const beloebDisplay = dagsloenenUdgoer !== undefined ? `${formatCurrency(parseAmount(dagsloenenUdgoer))}${NBSP}kr.` : '';

          let leftText = '';
          if (loenBaseretPaa && loenBaseretPaa.trim() !== '') {
            leftText = `Dagslønnen er på baggrund af ${loenBaseretPaa} fastsat per ${skadesdatoFormateret} til`;
          } else {
            leftText = `Dagslønnen er fastsat per ${skadesdatoFormateret} til`;
          }

          const pageWidth = doc.internal.pageSize.width;
          const beloebWidth = doc.getTextWidth(beloebDisplay);
          const wrapPadding = doc.getTextWidth('0000000000');
          const leftMaxWidth = Math.max(30, pageWidth - MARGINS.left - MARGINS.right - beloebWidth - 5 - wrapPadding);
          const leftLines = doc.splitTextToSize(ensureNonBreakingKr(leftText), leftMaxWidth);
          doc.text(leftLines, MARGINS.left, currentY);
          const beloebY = currentY + lineHeight * (leftLines.length - 1);
          doc.setFont('helvetica', 'bold');
          doc.text(beloebDisplay, pageWidth - MARGINS.right, beloebY, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            currentY += lineHeight * leftLines.length;
          }
        }
      }

      // Indkomst, hvis skaden ikke var indtrådt
      currentY = addSubheader(doc, 'Indkomst, hvis skaden ikke var indtrådt', currentY, lineHeight, fullWidth);
      currentY = addWrappedText(
        doc,
        'Opgøres som lønnen på skadesdatoen tillagt efterfølgende lønstigninger.',
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );

      const ansaettelser = eoValues.loenindkomstAnsaettelsesforhold ?? [];
      const aktivLoenudvikling = ansaettelser.filter((af) => af.loenudviklingBeregningsgrundlag && af.loenudviklingBeregningsgrundlag !== 'Ingen');
      const loenudviklingBasis = aktivLoenudvikling[0]?.loenudviklingBeregningsgrundlag;
      const loenudviklingModel = aktivLoenudvikling[0]?.loenudviklingStatistikModel ?? '';
      const ensartetModel = aktivLoenudvikling.every((af) =>
        af.loenudviklingBeregningsgrundlag === loenudviklingBasis &&
        (af.loenudviklingStatistikModel ?? '') === loenudviklingModel
      );

      const loenudviklingLabel = (() => {
        if (!loenudviklingBasis) return '-';
        if (loenudviklingBasis === 'Statistik' && loenudviklingModel.trim() !== '') return loenudviklingModel.trim();
        if (loenudviklingBasis === 'Manuelt angivet') {
          const manuelNavn = aktivLoenudvikling[0]?.loenudviklingManuelNavn?.trim();
          return manuelNavn && manuelNavn !== '' ? manuelNavn : 'Manuelt angivet';
        }
        return loenudviklingBasis;
      })();

      currentY = addWrappedText(
        doc,
        `Lønudvikling beregnes ud fra ${loenudviklingLabel}.`,
        MARGINS.left,
        currentY,
        lineHeight,
        fullWidth
      );
      currentY += lineHeight;

      const skadesdatoIso = isISODateString(stamdataValues.skadesdato) ? stamdataValues.skadesdato : undefined;
      const reguleringsdato = resolveReguleringsdato(eoValues, aktivLoenudvikling[0], skadesdatoIso);
      const reguleringsYear = reguleringsdato ? Number(reguleringsdato.slice(0, 4)) : NaN;
      const baseIndexValue = Number.isFinite(reguleringsYear)
        ? aarsloenMax[reguleringsYear as keyof typeof aarsloenMax]
        : undefined;
      const maanedsloenBase = resolveMaanedsloenBase(eoValues);

      const tafRanges = buildTafRanges(eoValues);

        loenudviklingTotal = null;
        const canBuildAsl =
          ensartetModel &&
          loenudviklingBasis === 'Statistik' &&
          loenudviklingLabel.startsWith('ASL-') &&
          typeof baseIndexValue === 'number' &&
          baseIndexValue > 0 &&
          typeof maanedsloenBase === 'number' &&
          maanedsloenBase > 0 &&
          tafRanges.length > 0;

      if (!canBuildAsl) {
        currentY = addWrappedText(
          doc,
          'Lønudvikling kan ikke beregnes for den valgte opsætning.',
          MARGINS.left,
          currentY,
          lineHeight,
          fullWidth
        );
      } else {
        const segments = buildAslReguleringsSegments(tafRanges);
          let total = 0;
          const rightMaxWidth = doc.getTextWidth('000.000.000,00');

        for (const segment of segments) {
          const indexValue = aarsloenMax[segment.year as keyof typeof aarsloenMax];
          if (typeof indexValue !== 'number' || indexValue <= 0) continue;

          const maanederStats = beregnArbejdsdageOgMaaneder(
            segment.fra,
            segment.til,
            new Set<ISODateString>(),
            new Set<ISODateString>()
          );
          const maaneder = maanederStats.maaneder;
          if (!Number.isFinite(maaneder) || maaneder <= 0) continue;

          const deltaPct = (indexValue / baseIndexValue - 1) * 100;
          const roundedDeltaPct = Math.round(deltaPct * 100) / 100;
          const roundedMaaneder = Math.round(maaneder * 10000) / 10000;
          const factorText = Math.abs(roundedDeltaPct) < 0.00001
            ? ''
            : ` x (100 % ${roundedDeltaPct >= 0 ? '+' : '-'} ${formatPercentDelta(roundedDeltaPct)} %)`;
          const roundedMaanedsloenBase = Math.round(maanedsloenBase * 100) / 100;
          const maanederText = formatMaanederTrimmed(roundedMaaneder);
          const maanedsloenText = formatCurrency(roundedMaanedsloenBase);
          const fraDisplay = formatDateShort(segment.fra);
          const tilDisplay = formatDateShort(segment.til);
          const leftText = `${fraDisplay} - ${tilDisplay}: ${maanederText} måneder á ${maanedsloenText}${NBSP}kr.${factorText} =`;
          const amount = roundedMaanedsloenBase * roundedMaaneder * (1 + roundedDeltaPct / 100);
          total += amount;
          const rightText = `${formatCurrency(amount)}${NBSP}kr.`;
          currentY = addLeftRightText(
            doc,
            leftText,
            rightText,
            MARGINS.left,
            currentY,
            lineHeight,
            MARGINS.right,
            rightMaxWidth,
            { rightFontStyle: 'normal' }
          );
        }

          currentY = addLeftRightText(
            doc,
            'I alt',
            `${formatCurrency(total)}${NBSP}kr.`,
            MARGINS.left,
            currentY,
            lineHeight,
            MARGINS.right,
            rightMaxWidth,
            { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
          );
          loenudviklingTotal = total;
        }

        // Indtægter i erstatningsperioden (TAF-perioden)
        tafIndtaegterTotal = null;
        if (tafRanges.length > 0) {
          currentY = addSubheader(doc, 'Indtægter i erstatningsperioden', currentY, lineHeight, fullWidth);

        const indtaegtEntries: Array<{ label: string; amount: number }> = [];
        const indtaegter = buildIncomeForRanges(eoValues, tafRanges);
        indtaegter.employers.forEach((entry) => {
          const label = entry.name !== '' ? entry.name : 'Arbejdssted';
          indtaegtEntries.push({ label, amount: entry.amount });
        });
          indtaegter.benefits.forEach((entry) => {
            indtaegtEntries.push({ label: entry.label, amount: entry.amount });
          });

          if (indtaegtEntries.length > 0) {
            tafIndtaegterTotal = indtaegtEntries.reduce((acc, entry) => acc + entry.amount, 0);
          }

          const rightMaxWidth = doc.getTextWidth('000.000.000,00');
          for (const entry of indtaegtEntries) {
            currentY = addLeftRightText(
              doc,
              entry.label,
              `${formatCurrency(entry.amount)}${NBSP}kr.`,
              MARGINS.left,
              currentY,
              lineHeight,
              MARGINS.right,
              rightMaxWidth,
              { rightFontStyle: 'normal' }
            );
          }

          if (indtaegtEntries.length === 0) {
            currentY = addWrappedText(doc, 'Ingen', MARGINS.left, currentY, lineHeight, fullWidth);
          } else if (indtaegtEntries.length > 1) {
            const total = indtaegtEntries.reduce((acc, entry) => acc + entry.amount, 0);
            currentY = addLeftRightText(
              doc,
              'I alt',
              `${formatCurrency(total)}${NBSP}kr.`,
              MARGINS.left,
              currentY,
              lineHeight,
              MARGINS.right,
              rightMaxWidth,
              { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
            );
          }
        }

        if (typeof loenudviklingTotal === 'number' && typeof tafIndtaegterTotal === 'number') {
          currentY = addSubheader(doc, 'Beregnet krav på tabt arbejdsfortjeneste', currentY, lineHeight, fullWidth);

          const rightMaxWidth = doc.getTextWidth('000.000.000,00');
          const leftText = `${formatCurrency(loenudviklingTotal)}${NBSP}kr. - ${formatCurrency(tafIndtaegterTotal)}${NBSP}kr. =`;
          const diff = loenudviklingTotal - tafIndtaegterTotal;
          tabtArbejdsfortjenesteTotal = diff;
          const rightText = `${formatCurrency(diff)}${NBSP}kr.`;
          currentY = addLeftRightText(
            doc,
            leftText,
            rightText,
            MARGINS.left,
            currentY,
            lineHeight,
            MARGINS.right,
            rightMaxWidth,
            { rightFontStyle: 'bold' }
          );
        }

  }

  // Øvrige krav
  currentY = addSectionHeader(doc, 'Øvrige krav', currentY, lineHeight, doubleLineHeight, fullWidth);

  const oevrigeKravRows = eoValues.oevrigeKravPerioder ?? [];
  const kravEntries: Array<{ dateText: string; udgiftTil: string; amount: number | null }> = [];
  for (const row of oevrigeKravRows) {
    const dateText = row.dato ? formatDateShort(row.dato) ?? '' : '';
    const udgiftTil = (row.udgiftTil ?? '').trim();
    const amountValue = row.beloeb !== undefined ? parseAmount(row.beloeb) : NaN;
    const amount = Number.isFinite(amountValue) ? amountValue : null;
    if (dateText === '' && udgiftTil === '' && amount === null) continue;
    kravEntries.push({ dateText, udgiftTil, amount });
  }

  const oevrigeKravTotal = kravEntries.reduce((acc, entry) => {
    return typeof entry.amount === 'number' ? acc + entry.amount : acc;
  }, 0);

  if (kravEntries.length === 0) {
    currentY = addWrappedText(doc, 'Ingen', MARGINS.left, currentY, lineHeight, fullWidth);
  } else {
    const indentX = MARGINS.left;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const contentBottom = pageHeight - MARGINS.bottom;
    const rightX = pageWidth - MARGINS.right;
    const totalMaxWidth = doc.getTextWidth('000.000.000,00');
    const rightMaxWidth = totalMaxWidth;
    const leftMaxWidth = Math.max(30, rightX - totalMaxWidth - indentX - 5);
    let total = 0;

    for (const entry of kravEntries) {
      const udgiftText = entry.udgiftTil !== '' ? entry.udgiftTil : '-';
      const dateSuffix = entry.dateText !== '' ? `, ${entry.dateText}` : '';
      const amountText =
        typeof entry.amount === 'number' ? `${formatCurrency(entry.amount)}${NBSP}kr.` : '-';
      if (typeof entry.amount === 'number') {
        total += entry.amount;
      }

      if (currentY + lineHeight > contentBottom) {
        doc.addPage();
        currentY = MARGINS.top;
      }

      const leftText = fitTextToWidth(
        doc,
        ensureNonBreakingKr(`${udgiftText}${dateSuffix}`),
        leftMaxWidth
      );
      currentY = addLeftRightTextSingleLine(
        doc,
        leftText,
        amountText,
        indentX,
        currentY,
        lineHeight,
        MARGINS.right,
        { rightFontStyle: 'normal' }
      );
    }

    if (kravEntries.length > 1) {
      currentY = addLeftRightText(
        doc,
        'I alt',
        `${formatCurrency(total)}${NBSP}kr.`,
        MARGINS.left,
        currentY,
        lineHeight,
        MARGINS.right,
        rightMaxWidth,
        { rightFontStyle: 'bold', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
      );
    }
  }

  currentY = addSectionHeader(
    doc,
    'Samlet erstatningskrav',
    currentY,
    lineHeight,
    doubleLineHeight,
    fullWidth
  );

  const periodeFraKort = formatDateShort(eoValues.vedroererPeriodeFra);
  const periodeTilKort = formatDateShort(eoValues.vedroererPeriodeTil);
  const periodeText =
    periodeFraKort && periodeTilKort
      ? `Det samlede krav for perioden ${periodeFraKort} - ${periodeTilKort} udgør:`
      : 'Det samlede krav udgør:';
  currentY = addWrappedText(doc, periodeText, MARGINS.left, currentY, lineHeight, fullWidth);
  currentY += lineHeight;

  const summaryRightMaxWidth = doc.getTextWidth('000.000.000,00');
  const oevrigeKravDisplay = oevrigeKravTotal;
  const samletTotal = svieSmerteTotal + tabtArbejdsfortjenesteTotal + oevrigeKravDisplay;

  currentY = addLeftRightText(
    doc,
    'Svie- og smertegodtgørelse',
    `${formatCurrency(svieSmerteTotal)}${NBSP}kr.`,
    MARGINS.left,
    currentY,
    lineHeight,
    MARGINS.right,
    summaryRightMaxWidth,
    { rightFontStyle: 'normal' }
  );
  currentY = addLeftRightText(
    doc,
    'Tabt arbejdsfortjeneste',
    `${formatCurrency(tabtArbejdsfortjenesteTotal)}${NBSP}kr.`,
    MARGINS.left,
    currentY,
    lineHeight,
    MARGINS.right,
    summaryRightMaxWidth,
    { rightFontStyle: 'normal' }
  );
  currentY = addLeftRightText(
    doc,
    'Øvrige krav',
    `${formatCurrency(oevrigeKravDisplay)}${NBSP}kr.`,
    MARGINS.left,
    currentY,
    lineHeight,
    MARGINS.right,
    summaryRightMaxWidth,
    { rightFontStyle: 'normal' }
  );
  doc.setFont('helvetica', 'bold');
  currentY = addLeftRightText(
    doc,
    'Erstatningskrav i alt',
    `${formatCurrency(samletTotal)}${NBSP}kr.`,
    MARGINS.left,
    currentY,
    lineHeight,
    MARGINS.right,
    summaryRightMaxWidth,
    { rightFontStyle: 'bold', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
  );
  doc.setFont('helvetica', 'normal');
  // TODO: Tilføj resten af PDF-indholdet baseret på selectedElements
  const saerligeKommentarer = (eoValues.saerligeKommentarer ?? '').trim();
  if (saerligeKommentarer !== '') {
    currentY = addSectionHeader(doc, 'Særlige bemærkninger', currentY, lineHeight, doubleLineHeight, fullWidth);
    currentY = addWrappedText(doc, saerligeKommentarer, MARGINS.left, currentY, lineHeight, fullWidth);
  }
  currentY += doubleLineHeight;
  if (afsluttesMed === 'Bekræftet godkendt') {
    currentY = addWrappedText(
      doc,
      'Opgørelsen er gennemgået af skadelidte, som har bekræftet, at oplysningerne i opgørelsen er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevant oplysninger, som skadelidte er bekendt med.',
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );
  } else {
    currentY = addWrappedText(
      doc,
      'Opgørelsen er gennemgået af skadelidte, som ved sin underskrift nedenfor bekræfter, at oplysningerne i opgørelsen er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevant oplysninger, som skadelidte er bekendt med.',
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );
    currentY += lineHeight * 2;
    const skadelidteNavn = (stamdataValues.skadelidte ?? '').trim() || '*skadelidtes navn*';
    const dateX = MARGINS.left;
    const dateLine = '____ / ____ - ____________';
    const sigX = MARGINS.left + 90;
    const sigLine = '________________________________________';
    doc.text(dateLine, dateX, currentY);
    doc.text(sigLine, sigX, currentY);
    currentY += lineHeight;
    const dateCenterX = dateX + doc.getTextWidth(dateLine) / 2;
    const sigCenterX = sigX + doc.getTextWidth(sigLine) / 2;
    doc.text('Dato', dateCenterX, currentY, { align: 'center' });
    doc.text(skadelidteNavn, sigCenterX, currentY, { align: 'center' });
  }

  // Tilføj footer med versionsnummer
  addFooter(doc);

  // Download PDF
  doc.save(`${titel}.pdf`);
};

const parseSvieSmerteCounts = (
  value: string
): { sygedage: number; delviseSygedage: number } | null => {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '-') {
    return { sygedage: 0, delviseSygedage: 0 };
  }
  if (trimmed.toLowerCase().startsWith('fejl')) return null;

  const sygedageMatch = trimmed.match(/([0-9.,]+)\s+sygedage/i);
  const delviseMatch = trimmed.match(/([0-9.,]+)\s+delvise sygedage/i);

  if (!sygedageMatch && !delviseMatch) return null;

  const sygedage = sygedageMatch ? parseAmount(sygedageMatch[1]) : 0;
  const delviseSygedage = delviseMatch ? parseAmount(delviseMatch[1]) : 0;

  if (!Number.isFinite(sygedage) || !Number.isFinite(delviseSygedage)) return null;

  return {
    sygedage: Math.trunc(sygedage),
    delviseSygedage: Math.trunc(delviseSygedage),
  };
};

const parseSatserPerDagMax = (
  value: string
): { perDag: string | null; max: string | null } => {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase().startsWith('fejl')) {
    return { perDag: null, max: null };
  }

  const parts = trimmed.split('/');
  if (parts.length !== 2) return { perDag: null, max: null };

  const perDag = parts[0].replace(/kr\.\s*$/i, '').trim();
  const max = parts[1].replace(/kr\.\s*$/i, '').trim();

  return {
    perDag: perDag === '' ? null : perDag,
    max: max === '' ? null : max,
  };
};

/**
 * Beregner dagen efter en given ISO-dato
 *
 * @param {ISODateString} isoDate - Dato i ISO-format
 * @returns {ISODateString} Dagen efter
 */
const getDayAfter = (isoDate: ISODateString): ISODateString => {
  const danish = isoToDanish(isoDate);
  if (!danish) return isoDate;

  const [day, month, year] = danish.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}` as ISODateString;
};

/**
 * Tjekker om svie/smerte er opgjort helt frem til en given dato
 *
 * @param {SvieSmertePeriodeRow[]} perioder - Svie/smerte perioder
 * @param {ISODateString} targetDate - Måldato at tjekke op til
 * @returns {boolean} True hvis opgjort frem til targetDate
 */
const erSvieSmerteopgjortFremTil = (
  perioder: SvieSmertePeriodeRow[] | undefined,
  targetDate: ISODateString
): boolean => {
  if (!perioder || perioder.length === 0) return false;

  // Find den seneste til-dato i perioderne
  let senestetilDato: ISODateString | undefined;

  for (const periode of perioder) {
    if (periode.til) {
      if (!senestetilDato || periode.til > senestetilDato) {
        senestetilDato = periode.til;
      }
    }
  }

  // Sammenlign med targetDate
  return senestetilDato === targetDate;
};

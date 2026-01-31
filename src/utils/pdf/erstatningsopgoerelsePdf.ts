/**
 * PDF Generator for Erstatningsopgørelse
 *
 * Genererer PDF-dokument med komplet erstatningsopgørelse
 */

import jsPDF from 'jspdf';
import { FONT_SIZES, MARGINS } from './pdfConfig';
import { addFooter, addBrevhoved, type BrevhovedData } from './pdfHelpers';
import type { ISODateString } from '../../types/branded';
import { isoToDanish, subtractOneDay } from '../../types/branded';
import type { FieldErrorBySource } from '../../types/fieldErrors';
import type { ErstatningsopgoerelseValues, StamdataValues, SvieSmertePeriodeRow } from '../../schemas/formSchemas';
import { buildEODebugSvieSmerteRows } from '../../domain/erstatningsopgoerelse/eoDebugErstatningsopgoerelseModel';
import { formatCurrency, parseAmount } from '../formatUtils';
import { MONTH_NAMES_DA } from '../dateFormatting';

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
  doc.text(lines, x, y);
  return y + lineHeight * lines.length;
};

/**
 * Månedsnavn på dansk (med små bogstaver)
 */
/**
 * Formaterer ISO-dato til dansk datoformat (d/m yyyy)
 *
 * @param {ISODateString} isoDate - Dato i ISO-format (yyyy-mm-dd)
 * @returns {string} Formateret dato (d/m yyyy)
 */
const formatDateShort = (isoDate: ISODateString | undefined): string => {
  if (!isoDate) return '';

  const danish = isoToDanish(isoDate);
  if (!danish) return '';

  // Konverter dd-mm-yyyy til d/m yyyy
  const [day, month, year] = danish.split('-');
  const d = parseInt(day, 10); // Fjern leading zero
  const m = parseInt(month, 10); // Fjern leading zero

  return `${d}/${m} ${year}`;
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
      skadelidte: stamdataValues.skadelidte,
      skadestype: stamdataValues.skadestype,
      skadesdato: stamdataValues.skadesdato,
      journalnr: stamdataValues.journalnr,
    };
    currentY = addBrevhoved(doc, brevhovedData);
  }

  // Tilføj titel (fed skrift)
  doc.setFontSize(FONT_SIZES.title);
  doc.setFont('helvetica', 'bold');
  const fullWidth = doc.internal.pageSize.width - MARGINS.left - MARGINS.right;
  currentY = addWrappedText(doc, titel, MARGINS.left, currentY, lineHeight, fullWidth);

  // Tilføj erstatningsperiode (normal skrift)
  doc.setFontSize(FONT_SIZES.normal);
  doc.setFont('helvetica', 'normal');

  const periodeFra = formatDateShort(eoValues.vedroererPeriodeFra);
  const periodeTil = formatDateShort(eoValues.vedroererPeriodeTil);

  if (periodeFra && periodeTil) {
    currentY = addWrappedText(doc, `${periodeFra} - ${periodeTil}`, MARGINS.left, currentY, lineHeight, fullWidth);
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
  // SVIE- OG SMERTEGODTGRELSE SEKTION
  // ============================================================================

  currentY += doubleLineHeight;

  // Overskrift: Svie- og smertegodtgørelse (fed skrift)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FONT_SIZES.header);
  currentY = addWrappedText(doc, 'Svie- og smertegodtgørelse', MARGINS.left, currentY, lineHeight, fullWidth);
  currentY += lineHeight;

  // Underoverskrift: Status (fed skrift)
  doc.setFontSize(FONT_SIZES.normal);
  currentY = addWrappedText(doc, 'Status', MARGINS.left, currentY, lineHeight, fullWidth);

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
    currentY = addWrappedText(
      doc,
      `Der er den ${dato} ikke truffet afgørelse om varige mén.`,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );
    if (verserendeKlageMen === 'Ja') {
      currentY = addWrappedText(doc, 'Afgørelsen er påklaget.', MARGINS.left, currentY, lineHeight, fullWidth);
    }
  } else if (varigeMenAfgorelse === 'Ja' && menAfgoerelseDato) {
    const dato = formatDateLong(menAfgoerelseDato);
    currentY = addWrappedText(
      doc,
      `Der er den ${dato} truffet afgørelse om varige mén.`,
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );

    // Hvis påklaget, tilføj ekstra sætning
    if (verserendeKlageMen === 'Ja') {
      currentY = addWrappedText(doc, 'Afgørelsen er påklaget.', MARGINS.left, currentY, lineHeight, fullWidth);
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

  currentY += lineHeight;
  doc.setFont('helvetica', 'bold');
  currentY = addWrappedText(doc, periodeHeading, MARGINS.left, currentY, lineHeight, fullWidth);

  doc.setFont('helvetica', 'normal');
  if (!hasSvieSmertePerioder) {
    currentY = addWrappedText(doc, 'Ingen', MARGINS.left, currentY, lineHeight, fullWidth);
  }
  if (hasSvieSmertePerioder) {
    for (const line of periodeLines) {
      currentY = addWrappedText(doc, line, MARGINS.left, currentY, lineHeight, fullWidth);
    }

    currentY += lineHeight;
    doc.setFont('helvetica', 'bold');
    currentY = addWrappedText(doc, 'Beregningsgrundlag', MARGINS.left, currentY, lineHeight, fullWidth);

    doc.setFont('helvetica', 'normal');
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

    currentY += lineHeight;

    doc.setFont('helvetica', 'bold');
    currentY = addWrappedText(
      doc,
      'Beregnet krav på svie- og smertegodtgørelse',
      MARGINS.left,
      currentY,
      lineHeight,
      fullWidth
    );

    doc.setFont('helvetica', 'normal');
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

  // TODO: Tilføj resten af PDF-indholdet baseret på selectedElements

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

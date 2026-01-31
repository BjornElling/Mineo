/**
 * PDF Generator for SH-dage (Søgnehelligdage på hverdage)
 *
 * Genererer PDF-dokument med oversigt over danske helligdage der falder på hverdage
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COLORS, MARGINS, FONT_SIZES, TABLE_STYLES, SECTION_SPACER } from './pdfConfig';
import { beregnHelligdage } from '../shDageBeregning';
import { addTitle, addFooter, addBrevhoved, type BrevhovedData } from './pdfHelpers';
import { formatToISO, parseISODate } from '../dateUtils';
import { diffUtcDays } from '../utcDayMath';
import { MONTH_NAMES_DA } from '../dateFormatting';
import type { ISODateString } from '../../types/branded';

/**
 * Stamdata til SH-dage PDF
 */
export interface SHDageStamdata {
  skadelidte?: string;
  skadestype?: string;
  skadesdato?: ISODateString;
  journalnr?: string;
}

/**
 * Options for SH-dage PDF
 */
export interface SHDagePdfOptions {
  visBrevhoved?: boolean;
}

/**
 * Danske ugedagsnavne
 */
const UGEDAGE = [
  'Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'
];

/**
 * Identificer hvilken helligdag en dato er
 *
 * @param {Date} dato - Datoen at identificere
 * @param {Date} paaske - Påskedag for året
 * @returns {string|null} Helligdagsnavn eller null
 */
const identificerHelligdag = (dato, paaske) => {
  const aar = dato.getFullYear();

  // Nytårsdag
  if (dato.getMonth() === 0 && dato.getDate() === 1) {
    return 'Nytårsdag';
  }

  // Juledag
  if (dato.getMonth() === 11 && dato.getDate() === 25) {
    return 'Juledag';
  }

  // Anden juledag
  if (dato.getMonth() === 11 && dato.getDate() === 26) {
    return 'Anden juledag';
  }

  // Påskerelaterede helligdage
  const diffDays = diffUtcDays(dato, paaske);

  if (diffDays === -3) return 'Skærtorsdag';
  if (diffDays === -2) return 'Langfredag';
  if (diffDays === 0) return 'Påskedag';
  if (diffDays === 1) return 'Anden påskedag';
  if (diffDays === 26 && aar <= 2023) return 'Store bededag';
  if (diffDays === 39) return 'Kristi himmelfartsdag';
  if (diffDays === 49) return 'Pinsedag';
  if (diffDays === 50) return 'Anden pinsedag';

  return null;
};

/**
 * Formater dato til dansk format (d. måned åååå)
 *
 * @param {Date} date - Datoen at formatere
 * @returns {string} Formateret dato
 */
const formatDanskDato = (date) => {
  const dag = date.getDate();
  const maaned = date.getMonth();
  const aar = date.getFullYear();
  return `${dag}. ${MONTH_NAMES_DA[maaned]} ${aar}`;
};

/**
 * Tjek om to datoer er samme dag
 *
 * @param {Date} date1 - Første dato
 * @param {Date} date2 - Anden dato
 * @returns {boolean} True hvis samme dag
 */
const _erSammeDag = (date1, date2) => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

/**
 * Beregner påskedag for et givet år
 *
 * @param {number} year - Året
 * @returns {Date} Påskedag
 */
const beregnPaaskedag = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
};

/**
 * Find alle helligdage i de angivne perioder
 *
 * @param {Array} perioder - Array af {start: Date, end: Date}
 * @returns {Array} Array af helligdags-objekter
 */
const findSHDageIPerioder = (perioder) => {
  const helligdageIPeriode: any[] = [];

  // Saml alle datoer fra alle perioder
  const alleDatoer = new Set<string>();
  perioder.forEach(({ start, end }) => {
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const isoStr = formatToISO(currentDate);
      if (isoStr) alleDatoer.add(isoStr);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  // Find alle år i perioderne
  const aarSet = new Set<number>();
  alleDatoer.forEach(dateStr => {
    const date = parseISODate(dateStr as any); // dateStr er allerede valideret ISO string
    if (date) {
      aarSet.add(date.getFullYear());
    }
  });

  // Find helligdage for alle relevante år
  aarSet.forEach(aar => {
    const helligdage = beregnHelligdage(aar);
    const paaske = beregnPaaskedag(aar);

    helligdage.forEach(helligdag => {
      const helligdagStr = formatToISO(helligdag);

      // Tjek om helligdagen er i vores datoer
      if (helligdagStr && alleDatoer.has(helligdagStr)) {
        const ugedag = UGEDAGE[helligdag.getDay()];
        const helligdagNavn = identificerHelligdag(helligdag, paaske);
        const erHverdag = helligdag.getDay() >= 1 && helligdag.getDay() <= 5;

        if (helligdagNavn) {
          helligdageIPeriode.push({
            dato: helligdag,
            ugedag,
            helligdagNavn,
            erHverdag
          });
        }
      }
    });
  });

  // Sorter efter dato
  helligdageIPeriode.sort((a, b) => a.dato.getTime() - b.dato.getTime());

  return helligdageIPeriode;
};

/**
 * Sammenlæg overlappende eller sammenhængende perioder
 *
 * @param {Array} perioder - Array af {start: Date, end: Date}
 * @returns {Array} Sammensatte perioder
 */
const sammenlaegPerioder = (perioder) => {
  if (!perioder || perioder.length === 0) {
    return [];
  }

  // Sorter perioder
  const sorterede = [...perioder].sort((a, b) => a.start - b.start);

  const sammensatte = [sorterede[0]];

  for (let i = 1; i < sorterede.length; i++) {
    const { start: fra, end: til } = sorterede[i];
    const sidstePeriode = sammensatte[sammensatte.length - 1];

    // Tjek om perioder overlapper eller er sammenhængende (med 1 dags margin)
    const naesteDag = new Date(sidstePeriode.end);
    naesteDag.setDate(naesteDag.getDate() + 1);

    if (fra <= naesteDag) {
      // Sammensæt perioder
      sammensatte[sammensatte.length - 1].end = til > sidstePeriode.end ? til : sidstePeriode.end;
    } else {
      // Tilføj som ny periode
      sammensatte.push({ start: fra, end: til });
    }
  }

  return sammensatte;
};

/**
 * Formater periode-oversigt som tekst
 *
 * @param {Array} perioder - Array af {start: Date, end: Date}
 * @returns {string} Formateret periode-tekst
 */
const formaterPeriodeOversigt = (perioder) => {
  if (!perioder || perioder.length === 0) {
    return '';
  }

  const sammensatte = sammenlaegPerioder(perioder);

  if (sammensatte.length === 1) {
    const { start, end } = sammensatte[0];
    return `${formatDanskDato(start)} - ${formatDanskDato(end)}`;
  } else {
    const periodeTekster = sammensatte.map(({ start, end }) =>
      `${formatDanskDato(start)} - ${formatDanskDato(end)}`
    );
    return periodeTekster.join(', ');
  }
};

/**
 * Generer og download PDF for SH-dage
 *
 * @param {Array} perioder - Array af {start: Date, end: Date} periode-objekter
 * @param {SHDageStamdata | null} stamdata - Stamdata objekt med navn, skadesdato, journalnr (optional)
 * @param {SHDagePdfOptions} options - Valgfrie indstillinger
 */
export const generateSHDagePdf = (
  perioder,
  stamdata: SHDageStamdata | null = null,
  options: SHDagePdfOptions = {}
) => {
  const { visBrevhoved = false } = options;
  // Opret nyt PDF-dokument (A4, portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  doc.setDisplayMode('100%');

  // Dokumentets metadata
  doc.setProperties({
    title: 'SH-dage',
    subject: 'Erstatningsberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  let currentY = MARGINS.top;

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved && stamdata) {
    const brevhovedData: BrevhovedData = {
      skadelidte: stamdata.skadelidte,
      skadestype: stamdata.skadestype,
      skadesdato: stamdata.skadesdato,
      journalnr: stamdata.journalnr,
    };
    currentY = addBrevhoved(doc, brevhovedData);
  }

  // Tilføj titel
  currentY = addTitle(doc, 'SH-dage', currentY);

  // Tilføj periode-beskrivelse
  currentY = addDescription(doc, perioder, currentY);

  // Find alle helligdage
  const helligdage = findSHDageIPerioder(perioder);

  if (helligdage.length === 0) {
    doc.setFontSize(FONT_SIZES.normal);
    doc.setFont('helvetica', 'normal');
    doc.text('Ingen helligdage fundet i de angivne perioder.', MARGINS.left, currentY);
  } else {
    // Tilføj helligdagstabel
    currentY = addSHDageTable(doc, helligdage, currentY);

    // Tilføj forklaringstekst
    currentY = addExplanationText(doc, currentY);
  }

  // Tilføj footer med versionsnummer
  addFooter(doc);

  // Download PDF
  doc.save('SH-dage.pdf');
};


/**
 * Tilføj periode-beskrivelse
 */
const addDescription = (doc, perioder, startY) => {
  doc.setFontSize(FONT_SIZES.normal);
  doc.setFont('helvetica', 'normal');

  const periodeTekst = formaterPeriodeOversigt(perioder);
  const lines = [
    `Periode: ${periodeTekst}`,
  ];

  let y = startY;
  for (const line of lines) {
    doc.text(line, MARGINS.left, y);
    y += 6;
  }

  return y + 6; // Ekstra mellemrum før tabel
};

/**
 * Tilføj SH-dage tabel
 */
const addSHDageTable = (doc, helligdage, startY) => {
  // Beregn total antal SH-dage
  const antalSHDage = helligdage.filter(h => h.erHverdag).length;

  // Forbered tabeldata
  const tableData: any[] = [];

  // Header-række
  tableData.push([
    { content: 'Ugedag', styles: { fontStyle: 'bold', halign: 'left' } },
    { content: 'Dato', styles: { fontStyle: 'bold', halign: 'left' } },
    { content: 'Helligdag', styles: { fontStyle: 'bold', halign: 'left' } },
    { content: 'SH-dag', styles: { fontStyle: 'bold', halign: 'center' } },
  ]);

  // Data-rækker
  for (const { dato, ugedag, helligdagNavn, erHverdag } of helligdage) {
    tableData.push([
      { content: ugedag, styles: { halign: 'left' } },
      { content: formatDanskDato(dato), styles: { halign: 'left' } },
      { content: helligdagNavn, styles: { halign: 'left' } },
      { content: erHverdag ? 'x' : '', styles: { halign: 'center', valign: 'middle', fontSize: TABLE_STYLES.fontSize - 2 } },
    ]);
  }

  // Tom række
  tableData.push([
    { content: '', styles: { fillColor: COLORS.white } },
    { content: '', styles: { fillColor: COLORS.white } },
    { content: '', styles: { fillColor: COLORS.white } },
    { content: '', styles: { fillColor: COLORS.white } },
  ]);

  // Total-række
  tableData.push([
    { content: 'SH-dage i alt', styles: { fontStyle: 'bold', halign: 'left', fillColor: COLORS.white } },
    { content: '', styles: { fontStyle: 'bold', fillColor: COLORS.white } },
    { content: '', styles: { fontStyle: 'bold', fillColor: COLORS.white } },
    { content: `${antalSHDage}`, styles: { fontStyle: 'bold', halign: 'center', fillColor: COLORS.white } },
  ]);

  autoTable(doc, {
    startY: startY,
    head: [],
    body: tableData,
    margin: { left: MARGINS.left, right: MARGINS.right },
    styles: {
      font: 'helvetica',
      fontSize: TABLE_STYLES.fontSize,
      cellPadding: 1.5,
      textColor: COLORS.text,
    },
    columnStyles: {
      0: { cellWidth: 'auto', font: 'helvetica' },
      1: { cellWidth: 'auto', font: 'helvetica' },
      2: { cellWidth: 'auto', font: 'helvetica' },
      3: { cellWidth: 25, font: 'helvetica' },
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

        // Gør weekend-rækker gråe
        const helligdagIndex = data.row.index - 1; // -1 fordi header er række 0
        if (helligdagIndex >= 0 && helligdagIndex < helligdage.length) {
          const helligdag = helligdage[helligdagIndex];
          if (!helligdag.erHverdag) {
            data.cell.styles.textColor = [150, 150, 150] as [number, number, number];
          }
        }
      }
    },
  });

  const finalY = doc.lastAutoTable?.finalY || startY + 50;
  return finalY + SECTION_SPACER;
};

/**
 * Tilføj forklaringstekst
 */
const addExplanationText = (doc, startY) => {
  const pageHeight = doc.internal.pageSize.height;
  const bottomMargin = 20; // Bundmargen til footer

  // Beregn hvor meget plads forklaringstekst kræver
  const requiredSpace = 6 + (2 * 6) + 6; // Titel + 2 linjer + spacer = ca. 24mm

  // Tjek om der er nok plads på nuværende side
  let y = startY;
  if (y + requiredSpace > pageHeight - bottomMargin) {
    // Ikke nok plads - tilføj ny side
    doc.addPage();
    y = MARGINS.top;
  }

  doc.setFontSize(FONT_SIZES.normal);
  doc.setFont('helvetica', 'bold');
  doc.text('Forklaring:', MARGINS.left, y);

  y += 6;

  doc.setFont('helvetica', 'normal');

  const explanations = [
    '• Søgnehelligdage er helligdage, der falder på hverdage (mandag-fredag).',
    '• Helligdage, der falder i weekenden, fremgår af tabellen men medregnes ikke.',
  ];

  for (const explanation of explanations) {
    doc.text(explanation, MARGINS.left, y);
    y += 6;
  }

  return y + SECTION_SPACER;
};

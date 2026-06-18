/**
 * PDF Generator for Årslønsberegning
 *
 * Genererer detaljeret specifikation af årslønsberegning med satser, indtægtsoplysninger og beregning
 */

import type { CellDef, RowInput } from 'jspdf-autotable';
import { resolveDocumentSectionEndY, type BrevhovedData } from '../../layout/documentLayoutHelpers';
import { createStandardPdfWriter, type DocumentWriter } from '../../writer';
import {
  cellCenter,
  cellRight,
  createDocumentTableFormattedTotalRow,
  createDocumentDistributedColumnStyles,
  createDocumentTableHeaderCell,
  renderDocumentTable,
} from '../../layout/documentTableRenderer';
import { calculateStandardLoenRowDerived, type StandardLoenSatserInput } from '../../../domain/aarsloen/standardLoenRowCalculations';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { StandardLoenTableRow, LoenPaaHelligdage, Loenperiode } from '../../../schemas/formSchemas';
import type { PeriodeResult } from '../../../utils/periodeBeregning';
import type { AarsloenBeregningResult } from '../../../types/calculation';
import { amountValueToDisplayString, amountValueToNumber } from '../../../utils/expressionAmount';
import { parsePercentToDecimal } from '../../../utils/numberParsing';
import { TODAY } from '../../../config/dateRanges';
import { formatAsAmount, formatCountWithUnit, formatPercent } from '../../../utils/formatUtils';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import {
  STANDARD_LOEN_COL2_LABEL,
  STANDARD_LOEN_COL3_LABEL,
} from '../../../domain/aarsloen/standardLoenTableColumns';
import { resolveAarsloenIndtastetEnhedSummary } from '../../../domain/aarsloen/aarsloenPeriodDisplay';
import { STANDARD_HVERDAGE_PAA_AAR, STANDARD_SH_DAGE_PAA_AAR } from '../../../utils/periodeBeregning';

const NBSP = '\u00A0';
const AARSLOEN_PDF_ATP_HEADER = 'ATP mv.\nu. tillæg';

const writeRows = (
  writer: DocumentWriter,
  rows: ReadonlyArray<
    Readonly<{
      label: string;
      value: string;
      rightFontStyle?: 'normal' | 'bold';
    }>
  >
): void => {
  for (const row of rows) {
    writer.writeLeftRightText(row.label, row.value, {
      rightFontStyle: row.rightFontStyle ?? 'normal',
    });
  }
};

export const buildAarsloenDocumentFilename = (journalnr?: string): string => {
  return resolveDocumentArtifactFileName('Årslønsberegning', false, journalnr);
};

/**
 * Formaterer beløb til dansk format med tusindtalsseparator.
 * Kalderne sender enten en AmountValue (tabelceller) eller et beregnet tal; aldrig en rå streng.
 */
const formatDanishAmount = (amount: AmountValue | number | null | undefined): string => {
  if (amount === null || amount === undefined) return '';
  if (typeof amount === 'number') {
    return formatAsAmount(amount, 2);
  }
  return amountValueToDisplayString(amount, 2);
};

const isEmptyOrZero = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return true;

  if (typeof value === 'object' && value !== null && 'kind' in value) {
    const numericValue = amountValueToNumber(value as AmountValue);
    return numericValue === undefined || numericValue === 0;
  }

  const str = String(value).trim();
  if (str === '' || str === '0' || str === '0,00' || str === '0.00' || str === '0 %' || str === '0,0 %' || str === '0,00 %') return true;

  return false;
};

// Bruger parsePercentToDecimal (kanonisk parsing af dansk procentformat, komma som decimaltegn) × 100 → formatPercent.
// Undgår den fejlbehæftede manuelle .→, fjern-tusindtalsseparator-logik.
const formatPdfPercent = (pct: string | number | undefined): string => {
  if (pct === null || pct === undefined || pct === '') return '';
  const decimal = parsePercentToDecimal(pct);
  return formatPercent(decimal * 100);
};

/**
 * Tilføj satser-sektion som almindelige tekstlinjer
 * VIGTIGT: Filtrerer tomme/nul satser - skip hele sektionen hvis ingen satser er udfyldt
 */
const addSatserSection = (
  writer: DocumentWriter,
  satser: StandardLoenSatserInput,
): void => {
  // Definer alle mulige satser
  const satsDefinitioner: Array<{ key: keyof StandardLoenSatserInput; label: string }> = [
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

  writer.writeBoldSubheader('Satser');
  writeRows(
    writer,
    udfyldteSatser.map((sats) => ({
      label: sats.label,
      value: formatPdfPercent(satser[sats.key]),
    }))
  );
  writer.addSectionSpacer();
};

/**
 * Tilføj indtægtsoplysninger-tabel
 */
const addIndtaegtsoplysningerTable = (
  writer: DocumentWriter,
  tableData: readonly StandardLoenTableRow[],
  loenperiode: Loenperiode,
  satser: StandardLoenSatserInput,
  beregnetAarsloen: number
): number => {
  writer.writeBoldSubheader('Indtægtsoplysninger');
  const doc = writer.getDoc();
  const tableStartY = writer.getY();

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

    // Tjek beløbsfelter (Løn, Løn (2), Ikke-pensionsgivende løn, ATP og anden ikke-FB løn)
    const harLoen = !isEmptyOrZero(row.col2) || !isEmptyOrZero(row.col3) || !isEmptyOrZero(row.col4) ||
                     !isEmptyOrZero(row.col5);

    // Behold række hvis der er data i periode ELLER løn
    return harPeriode || harLoen;
  });

  // Headers afhænger af lønperiode
  const headers: CellDef[] = [];
  if (loenperiode === 'maaned') {
    headers.push(
      createDocumentTableHeaderCell('Måned', 'center'),
      createDocumentTableHeaderCell('År', 'center'),
    );
  } else if (loenperiode === 'uge') {
    headers.push(
      createDocumentTableHeaderCell('Uge fra', 'center'),
      createDocumentTableHeaderCell('Uge til', 'center'),
    );
  } else if (loenperiode === 'dag') {
    headers.push(
      createDocumentTableHeaderCell('Dato fra', 'center'),
      createDocumentTableHeaderCell('Dato til', 'center'),
    );
  }

  // Tilføj resten af headers
  headers.push(
    createDocumentTableHeaderCell(STANDARD_LOEN_COL2_LABEL, 'center'),
    createDocumentTableHeaderCell(STANDARD_LOEN_COL3_LABEL, 'center'),
    createDocumentTableHeaderCell('Ikke-pens.\ngiv. løn', 'center'),
    createDocumentTableHeaderCell(AARSLOEN_PDF_ATP_HEADER, 'center'),
    createDocumentTableHeaderCell('FP/FV/SH/\nSO/St.B.', 'center'),
    createDocumentTableHeaderCell('Arb.g.\nPension', 'center'),
    createDocumentTableHeaderCell('Samlet løn', 'center'),
  );

  const columnCount = headers.length;

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

    const derived = calculateStandardLoenRowDerived(row, {
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
      cellRight(formatDanishAmount(derived.fpFvShSo)),
      cellRight(formatDanishAmount(derived.pension)),
      cellRight(formatDanishAmount(derived.samlet)),
    ]);
  }

  const totalRow = filteredData.length > 1
    ? createDocumentTableFormattedTotalRow('I alt', `${formatDanishAmount(beregnetAarsloen)}${NBSP}kr.`, {
      columnCount,
      valueColumnIndex: 8,
      labelAlign: 'center',
      valueHasKrSuffix: false,
    })
    : null;
  if (totalRow) {
    tableRows.push(totalRow.row);
  }
  const totalRowIndex = totalRow ? tableRows.length - 1 : null;

  const finalY = renderDocumentTable({
    doc,
    startY: tableStartY,
    body: tableRows,
    columnStyles: createDocumentDistributedColumnStyles(columnCount),
    underlinedCellPositions: totalRowIndex === null || totalRow === null
      ? []
      : [{ rowIndex: totalRowIndex, columnIndex: totalRow.valueCellColumnIndex }],
    didParseCell: (data) => {
      if (totalRowIndex === null || data.row.index !== totalRowIndex) return;
      data.cell.styles.fillColor = false;
      data.cell.styles.lineWidth = 0;
    },
  });

  return resolveDocumentSectionEndY(finalY, tableStartY);
};

/**
 * Tilføj beregningsprincipper-sektion som almindelige tekstlinjer
 */
type BeregningsprincipperParams = Readonly<{
  tableData: readonly StandardLoenTableRow[];
  periodeData: PeriodeResult | null;
  beregningsData: AarsloenBeregningResult;
  loenperiode: Loenperiode;
  fuldLoenUnderFerie: boolean;
  retTilSjetteFerieuge: boolean;
  antalFeriedage: number | undefined;
  loenPaaHelligdage: LoenPaaHelligdage;
  shDageAntal: number | null;
}>;

const addBeregningsprinciperSection = (
  writer: DocumentWriter,
  params: BeregningsprincipperParams,
): void => {
  const {
    tableData,
    periodeData,
    beregningsData,
    loenperiode,
    fuldLoenUnderFerie,
    retTilSjetteFerieuge,
    antalFeriedage,
    loenPaaHelligdage,
    shDageAntal,
  } = params;

  const rows: Array<{
    label: string;
    value: string;
  }> = [];

  const indtastetEnhedSummary = resolveAarsloenIndtastetEnhedSummary({
    tableData,
    periodeData,
    beregningsData,
    loenperiode,
  });

  rows.push({
    label: indtastetEnhedSummary.label,
    value: indtastetEnhedSummary.value,
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
    const feriedageVal = String(antalFeriedage ?? 0);
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
      value: String(shDageAntal ?? 0),
    });
  }

  writer.writeBoldSubheader('Beregningsprincipper');
  writeRows(writer, rows);
  writer.addSectionSpacer();
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
  writer: DocumentWriter,
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
    if (!fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0) {
      linje1Label += ` - ${beregningsData.feriedageFraInput} feriedage`;
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
      ? `Arbejdsdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${STANDARD_SH_DAGE_PAA_AAR} SH-dage)`
      : `Arbejdsdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'} - ${STANDARD_SH_DAGE_PAA_AAR} SH-dage)`;

    rows.push({
      label: linje2Label,
      value: `${beregningsData.arbejdsdagePaaAar} arbejdsdage`,
    });

    rows.push({
      label: `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.arbejdsdagePaaAar})`,
      value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
      rightFontStyle: 'bold',
    });

  } else if (beregningsData.metode === 'B') {
    // METODE B: Hverdage
    let linje1Label = `Hverdage i beregningsperioden (${beregningsData.hverdageIPeriode} hverdage`;
    if (!fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0) {
      linje1Label += ` - ${beregningsData.feriedageFraInput} feriedage`;
    }
    linje1Label += `)`;

    rows.push({
      label: linje1Label,
      value: `${beregningsData.arbejdsdageIPeriode} hverdage`,
    });

    rows.push({
      label: fuldLoenUnderFerie
        ? `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage)`
        : `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'})`,
      value: `${beregningsData.hverdagePaaAar} hverdage`,
    });

    rows.push({
      label: `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar})`,
      value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
      rightFontStyle: 'bold',
    });

  } else if (beregningsData.metode === 'C') {
    // METODE C: Måneder/Uger/Dage
    if (loenperiode === 'maaned') {
      rows.push({
        label: 'Antal måneder i indtastede perioder',
        value: formatCountWithUnit(beregningsData.antalEnheder, 'måned', 'måneder'),
      });

      const linje2Label = beregningsData.antalEnheder === 1
        ? `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} × 12)`
        : `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.antalEnheder} × 12)`;

      rows.push({
        label: linje2Label,
        value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
        rightFontStyle: 'bold',
      });

    } else if (loenperiode === 'uge') {
      rows.push({
        label: 'Antal uger i indtastede perioder',
        value: formatCountWithUnit(beregningsData.antalEnheder, 'uge', 'uger'),
      });

      rows.push({
        label: `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.antalEnheder} × 52,14)`,
        value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
        rightFontStyle: 'bold',
      });

    } else if (loenperiode === 'dag') {
      if (beregningsData.antalHeleKalendermaaneder !== null) {
        // Hele kalendermåneder — vis måneds-omregning som ved månedsløn
        const n = beregningsData.antalHeleKalendermaaneder;
        rows.push({
          label: 'Antal måneder i indtastede perioder',
          value: formatCountWithUnit(n, 'måned', 'måneder'),
        });
        rows.push({
          label: `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${n} × 12)`,
          value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
          rightFontStyle: 'bold',
        });
      } else {
        // Dag-fallback: hverdagsomregning identisk med metode B (bevidst domænevalg)
        let linje1Label = `Hverdage i beregningsperioden (${beregningsData.hverdageIPeriode} hverdage`;
        if (!fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0) {
          linje1Label += ` - ${beregningsData.feriedageFraInput} feriedage`;
        }
        linje1Label += `)`;

        rows.push({
          label: linje1Label,
          value: `${beregningsData.arbejdsdageIPeriode} hverdage`,
        });

        rows.push({
          label: fuldLoenUnderFerie
            ? `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage)`
            : `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'})`,
          value: `${beregningsData.hverdagePaaAar} hverdage`,
        });

        rows.push({
          label: `Beregnet årsløn (${formatDanishAmount(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar})`,
          value: `${formatDanishAmount(beregningsData.omregnetAarsloen)} kr.`,
          rightFontStyle: 'bold',
        });
      }
    }
  }

  writer.writeBoldSubheader('Beregning');
  writeRows(writer, rows);
};


/**
 * Generer og download PDF for årslønsberegning
 *
 * @param {object} params - Parameter-objekt med alle nødvendige data
 */
type GenerateAarsloenDocumentParams = DocumentCommonOptions & Readonly<{
  satser: StandardLoenSatserInput;
  loenperiode: Loenperiode;
  tableData: readonly StandardLoenTableRow[];
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

export const generateAarsloenDocument = (params: GenerateAarsloenDocumentParams): void => {
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
    writer,
    tableData,
    loenperiode,
    satser,
    beregnetAarsloen
  ));

  // Betinget: Beregningsprincipper og beregning (kun hvis omregning er aktiveret)
  if (omregningTilFuldtAar && periodeData) {
    // Tilføj beregningsprincipper-sektion
    addBeregningsprinciperSection(writer, {
      tableData,
      periodeData,
      beregningsData,
      loenperiode,
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
  const filename = buildAarsloenDocumentFilename(stamdata?.journalnr);

  // Download PDF
  writer.save(filename);
};

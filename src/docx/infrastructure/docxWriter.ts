import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  FrameAnchorType,
  FrameWrap,
  Header,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LineRuleType,
  Packer,
  PageOrientation,
  PageBreak,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalAlignTable,
  VerticalPositionRelativeFrom,
  WidthType,
  type FileChild,
  type IFrameOptions,
  type IPropertiesOptions,
  type ParagraphChild,
} from 'docx';
import type { DocumentWriter } from '../../document/writer/documentWriter';
import type { BrevhovedData } from '../../document/layout/documentLayoutHelpers';
import { formatIsoDateLong } from '../../utils/dateFormatting';
import { guardDocumentDateText } from '../../document/layout/documentDateGuard';
import { roundByMethod } from '../../utils/rounding';
import {
  buildDocumentFooterText,
  getDocumentFooterImage,
} from '../../document/layout/documentFooterImage';
import {
  PDF_CONTENT_WIDTH_MM,
  PDF_BASE_LINE_HEIGHT_MM,
  PDF_FOOTER_MARGIN_MM,
  PDF_FOOTER_RIGHT_MARGIN_MM,
  PDF_MUTED_TEXT_COLOR,
  PDF_TABLE_TOTAL_VALUE_LINE_WIDTH_MM,
  TABLE_STYLES,
} from '../../document/layout/pdfConfig';
import type {
  CellSpec,
  DocumentCellAlign,
  RowSpec,
  TableSpec,
} from '../../document/layout/tableSpec';
import { assertValidTableSpec, resolveColumnRightInsetMm } from '../../document/layout/tableSpec';
import { createUdkastWatermarkParagraph } from './docxWatermark';
import { DOCX_STYLE, buildDocxStyles, type DocxStyleId } from './docxStyles';

// Aktiverer Words "anden første side" (titlePage), så første side har sit eget
// header-/topområde. Sættes når dokumentet faktisk har et brevhoved.

const PAGE_WIDTH_DXA = 11906;
const PAGE_HEIGHT_DXA = 16838;
const PAGE_HORIZONTAL_MARGIN_DXA = 1134; // 2 cm
const PAGE_VERTICAL_MARGIN_DXA = 1440; // tidligere top-/bundmargin
const CONTENT_WIDTH_DXA = PAGE_WIDTH_DXA - PAGE_HORIZONTAL_MARGIN_DXA * 2;
const LANDSCAPE_CONTENT_WIDTH_DXA = PAGE_HEIGHT_DXA - PAGE_HORIZONTAL_MARGIN_DXA * 2;
const TABLE_CELL_MARGIN_DXA = 90;
const dxaFromCentimeters = (centimeters: number): number =>
  roundByMethod((centimeters / 2.54) * 1440, 0, 'halfAwayFromZero');
const dxaFromMillimeters = (millimeters: number): number =>
  roundByMethod((millimeters / 25.4) * 1440, 0, 'halfAwayFromZero');

type TextStyle = 'normal' | 'bold';

type CoreProperties = Readonly<{
  title?: string;
  subject?: string;
  author?: string;
  creator?: string;
}>;

// Maksimal venstre-kolonnebredde for venstre/højre-oplysningslinjer. Venstre kolonne får
// aldrig mere end dette, men kan reservere mindre når teksten er kort (se createLeftRightTable).
const LEFT_RIGHT_TABLE_LEFT_WIDTH_DXA = dxaFromCentimeters(12.5);
// Konservativ gennemsnits-glyfbredde i DXA ved brødtekststørrelsen (BODY_SIZE = 22 halv-point
// = 11 pt; 1 pt = 20 DXA). ~120 DXA/tegn ≈ 6 pt/tegn er bevidst lidt rundhåndet, så et kort
// venstrelabel ikke ved et uheld underestimeres og ombrydes. Bruges KUN til kolonnefordeling.
const LEFT_RIGHT_AVG_GLYPH_DXA = 120;

const emptyBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
// Summeringsstreg over højre kolonne (I alt-/sum-linjer). Matcher PDF'ens tynde,
// sorte streg (doc.setLineWidth(0.2)) så tæt docx-modellen tillader: en enkelt
// sort topkant på højre celle. `size` er i ottendedele af et point (4 ≈ 0,5 pt).
const sumLineTopBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' } as const;
const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
} as const;

// Dato-værn + NBSP→mellemrum: alt Word-tekstindhold (afsnit, tabelceller,
// blandede linjer) går gennem denne normalisering, så en rå ISO-dato aldrig
// kan nå .docx'en. Se documentDateGuard.ts.
const normalizeText = (text: string): string => guardDocumentDateText(text).replace(/\u00A0/g, ' ');

const splitLines = (text: string): string[] => {
  const lines = normalizeText(text).split(/\r?\n/);
  return lines.length > 0 ? lines : [''];
};

// Bygger et afsnit, der ENTYDIGT styres af en navngiven typografi (jf. docxStyles).
// Font, størrelse og spacing kommer FRA typografien — aldrig inline her. De eneste
// per-instans-egenskaber er strukturelle eller konkrete tekstfremhævninger:
//   - `alignment`: kun nødvendigt for kolonne-/celle-justering i tabeller, hvor den
//     samme typografi bruges på celler med forskellig justering.
//   - `frame`:     fikseret tekstrude (brevhovedet).
//   - `pageBreakBefore`: sideskift.
//   - `bold`:      indholdsbestemt fremhævning.
//   - `color`/`size`: semantisk tabeltone/-størrelse fra den fælles TableSpec.
const paragraph = (
  text: string,
  options?: Readonly<{
    style?: DocxStyleId;
    bold?: boolean;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    frame?: IFrameOptions;
    color?: string;
    size?: number;
    keepNext?: boolean;
    spacingBefore?: number;
    spacingAfter?: number;
  }>
): Paragraph => {
  const children: ParagraphChild[] = splitLines(text).flatMap((line, index) => {
    const runs: ParagraphChild[] = [];
    if (index > 0) {
      runs.push(new TextRun({ break: 1 }));
    }
    runs.push(new TextRun({
      text: line,
      bold: options?.bold,
      color: options?.color,
      size: options?.size,
    }));
    return runs;
  });

  return new Paragraph({
    children,
    style: options?.style ?? DOCX_STYLE.normal,
    alignment: options?.alignment,
    frame: options?.frame,
    keepNext: options?.keepNext,
    spacing: options?.spacingBefore === undefined && options?.spacingAfter === undefined
      ? undefined
      : {
          before: options.spacingBefore,
          after: options.spacingAfter,
        },
  });
};

// Én linje: normal tekst efterfulgt af fremhævet (fed) tekst. Afsnittet bruger
// Normal-typografien; `bold` her er indholds-bestemt karakter-fremhævning af
// anden del (ikke vilkårlig formatering), så font/størrelse arves fra typografien.
const mixedParagraph = (
  normalPart: string,
  boldPart: string,
): Paragraph => new Paragraph({
  style: DOCX_STYLE.normal,
  children: [
    new TextRun({ text: normalizeText(normalPart) }),
    new TextRun({ text: normalizeText(boldPart), bold: true }),
  ],
});

const halignToAlignment = (
  halign: DocumentCellAlign | undefined
): (typeof AlignmentType)[keyof typeof AlignmentType] => {
  if (halign === 'right') return AlignmentType.RIGHT;
  if (halign === 'center') return AlignmentType.CENTER;
  return AlignmentType.LEFT;
};

const pdfColorToHex = (color: readonly number[] | string): string => {
  if (typeof color === 'string') return color.replace(/^#/, '').toUpperCase();
  return color
    .slice(0, 3)
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
};

const resolveTableWidthDxa = (
  spec: TableSpec,
  contentWidthDxa: number,
): number => {
  const requestedWidthMm = spec.tableWidth ?? PDF_CONTENT_WIDTH_MM;
  const fraction = Math.min(1, requestedWidthMm / PDF_CONTENT_WIDTH_MM);
  return Math.max(1, roundByMethod(contentWidthDxa * fraction, 0, 'halfAwayFromZero'));
};

const resolveDocxColumnWidths = (
  spec: TableSpec,
  tableWidthDxa: number,
): readonly number[] | null => {
  if (spec.columns.every((column) => column.width.kind === 'auto')) return null;

  const tableWidthMm = spec.tableWidth ?? PDF_CONTENT_WIDTH_MM;
  const widthsMm = spec.columns.map((column) => {
    if (column.width.kind === 'fixed' || column.width.kind === 'min') {
      return column.width.mm;
    }
    return 0;
  });
  const allocated = widthsMm.reduce((sum, width) => sum + width, 0);
  const remaining = Math.max(0, tableWidthMm - allocated);
  const growIndex = spec.columns.findIndex((column) => column.width.kind === 'grow');
  const flexibleIndices = spec.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => column.width.kind === 'flex'
      || column.width.kind === 'grow'
      || column.width.kind === 'auto')
    .map(({ index }) => index);

  if (growIndex >= 0 && flexibleIndices.length > 1) {
    const growWidth = Math.min(remaining, tableWidthMm * 0.4);
    widthsMm[growIndex] = growWidth;
    const otherWidth = (remaining - growWidth) / (flexibleIndices.length - 1);
    flexibleIndices.forEach((index) => {
      if (index !== growIndex) widthsMm[index] = otherWidth;
    });
  } else if (flexibleIndices.length > 0) {
    const width = remaining / flexibleIndices.length;
    flexibleIndices.forEach((index) => {
      widthsMm[index] = width;
    });
  } else if (remaining > 0) {
    const extra = remaining / widthsMm.length;
    widthsMm.forEach((width, index) => {
      widthsMm[index] = width + extra;
    });
  }

  const resolvedTotal = widthsMm.reduce((sum, width) => sum + width, 0);
  if (resolvedTotal <= 0) {
    return spec.columns.map(() => Math.floor(tableWidthDxa / spec.columns.length));
  }
  return widthsMm.map((width) =>
    Math.max(1, roundByMethod((width / resolvedTotal) * tableWidthDxa, 0, 'halfAwayFromZero'))
  );
};

const verticalAlignToDocx = (
  valign: CellSpec['valign'] | undefined,
): (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable] => {
  if (valign === 'bottom') return VerticalAlignTable.BOTTOM;
  if (valign === 'middle') return VerticalAlignTable.CENTER;
  return VerticalAlignTable.TOP;
};

const createSeparatedValueTable = (
  valueParagraph: Paragraph,
  availableWidthDxa: number,
  widthMm = PDF_TABLE_TOTAL_VALUE_LINE_WIDTH_MM,
  gapMm = 0,
): Table => {
  const widthDxa = Math.max(1, Math.min(availableWidthDxa, dxaFromMillimeters(widthMm)));
  return new Table({
    alignment: AlignmentType.RIGHT,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: widthDxa, type: WidthType.DXA },
            borders: {
              top: sumLineTopBorder,
              bottom: emptyBorder,
              left: emptyBorder,
              right: emptyBorder,
            },
            margins: {
              top: dxaFromMillimeters(gapMm),
              bottom: 0,
              left: 0,
              right: 0,
            },
            children: [valueParagraph],
          }),
        ],
      }),
    ],
    width: { size: widthDxa, type: WidthType.DXA },
    columnWidths: [widthDxa],
    layout: TableLayoutType.FIXED,
    borders: TableBorders.NONE,
  });
};

const resolveRowShading = (
  row: RowSpec,
  rowIndex: number,
  hasHeaderRow: boolean,
): string | undefined => {
  if (row.kind === 'header' || (hasHeaderRow && rowIndex === 0)) {
    return pdfColorToHex(TABLE_STYLES.headerBackgroundColor);
  }
  if (row.kind === 'total' || row.transparent) return undefined;
  const stripingIndex = hasHeaderRow ? rowIndex : rowIndex + 1;
  return stripingIndex % 2 === 0
    ? pdfColorToHex(TABLE_STYLES.alternateRowBackgroundColor)
    : undefined;
};

const createDocxTable = (
  spec: TableSpec,
  contentWidthDxa: number,
): Table => {
  assertValidTableSpec(spec);
  const tableWidthDxa = resolveTableWidthDxa(spec, contentWidthDxa);
  const columnWidths = resolveDocxColumnWidths(spec, tableWidthDxa);
  const rows = spec.rows.map((row, rowIndex) => {
    const isHeaderRow = row.kind === 'header' || (spec.hasHeaderRow && rowIndex === 0);
    const isTotalRow = row.kind === 'total';
    const shading = resolveRowShading(row, rowIndex, spec.hasHeaderRow);
    let logicalColumnIndex = 0;

    return new TableRow({
      tableHeader: isHeaderRow ? true : undefined,
      cantSplit: true,
      children: row.cells.map((cell) => {
        const colSpan = cell.colSpan ?? 1;
        const column = spec.columns[logicalColumnIndex];
        const cellWidthDxa = columnWidths
          ? columnWidths
              .slice(logicalColumnIndex, logicalColumnIndex + colSpan)
              .reduce((sum, width) => sum + width, 0)
          : undefined;
        const columnWidthMm = cellWidthDxa
          ? (cellWidthDxa / tableWidthDxa) * (spec.tableWidth ?? PDF_CONTENT_WIDTH_MM)
          : undefined;
        const rightInsetMm = isHeaderRow || isTotalRow || column?.rightInset === undefined
          ? undefined
          : resolveColumnRightInsetMm(columnWidthMm, column.rightInset);
        const valueParagraph = paragraph(cell.text, {
          style: DOCX_STYLE.tableCell,
          bold: cell.bold || isHeaderRow,
          alignment: halignToAlignment(cell.align ?? column?.align),
          color: row.tone === 'muted' ? pdfColorToHex(PDF_MUTED_TEXT_COLOR) : undefined,
          size: cell.fontSize === undefined ? undefined : cell.fontSize * 2,
        });
        const children = cell.separatorAbove
          ? [createSeparatedValueTable(
              valueParagraph,
              Math.max(1, (cellWidthDxa ?? tableWidthDxa) - TABLE_CELL_MARGIN_DXA * 2),
            )]
          : [valueParagraph];
        logicalColumnIndex += colSpan;

        return new TableCell({
          columnSpan: colSpan,
          ...(cellWidthDxa ? { width: { size: cellWidthDxa, type: WidthType.DXA } } : {}),
          verticalAlign: verticalAlignToDocx(cell.valign ?? (isHeaderRow ? 'bottom' : 'top')),
          ...(shading ? { shading: { fill: shading } } : {}),
          margins: {
            top: TABLE_CELL_MARGIN_DXA,
            bottom: TABLE_CELL_MARGIN_DXA,
            left: TABLE_CELL_MARGIN_DXA,
            right: rightInsetMm === undefined
              ? TABLE_CELL_MARGIN_DXA
              : dxaFromMillimeters(rightInsetMm),
          },
          ...(isTotalRow
            ? { borders: { top: emptyBorder, bottom: emptyBorder, left: emptyBorder, right: emptyBorder } }
            : {}),
          children,
        });
      }),
    });
  });

  return new Table({
    rows,
    width: { size: tableWidthDxa, type: WidthType.DXA },
    ...(columnWidths ? { columnWidths: [...columnWidths] } : {}),
    layout: columnWidths ? TableLayoutType.FIXED : TableLayoutType.AUTOFIT,
    borders: tableBorders,
  });
};

const createLeftRightTable = (
  leftText: string,
  rightText: string,
  options?: Readonly<{
    leftFontStyle?: TextStyle;
    rightFontStyle?: TextStyle;
    separatorAboveValue?: Readonly<{ widthMm: number; gapMm?: number }>;
    minRightColumnWidth?: number;
    minRightColumnWidthText?: string;
  }>
): Table => {
  const showSumLine = options?.separatorAboveValue !== undefined;
  // Venstre kolonne reserverer kun den plads, dens tekst faktisk har brug for — op til det
  // hidtidige maksimum (12,5 cm). Korte venstrelabels (fx "Overenskomst") frigiver dermed
  // resten til højre kolonne, så lang højretekst (fx "Bygge-/anlægsoverenskomsten") ikke
  // ombrydes unødigt. Lange venstrelabels får stadig fuld bredde. Det spejler PDF-kanalen,
  // hvor venstrebredden = sidebredde − målt højrebredde.
  //
  // Word kan ikke måle tekst præcist (jf. getTextWidth-heuristikken), så bredden estimeres
  // ud fra tegnantal × en konservativ gennemsnits-glyfbredde i DXA ved brødtekststørrelsen.
  // Estimatet bruges KUN til at vælge kolonnefordeling (layout), aldrig til indhold/tal; et
  // for lavt estimat lader blot Word ombryde venstreteksten, et for højt giver blot lidt
  // ekstra venstreplads — begge er visuelt acceptable og kan ikke tabe data.
  // På sum-/I alt-linjer bevares den faste venstrebredde, mens selve separatoren
  // får sin eksplicitte semantiske bredde inde i højrecellen.
  const estimatedLeftWidthDxa = Math.ceil(leftText.length * LEFT_RIGHT_AVG_GLYPH_DXA);
  // Højre kolonne skal mindst kunne rumme sin egen tekst på én linje. Når venstrelabelen
  // er lang (fx "Skadelidte var faglært og ansat i København, og satsen udgør") og højre-
  // teksten ikke-triviel (fx "217,20 kr./arbejdsdag"), ville en ren venstre-prioritering
  // klemme højre kolonne så smal, at beløbsteksten ombrydes. Vi reserverer derfor højre
  // kolonne mindst dens estimerede tekstbredde (samme konservative glyf-heuristik som
  // venstre) og giver venstre resten — dog aldrig under halvdelen af det hidtidige
  // venstre-maksimum, så et ekstremt langt højrefelt ikke omvendt udsulter venstre.
  // Estimatet bruges KUN til layout (kolonnefordeling), aldrig til indhold/tal.
  const estimatedRightWidthDxa = Math.max(
    Math.ceil(rightText.length * LEFT_RIGHT_AVG_GLYPH_DXA),
    Math.ceil((options?.minRightColumnWidthText?.length ?? 0) * LEFT_RIGHT_AVG_GLYPH_DXA),
    dxaFromMillimeters(options?.minRightColumnWidth ?? 0),
  );
  const minLeftWidthDxa = Math.floor(LEFT_RIGHT_TABLE_LEFT_WIDTH_DXA / 2);
  const leftWidthDxa = showSumLine
    ? LEFT_RIGHT_TABLE_LEFT_WIDTH_DXA
    : Math.max(
        minLeftWidthDxa,
        Math.min(
          LEFT_RIGHT_TABLE_LEFT_WIDTH_DXA,
          estimatedLeftWidthDxa,
          CONTENT_WIDTH_DXA - estimatedRightWidthDxa
        )
      );
  const rightWidthDxa = CONTENT_WIDTH_DXA - leftWidthDxa;
  return new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftWidthDxa, type: WidthType.DXA },
            // Top-stillet: når højreteksten ombrydes til flere linjer, står venstrelabelen
            // på niveau med den ØVERSTE højre-linje (ikke den nederste). Højre celle er også
            // top-stillet, så begge kolonners første linje flugter.
            verticalAlign: VerticalAlignTable.TOP,
            borders: { top: emptyBorder, bottom: emptyBorder, left: emptyBorder, right: emptyBorder },
            // Normal-typografi (ikke noSpacing): venstre/højre-oplysningslinjer skal arve
            // Normals afsnits- og linjeafstand, så de står med samme luft som brødtekst.
            // Kun de bevidste afvigelser (fed / højrejustering) sættes per instans.
            children: [paragraph(leftText, {
              style: DOCX_STYLE.normal,
              bold: options?.leftFontStyle === 'bold',
            })],
          }),
          new TableCell({
            width: { size: rightWidthDxa, type: WidthType.DXA },
            verticalAlign: VerticalAlignTable.TOP,
            borders: {
              top: emptyBorder,
              bottom: emptyBorder,
              left: emptyBorder,
              right: emptyBorder,
            },
            children: showSumLine && options?.separatorAboveValue
              ? [createSeparatedValueTable(
                  paragraph(rightText, {
                    style: DOCX_STYLE.normal,
                    bold: options.rightFontStyle !== 'normal',
                    alignment: AlignmentType.RIGHT,
                  }),
                  rightWidthDxa,
                  options.separatorAboveValue.widthMm,
                  options.separatorAboveValue.gapMm,
                )]
              : [paragraph(rightText, {
              style: DOCX_STYLE.normal,
              bold: options?.rightFontStyle !== 'normal',
              alignment: AlignmentType.RIGHT,
                })],
          }),
        ],
      }),
    ],
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    // Eksplicit grid, så Word's faste layout bruger præcis den beregnede venstre/højre-fordeling
    // (ellers udfylder docx tblGrid med placeholder-bredder).
    columnWidths: [leftWidthDxa, rightWidthDxa],
    layout: TableLayoutType.FIXED,
    borders: TableBorders.NONE,
  });
};

const createSignatureTable = (
  dateLine: string,
  sigLine: string,
  skadelidteNavn: string,
  contentWidthDxa: number,
): Table => {
  const cell = (line: string, label: string): TableCell => new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: { top: emptyBorder, bottom: emptyBorder, left: emptyBorder, right: emptyBorder },
    children: [
      paragraph(line, { style: DOCX_STYLE.noSpacing, alignment: AlignmentType.CENTER }),
      paragraph(label, { style: DOCX_STYLE.noSpacing, alignment: AlignmentType.CENTER }),
    ],
  });

  return new Table({
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          cell(dateLine, 'Dato'),
          cell(sigLine, skadelidteNavn),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [contentWidthDxa / 2, contentWidthDxa / 2],
    layout: TableLayoutType.FIXED,
    borders: TableBorders.NONE,
  });
};

// Bredde og placering af den fikserede brevhoved-tekstrude. Ruden er forankret
// til SIDEN (FrameAnchorType.PAGE), så den bliver liggende øverst til højre uanset
// hvad der sker med den øvrige tekst i dokumentet. X-positionen beregnes ud fra
// den aktuelle sidebredde, så ruden også ligger korrekt på landscape-sider.
const BREVHOVED_FRAME_WIDTH_DXA = dxaFromCentimeters(7);
const BREVHOVED_FRAME_HEIGHT_DXA = dxaFromCentimeters(1);
const BREVHOVED_FRAME_Y_DXA = dxaFromCentimeters(1);

// Indhold matcher PDF-brevhovedet (renderBrevhoved): "J.nr. <nr> <advokat>/<sagsbehandler>"
// på linje 1 og den lange danske dato på linje 2.
const buildBrevhovedLines = (data: BrevhovedData): string[] => {
  const journalnr = typeof data.journalnr === 'string' ? data.journalnr.trim() : '';
  const advokat = typeof data.advokat === 'string' ? data.advokat.trim() : '';
  const sagsbehandler = typeof data.sagsbehandler === 'string' ? data.sagsbehandler.trim() : '';
  const datoText = formatIsoDateLong(data.dagsDatoISO);

  const lines: string[] = [];
  if (journalnr !== '') {
    const roleSuffix = advokat && sagsbehandler
      ? ` ${advokat}/${sagsbehandler}`
      : advokat
        ? ` ${advokat}`
        : sagsbehandler
          ? ` ${sagsbehandler}`
          : '';
    lines.push(`J.nr. ${journalnr}${roleSuffix}`);
  }
  if (datoText !== '') {
    lines.push(datoText);
  }
  return lines;
};

const buildBrevhovedParagraphs = (data: BrevhovedData, pageWidthDxa: number): Paragraph[] => {
  const lines = buildBrevhovedLines(data);
  if (lines.length === 0) return [];
  const frameX = pageWidthDxa - PAGE_HORIZONTAL_MARGIN_DXA - BREVHOVED_FRAME_WIDTH_DXA;

  // Hele brevhovedet samles i ÉT afsnit med eksplicitte linjeskift, så det udgør
  // én sammenhængende tekstrude. Kun det afsnit, der bærer frame-egenskaben,
  // forankres; derfor må linjerne ikke splittes ud i flere afsnit.
  const frame: IFrameOptions = {
    type: 'absolute',
    position: { x: frameX, y: BREVHOVED_FRAME_Y_DXA },
    width: BREVHOVED_FRAME_WIDTH_DXA,
    height: BREVHOVED_FRAME_HEIGHT_DXA,
    anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
    wrap: FrameWrap.NONE,
    anchorLock: true,
  };

  return [
    paragraph(lines.join('\n'), {
      style: DOCX_STYLE.header,
      alignment: AlignmentType.RIGHT,
      frame,
    }),
  ];
};

// Tomt afstands-afsnit mellem blokke (sektion/tabel).
const spacerParagraph = (heightMm: number): Paragraph => new Paragraph({
  style: DOCX_STYLE.noSpacing,
  spacing: {
    before: 0,
    after: 0,
    line: dxaFromMillimeters(Math.max(0.1, heightMm)),
    lineRule: LineRuleType.EXACT,
  },
});

const uint8ArrayFromDataUrl = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// EMU er docx' enhed for flydende billed-offsets. 1 DXA (twip) = 635 EMU
// (914400 EMU/tomme ÷ 1440 twips/tomme); 1 mm = 36000 EMU.
const EMU_PER_DXA = 635;
const EMU_PER_MM = 36000;
const pxFromMm = (mm: number): number =>
  Math.max(1, roundByMethod((mm / 25.4) * 96, 0, 'halfAwayFromZero'));
const emuFromMm = (mm: number): number => roundByMethod(mm * EMU_PER_MM, 0, 'halfAwayFromZero');

// Versions-footeren genbruger NØJAGTIG samme roterede billede som PDF-kanalen
// (documentFooterImage.ts), så "<brand> // <version>" står med samme lysegrå farve,
// skrift, lodrette orientering og placering i begge kanaler. Billedet floates frit,
// forankret til SIDEN, så højre kant følger PDF_FOOTER_RIGHT_MARGIN_MM og bundkanten
// følger PDF_FOOTER_MARGIN_MM — identisk med PDF'ens addImage-placering. Footeren gentages
// automatisk på alle sider, fordi den ligger i sektionens footer-slot.
const buildVersionFooter = (pageWidthDxa: number, pageHeightDxa: number): Footer => {
  const footerText = buildDocumentFooterText();
  const image = getDocumentFooterImage(footerText);

  if (!image) {
    // Fallback uden DOM/canvas (fx test/SSR): ren tekst-footer. Aldrig brugervendt i
    // browseren, hvor billedstien altid rammes.
    return new Footer({
      children: [paragraph(footerText, { style: DOCX_STYLE.footer, alignment: AlignmentType.RIGHT })],
    });
  }

  const imageWidthEmu = emuFromMm(image.widthMm);
  const imageHeightEmu = emuFromMm(image.heightMm);
  const horizontalOffsetEmu = pageWidthDxa * EMU_PER_DXA - emuFromMm(PDF_FOOTER_RIGHT_MARGIN_MM) - imageWidthEmu;
  const verticalOffsetEmu = pageHeightDxa * EMU_PER_DXA - emuFromMm(PDF_FOOTER_MARGIN_MM) - imageHeightEmu;

  return new Footer({
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            type: 'jpg',
            data: uint8ArrayFromDataUrl(image.dataUrl),
            transformation: { width: pxFromMm(image.widthMm), height: pxFromMm(image.heightMm) },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: horizontalOffsetEmu },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: verticalOffsetEmu },
              wrap: { type: TextWrappingType.NONE },
              allowOverlap: true,
            },
          }),
        ],
      }),
    ],
  });
};

export const createDocxWriter = (params?: Readonly<{
  orientation?: 'portrait' | 'landscape';
}>): DocumentWriter => {
  const blocks: FileChild[] = [];
  // Brevhovedets afsnit holdes adskilt fra de øvrige blokke og flettes først ind
  // ved build (efter første ordinære blok), så Words åbne-caret ikke lander inde
  // i den side-forankrede tekstrude. Se composeChildren.
  let brevhovedParagraphs: Paragraph[] = [];
  let properties: CoreProperties = {};
  const orientation = params?.orientation ?? 'portrait';
  const isLandscape = orientation === 'landscape';
  const pageWidthDxa = isLandscape ? PAGE_HEIGHT_DXA : PAGE_WIDTH_DXA;
  const pageHeightDxa = isLandscape ? PAGE_WIDTH_DXA : PAGE_HEIGHT_DXA;
  const contentWidthDxa = isLandscape ? LANDSCAPE_CONTENT_WIDTH_DXA : CONTENT_WIDTH_DXA;
  // Sættes når dokumentet får et brevhoved. Aktiverer "anden første side", så
  // første side får et højere top-/headerområde end de øvrige sider.
  let hasBrevhoved = false;
  let hasUdkastWatermark = false;
  let hasFooter = false;
  // Tomme afstands-afsnit (spacers) registreres her, så `composeChildren` kan kollapse to
  // eller flere efterfølgende spacers til ÉN. I PDF afsættes tabel-slutafstanden via
  // PDF-tabellens slutlayout har sin egen afstand, så Word-rendereren lægger en trailing
  // spacer; en efterfølgende addSectionSpacer i generatoren ville derfor give to tomme linjer
  // under tabellen. Kollaps holder det på én tom linje — ren Word-side, uden PDF-effekt.
  const spacerHeights = new WeakMap<FileChild, number>();
  const pushSpacer = (heightMm = PDF_BASE_LINE_HEIGHT_MM): void => {
    const spacer = spacerParagraph(heightMm);
    spacerHeights.set(spacer, heightMm);
    blocks.push(spacer);
  };
  const addParagraph = (text: string, bold = false): void => {
    if (text.trim() === '') return;
    blocks.push(paragraph(text, { style: DOCX_STYLE.normal, bold }));
  };

  // Fletter brevhovedet ind i dokumentets blokke. Brevhovedet lægges EFTER første
  // ordinære blok, så Words åbne-caret lander i den første rigtige tekstlinje
  // (typisk titlen) frem for inde i den side-forankrede tekstrude. Brevhovedet er
  // forankret til SIDEN (FrameAnchorType.PAGE), så dets plads i tekstflowet er
  // visuelt ligegyldig — det skal blot blive liggende på side 1, hvilket det gør
  // som blok nr. 2.
  // Kollaps på hinanden følgende afstands-afsnit til ét, så fx en tabels trailing spacer plus
  // en generators efterfølgende addSectionSpacer kun giver én tom linje (jf. spacerBlocks).
  const collapseConsecutiveSpacers = (input: readonly FileChild[]): FileChild[] => {
    const out: FileChild[] = [];
    for (const block of input) {
      const height = spacerHeights.get(block);
      const previous = out[out.length - 1];
      const previousHeight = previous ? spacerHeights.get(previous) : undefined;
      if (height !== undefined && previousHeight !== undefined) {
        if (height > previousHeight) {
          out[out.length - 1] = block;
        }
        continue;
      }
      out.push(block);
    }
    return out;
  };

  const composeChildren = (): FileChild[] => {
    const collapsed = collapseConsecutiveSpacers(blocks);
    if (brevhovedParagraphs.length === 0) {
      return collapsed.length > 0 ? collapsed : [paragraph('')];
    }
    if (collapsed.length === 0) {
      return [...brevhovedParagraphs];
    }
    return [collapsed[0], ...brevhovedParagraphs, ...collapsed.slice(1)];
  };

  const build = async (): Promise<Blob> => {
    const footers = hasFooter
      ? hasBrevhoved
        ? {
            default: buildVersionFooter(pageWidthDxa, pageHeightDxa),
            first: buildVersionFooter(pageWidthDxa, pageHeightDxa),
          }
        : { default: buildVersionFooter(pageWidthDxa, pageHeightDxa) }
      : undefined;

    // Med "anden første side" (titlePage) gælder default-headeren kun side 2+.
    // Første side får kun sin egen first-header når udkast-vandmærket skal vises
    // dér; tomme header-afsnit bruges ikke, så brødteksten starter højt på side 1.
    // Samme gælder versions-footeren:
    // titlePage får Word til at bruge en særskilt first-footer på side 1.
    // Hver slot SKAL have sin egen instans (docx-komponenter må ikke deles).
    const defaultHeader = hasUdkastWatermark
      ? new Header({ children: [createUdkastWatermarkParagraph()] })
      : undefined;
    const firstHeader = hasBrevhoved && hasUdkastWatermark
      ? new Header({ children: [createUdkastWatermarkParagraph()] })
      : undefined;
    const headers = defaultHeader || firstHeader
      ? {
          ...(defaultHeader ? { default: defaultHeader } : {}),
          ...(firstHeader ? { first: firstHeader } : {}),
        }
      : undefined;

    const documentOptions: IPropertiesOptions = {
      title: properties.title,
      subject: properties.subject,
      creator: properties.creator ?? properties.author,
      description: properties.subject,
      sections: [
        {
          headers,
          footers,
          properties: {
            // "Anden første side": første side har sit eget (højere) sidehoved.
            titlePage: hasBrevhoved,
            page: {
              size: {
                // docx-biblioteket bytter selv w/h ved PageOrientation.LANDSCAPE.
                // Derfor sendes A4-basismålene ind her, mens vores egne flydende
                // elementer (brevhoved/footer) fortsat bruger de fysiske sidemål
                // fra pageWidthDxa/pageHeightDxa ovenfor.
                width: PAGE_WIDTH_DXA,
                height: PAGE_HEIGHT_DXA,
                orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
              },
              margin: {
                top: PAGE_VERTICAL_MARGIN_DXA,
                right: PAGE_HORIZONTAL_MARGIN_DXA,
                bottom: PAGE_VERTICAL_MARGIN_DXA,
                left: PAGE_HORIZONTAL_MARGIN_DXA,
              },
            },
          },
          children: composeChildren(),
        },
      ],
      // Al formatering kommer fra det centrale typografi-modul (docxStyles).
      // Generatoren sætter ikke inline font/størrelse/spacing nogen steder.
      styles: buildDocxStyles(),
    };

    return await Packer.toBlob(new Document(documentOptions));
  };

  return {
    setProperties: (props) => {
      properties = {
        title: props.title,
        subject: props.subject,
        author: props.author,
        creator: props.creator,
      };
    },
    // Word håndterer pagination; bloktypernes keepNext/cantSplit bærer intentionen.
    keepWithNext: () => {},
    addSpacer: (height) => {
      pushSpacer(height);
    },
    addSectionSpacer: () => {
      pushSpacer();
    },
    writeWrappedText: (text) => addParagraph(text),
    writeBoldWrappedText: (text) => addParagraph(text, true),
    // I PDF'en dropper writeWrappedTextContinued kun den afsluttende spacing for
    // bevidst at fortsætte samme logiske blok. I Word håndterer afsnitsmodellen selv
    // sideflow og spacing (kontrakt §5), så her er den blot et almindeligt afsnit.
    writeWrappedTextContinued: (text) => addParagraph(text),
    writeNormalThenBoldLine: (normalPart, boldPart) => {
      blocks.push(mixedParagraph(normalPart, boldPart));
    },
    writeLeftRightText: (leftText, rightText, options) => {
      blocks.push(createLeftRightTable(leftText, rightText, {
        leftFontStyle: options?.leftFontStyle,
        rightFontStyle: options?.rightFontStyle,
        separatorAboveValue: options?.separatorAboveValue,
        minRightColumnWidth: options?.minRightColumnWidth,
        minRightColumnWidthText: options?.minRightColumnWidthText,
      }));
    },
    writeSectionHeader: (text) => {
      blocks.push(paragraph(text, { style: DOCX_STYLE.sectionHeader }));
    },
    writeTitle: (text, options) => {
      blocks.push(paragraph(text, {
        style: DOCX_STYLE.title,
        spacingAfter: options?.trailingSpacing === undefined
          ? undefined
          : dxaFromMillimeters(options.trailingSpacing),
      }));
    },
    writeBoldSubheader: (text, _nextLineHeight, options) => {
      blocks.push(paragraph(text, {
        style: DOCX_STYLE.subheaderBold,
        spacingBefore: options?.addTopSpacing === false ? 0 : undefined,
      }));
    },
    writeBoldSubheaderIfContent: ({ text, hasContent, renderContent, options }) => {
      if (!hasContent) return false;
      blocks.push(paragraph(text, {
        style: DOCX_STYLE.subheaderBold,
        spacingBefore: options?.addTopSpacing === false ? 0 : undefined,
      }));
      renderContent();
      return true;
    },
    writeBoldSubheaderWithWrappedText: (subheaderText, bodyText) => {
      if (bodyText.trim() === '') return;
      blocks.push(paragraph(subheaderText, { style: DOCX_STYLE.subheaderBold }));
      addParagraph(bodyText);
    },
    writeAtomicTableChunks: ({ rows, renderHeader, renderRow }) => {
      renderHeader();
      for (const row of rows) {
        renderRow(row);
      }
    },
    writeUnderlinedSubheader: (text) => {
      blocks.push(paragraph(text, { style: DOCX_STYLE.subheaderUnderlined }));
    },
    writeSignatureBlock: (dateLine, sigLine, skadelidteNavn) => {
      // Kantfri signaturblok, så Word matcher PDF'ens linjefri opstilling
      // (createDocxTable ville ellers tegne synlige cellekanter).
      blocks.push(createSignatureTable(dateLine, sigLine, skadelidteNavn, contentWidthDxa));
    },
    writeBrevhoved: (brevhovedData) => {
      brevhovedParagraphs = buildBrevhovedParagraphs(brevhovedData, pageWidthDxa);
      if (brevhovedParagraphs.length > 0) {
        hasBrevhoved = true;
      }
    },
    addUdkastWatermark: () => {
      hasUdkastWatermark = true;
    },
    addContentWidthImage: (dataUrl, options) => {
      const width = (contentWidthDxa / 1440) * 25.4;
      const height = Math.min(options.maxHeight, width / options.aspectRatio);
      const pxWidth = Math.max(1, roundByMethod((width / 25.4) * 96, 0, 'halfAwayFromZero'));
      const pxHeight = Math.max(1, roundByMethod((height / 25.4) * 96, 0, 'halfAwayFromZero'));
      blocks.push(new Paragraph({
        spacing: {
          before: dxaFromMillimeters(options.verticalPadding),
          after: dxaFromMillimeters(options.verticalPadding),
        },
        children: [
          new ImageRun({
            data: uint8ArrayFromDataUrl(dataUrl),
            transformation: {
              width: pxWidth,
              height: pxHeight,
            },
            type: 'png',
          }),
        ],
      }));
    },
    renderTable: (spec) => {
      blocks.push(createDocxTable(spec, contentWidthDxa));
      pushSpacer();
    },
    addPage: () => {
      blocks.push(new Paragraph({ children: [new PageBreak()] }));
    },
    addFooter: () => {
      hasFooter = true;
    },
    build,
  };
};

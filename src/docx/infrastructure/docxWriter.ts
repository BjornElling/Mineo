import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  FrameAnchorType,
  FrameWrap,
  Header,
  ImageRun,
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
  VerticalAlignTable,
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
import { VERSION } from '../../config/buildInfo';
import { getDocumentFooterBrand } from '../../document/documentBrand';
import { registerPendingDocumentDownload } from '../../document/documentGenerationContext';
import { triggerDocumentDownload } from '../../document/downloadArtifact';
import {
  createDocumentTableBridgeDocument,
  type DocumentTableCellAlign,
  type DocumentTableColumnAlignments,
} from '../../document/layout/documentTableBridge';
import { createUdkastWatermarkParagraph } from './docxWatermark';
import { DOCX_STYLE, buildDocxStyles, type DocxStyleId } from './docxStyles';

// Aktiverer Words "anden første side" (titlePage), så første side har sit eget
// header-/topområde. Sættes når dokumentet faktisk har et brevhoved.

const PAGE_WIDTH_DXA = 11906;
const PAGE_HEIGHT_DXA = 16838;
const PAGE_MARGIN_DXA = 1440;
const CONTENT_WIDTH_DXA = PAGE_WIDTH_DXA - PAGE_MARGIN_DXA * 2;
const LANDSCAPE_CONTENT_WIDTH_DXA = PAGE_HEIGHT_DXA - PAGE_MARGIN_DXA * 2;
const TABLE_CELL_MARGIN_DXA = 90;
const dxaFromCentimeters = (centimeters: number): number =>
  roundByMethod((centimeters / 2.54) * 1440, 0, 'halfAwayFromZero');

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

// Dato-v\u00E6rn + NBSP\u2192mellemrum: alt Word-tekstindhold (afsnit, tabelceller,
// blandede linjer) g\u00E5r gennem denne normalisering, s\u00E5 en r\u00E5 ISO-dato aldrig
// kan n\u00E5 .docx'en. Se documentDateGuard.ts.
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
//   - `bold`:      brødtekst med Normal-typografi, men fed tekst.
// Bemærk: runs sætter IKKE font/size — de arver fra afsnittets typografi.
const paragraph = (
  text: string,
  options?: Readonly<{
    style?: DocxStyleId;
    bold?: boolean;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    frame?: IFrameOptions;
  }>
): Paragraph => {
  const children: ParagraphChild[] = splitLines(text).flatMap((line, index) => {
    const runs: ParagraphChild[] = [];
    if (index > 0) {
      runs.push(new TextRun({ break: 1 }));
    }
    runs.push(new TextRun({ text: line, bold: options?.bold }));
    return runs;
  });

  return new Paragraph({
    children,
    style: options?.style ?? DOCX_STYLE.normal,
    alignment: options?.alignment,
    frame: options?.frame,
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

const resolveCellText = (cell: unknown): string => {
  if (typeof cell === 'object' && cell !== null && 'content' in cell) {
    const content = (cell as Readonly<{ content?: unknown }>).content;
    return typeof content === 'string' ? content : String(content ?? '');
  }
  return typeof cell === 'string' ? cell : String(cell ?? '');
};

const resolveCellSpan = (cell: unknown): number => {
  if (typeof cell !== 'object' || cell === null || !('colSpan' in cell)) return 1;
  const colSpan = (cell as Readonly<{ colSpan?: unknown }>).colSpan;
  return typeof colSpan === 'number' && Number.isInteger(colSpan) && colSpan > 1 ? colSpan : 1;
};

const halignToAlignment = (
  halign: DocumentTableCellAlign | undefined
): (typeof AlignmentType)[keyof typeof AlignmentType] => {
  if (halign === 'right') return AlignmentType.RIGHT;
  if (halign === 'center') return AlignmentType.CENTER;
  return AlignmentType.LEFT;
};

// Cellens egen halign vinder; ellers falder vi tilbage til kolonnens justering.
// Returnerer `undefined` når cellen ikke selv angiver halign, så kalderen kan
// indsætte kolonne-fallback for data-rækker (jf. DocumentTableColumnAlignments).
const resolveCellHalign = (cell: unknown): DocumentTableCellAlign | undefined => {
  if (typeof cell !== 'object' || cell === null || !('styles' in cell)) return undefined;
  const styles = (cell as Readonly<{ styles?: Readonly<{ halign?: unknown }> }>).styles;
  if (styles?.halign === 'right') return 'right';
  if (styles?.halign === 'center') return 'center';
  if (styles?.halign === 'left') return 'left';
  return undefined;
};

const resolveCellBold = (cell: unknown, isHeaderRow: boolean): boolean => {
  if (isHeaderRow) return true;
  if (typeof cell !== 'object' || cell === null || !('styles' in cell)) return false;
  const styles = (cell as Readonly<{ styles?: Readonly<{ fontStyle?: unknown }> }>).styles;
  return styles?.fontStyle === 'bold';
};

const createDocxTable = (
  body: readonly unknown[],
  hasHeaderRow: boolean,
  columnAlignments?: DocumentTableColumnAlignments
): Table => {
  const rows = body.map((rawRow, rowIndex) => {
    const cells = Array.isArray(rawRow) ? rawRow : [rawRow];
    const isHeaderRow = hasHeaderRow && rowIndex === 0;
    // Kolonneindex følger med colSpan, så kolonne-justering rammer rigtigt
    // også når en celle spænder over flere kolonner.
    let columnIndex = 0;
    return new TableRow({
      tableHeader: isHeaderRow ? true : undefined,
      children: cells.map((cell) => {
        const colSpan = resolveCellSpan(cell);
        // Headerrækker bærer selv deres justering; kun data-rækker får
        // kolonne-fallback (jf. DocumentTableColumnAlignments).
        const columnFallback = isHeaderRow ? undefined : columnAlignments?.[columnIndex];
        const halign = resolveCellHalign(cell) ?? columnFallback;
        columnIndex += colSpan;
        return new TableCell({
          columnSpan: colSpan,
          shading: isHeaderRow ? { fill: 'E9EEF5' } : undefined,
          margins: {
            top: TABLE_CELL_MARGIN_DXA,
            bottom: TABLE_CELL_MARGIN_DXA,
            left: TABLE_CELL_MARGIN_DXA,
            right: TABLE_CELL_MARGIN_DXA,
          },
          children: [
            paragraph(resolveCellText(cell), {
              style: DOCX_STYLE.tableCell,
              bold: resolveCellBold(cell, isHeaderRow),
              alignment: halignToAlignment(halign),
            }),
          ],
        });
      }),
    });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    borders: tableBorders,
  });
};

const createLeftRightTable = (
  leftText: string,
  rightText: string,
  options?: Readonly<{
    leftFontStyle?: TextStyle;
    rightFontStyle?: TextStyle;
    // Når sat (truthy) tegnes en summeringsstreg over højre kolonne — paritet med
    // PDF'ens `lineAboveRightWidth` på I alt-/sum-linjer. Den konkrete bredde/offset
    // fra PDF'en er irrelevant i Word, hvor stregen er en celle-topkant; her tæller
    // kun, OM stregen skal vises.
    lineAboveRightWidth?: number;
  }>
): Table => {
  const showSumLine = Boolean(options?.lineAboveRightWidth);
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
  // På sum-/I alt-linjer (showSumLine) bevares den faste venstrebredde: så ligger
  // summeringsstregen — der tegnes som højre cellens topkant — i samme bredde og position
  // som hidtil, lige over beløbet, og ikke som en lang streg tværs over en bred højrekolonne.
  const estimatedLeftWidthDxa = Math.ceil(leftText.length * LEFT_RIGHT_AVG_GLYPH_DXA);
  // Højre kolonne skal mindst kunne rumme sin egen tekst på én linje. Når venstrelabelen
  // er lang (fx "Skadelidte var faglært og ansat i København, og satsen udgør") og højre-
  // teksten ikke-triviel (fx "217,20 kr./arbejdsdag"), ville en ren venstre-prioritering
  // klemme højre kolonne så smal, at beløbsteksten ombrydes. Vi reserverer derfor højre
  // kolonne mindst dens estimerede tekstbredde (samme konservative glyf-heuristik som
  // venstre) og giver venstre resten — dog aldrig under halvdelen af det hidtidige
  // venstre-maksimum, så et ekstremt langt højrefelt ikke omvendt udsulter venstre.
  // Estimatet bruges KUN til layout (kolonnefordeling), aldrig til indhold/tal.
  const estimatedRightWidthDxa = Math.ceil(rightText.length * LEFT_RIGHT_AVG_GLYPH_DXA);
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
              top: showSumLine ? sumLineTopBorder : emptyBorder,
              bottom: emptyBorder,
              left: emptyBorder,
              right: emptyBorder,
            },
            children: [paragraph(rightText, {
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
  skadelidteNavn: string
): Table => {
  const cell = (children: Paragraph[]): TableCell => new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: { top: emptyBorder, bottom: emptyBorder, left: emptyBorder, right: emptyBorder },
    children,
  });

  return new Table({
    rows: [
      new TableRow({
        children: [
          cell([paragraph(dateLine, { style: DOCX_STYLE.noSpacing })]),
          cell([paragraph(sigLine, { style: DOCX_STYLE.noSpacing })]),
        ],
      }),
      new TableRow({
        children: [
          cell([paragraph('Dato', { style: DOCX_STYLE.noSpacing })]),
          cell([paragraph(skadelidteNavn, { style: DOCX_STYLE.noSpacing })]),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    borders: TableBorders.NONE,
  });
};

// Bredde og placering af den fikserede brevhoved-tekstrude. Ruden er forankret
// til SIDEN (FrameAnchorType.PAGE), så den bliver liggende øverst til højre uanset
// hvad der sker med den øvrige tekst i dokumentet. Højre kant af ruden flugter med
// højre tekstmargin (PAGE_WIDTH - margin - bredde), og toppen sidder ved topmargin.
const BREVHOVED_FRAME_WIDTH_DXA = dxaFromCentimeters(7);
const BREVHOVED_FRAME_HEIGHT_DXA = dxaFromCentimeters(1);
const BREVHOVED_FRAME_X_DXA = PAGE_WIDTH_DXA - PAGE_MARGIN_DXA - BREVHOVED_FRAME_WIDTH_DXA;
const BREVHOVED_FRAME_Y_DXA = PAGE_MARGIN_DXA;

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

const buildBrevhovedParagraphs = (data: BrevhovedData): Paragraph[] => {
  const lines = buildBrevhovedLines(data);
  if (lines.length === 0) return [];

  // Hele brevhovedet samles i ÉT afsnit med eksplicitte linjeskift, så det udgør
  // én sammenhængende tekstrude. Kun det afsnit, der bærer frame-egenskaben,
  // forankres; derfor må linjerne ikke splittes ud i flere afsnit.
  const frame: IFrameOptions = {
    type: 'absolute',
    position: { x: BREVHOVED_FRAME_X_DXA, y: BREVHOVED_FRAME_Y_DXA },
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

// Førstesidens sidehoved gøres højere ved at fylde det med nogle få tomme afsnit.
// Det er bevidst en omtrentlig ekstra højde (ikke en eksakt cm-værdi). Headeren
// er kun på første side (jf. titlePage), så de øvrige sider er upåvirkede.
const FIRST_PAGE_HEADER_PADDING_PARAGRAPHS = 5;

const buildFirstPageHeaderChildren = (
  visUdkastStempel: boolean
): Paragraph[] => {
  const children: Paragraph[] = [];
  for (let i = 0; i < FIRST_PAGE_HEADER_PADDING_PARAGRAPHS; i += 1) {
    children.push(paragraph('', { style: DOCX_STYLE.normal }));
  }
  if (visUdkastStempel) {
    children.push(createUdkastWatermarkParagraph());
  }
  return children;
};

// Tomt afstands-afsnit mellem blokke (sektion/tabel).
const spacerParagraph = (): Paragraph => paragraph('', { style: DOCX_STYLE.noSpacing });

const uint8ArrayFromDataUrl = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const createDocxWriter = (params?: Readonly<{
  visUdkastStempel?: boolean;
  orientation?: 'portrait' | 'landscape';
}>): DocumentWriter => {
  const blocks: FileChild[] = [];
  // Brevhovedets afsnit holdes adskilt fra de øvrige blokke og flettes først ind
  // ved build (efter første ordinære blok), så Words åbne-caret ikke lander inde
  // i den side-forankrede tekstrude. Se composeChildren.
  let brevhovedParagraphs: Paragraph[] = [];
  let properties: CoreProperties = {};
  let filename = 'dokument.docx';
  const orientation = params?.orientation ?? 'portrait';
  const isLandscape = orientation === 'landscape';
  const pageWidthDxa = isLandscape ? PAGE_HEIGHT_DXA : PAGE_WIDTH_DXA;
  const pageHeightDxa = isLandscape ? PAGE_WIDTH_DXA : PAGE_HEIGHT_DXA;
  const contentWidthDxa = isLandscape ? LANDSCAPE_CONTENT_WIDTH_DXA : CONTENT_WIDTH_DXA;
  // Sættes når dokumentet får et brevhoved. Aktiverer "anden første side", så
  // første side får et højere top-/headerområde end de øvrige sider.
  let hasBrevhoved = false;
  // Tomme afstands-afsnit (spacers) registreres her, så `composeChildren` kan kollapse to
  // eller flere efterfølgende spacers til ÉN. I PDF afsættes tabel-slutafstanden via
  // resolveDocumentSectionEndY (no-op i Word), så Word-tabel-broen lægger sin egen trailing
  // spacer; en efterfølgende addSectionSpacer i generatoren ville derfor give to tomme linjer
  // under tabellen. Kollaps holder det på én tom linje — ren Word-side, uden PDF-effekt.
  const spacerBlocks = new WeakSet<FileChild>();
  const pushSpacer = (): void => {
    const spacer = spacerParagraph();
    spacerBlocks.add(spacer);
    blocks.push(spacer);
  };
  const bridgeDoc = createDocumentTableBridgeDocument((body, hasHeaderRow, columnAlignments) => {
    blocks.push(createDocxTable(body, hasHeaderRow, columnAlignments));
    pushSpacer();
  });

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
      if (spacerBlocks.has(block) && out.length > 0 && spacerBlocks.has(out[out.length - 1]!)) {
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
    const footer = new Footer({
      children: [
        paragraph(`${getDocumentFooterBrand()} // ${VERSION}`, {
          style: DOCX_STYLE.footer,
          alignment: AlignmentType.RIGHT,
        }),
      ],
    });

    // Med "anden første side" (titlePage) gælder default-headeren kun side 2+.
    // Første side får sin egen, HØJERE first-header: nogle få tomme afsnit fylder
    // headerområdet ud, så det bliver højere på første side. Vandmærket lægges i
    // begge headere, så det også er på side 1. Hver header-slot SKAL have sin egen
    // Header/paragraph-instans (docx-komponenter må ikke deles mellem slots).
    const visUdkastStempel = params?.visUdkastStempel ?? false;
    const defaultHeader = visUdkastStempel
      ? new Header({ children: [createUdkastWatermarkParagraph()] })
      : undefined;
    const firstHeader = hasBrevhoved
      ? new Header({ children: buildFirstPageHeaderChildren(visUdkastStempel) })
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
          footers: { default: footer },
          properties: {
            // "Anden første side": første side har sit eget (højere) sidehoved.
            titlePage: hasBrevhoved,
            page: {
              size: {
                width: pageWidthDxa,
                height: pageHeightDxa,
                orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
              },
              margin: {
                top: PAGE_MARGIN_DXA,
                right: PAGE_MARGIN_DXA,
                bottom: PAGE_MARGIN_DXA,
                left: PAGE_MARGIN_DXA,
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
    setDisplayMode: () => {},
    setProperties: (props) => {
      properties = {
        title: props.title,
        subject: props.subject,
        author: props.author,
        creator: props.creator,
      };
    },
    setNormalTextStyle: () => {},
    getDoc: () => bridgeDoc,
    ensureSpace: () => {},
    getY: () => 0,
    setY: () => {},
    addSpacer: () => {
      pushSpacer();
    },
    addSectionSpacer: () => {
      pushSpacer();
    },
    advanceY: () => {},
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
      // Paritet med PDF: når `lineAboveRightWidth` er sat (I alt-/sum-linjer),
      // tegner PDF-writeren en summeringsstreg over højrekolonnen. Vi videregiver
      // flaget, så Word viser samme streg som en topkant på højre celle.
      blocks.push(createLeftRightTable(leftText, rightText, {
        leftFontStyle: options?.leftFontStyle,
        rightFontStyle: options?.rightFontStyle,
        lineAboveRightWidth: options?.lineAboveRightWidth,
      }));
    },
    writeSectionHeader: (text) => {
      blocks.push(paragraph(text, { style: DOCX_STYLE.sectionHeader }));
    },
    writeTitle: (text) => {
      blocks.push(paragraph(text, { style: DOCX_STYLE.title }));
    },
    writeBoldSubheader: (text) => {
      blocks.push(paragraph(text, { style: DOCX_STYLE.subheaderBold }));
    },
    writeBoldSubheaderIfContent: ({ text, hasContent, renderContent }) => {
      if (!hasContent) return false;
      blocks.push(paragraph(text, { style: DOCX_STYLE.subheaderBold }));
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
    writeSignatureBlock: (dateLine, sigLine, _dateX, _sigX, skadelidteNavn) => {
      // Kantfri signaturblok, så Word matcher PDF'ens linjefri opstilling
      // (createDocxTable ville ellers tegne synlige cellekanter).
      blocks.push(createSignatureTable(dateLine, sigLine, skadelidteNavn));
    },
    writeBrevhoved: (brevhovedData) => {
      brevhovedParagraphs = buildBrevhovedParagraphs(brevhovedData);
      if (brevhovedParagraphs.length > 0) {
        hasBrevhoved = true;
      }
    },
    addUdkastWatermark: () => {},
    addImageDataUrl: (dataUrl, _x, _y, width, height) => {
      const pxWidth = Math.max(1, roundByMethod((width / 25.4) * 96, 0, 'halfAwayFromZero'));
      const pxHeight = Math.max(1, roundByMethod((height / 25.4) * 96, 0, 'halfAwayFromZero'));
      blocks.push(new Paragraph({
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
    // Bevidst IKKE-metrisk heuristik: returnerer en grov proportional værdi
    // (tegn × 2), ikke en faktisk tekstbredde. Word ombryder og justerer selv,
    // så Word-writeren har ingen brug for reelle målinger. Værdien må derfor
    // ALDRIG drive indholdsbeslutninger. Dens eneste PDF-forbruger,
    // minRightColumnWidth, ignoreres også af Word-writeren (jf. writeLeftRightText).
    getTextWidth: (text) => text.length * 2,
    fitTextToWidth: (text) => text,
    getPageWidth: () => contentWidthDxa,
    getContentWidthMm: () => (contentWidthDxa / 1440) * 25.4,
    addPage: () => {
      blocks.push(new Paragraph({ children: [new PageBreak()] }));
    },
    addFooter: () => {},
    save: (nextFilename) => {
      filename = nextFilename.endsWith('.pdf') ? `${nextFilename.slice(0, -4)}.docx` : nextFilename;
      const pendingDownload = build().then((blob) => {
        triggerDocumentDownload({ blob, filename });
      });
      registerPendingDocumentDownload(pendingDownload);
    },
  };
};

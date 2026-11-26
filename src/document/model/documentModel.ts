import type { BrevhovedData } from '../layout/documentLayoutHelpers';
import type { TableSpec } from '../layout/tableSpec';
import { PDF_BASE_LINE_HEIGHT_MM, PDF_LINE_BOTTOM_SPACING_MM } from '../layout/pdfConfig';
import type { DocumentWriter } from '../writer';
import { assertNever } from '../../utils/assertNever';

export type DocumentTextStyle = 'normal' | 'bold';

export type DocumentLabelValueOptions = Readonly<{
  leftFontStyle?: DocumentTextStyle;
  rightFontStyle?: DocumentTextStyle;
  separatorAboveValue?: Readonly<{
    widthMm: number;
    gapMm?: number;
  }>;
  minRightColumnWidth?: number;
  minRightColumnWidthText?: string;
}>;

export type DocumentBlock =
  | Readonly<{
      kind: 'wrappedText';
      text: string;
      bold?: boolean;
      continued?: boolean;
    }>
  | Readonly<{
      kind: 'normalThenBoldLine';
      normalPart: string;
      boldPart: string;
    }>
  | Readonly<{
      kind: 'labelValue';
      label: string;
      value: string;
      options?: DocumentLabelValueOptions;
    }>
  | Readonly<{ kind: 'sectionHeader'; text: string }>
  | Readonly<{ kind: 'title'; text: string; trailingSpacing?: number }>
  | Readonly<{
      kind: 'boldSubheader';
      text: string;
      addTopSpacing?: boolean;
    }>
  | Readonly<{
      kind: 'boldSubheaderWithText';
      subheaderText: string;
      bodyText: string;
    }>
  | Readonly<{ kind: 'underlinedSubheader'; text: string }>
  | Readonly<{
      kind: 'conditionalSubsection';
      text: string;
      addTopSpacing?: boolean;
      blocks: readonly DocumentBlock[];
    }>
  | Readonly<{ kind: 'sectionSpacer' }>
  | Readonly<{ kind: 'keepWithNext'; minimumHeight: number }>
  | Readonly<{ kind: 'pageBreak' }>
  | Readonly<{ kind: 'table'; spec: TableSpec }>
  | Readonly<{
      kind: 'atomicChunks';
      header: readonly DocumentBlock[];
      rows: readonly (readonly DocumentBlock[])[];
      estimateRowHeight: number;
      headerHeight: number;
    }>
  | Readonly<{
      kind: 'signature';
      dateLine: string;
      sigLine: string;
      skadelidteNavn: string;
      requiredHeight?: number;
    }>
  | Readonly<{ kind: 'brevhoved'; data: BrevhovedData }>
  | Readonly<{ kind: 'watermark' }>
  | Readonly<{
      kind: 'contentWidthImage';
      dataUrl: string;
      aspectRatio: number;
      maxHeight: number;
      verticalPadding: number;
    }>
  | Readonly<{ kind: 'footer' }>;

export type DocumentModel = Readonly<{
  blocks: readonly DocumentBlock[];
}>;

/**
 * Generatorernes eneste outputgrænse. Builderen opsamler semantiske blokke; den
 * observerer hverken kanal, sidecursor eller runtime-dokumentmål. Statiske
 * layoutintentioner i blokke og TableSpec afvikles først af modelrendereren.
 */
export type DocumentComposer = {
  writeWrappedText: (text: string) => void;
  writeBoldWrappedText: (text: string) => void;
  writeWrappedTextContinued: (text: string) => void;
  writeNormalThenBoldLine: (normalPart: string, boldPart: string) => void;
  writeLeftRightText: (
    leftText: string,
    rightText: string,
    options?: DocumentLabelValueOptions,
  ) => void;
  writeSectionHeader: (text: string) => void;
  writeTitle: (
    text: string,
    options?: Readonly<{ trailingSpacing?: number }>,
  ) => void;
  writeBoldSubheader: (
    text: string,
    options?: Readonly<{ addTopSpacing?: boolean }>,
  ) => void;
  writeBoldSubheaderIfContent: (
    params: Readonly<{
      text: string;
      hasContent: boolean;
      renderContent: () => undefined;
      options?: Readonly<{ addTopSpacing?: boolean }>;
    }>,
  ) => boolean;
  writeBoldSubheaderWithWrappedText: (
    subheaderText: string,
    bodyText: string,
  ) => void;
  writeAtomicTableChunks: <T>(
    params: Readonly<{
      rows: readonly T[];
      renderHeader: () => undefined;
      renderRow: (row: T) => undefined;
      estimateRowHeight: number;
      headerHeight: number;
    }>,
  ) => void;
  writeUnderlinedSubheader: (text: string) => void;
  writeSignatureBlock: (
    dateLine: string,
    sigLine: string,
    skadelidteNavn: string,
    requiredHeight?: number,
  ) => void;
  writeBrevhoved: (brevhovedData: BrevhovedData) => void;
  addUdkastWatermark: () => void;
  addContentWidthImage: (
    dataUrl: string,
    options: Readonly<{
      aspectRatio: number;
      maxHeight: number;
      verticalPadding?: number;
    }>,
  ) => void;
  addSectionSpacer: () => void;
  keepWithNext: (minimumHeight: number) => void;
  addPage: () => void;
  addTable: (spec: TableSpec) => void;
  addFooter: () => void;
};

const copyAndDeepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((nested) => copyAndDeepFreeze(nested))) as T;
  }

  // IR-payloads er plain dataobjekter. Kopien er vigtig: build() må ikke fryse et
  // domæne-/snapshotobjekt, som kalderen fortsat ejer uden for dokumentmodellen.
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    copy[key] = copyAndDeepFreeze(nested);
  }
  return Object.freeze(copy) as T;
};

const freezeBlocks = (blocks: DocumentBlock[]): readonly DocumentBlock[] =>
  Object.freeze(blocks.map((block) => copyAndDeepFreeze(block)));

export const createDocumentComposer = (): Readonly<{
  composer: DocumentComposer;
  build: () => DocumentModel;
}> => {
  const blocks: DocumentBlock[] = [];

  const append = (block: DocumentBlock): undefined => {
    blocks.push(block);
    return undefined;
  };

  const capture = (render: () => undefined): readonly DocumentBlock[] => {
    const start = blocks.length;
    render();
    return freezeBlocks(blocks.splice(start));
  };

  const composer: DocumentComposer = {
    writeWrappedText: (text) => append({ kind: 'wrappedText', text }),
    writeBoldWrappedText: (text) =>
      append({ kind: 'wrappedText', text, bold: true }),
    writeWrappedTextContinued: (text) =>
      append({ kind: 'wrappedText', text, continued: true }),
    writeNormalThenBoldLine: (normalPart, boldPart) =>
      append({ kind: 'normalThenBoldLine', normalPart, boldPart }),
    writeLeftRightText: (label, value, options) =>
      append({ kind: 'labelValue', label, value, options }),
    writeSectionHeader: (text) => append({ kind: 'sectionHeader', text }),
    writeTitle: (text, options) =>
      append({
        kind: 'title',
        text,
        trailingSpacing: options?.trailingSpacing,
      }),
    writeBoldSubheader: (text, options) =>
      append({
        kind: 'boldSubheader',
        text,
        addTopSpacing: options?.addTopSpacing,
      }),
    writeBoldSubheaderIfContent: ({
      text,
      hasContent,
      renderContent,
      options,
    }) => {
      if (!hasContent) return false;
      append({
        kind: 'conditionalSubsection',
        text,
        addTopSpacing: options?.addTopSpacing,
        blocks: capture(renderContent),
      });
      return true;
    },
    writeBoldSubheaderWithWrappedText: (subheaderText, bodyText) =>
      append({ kind: 'boldSubheaderWithText', subheaderText, bodyText }),
    writeAtomicTableChunks: ({
      rows,
      renderHeader,
      renderRow,
      estimateRowHeight,
      headerHeight,
    }) => {
      const header = capture(renderHeader);
      const rowBlocks = rows.map((row) => capture(() => renderRow(row)));
      return append({
        kind: 'atomicChunks',
        header,
        rows: Object.freeze(rowBlocks),
        estimateRowHeight,
        headerHeight,
      });
    },
    writeUnderlinedSubheader: (text) =>
      append({ kind: 'underlinedSubheader', text }),
    writeSignatureBlock: (
      dateLine,
      sigLine,
      skadelidteNavn,
      requiredHeight,
    ) =>
      append({
        kind: 'signature',
        dateLine,
        sigLine,
        skadelidteNavn,
        requiredHeight,
      }),
    writeBrevhoved: (data) => append({ kind: 'brevhoved', data }),
    addUdkastWatermark: () => append({ kind: 'watermark' }),
    addContentWidthImage: (dataUrl, options) =>
      append({
        kind: 'contentWidthImage',
        dataUrl,
        aspectRatio: options.aspectRatio,
        maxHeight: options.maxHeight,
        verticalPadding: options.verticalPadding ?? 4,
      }),
    addSectionSpacer: () => append({ kind: 'sectionSpacer' }),
    keepWithNext: (minimumHeight) =>
      append({ kind: 'keepWithNext', minimumHeight }),
    addPage: () => append({ kind: 'pageBreak' }),
    addTable: (spec) => append({ kind: 'table', spec }),
    addFooter: () => append({ kind: 'footer' }),
  };

  return {
    composer,
    build: () => Object.freeze({ blocks: freezeBlocks(blocks) }),
  };
};

/**
 * Keep-with-previous for sumlinjer: en sumlinje er en label/værdi-linje med
 * summeringsstreg over værdien («I alt», «Samlet …»). Den må aldrig stå alene øverst på en
 * side, adskilt fra de poster, den summerer. Modelrendereren ser hele blokfølgen og beder
 * writeren holde den forudgående posts SIDSTE linje sammen med de mellemliggende
 * sektionsafstande og hele kæden af sumlinjer (fx subtotal + «I alt») – også når posten er
 * ombrudt over flere linjer. Word-kanalen styrer selv sideflowet.
 */
const LABEL_VALUE_LINE_HEIGHT_MM = PDF_BASE_LINE_HEIGHT_MM + PDF_LINE_BOTTOM_SPACING_MM;
const SECTION_SPACER_HEIGHT_MM = PDF_BASE_LINE_HEIGHT_MM;

const isSumLine = (block: DocumentBlock | undefined): boolean =>
  block?.kind === 'labelValue' && block.options?.separatorAboveValue !== undefined;

/** Højden af de sektionsafstande og sumlinjer, der følger direkte efter `index` (0 = ingen sumlinje). */
const resolveTrailingSumLinesHeight = (blocks: readonly DocumentBlock[], index: number): number => {
  let height = 0;
  let pendingSpacerHeight = 0;
  for (let next = index + 1; next < blocks.length; next += 1) {
    const block = blocks[next];
    if (block.kind === 'sectionSpacer') {
      pendingSpacerHeight += SECTION_SPACER_HEIGHT_MM;
    } else if (isSumLine(block)) {
      height += pendingSpacerHeight + LABEL_VALUE_LINE_HEIGHT_MM;
      pendingSpacerHeight = 0;
    } else {
      break;
    }
  }
  return height;
};

/**
 * Tekstblokke, hvis SIDSTE linje holdes sammen med en efterfølgende sumlinje. Blokken kan
 * ombrydes over flere linjer, så reservationen lægges i writeren på sidste linje
 * (`keepLastLineWithNext`) – ikke som et skøn før blokken.
 */
const isTextContentBlock = (block: DocumentBlock): boolean =>
  block.kind === 'labelValue' || block.kind === 'normalThenBoldLine' || block.kind === 'wrappedText';

/**
 * `inheritedTrailingHeight` er sumlinje-kæden efter en indlejret blokliste (fx sidste række i
 * en atomisk rækkeblok); den gælder listens sidste blok.
 */
const renderBlocks = (
  writer: DocumentWriter,
  blocks: readonly DocumentBlock[],
  inheritedTrailingHeight = 0,
): void => {
  for (const [index, block] of blocks.entries()) {
    const isLastBlock = index === blocks.length - 1;
    const trailingSumLinesHeight =
      resolveTrailingSumLinesHeight(blocks, index) + (isLastBlock ? inheritedTrailingHeight : 0);
    if (trailingSumLinesHeight > 0 && isTextContentBlock(block)) {
      writer.keepLastLineWithNext(trailingSumLinesHeight);
    }
    switch (block.kind) {
      case 'wrappedText':
        if (block.bold) writer.writeBoldWrappedText(block.text);
        else if (block.continued)
          writer.writeWrappedTextContinued(block.text);
        else writer.writeWrappedText(block.text);
        break;
      case 'normalThenBoldLine':
        writer.writeNormalThenBoldLine(block.normalPart, block.boldPart);
        break;
      case 'labelValue': {
        writer.writeLeftRightText(block.label, block.value, block.options);
        break;
      }
      case 'sectionHeader':
        writer.writeSectionHeader(block.text);
        break;
      case 'title':
        writer.writeTitle(
          block.text,
          block.trailingSpacing === undefined ? undefined : { trailingSpacing: block.trailingSpacing }
        );
        break;
      case 'boldSubheader':
        writer.writeBoldSubheader(
          block.text,
          undefined,
          block.addTopSpacing === undefined ? undefined : { addTopSpacing: block.addTopSpacing }
        );
        break;
      case 'boldSubheaderWithText':
        writer.writeBoldSubheaderWithWrappedText(
          block.subheaderText,
          block.bodyText,
        );
        break;
      case 'underlinedSubheader':
        writer.writeUnderlinedSubheader(block.text);
        break;
      case 'conditionalSubsection':
        writer.writeBoldSubheaderIfContent({
          text: block.text,
          hasContent: block.blocks.length > 0,
          renderContent: () => renderBlocks(writer, block.blocks),
          options: block.addTopSpacing === undefined ? undefined : { addTopSpacing: block.addTopSpacing },
        });
        break;
      case 'sectionSpacer':
        writer.addSectionSpacer();
        break;
      case 'keepWithNext':
        writer.keepWithNext(block.minimumHeight);
        break;
      case 'pageBreak':
        writer.addPage();
        break;
      case 'table':
        writer.renderTable(block.spec);
        break;
      case 'atomicChunks': {
        // Følger en sumlinje, holdes sidste række (eller, uden rækker ud over den første,
        // header + første række) sammen med den. Rækkens sidste tekstlinje bærer desuden
        // reservationen, så også en ombrudt række holdes sammen med sumlinjen.
        const lastRow = block.rows.length > 0 ? block.rows[block.rows.length - 1] : undefined;
        const lastRowStandsAlone = block.rows.length > 1;
        writer.writeAtomicTableChunks({
          rows: block.rows,
          renderHeader: () => renderBlocks(writer, block.header),
          renderRow: (row) => {
            const isLastRow = row === lastRow;
            if (trailingSumLinesHeight > 0 && isLastRow && lastRowStandsAlone) {
              writer.keepWithNext(block.estimateRowHeight + trailingSumLinesHeight);
            }
            renderBlocks(writer, row, isLastRow ? trailingSumLinesHeight : 0);
          },
          estimateRowHeight: block.estimateRowHeight,
          headerHeight: lastRowStandsAlone
            ? block.headerHeight
            : block.headerHeight + trailingSumLinesHeight,
        });
        break;
      }
      case 'signature':
        if (block.requiredHeight !== undefined)
          writer.keepWithNext(block.requiredHeight);
        writer.writeSignatureBlock(
          block.dateLine,
          block.sigLine,
          block.skadelidteNavn,
        );
        break;
      case 'brevhoved':
        writer.writeBrevhoved(block.data);
        break;
      case 'watermark':
        writer.addUdkastWatermark();
        break;
      case 'contentWidthImage':
        writer.addContentWidthImage(block.dataUrl, {
          aspectRatio: block.aspectRatio,
          maxHeight: block.maxHeight,
          verticalPadding: block.verticalPadding,
        });
        break;
      case 'footer':
        writer.addFooter();
        break;
      default:
        assertNever(block);
    }
  }
};

export const renderDocumentModel = (
  writer: DocumentWriter,
  model: DocumentModel,
): void => {
  renderBlocks(writer, model.blocks);
};

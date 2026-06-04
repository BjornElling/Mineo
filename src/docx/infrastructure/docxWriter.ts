import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  type FileChild,
  type IPropertiesOptions,
  type ParagraphChild,
} from 'docx';
import type { PdfWriter } from '../../pdf/infrastructure/pdfWriter';
import type { BrevhovedData } from '../../pdf/shared/pdfHelpers';
import { TODAY } from '../../config/dateRanges';
import { VERSION } from '../../config/version';
import { getDocumentFooterBrand } from '../../document/documentBrand';
import { registerPendingDocumentDownload } from '../../document/documentGenerationContext';
import { triggerDocumentDownload } from '../../document/downloadArtifact';
import { createDocxTableBridgeDocument } from './docxTableBridge';

const DOCX_FONT = 'Calibri';
const PAGE_WIDTH_DXA = 11906;
const PAGE_HEIGHT_DXA = 16838;
const PAGE_MARGIN_DXA = 1440;
const CONTENT_WIDTH_DXA = PAGE_WIDTH_DXA - PAGE_MARGIN_DXA * 2;
const TABLE_CELL_MARGIN_DXA = 90;

type TextStyle = 'normal' | 'bold';

type CoreProperties = Readonly<{
  title?: string;
  subject?: string;
  author?: string;
  creator?: string;
}>;

const emptyBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
} as const;

const normalizeText = (text: string): string => text.replace(/\u00A0/g, ' ');

const splitLines = (text: string): string[] => {
  const lines = normalizeText(text).split(/\r?\n/);
  return lines.length > 0 ? lines : [''];
};

const paragraph = (
  text: string,
  options?: Readonly<{
    bold?: boolean;
    underline?: boolean;
    size?: number;
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingAfter?: number;
    spacingBefore?: number;
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
      underline: options?.underline ? {} : undefined,
      size: options?.size ?? 22,
      font: DOCX_FONT,
    }));
    return runs;
  });

  return new Paragraph({
    children,
    heading: options?.heading,
    alignment: options?.alignment,
    spacing: {
      before: options?.spacingBefore ?? 0,
      after: options?.spacingAfter ?? 120,
    },
  });
};

const mixedParagraph = (
  normalPart: string,
  boldPart: string,
): Paragraph => new Paragraph({
  children: [
    new TextRun({ text: normalizeText(normalPart), font: DOCX_FONT, size: 22 }),
    new TextRun({ text: normalizeText(boldPart), font: DOCX_FONT, size: 22, bold: true }),
  ],
  spacing: { after: 120 },
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

const resolveCellAlignment = (cell: unknown): (typeof AlignmentType)[keyof typeof AlignmentType] => {
  if (typeof cell !== 'object' || cell === null || !('styles' in cell)) return AlignmentType.LEFT;
  const styles = (cell as Readonly<{ styles?: Readonly<{ halign?: unknown }> }>).styles;
  if (styles?.halign === 'right') return AlignmentType.RIGHT;
  if (styles?.halign === 'center') return AlignmentType.CENTER;
  return AlignmentType.LEFT;
};

const resolveCellBold = (cell: unknown, isHeaderRow: boolean): boolean => {
  if (isHeaderRow) return true;
  if (typeof cell !== 'object' || cell === null || !('styles' in cell)) return false;
  const styles = (cell as Readonly<{ styles?: Readonly<{ fontStyle?: unknown }> }>).styles;
  return styles?.fontStyle === 'bold';
};

const createDocxTable = (body: readonly unknown[], hasHeaderRow: boolean): Table => {
  const rows = body.map((rawRow, rowIndex) => {
    const cells = Array.isArray(rawRow) ? rawRow : [rawRow];
    return new TableRow({
      tableHeader: hasHeaderRow && rowIndex === 0 ? true : undefined,
      children: cells.map((cell) => new TableCell({
        columnSpan: resolveCellSpan(cell),
        shading: hasHeaderRow && rowIndex === 0 ? { fill: 'E9EEF5' } : undefined,
        margins: {
          top: TABLE_CELL_MARGIN_DXA,
          bottom: TABLE_CELL_MARGIN_DXA,
          left: TABLE_CELL_MARGIN_DXA,
          right: TABLE_CELL_MARGIN_DXA,
        },
        children: [
          paragraph(resolveCellText(cell), {
            bold: resolveCellBold(cell, hasHeaderRow && rowIndex === 0),
            alignment: resolveCellAlignment(cell),
            size: 18,
            spacingAfter: 0,
          }),
        ],
      })),
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
  }>
): Table => new Table({
  rows: [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          borders: { top: emptyBorder, bottom: emptyBorder, left: emptyBorder, right: emptyBorder },
          children: [paragraph(leftText, { bold: options?.leftFontStyle === 'bold', spacingAfter: 0 })],
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          borders: { top: emptyBorder, bottom: emptyBorder, left: emptyBorder, right: emptyBorder },
          children: [paragraph(rightText, {
            bold: options?.rightFontStyle !== 'normal',
            alignment: AlignmentType.RIGHT,
            spacingAfter: 0,
          })],
        }),
      ],
    }),
  ],
  width: { size: 100, type: WidthType.PERCENTAGE },
  layout: TableLayoutType.AUTOFIT,
  borders: TableBorders.NONE,
});

const buildBrevhovedParagraphs = (data: BrevhovedData): Paragraph[] => {
  const lines = [
    data.journalnr ? `Journalnr.: ${data.journalnr}` : null,
    data.advokat ? `Advokat: ${data.advokat}` : null,
    data.sagsbehandler ? `Sagsbehandler: ${data.sagsbehandler}` : null,
    `Dato: ${data.dagsDatoISO || TODAY}`,
  ].filter((line): line is string => Boolean(line));

  return lines.map((line) => paragraph(line, {
    alignment: AlignmentType.RIGHT,
    size: 18,
    spacingAfter: 20,
  }));
};

export const createDocxWriter = (params?: Readonly<{ visUdkastStempel?: boolean }>): PdfWriter => {
  const blocks: FileChild[] = [];
  let properties: CoreProperties = {};
  let filename = 'dokument.docx';
  const bridgeDoc = createDocxTableBridgeDocument((body, hasHeaderRow) => {
    blocks.push(createDocxTable(body, hasHeaderRow));
    blocks.push(paragraph('', { spacingAfter: 160 }));
  });

  const addParagraph = (text: string, bold = false): void => {
    if (text.trim() === '') return;
    blocks.push(paragraph(text, { bold }));
  };

  const build = async (): Promise<Blob> => {
    const footer = new Footer({
      children: [
        paragraph(`${getDocumentFooterBrand()} // ${VERSION}`, {
          alignment: AlignmentType.RIGHT,
          size: 16,
          spacingAfter: 0,
        }),
      ],
    });

    const header = params?.visUdkastStempel
      ? new Header({
        children: [
          paragraph('UDKAST', {
            alignment: AlignmentType.CENTER,
            bold: true,
            size: 72,
            spacingAfter: 0,
          }),
        ],
      })
      : undefined;

    const documentOptions: IPropertiesOptions = {
      title: properties.title,
      subject: properties.subject,
      creator: properties.creator ?? properties.author,
      description: properties.subject,
      sections: [
        {
          headers: header ? { default: header } : undefined,
          footers: { default: footer },
          properties: {
            page: {
              size: { width: PAGE_WIDTH_DXA, height: PAGE_HEIGHT_DXA },
              margin: {
                top: PAGE_MARGIN_DXA,
                right: PAGE_MARGIN_DXA,
                bottom: PAGE_MARGIN_DXA,
                left: PAGE_MARGIN_DXA,
              },
            },
          },
          children: blocks.length > 0 ? blocks : [paragraph('')],
        },
      ],
      styles: {
        default: {
          document: {
            run: { font: DOCX_FONT, size: 22 },
            paragraph: { spacing: { after: 120 } },
          },
        },
      },
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
    getDoc: () => bridgeDoc as never,
    ensureSpace: () => {},
    getY: () => 0,
    setY: () => {},
    addSpacer: () => {
      blocks.push(paragraph('', { spacingAfter: 160 }));
    },
    addSectionSpacer: () => {
      blocks.push(paragraph('', { spacingAfter: 160 }));
    },
    advanceY: () => {},
    writeWrappedText: (text) => addParagraph(text),
    writeBoldWrappedText: (text) => addParagraph(text, true),
    writeWrappedTextContinued: (text) => addParagraph(text),
    writeNormalThenBoldLine: (normalPart, boldPart) => {
      blocks.push(mixedParagraph(normalPart, boldPart));
    },
    writeLeftRightText: (leftText, rightText, options) => {
      blocks.push(createLeftRightTable(leftText, rightText, options));
    },
    writeSectionHeader: (text) => {
      blocks.push(paragraph(text, { heading: HeadingLevel.HEADING_1, bold: true, size: 28, spacingBefore: 240 }));
    },
    writeTitle: (text) => {
      blocks.push(paragraph(text, { heading: HeadingLevel.TITLE, bold: true, size: 32, spacingAfter: 260 }));
    },
    writeBoldSubheader: (text) => {
      blocks.push(paragraph(text, { bold: true, size: 23, spacingBefore: 160, spacingAfter: 80 }));
    },
    writeBoldSubheaderIfContent: ({ text, hasContent, renderContent }) => {
      if (!hasContent) return false;
      blocks.push(paragraph(text, { bold: true, size: 23, spacingBefore: 160, spacingAfter: 80 }));
      renderContent();
      return true;
    },
    writeBoldSubheaderWithWrappedText: (subheaderText, bodyText) => {
      if (bodyText.trim() === '') return;
      blocks.push(paragraph(subheaderText, { bold: true, size: 23, spacingBefore: 160, spacingAfter: 80 }));
      addParagraph(bodyText);
    },
    writeAtomicTableChunks: ({ rows, renderHeader, renderRow }) => {
      renderHeader();
      for (const row of rows) {
        renderRow(row);
      }
    },
    writeUnderlinedSubheader: (text) => {
      blocks.push(paragraph(text, { underline: true, size: 23, spacingBefore: 160, spacingAfter: 80 }));
    },
    writeSignatureBlock: (dateLine, sigLine, _dateX, _sigX, skadelidteNavn) => {
      blocks.push(createDocxTable([
        [dateLine, sigLine],
        ['Dato', skadelidteNavn],
      ], false));
    },
    writeBrevhoved: (brevhovedData) => {
      blocks.push(...buildBrevhovedParagraphs(brevhovedData));
    },
    addUdkastWatermark: () => {},
    getTextWidth: (text) => text.length * 2,
    fitTextToWidth: (text) => text,
    getPageWidth: () => CONTENT_WIDTH_DXA,
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

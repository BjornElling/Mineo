/**
 * Golden-capture-hjælper til tabel-kanal-paritet (#15 TableSpec-udredning).
 *
 * Formål: fastfryse den "resolved presentation" som `renderDocumentTable` producerer
 * for hver rigtig tabel, FØR TableSpec-refaktoreringen — så hver migreringsstage kan
 * bevise byte-identitet (resolved kolonnebredder + hook-effekter på hver celle +
 * tegnede total-streger). Migreringen kompilerer `TableSpec` ned til præcis de params
 * `renderDocumentTable` allerede modtager, så et uændret snapshot = uændret output.
 *
 * PDF-siden fanges ved at mocke `jspdf-autotable`: autoTable modtager `(doc, options)`,
 * hvor `options.columnStyles`/`options.body` er de færdigfordelte værdier, og
 * `options.didParseCell`/`options.didDrawCell` er renderDocumentTables interne wrappere
 * (som selv kalder call-sitets hooks). Vi afspiller dem mod syntetiseret celle-geometri
 * — samme teknik som `reguleringSection.test.ts` — så striping, muted rows, total-fyld,
 * højre-inset og total-streger alle indgår i snapshottet. `doc` er den samme jsPDF-mock,
 * `didDrawCell`-closuren tegner på, så total-streger fanges via `doc.line`-kaldene.
 *
 * Word-siden fanges via `wordContentHarness` (rigtig .docx → `word/document.xml`),
 * hvor kun `<w:tbl>`-blokkene udtrækkes.
 */

export type CapturedColumnStyle = Readonly<{ cellWidth?: number | 'auto'; halign?: string }>;

export type CapturedAutoTableOptions = Readonly<{
  startY?: number;
  tableWidth?: number;
  columnStyles?: Record<number, CapturedColumnStyle>;
  body?: readonly unknown[];
  didParseCell?: (data: unknown) => void;
  didDrawCell?: (data: unknown) => void;
}>;

// Minimums-grænseflade for den jsPDF-mock, autoTable modtager. `line` skal være en
// vitest-spion (vi.fn), så vi kan aflæse de tegnede total-streger efter afspilning.
export type CaptureDoc = Readonly<{
  line: { mock: { calls: readonly (readonly number[])[] } };
}>;

type ResolvedCell = Readonly<{
  content: string;
  colSpan?: number;
}>;

type CellHookData = {
  row: { index: number };
  column: { index: number };
  cell: {
    styles: Record<string, unknown>;
    text: string[];
    width: number;
    height: number;
    x: number;
    y: number;
  };
};

type DrawnLine = Readonly<{ cell: string; x1: number; x2: number }>;

export type TablePresentation = Readonly<{
  startY?: number;
  tableWidth?: number;
  // KUN kolonnebredder (i mm / 'auto') — kolonne-halign udelades bevidst: den er
  // kilde-repræsentation, ikke synligt output. Den EFFEKTIVE justering pr. celle
  // (kolonne-fallback + celle-override + didParseCell) fanges i `cellStyles`, så
  // snapshottet er robust over for at flytte justering fra kolonne til celle (#15's
  // "justering defineret ét sted") uden at maskere en reel visuel ændring.
  columnWidths: Record<number, number | 'auto'>;
  body: readonly (readonly ResolvedCell[])[];
  // Cellernes EFFEKTIVE styles: kolonne-halign-fallback + celle-egne styles, derefter
  // didParseCell (striping/muted/total/inset). Keyed "row:col". Dette er det synlige
  // resultat, autotable ville rendere — uafhængigt af hvor justeringen stammer fra.
  cellStyles: Record<string, Record<string, unknown>>;
  drawnLines: readonly DrawnLine[];
}>;

const isCellObject = (cell: unknown): cell is { content?: unknown; colSpan?: unknown; styles?: unknown } =>
  typeof cell === 'object' && cell !== null;

const resolveContent = (cell: unknown): string => {
  if (isCellObject(cell) && 'content' in cell) {
    const { content } = cell as { content?: unknown };
    return typeof content === 'string' ? content : String(content ?? '');
  }
  return typeof cell === 'string' ? cell : String(cell ?? '');
};

const resolveColSpan = (cell: unknown): number | undefined => {
  if (!isCellObject(cell)) return undefined;
  const { colSpan } = cell as { colSpan?: unknown };
  return typeof colSpan === 'number' && Number.isInteger(colSpan) && colSpan > 1 ? colSpan : undefined;
};

const resolveOwnStyles = (cell: unknown): Record<string, unknown> | undefined => {
  if (!isCellObject(cell)) return undefined;
  const { styles } = cell as { styles?: unknown };
  return typeof styles === 'object' && styles !== null ? { ...(styles as Record<string, unknown>) } : undefined;
};

const round = (value: number): number => Math.round(value * 1e6) / 1e6;

const roundColumnWidths = (
  columnStyles: Record<number, CapturedColumnStyle> | undefined
): Record<number, number | 'auto'> => {
  const out: Record<number, number | 'auto'> = {};
  for (const [rawIndex, style] of Object.entries(columnStyles ?? {})) {
    const cellWidth = style?.cellWidth;
    if (cellWidth === undefined) continue;
    out[Number(rawIndex)] = typeof cellWidth === 'number' ? round(cellWidth) : cellWidth;
  }
  return out;
};

/**
 * Oversætter én fanget autotable-options (+ dens jsPDF-mock) til en serialiserbar
 * "resolved presentation" ved at afspille `didParseCell`/`didDrawCell` mod
 * syntetiseret, deterministisk celle-geometri.
 */
export const capturePresentation = (doc: CaptureDoc, options: CapturedAutoTableOptions): TablePresentation => {
  const rawBody = Array.isArray(options.body) ? options.body : [];
  const columnWidths = roundColumnWidths(options.columnStyles);
  const columnHalign = (index: number): string | undefined => options.columnStyles?.[index]?.halign;

  const body: ResolvedCell[][] = rawBody.map((row) => {
    const cells = Array.isArray(row) ? row : [row];
    return cells.map((cell) => {
      const colSpan = resolveColSpan(cell);
      return {
        content: resolveContent(cell),
        ...(colSpan ? { colSpan } : {}),
      };
    });
  });

  const cellStyles: Record<string, Record<string, unknown>> = {};
  const drawnLines: DrawnLine[] = [];

  rawBody.forEach((row, rowIndex) => {
    const cells = Array.isArray(row) ? row : [row];
    let columnIndex = 0;
    for (const cell of cells) {
      const colSpan = resolveColSpan(cell) ?? 1;
      const key = `${rowIndex}:${columnIndex}`;
      const columnWidth = columnWidths[columnIndex];
      const width = round(typeof columnWidth === 'number' ? columnWidth : 30);
      const ownStyles = resolveOwnStyles(cell);
      // Autotable udleder halign fra kolonne-styles og derefter celle-styles (celle vinder).
      const colHalign = columnHalign(columnIndex);
      const initialStyles: Record<string, unknown> = {
        ...(colHalign ? { halign: colHalign } : {}),
        ...ownStyles,
      };
      const data: CellHookData = {
        row: { index: rowIndex },
        column: { index: columnIndex },
        cell: { styles: initialStyles, text: [resolveContent(cell)], width, height: 8, x: 10, y: 50 },
      };

      if (options.didParseCell) options.didParseCell(data);
      cellStyles[key] = data.cell.styles;

      if (options.didDrawCell) {
        const before = doc.line.mock.calls.length;
        options.didDrawCell(data);
        for (const call of doc.line.mock.calls.slice(before)) {
          drawnLines.push({ cell: key, x1: round(Number(call[0])), x2: round(Number(call[2])) });
        }
      }

      columnIndex += colSpan;
    }
  });

  return {
    startY: options.startY,
    tableWidth: typeof options.tableWidth === 'number' ? round(options.tableWidth) : options.tableWidth,
    columnWidths,
    body,
    cellStyles,
    drawnLines,
  };
};

/**
 * Udtrækker `<w:tbl>…</w:tbl>`-blokke fra en docx `document.xml`, så Word-tabellernes
 * struktur (rækker, celler, gridSpan, w:jc-justering, fed, header-shading) kan
 * snapshottes uafhængigt af titler/brødtekst/footer i det øvrige dokument.
 */
export const extractWordTables = (documentXml: string): string[] => {
  const tables: string[] = [];
  const tableTags = /<w:tbl(?:\s[^>]*)?>|<\/w:tbl>/g;
  let depth = 0;
  let tableStart = -1;
  let match: RegExpExecArray | null;

  // Summeringsstreger kan ligge i en indlejret tabel. En non-greedy regex stopper ved
  // dens sluttag og trunkerer den ydre tabel, så vi balancerer eksplicit tabel-tags.
  while ((match = tableTags.exec(documentXml)) !== null) {
    if (match[0].startsWith('</')) {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0) {
        tables.push(documentXml.slice(tableStart, tableTags.lastIndex));
        tableStart = -1;
      }
      continue;
    }

    if (depth === 0) tableStart = match.index;
    depth += 1;
  }

  return tables;
};

const DOCX_TABLE_BRIDGE = Symbol('mineo.docxTableBridge');

export type DocxCellAlign = 'left' | 'center' | 'right';

/**
 * Justering pr. kolonne for data-rækker (alt under en evt. headerrække).
 *
 * PDF-tabeller kan udlede en celles justering tre steder: cellens egen
 * `styles.halign`, kolonnens `columnStyles[i].halign`, og imperative
 * `didParseCell`-hooks. Kun den første er synlig på selve celle-objektet, så
 * de to øvrige ville ellers gå tabt i Word (fx beløb der højrejusteres via
 * kolonne-/hook-niveau i renteberegning og EO-reguleringsbilag). Broen modtager
 * derfor en eksplicit kolonne→justering-tabel, så Word matcher PDF'ens justering.
 */
export type DocxColumnAlignments = Readonly<Record<number, DocxCellAlign>>;

type DocxTableBridgeTarget = {
  readonly [DOCX_TABLE_BRIDGE]: true;
  addDocxTableFromPdfRows(
    body: readonly unknown[],
    hasHeaderRow: boolean,
    columnAlignments?: DocxColumnAlignments
  ): void;
};

export type DocxTableBridgeDocument = DocxTableBridgeTarget & Record<string, unknown>;

export const createDocxTableBridgeDocument = (
  addDocxTableFromPdfRows: (
    body: readonly unknown[],
    hasHeaderRow: boolean,
    columnAlignments?: DocxColumnAlignments
  ) => void
): DocxTableBridgeDocument => ({
  [DOCX_TABLE_BRIDGE]: true,
  addDocxTableFromPdfRows,
});

export const isDocxTableBridgeDocument = (value: unknown): value is DocxTableBridgeDocument => {
  return (
    typeof value === 'object'
    && value !== null
    && (value as Partial<DocxTableBridgeTarget>)[DOCX_TABLE_BRIDGE] === true
    && typeof (value as Partial<DocxTableBridgeTarget>).addDocxTableFromPdfRows === 'function'
  );
};

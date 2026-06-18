/**
 * Dokument-tabel-bro (kanal-neutral kontrakt)
 *
 * Den fælles tabel-renderer (`renderDocumentTable`) modtager enten en rå jsPDF-instans
 * (PDF-kanal) eller et bro-dokument (Word-kanal). På Word-kanalen opfylder
 * `createDocumentTableBridgeDocument` denne grænseflade og oversætter de PDF-formede
 * tabelrækker til en docx-tabel. Symbol-mærkningen gør broen entydigt identificerbar
 * via `isDocumentTableBridgeDocument`, så rendereren kan forgrene fail-closed på kanalen.
 */

const DOCUMENT_TABLE_BRIDGE = Symbol('mineo.documentTableBridge');

export type DocumentTableCellAlign = 'left' | 'center' | 'right';

/**
 * Justering pr. kolonne for data-rækker (alt under en evt. headerrække).
 *
 * Tabeller kan udlede en celles justering tre steder: cellens egen `styles.halign`,
 * kolonnens `columnStyles[i].halign`, og imperative `didParseCell`-hooks. Kun den
 * første er synlig på selve celle-objektet, så de to øvrige ville ellers gå tabt i
 * Word (fx beløb der højrejusteres via kolonne-/hook-niveau i renteberegning og
 * EO-reguleringsbilag). Broen modtager derfor en eksplicit kolonne→justering-tabel,
 * så Word matcher PDF'ens justering.
 */
export type DocumentTableColumnAlignments = Readonly<Record<number, DocumentTableCellAlign>>;

type DocumentTableBridgeTarget = {
  readonly [DOCUMENT_TABLE_BRIDGE]: true;
  addBridgeTableFromRows(
    body: readonly unknown[],
    hasHeaderRow: boolean,
    columnAlignments?: DocumentTableColumnAlignments
  ): void;
};

export type DocumentTableBridgeDocument = DocumentTableBridgeTarget & Record<string, unknown>;

export const createDocumentTableBridgeDocument = (
  addBridgeTableFromRows: (
    body: readonly unknown[],
    hasHeaderRow: boolean,
    columnAlignments?: DocumentTableColumnAlignments
  ) => void
): DocumentTableBridgeDocument => ({
  [DOCUMENT_TABLE_BRIDGE]: true,
  addBridgeTableFromRows,
});

export const isDocumentTableBridgeDocument = (value: unknown): value is DocumentTableBridgeDocument => {
  return (
    typeof value === 'object'
    && value !== null
    && (value as Partial<DocumentTableBridgeTarget>)[DOCUMENT_TABLE_BRIDGE] === true
    && typeof (value as Partial<DocumentTableBridgeTarget>).addBridgeTableFromRows === 'function'
  );
};

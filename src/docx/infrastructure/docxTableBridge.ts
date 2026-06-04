import type { FileChild } from 'docx';

const DOCX_TABLE_BRIDGE = Symbol('mineo.docxTableBridge');

type DocxTableBridgeTarget = {
  readonly [DOCX_TABLE_BRIDGE]: true;
  addDocxTableFromPdfRows(body: readonly unknown[], hasHeaderRow: boolean): void;
};

export type DocxTableBridgeDocument = DocxTableBridgeTarget & Record<string, unknown>;

export const createDocxTableBridgeDocument = (
  addDocxTableFromPdfRows: (body: readonly unknown[], hasHeaderRow: boolean) => void
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

export type DocxBlock = FileChild;

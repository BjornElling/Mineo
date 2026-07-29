// Inputkernen (§3). Ren, framework-fri: ingen React, Zustand, DOM eller storage.
// Runtime-bindingen (`inputCore/runtime`, `inputCore/react`) og domænets consumere bygger ovenpå denne kerne.

export * from './fieldAddress';
export * from './fieldCodec';
export * from './fieldCodecs';
export * from './fieldDescriptor';
export * from './settledInput';
export * from './fieldCatalog';
export * from './structuralAccessors';
export * from './structuralDescriptors';
export { buildProductionInputCatalog, getProductionInputCatalog } from './catalog/productionCatalog';
export * from './inputIssue';
export { createInputEvaluation } from './inputReader';
export type {
  EntityRef,
  InputEvaluation,
  InputReader,
  ReadFieldResult,
} from './inputReader';
export * from './inputReducer';
export * from './evaluationSource';
export * from './projection';
export * from './inputHistory';
export * from './editor';

// Greenfield inputkerne (§3, Fase 1). Ren, framework-fri: ingen React, Zustand, DOM eller storage.
// Runtime-bindingen (Fase 2) og consumer-cutoveren (Fase 3–5) bygger ovenpå denne kerne.

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

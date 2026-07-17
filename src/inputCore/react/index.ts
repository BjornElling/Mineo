// Greenfield-React (Fase 2.3): den tynde React-overflade oven på den framework-frie editor-state-machine +
// runtime-binding. Adapterne ejer KUN rendering, aktivering, hit-area og navigation (§3.5). Til forskel fra
// `src/inputCore/index.ts` (ren kerne) og `runtime/` (Zustand/storage) afhænger dette lag af React.

export {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  type InputRuntimeBinding,
  type InputRuntimeProviderProps,
} from './inputRuntimeContext';
export * from './productionInputRuntime';
export * from './useFieldEditor';
export * from './useFormFieldSurface';
export * from './useCollectionRows';
export * from './useCellEditor';
export * from './useGridCellSurface';
export * from './useInputEvaluation';

// React-laget (Fase 2.3): den tynde React-overflade oven på den framework-frie editor-state-machine +
// runtime-binding. Adapterne ejer KUN rendering, aktivering, hit-area og navigation (§3.5). Til forskel fra
// `src/inputCore/index.ts` (ren kerne) og `runtime/` (Zustand/storage) afhænger dette lag af React.

export {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  useDocumentInputAccess,
  useInputEditPort,
  useInputReadPort,
  useSettledSnapshot,
  type DocumentInputAccess,
  type InputEditPort,
  type InputReadPort,
  type InputRuntimeBinding,
  type InputRuntimeProviderProps,
  type SettledSnapshot,
} from './inputRuntimeContext';
export * from './productionInputRuntime';
export * from './productionInputRuntimeProvider';
export * from './useFieldEditor';
export * from './useFormFieldSurface';
export * from './useCollectionRows';
export * from './useCellEditor';
export * from './useGridCellSurface';
export * from './useInputEvaluation';
export * from './useCaseOperations';
export * from './inputDiagnosticsProjection';
export * from './useUndoRedoShortcuts';
export * from './saveBlockedFocus';

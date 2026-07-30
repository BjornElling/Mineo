// Input-runtimens bindingslag gør den rene inputkerne levende. Til forskel fra
// `src/inputCore/index.ts` (ren, framework-fri) afhænger dette lag af Zustand og sessionStorage.

export * from './currentSessionEnvelope';
export {
  type SlimInputMeta,
  type SlimInputStore,
  type SlimInputStoreState,
} from './slimInputStore';
export {
  dispatchInput,
  type DispatchInputOptions,
  type DispatchInputResult,
  type RuntimeInputCommand,
  type StructuralDispatchInputOptions,
  type StructuralInputCommand,
} from './dispatchInput';
export * from './initializeInputRuntime';
export * from './evaluationSourceBinding';
export * from './activeEditorRegistry';
export * from './criticalActionCoordinator';

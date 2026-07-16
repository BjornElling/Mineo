// Greenfield-runtime (Fase 2.1): bindingslaget der gør den rene inputkerne levende. Til forskel fra
// `src/inputCore/index.ts` (ren, framework-fri) afhænger dette lag af Zustand og sessionStorage. Det er den
// udpegede erstatning for `inputRuntimeStore` + `inputTransactionRunner`; cutoveren peger produktionen hertil.

export * from './currentSessionEnvelope';
export * from './slimInputStore';
export * from './dispatchInput';
export * from './initializeInputRuntime';
export * from './evaluationSourceBinding';

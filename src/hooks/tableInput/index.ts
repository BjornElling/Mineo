export type { TableAdapterParseResult, TableInputAdapter } from './tableInputAdapter';
export { useTableInputCore, type TableInputChangeEvent, type UseTableInputCoreOptions, type UseTableInputCoreResult } from './useTableInputCore';
export { textTableInputAdapter, toCommittedTextPayload, type TableTextInputModel } from './adapters/textAdapter';
export {
  createIntegerTableInputAdapter,
  toCommittedIntegerPayload,
  type TableIntegerAdapterConfig,
  type TableIntegerInputModel,
} from './adapters/integerAdapter';
export {
  createYearTableInputAdapter,
  toCommittedYearPayload,
  type TableYearAdapterConfig,
  type TableYearInputModel,
  type TableYearPolicy,
} from './adapters/yearAdapter';

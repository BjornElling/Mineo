import type {
  AarsloenTableFirstErrorCell,
  AarsloenTableValidationSummary,
  OffentligeYdelserTableFirstErrorCell,
  OffentligeYdelserTableValidationSummary,
  TableError,
} from './table';

export interface AarsloenTableHandle {
  getErrors: () => TableError[];
  getValidationSummary: () => AarsloenTableValidationSummary;
  showMissingEntryError: (cell: AarsloenTableFirstErrorCell) => void;
  flashError: (error: Extract<TableError, { kind: 'cell' }>) => void;
}

export interface OffentligeYdelserTableHandle {
  getValidationSummary: () => OffentligeYdelserTableValidationSummary;
  showMissingEntryError: (cell: OffentligeYdelserTableFirstErrorCell) => void;
}

export interface StyledToggleSwitchHandle {
  shake: () => void;
}

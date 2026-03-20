import type {
  StandardLoenTableFirstErrorCell,
  StandardLoenTableValidationSummary,
  OffentligeYdelserTableFirstErrorCell,
  OffentligeYdelserTableValidationSummary,
  TableError,
} from './table';

export interface StandardLoenTableHandle {
  getErrors: () => TableError[];
  getValidationSummary: () => StandardLoenTableValidationSummary;
  showMissingEntryError: (cell: StandardLoenTableFirstErrorCell) => void;
  flashError: (error: Extract<TableError, { kind: 'cell' }>) => void;
}

export interface OffentligeYdelserTableHandle {
  getValidationSummary: () => OffentligeYdelserTableValidationSummary;
  showMissingEntryError: (cell: OffentligeYdelserTableFirstErrorCell) => void;
}

export interface StyledToggleSwitchHandle {
  shake: () => void;
}

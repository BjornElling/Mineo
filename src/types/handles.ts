import type {
  StandardLoenTableFirstErrorCell,
  OffentligeYdelserTableFirstErrorCell,
  OffentligeYdelserTableValidationSummary,
  TableError,
} from './table';

  export interface StandardLoenTableHandle {
    showMissingEntryError: (cell: StandardLoenTableFirstErrorCell) => void;
  flashError: (error: Extract<TableError, { kind: 'cell' }>) => void;
  /**
   * Peg brugeren på første periodecelle med "Indtastning mangler", når der hverken er en konkret
   * fejlcelle eller en påbegyndt periode (typisk en helt tom tabel). Bruges når omregning forsøges
   * aktiveret uden gyldig periode, så feedbacken ikke bliver en stum rystelse.
   */
  showNeedsPeriodHint: () => void;
}

export interface OffentligeYdelserTableHandle {
  getValidationSummary: () => OffentligeYdelserTableValidationSummary;
  showMissingEntryError: (cell: OffentligeYdelserTableFirstErrorCell) => void;
}

export interface StyledToggleSwitchHandle {
  shake: () => void;
}

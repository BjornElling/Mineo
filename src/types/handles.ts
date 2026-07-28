import type {
  StandardLoenTableFirstErrorCell,
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

// Bemærk: `OffentligeYdelserTableHandle` er slettet. Interfacet havde INGEN implementer og INGEN consumer —
// tabellen eksponerer intet imperativt handle, og valideringen læses reader-afledt gennem
// `offentligeYdelserTableValidation`. Et interface uden begge ender lignede en kontrakt, der bandt tabellen
// (INC-F09). De to typer, det brugte, er fortsat i brug af netop den validering.

export interface StyledToggleSwitchHandle {
  shake: () => void;
}

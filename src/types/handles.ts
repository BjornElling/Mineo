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
   * aktiveret uden gyldig periode, så afvisningen peger på et konkret sted frem for ingenting.
   */
  showNeedsPeriodHint: () => void;
}

// Bemærk: `OffentligeYdelserTableHandle` er slettet. Interfacet havde INGEN implementer og INGEN consumer —
// tabellen eksponerer intet imperativt handle, og valideringen læses reader-afledt gennem
// `offentligeYdelserTableValidation`. Et interface uden begge ender lignede en kontrakt, der bandt tabellen
//. De to typer, det brugte, er fortsat i brug af netop den validering.

// Bemærk: `StyledToggleSwitchHandle` er slettet sammen med rystelsen (brugerbeslutning
// 2026-08-15). Interfacet havde præcis ét medlem, `shake()`, og eksisterede alene for at lade
// omregnings-gaten ryste togglen ved en afvist aktivering. Uden rystelsen har `StyledToggleSwitch`
// ingen imperativ flade, og et tomt handle ville foregøgle en kontrakt, der ikke findes.
// Genindfør det ikke: afvisningen peger nu på den konkrete fejlcelle (se `useOmregningToggle`).

import type {
  StandardLoenTableFirstErrorCell,
  TableError,
} from './table';

/**
 * Om en peg-handling må flytte brugerens blik hen til cellen.
 *
 * - `'scrollIntoView'` – cellen scrolles frem og blinker. Til links og knapper, brugeren BEVIDST klikker
 *   på for at blive ført hen til problemet (fx meddelelsesboksens fejllinks).
 * - `'inPlace'` – cellen blinker, hvor den står; siden flytter sig ikke. Til en afvist toggle: brugeren
 *   forsøgte at slå noget til, ikke at blive ført et andet sted hen, og et spring væk fra togglen ville
 *   forvirre mere, end det hjalp (udviklerbeslutning 2026-10-28). Togglens egen rystelse er svaret;
 *   blinket er den supplerende henvisning til årsagen, hvis den er i synsfeltet.
 */
export type CellPointMode = 'scrollIntoView' | 'inPlace';

export interface StandardLoenTableHandle {
  showMissingEntryError: (cell: StandardLoenTableFirstErrorCell, mode: CellPointMode) => void;
  flashError: (error: Extract<TableError, { kind: 'cell' }>, mode: CellPointMode) => void;
  /**
   * Peg brugeren på første periodecelle med "Indtastning mangler", når der hverken er en konkret
   * fejlcelle eller en påbegyndt periode (typisk en helt tom tabel). Bruges når omregning forsøges
   * aktiveret uden gyldig periode, så afvisningen peger på et konkret sted frem for ingenting.
   */
  showNeedsPeriodHint: (mode: CellPointMode) => void;
}

// Bemærk: `OffentligeYdelserTableHandle` er slettet. Interfacet havde INGEN implementer og INGEN consumer –
// tabellen eksponerer intet imperativt handle, og valideringen læses reader-afledt gennem
// `offentligeYdelserTableValidation`. Et interface uden begge ender lignede en kontrakt, der bandt tabellen
//. De to typer, det brugte, er fortsat i brug af netop den validering.

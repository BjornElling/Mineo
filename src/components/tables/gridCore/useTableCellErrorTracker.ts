import * as React from 'react';

/**
 * Delt celle-fejl-sporing for de tabel-lokale grid-tabeller (Standard løn, Offentlige ydelser,
 * Lønudvikling manuel). De tre tabeller sporede tidligere celle-fejl tre subtilt forskellige måder
 * (`Set<string>` vs `Record<string, true>`, prune i effect vs lazy-filter ved læsning, med/uden
 * transition-guard). Divergensen var utilsigtet og var netop her, en reel celle-fejl kunne tabes:
 * en gate der byggede på en rækkeliste-effect kunne se forældede eller manglende rækker, så Gem
 * ikke blokerede som det burde (jf. 14.2 §2.4). Selve fejl-sporingen — det der faktisk divergerede —
 * er identisk på tværs af de tre, mens validerings-*builderne* bevidst forbliver tabel-specifikke.
 *
 * Kernen ejer derfor de tre fælles ting, så adfærden er ufravigeligt ens:
 *
 * 1) **Transition-bevogtet mutation** — `setCellError` ændrer kun sættet ved en reel
 *    {ingen fejl ↔ fejl}-overgang og returnerer, om noget faktisk skiftede, så kalderen kun
 *    notificerer ved ægte ændringer (ét sted, samme guard for alle tre).
 * 2) **Filtrering ved læsning** — `getActiveCellKeys`/`hasAnyError` filtrerer altid mod de aktuelt
 *    gyldige række-id'er på kald-tidspunktet. Korrektheden afhænger derfor IKKE af, at en
 *    prune-effect er nået at køre: en fjernet rækkes fejl kan aldrig overleve ind i en Gem-gate.
 * 3) **Prune-housekeeping** — `pruneToValidRowIds` fjerner forældede rækkers fejl fra det bagvedliggende
 *    sæt (memory-housekeeping; korrektheden hviler på read-time-filtreringen, ikke på denne).
 *
 * Cell-key-konvention (delt): "<rowId>:<col>" hvor <rowId> er segmentet før det første ":".
 * Række-id'er indeholder aldrig ":" (jf. `rowId.ts` og DEV-guarden i `buildOffentligeYdelserCellKey`),
 * så rowId kan altid udledes som præfikset før første ":".
 */
export const getRowIdFromCellKey = (cellKey: string): string | null => {
  const separatorIdx = cellKey.indexOf(':');
  return separatorIdx < 0 ? null : cellKey.slice(0, separatorIdx);
};

export type TableCellErrorTracker = Readonly<{
  /** Registrér/ryd en celle-fejl. Returnerer true hvis sæt-medlemskabet faktisk skiftede (transition). */
  setCellError: (cellKey: string, hasError: boolean) => boolean;
  /** Aktive fejl-celle-keys begrænset til gyldige rækker; filtreres ved læsning. */
  getActiveCellKeys: (validRowIds: ReadonlySet<string>) => string[];
  /** Sandt hvis mindst én gyldig række har en celle-fejl. */
  hasAnyError: (validRowIds: ReadonlySet<string>) => boolean;
  /** Fjern fejl for rækker der ikke længere er gyldige (housekeeping; kald i en effect ved rækkeliste-ændring). */
  pruneToValidRowIds: (validRowIds: ReadonlySet<string>) => void;
}>;

export const useTableCellErrorTracker = (): TableCellErrorTracker => {
  const cellErrorsRef = React.useRef<Set<string>>(new Set());

  const setCellError = React.useCallback((cellKey: string, hasError: boolean): boolean => {
    const set = cellErrorsRef.current;
    const had = set.has(cellKey);
    if (hasError) {
      if (had) return false;
      set.add(cellKey);
      return true;
    }
    if (!had) return false;
    set.delete(cellKey);
    return true;
  }, []);

  const getActiveCellKeys = React.useCallback((validRowIds: ReadonlySet<string>): string[] => {
    const result: string[] = [];
    for (const cellKey of cellErrorsRef.current) {
      const rowId = getRowIdFromCellKey(cellKey);
      if (rowId !== null && validRowIds.has(rowId)) {
        result.push(cellKey);
      }
    }
    return result;
  }, []);

  const hasAnyError = React.useCallback((validRowIds: ReadonlySet<string>): boolean => {
    for (const cellKey of cellErrorsRef.current) {
      const rowId = getRowIdFromCellKey(cellKey);
      if (rowId !== null && validRowIds.has(rowId)) {
        return true;
      }
    }
    return false;
  }, []);

  const pruneToValidRowIds = React.useCallback((validRowIds: ReadonlySet<string>): void => {
    const set = cellErrorsRef.current;
    for (const cellKey of set) {
      const rowId = getRowIdFromCellKey(cellKey);
      if (rowId === null || !validRowIds.has(rowId)) {
        set.delete(cellKey);
      }
    }
  }, []);

  return { setCellError, getActiveCellKeys, hasAnyError, pruneToValidRowIds };
};

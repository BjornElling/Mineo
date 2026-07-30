// Runtime-neutralt restore-fokus-flag (§3.7). Sat mens undo/redo flytter fokus PROGRAMMATISK.
//
// Mens flaget er sat, må en felt-/celle-blur IKKE committe: blur'et skyldes fokus-flytningen, ikke en
// brugerredigering, og draften kan endnu være forældet. Flaget bor i sit eget modul — ikke i restore-løkken —
// så commit-stierne kan læse det uden at afhænge af DOM-/løkke-implementeringen.

let restoreFocusInProgress = false;

/** Er en programmatisk undo/redo-fokus-flytning i gang? Commit-stier undertrykker blur-commit imens. */
export const isRestoreFocusInProgress = (): boolean => restoreFocusInProgress;

/**
 * Kør `fn` med restore-fokus-flaget sat. Flaget ryddes altid igen (også ved kast), så en fejlende
 * fokus-flytning ikke efterlader commit-stierne permanent undertrykt.
 */
export const withRestoreFocusSuppressed = <T>(fn: () => T): T => {
  restoreFocusInProgress = true;
  try {
    return fn();
  } finally {
    restoreFocusInProgress = false;
  }
};

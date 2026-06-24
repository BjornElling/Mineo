/**
 * Én blokerende EO-issue: et stabilt id (matcher debug-rækkens id) + den bruger-synlige besked.
 * Drives af `eoBlockingValidation` og dens familie-moduler (jf. B9).
 */
export type EoBlockingIssue = Readonly<{ id: string; message: string }>;

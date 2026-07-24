/**
 * Kanonisk kilde for Erstatningsopgørelsens fane-nøgler. Udskilt fra sidekomponenten, så tabeller og sektioner
 * kan referere fane-nøglerne til undo/redo-navigation-metadata (§3.7) UDEN en cyklisk import tilbage til
 * `Erstatningsopgoerelse.tsx` (som selv renderer disse tabeller/sektioner). Fane-nøglerne matcher dem,
 * `usePersistedActiveTab`/`setActiveTabForPage` bruger for `/erstatningsopgoerelse`.
 */
export const EO_TAB_KEYS = {
  EO_OPLYSNINGER: 'eo_oplysninger',
  LOENINDKOMST: 'loenindkomst',
  OFFENTLIGE_YDELSER: 'offentlige_ydelser',
  BEREGNING: 'beregning',
  INSPEKTION: 'inspektion',
  KONTROLTABEL: 'kontroltabel',
} as const;

export type EoTabKey = (typeof EO_TAB_KEYS)[keyof typeof EO_TAB_KEYS];

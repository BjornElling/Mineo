/**
 * Stabile tabel-id'er og fieldPath-konvention for celle-`invalidDrafts` (jf.
 * `persistence-contract.md` §11 + `ugyldigt-input-persisteret-invaliddrafts.md` Fase 3).
 *
 * En grid-celles ikke-committbare rå draft persisteres under en fuldt kvalificeret `fieldPath` i
 * `invalidDrafts[pageKey][fieldPath]`. To tabeller i samme sektion (fx flere ansættelsesforhold på
 * lønindkomst-fanen) deler ikke nødvendigvis unikke `rowId`, så `fieldPath` skal kvalificeres med
 * et stabilt `tableId` (route-diskriminerende) og en valgfri `rowScope` (fx ansættelsesforhold-id).
 *
 * Konvention: `${tableId}:${rowScope}:${rowId}:${colIndex}` (rowScope udelades når tom).
 * `tableId` må ALDRIG indeholde `:` — save-gaten udtrækker det som præfikset før første `:`.
 * `rowScope` (typisk et ansættelsesforhold-id) må heller ALDRIG indeholde `:`, så to forskellige
 * scopes ikke kan konkatenere til samme nøgle. De nuværende kilder (UUID-agtige af-id'er) er sikre.
 */

/**
 * Kanoniske tabel-id'er. Hvert id er unikt på tværs af HELE appen (ikke kun pr. sektion), så det
 * kan bruges som routing-nøgle i save-gaten (`saveBlockedFocus`).
 */
export const CELL_TABLE_IDS = {
  aarsloenStandardLoen: 'aarsloen-standardloen',
  eoStandardLoen: 'eo-standardloen',
  eoLoenudvikling: 'eo-loenudvikling',
  eoAngivetLoenudvikling: 'eo-angivet-loenudvikling',
  eoOffentligeYdelser: 'eo-offentlige-ydelser',
  eoOevrigeKrav: 'eo-oevrige-krav',
  eoSvieSmerte: 'eo-svie-smerte',
  eoTafPeriode: 'eo-taf-periode',
  eoFerieperiode: 'eo-ferieperiode',
  eoBeregningsperiodeFerie: 'eo-beregningsperiode-ferie',
  renteBeregnet: 'rente-beregnet',
  eetAslAfgoerelser: 'eet-asl-afgoerelser',
} as const;

export type CellTableId = (typeof CELL_TABLE_IDS)[keyof typeof CELL_TABLE_IDS];

/** Byg en fuldt kvalificeret celle-`fieldPath`. `rowScope` udelades når tom. */
export const buildCellInvalidDraftFieldPath = (
  tableId: string,
  rowScope: string,
  gridCellKey: string
): string => (rowScope === '' ? `${tableId}:${gridCellKey}` : `${tableId}:${rowScope}:${gridCellKey}`);

/** Udtræk `tableId` (præfikset før første `:`) fra en celle-`fieldPath`. */
export const extractCellTableId = (fieldPath: string): string => {
  const idx = fieldPath.indexOf(':');
  return idx === -1 ? fieldPath : fieldPath.slice(0, idx);
};

/**
 * Fane-routing for celle-`fieldPaths` pr. `tableId`. Kun sider med faner er repræsenteret; tabeller
 * på enkeltfane-sider (eller sider hvor sidens standard-fane er korrekt) mangler bevidst og
 * falder tilbage til sidens standard-fane i `prepareTabForBlockingError`.
 */
const CELL_TABLE_TAB_BY_ID: Readonly<Record<string, string>> = {
  [CELL_TABLE_IDS.eoStandardLoen]: 'loenindkomst',
  [CELL_TABLE_IDS.eoLoenudvikling]: 'loenindkomst',
  [CELL_TABLE_IDS.eoAngivetLoenudvikling]: 'eo_oplysninger',
  [CELL_TABLE_IDS.eoOffentligeYdelser]: 'offentlige_ydelser',
  [CELL_TABLE_IDS.eoOevrigeKrav]: 'eo_oplysninger',
  [CELL_TABLE_IDS.eoSvieSmerte]: 'eo_oplysninger',
  [CELL_TABLE_IDS.eoTafPeriode]: 'eo_oplysninger',
  [CELL_TABLE_IDS.eoFerieperiode]: 'eo_oplysninger',
  [CELL_TABLE_IDS.eoBeregningsperiodeFerie]: 'eo_oplysninger',
};

/**
 * Returnér mål-fanen for en celle-`fieldPath`, eller `undefined` hvis dens `tableId` ikke har en
 * eksplicit fane (kalderen falder da tilbage til sidens standard-fane).
 */
export const resolveTabForCellFieldPath = (fieldPath: string): string | undefined =>
  CELL_TABLE_TAB_BY_ID[extractCellTableId(fieldPath)];

/** Sandt hvis `fieldPath` følger celle-konventionen (kendt `tableId`-præfiks). */
export const isCellInvalidDraftFieldPath = (fieldPath: string): boolean => {
  const tableId = extractCellTableId(fieldPath);
  return (Object.values(CELL_TABLE_IDS) as string[]).includes(tableId);
};

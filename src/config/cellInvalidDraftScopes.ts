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

/**
 * Præfikset for alle celle-`fieldPaths` i ét (tableId, rowScope)-scope — netop det `buildCellInvalidDraftFieldPath`
 * forankrer hver nøgle med. Resten af nøglen er `${rowId}:${colIndex}` (gridCellKey).
 */
const cellInvalidDraftScopePrefix = (tableId: string, rowScope: string): string =>
  rowScope === '' ? `${tableId}:` : `${tableId}:${rowScope}:`;

/**
 * Udtræk `rowId` fra en celle-`fieldPath`, GIVET det (tableId, rowScope)-scope nøglen forventes at høre til.
 * Returnerer `null` hvis nøglen ikke hører til scopet (anden tabel/scope), så kalderen aldrig rører
 * fremmede scopes' drafts. Da `tableId`/`rowScope` aldrig indeholder `:` (jf. konventionen øverst) og
 * `rowId` heller ikke gør, er præfiks-stripning + `split(':')[0]` entydig.
 */
export const extractCellRowIdForScope = (fieldPath: string, tableId: string, rowScope: string): string | null => {
  const prefix = cellInvalidDraftScopePrefix(tableId, rowScope);
  if (!fieldPath.startsWith(prefix)) return null;
  const rowId = fieldPath.slice(prefix.length).split(':')[0];
  return rowId === '' ? null : rowId;
};

/**
 * Udtræk `rowScope` (segmentet umiddelbart efter `tableId`) fra en celle-`fieldPath` der bruger et
 * IKKE-tomt rowScope (fx ansættelsesforhold-id). Returnerer `null` hvis nøglen ikke har det forventede
 * `tableId`-præfiks. Forudsætter at det pågældende `tableId` ALTID kvalificeres med et rowScope
 * (gælder kun `eo-standardloen` + `eo-loenudvikling`, der kun rendres pr. ansættelsesforhold).
 */
export const extractCellRowScope = (fieldPath: string, tableId: string): string | null => {
  const prefix = `${tableId}:`;
  if (!fieldPath.startsWith(prefix)) return null;
  const rowScope = fieldPath.slice(prefix.length).split(':')[0];
  return rowScope === '' ? null : rowScope;
};

/**
 * Er denne celle-`fieldPath` forældreløs ift. de aktuelt RENDEREDE rækker i ét (tableId, rowScope)-scope?
 * Sandt netop når nøglen hører til scopet, men dens `rowId` ikke længere er en levende (renderet) række.
 * Bruges af `useReconcileInvalidDraftsToLiveRows` til at rydde en slettet rækkes draft (parallelt til
 * `useTableCellErrorTracker`s read-time-filtrering mod gyldige rækker). Fremmede scopes' nøgler røres aldrig.
 */
export const isCellInvalidDraftRowOrphan = (
  fieldPath: string,
  tableId: string,
  rowScope: string,
  liveRowIds: ReadonlySet<string>
): boolean => {
  const rowId = extractCellRowIdForScope(fieldPath, tableId, rowScope);
  return rowId !== null && !liveRowIds.has(rowId);
};

/**
 * Er denne celle-`fieldPath` forældreløs ift. de aktuelt levende rowScopes (fx ansættelsesforhold)?
 * Sandt netop når nøglens `tableId` er ét af `tableIds`, og dens rowScope ikke længere lever. Bruges til
 * at rydde drafts for et SLETTET scope (fx et fjernet ansættelsesforhold, hvis tabeller er afmonteret —
 * så den per-tabel-baserede række-reconcile aldrig kan nå dem).
 */
export const isCellInvalidDraftScopeOrphan = (
  fieldPath: string,
  tableIds: readonly string[],
  liveRowScopes: ReadonlySet<string>
): boolean => {
  for (const tableId of tableIds) {
    const rowScope = extractCellRowScope(fieldPath, tableId);
    if (rowScope !== null) return !liveRowScopes.has(rowScope);
  }
  return false;
};

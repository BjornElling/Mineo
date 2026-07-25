/**
 * Stabile tabel-id'er og `fieldPath`-konventionen for FOKUSMÅL i grid-celler.
 *
 * En navigerbar rækkefejl (fx fra `EO_ROW_BUILDERS`) skal kunne pege på præcis den celle, fejlen
 * vedrører. Målet udtrykkes som en fuldt kvalificeret `fieldPath`-streng, fordi to tabeller i samme
 * sektion (fx flere ansættelsesforhold på lønindkomst-fanen) ikke nødvendigvis har unikke `rowId`.
 * Stien kvalificeres derfor med et stabilt, app-globalt `tableId` og et valgfrit `rowScope`
 * (typisk et ansættelsesforhold-id).
 *
 * Konvention: `${tableId}:${rowScope}:${rowId}:${colIndex}` (`rowScope` udelades når tom).
 * Hverken `tableId` eller `rowScope` må indeholde `:`, så to forskellige scopes ikke kan
 * konkatenere til samme streng. De nuværende kilder (UUID-agtige af-id'er) er sikre.
 *
 * HISTORIK: modulet hed tidligere `cellInvalidDraftScopes` og understøttede celle-`invalidDrafts`-
 * persistering. Den model er SLETTET (greenfield trin 13, 2026-07-25) — afvist råtekst persisteres
 * nu som `rejectedInputs` i den ene inputenvelope. Tilbage står alene fokus-adresseringen, som
 * modulet nu er navngivet efter. Den slettede model må ikke genindføres.
 */

/**
 * Kanoniske tabel-id'er. Hvert id er unikt på tværs af HELE appen (ikke kun pr. sektion), så det
 * entydigt identificerer én tabel som fokusmål.
 */
export const CELL_TABLE_IDS = {
  aarsloenStandardLoen: 'aarsloen-standardloen',
  eoStandardLoen: 'eo-standardloen',
  eoLoenudvikling: 'eo-loenudvikling',
  eoLoenudviklingManuelProcentsats: 'eo-loenudvikling-manuel-procentsats',
  eoAngivetLoenudvikling: 'eo-angivet-loenudvikling',
  eoAngivetLoenudviklingManuelProcentsats: 'eo-angivet-loenudvikling-manuel-procentsats',
  eoOffentligeYdelser: 'eo-offentlige-ydelser',
  eoOevrigeKrav: 'eo-oevrige-krav',
  eoSvieSmerte: 'eo-svie-smerte',
  eoTafPeriode: 'eo-taf-periode',
  eoFerieperiode: 'eo-ferieperiode',
  eoBeregningsperiodeFerie: 'eo-beregningsperiode-ferie',
  renteBeregnet: 'rente-beregnet',
  eetAslAfgoerelser: 'eet-asl-afgoerelser',
} as const;

/** Byg en fuldt kvalificeret celle-`fieldPath` til brug som fokusmål. `rowScope` udelades når tom. */
export const buildCellFocusFieldPath = (
  tableId: string,
  rowScope: string,
  gridCellKey: string
): string => (rowScope === '' ? `${tableId}:${gridCellKey}` : `${tableId}:${rowScope}:${gridCellKey}`);

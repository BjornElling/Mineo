/**
 * Renteberegnings input-integritet (greenfield draft/commit-design, Fase 7).
 *
 * Oversætter sektionens `invalidDrafts` (afsluttede ugyldige inputs) til scope-bærende
 * `InputBlocker`s, så download-gaten reagerer på den AFSLUTTEDE inputtilstand frem for kun
 * committed canonical værdier (document-output-contract.md §A2.1, renteberegning-contract.md §2):
 *
 *  - `beregningsdato` er et globalt felt → en ugyldig draft blokerer ALLE rente-downloads.
 *  - En rentekrav-celle (`belob`/`renterFra`/`tillaegstid`) er per-række → en ugyldig draft
 *    blokerer kun den rækkes per-række-download (og aggregater der inkluderer rækken).
 *
 * Modulet ejer sine egne dependencies (cellenøgle-konventionen) og genbruger kun det generiske
 * `inputBlocker`-primitiv — der generaliseres ikke en tværdomæne-aggregator.
 */
import { extractCellRowIdForScope, extractCellTableId, CELL_TABLE_IDS } from '../../config/cellInvalidDraftScopes';
import { globalScope, rowScope, type InputBlocker } from '../inputIntegrity/inputBlocker';

/** Brugervendte feltnavne til den centrale besked-skabelon (error-contract.md §3A.2). */
const RENTE_FIELD_LABELS: Readonly<Record<string, string>> = {
  beregningsdato: 'Beregningsdato',
};

const RENTE_CELL_COLUMN_LABELS: Readonly<Record<number, string>> = {
  0: 'Beløb',
  1: 'Renter fra',
  2: 'Tillægstid',
};

const extractCellColIndex = (fieldPath: string): number | undefined => {
  const lastColon = fieldPath.lastIndexOf(':');
  if (lastColon === -1) return undefined;
  const col = Number(fieldPath.slice(lastColon + 1));
  return Number.isInteger(col) ? col : undefined;
};

/**
 * Bygger de scope-bærende blockers for renteberegning ud fra sektionens invalidDrafts.
 * `renteberegning`s celler bruger tom rowScope, så cellenøglen er `rente-beregnet:<rowId>:<col>`.
 */
export const buildRenteInputBlockers = (
  invalidDrafts: Readonly<Record<string, string>>
): readonly InputBlocker[] => {
  const blockers: InputBlocker[] = [];
  for (const fieldPath of Object.keys(invalidDrafts)) {
    // Globalt formfelt (beregningsdato): fieldPath er selve feltnavnet.
    if (fieldPath === 'beregningsdato') {
      blockers.push({
        fieldId: fieldPath,
        fieldLabel: RENTE_FIELD_LABELS[fieldPath] ?? fieldPath,
        reason: 'invalid',
        scope: globalScope(),
        controlKind: 'text',
      });
      continue;
    }

    // Rentekrav-celle: fieldPath er `rente-beregnet:<rowId>:<col>`.
    if (extractCellTableId(fieldPath) === CELL_TABLE_IDS.renteBeregnet) {
      const rowId = extractCellRowIdForScope(fieldPath, CELL_TABLE_IDS.renteBeregnet, '');
      const col = extractCellColIndex(fieldPath);
      if (rowId !== null && col !== undefined && RENTE_CELL_COLUMN_LABELS[col] !== undefined) {
        blockers.push({
          fieldId: fieldPath,
          fieldLabel: RENTE_CELL_COLUMN_LABELS[col],
          reason: 'invalid',
          scope: rowScope(rowId),
          controlKind: 'text',
        });
        continue;
      }
    }

    // En ukendt/malformed persisted feltadresse må ikke gøre input-integritetsgaten fail-open.
    // Scope kan ikke bevises, så hele domænets output blokeres indtil recovery-state er ryddet.
    blockers.push({
      fieldId: fieldPath,
      fieldLabel: 'Renteberegning',
      reason: 'invalid',
      scope: globalScope(),
      controlKind: 'text',
    });
  }
  return blockers;
};

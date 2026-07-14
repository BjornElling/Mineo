import type { StorageKey } from '../config/storageManifest';
import type { InvalidDraftClear } from '../types/invalidDrafts';

type StagedClear = Readonly<{
  section: StorageKey;
  undoFieldPath: string;
  clear: InvalidDraftClear;
}>;

const stagedClears = new Map<string, StagedClear>();
let activeClear: StagedClear | null = null;

const addressKeyOf = (section: StorageKey, fieldPath: string): string =>
  `${section}\u0000${fieldPath}`;

/**
 * Fase-3-bro for grid-pipelinen, hvor celle-blur og sektionspersistence endnu ligger i hver sit lag.
 * Broen bærer den præcise rejected-clear frem til det efterfølgende sektionscommit uden timing eller
 * storage-write. Fase 4 sletter broen, når grid-adapteren udsteder én typed settle-command direkte.
 */
export const stageLegacyGridRejectedClear = (staged: StagedClear): void => {
  stagedClears.set(addressKeyOf(staged.section, staged.clear.fieldPath), staged);
};

export const withActiveLegacyGridRejectedClear = <T>(staged: StagedClear, callback: () => T): T => {
  const previous = activeClear;
  activeClear = staged;
  stageLegacyGridRejectedClear(staged);
  try {
    return callback();
  } finally {
    activeClear = previous;
  }
};

/** Kræver den præcise celle under dens blur-callstack og bærer rydningen ind i den forsinkede rækkepipeline. */
export const claimActiveLegacyGridRejectedClear = (): InvalidDraftClear | undefined => {
  if (activeClear === null) return undefined;
  stagedClears.delete(addressKeyOf(activeClear.section, activeClear.clear.fieldPath));
  return activeClear.clear;
};

export const consumeLegacyGridRejectedClear = (
  section: StorageKey,
  undoFieldPath: string | undefined
): InvalidDraftClear | undefined => {
  if (undoFieldPath === undefined) return undefined;
  if (
    activeClear !== null
    && activeClear.section === section
    && activeClear.undoFieldPath === undoFieldPath
  ) {
    return claimActiveLegacyGridRejectedClear();
  }
  const candidates = [...stagedClears.entries()].filter(([, staged]) =>
    staged.section === section && staged.undoFieldPath === undoFieldPath
  );
  // rowId:colIndex er ikke globalt unikt på tværs af tabeller/scopes. Ved tvetydighed bevares
  // begge rejected inputs fail-closed frem for at rydde den forkerte.
  if (candidates.length !== 1) return undefined;
  stagedClears.delete(candidates[0][0]);
  return candidates[0][1].clear;
};

export const cancelLegacyGridRejectedClear = (
  section: StorageKey,
  fieldPath: string
): void => {
  stagedClears.delete(addressKeyOf(section, fieldPath));
};

export const cancelLegacyGridRejectedClearForAddress = (
  section: StorageKey,
  fieldPath: string
): void => {
  for (const [key, staged] of stagedClears) {
    if (staged.section === section && staged.clear.fieldPath === fieldPath) stagedClears.delete(key);
  }
};

export const __resetLegacyGridTransactionBridgeForTests = (): void => {
  stagedClears.clear();
  activeClear = null;
};

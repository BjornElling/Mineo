import type { SaveSnapshot } from './fileSaveTypes';
import type { StorageKey } from '../config/storageManifest';

const tableSaveOrderRegistry = new Map<string, readonly string[]>();

const hasStringId = (value: unknown): value is { id: string } => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { id?: unknown };
  return typeof candidate.id === 'string';
};

const reorderRowsByIds = <TRow extends { id: string }>(
  rows: readonly TRow[],
  orderedIds: readonly string[]
): TRow[] => {
  if (rows.length <= 1 || orderedIds.length <= 1) return [...rows];

  const rowById = new Map(rows.map((row) => [row.id, row] as const));
  const seen = new Set<string>();
  const reordered: TRow[] = [];

  for (const id of orderedIds) {
    const row = rowById.get(id);
    if (!row || seen.has(id)) continue;
    reordered.push(row);
    seen.add(id);
  }

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    reordered.push(row);
  }

  return reordered;
};

const applyOrderedIdsAtPath = (
  value: unknown,
  pathSegments: readonly string[],
  orderedIds: readonly string[]
): unknown => {
  if (pathSegments.length === 0) {
    if (!Array.isArray(value)) return value;
    if (!value.every(hasStringId)) return value;
    return reorderRowsByIds(value, orderedIds);
  }

  const [head, ...tail] = pathSegments;
  if (Array.isArray(value)) {
    const index = Number.parseInt(head, 10);
    if (!Number.isInteger(index) || index < 0 || index >= value.length) return value;
    const current = value[index];
    const next = applyOrderedIdsAtPath(current, tail, orderedIds);
    if (next === current) return value;
    const cloned = [...value];
    cloned[index] = next;
    return cloned;
  }

  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, head)) return value;

  const current = record[head];
  const next = applyOrderedIdsAtPath(current, tail, orderedIds);
  if (next === current) return value;

  return { ...record, [head]: next };
};

export const registerTableSaveOrder = (path: string, rowIds: readonly string[]): void => {
  tableSaveOrderRegistry.set(path, [...rowIds]);
};

export const unregisterTableSaveOrder = (path: string): void => {
  tableSaveOrderRegistry.delete(path);
};

export const applyRegisteredTableSaveOrder = (snapshot: SaveSnapshot): SaveSnapshot => {
  let nextSnapshot: SaveSnapshot = snapshot;

  for (const [path, orderedIds] of tableSaveOrderRegistry.entries()) {
    const [rootKey, ...rest] = path.split('.');
    if (rest.length === 0) continue;

    const storageKey = rootKey as StorageKey;
    const currentSection = nextSnapshot[storageKey];
    if (currentSection === undefined) continue;

    const nextSection = applyOrderedIdsAtPath(currentSection, rest, orderedIds);
    if (nextSection === currentSection) continue;

    nextSnapshot = {
      ...nextSnapshot,
      [storageKey]: nextSection,
    };
  }

  return nextSnapshot;
};

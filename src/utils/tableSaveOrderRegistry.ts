import type { SaveSnapshot } from './fileSaveTypes';
import { PERSISTED_SECTION_KEYS, type PersistedSectionKey } from '../config/persistenceRegistry';

export type TableSaveOrderPath = `${PersistedSectionKey}.${string}`;

const tableSaveOrderRegistry = new Map<string, readonly string[]>();
const storageKeySet: ReadonlySet<string> = new Set<string>(PERSISTED_SECTION_KEYS);

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

export const isTableSaveOrderPath = (path: string): path is TableSaveOrderPath => {
  const segments = path.split('.');
  const [rootKey] = segments;
  return segments.length >= 2 && segments.every((segment) => segment.trim() !== '') && !!rootKey && storageKeySet.has(rootKey);
};

export const registerTableSaveOrder = (path: TableSaveOrderPath, rowIds: readonly string[]): void => {
  const segments = path.split('.');
  const [rootKey] = segments;
  if (!isTableSaveOrderPath(path)) {
    console.error(`tableSaveOrderRegistry: invalid path "${path}" - must contain non-empty dot-separated segments.`);
    return;
  }
  if (!rootKey || !storageKeySet.has(rootKey)) {
    console.error(`tableSaveOrderRegistry: invalid root key "${rootKey ?? ''}" in path "${path}".`);
    return;
  }
  if (tableSaveOrderRegistry.has(path)) {
    console.error(`tableSaveOrderRegistry: path "${path}" is already registered.`);
  }
  tableSaveOrderRegistry.set(path, [...rowIds]);
};

export const unregisterTableSaveOrder = (path: TableSaveOrderPath): void => {
  tableSaveOrderRegistry.delete(path);
};

export const clearTableSaveOrderRegistryForTests = (): void => {
  tableSaveOrderRegistry.clear();
};

export const applyRegisteredTableSaveOrder = (snapshot: SaveSnapshot): SaveSnapshot => {
  let nextSnapshot: SaveSnapshot = snapshot;

  for (const [path, orderedIds] of tableSaveOrderRegistry.entries()) {
    const [rootKey, ...rest] = path.split('.');
    if (rest.length === 0) {
      console.error(`tableSaveOrderRegistry: invalid registered path "${path}".`);
      continue;
    }

    const storageKey = rootKey as PersistedSectionKey;
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

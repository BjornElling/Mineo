import type { StorageKey } from '../config/storageManifest';

type LegacySanitizationResult = {
  value: unknown;
  changed: boolean;
  warnings: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const toCellString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const isNonEmpty = (value: unknown): boolean => {
  const str = toCellString(value);
  return typeof str === 'string' && str.trim() !== '';
};

const ALLOWED_ROW_KEYS = new Set([
  'id',
  'col0_maaned',
  'col1_maaned',
  'col0_uge',
  'col1_uge',
  'col0_dag',
  'col1_dag',
  'col2',
  'col3',
  'col4',
  'col5',
]);

type TableRowsSanitizationMeta = {
  changed: boolean;
  movedLegacyCol10ToCol5Count: number;
  ignoredLegacyNonEmptyCount: number;
};

const sanitizeLegacyAarsloenTableRows = (
  rows: unknown
): { rows: unknown; meta: TableRowsSanitizationMeta } => {
  const meta: TableRowsSanitizationMeta = {
    changed: false,
    movedLegacyCol10ToCol5Count: 0,
    ignoredLegacyNonEmptyCount: 0,
  };

  if (!Array.isArray(rows)) return { rows, meta };

  const sanitizedRows = rows.map((row, idx) => {
    if (!isRecord(row)) return row;

    const nextRow: Record<string, unknown> = {};

    const idRaw = row.id;
    const id = typeof idRaw === 'string' && idRaw.trim() !== '' ? idRaw : `legacy_row_${idx + 1}`;
    if (id !== idRaw) meta.changed = true;
    nextRow.id = id;

    for (const key of [
      'col0_maaned',
      'col1_maaned',
      'col0_uge',
      'col1_uge',
      'col0_dag',
      'col1_dag',
      'col2',
      'col3',
      'col4',
      'col5',
    ] as const) {
      const v = row[key];
      const asString = toCellString(v);
      if (asString !== undefined) {
        if (asString !== v) meta.changed = true;
        nextRow[key] = asString;
      }
    }

    // Known legacy mapping: allow moving `col10` (old) into `col5` (new: ATP og anden ikke-FB løn) if `col5` is empty.
    // This is a best-effort migration for in-session / sessionStorage state only.
    if ('col10' in row) {
      meta.changed = true;
      const legacyAtp = toCellString(row.col10);
      const currentAtp = toCellString(nextRow.col5);
      const canMove = legacyAtp !== undefined && legacyAtp.trim() !== '' && (!currentAtp || currentAtp.trim() === '');
      if (canMove) {
        nextRow.col5 = legacyAtp;
        meta.movedLegacyCol10ToCol5Count += 1;
      } else if (isNonEmpty(row.col10)) {
        meta.ignoredLegacyNonEmptyCount += 1;
      }
    }

    // Drop any other legacy keys; warn only if they had non-empty values.
    for (const [key, value] of Object.entries(row)) {
      if (ALLOWED_ROW_KEYS.has(key)) continue;
      if (key === 'col10') continue; // handled above
      meta.changed = true;
      if (isNonEmpty(value)) {
        meta.ignoredLegacyNonEmptyCount += 1;
      }
    }

    return nextRow;
  });

  return { rows: sanitizedRows, meta };
};

export const sanitizeLegacyPersistedSectionForAarsloenTables = (
  pageKey: StorageKey,
  value: unknown
): LegacySanitizationResult => {
  if (pageKey === 'aarsloen') {
    if (!isRecord(value)) return { value, changed: false, warnings: [] };
    if (!('tableData' in value)) return { value, changed: false, warnings: [] };

    const { rows, meta } = sanitizeLegacyAarsloenTableRows(value.tableData);
    if (!meta.changed) return { value, changed: false, warnings: [] };

    const next: Record<string, unknown> = { ...value, tableData: rows };
    const warnings: string[] = [];
    if (meta.movedLegacyCol10ToCol5Count > 0) {
      warnings.push(`Årsløn: Flyttede ${meta.movedLegacyCol10ToCol5Count} værdier fra gammel kolonne (col10) til 'ATP og anden ikke-FB løn'.`);
    }
    if (meta.ignoredLegacyNonEmptyCount > 0) {
      warnings.push(`Årsløn: Ignorerede ${meta.ignoredLegacyNonEmptyCount} værdier i udgåede tabelkolonner. Tjek tabellen.`);
    }
    return { value: next, changed: true, warnings };
  }

  if (pageKey === 'erstatningsopgoerelse') {
    if (!isRecord(value)) return { value, changed: false, warnings: [] };

    const rawList = value.loenindkomstAnsaettelsesforhold;
    if (!Array.isArray(rawList)) return { value, changed: false, warnings: [] };

    let anyChanged = false;
    let moved = 0;
    let ignored = 0;
    let migratedLegacyEoLoenSettings = false;

    const legacyFuldLoenUnderFerie = (() => {
      const raw = (value as Record<string, unknown>).fuldLoenUnderFerie;
      return raw === 'Ja' || raw === 'Nej' ? raw : undefined;
    })();

    const legacyLoenPaaHelligdage = (() => {
      const raw = (value as Record<string, unknown>).loenPaaHelligdage;
      return raw === 'Almindelig løn' || raw === 'SH-udbetaling' || raw === 'Ingen' ? raw : undefined;
    })();

    const nextList = rawList.map((item) => {
      if (!isRecord(item)) return item;
      let nextItem: Record<string, unknown> = item;

      if (legacyFuldLoenUnderFerie && !('fuldLoenUnderFerie' in nextItem)) {
        nextItem = { ...nextItem, fuldLoenUnderFerie: legacyFuldLoenUnderFerie };
        migratedLegacyEoLoenSettings = true;
      }

      if (legacyLoenPaaHelligdage && !('loenPaaHelligdage' in nextItem)) {
        nextItem = { ...nextItem, loenPaaHelligdage: legacyLoenPaaHelligdage };
        migratedLegacyEoLoenSettings = true;
      }

      if (!('indtaegtsoplysningerTableData' in nextItem)) return nextItem;

      const { rows, meta } = sanitizeLegacyAarsloenTableRows(nextItem.indtaegtsoplysningerTableData);
      if (!meta.changed) return nextItem;

      anyChanged = true;
      moved += meta.movedLegacyCol10ToCol5Count;
      ignored += meta.ignoredLegacyNonEmptyCount;

      return { ...nextItem, indtaegtsoplysningerTableData: rows };
    });

    const shouldStripLegacyTopLevelKeys = 'fuldLoenUnderFerie' in value || 'loenPaaHelligdage' in value;
    const strippedValue: Record<string, unknown> = (() => {
      if (!shouldStripLegacyTopLevelKeys) return value;
      const next: Record<string, unknown> = { ...value };
      delete next.fuldLoenUnderFerie;
      delete next.loenPaaHelligdage;
      return next;
    })();

    if (!anyChanged && !migratedLegacyEoLoenSettings && !shouldStripLegacyTopLevelKeys) {
      return { value, changed: false, warnings: [] };
    }

    const next: Record<string, unknown> = { ...strippedValue, loenindkomstAnsaettelsesforhold: nextList };
    const warnings: string[] = [];
    if (moved > 0) {
      warnings.push(`Lønindkomst: Flyttede ${moved} værdier fra gammel kolonne (col10) til 'ATP og anden ikke-FB løn'.`);
    }
    if (ignored > 0) {
      warnings.push(`Lønindkomst: Ignorerede ${ignored} værdier i udgåede tabelkolonner. Tjek tabellen.`);
    }
    return { value: next, changed: true, warnings };
  }

  return { value, changed: false, warnings: [] };
};

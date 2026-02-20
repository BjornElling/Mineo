import React from 'react';
import type { ZodIssue } from 'zod';
import { type StorageKey, getStorageKey, getAllMineoKeys } from '../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import type { PersistedData } from '../types/persistence';
import {
  type FieldErrorBySource,
  type FieldErrorsForSection,
  type FormFieldError,
  type FieldErrorSeverity,
  type FieldErrorSource,
  normalizeFieldError,
  resolveActiveFieldError,
} from '../types/fieldErrors';
import { serializeFormValues } from '../utils/serialization';
import { nullToUndefinedDeep, persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import { sanitizeLegacyPersistedSectionForAarsloenTables } from '../utils/aarsloenTableLegacySanitization';
import { countFilledFields } from '../utils/dataCollection';
import { setDevtoolsProviderState } from '../utils/devtoolsMonitor';
import { formPersistenceStore } from '../stores/formPersistenceStore';
 

// Persisted sections are handled via an internal Zustand store; FormPersistenceContext is a facade and not the SoT for committed inputs.

/**
 * FormPersistenceContext
 *
 * Håndterer automatisk persistence af formular-data ved hjælp af sessionStorage.
 * Data bevares når man navigerer mellem sider, men slettes når browseren lukkes.
 *
 * Features:
 * - Type-safe storage keys via manifest
 * - Versionering af data
 */

/**
 * Nuværende data format version
 */
const CURRENT_VERSION = PERSISTED_DATA_VERSION;

/**
 * Type guard for PersistedData wrapper-struktur
 *
 * Validerer at stored data har korrekt format (version, timestamp, data).
 * Beskytter mod korrupt storage data.
 */
function isPersistedData(value: unknown): value is PersistedData {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.version === 'string' &&
    typeof obj.timestamp === 'number' &&
    'data' in obj
  );
}

const formatZodIssues = (issues: ZodIssue[], max: number): string => {
  return issues
    .slice(0, max)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
};

const getFieldCount = (value: unknown): number => {
  return typeof value === 'object' && value !== null ? Object.keys(value).length : 0;
};

const PERSISTENCE_DEBUG_MIN_INTERVAL_MS = 1000;

type FieldErrorUpdateResult =
  | { kind: 'noop' }
  | { kind: 'deleteField' }
  | { kind: 'updateField'; nextForField: FieldErrorBySource };

const applyFieldErrorUpdate = (
  prevForField: FieldErrorBySource,
  source: FieldErrorSource,
  next: FormFieldError | null
): FieldErrorUpdateResult => {
  if (next === null) {
    if (!prevForField[source]) return { kind: 'noop' };
    const updated: FieldErrorBySource = { ...prevForField };
    delete updated[source];
    return Object.keys(updated).length === 0 ? { kind: 'deleteField' } : { kind: 'updateField', nextForField: updated };
  }

  const existing = prevForField[source];
  if (
    existing &&
    existing.message === next.message &&
    existing.severity === next.severity &&
    existing.source === next.source
  ) {
    return { kind: 'noop' };
  }

  return { kind: 'updateField', nextForField: { ...prevForField, [source]: next } };
};

type FormPersistenceContextValue = {
  getPersistedData: <K extends StorageKey>(pageKey: K) => PersistedSectionMap[K] | null;
  persistData: <K extends StorageKey>(pageKey: K, data: PersistedSectionMap[K]) => void;
  clearPageData: (pageKey: StorageKey) => void;
  clearAllData: () => void;
  hasAnyData: () => boolean;
  /**
   * Returns the resolved "active" error per field (1 error max per field).
   *
   * Semantics:
   * - Multiple sources may exist in the underlying store, but this view is flattened via `resolveActiveFieldError`.
   * - Intended for "what is wrong right now?" (UI-parity) and simple diagnostics.
   */
  getFieldErrors: <K extends StorageKey>(
    pageKey: K
  ) => Partial<Record<Extract<keyof PersistedSectionMap[K], string>, FormFieldError>>;
  /**
   * Returns all errors per field, separated by `source`.
   *
   * Intended for debug/diagnostics when you need to know *where* an error came from.
   */
  getFieldErrorsBySource: <K extends StorageKey>(pageKey: K) => FieldErrorsForSection<K>;
  /**
   * Returns the resolved "active" error for a single field.
   */
  getFieldError: <K extends StorageKey>(
    pageKey: K,
    fieldName: Extract<keyof PersistedSectionMap[K], string>
  ) => FormFieldError | undefined;
  /**
   * Sets or clears a field error for one specific `(pageKey, fieldName, source)` tuple.
   *
   * Invariants:
   * - Errors are runtime-only and never persisted.
   * - Producers own their source and must only clear their own source (never other sources).
   * - Empty/whitespace messages are treated as "no error" and will clear the source.
   */
  setFieldError: <K extends StorageKey>(
    pageKey: K,
    fieldName: Extract<keyof PersistedSectionMap[K], string>,
    source: FieldErrorSource,
    error: { message: string; severity: FieldErrorSeverity } | null
  ) => void;
  clearFieldErrors: (pageKey: StorageKey) => void;
  clearAllFieldErrors: () => void;
  /**
   * Runtime-only input error flags for manuel regulering (per ansættelsesforhold).
   *
   * NOTE: These are NOT persisted and must be cleared on authoritative state replacement.
   */
  getLoenindkomstManuelReguleringInputErrors: () => Readonly<Record<string, true>>;
  setLoenindkomstManuelReguleringInputError: (ansaettelsesforholdId: string, hasError: boolean) => void;
  clearLoenindkomstManuelReguleringInputErrors: () => void;
  /**
   * Runtime-only field errors.
   *
   * Architectural invariants:
   * - Errors are NOT persisted to `.eo` files or sessionStorage.
   * - Errors are owned by their producer (input/schema/rule) and must be cleared explicitly by that producer.
   * - Multiple errors can exist for the same field (separated by `source`); UI uses a deterministic resolver.
   * - All errors are cleared on authoritative state replacement (reset/load/migration) to prevent stale debug output.
   */
  /**
   * Bumpes når sessionStorage er blevet erstattet autoritativt (fx file-load).
   * Bruges til at få `usePersistedForm` hooks til at re-hydrate uden `window.location.reload()`.
   */
  authoritativeSnapshotEpoch: number;
  /**
   * Monotone revision counters for committed input mutations.
   *
   * INVARIANT: Any mutation of EO input MUST bump debugRevision.
   */
  getSectionRevision: (pageKey: StorageKey) => number;
  /**
   * Monotone revision counters for field error mutations.
   *
   * INVARIANT: Any mutation of EO input-related errors MUST bump debugRevision.
   */
  getFieldErrorRevision: (pageKey: StorageKey) => number;
  /**
   * Erstatter ALLE persisterede Mineo-sektioner atomisk.
   * Semantik: keys der ikke er med i snapshot slettes.
   */
  replaceAllPersistedData: (snapshot: Record<StorageKey, unknown | undefined>) => void;
  /**
   * Seneste brugerrettede persistence-besked (fx versionsmismatch/korruption).
   */
  lastNotice: { message: string; type: 'warning' | 'error' } | null;
  lastNoticeEpoch: number;
};

const FormPersistenceContext = React.createContext<FormPersistenceContextValue | null>(null);

type PersistedCache = { [K in StorageKey]: PersistedSectionMap[K] | null };
type FieldErrorCache = { [K in StorageKey]: FieldErrorsForSection<K> };

const assignCacheValue = (target: PersistedCache, key: StorageKey, value: unknown | null): void => {
  // Safe because `value` is always produced by the schema for `key` (or null for cleared).
  (target as unknown as Record<StorageKey, unknown | null>)[key] = value;
};

/**
 * Provider komponent der wrapper hele applikationen
 */
export const FormPersistenceProvider = ({ children }: { children: React.ReactNode }) => {
  const [authoritativeSnapshotEpoch, bumpAuthoritativeSnapshotEpoch] = React.useReducer((v: number) => v + 1, 0);
  const initialStamdataRef = React.useRef<PersistedSectionMap['stamdata'] | null>(null);
  const initialAarsloenRef = React.useRef<PersistedSectionMap['aarsloen'] | null>(null);
  const initialSatserRef = React.useRef<PersistedSectionMap['satser'] | null>(null);
  const initialRenteberegningRef = React.useRef<PersistedSectionMap['renteberegning'] | null>(null);
  const initialVarigemenRef = React.useRef<PersistedSectionMap['varigemen'] | null>(null);
  const initialErstatningsopgoerelseRef = React.useRef<PersistedSectionMap['erstatningsopgoerelse'] | null>(null);
  const legacySanitizationNotifiedRef = React.useRef<Set<StorageKey>>(new Set());
  const debugSaveStateRef = React.useRef<Map<string, { lastLogAt: number; pendingCount: number; lastFieldCount: number }>>(
    new Map()
  );
  const createEmptyCache = React.useCallback((): PersistedCache => {
    return Object.keys(persistenceSchemas).reduce((acc, key) => {
      acc[key as StorageKey] = null;
      return acc;
    }, {} as PersistedCache);
  }, []);

  const createEmptyFieldErrorCache = React.useCallback((): FieldErrorCache => {
    return Object.keys(persistenceSchemas).reduce((acc, key) => {
      (acc as Record<StorageKey, FieldErrorsForSection<StorageKey>>)[key as StorageKey] = {};
      return acc;
    }, {} as FieldErrorCache);
  }, []);

  const initPlanRef = React.useRef<{
    keysToRemove: string[];
    shouldGlobalClear: boolean;
    notice: { message: string; type: 'warning' | 'error' } | null;
  } | null>(null);

  const [cache, setCache] = React.useState<PersistedCache>(() => {
    const nextCache = createEmptyCache();
    const keysToRemove: string[] = [];
    let shouldGlobalClear = false;
    let notice: { message: string; type: 'warning' | 'error' } | null = null;

    const validateAndAssign = <K extends StorageKey>(pageKey: K, rawData: unknown): void => {
      const schema = persistenceSchemas[pageKey];
      const normalized = nullToUndefinedDeep(rawData);
      const sanitized = sanitizeLegacyPersistedSectionForAarsloenTables(pageKey, normalized);
      const validated = schema.safeParse(sanitized.value);
      if (!validated.success) {
        keysToRemove.push(getStorageKey(pageKey));
        notice ??= { message: `Gemte data for '${pageKey}' matcher ikke denne versions schema og er ryddet.`, type: 'error' };
        return;
      }
      if (sanitized.changed && sanitized.warnings.length > 0) {
        notice ??= { message: sanitized.warnings.slice(0, 2).join('\n'), type: 'warning' };
      }
      assignCacheValue(nextCache, pageKey, validated.data);
    };

    for (const pageKey of Object.keys(persistenceSchemas) as StorageKey[]) {
      const storageKey = getStorageKey(pageKey);
      const stored = sessionStorage.getItem(storageKey);
      if (!stored) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(stored);
      } catch {
        keysToRemove.push(storageKey);
        notice ??= { message: `Gemte data for '${pageKey}' var korrupte og er ryddet.`, type: 'error' };
        continue;
      }

      if (!isPersistedData(parsed)) {
        keysToRemove.push(storageKey);
        notice ??= { message: `Gemte data for '${pageKey}' var korrupte og er ryddet.`, type: 'error' };
        continue;
      }

      if (parsed.version !== CURRENT_VERSION) {
        // Design choice (trust-critical): hard-fail ved mismatch og ryd ALT persisted data.
        shouldGlobalClear = true;
        notice ??= {
          message: `Gemte data er fra en anden version (${parsed.version} ≠ ${CURRENT_VERSION}) og er ryddet.`,
          type: 'error',
        };
        break;
      }

      validateAndAssign(pageKey, parsed.data);
    }

    initialStamdataRef.current = shouldGlobalClear ? null : (nextCache.stamdata ?? null);
    initialAarsloenRef.current = shouldGlobalClear ? null : (nextCache.aarsloen ?? null);
    initialSatserRef.current = shouldGlobalClear ? null : (nextCache.satser ?? null);
    initialRenteberegningRef.current = shouldGlobalClear ? null : (nextCache.renteberegning ?? null);
    initialVarigemenRef.current = shouldGlobalClear ? null : (nextCache.varigemen ?? null);
    initialErstatningsopgoerelseRef.current = shouldGlobalClear ? null : (nextCache.erstatningsopgoerelse ?? null);
    initPlanRef.current = { keysToRemove, shouldGlobalClear, notice };
    return shouldGlobalClear ? createEmptyCache() : nextCache;
  });

  const [fieldErrors, setFieldErrors] = React.useState<FieldErrorCache>(() => createEmptyFieldErrorCache());
  const [manuelReguleringInputErrors, setManuelReguleringInputErrors] = React.useState<Record<string, true>>({});
  const [sectionRevisions, setSectionRevisions] = React.useState<Record<StorageKey, number>>(() => {
    return Object.keys(persistenceSchemas).reduce((acc, key) => {
      acc[key as StorageKey] = 0;
      return acc;
    }, {} as Record<StorageKey, number>);
  });
  const [fieldErrorRevisions, setFieldErrorRevisions] = React.useState<Record<StorageKey, number>>(() => {
    return Object.keys(persistenceSchemas).reduce((acc, key) => {
      acc[key as StorageKey] = 0;
      return acc;
    }, {} as Record<StorageKey, number>);
  });

  const [noticeState, setNoticeState] = React.useState<{ epoch: number; notice: { message: string; type: 'warning' | 'error' } | null }>(() => ({
    epoch: 0,
    notice: initPlanRef.current?.notice ?? null,
  }));

  const cacheRef = React.useRef(cache);
  React.useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  React.useEffect(() => {
    const store = formPersistenceStore.getState();
    store.hydrate(
      {
        stamdata: initialStamdataRef.current ?? null,
        aarsloen: initialAarsloenRef.current ?? null,
        satser: initialSatserRef.current ?? null,
        renteberegning: initialRenteberegningRef.current ?? null,
        varigemen: initialVarigemenRef.current ?? null,
        erstatningsopgoerelse: initialErstatningsopgoerelseRef.current ?? null,
      },
      { hydrated: true, schemaFingerprint: CURRENT_VERSION }
    );
  }, []);

  React.useEffect(() => {
    const plan = initPlanRef.current;
    if (!plan) return;

    if (plan.shouldGlobalClear) {
      const keys = getAllMineoKeys();
      keys.forEach((key) => sessionStorage.removeItem(key));
      return;
    }

    for (const key of plan.keysToRemove) {
      sessionStorage.removeItem(key);
    }
  }, []);

  React.useEffect(() => {
    setDevtoolsProviderState('FormPersistenceProvider', true);
    return () => {
      setDevtoolsProviderState('FormPersistenceProvider', false);
    };
  }, []);

  React.useEffect(() => {
    const debugSaveState = debugSaveStateRef.current;
    return () => {
      if (!import.meta.env.DEV) return;
      for (const [storageKey, entry] of debugSaveState.entries()) {
        if (entry.pendingCount > 0) {
          console.debug(`[Persistence] Saved: ${storageKey} (x${entry.pendingCount})`, {
            fieldCount: entry.lastFieldCount,
          });
        }
      }
    };
  }, []);

  const emitUserNotice = React.useCallback((message: string, type: 'warning' | 'error' = 'warning') => {
    setNoticeState((prev) => ({ epoch: prev.epoch + 1, notice: { message, type } }));
  }, []);

  const logPersistSaveDebug = React.useCallback((storageKey: string, fieldCount: number) => {
    if (!import.meta.env.DEV) return;

    const now = Date.now();
    const existing = debugSaveStateRef.current.get(storageKey);
    const entry = existing ?? { lastLogAt: 0, pendingCount: 0, lastFieldCount: fieldCount };

    entry.pendingCount += 1;
    entry.lastFieldCount = fieldCount;

    if (now - entry.lastLogAt >= PERSISTENCE_DEBUG_MIN_INTERVAL_MS) {
      const suffix = entry.pendingCount > 1 ? ` (x${entry.pendingCount})` : '';
      console.debug(`[Persistence] Saved: ${storageKey}${suffix}`, { fieldCount: entry.lastFieldCount });
      entry.pendingCount = 0;
      entry.lastLogAt = now;
    }

    debugSaveStateRef.current.set(storageKey, entry);
  }, []);

  /**
   * Læs schema-valideret persisted data (ingen side-effects).
   */
  const setCacheForKey = React.useCallback((pageKey: StorageKey, value: PersistedSectionMap[StorageKey] | null) => {
    setCache((prev) => {
      const next = { ...prev };
      assignCacheValue(next, pageKey, value);
      return next;
    });
  }, []);

  const syncSection = React.useCallback((pageKey: StorageKey, next: PersistedSectionMap[StorageKey] | null) => {
    formPersistenceStore.getState().commitSection(pageKey, next as PersistedSectionMap[StorageKey] | null, {
      schemaFingerprint: CURRENT_VERSION,
    });
    setCacheForKey(pageKey, next);
  }, [setCacheForKey]);

  const getPersistedData = React.useCallback(<K extends StorageKey>(pageKey: K): PersistedSectionMap[K] | null => {
    const value = cache[pageKey];
    return value;
  }, [cache]);

  const hasAnyData = React.useCallback((): boolean => {
    return countFilledFields(cacheRef.current) > 0;
  }, []);

  /**
   * Gem data i sessionStorage med versionering
   *
   * Wrapper data i PersistedData struktur med version og timestamp.
   */
  const persistData = React.useCallback(<K extends StorageKey>(pageKey: K, data: PersistedSectionMap[K]) => {
    try {
      const storageKey = getStorageKey(pageKey);

      // Defensive runtime check: should never happen because persistenceSchemas is keyed by StorageKey,
      // but protects against hot-reload / partial module state during development.
      if (!Object.prototype.hasOwnProperty.call(persistenceSchemas, pageKey)) {
        console.error(`[Persistence] Missing schema for '${pageKey}'. Cannot persist data.`, { pageKey });
        emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern konfigurationsfejl.`, 'error');
        return;
      }

      const schema = persistenceSchemas[pageKey];
      const normalized = nullToUndefinedDeep(data);
      const sanitized = sanitizeLegacyPersistedSectionForAarsloenTables(pageKey, normalized);
      const validated = schema.safeParse(sanitized.value);
      if (!validated.success) {
        const issues = formatZodIssues(validated.error.issues, 3);
        console.error(`[Persistence] Schema mismatch for '${pageKey}':\n${issues}`, {
          pageKey,
          issues: validated.error.issues,
        });
        emitUserNotice(
          `Kunne ikke gemme data for '${pageKey}' fordi data ikke matcher schema.\n${issues}`,
          'error'
        );
        return;
      }
      if (sanitized.changed && sanitized.warnings.length > 0 && !legacySanitizationNotifiedRef.current.has(pageKey)) {
        legacySanitizationNotifiedRef.current.add(pageKey);
        emitUserNotice(sanitized.warnings.slice(0, 2).join('\n'), 'warning');
      }

      const persistedSectionData = serializeFormValues(validated.data);
      // Trust-critical invariant: cache must match the post-serialization representation (reload-equivalent).
      const postSerializeValidated = schema.safeParse(nullToUndefinedDeep(persistedSectionData));
      if (!postSerializeValidated.success) {
        emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern serialiseringsfejl.`, 'error');
        return;
      }

      const persistedData: PersistedData = {
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        data: persistedSectionData,
      };

      sessionStorage.setItem(storageKey, JSON.stringify(persistedData));
      // Safe: pageKey determines schema/data shape.
      syncSection(pageKey, postSerializeValidated.data as PersistedSectionMap[StorageKey]);
      setSectionRevisions((prev) => {
        const next = { ...prev };
        next[pageKey] = (prev[pageKey] ?? 0) + 1;
        return next;
      });
      logPersistSaveDebug(storageKey, getFieldCount(data));
    } catch (error) {
      console.error(`[Persistence] Fejl ved gemning af data for '${pageKey}':`, {
        pageKey,
        fieldCount: getFieldCount(data),
        error,
      });
      emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern fejl.`, 'error');
    }
  }, [emitUserNotice, logPersistSaveDebug, setCacheForKey, syncSection]);

  const replaceAllPersistedData = React.useCallback((snapshot: Record<StorageKey, unknown | undefined>) => {
    const prevCache = cacheRef.current;
    for (const key of Object.keys(persistenceSchemas) as StorageKey[]) {
      if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
        throw new Error(`Snapshot mangler key '${key}'. Snapshot skal indeholde alle keys (brug undefined for at slette).`);
      }
    }

    const keysToReplace = getAllMineoKeys();
    const backup = new Map<string, string | null>();
    for (const key of keysToReplace) {
      backup.set(key, sessionStorage.getItem(key));
    }

    const now = Date.now();
    const toWrite: Array<{ storageKey: string; value: string }> = [];
    const nextCache = Object.keys(persistenceSchemas).reduce((acc, k) => {
      acc[k as StorageKey] = null;
      return acc;
    }, {} as PersistedCache);

    for (const pageKey of Object.keys(persistenceSchemas) as StorageKey[]) {
      const raw = snapshot[pageKey];
      if (raw === undefined) continue;

      const schema = persistenceSchemas[pageKey];
      const normalized = nullToUndefinedDeep(raw);
      const sanitized = sanitizeLegacyPersistedSectionForAarsloenTables(pageKey, normalized);
      const validated = schema.safeParse(sanitized.value);
      if (!validated.success) {
        const issues = formatZodIssues(validated.error.issues, 2);
        throw new Error(`Kan ikke anvende snapshot: '${pageKey}' matcher ikke schema.\n${issues}`);
      }
      if (sanitized.changed && sanitized.warnings.length > 0 && !legacySanitizationNotifiedRef.current.has(pageKey)) {
        legacySanitizationNotifiedRef.current.add(pageKey);
        emitUserNotice(sanitized.warnings.slice(0, 2).join('\n'), 'warning');
      }

      const persistedSectionData = serializeFormValues(validated.data);
      const postSerializeValidated = schema.safeParse(nullToUndefinedDeep(persistedSectionData));
      if (!postSerializeValidated.success) {
        const issues = formatZodIssues(postSerializeValidated.error.issues, 2);
        throw new Error(`Kan ikke anvende snapshot: '${pageKey}' fejler efter serialisering.\n${issues}`);
      }
      const persistedData: PersistedData = {
        version: CURRENT_VERSION,
        timestamp: now,
        data: persistedSectionData,
      };
      toWrite.push({ storageKey: getStorageKey(pageKey), value: JSON.stringify(persistedData) });
      assignCacheValue(nextCache, pageKey, postSerializeValidated.data);
    }

    try {
      for (const key of keysToReplace) {
        sessionStorage.removeItem(key);
      }
      for (const { storageKey, value } of toWrite) {
        sessionStorage.setItem(storageKey, value);
      }
      setCache(nextCache);
      formPersistenceStore.getState().replaceSections(
        nextCache,
        { hydrated: true, schemaFingerprint: CURRENT_VERSION, lastCommittedAt: Date.now() }
      );
      setFieldErrors(createEmptyFieldErrorCache());
      setManuelReguleringInputErrors({});
      setSectionRevisions((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(persistenceSchemas) as StorageKey[]) {
          next[key] = (prev[key] ?? 0) + 1;
        }
        return next;
      });
      setFieldErrorRevisions((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(persistenceSchemas) as StorageKey[]) {
          next[key] = (prev[key] ?? 0) + 1;
        }
        return next;
      });
      bumpAuthoritativeSnapshotEpoch();
    } catch (error) {
      for (const { storageKey } of toWrite) {
        sessionStorage.removeItem(storageKey);
      }
      for (const [key, value] of backup.entries()) {
        if (value === null || value === undefined) {
          sessionStorage.removeItem(key);
        } else {
          sessionStorage.setItem(key, value);
        }
      }
      // Keep cache consistent with rolled back storage (future-proof if this becomes async/refactored).
      setCache(prevCache);
      formPersistenceStore.getState().replaceSections(
        prevCache,
        { hydrated: true, schemaFingerprint: CURRENT_VERSION, lastCommittedAt: Date.now() }
      );
      const message = error instanceof Error ? error.message : 'Ukendt fejl';
      throw new Error(`Kunne ikke anvende snapshot atomisk: ${message}`);
    }
  }, [
    createEmptyFieldErrorCache,
    emitUserNotice,
  ]);

  /**
   * Slet data for en specifik side
   */
  const clearPageData = React.useCallback((pageKey: StorageKey) => {
    try {
      const storageKey = getStorageKey(pageKey);
      sessionStorage.removeItem(storageKey);
      syncSection(pageKey, null);
      setFieldErrors((prev) => ({ ...prev, [pageKey]: {} }));
      if (pageKey === 'erstatningsopgoerelse') {
        setManuelReguleringInputErrors({});
      }
      setSectionRevisions((prev) => {
        const next = { ...prev };
        next[pageKey] = (prev[pageKey] ?? 0) + 1;
        return next;
      });
      setFieldErrorRevisions((prev) => {
        const next = { ...prev };
        next[pageKey] = (prev[pageKey] ?? 0) + 1;
        return next;
      });
    } catch (error) {
      console.error(`[Persistence] Fejl ved sletning af data for '${pageKey}':`, error);
    }
  }, [setCacheForKey, syncSection]);

  /**
   * Slet alle gemte MINEO data
   *
   * Bruger manifest til kun at slette kendte keys.
   */
  const clearAllData = React.useCallback(() => {
    try {
      const mineoKeys = getAllMineoKeys();
      mineoKeys.forEach(key => {
        sessionStorage.removeItem(key);
      });
      const emptyCache = Object.keys(persistenceSchemas).reduce((acc, k) => {
        acc[k as StorageKey] = null;
        return acc;
      }, {} as PersistedCache);
      setCache(emptyCache);
      formPersistenceStore.getState().clearAll({ hydrated: true, schemaFingerprint: CURRENT_VERSION, lastCommittedAt: Date.now() });
      setFieldErrors(createEmptyFieldErrorCache());
      setManuelReguleringInputErrors({});
      setSectionRevisions((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(persistenceSchemas) as StorageKey[]) {
          next[key] = (prev[key] ?? 0) + 1;
        }
        return next;
      });
      setFieldErrorRevisions((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(persistenceSchemas) as StorageKey[]) {
          next[key] = (prev[key] ?? 0) + 1;
        }
        return next;
      });
      bumpAuthoritativeSnapshotEpoch();
      if (import.meta.env.DEV) {
        console.debug('[Persistence] Cleared all persisted data', { keyCount: mineoKeys.length });
      }
    } catch (error) {
      console.error('[Persistence] Fejl ved sletning af alle data:', error);
    }
  }, [createEmptyFieldErrorCache]);

  const getFieldErrorsBySource = React.useCallback(<K extends StorageKey,>(pageKey: K) => {
    return fieldErrors[pageKey] as FieldErrorsForSection<K>;
  }, [fieldErrors]);

  const getFieldErrors = React.useCallback(<K extends StorageKey,>(pageKey: K) => {
    const bySource = fieldErrors[pageKey] as FieldErrorsForSection<K>;
    const resolved: Partial<Record<Extract<keyof PersistedSectionMap[K], string>, FormFieldError>> = {};

    for (const fieldName of Object.keys(bySource) as Array<Extract<keyof PersistedSectionMap[K], string>>) {
      const fieldErrorsBySource = bySource[fieldName] as FieldErrorBySource | undefined;
      if (!fieldErrorsBySource) continue;
      const active = resolveActiveFieldError(fieldErrorsBySource);
      if (!active) continue;
      resolved[fieldName] = active;
    }

    return resolved;
  }, [fieldErrors]);

  const getFieldError = React.useCallback(<K extends StorageKey,>(
    pageKey: K,
    fieldName: Extract<keyof PersistedSectionMap[K], string>
  ): FormFieldError | undefined => {
    const bySource = fieldErrors[pageKey] as FieldErrorsForSection<K>;
    const forField = bySource[fieldName] as FieldErrorBySource | undefined;
    if (!forField) return undefined;
    return resolveActiveFieldError(forField);
  }, [fieldErrors]);

  const setFieldError = React.useCallback(<K extends StorageKey,>(
    pageKey: K,
    fieldName: Extract<keyof PersistedSectionMap[K], string>,
    source: FieldErrorSource,
    error: { message: string; severity: FieldErrorSeverity } | null
  ) => {
    setFieldErrors((prev) => {
      const prevForPage = prev[pageKey] as FieldErrorsForSection<K>;
      const prevForField = (prevForPage[fieldName] ?? {}) as FieldErrorBySource;
      const nextForPage: FieldErrorsForSection<K> = { ...prevForPage };

      const normalized =
        error === null ? null : normalizeFieldError({ message: error.message, severity: error.severity, source });

      const update = applyFieldErrorUpdate(prevForField, source, normalized);
      if (update.kind === 'noop') return prev;
      if (update.kind === 'deleteField') {
        delete nextForPage[fieldName];
      } else {
        nextForPage[fieldName] = update.nextForField as FieldErrorsForSection<K>[typeof fieldName];
      }
      setFieldErrorRevisions((revPrev) => {
        const next = { ...revPrev };
        next[pageKey] = (revPrev[pageKey] ?? 0) + 1;
        return next;
      });
      return { ...prev, [pageKey]: nextForPage } as FieldErrorCache;
    });
  }, []);

  const clearFieldErrors = React.useCallback((pageKey: StorageKey) => {
    setFieldErrors((prev) => ({ ...prev, [pageKey]: {} }));
    if (pageKey === 'erstatningsopgoerelse') {
      setManuelReguleringInputErrors({});
    }
    setFieldErrorRevisions((prev) => {
      const next = { ...prev };
      next[pageKey] = (prev[pageKey] ?? 0) + 1;
      return next;
    });
  }, []);

  const clearAllFieldErrors = React.useCallback(() => {
    setFieldErrors(createEmptyFieldErrorCache());
    setManuelReguleringInputErrors({});
    setFieldErrorRevisions((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(persistenceSchemas) as StorageKey[]) {
        next[key] = (prev[key] ?? 0) + 1;
      }
      return next;
    });
  }, [createEmptyFieldErrorCache]);

  const getSectionRevision = React.useCallback((pageKey: StorageKey) => {
    return sectionRevisions[pageKey] ?? 0;
  }, [sectionRevisions]);

  const getFieldErrorRevision = React.useCallback((pageKey: StorageKey) => {
    return fieldErrorRevisions[pageKey] ?? 0;
  }, [fieldErrorRevisions]);

  const getLoenindkomstManuelReguleringInputErrors = React.useCallback(() => {
    return manuelReguleringInputErrors;
  }, [manuelReguleringInputErrors]);

  const setLoenindkomstManuelReguleringInputError = React.useCallback(
    (ansaettelsesforholdId: string, hasError: boolean) => {
      setManuelReguleringInputErrors((prev) => {
        const nextHasError = Boolean(hasError);
        const prevHasError = Boolean(prev[ansaettelsesforholdId]);
        if (prevHasError === nextHasError) return prev;
        const next = { ...prev };
        if (nextHasError) {
          next[ansaettelsesforholdId] = true;
        } else {
          delete next[ansaettelsesforholdId];
        }
        return next;
      });
    },
    []
  );

  const clearLoenindkomstManuelReguleringInputErrors = React.useCallback(() => {
    setManuelReguleringInputErrors({});
  }, []);

  const value = React.useMemo(
    () => ({
      getPersistedData,
      persistData,
      clearPageData,
      clearAllData,
      hasAnyData,
      getFieldErrors,
      getFieldErrorsBySource,
      getFieldError,
      setFieldError,
      clearFieldErrors,
      clearAllFieldErrors,
      getLoenindkomstManuelReguleringInputErrors,
      setLoenindkomstManuelReguleringInputError,
      clearLoenindkomstManuelReguleringInputErrors,
      authoritativeSnapshotEpoch,
      getSectionRevision,
      getFieldErrorRevision,
      replaceAllPersistedData,
      lastNotice: noticeState.notice,
      lastNoticeEpoch: noticeState.epoch,
    }),
    [
      getPersistedData,
      persistData,
      clearPageData,
      clearAllData,
      hasAnyData,
      getFieldErrors,
      getFieldErrorsBySource,
      getFieldError,
      setFieldError,
      clearFieldErrors,
      clearAllFieldErrors,
      getLoenindkomstManuelReguleringInputErrors,
      setLoenindkomstManuelReguleringInputError,
      clearLoenindkomstManuelReguleringInputErrors,
      authoritativeSnapshotEpoch,
      getSectionRevision,
      getFieldErrorRevision,
      replaceAllPersistedData,
      noticeState,
    ]
  );

  return (
    <FormPersistenceContext.Provider value={value}>
      {children}
    </FormPersistenceContext.Provider>
  );
};

/**
 * Custom hook til at bruge FormPersistenceContext
 *
 * @throws {Error} Hvis context ikke er tilgængelig (komponenten skal wrappes i FormPersistenceProvider)
 */
export const useFormPersistence = (): FormPersistenceContextValue => {
  const context = React.useContext(FormPersistenceContext);
  if (!context) {
    const errorMessage = 'FormPersistenceContext ikke tilgængelig. Sørg for at komponenten er wrapped i FormPersistenceProvider.';
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  return context;
};

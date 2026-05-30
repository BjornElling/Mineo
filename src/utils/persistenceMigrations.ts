import type { StorageKey } from '../config/storageManifest';
import { nullToUndefinedDeep } from './nullToUndefinedDeep';

export type PersistenceMigrationIssue = {
  path: string;
  reason: string;
};

export type PersistenceMigrationResult = {
  value: unknown;
  issues: PersistenceMigrationIssue[];
};

/**
 * Eksplicit migrator-dispatcher pr. persisted sektion.
 *
 * Kontrakt-rækkefølge (schema-evolution.md §3.1a): nullToUndefinedDeep → migrator →
 * stripUnknownFieldsBySchema → schema.safeParse. Vi anvender derfor `nullToUndefinedDeep`
 * her, FØR en eventuel sektion-migrator kører, så fremtidige migratorer altid får
 * input på den kontrakt-lovede normaliserede form — uanset om kalderen (fil-load vs.
 * session-hydrering) selv har normaliseret. Dette gør de to load-stier konsistente.
 *
 * Migratorer må kun mappe KENDTE gamle strukturer til current struktur; de må ikke gætte
 * domæneværdier. Dispatcheren er et extension point, ikke en generel bagudkompat-forpligtelse.
 */
export const migratePersistedSectionValue = (_pageKey: StorageKey, value: unknown): PersistenceMigrationResult => {
  const normalized = nullToUndefinedDeep(value);
  // _pageKey er reserveret til den første eksplicitte switch/map-baserede migrator.
  // Registrér fremtidige sektion-migratorer her, så .eo-load og session-hydrering deler samme sti.
  return { value: normalized, issues: [] };
};

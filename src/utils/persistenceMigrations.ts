import type { PersistedSectionKey } from '../config/persistenceRegistry';
import { LEGACY_PERSISTED_DATA_VERSION, PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { nullToUndefinedDeep } from './nullToUndefinedDeep';

export type PersistenceMigrationResult = {
  value: unknown;
};

type PersistenceMigrationStep = Readonly<{
  toVersion: typeof PERSISTED_DATA_VERSION;
  migrate: (value: unknown) => PersistenceMigrationResult;
}>;

export type PersistenceMigrationRegistry = Readonly<Partial<Record<
  PersistedSectionKey,
  Readonly<Record<string, PersistenceMigrationStep>>
>>>;

type PersistedSectionMigrator = (
  pageKey: PersistedSectionKey,
  value: unknown,
  sourceVersion: string
) => PersistenceMigrationResult;

/**
 * Bygger en versionsbåret sektionsmigrator. Hver entry beskriver én entydig
 * `fromVersion -> current`-overgang; ukendte versioner forbliver urørte og går
 * videre til validering mod det aktuelle schema.
 */
export const createPersistenceMigrator = (
  registry: PersistenceMigrationRegistry
): PersistedSectionMigrator => (pageKey, value, sourceVersion) => {
  const normalized = nullToUndefinedDeep(value);
  const step = registry[pageKey]?.[sourceVersion];
  if (!step) return { value: normalized };
  // Gør `toVersion` load-bearing: en entry hvis mål ikke er den aktuelle version er en
  // fejlkonfigureret migration (kun single-hop `fromVersion -> current` er tilladt). Stop
  // fail-closed; inputtet må ikke fortsætte som en tavs identity-migration.
  if (step.toVersion !== PERSISTED_DATA_VERSION) {
    throw new Error(
      `Migration for '${pageKey}' fra version ${sourceVersion} har toVersion ${step.toVersion}, ` +
      `forventet ${PERSISTED_DATA_VERSION}.`
    );
  }
  return step.migrate(normalized);
};

/**
 * Fjerner det afledte `storeBededagPct`-slot fra hvert persisteret ansættelsesforhold.
 *
 * Satsen er en funktion af dato og "Løn på helligdage" og udledes af reader-projektionen før første
 * consumer-read. Ældre `.eo`-filer bærer den materialiserede værdi. Den fjernes HER — i migratoren — og
 * ikke som et strippet ukendt felt, fordi et strip rapporteres til brugeren som tabt indtastning. Værdien
 * går ikke tabt: den genudledes. Migratoren rører kun det kendte slot og gætter ingen domæneværdier.
 */
const stripDerivedStoreBededagPct = (value: unknown): PersistenceMigrationResult => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { value };
  const section = value as Record<string, unknown>;
  const employments = section.loenindkomstAnsaettelsesforhold;
  if (!Array.isArray(employments)) return { value };
  return {
    value: {
      ...section,
      loenindkomstAnsaettelsesforhold: employments.map((employment) => {
        if (employment === null || typeof employment !== 'object' || Array.isArray(employment)) {
          return employment;
        }
        const { storeBededagPct: _derived, ...rest } = employment as Record<string, unknown>;
        return rest;
      }),
    },
  };
};

/**
 * Kildeversionerne der bar det materialiserede `storeBededagPct`-slot: hver udgivet version til og med
 * 3.10 plus de uversionerede filer fra før containeren bar `persistedDataVersion`.
 *
 * Listen er EKSPLICIT, fordi `schema-evolution.md` §3.1a kræver et eksakt `fromVersion -> current`-opslag
 * og forbyder gæt ud fra shape eller versionsrækkefølge. En ukendt kildeversion får derfor identity —
 * slottet fjernes da af `stripUnknownFieldsBySchema` og rapporteres i preflight. Det er den tilsigtede
 * fail-safe: filen indlæses fuldt ud, og kun tabsformuleringen er konservativ.
 */
const STORE_BEDEDAG_SLOT_SOURCE_VERSIONS: readonly string[] = [
  LEGACY_PERSISTED_DATA_VERSION,
  '3.0', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9', '3.10',
];

// Registrér kun konkrete, kendte schema-overgange. Et versionsmismatch uden en
// entry valideres fortsat mod det aktuelle schema; shape-gæt er bevidst forbudt.
const PERSISTENCE_MIGRATIONS = {
  erstatningsopgoerelse: Object.fromEntries(
    // Hver kendt kilde-version peger på den samme enkelt-hop-migration; `createPersistenceMigrator`
    // afviser en entry, hvis `toVersion` ikke er den aktuelle version.
    STORE_BEDEDAG_SLOT_SOURCE_VERSIONS.map((fromVersion) => [
      fromVersion,
      { toVersion: PERSISTED_DATA_VERSION, migrate: stripDerivedStoreBededagPct },
    ])
  ),
} satisfies PersistenceMigrationRegistry;

/**
 * Eksplicit migrator-dispatcher pr. persisted sektion.
 *
 * Kontrakt-rækkefølge (schema-evolution.md §3.1a): nullToUndefinedDeep → migrator →
 * stripUnknownFieldsBySchema → schema.safeParse. Vi anvender derfor `nullToUndefinedDeep`
 * her, FØR en eventuel sektion-migrator kører, så fremtidige migratorer altid får
 * input på den kontrakt-lovede normaliserede form — uanset om kalderen (fil-load vs.
 * session-hydrering) selv har normaliseret. Dette gør de to load-stier konsistente.
 *
 * Migratorer må kun mappe KENDTE gamle strukturer til aktuel struktur; de må ikke gætte
 * domæneværdier. Dispatcheren er et extension point, ikke en generel bagudkompat-forpligtelse.
 */
export const migratePersistedSectionValue = createPersistenceMigrator(PERSISTENCE_MIGRATIONS);

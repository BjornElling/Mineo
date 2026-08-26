import type { PersistedSectionKey } from '../config/persistenceRegistry';
import { PERSISTED_DATA_VERSION, PERSISTED_DATA_VERSION_HISTORY } from '../config/persistenceVersion';
import { nullToUndefinedDeep } from './nullToUndefinedDeep';
import { isRecord } from './typeGuards';

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
 * `fromVersion -> current`-overgang. Ukendte versioner forbliver urørte og går
 * videre til den almindelige load-validering, så de aldrig bliver fortolket med
 * en gættet historik.
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
 * consumer-read. Ældre `.eo`-filer bærer den materialiserede værdi. Den fjernes HER – i migratoren – og
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

type FieldAlias = Readonly<{
  from: string;
  to: string;
}>;

/**
 * Flytter kun eksplicit kendte feltnavne, når canonical-navnet ikke allerede findes.
 *
 * Omdøbningen af flere EO-felter skete historisk uden et entydigt versionsskel. Derfor
 * er aliaserne deklareret direkte og anvendes kun ved en navngiven mapping. Hvis en fil
 * indeholder både det gamle og det nye navn, lader vi begge stå, så loadets eksisterende
 * preflight kan gøre konflikten synlig i stedet for at vælge en værdi tavst.
 */
const mapExplicitAliases = (value: unknown, aliases: readonly FieldAlias[]): unknown => {
  if (Array.isArray(value)) {
    let changed = false;
    const mapped = value.map((item) => {
      const next = mapExplicitAliases(item, aliases);
      changed ||= next !== item;
      return next;
    });
    return changed ? mapped : value;
  }
  if (!isRecord(value)) return value;

  let next: Record<string, unknown> = value;
  for (const alias of aliases) {
    if (!Object.prototype.hasOwnProperty.call(next, alias.from)
      || Object.prototype.hasOwnProperty.call(next, alias.to)) {
      continue;
    }
    next = { ...next, [alias.to]: next[alias.from] };
    delete next[alias.from];
  }

  let changed = next !== value;
  for (const [key, child] of Object.entries(next)) {
    const mappedChild = mapExplicitAliases(child, aliases);
    if (mappedChild === child) continue;
    if (!changed) {
      next = { ...next };
      changed = true;
    }
    next[key] = mappedChild;
  }
  return next;
};

const EO_ROOT_FIELD_ALIASES: readonly FieldAlias[] = [
  { from: 'periodeTilBeregningFra', to: 'tafBeregningsperiodeFra' },
  { from: 'periodeTilBeregningTil', to: 'tafBeregningsperiodeTil' },
  { from: 'midlertidigtEetAfgorelse', to: 'midlertidigtEETAfgorelse' },
  { from: 'endeligtEetAfgorelse', to: 'endeligtEETAfgorelse' },
  { from: 'midlertidigtEetAfgoerelseGrupper', to: 'midlertidigtEETAfgoerelseGrupper' },
  { from: 'beregnesSvieSmerteGodtgoerelse', to: 'kravPaaSvieSmerteGodtgoerelse' },
  { from: 'beregnesTabtArbejdsfortjeneste', to: 'kravPaaTabtArbejdsfortjeneste' },
];

const HISTORICAL_IGNORED_ROOT_KEYS = [
  'allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden',
  'allowReguleringMedUdloebMedMaaneder',
  'opsagtFraStilling',
  'sfggSygeperioderFoer2015',
] as const;

const SFGG_ROW_FIELD_ALIASES: readonly FieldAlias[] = [
  { from: 'beregnesUdFra', to: 'sfggBeregningskilde' },
  { from: 'referenceperiodeFra', to: 'sfggReferenceperiodeFra' },
  { from: 'referenceperiodeTil', to: 'sfggReferenceperiodeTil' },
  { from: 'referenceperiodeFravaersdageUdenLoen', to: 'sfggReferenceperiodeFravaersdageUdenLoen' },
  { from: 'manuelDagssats', to: 'sfggManuelDagssats' },
  { from: 'manuelBeloebIHenholdTil', to: 'sfggManuelBeloebIHenholdTil' },
  { from: 'manuelFoerstEfterSygeloen', to: 'sfggManuelFoerstEfterSygeloen' },
  { from: 'satsvalg', to: 'sfggSatsvalg' },
  { from: 'alleredeBetaltBeloeb', to: 'sfggAlleredeBetaltBeloeb' },
];

/** Migrerer de historiske EO-feltnavne, som tidligere udgivelser selv kunne gemme. */
const migrateKnownEoFieldAliases = (value: unknown): PersistenceMigrationResult => {
  const root = mapExplicitAliases(value, EO_ROOT_FIELD_ALIASES);
  if (!isRecord(root)) return { value: root };

  const rows = root.sfggAnsaettelsesforhold;
  if (!Array.isArray(rows)) return { value: root };

  let rowsChanged = false;
  const mappedRows = rows.map((row) => {
    const mapped = mapExplicitAliases(row, SFGG_ROW_FIELD_ALIASES);
    rowsChanged ||= mapped !== row;
    return mapped;
  });
  return rowsChanged ? { value: { ...root, sfggAnsaettelsesforhold: mappedRows } } : { value: root };
};

/**
 * Fjerner fire tidligere felter/tabeller, som kun fandtes i EO-filer fra den interne udviklingsfase.
 *
 * Brugeren har godkendt, at de ikke skal bevares, og at de skal ignoreres uden preflight. De fjernes derfor eksplicit
 * før schema-sanitization – ikke som ukendte sagsfelter – så de ikke kan forveksles med tab af sagsdata. Nye ukendte
 * felter følger fortsat den almindelige preflight-regel.
 */
export const removeApprovedHistoricalDevelopmentFields = (value: unknown): unknown => {
  if (!isRecord(value)) return value;

  const keysPresent = HISTORICAL_IGNORED_ROOT_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(value, key)
  );
  if (!keysPresent) return value;

  const withoutDevelopmentData = { ...value };
  for (const key of HISTORICAL_IGNORED_ROOT_KEYS) {
    delete withoutDevelopmentData[key];
  }
  return withoutDevelopmentData;
};

const migrateErstatningsopgoerelse = (value: unknown): PersistenceMigrationResult => {
  const withAliases = migrateKnownEoFieldAliases(value).value;
  const withoutHistoricalDevelopmentData = removeApprovedHistoricalDevelopmentFields(withAliases);
  return stripDerivedStoreBededagPct(withoutHistoricalDevelopmentData);
};

// Registrér alle kendte historiske EO-versioner, også når en version ikke behøver
// en særskilt strukturel ændring. Det gør alias- og afledt-slot-migreringen til en
// fast del af loadgrænsen og gør et glemt historikpunkt synligt i versionsværnet.
const PERSISTENCE_MIGRATIONS = {
  erstatningsopgoerelse: Object.fromEntries(
    PERSISTED_DATA_VERSION_HISTORY.map((fromVersion) => [
      fromVersion,
      { toVersion: PERSISTED_DATA_VERSION, migrate: migrateErstatningsopgoerelse },
    ])
  ),
} satisfies PersistenceMigrationRegistry;

/**
 * Eksplicit migrator-dispatcher pr. persisted sektion.
 *
 * Kontrakt-rækkefølge (schema-evolution.md §3.1a): nullToUndefinedDeep → migrator →
 * stripUnknownFieldsBySchema → schema.safeParse. Vi anvender derfor `nullToUndefinedDeep`
 * her, FØR en eventuel sektion-migrator kører, så fremtidige migratorer altid får
 * input på den kontrakt-lovede normaliserede form – uanset om kalderen (fil-load vs.
 * session-hydrering) selv har normaliseret. Dette gør de to load-stier konsistente.
 *
 * Migratorer må kun mappe KENDTE gamle strukturer til aktuel struktur; de må ikke gætte
 * domæneværdier. Dispatcheren er den obligatoriske grænse for kendt historisk input.
 */
export const migratePersistedSectionValue = createPersistenceMigrator(PERSISTENCE_MIGRATIONS);

import type { PersistedSectionKey } from '../config/persistenceRegistry';
import { PERSISTED_DATA_VERSION, PERSISTED_DATA_VERSION_HISTORY } from '../config/persistenceVersion';
import { nullToUndefinedDeep } from '../utils/nullToUndefinedDeep';
import { isRecord } from '../utils/typeGuards';

export type PersistedLoadAdaptation = Readonly<{
  value: unknown;
  preflightMissingFields: readonly PreflightMissingField[];
}>;

export type PreflightMissingField = Readonly<{
  path: readonly string[];
  reason: string;
}>;

type PersistedLoadAdapterStep = Readonly<{
  toVersion: typeof PERSISTED_DATA_VERSION;
  adapt: (value: unknown) => Readonly<{ value: unknown }>;
}>;

export type PersistedLoadAdapterRegistry = Readonly<Partial<Record<
  PersistedSectionKey,
  Readonly<Record<string, PersistedLoadAdapterStep>>
>>>;

type PersistedFieldPathSegment = string | '*';

/**
 * Politik for et senere tilføjet felt, der mangler i en kendt historisk filversion.
 *
 * `value` er en factory, så en tabel-/objektværdi aldrig deles mellem to loads. `'*'` går gennem
 * alle rækker i en eksisterende array; dermed kan samme mekanisme bruges for både rod- og
 * tabelkolonner. Der oprettes ikke manglende mellemobjekter, fordi deres form skal ejes af schemaet.
 */
export type MissingPersistedFieldPolicy = Readonly<{
  sectionKey: PersistedSectionKey;
  sourceVersions: readonly string[];
  path: readonly [PersistedFieldPathSegment, ...PersistedFieldPathSegment[]];
  value: () => unknown;
  behavior: 'silentDefault' | 'preflight';
  preflightReason?: string;
}>;

export type PersistedLoadAdapterConfiguration = Readonly<{
  transitions: PersistedLoadAdapterRegistry;
  missingFieldPolicies: readonly MissingPersistedFieldPolicy[];
}>;

type PersistedSectionLoadAdapter = (
  pageKey: PersistedSectionKey,
  value: unknown,
  sourceVersion: string
) => PersistedLoadAdaptation;

/**
 * Bygger den versionsbårne adapter for én persisteret sektion. Hver entry beskriver én entydig
 * `fromVersion -> current`-overgang. Ukendte versioner forbliver urørte og går videre til den
 * almindelige load-validering, så de aldrig bliver fortolket med en gættet historik.
 */
export const createPersistedSectionLoadAdapter = (
  configuration: PersistedLoadAdapterConfiguration
): PersistedSectionLoadAdapter => (pageKey, value, sourceVersion) => {
  const normalized = nullToUndefinedDeep(value);
  const step = configuration.transitions[pageKey]?.[sourceVersion];
  const transitioned = step === undefined ? normalized : (() => {
  // Gør `toVersion` load-bearing: en entry hvis mål ikke er den aktuelle version er en
  // fejlkonfigureret overgang (kun single-hop `fromVersion -> current` er tilladt). Stop
  // fail-closed; inputtet må ikke fortsætte som en tavs identitetsbehandling.
    if (step.toVersion !== PERSISTED_DATA_VERSION) {
      throw new Error(
        `Load-adapter for '${pageKey}' fra version ${sourceVersion} har toVersion ${step.toVersion}, ` +
        `forventet ${PERSISTED_DATA_VERSION}.`
      );
    }
    return step.adapt(normalized).value;
  })();

  const policies = configuration.missingFieldPolicies.filter((policy) =>
    policy.sectionKey === pageKey && policy.sourceVersions.includes(sourceVersion)
  );
  return applyMissingPersistedFieldPolicies(transitioned, policies);
};

const addMissingValueAtPath = (
  value: unknown,
  path: readonly PersistedFieldPathSegment[],
  createValue: () => unknown,
): Readonly<{ value: unknown; added: boolean }> => {
  const [segment, ...rest] = path;
  if (segment === undefined) return { value, added: false };
  if (segment === '*') {
    if (!Array.isArray(value)) return { value, added: false };
    let added = false;
    const next = value.map((entry) => {
      const result = addMissingValueAtPath(entry, rest, createValue);
      added ||= result.added;
      return result.value;
    });
    return added ? { value: next, added } : { value, added };
  }
  if (!isRecord(value)) return { value, added: false };
  if (rest.length === 0) {
    return Object.hasOwn(value, segment)
      ? { value, added: false }
      : { value: { ...value, [segment]: createValue() }, added: true };
  }
  const child = addMissingValueAtPath(value[segment], rest, createValue);
  return child.added ? { value: { ...value, [segment]: child.value }, added: true } : { value, added: false };
};

const formatPolicyPath = (path: readonly PersistedFieldPathSegment[]): readonly string[] =>
  path.map((segment) => segment === '*' ? 'række' : segment);

const applyMissingPersistedFieldPolicies = (
  initialValue: unknown,
  policies: readonly MissingPersistedFieldPolicy[]
): PersistedLoadAdaptation => {
  let value = initialValue;
  const preflightMissingFields: PreflightMissingField[] = [];
  for (const policy of policies) {
    const result = addMissingValueAtPath(value, policy.path, policy.value);
    value = result.value;
    if (result.added && policy.behavior === 'preflight') {
      preflightMissingFields.push({
        path: formatPolicyPath(policy.path),
        reason: policy.preflightReason ?? 'Feltet fandtes ikke i den gemte fil og blev sat til standardværdien',
      });
    }
  }
  return { value, preflightMissingFields };
};

/**
 * Fjerner det afledte `storeBededagPct`-slot fra hvert persisteret ansættelsesforhold.
 *
 * Satsen er en funktion af dato og "Løn på helligdage" og udledes af reader-projektionen før første
 * consumer-read. Ældre `.eo`-filer bærer den materialiserede værdi. Den fjernes her i load-adapteren
 * og ikke som et strippet ukendt felt, fordi et strip rapporteres til brugeren som tabt indtastning.
 * Værdien går ikke tabt: den genudledes. Adapteren rører kun det kendte slot og gætter ingen domæneværdier.
 */
const removeDerivedStoreBededagPct = (value: unknown): PersistedLoadAdaptation => {
  if (!isRecord(value)) return { value, preflightMissingFields: [] };
  const employments = value.loenindkomstAnsaettelsesforhold;
  if (!Array.isArray(employments)) return { value, preflightMissingFields: [] };
  return {
    value: {
      ...value,
      loenindkomstAnsaettelsesforhold: employments.map((employment) => {
        if (!isRecord(employment)) return employment;
        const { storeBededagPct: _derived, ...rest } = employment;
        return rest;
      }),
    }, preflightMissingFields: [],
  };
};

type FieldAlias = Readonly<{
  from: string;
  to: string;
}>;

/**
 * Flytter kun eksplicit kendte feltnavne, når canonical-navnet ikke allerede findes.
 *
 * Omdøbningen af flere EO-felter skete historisk uden et entydigt versionsskel. Derfor er
 * aliaserne deklareret direkte og anvendes kun ved en navngiven mapping. Hvis en fil indeholder
 * både det gamle og det nye navn, lader vi begge stå, så loadets eksisterende preflight kan gøre
 * konflikten synlig i stedet for at vælge en værdi tavst.
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
    if (!Object.hasOwn(next, alias.from) || Object.hasOwn(next, alias.to)) continue;
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

/** Den lukkede liste over historiske udviklingsdata, brugeren har godkendt tavst ignoreret ved load. */
const HISTORICAL_IGNORED_EO_ROOT_KEYS = [
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

const mapKnownEoFieldAliases = (value: unknown): PersistedLoadAdaptation => {
  const root = mapExplicitAliases(value, EO_ROOT_FIELD_ALIASES);
  if (!isRecord(root)) return { value: root, preflightMissingFields: [] };

  const rows = root.sfggAnsaettelsesforhold;
  if (!Array.isArray(rows)) return { value: root, preflightMissingFields: [] };

  let rowsChanged = false;
  const mappedRows = rows.map((row) => {
    const mapped = mapExplicitAliases(row, SFGG_ROW_FIELD_ALIASES);
    rowsChanged ||= mapped !== row;
    return mapped;
  });
  return rowsChanged
    ? { value: { ...root, sfggAnsaettelsesforhold: mappedRows }, preflightMissingFields: [] }
    : { value: root, preflightMissingFields: [] };
};

/** Fjerner kun de fire godkendte, ikke-sagslige EO-udviklingsfelter før enhver load-optælling. */
const removeApprovedHistoricalDevelopmentFields = (value: unknown): unknown => {
  if (!isRecord(value) || !HISTORICAL_IGNORED_EO_ROOT_KEYS.some((key) => Object.hasOwn(value, key))) {
    return value;
  }
  const result = { ...value };
  for (const key of HISTORICAL_IGNORED_EO_ROOT_KEYS) delete result[key];
  return result;
};

const adaptErstatningsopgoerelseForLoad = (value: unknown): PersistedLoadAdaptation => {
  const withAliases = mapKnownEoFieldAliases(value).value;
  const withoutHistoricalDevelopmentData = removeApprovedHistoricalDevelopmentFields(withAliases);
  return removeDerivedStoreBededagPct(withoutHistoricalDevelopmentData);
};

// Registrér alle kendte historiske EO-versioner, også når en version ikke behøver en særskilt
// strukturændring. Det gør aliaser og afledte slots til en fast del af loadgrænsen og gør et glemt
// historikpunkt synligt i versionsværnet.
const PERSISTED_LOAD_ADAPTER_REGISTRY = {
  erstatningsopgoerelse: Object.fromEntries(
    PERSISTED_DATA_VERSION_HISTORY.map((fromVersion) => [
      fromVersion,
      { toVersion: PERSISTED_DATA_VERSION, adapt: adaptErstatningsopgoerelseForLoad },
    ])
  ),
} satisfies PersistedLoadAdapterRegistry;

// Listen er bevidst tom, indtil brugeren ved et konkret nyt felt vælger, om en gammel fil uden
// værdien skal udløse preflight eller have en navngiven standardværdi indsat tavst.
const MISSING_PERSISTED_FIELD_POLICIES: readonly MissingPersistedFieldPolicy[] = [];

/**
 * Den obligatoriske adapter for én indkommende persisteret sektion.
 *
 * Kæden er `nullToUndefinedDeep` efterfulgt af en eksakt, versionsbåret overgang. Adaptere må kun
 * mappe kendte historiske strukturer til current struktur og må aldrig gætte domæneværdier.
 */
export const adaptPersistedSectionForLoad = createPersistedSectionLoadAdapter({
  transitions: PERSISTED_LOAD_ADAPTER_REGISTRY,
  missingFieldPolicies: MISSING_PERSISTED_FIELD_POLICIES,
});

/**
 * Adapterens containertrin. Det rensede grundlag er den eneste dataform fil-load må tælle, klassificere
 * og sende videre til sektionsadapteren. Current-sessionen passerer direkte til sektionsadapteren,
 * som anvender samme idempotente EO-regel.
 */
export const adaptPersistedFileDataForLoad = (
  rawData: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
  if (!Object.hasOwn(rawData, 'erstatningsopgoerelse')) return { ...rawData };
  return {
    ...rawData,
    erstatningsopgoerelse: removeApprovedHistoricalDevelopmentFields(rawData.erstatningsopgoerelse),
  };
};

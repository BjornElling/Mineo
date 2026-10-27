import type { PersistedSectionKey } from '../config/persistenceRegistry';
import {
  LEGACY_PERSISTED_DATA_VERSION,
  PERSISTED_DATA_VERSION,
  PERSISTED_DATA_VERSION_HISTORY,
} from '../config/persistenceVersion';
import { nullToUndefinedDeep } from '../utils/nullToUndefinedDeep';
import { isRecord } from '../utils/typeGuards';
import { countMeaningfulFields } from '../utils/dataCollection';
import { resolveDefaultStoreBededagstillaeg } from '../domain/loen/storeBededagstillaeg';

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
  const versions = configuration.transitions[pageKey];
  // Versionsstrengen kommer fra filen. Arvede navne er ukendte versioner, ikke adaptertrin.
  const step = versions && Object.hasOwn(versions, sourceVersion) ? versions[sourceVersion] : undefined;
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

/**
 * Overfører den tidligere automatiske Store Bededag-beslutning til det nye, udtrykkelige valg.
 *
 * Alle hidtidige Mineo-filer manglede togglen, men beregnede tillægget når "Løn på helligdage"
 * var "Almindelig løn". Derfor er `true` den eneste kompatibilitetsbevarende værdi i netop den
 * historiske tilstand. En allerede gemt toggle røres aldrig, og andre helligdagsvalg får den
 * passive `false`-værdi. Det er en kendt semantisk migrering, ikke en schema-default.
 */
const migrateMissingStoreBededagToggle = (value: unknown): unknown => {
  if (!isRecord(value)) return value;

  const migrateSource = (source: unknown): unknown => {
    if (!isRecord(source) || Object.hasOwn(source, 'beregnStoreBededagstillaeg')) return source;
    return {
      ...source,
      beregnStoreBededagstillaeg: resolveDefaultStoreBededagstillaeg(
        typeof source.loenPaaHelligdage === 'string' ? source.loenPaaHelligdage : undefined
      ),
    };
  };

  const employments = value.loenindkomstAnsaettelsesforhold;
  const migratedEmployments = Array.isArray(employments) ? employments.map(migrateSource) : employments;
  const migratedAngivetLoen = migrateSource(value.eoAngivetLoenLoenudvikling);
  if (migratedEmployments === employments && migratedAngivetLoen === value.eoAngivetLoenLoenudvikling) return value;
  return {
    ...value,
    ...(migratedEmployments === employments ? {} : { loenindkomstAnsaettelsesforhold: migratedEmployments }),
    ...(migratedAngivetLoen === value.eoAngivetLoenLoenudvikling ? {} : { eoAngivetLoenLoenudvikling: migratedAngivetLoen }),
  };
};

/**
 * Første persisted-data-version, hvor begge kronetillæg i reguleringen bærer en gemt enhed, som er
 * brugerens eget valg (afklaringslog 10a og 12 i `docs/review/regulering-taf-gennemgang-2026-10-13.md`).
 */
const FIRST_VERSION_WITH_KRONETILLAEG_ENHEDER = '3.15';

/**
 * Kildeversionerne fra før {@link FIRST_VERSION_WITH_KRONETILLAEG_ENHEDER}.
 *
 * Historiklisten må kun udvides i enden, så positionen før versionen er netop de tidligere udgivelser.
 * Mængden opslås eksplicit pr. kildeversion; en senere version (3.16 osv.) kommer aldrig med og får
 * dermed ikke sin gemte enhed overskrevet. Mangler versionen i historikken, stopper modulet ved
 * indlæsning frem for at migrere alt eller intet tavst.
 */
const VERSIONS_BEFORE_KRONETILLAEG_ENHEDER: ReadonlySet<string> = (() => {
  const index = PERSISTED_DATA_VERSION_HISTORY.indexOf(FIRST_VERSION_WITH_KRONETILLAEG_ENHEDER);
  if (index < 0) {
    throw new Error(`Persisted-data-versionen ${FIRST_VERSION_WITH_KRONETILLAEG_ENHEDER} mangler i historikken.`);
  }
  return new Set<string>(PERSISTED_DATA_VERSION_HISTORY.slice(0, index));
})();

/** Den enhed, «Ansættelse» giver: feltet «Forhøjet grundløn» viste altid «/ time» ved Timeløn, ellers «/ måned». */
const resolveHistoriskAnsaettelsesEnhed = (offentligLoenType: unknown): 'Time' | 'Måned' =>
  offentligLoenType === 'Timeløn' ? 'Time' : 'Måned';

/**
 * Den anciennitetsenhed, programmet før 3.15 TVANG ved angivet løn. Andre beregningsmåder (og en
 * manglende/ukendt værdi) giver `undefined`: der var intet tvunget valg at overføre, og den gemte værdi røres ikke.
 */
const resolveHistoriskTvungenAnciennitetsEnhed = (beregnesUdFra: unknown): 'Time' | 'Måned' | undefined => {
  if (beregnesUdFra === 'Angivet dagsløn') return 'Time';
  if (beregnesUdFra === 'Angivet månedsløn') return 'Måned';
  return undefined;
};

const addMissingEkstraGrundloenEnhed = (source: unknown): unknown => {
  if (!isRecord(source) || Object.hasOwn(source, 'offentligLoenEkstraGrundloenAngivesPer')) return source;
  return {
    ...source,
    offentligLoenEkstraGrundloenAngivesPer: resolveHistoriskAnsaettelsesEnhed(source.offentligLoenType),
  };
};

/**
 * Overfører kronetillæggenes historiske enheder til de gemte enhedsvalg fra version 3.15.
 *
 * 1. «Forhøjet grundløn ud over løntrin» havde ingen gemt enhed, men feltet og bilaget viste altid
 *    «Ansættelse»-enheden. Det er derfor den enhed, en ældre fil får – på hvert ansættelsesforhold og på
 *    angivet løn. En allerede gemt enhed røres aldrig.
 * 2. Angivet løns `anciennitetstillaegSatsAngivesPer` blev gemt med schemaets default 'Måned', men værdien
 *    blev hverken vist eller læst: beregningen tvang Time ved «Angivet dagsløn» og Måned ved «Angivet
 *    månedsløn». Den gemte værdi er altså ikke brugerens valg, og den overskrives med den enhed, beregningen
 *    faktisk brugte. Lod vi den stå, ville en dagslønssags tillæg blive ganget med 160,33. Ansættelseskortets
 *    anciennitetsenhed var synlig og valgt af brugeren og migreres ikke.
 *
 * Den ændrede fortolkning af forhøjet grundløn (beløbet regnes nu i den enhed, feltet viste, ikke i
 * TAF-enheden) er godkendt af udvikleren uden preflight eller advarsel ved indlæsning (afklaringslog 12).
 */
const migrateHistoricalKronetillaegEnheder = (value: unknown): unknown => {
  if (!isRecord(value)) return value;

  const employments = value.loenindkomstAnsaettelsesforhold;
  const migratedEmployments = Array.isArray(employments)
    ? employments.map(addMissingEkstraGrundloenEnhed)
    : employments;

  const angivetLoen = value.eoAngivetLoenLoenudvikling;
  const angivetLoenMedEkstraEnhed = addMissingEkstraGrundloenEnhed(angivetLoen);
  const tvungenAnciennitetsEnhed = resolveHistoriskTvungenAnciennitetsEnhed(value.beregnesUdFra);
  const migratedAngivetLoen = tvungenAnciennitetsEnhed !== undefined && isRecord(angivetLoenMedEkstraEnhed)
    ? { ...angivetLoenMedEkstraEnhed, anciennitetstillaegSatsAngivesPer: tvungenAnciennitetsEnhed }
    : angivetLoenMedEkstraEnhed;

  if (migratedEmployments === employments && migratedAngivetLoen === angivetLoen) return value;
  return {
    ...value,
    ...(migratedEmployments === employments ? {} : { loenindkomstAnsaettelsesforhold: migratedEmployments }),
    ...(migratedAngivetLoen === angivetLoen ? {} : { eoAngivetLoenLoenudvikling: migratedAngivetLoen }),
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

/**
 * Migrerer de to tværgående strukturændringer fra de gamle, versionsløse `.eo`-filer.
 *
 * Før `persistedDataVersion` blev skrevet i containeren, lå fødselsdatoen i
 * `faellesPersondata`, og EET-årslønnerne lå direkte i `erhvervsevnetab`. De to felter er
 * sagsdata, ikke fremmede rester, og må derfor flyttes før sektionsschemas sanitizes.
 * Funktionen flytter kun, når destinationsfeltet ikke findes. Ved en konflikt lader den
 * begge værdier stå, så den almindelige preflight viser den gamle værdi i stedet for at
 * vælge mellem to sagsværdier tavst.
 */
const migrateLegacyCrossSectionFields = (rawData: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  let nextData: Record<string, unknown> = { ...rawData };

  const legacyPersondata = nextData.faellesPersondata;
  if (isRecord(legacyPersondata) && Object.hasOwn(legacyPersondata, 'skadelidteFodselsdato')) {
    const stamdata = isRecord(nextData.stamdata) ? nextData.stamdata : {};
    if (!Object.hasOwn(stamdata, 'skadelidteFodselsdato')) {
      const { skadelidteFodselsdato, ...remainingPersondata } = legacyPersondata;
      nextData = {
        ...nextData,
        stamdata: { ...stamdata, skadelidteFodselsdato },
      };
      if (countMeaningfulFields(remainingPersondata) === 0) {
        delete nextData.faellesPersondata;
      } else {
        nextData.faellesPersondata = remainingPersondata;
      }
    }
  }

  const legacyEet = nextData.erhvervsevnetab;
  if (!isRecord(legacyEet)) return nextData;

  const wageKeys = ['aslAarsloen', 'ealAarsloen'] as const;
  const currentWages = isRecord(nextData.faellesAarsloen) ? nextData.faellesAarsloen : {};
  let nextEet: Record<string, unknown> = legacyEet;
  let nextWages: Record<string, unknown> = currentWages;
  let wagesChanged = false;
  let eetChanged = false;

  for (const key of wageKeys) {
    if (!Object.hasOwn(legacyEet, key) || Object.hasOwn(currentWages, key)) continue;
    nextWages = { ...nextWages, [key]: legacyEet[key] };
    nextEet = { ...nextEet };
    delete nextEet[key];
    wagesChanged = true;
    eetChanged = true;
  }

  if (!wagesChanged) return nextData;
  return {
    ...nextData,
    erhvervsevnetab: eetChanged ? nextEet : legacyEet,
    faellesAarsloen: nextWages,
  };
};

/**
 * Anvender containermigreringer, som ikke kan udtrykkes som en isoleret sektionsmigrering.
 * Versionsløse filer er den eneste historiske kilde, hvor disse to gamle sektionformer kan
 * forekomme; nyere versionsmærkede filer behandles ikke efter payloadens shape.
 */
const adaptLegacyFileDataForLoad = (
  value: Readonly<Record<string, unknown>>,
  sourceVersion: string,
): Record<string, unknown> => sourceVersion === LEGACY_PERSISTED_DATA_VERSION
  ? migrateLegacyCrossSectionFields(value)
  : { ...value };

const adaptErstatningsopgoerelseForLoad = (value: unknown, sourceVersion: string): PersistedLoadAdaptation => {
  const withAliases = mapKnownEoFieldAliases(value).value;
  const withoutHistoricalDevelopmentData = removeApprovedHistoricalDevelopmentFields(withAliases);
  const withStoreBededagToggle = migrateMissingStoreBededagToggle(withoutHistoricalDevelopmentData);
  // Versionsspecifik, ikke idempotent: en 3.15-fils anciennitetsenhed ved angivet løn er brugerens valg og må
  // ikke overskrives efter «Beregnes ud fra», som reglen gør for de ældre filer.
  const withKronetillaegEnheder = VERSIONS_BEFORE_KRONETILLAEG_ENHEDER.has(sourceVersion)
    ? migrateHistoricalKronetillaegEnheder(withStoreBededagToggle)
    : withStoreBededagToggle;
  return removeDerivedStoreBededagPct(withKronetillaegEnheder);
};

// Registrér alle kendte historiske EO-versioner, også når en version ikke behøver en særskilt
// strukturændring. Det gør aliaser og afledte slots til en fast del af loadgrænsen og gør et glemt
// historikpunkt synligt i versionsværnet. Hver entry binder sin egen kildeversion, så versionsspecifikke
// migreringer (fx kronetillæggenes enheder) kan afgøres uden at gætte ud fra payloadens form.
const PERSISTED_LOAD_ADAPTER_REGISTRY = {
  erstatningsopgoerelse: Object.fromEntries(
    PERSISTED_DATA_VERSION_HISTORY.map((fromVersion) => [
      fromVersion,
      {
        toVersion: PERSISTED_DATA_VERSION,
        adapt: (value: unknown) => adaptErstatningsopgoerelseForLoad(value, fromVersion),
      },
    ])
  ),
} satisfies PersistedLoadAdapterRegistry;

// Udviklerbeslutning 2026-10-27: ældre årslønssager beholder tal og valg uden ny advarsel.
// De nye overenskomstfelter er tomme; hverken satsopslag eller Store Bededag aktiveres ved load.
const MISSING_PERSISTED_FIELD_POLICIES: readonly MissingPersistedFieldPolicy[] = [
  'overenskomstId', 'overenskomstLoenmodtager', 'overenskomstArbejdsgiver', 'reguleringsdato', 'beregnStoreBededagstillaeg',
].map((field) => ({
  sectionKey: 'aarsloen',
  sourceVersions: PERSISTED_DATA_VERSION_HISTORY.slice(0, PERSISTED_DATA_VERSION_HISTORY.indexOf('3.17')),
  path: [field],
  value: () => undefined,
  behavior: 'silentDefault',
}));

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
  rawData: Readonly<Record<string, unknown>>,
  sourceVersion: string = PERSISTED_DATA_VERSION,
): Record<string, unknown> => {
  const migratedData = adaptLegacyFileDataForLoad(rawData, sourceVersion);
  if (!Object.hasOwn(migratedData, 'erstatningsopgoerelse')) return migratedData;
  return {
    ...migratedData,
    erstatningsopgoerelse: removeApprovedHistoricalDevelopmentFields(migratedData.erstatningsopgoerelse),
  };
};

# Skema-evolution og load-kompatibilitet — Mineo

**Status:** Normativ kontrakt
**Type:** Tværgående kontrakt
**Senest verificeret mod kode:** 2026-07-31
**Formål:** At fastlægge ufravigelige regler og EO-tjekliste for tilføjelse af nye felter til persisterede skemaer, så eksisterende `.eo`-filer fortsat kan indlæses, og ny funktionalitet kobles korrekt til alle relevante led.

---

## Grundregel

Dette dokument har to niveauer:

1. Generelle load-/schema-regler, som gælder alle persisted sektioner.
2. En konkret EO-tjekliste, fordi EO aktuelt er det bedst specificerede domæne.

Tværgående save/load-regler er normativt samlet i `src/contracts/persistence-contract.md`.

`FILE_FORMAT_VERSION` og `PERSISTED_DATA_VERSION` er forskellige versionsbegreber, jf. `persistence-contract.md` §9. Denne kontrakt ejer reglerne for persisted sektionsschemas, kildeversions-resolution, migration og load-sanitization.

Load-mekanismen kører sanitization og derefter `schema.safeParse(data)` pr. sektion. Hvis parse fejler, droppes **hele sektionen** — ikke bare det enkelte felt. Det er den nuværende fail-closed model og skal forklares i preflight.

---

## Del 0: Første beslutning — er det et sagsfelt eller et UI-hjælpefelt?

Ikke alle nye felter på skærmen er nye felter i sags-skemaet. Før implementering skal man klassificere feltet korrekt:

### 0.1 Sagsfelt (skal i schema)

Et felt er et **sagsfelt**, hvis det er en del af den autoritative brugerindtastning for sagen og derfor skal:
- gemmes i `.eo`
- indgå i inputaggregatets canonical sektion
- have en typed feltdefinition og strukturel `FieldRef`, hvis det kan redigeres
- kunne indlæses igen efter save/load
- kunne bruges af beregninger, dokumenter eller andre persisted flows gennem `InputReader`

For disse felter gælder hele resten af denne kontrakt uændret.

### 0.2 UI-hjælpefelt (må ikke i schema, men kan stadig kræve F5-bevarelse)

Et felt er et **UI-hjælpefelt**, hvis det kun understøtter et lokalt flow i UI'et, f.eks.:
- søge-/finderfelter
- import-/indsættelsesfelter ved en hjælpeknap
- overlay-/dialog-inputs der ikke i sig selv er en del af sagen

Sådanne felter må **ikke** lægges i sags-skemaet alene for at overleve F5.

Hvis brugeren skal kunne genindlæse siden (`F5`) uden at miste en indtastning i et UI-hjælpefelt, skal feltet i stedet persisteres som **UI-state i `sessionStorage`**:
- via en nøgle i `UI_STORAGE_KEYS` i `src/config/storageManifest.ts`
- med separat, eksplicit læs/skriv-logik
- uden at værdien kommer med i `.eo`

### 0.3 Forbudt mellemtilstand

Det er en fejl at indføre et brugerindtastningsfelt som:
- kun lokal `useState`, **når feltet efter brugerforventningen skal bevares ved F5**

Det er også en fejl at lægge et rent UI-hjælpefelt i sags-skemaet, hvis værdien ikke er en del af den autoritative sag.

Kort sagt:
- `.eo`-/domænefelt -> schema + initial values + denne kontrakt
- UI-hjælpefelt med F5-krav -> `UI_STORAGE_KEYS` + sessionStorage
- rent flygtigt view-state uden F5-krav -> lokal state er acceptabel

---

## Del 1: Load-kompatibilitet — hvad der kræves i skemaet

### Regel 1.1: Alle nye felter efter version 1.0 skal have `.optional()` eller `.default(…)`

Når et felt tilføjes efter schema-version `1.0`, og der derfor kan eksistere gemte version `1.0+` filer uden feltet, **skal** det have én af to egenskaber:

**`JaNej`-toggle:**
```ts
// Forkert — parser fejler hvis feltet mangler i gammel fil
visBilagsnumre: jaNejEnum,

// Korrekt
visBilagsnumre: jaNejEnum.default('Nej'),
```

**`z.enum(…)` og `z.boolean()`:**
```ts
// Forkert
minEnum: z.enum(['A', 'B', 'C']),
minBoolean: z.boolean(),

// Korrekt
minEnum: z.enum(['A', 'B', 'C']).default('A'),
minBoolean: z.boolean().default(false),
```

**Arrays:**
```ts
// Forkert
minTabel: z.array(rowSchema),

// Korrekt
minTabel: z.array(rowSchema).default([]),
```

**`optionalString`, `optionalIsoDateString`, `amountValue`, `decimalNumber` og `wholeNumber`:**
Disse er allerede `.optional()` og håndterer manglende felter korrekt — ingen yderligere ændring nødvendig.

De numeriske combinators validerer kun canonical syntaks og præcis repræsentation. Fortegn, min/max,
procentinterval, datoordensregler og øvrige domæneregler må ikke ligge i persistence-schemaet; de afledes som issues
fra feltdefinitioner og domænevalidatorer. En parsebar værdi uden for en domænegrænse skal derfor kunne roundtrippe
gennem save/load uden at blive muteret eller få hele sektionen droppet.

### Regel 1.2: Vælg skema-default konservativt

Skema-default bestemmer hvad et felt får, når en gammel fil ikke har det. Den skal altid repræsentere den **sikre, passive** tilstand — typisk `'Nej'`, `false`, `[]` eller `undefined`. Den behøver ikke matche AppSettings-default (se Del 2, Regel 2.3).

### Regel 1.3: `.strict()` slår i begge retninger

Alle sub-skemaer bruger `.strict()`. Det betyder:
- Felter der er i filen men **ikke i skemaet** bliver strippet af `stripUnknownFieldsBySchema()` og rapporteret som "Feltet findes ikke i denne version" — dette er korrekt opførsel for fremtids-filer.
- Felter der er **påkrævede i skemaet men mangler i filen** medfører at hele sektionen fejler — dette er den fejl vi undgår med Regel 1.1.

---

## Del 2: Komplet tjekliste — generel skabelon og domænestier

### 2.1 Generel tjeklisteskabelon

Når et nyt persisted felt tilføjes, skal man altid gennemgå følgende typer steder:

1. **Skema (PÅKRÆVET)**
   - relevant fil under `src/schemas/formSchemas/sections/`
   - feltet må kun defineres ét sted
   - `.default(...)` eller `.optional()` skal være korrekt valgt jf. Del 1

2. **Initial values (PÅKRÆVET)**
   - relevant fil under `src/domain/<domaene>/...InitialValues.ts`
   - alle felter der forventes ved ny sag/oprettelse, skal være repræsenteret
   - parse-baserede initial values skal opdateres eksplicit

3. **UI/page/tab (PÅKRÆVET hvis feltet vises eller kan redigeres)**
   - relevant page-komponent og eventuelle tabs/underkomponenter
   - feltet skal registreres i feltkataloget med codec, label, kontroltype og strukturel adresse.
     `npm run verify:ledgers` er det maskinelle tjek på, at katalog og collections dækker schemaet:
     ledgerne i `src/inputCore/ledger/` udleder feltstier fra schemaet og fanger, at et nyt felt
     mangler en descriptor
   - formular og tabel skal bruge den fælles editor-state machine og settle-semantik
   - tabeller/række-generatorer skal opdateres hvis feltet lever i en række

4. **Validator / krydsregler (BETINGET)**
   - relevant validator eller domæne-regelmodul
   - især påkrævet ved tværfelt-afhængigheder, intervalregler eller PDF-gating

5. **Beregningslag (BETINGET)**
   - relevante domain engines / snapshots / output-projektioner
   - påkrævet hvis feltet påvirker beregning, kontrol eller afledte resultater

6. **Dokumentdefinition og output (BETINGET)**
   - relevante dokumentdependencies, projektioner og generatorer
   - påkrævet hvis feltet skal vises i eller gate PDF/Word-output
   - den reaktive gate og click-preflight skal fortsat bruge samme dokumentdefinition

7. **AppSettings (BETINGET)**
   - kun hvis feltet skal have brugerindstillingsstyret default
   - se `src/contracts/app-settings.md`

8. **Tests (PÅKRÆVET)**
   - initial values
   - load af ældre `.eo`-filer uden feltet
   - current-session-korruption (fail-closed) ved inkompatibel ændring af strukturel feltidentitet
   - validator/beregning/dokumentgate når feltet påvirker disse lag

### 2.2 Domænespecifikke stier

Brug denne tabel til at instantiere skabelonen ovenfor med de rigtige filer:

| Domæne/sektion | Skema | Initial values | Primær page | Typiske tabs/underkomponenter |
|---|---|---|---|---|
| `erstatningsopgoerelse` | `src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts` | `src/domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues.ts` | `src/components/pages/Erstatningsopgoerelse.tsx` | `src/components/pages/erstatningsopgoerelse/` |
| `erhvervsevnetab` | `src/schemas/formSchemas/sections/erhvervsevnetabSchemas.ts` | `src/domain/erhvervsevnetab/erhvervsevnetabInitialValues.ts` | `src/components/pages/Erhvervsevnetab.tsx` | `src/components/pages/erhvervsevnetab/` |
| `forsoergertab` | `src/schemas/formSchemas/sections/forsoergertabSchemas.ts` | `src/domain/forsoergertab/forsoergertabInitialValues.ts` | `src/components/pages/Forsoergertab.tsx` | `src/components/pages/forsoergertab/` |
| `varigemen` | `src/schemas/formSchemas/sections/varigeMenSchemas.ts` | `src/domain/varigemen/varigeMenInitialValues.ts` | `src/components/pages/VarigeMen.tsx` | `src/components/pages/varigemen/` |
| `stamdata` | `src/schemas/formSchemas/sections/stamdataSchemas.ts` | `src/domain/stamdata/stamdataInitialValues.ts` | `src/components/pages/Stamdata.tsx` | `src/components/pages/stamdata/` |
| `aarsloen` | `src/schemas/formSchemas/sections/aarsloenSchemas.ts` | `src/domain/aarsloen/aarsloenInitialValues.ts` | `src/components/pages/Aarsloen.tsx` | `src/components/pages/aarsloen/` |
| `faellesAarsloen` | `src/schemas/formSchemas/sections/faellesAarsloenSchemas.ts` | `src/domain/aslEalAarsloen/faellesAarsloenInitialValues.ts` | `src/components/pages/Erhvervsevnetab.tsx` / `src/components/pages/Forsoergertab.tsx` | respektive page-filer |
| `satser` | `src/schemas/formSchemas/sections/satserSchemas.ts` | `src/domain/satser/satserInitialValues.ts` | `src/components/pages/Satser.tsx` | `src/components/pages/satser/` |
| `renteberegning` | `src/schemas/formSchemas/sections/renteberegningSchemas.ts` | `src/domain/renteberegning/renteberegningInitialValues.ts` | `src/components/pages/Renteberegning.tsx` | `src/components/pages/renteberegning/` |

Feltarbejde på en side sker gennem sidens `useXxxViewModel` og dens sektionskomponenter i undermappen — ikke
inline i page-filen. `page-component-contract.md` §4.4 ejer den regel.

`minProcesrente` er ikke en `.eo`-sagssektion, medmindre den registreres i `persistenceRegistry`.

Hvis et domæne ikke står i tabellen, må schema-arbejdet ikke fortsætte før kontrakten og registry-mapping er opdateret. `persistenceRegistry.ts` er teknisk autoritet for persisted sektionskeys; denne tabel skal holdes i sync med registry.

### 2.3 EO som referenceimplementation

EO er fortsat den mest detaljeret beskrevne referenceimplementering. Ved EO-feltarbejde skal man derudover typisk kontrollere:

- `src/validators/erstatningsopgoerelseValidator.ts`
- `src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts`
- `src/domain/erstatningsopgoerelse/snapshot/eoCanonicalOutput.ts`
- relevante engines under `src/domain/erstatningsopgoerelse/`
- relevante tabs under `src/components/pages/erstatningsopgoerelse/`

Typiske fejlsymptomer hvis EO-opdateringer glemmes:

- TypeScript-fejl i `ErstatningsopgoerelseValues`
- Zod-fejl ved oprettelse af ny sag
- feltet gemmes/indlæses, men påvirker ikke beregning eller PDF

---

## Del 3: Subtile faldgruber

### 3.1 fieldCount og load-advarslernes tal

`countFilledFields()` i `src/utils/dataCollection.ts` tæller rekursivt alle ikke-tomme værdier. Definitionen af "fyldt" er:
- `boolean` og `number`: **altid talt** — også `false` og `0`
- `string`: talt hvis `.trim().length > 0` — dvs. `'Nej'` tæller, `''` tæller ikke
- `undefined`/`null`: tæller ikke
- `array`: tæller hvis mindst ét element er meningsfuldt

**Konsekvens:** Et nyt `JaNej`-felt med default `'Nej'` øger `fieldCount` med 1 i alle nygemte filer. Ældre filer har ikke dette felt og rapporterer dermed et lavere `expectedCount`. Count-mismatch er ikke alene en fejlklassifikation. Brugervendt alvorlighed skal styres af issue-kategorier, ikke kun af expected/loaded tal.

**Preflight-tallene skal gå op for brugeren:** `indlæst-fra-fil + sat-til-standard = felter-i-fil`. Derfor opgøres `loadedCount`/`failedCount` i preflight **felt-baseret** ud fra hvad der faktisk lå i filen — IKKE som rå `countFilledFields(snapshot)`, der også tæller schema-defaults der udfylder huller i en gammel fil (et tal der ellers kan være ≥ `expectedCount` trods reelt tab). `failedCount` er antallet af udfyldte filfelter der gik tabt (strippet/droppet/ukendt sektion), opgjort via `countMeaningfulFields()`; `loadedCount = expectedCount − failedCount`. Migreringer bevarer data og tæller ikke som tab. (Bemærk: top-level `LoadFileResult.fieldCount` er fortsat `countFilledFields(snapshot)` til success-beskeden — det er et andet, ikke-reconcilierende tal.)

Issue-kategorier (`LoadIssueKind` i `src/types/fileOperations.ts`):

- `strippedUnknownField`: kendt sektion, felt findes ikke i current schema. **Surfaces i preflight** (gemt værdi kunne ikke indlæses → feltet sat til standardværdi).
- `sectionDropped`: sektion kunne ikke parses og indlæses ikke. **Surfaces i preflight.**
- `unknownSection`: sektionen kendes ikke i current registry. **Surfaces i preflight.**
- `migratedField`: eksplicit migrator har flyttet eller omsat et felt. Data bevares → **vises ikke** (vellykket indlæsning, ikke et tab) og tæller ikke som fejl.

**Skel mellem tavs og rapporteret:**
- Felter der *manglede* i filen og blev udfyldt via schema-default eller optional **rapporteres tavst** — det er harmløs forward-tolerance og må aldrig udløse advarsel (AGENTS.md save/load: "Nye schema-felter der mangler i en ældre fil må aldrig blokere load eller udløse advarsel").
- Felter der *var i filen* men ikke kunne indlæses (`strippedUnknownField`/`sectionDropped`/`unknownSection`) **rapporteres via preflight**. Stille datatab er uacceptabelt (AGENTS.md save/load; persistence-contract §6.3 "Rapportér tab eller strip via preflight i stedet for at gætte"). Framingen er neutral/pædagogisk ("sat til standardværdier"), ikke en teknisk fejl, og må ikke ende som en `logWarning`/console-advarsel (den udløser DevtoolsIssueNotice — "Teknisk advarsel registreret" — hvilket er forkert kanal for forventet schema-evolution).

### 3.1a Breaking schema-ændringer

Følgende er breaking schema-ændringer:

1. feltomdøbning,
2. feltflytning mellem sektioner,
3. ændret felttype,
4. fjernet eller omdøbt enum-værdi,
5. ændret feltsemantik,
6. ændret row-identitet i tabeldata.

Breaking ændringer må ikke håndteres med strip/default alene, medmindre den bevidste beslutning er at tabe den gamle værdi og rapportere det tydeligt.

Hvis data kan bevares sikkert, skal der bruges en eksplicit migrator pr. `PersistedSectionKey`. Migrator kører i denne rækkefølge:

1. `nullToUndefinedDeep`
2. migrator for kendt gammel struktur
3. `stripUnknownFieldsBySchema`
4. `schema.safeParse`

Før trin 1 resolverer `.eo`-loaderen en eksplicit kildeversion fra
`_metadata.persistedDataVersion` eller `LEGACY_PERSISTED_DATA_VERSION`. Trin 1–2 ejes derefter af
`migratePersistedSectionValue(pageKey, value, sourceVersion)` i
`src/utils/persistenceMigrations.ts`: den normaliserer (`nullToUndefinedDeep`) før
et eksakt per-sektion `fromVersion -> current`-opslag. Manglende register-entry er
identity; der gættes aldrig ud fra shape eller versionsrækkefølge. Trin 3 ligger i
`sanitizePersistedValueForSchema()`, trin 4 hos kalderen. Denne pipeline er kun `.eo`-load; current-session-
hydrering validerer én samlet current-format-envelope og kører aldrig per-sektionsmigratorer.

Migratorer må kun mappe kendte gamle strukturer til current struktur. De må ikke gætte domæneværdier. En migrator er et extension point, ikke en generel forpligtelse til bagudkompatibilitet.

Fjernelse eller omdøbning af enum-værdier kræver enten:

1. entydig migrator før parse, eller
2. deprecated load-værdi i schema med eksplicit domain-/UI-håndtering, hvis værdien fortsat kan indlæses sikkert men ikke vælges fremadrettet, eller
3. tydelig preflight-fejl og hel-sektion-drop.

### 3.2 `.strict()` i mergede sub-skemaer

Sub-skemaerne er defineret med `.strict()` individuelt, men det er det endelige `erstatningsopgoerelseSchema` der er autoritativt ved parse. Et felt defineret i sub-skema A vil ikke blive afvist som "ukendt" af sub-skema B, fordi merge samler dem i ét objekt før strict valideres.

Et felt må dog kun defineres i ét sub-skema — hvis det ved en fejl ender i to, vinder det sidst-mergede.

### 3.3 `erstatningsopgoerelseSchema.parse({…})` fejler hårdt

I `erstatningsopgoerelseInitialValues.ts` bruges `.parse()` (ikke `.safeParse()`). Det betyder at en glemt eller forkert feltværdi i initial values kaster en uncaught exception og crasher sags-oprettelsen. Der er ingen graceful fallback her — korrekthed er påkrævet.

### 3.4 Row-generatorer for tabel-felter

Nye felter inde i tabelrækker (f.eks. en ny kolonne i `svieSmertePeriodeRowSchema`) kræver opdatering af den
tilhørende row-generator (`ensureSvieRows`, `ensureTafRows` o.l.), collection-/entity-feltbuilderen og relevante
dokument-/beregningsdependencies. Der oprettes ikke en rækkevis værdibærende draftkopi; hver celle bruger den fælles
feltmotor. Disse led er ikke dækket af schema-defaulten alene.

### 3.4a Feltadresse- og envelope-evolution

Omdøbning/flytning af et redigerbart felt eller ændring af rækkeidentitet klassificeres som en schemaændring for
canonical sektionsdata:

1. `PERSISTED_DATA_VERSION` håndterer canonical sektionsdata (inkl. `.eo`-load-mapping).
2. `CurrentInputEnvelope.envelopeVersion` håndterer den samlede sessionstruktur.

Der findes **ingen** `fieldAddressVersion` og ingen browser-session-feltadressemigration: gamle interne sessioner
migreres aldrig. Ændrer de strukturelle feltadresser sig inkompatibelt, kan en eksisterende current-session ikke længere
valideres og håndteres som current-session-korruption (fail-closed) efter `persistence-contract.md` §4 — ikke som en
versioneret adressemigration. Kun `.eo`-fil-load forbliver tolerant efter `PERSISTED_DATA_VERSION`-mappingen.

### 3.5 AppSettings

Se `src/contracts/app-settings.md` for den normative regel om nested merge-logik i `parseStoredSettings()`.

---

## Del 4: Flowdiagram — hvad sker der ved load

```
.eo-fil
  → decrypt
  → resolvér sourceVersion fra metadata eller legacy-sentinel
  → nullToUndefinedDeep(data)
  → eventuel eksakt migrator pr. PersistedSectionKey + sourceVersion
  → stripUnknownFieldsBySchema(schema, data)
      → felter i data men ikke i schema: strippes, rapporteres som "ikke indlæst"
  → schema.safeParse(stripped)
      → felter i schema med .default(): udfyldes automatisk hvis de mangler
      → felter i schema uden .default() og ikke .optional(): FEJLER → hele sektion droppes
      → felter i schema der er .optional(): sættes til undefined hvis de mangler
  → snapshot opdateres med sektionens data
```

Session-hydrering validerer den samlede current-session-envelope; kan den ikke valideres mod current-formatet,
håndteres det fail-closed efter `persistence-contract.md` §4 (ingen migration). Rejected input valideres særskilt mod
feltkataloget (kendt adresse + eksisterende entity + XOR). Zod-versioner og
`stripUnknownFieldsBySchema`'s `.shape`/pipe-afhængigheder skal verificeres ved Zod-opgradering, fordi fejl her kan give
forkert strip eller fingerprint-drift.

---

## Del 4A: Versionering

`PERSISTED_DATA_VERSION` bumpes ved:

1. ændring i et schema i `persistenceRegistry`,
2. ændret migrator-/parse-semantik,
3. ændret load-sanitization der påvirker sagsinput,
4. bevidst breaking schema-ændring.

`CurrentInputEnvelope.envelopeVersion` bumpes ved ændring af sessionaggregatets serialiserede struktur. En inkompatibel ændring
af de strukturelle feltadresser bumpes ikke som en særskilt version, men gør enhver eksisterende current-session
korrupt (fail-closed efter `persistence-contract.md` §4), fordi browser-sessioner aldrig migreres. Versionerne må ikke
bumpes samlet uden klassifikation.

`FILE_FORMAT_VERSION` bumpes kun ved inkompatible containerændringer uden for persisted sektionsdata, fx nye obligatoriske load-krav, inkompatibel metadata-struktur eller krypterings-/indpakningsformat. Additive metadatafelter, som er optionelle ved load, kræver ikke bump.

En fremtidig `FILE_FORMAT_VERSION` bump kræver en eksplicit beslutning:

1. implementér adapter for tidligere container-version, eller
2. afvis gamle filer med klar dansk fejlbesked.

Standardvalget er hård afvisning, medmindre der er en konkret stærk grund til adapter. Der bygges ikke legacy kompatibilitetslag af princip.

---

## Del 5: Referenceimplementationer

Korrekte eksempler at kopiere ved tilføjelse af nye felter:

| Felttype | Schema-eksempel | Initial values-eksempel |
|---|---|---|
| Toggle (JaNej) fra AppSettings | `jaNejEnum.default('Nej')` | `safeSettings.defaultX ? 'Ja' : 'Nej'` |
| Toggle (JaNej) fast default | `jaNejEnum.default('Nej')` | `'Nej'` |
| Fritekst | `optionalString` | `undefined` eller `''` |
| Dato | `optionalIsoDateString` | `undefined` |
| Beløb | `amountValue` | `undefined` |
| Enum med default | `z.enum([…]).default('X')` | `'X'` |
| Boolean | `z.boolean().default(false)` | `false` |
| Tabel-array | `z.array(rowSchema).default([])` | `ensureXRows(undefined)` eller `[]` |

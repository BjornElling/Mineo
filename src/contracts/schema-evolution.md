# Skema-evolution og load-kompatibilitet — Mineo

**Status:** Normativ kontrakt
**Type:** Tværgående kontrakt
**Senest verificeret mod kode:** 2026-06-02
**Formål:** At fastlægge ufravigelige regler og EO-tjekliste for tilføjelse af nye felter til persisterede skemaer, så eksisterende `.eo`-filer fortsat kan indlæses, og ny funktionalitet kobles korrekt til alle relevante led.

---

## Grundregel

Dette dokument har to niveauer:

1. Generelle load-/schema-regler, som gælder alle persisted sektioner.
2. En konkret EO-tjekliste, fordi EO aktuelt er det bedst specificerede domæne.

Tværgående save/load-regler er normativt samlet i `src/contracts/persistence-contract.md`.

`FILE_FORMAT_VERSION` og `PERSISTED_DATA_VERSION` er forskellige versionsbegreber, jf. `persistence-contract.md` §7. Denne kontrakt ejer kun reglerne for persisted sektionsschemas og load-sanitization.

Load-mekanismen kører sanitization og derefter `schema.safeParse(data)` pr. sektion. Hvis parse fejler, droppes **hele sektionen** — ikke bare det enkelte felt. Det er den nuværende fail-closed model og skal forklares i preflight.

---

## Del 0: Første beslutning — er det et sagsfelt eller et UI-hjælpefelt?

Ikke alle nye felter på skærmen er nye felter i sags-skemaet. Før implementering skal man klassificere feltet korrekt:

### 0.1 Sagsfelt (skal i schema)

Et felt er et **sagsfelt**, hvis det er en del af den autoritative brugerindtastning for sagen og derfor skal:
- gemmes i `.eo`
- indgå i `FormPersistenceContext`
- kunne indlæses igen efter save/load
- kunne bruges af beregninger, PDF eller andre persisted flows

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

**`optionalString`, `optionalIsoDateString`, `nonNegativeAmountValue`, `percentageDecimal` o.l.:**
Disse er allerede `.optional()` og håndterer manglende felter korrekt — ingen yderligere ændring nødvendig.

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
   - feltet skal bindes med korrekt commit-semantik
   - tabeller/række-generatorer skal opdateres hvis feltet lever i en række

4. **Validator / krydsregler (BETINGET)**
   - relevant validator eller domæne-regelmodul
   - især påkrævet ved tværfelt-afhængigheder, intervalregler eller PDF-gating

5. **Beregningslag (BETINGET)**
   - relevante domain engines / snapshots / output-projektioner
   - påkrævet hvis feltet påvirker beregning, debug eller afledte resultater

6. **PDF-lag (BETINGET)**
   - relevante PDF-projektioner/renderere
   - påkrævet hvis feltet skal vises i PDF eller gate PDF-output

7. **AppSettings (BETINGET)**
   - kun hvis feltet skal have brugerindstillingsstyret default
   - se `src/contracts/app-settings.md`

8. **Tests (STÆRKT ANBEFALET)**
   - initial values
   - load af ældre filer uden feltet
   - validator/beregning/PDF når feltet påvirker disse lag

### 2.2 Domænespecifikke stier

Brug denne tabel til at instantiere skabelonen ovenfor med de rigtige filer:

| Domæne/sektion | Skema | Initial values | Primær page | Typiske tabs/underkomponenter |
|---|---|---|---|---|
| `erstatningsopgoerelse` | `src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts` | `src/domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues.ts` | `src/components/pages/Erstatningsopgoerelse.tsx` | `src/components/pages/erstatningsopgoerelse/` |
| `erhvervsevnetab` | `src/schemas/formSchemas/sections/erhvervsevnetabSchemas.ts` | `src/domain/erhvervsevnetab/erhvervsevnetabInitialValues.ts` | `src/components/pages/Erhvervsevnetab.tsx` | `src/components/pages/erhvervsevnetab/` |
| `forsoergertab` | `src/schemas/formSchemas/sections/forsoergertabSchemas.ts` | `src/domain/forsoergertab/forsoergertabInitialValues.ts` | `src/components/pages/Forsoergertab.tsx` | page-filen er primær UI-entry |
| `varigemen` | `src/schemas/formSchemas/sections/varigeMenSchemas.ts` | `src/domain/varigemen/varigeMenInitialValues.ts` | `src/components/pages/VarigeMen.tsx` | `src/components/pages/varigemen/` |
| `stamdata` | `src/schemas/formSchemas/sections/stamdataSchemas.ts` | `src/domain/stamdata/stamdataInitialValues.ts` | `src/components/pages/Stamdata.tsx` | page-filen er primær UI-entry |
| `aarsloen` | `src/schemas/formSchemas/sections/aarsloenSchemas.ts` | `src/domain/aarsloen/aarsloenInitialValues.ts` | `src/components/pages/Aarsloen.tsx` | `src/components/pages/aarsloen/` hvis relevant |
| `faellesAarsloen` | `src/schemas/formSchemas/sections/faellesAarsloenSchemas.ts` | `src/domain/aslEalAarsloen/faellesAarsloenInitialValues.ts` | `src/components/pages/Erhvervsevnetab.tsx` / `src/components/pages/Forsoergertab.tsx` | respektive page-filer |
| `satser` | `src/schemas/formSchemas/sections/satserSchemas.ts` | `src/domain/satser/satserInitialValues.ts` | `src/components/pages/Satser.tsx` | page-filen er primær UI-entry |
| `renteberegning` | `src/schemas/formSchemas/sections/renteberegningSchemas.ts` | `src/domain/renteberegning/renteberegningInitialValues.ts` | `src/components/pages/Renteberegning.tsx` | `src/components/pages/renteberegning/` hvis relevant |

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

Issue-kategorier (`LoadIssueKind` i `src/types/fileOperations.ts`):

- `strippedUnknownField`: kendt sektion, felt findes ikke i current schema.
- `sectionDropped`: sektion kunne ikke parses og indlæses ikke.
- `unknownSection`: sektionen kendes ikke i current registry.
- `migratedField`: eksplicit migrator har flyttet eller omsat et felt.

Felter der manglede og blev udfyldt via schema-default eller optional surfaces **bevidst ikke** som en egen issue-kategori: det er harmløs schema-evolution og rapporteres tavst (jf. neden­for). Tilføj kun en `missingDefaultedField`-kategori, hvis defaulting på et tidspunkt skal være brugervendt synligt.

Preflight bør kun kalde noget "fejl", når faktisk brugerdata ikke indlæses eller ikke kan valideres. Harmløs schema-evolution bør vises neutralt eller udelades.

### 3.1a Breaking schema-ændringer

Følgende er breaking schema-ændringer:

1. feltomdøbning,
2. feltflytning mellem sektioner,
3. ændret felttype,
4. fjernet eller omdøbt enum-værdi,
5. ændret feltsemantik,
6. ændret row-identitet i tabeldata.

Breaking ændringer må ikke håndteres med strip/default alene, medmindre den bevidste beslutning er at tabe den gamle værdi og rapportere det tydeligt.

Hvis data kan bevares sikkert, skal der bruges en eksplicit migrator pr. `StorageKey`. Migrator kører i denne rækkefølge:

1. `nullToUndefinedDeep`
2. migrator for kendt gammel struktur
3. `stripUnknownFieldsBySchema`
4. `schema.safeParse`

Trin 1–2 ejes af migrator-dispatcheren `migratePersistedSectionValue()` i `src/utils/persistenceMigrations.ts`: den normaliserer (`nullToUndefinedDeep`) før en eventuel sektion-migrator, så invarianten holder uanset om kalderen (fil-load vs. session-hydrering) selv har normaliseret. Trin 3 ligger i `sanitizePersistedValueForSchema()`, trin 4 hos kalderen.

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

Nye felter inde i tabel-rækker (f.eks. en ny kolonne i `svieSmertePeriodeRowSchema`) kræver opdatering af den tilhørende row-generator (`ensureSvieRows`, `ensureTafRows` o.l.) og formentlig `useRowDrafts`-opsætningen i den tilhørende tabelkomponent. Disse er ikke dækket af skema-defaulten alene.

### 3.5 AppSettings

Se `src/contracts/app-settings.md` for den normative regel om nested merge-logik i `parseStoredSettings()`.

---

## Del 4: Flowdiagram — hvad sker der ved load

```
.eo-fil
  → decrypt
  → nullToUndefinedDeep(data)
  → eventuel migrator pr. StorageKey
  → stripUnknownFieldsBySchema(schema, data)
      → felter i data men ikke i schema: strippes, rapporteres som "ikke indlæst"
  → schema.safeParse(stripped)
      → felter i schema med .default(): udfyldes automatisk hvis de mangler
      → felter i schema uden .default() og ikke .optional(): FEJLER → hele sektion droppes
      → felter i schema der er .optional(): sættes til undefined hvis de mangler
  → snapshot opdateres med sektionens data
```

Samme sanitization-rækkefølge gælder session-hydrering. Zod-versioner og `stripUnknownFieldsBySchema`'s `.shape`/pipe-afhængigheder skal verificeres ved Zod-opgradering, fordi fejl her kan give forkert strip eller fingerprint-drift.

---

## Del 4A: Versionering

`PERSISTED_DATA_VERSION` bumpes ved:

1. ændring i et schema i `persistenceRegistry`,
2. ændret migrator-/parse-semantik,
3. ændret load-sanitization der påvirker sagsinput,
4. bevidst breaking schema-ændring.

`FILE_FORMAT_VERSION` bumpes kun ved containerændringer uden for persisted sektionsdata, fx top-level containerfeltkrav, metadata-struktur eller krypterings-/indpakningsformat.

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
| Beløb | `nonNegativeAmountValue` | `undefined` |
| Enum med default | `z.enum([…]).default('X')` | `'X'` |
| Boolean | `z.boolean().default(false)` | `false` |
| Tabel-array | `z.array(rowSchema).default([])` | `ensureXRows(undefined)` eller `[]` |

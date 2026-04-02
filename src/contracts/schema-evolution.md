# Skema-evolution og load-kompatibilitet — Mineo

**Status:** Normativ kontrakt
**Formål:** At fastlægge ufravigelige regler og komplet tjekliste for tilføjelse af nye felter til persisterede skemaer, så eksisterende `.eo`-filer fortsat kan indlæses, og ny funktionalitet kobles korrekt til alle relevante led.

---

## Grundregel

Mineo prioriterer at indlæse mest muligt af eksisterende filer. Et nyt felt i skemaet må **aldrig** forårsage at `erstatningsopgoerelse`-sektionen (eller andre sektioner) droppes ved indlæsning af ældre filer.

Load-mekanismen (`src/utils/fileLoad.ts`) kører `schema.safeParse(data)` på hvert sektion. Hvis parse fejler, droppes **hele sektionen** — ikke bare det manglende felt. Det er en katastrofal fejl der mister alle brugerdata i sektionen.

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

### Regel 1.1: Alle nye felter skal have `.optional()` eller `.default(…)`

Når et felt tilføjes og der kan eksistere gemte filer uden det, **skal** det have én af to egenskaber:

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

## Del 2: Komplet tjekliste — alle steder der skal opdateres

### 2.1 Skema (PÅKRÆVET)
**Fil:** `src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts`

- Tilføj feltet i det relevante sub-skema (`erstatningsopgoerelseBaseSchema`, `bilagsnumreSchema` o.l.), eller opret et nyt sub-skema og merge det ind.
- Feltet må kun defineres i ét sub-skema (duplikering er en merge-fejl).
- Tjek at `.default(…)` eller `.optional()` er til stede (jf. Regel 1.1).
- `ErstatningsopgoerelseValues` udledes automatisk via `z.infer<>` — ingen manuel type-opdatering.

**Fejlsymptom hvis glemt:** TypeScript-kompileringsfejl i al kode der bruger `ErstatningsopgoerelseValues`.

### 2.2 Initial values (PÅKRÆVET)
**Fil:** `src/domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.ts`

Funktionen `createNewEOInitialValuesFromSettings()` kalder `erstatningsopgoerelseSchema.parse({…})` med alle felter eksplicit angivet. Det nye felt **skal** med i dette kald.

- Hvis feltet er uafhængigt af indstillinger: angiv den passende startværdi direkte.
- Hvis feltet skal arve fra AppSettings: følg mønsteret fra `indsaetUdkastStempel`:
  ```ts
  visBilagsnumre: safeSettings.defaultVisBilagsnumre ? 'Ja' : 'Nej',
  ```
- Hvis feltet er en tabel med tom startliste: brug en `ensure*Rows(undefined)`-funktion eller `[]`.

**Fejlsymptom hvis glemt:** App crasher med Zod-fejl ved oprettelse af ny sag.

### 2.3 AppSettings (BETINGET — kun hvis feltet skal have en brugerindstilling som default)
**Fil:** `src/settings/appSettingsSchema.ts`

Tilføj feltet i `appSettingsSchema` og `DEFAULT_APP_SETTINGS`. Husk:
- `appSettingsParse.ts` håndterer tolerance over for manglende nøgler ved schema-evolution (merger med defaults) — ingen ændring nødvendig der.
- AppSettings bruges **kun** ved oprettelse af ny sag, aldrig ved load af eksisterende.
- Kobl den nye indstilling i `Indstillinger.tsx` med `StyledToggleSwitch` eller tilsvarende.

**Fejlsymptom hvis glemt:** Feltet starter altid med hardkodet default, uanset hvad brugeren har valgt i Indstillinger.

### 2.4 UI (PÅKRÆVET for felter der skal vises)
**Fil:** `src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx` (eller anden fane)

- `JaNej`-toggle: brug `handleToggleChange('feltNavn')` og `getChecked(values.feltNavn)`.
- Fritekstfelt: brug `handleStringBlur('feltNavn')` og `value={values.feltNavn || ''}`.
- Dato: brug `handleIsoDateBlur('feltNavn')`.
- Tallfelter: brug `handleChange('feltNavn')` (amount/integer/percent).

TypeScript's conditional mapped types (`ToggleFieldName`, `StringLikeKeys`, `AmountLikeKeys`) sikrer at kun felter med korrekt type kan bruges med de tilhørende handlers — fejl her er kompileringstids-fejl, ikke runtime-fejl.

### 2.5 Validator (BETINGET — kun hvis feltet har krydsvalidering)
**Fil:** `src/validators/erstatningsopgoerelseValidator.ts`

Skal opdateres hvis det nye felt har:
- Interval-regler (fra <= til)
- Gensidig udelukkelse med andre felter
- Afhængighed af andre felters tilstand (f.eks. "påkrævet når X er sat til Ja")

Validatoren kaldes ved tab-skift til Beregning-fanen og blokerer download ved fejl.

**Fejlsymptom hvis glemt:** Ugyldige kombinationer af feltværdier opdages ikke og kan give forkert PDF-output.

### 2.6 Beregningsmotorer (BETINGET — kun hvis feltet indgår i beregninger)
Relevante filer afhænger af feltets domæne:
- `src/domain/erstatningsopgoerelse/eoSnapshot.ts` — koordinerer beregning
- `src/domain/erstatningsopgoerelse/eoCanonicalOutput.ts` — output-struktur
- Specifikke engines: `svieSmerteEngine.ts`, `tafBeregningsEngine.ts`, `periodiseringsMotor.ts` o.l.

**Fejlsymptom hvis glemt:** Feltet indlæses og gemmes korrekt, men ignoreres fuldstændigt i beregning og PDF.

### 2.7 PDF-renderer (BETINGET — kun hvis feltet skal vises i PDF)
Se `docs/architecture/pdf-architecture.md` og `src/contracts/app-settings.md` for PDF-arkitekturen.

PDF-laget læser fra `EoSnapshot`/`ErstatningsopgoerelseValues`, aldrig direkte fra AppSettings.

### 2.8 Tests (ANBEFALET)
Tilføj mindst:
- Et test der verificerer at `createErstatningsopgoerelseInitialValues()` giver korrekt default for det nye felt.
- Et test der verificerer at en gammel fil (uden feltet) kan loades uden fejl — feltet skal få sin skema-default.

Mønster fra eksisterende tests:
- `src/__tests__/domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.test.ts`
- `src/__tests__/settings/appSettingsSchema.test.ts`

---

## Del 3: Subtile faldgruber

### 3.1 fieldCount og load-advarslernes tal

`countFilledFields()` i `src/utils/dataCollection.ts` tæller rekursivt alle ikke-tomme værdier. Definitionen af "fyldt" er:
- `boolean` og `number`: **altid talt** — også `false` og `0`
- `string`: talt hvis `.trim().length > 0` — dvs. `'Nej'` tæller, `''` tæller ikke
- `undefined`/`null`: tæller ikke
- `array`: tæller hvis mindst ét element er meningsfuldt

**Konsekvens:** Et nyt `JaNej`-felt med default `'Nej'` øger `fieldCount` med 1 i alle nygemte filer. Ældre filer har ikke dette felt og rapporterer dermed et lavere `expectedCount`. Det giver load-advarslen "Forventet: X · Indlæst: X-1" — dette er korrekt og forventet opførsel, ikke en fejl.

### 3.2 `.strict()` i mergede sub-skemaer

Sub-skemaerne er defineret med `.strict()` individuelt, men det er det endelige `erstatningsopgoerelseSchema` der er autoritativt ved parse. Et felt defineret i sub-skema A vil ikke blive afvist som "ukendt" af sub-skema B, fordi merge samler dem i ét objekt før strict valideres.

Et felt må dog kun defineres i ét sub-skema — hvis det ved en fejl ender i to, vinder det sidst-mergede.

### 3.3 `erstatningsopgoerelseSchema.parse({…})` fejler hårdt

I `erstatningsopgoerelseInitialValues.ts` bruges `.parse()` (ikke `.safeParse()`). Det betyder at en glemt eller forkert feltværdi i initial values kaster en uncaught exception og crasher sags-oprettelsen. Der er ingen graceful fallback her — korrekthed er påkrævet.

### 3.4 Row-generatorer for tabel-felter

Nye felter inde i tabel-rækker (f.eks. en ny kolonne i `svieSmertePeriodeRowSchema`) kræver opdatering af den tilhørende row-generator (`ensureSvieRows`, `ensureTafRows` o.l.) og formentlig `useRowDrafts`-opsætningen i den tilhørende tabelkomponent. Disse er ikke dækket af skema-defaulten alene.

### 3.5 AppSettings: tolerant parsing giver ikke defaults ved schema-evolution automatisk

`appSettingsParse.ts` merger eksisterende settings med defaults ved load — men dette sker kun ét niveau dybt for `brevhovedIndstillinger`. Nye top-niveau AppSettings-felter håndteres korrekt af spread-merge. Nye felter i nested objekter (udover `brevhovedIndstillinger`) kræver eksplicit merge-logik i `parseStoredSettings()`.

---

## Del 4: Flowdiagram — hvad sker der ved load

```
.eo-fil
  → decrypt
  → stripUnknownFieldsBySchema(schema, data)
      → felter i data men ikke i schema: strippes, rapporteres som "ikke indlæst"
  → schema.safeParse(stripped)
      → felter i schema med .default(): udfyldes automatisk hvis de mangler
      → felter i schema uden .default() og ikke .optional(): FEJLER → hele sektion droppes
      → felter i schema der er .optional(): sættes til undefined hvis de mangler
  → snapshot opdateres med sektionens data
```

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

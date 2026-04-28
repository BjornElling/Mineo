# Implementeringsplan: Toggle for "Midlertidigt EET fra Erhvervsevnetab-siden"

## 1. Formål og overordnet beskrivelse

Den eksisterende knap **"Indsæt midlertidigt EET fra Erhvervsevnetab-siden"** på siden *Offentlige ydelser* (under fanen *Erstatningsopgørelse*) udgår og erstattes af en **toggle-baseret kobling** mellem EO og EET-siden.

### 1.1 Adfærdsmæssig forskel før/efter

**Før (nuværende adfærd):**
- Brugeren trykker manuelt på knappen "Indsæt".
- Programmet beregner perioder via `buildMidlertidigtEetAfgoerelseGroups` og indsætter dem som **rigtige rækker** i `offentligeYdelserRows` med `ydelsestype: 'midlertidigt_eet'`.
- Rækkerne er derefter en del af committed form-state og indgår i alle beregninger og PDF-bilag som almindelige offentlige ydelser-rækker.
- Hvis brugeren senere ændrer noget på EET-siden, skal de igen trykke "Indsæt" for at få ændringerne med.

**Efter (ny adfærd):**
- Brugeren skifter en toggle. Når togglen er **TRUE**, opfører erstatningsopgørelsen sig *som om* alle løbende EET-ydelser af typen *Midlertidig* eller *Delvist endelig* var indtastet i offentlige ydelser-tabellen — uden at de fysisk skrives ind i tabellen.
- Beregningen følger automatisk EET-siden: ændrer brugeren noget på EET-siden, opdateres EO-beregningen straks (uden popup, uden advarsel, uden manuel handling).
- Når togglen er **FALSE**, er EO-siden og EET-siden frakoblet (præcis som hvis EET-siden var tom). Brugeren kan stadig manuelt indtaste rækker med ydelsestype "Midlertidigt EET" i tabellen, og programmet vil opføre sig nøjagtigt som i dag.

### 1.2 Designprincipper

- **Single source of truth:** Når togglen er TRUE, er EET-siden den eneste kilde til midlertidigt EET-data. Der må ikke samtidig være manuelle midlertidigt_eet-rækker i offentlige ydelser-tabellen, og det er heller ikke muligt at tilføje sådanne (ydelsestypen disables i dropdown).
- **Ingen duplikering:** Virtuelle rækker injiceres ind i beregningen *transient* — de skrives **aldrig** til form-state. Det forhindrer synkroniseringsbugs og bevarer EET-siden som autoritativ kilde.
- **Konservativ migration:** Ingen eksisterende sag ændrer adfærd ved blot at blive åbnet. Default for togglen er FALSE for både nye og eksisterende sager. Brugeren skal aktivt skifte togglen for at få den nye adfærd.
- **Genbrug:** Eksisterende `buildMidlertidigtEetAfgoerelseGroups`, `MidlertidigtEetAfgoerelseGroup` og PDF-rendering genbruges. Den eksisterende kontrakt-undtagelse (`domain-boundary-contract.md` §9) bliver bredere — den dækker nu også den transient injection i TAF-beregningen, ikke kun knap-baseret indsættelse.

---

## 2. UI-ændringer

### 2.1 Offentlige ydelser-fanen (`OffentligeYdelserTab.tsx`)

#### 2.1.1 Den eksisterende række "Indsæt midlertidigt EET fra Erhvervsevnetab-siden" udgår
- Slet `<Box className="row--label-right-hover">` der indeholder `Indsæt midlertidigt EET fra Erhvervsevnetab-siden` + `InlineActionButton`.
- Slet de tilhørende handlere: `handleMidlertidigtEetInsert`, `applyMidlertidigtEetGroups`, `handleMidlertidigtEetInsertConfirm`.
- Slet de tilhørende state-felter: `midlertidigtEetPendingGroups`, `midlertidigtEetNoRowsDialogOpen`, `midlertidigtEetConfirmDialogOpen`.
- Slet `<ConfirmationDialog>` for "Ingen midlertidig EET" og "Erstat midlertidigt EET" *for den nuværende knap* (ny dialog erstatter, se 2.1.3).

#### 2.1.2 Ny toggle-række
**Placering:** Samme `<ContentBox>` med section-header *"Tilføj særligt"*, samme `row--label-right-hover`-mønster, samme position som den nuværende række.

**Layout:**
- Venstre: `<Typography className="row--text">Midlertidigt EET indsættes fra Erhvervsevnetab-siden</Typography>`
- Højre: `<StyledToggleSwitch checked={...} onCommit={...} />` (uden label, da label sidder til venstre).

**State:**
- Togglen styres af et nyt persisteret felt: `midlertidigtEetFraEetSiden: jaNejEnum` i `erstatningsopgoerelseBaseSchema` (se §3.1).
- Default ved init og ved schema-coalesce: `'Nej'`.
- Lokalt UI-mapping: `checked = (eoValues.midlertidigtEetFraEetSiden === 'Ja')`.

**Hvorfor `jaNejEnum` og ikke `boolean`:** Konsistens med øvrige valg i schemaet (`beregnesTabtArbejdsfortjeneste`, `revideretOpgoerelse`, `indsaetUdkastStempel`, `varigeMenAfgorelse` osv.). Schema-evolution-kontrakten foreskriver, at nye felter følger eksisterende mønstre, og `jaNejEnum` er det dominerende mønster for disse semantiske ja/nej-valg.

#### 2.1.3 Toggle FALSE → TRUE flow

Toggle-commit-handler (kaldes når brugeren klikker, trykker Enter eller Space):

1. Hvis nuværende værdi er `'Ja'` (TRUE → FALSE): commit straks (se 2.1.4).
2. Hvis nuværende værdi er `'Nej'` (FALSE → TRUE):
   - Tjek om der findes ≥ 1 række i `eoValues.offentligeYdelserRows` med `row.ydelsestype?.trim() === 'midlertidigt_eet'`.
   - **Ingen sådanne rækker:** Commit togglen straks til `'Ja'`. Ingen popup.
   - **Mindst én sådan række:** Vis popup (`<ConfirmationDialog>`) med:
     - Title: `"Slet manuelle indtastninger af Midlertidigt EET"`
     - Message: `"Når midlertidigt EET indsættes fra Erhvervsevnetab-siden, kan der ikke samtidig stå manuelle rækker med ydelsestypen 'Midlertidigt EET' i tabellen ovenfor. Disse rækker vil blive slettet. Bekræft venligst."`
     - `confirmText: "Ja, slet og aktivér"`, `cancelText: "Annuller"`
   - **Bruger bekræfter:** Filtrer alle midlertidigt_eet-rækker væk fra `offentligeYdelserRows` og commit togglen til `'Ja'` i én og samme `setFormValues`-opdatering (se §3.2 for atomicitet). Sæt samtidig bilag-checkbox `eoBilagSelection.midlertidigEet = true` (se 2.2.2). Slettede rækker indsættes **ikke** igen, hvis togglen senere skiftes tilbage.
   - **Bruger annullerer:** Togglen forbliver `'Nej'`. Switchen "springer tilbage" automatisk, fordi den er fuldt controlled (vi har aldrig sat værdien). Ingen yderligere handling.

#### 2.1.4 Toggle TRUE → FALSE flow

- Commit togglen til `'Nej'` straks. **Ingen popup.**
- Sæt samtidig `eoBilagSelection.midlertidigEet = false` i samme `setFormValues`-opdatering (følger 2.2.1 i tabellen — disabled+unchecked når toggle=false).
- Tabellens indhold ændres ikke. EET-data trækkes nu ikke længere ind i beregningen.

#### 2.1.5 Ydelsestype-dropdown disable

Når togglen er TRUE, skal optionen `Midlertidigt EET` i ydelsestype-dropdownen i `OffentligeYdelserTable` være **deaktiveret** (men stadig synlig, så brugeren forstår, hvorfor).

**Implementering:**
- `OffentligeYdelserTable` modtager en ny prop `midlertidigtEetFraEetSiden: boolean`.
- Når true, marker ydelsestype-optionen `midlertidigt_eet` som disabled. Hover/tooltip: `"Midlertidigt EET indsættes automatisk fra Erhvervsevnetab-siden. Slå funktionen fra i 'Tilføj særligt' for at indtaste manuelt."`
- Bekræft først hvordan ydelsestype-dropdown er implementeret i tabellen (verificér i `OffentligeYdelserTable.tsx` og evt. en delt YdelsestypeDropdown-komponent), og følg det eksisterende disable-mønster (formentlig `MenuItem disabled` med Tooltip wrapper, jf. `renderBilagCheckbox`-mønstret).

**Edge case:** Hvis en eksisterende række (åbnet sag) allerede har `ydelsestype: 'midlertidigt_eet'` og togglen sættes til TRUE, vil brugeren altid bekræfte popup'en og rækkerne slettes — så der findes ikke en kombination af "toggle TRUE + manuel midlertidigt_eet-række i tabellen". Det er en invariant, der skal håndhæves (se §6.1).

### 2.2 Beregning-fanen (`EOberegningTab.tsx`)

#### 2.2.1 Ny logik for bilag-checkbox `midlertidigEet`

Erstatter den nuværende logik i `getEoBilagAvailability`. Den skal nu vide om togglen er aktiv:

| Toggle | EET-siden har midlertidige/delvist endelige afgørelser | Checkbox-tilstand |
|---|---|---|
| `'Nej'` | (ligegyldigt) | `disabled`, programmatisk `checked = false`, tooltip: `"Forudsætter at midlertidigt EET indsættes fra Erhvervsevnetab-siden"` |
| `'Ja'` | Ja (≥ 1 afgørelse) | `enabled`, default `checked = true` |
| `'Ja'` | Nej (0 afgørelser) | `enabled`, brugeren kan markere, men checken har ingen effekt på PDF (ingen rækker at vise) |

**Implementering:**
- `getEoBilagAvailability` modtager allerede `hasMidlertidigEetAfgoerelser`. Tilføj parameteren `midlertidigtEetFraEetSiden: boolean`.
- Beregn `midlertidigEet`-availability:
  - Hvis `!midlertidigtEetFraEetSiden`: `{ enabled: false, disabledReason: 'Forudsætter at midlertidigt EET indsættes fra Erhvervsevnetab-siden' }`.
  - Hvis `midlertidigtEetFraEetSiden`: `{ enabled: true }` (uafhængigt af `hasMidlertidigEetAfgoerelser`).
- Konsekvenser i `EOberegningTab.tsx`:
  - `selectedElements` filtrerer disabled-checks til `false` programmatisk (allerede eksisterende mønster i `EO_BILAG_DYNAMIC_SELECTION_KEYS`-loop). Det betyder, at når toggle = false, vil `selectedElements.midlertidigEet` altid være `false`, selv om persistent `eoBilagSelection.midlertidigEet` skulle være `true`.
  - Når brugeren skifter toggle FALSE → TRUE (efter evt. popup-bekræftelse), skal `eoBilagSelection.midlertidigEet` sættes til `true` i samme commit, jf. 2.1.3.
  - Når brugeren skifter toggle TRUE → FALSE, skal `eoBilagSelection.midlertidigEet` sættes til `false` i samme commit, jf. 2.1.4.

**Bemærk:** `bilagWarningRows`-logikken (id `bilag.midlertidigEet.udenOffentligYdelse`) bruger i dag `hasMidlertidigtEetYdelsestype(eoValues)` til at advare hvis bilaget er valgt men der ikke er midlertidigt_eet-rækker i `offentligeYdelserRows`. Den check er ikke længere meningsfuld når togglen styrer kilden — fjern advarslen helt, eller omskriv den til at tjekke om der reelt er afgørelser fra EET-siden (`midlertidigtEetGroups.length === 0`) når toggle er TRUE og bilaget er valgt. **Beslutning:** Fjern advarslen helt. Når toggle er TRUE og der ingen afgørelser er på EET-siden, er det et helt normalt scenarie (jf. dit svar på spørgsmål 9), og der skal ikke advares. Når toggle er FALSE, kan bilaget alligevel ikke vælges (disabled). Advarslens eksistensgrundlag er væk.

#### 2.2.2 Issues fra EET-løbende-ydelser når toggle = TRUE

Når togglen er TRUE, er beregningen afhængig af EET-siden. Issues fra `computeEetLoebendeYdelser` skal derfor vises i EOberegning-fanens "Fejl og advarsler"-sektion og påvirke download-blokering.

**Datakilde:** `useMidlertidigtEetInsertSource()` returnerer allerede de inputs, `computeEetLoebendeYdelser` har brug for (`eetValues`, `skadedato`). For at undgå dobbeltkald af `computeEetLoebendeYdelser` (det kaldes allerede i `buildMidlertidigtEetAfgoerelseGroups`) refaktoreres source-hook'en til også at eksponere issues — eller vi kalder `computeEetLoebendeYdelser` én gang i `EOberegningTab` og deler resultatet mellem issues-vist og PDF/beregning.

**Foreslået struktur:**
- Lav en ny helper `buildMidlertidigtEetSourceResult(insertSource)` der returnerer `{ groups, issues }`. `groups` er det eksisterende output fra `buildMidlertidigtEetAfgoerelseGroups`; `issues` er `result.issues` fra `computeEetLoebendeYdelser`.
- Memoizér resultatet i `EOberegningTab` og brug både til `midlertidigtEetGroups` (PDF), til debug-rows og til snapshot/beregning (se §4).

**Visning i "Fejl og advarsler" når toggle = TRUE:**
- Konvertér hver `EetIssue` til en `DebugRowWithNavigation`-lignende struktur (samme visuelle rækkeformat som de eksisterende debug-rækker).
- Tekst i venstre kolonne: præfiksér med kontekst, fx `Midlertidigt EET → ${issue.message}` (følg eksisterende mønster i `formatSummaryText`, hvor labelen står først). Verificér i `eoDebugErstatningsopgoerelseModel.ts` hvilket præfiks-format der allerede bruges for cross-page issues, og match dét.
- Højre side: tekst-link der navigerer brugeren til EET-siden, fane "Løbende ydelser". Brug `useNavigate('/erhvervsevnetab')` plus `scrollToSection`-mekanismen som i `EetIssuesBox.tsx`. Verificér om `NavigationTarget`-typen i `eoDebugNavigationMap.ts` allerede har en variant for navigation til EET-siden eller om vi skal udvide den (`kind: 'erhvervsevnetab-page'` med `tabId: 'loebendeYdelser'`). Tilføj den om nødvendigt.

**Severity-mapping:**
- `severity: 'error'` → vises som rød `ErrorOutline`, blokerer download af både EO-PDF og TAF-fordelt-PDF (samme adfærd som eksisterende `errors`-array).
- `severity: 'warning'` → vises som gul `WarningAmber`, blokerer ikke download (samme adfærd som `warnings`-array).

**Visning når toggle = FALSE:** Issues fra EET-løbende-ydelser vises **ikke** i EO. Selv om de findes på EET-siden, er de irrelevante for EO-beregningen, fordi koblingen er deaktiveret.

**Konkrete koblingspunkter i `EOberegningTab.tsx`:**
- `errors` og `warnings` er i dag bygget fra `collectAllDebugRows`. Tilføj en ekstra kilde `eetLoebendeIssuesAsDebugRows` som flettes ind:
  ```ts
  const eetLoebendeIssues = midlertidigtEetFraEetSiden ? sourceResult.issues : [];
  const extraErrors = eetLoebendeIssues.filter(i => i.severity === 'error').map(toDebugRow);
  const extraWarnings = eetLoebendeIssues.filter(i => i.severity === 'warning').map(toDebugRow);
  ```
- Sammenflet med eksisterende `errors`/`warnings` før de bruges til render og download-gating.
- `firstBlockingDebugErrorMessage` skal også inkludere de nye errors (det sker automatisk når de er flettet ind i `errors`-arrayet).

#### 2.2.3 PDF-rendering uændret-men-driverkilde-skift

- "Midlertidig EET"-bilaget renderes via `renderMidlertidigtEetSection` som modtager `groups` (af typen `readonly MidlertidigtEetAfgoerelseGroup[]`).
- I dag sender `EOberegningTab.handleDownloadPdf` `midlertidigtEetGroups` der altid bygges fra source (uafhængigt af toggle).
- **Ny adfærd:** Bilaget skal kun renderes når `midlertidigtEetFraEetSiden === 'Ja'` *og* der findes afgørelser. Når toggle er FALSE, sendes `midlertidigtEetGroups: []` til PDF-renderen, uanset om der er afgørelser på EET-siden.
- Begrundelse (jf. dit follow-up-svar): når toggle er FALSE, er koblingen mellem siderne deaktiveret, og bilaget skal heller ikke vises — selv om der måtte stå manuelle midlertidigt_eet-rækker i tabellen, og selv om der måtte være EET-afgørelser på EET-siden.
- "Offentlige ydelser"-bilaget (separat sektion) viser fortsat alle rækker fra `offentligeYdelserRows` (inkl. evt. manuelle midlertidigt_eet-rækker når toggle = FALSE). Der ændres intet i `renderOffentligeYdelserSection`.

### 2.3 Erhvervsevnetab-siden (uændret)

Der ændres **intet** på selve EET-siden. Den nye toggle påvirker ikke EET's UI, beregning eller PDF.

---

## 3. Schema- og state-ændringer

### 3.1 Schema-evolution

**Tilføj nyt felt** i `erstatningsopgoerelseBaseSchema` (`src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts`):

```ts
midlertidigtEetFraEetSiden: jaNejEnum.default('Nej'),
```

Placering: i nærheden af de andre boolean-lignende ja/nej-felter (fx `revideretOpgoerelse`, `indsaetUdkastStempel`).

**Backward compatibility:** Eksisterende sager uden feltet får `'Nej'` ved schema-coalesce (Zod's `.default()`). Det matcher migrations-aftalen i §B i diskussionen: ingen sag ændrer adfærd ved blot at blive åbnet.

### 3.2 Atomiske form-opdateringer

Toggle-commit der både ændrer togglen og rydder op i andre felter, skal ske i **én** `setFormValues`-opdatering, ikke flere sekventielle. Eksempel for FALSE → TRUE med bekræftelse:

```ts
setFormValues((prev) => ({
  ...prev,
  midlertidigtEetFraEetSiden: 'Ja',
  offentligeYdelserRows: prev.offentligeYdelserRows.filter(
    (row) => row.ydelsestype?.trim() !== 'midlertidigt_eet'
  ),
  midlertidigtEETAfgoerelseGrupper: [], // ryd legacy-state, jf. §3.3
  eoBilagSelection: {
    ...prev.eoBilagSelection,
    midlertidigEet: true,
  },
}));
```

**Hvorfor atomisk:** Hvis vi splitter til to `setFormValues`-kald, vil snapshot-revisionen nå at re-render med en inkonsistent mellemtilstand (toggle = TRUE, men midlertidigt_eet-rækker stadig i tabellen). Det giver en kortvarig "double counting"-tilstand i TAF-beregningen, hvor rækkerne både er i tabellen *og* injiceres virtuelt.

### 3.3 Legacy-felt: `midlertidigtEETAfgoerelseGrupper`

Det eksisterende felt `midlertidigtEETAfgoerelseGrupper: { afgoerelsesdato, rowIds }[]` peger på rowIds i `offentligeYdelserRows`. Det blev opdateret af den gamle "Indsæt"-knap.

**Beslutning:** Behold feltet i schema for nu (af hensyn til backward compatibility med gemte sager) men:
- Det opdateres ikke længere af nogen handler.
- Sæt det til `[]` ved toggle FALSE → TRUE-bekræftelse (rækkerne det refererer til slettes alligevel).
- Det bruges ingen steder i ny kode. Eksisterende læsninger (hvis nogen) skal verificeres og fjernes.

**Verifikationsopgave:** Søg `midlertidigtEETAfgoerelseGrupper` i kodebasen og bekræft, at det ikke har andre formål end den gamle Indsæt-knap. Hvis intet bruger det, mark det som deprecated i schema-kommentar; en senere oprydning kan fjerne det helt via en schema-migration. Fjernelse er **ikke** del af denne implementering for at minimere blast radius.

---

## 4. Beregningslogik (transient virtuelle rækker)

### 4.1 Hvor og hvordan injiceres rækkerne

Beregningen af TAF og afledte tal sker i `computeEoSnapshot` (kaldes i `Erstatningsopgoerelse.tsx`). Snapshot-builderen modtager `eoValues` og bygger den kanoniske beregningsmodel via `indtaegtPerioder.ts` og videre.

**Kerneprincippet:** De virtuelle rækker må **aldrig** persisteres til form-state. De skal injiceres *transient* — kun under beregningen.

**Forslag til arkitektur** (skal afstemmes mod eksisterende mønstre i snapshot-pipelinen):

1. Beregn `midlertidigtEetGroups` via `buildMidlertidigtEetAfgoerelseGroups({ eetValues, skadedato })` som i dag.
2. Hvis `eoValues.midlertidigtEetFraEetSiden === 'Ja'`, byg en `OffentligeYdelserRow[]` af de virtuelle rækker (svarer til `groups.flatMap(g => g.rows)`).
3. Lav en *afledt* `effectiveOffentligeYdelserRows` der er:
   - Hvis toggle = `'Ja'`: `[...eoValues.offentligeYdelserRows, ...virtualRows]` (eller alternativt: erstat alle eksisterende midlertidigt_eet-rækker med virtuelle — men da invariant fra §6.1 garanterer at der ingen eksisterende midlertidigt_eet-rækker er når toggle = TRUE, er en simpel concat sikker. Vi skal dog forsvare invarianten med en defensiv `assert` eller filter for robusthed).
   - Hvis toggle = `'Nej'`: `eoValues.offentligeYdelserRows` (uændret).
4. Send `effectiveOffentligeYdelserRows` videre i alle nedstrøms-beregninger (TAF-engine, indtægts-perioder, debug-aggregator, control-check).

**Scope af ændring:** Alle steder i `domain/erstatningsopgoerelse/` der i dag læser `values.offentligeYdelserRows` for **beregning** skal bruge `effectiveOffentligeYdelserRows` i stedet. Steder der læser dem for **rendering af tabellen** eller **PDF "Offentlige ydelser"-bilaget** skal fortsat bruge `values.offentligeYdelserRows` (uden virtuelle).

**Konkrete kandidater til opdatering** (ikke udtømmende — verificér ved implementering):
- `indtaegtPerioder.ts` linje 157 og 390 — begge bruges i TAF-beregning.
- `eoBilagRules.ts`: `hasOffentligeYdelserEoBilagData`, `hasMidlertidigtEetYdelsestype` — disse bruges til at bestemme bilag-availability og er **ikke** beregnings-kritiske, men `hasMidlertidigtEetYdelsestype` skal håndteres specifikt — se §2.2.1 (advarslen fjernes).
- `eoDebugErstatningsopgoerelseModel.ts` og `eoDebugRowAggregator.ts`: debug-visning skal afspejle de effektive rækker, så debug-tabellen viser, hvad der reelt indgår i beregningen. Verificér konsistensen.
- PDF-renderen `renderOffentligeYdelserSection` skal **ikke** ændres — den læser fra `values.offentligeYdelserRows` direkte og skal fortsat kun vise de manuelt indtastede rækker. Dette honorerer dit svar på spørgsmål 5.

### 4.2 Snapshot-revision

`eoSnapshot`-revisionen er bygget fra `getSectionRevisionSnapshot('stamdata')` + `getSectionRevisionSnapshot('erstatningsopgoerelse')` + field-error-revisions. Når togglen er TRUE og brugeren ændrer noget på EET-siden, skal snapshottet re-bygges, fordi outputtet afhænger af `erhvervsevnetab` og `faellesAarsloen`-sektionerne.

**Konsekvens:** Revisions-sammensætningen skal udvides til også at inkludere `getSectionRevisionSnapshot('erhvervsevnetab')` + `getSectionRevisionSnapshot('faellesAarsloen')` **når togglen er TRUE**.

**Implementering:** Den enkleste tilgang er altid at inkludere de to revisioner i revision-strengen, uanset toggle-state. Det gør cache-key'en lidt mere flygtig (rebuild ved EET-ændringer selv når toggle = false), men:
- Computational cost er minimal — `computeEoSnapshot` kører hurtigt ved ren input-ændring.
- Risikoen for stale snapshot er nul — vi har én simpel regel.
- Konsistent med den eksisterende kontrakt-undtagelse (§9 i domain-boundary-contract.md), som tillader EO at læse de tre sektioner uafhængigt af toggle.

Alternativt: gør revisions-listen toggle-betinget. Det er mere optimalt men mere komplekst. **Beslutning:** Start med altid-inklusion, optimér kun hvis profilering viser problem.

### 4.3 PDF-bilagets driver-kilde

`midlertidigtEetGroups` der sendes til `renderMidlertidigtEetSection` skal være:
```ts
const groups = (eoValues.midlertidigtEetFraEetSiden === 'Ja')
  ? buildMidlertidigtEetAfgoerelseGroups(insertSource)
  : [];
```

Dette gælder også for det tilfælde hvor toggle = FALSE og brugeren har manuelle midlertidigt_eet-rækker i tabellen, og hvor der måske findes afgørelser på EET-siden. Bilaget vises ikke. (Dit follow-up-svar.)

---

## 5. Kontrakter og dokumentation

### 5.1 `domain-boundary-contract.md` §9 ("Snæver EO-import af midlertidigt EET")

Den eksisterende kontrakt §9 beskriver knap-baseret indsættelse. Den skal opdateres til at dække den nye toggle-baserede transient injection.

**Konkret tekst-ændring** (pkt. 2 og 7 omskrives):
- Pkt. 2: `"Undtagelsen gælder kun knappen, der indsætter midlertidigt_eet-rækker i EO-tabellen"` → `"Undtagelsen gælder togglen 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden' på Offentlige ydelser-fanen, samt den virtuelle injection denne toggle aktiverer i EO-beregning og PDF."`
- Tilføj nyt pkt. 8: `"Virtuelle rækker injiceres aldrig i committed form-state. EET er den autoritative kilde, og EO-data forbliver upåvirket af EET-ændringer på persistens-niveau."`

### 5.2 `eo-snapshot-contract.md`

Beskriv at snapshottet — når `midlertidigtEetFraEetSiden === 'Ja'` — afhænger af to ekstra kilder (`erhvervsevnetab` og `faellesAarsloen`). Tilføj sektion "Transient EET-injection" der dokumenterer:
- Hvor injectionen sker.
- At rækkerne aldrig persisteres.
- At PDF-bilaget "Offentlige ydelser" *ikke* viser virtuelle rækker.
- At PDF-bilaget "Midlertidig EET" *kun* renderes når togglen er TRUE.

### 5.3 Inline-kommentar i `midlertidigtEetInsertRows.ts`

Den eksisterende kommentar (linje 88-96) beskriver "EO-importen" som knap-baseret. Opdatér til at beskrive både den (nu fjernede) knap og den nye toggle-baserede transient injection.

---

## 6. Invarianter og fejlrisici

### 6.1 Invariant: ingen midlertidigt_eet-rækker når toggle = TRUE

**Påstand:** Når `eoValues.midlertidigtEetFraEetSiden === 'Ja'`, må `eoValues.offentligeYdelserRows` ikke indeholde rækker med `ydelsestype === 'midlertidigt_eet'`.

**Hvordan håndhæves:**
- UI: Toggle FALSE → TRUE rydder op (popup + filter).
- UI: Når toggle = TRUE, er ydelsestype-dropdown-optionen disabled.
- Defensiv: I beregningen kan vi yderligere filtrere `eoValues.offentligeYdelserRows.filter(r => r.ydelsestype !== 'midlertidigt_eet')` før concat med virtuelle rækker, så selv en kontraktbrudt state ikke giver dobbelt-tælling.
- Validator: Tilføj en invariants-check i `eoSnapshot` der rapporterer som system-fejl (`source: 'system'`), hvis kombinationen findes — det indikerer en bug, ikke et brugerfejl.

**Hvorfor vigtigt:** Hvis invariantet brydes, vil rækkerne både stå i tabellen *og* injiceres virtuelt → dobbelt fradrag i TAF. Det er en kritisk korrekthedsfejl.

### 6.2 Invariant: bilag-checkbox `midlertidigEet` følger toggle

**Påstand:** Når toggle skifter fra TRUE til FALSE, sættes `eoBilagSelection.midlertidigEet = false`. Når toggle skifter fra FALSE til TRUE, sættes `eoBilagSelection.midlertidigEet = true`.

**Hvordan håndhæves:** Atomisk i samme `setFormValues`-kald som toggle-commit (§3.2).

### 6.3 Race conditions ved toggle-commit

`StyledToggleSwitch` er fully controlled og immediate-commit. Vi har derfor ingen blur/commit-timing-problemer som i `StyledDateField`.

**Edge case:** Hvis brugeren trykker togglen, popup'en vises, og brugeren samtidig skifter til en anden fane før de bekræfter — popup'en skal forblive åben (dialog er modal). Verificér at `<ConfirmationDialog>` faktisk er modal i den eksisterende implementering.

### 6.4 Stale `midlertidigtEetGroups` i snapshot-cache

Når toggle = TRUE og brugeren ændrer EET-siden, skal beregning og PDF afspejle ændringerne straks. Dette håndteres af snapshot-revisionen (§4.2). 

**Verifikation:** I `useMidlertidigtEetInsertSource` er der allerede en cache baseret på sektions-referencer. Den invalideres automatisk ved enhver ændring i `stamdata`, `erhvervsevnetab` eller `faellesAarsloen`. Hooket bruger `useSyncExternalStore`, så React får besked. Bekræft at snapshot-rebuild trigges korrekt — test ved at åbne EO-fanen, ændre på EET-siden, og verificere at TAF-beregningen ændrer sig uden manuel reload.

### 6.5 EET-issues uden tilsvarende UI på EET-siden

Hvis en EET-issue kun manifesterer sig når man besøger EET-siden første gang (fx field-errors fra Zod-coalesce), kan brugeren komme i en situation hvor EO blokerer download med en fejl, men brugeren har endnu ikke set fejlen på EET-siden.

**Mitigerende foranstaltning:**
- Højre-side-link i EO's "Fejl og advarsler" navigerer til EET-siden, fane "Løbende ydelser" — så brugeren kan se fejlen i kontekst.
- Verificér at `computeEetLoebendeYdelser` producerer self-contained issue-meddelelser, der giver mening uden at man har set EET-siden. Stikprøve af eksisterende issues (`'Årsløn er ikke udfyldt.'`, `'Skadedato er ikke udfyldt.'` osv.) ser fornuftige ud.

### 6.6 Edge case: skadedato eller fødselsdato mangler

`computeEetLoebendeYdelser` returnerer issues `'Skadedato er ikke udfyldt.'` og `'Fødselsdato er ikke udfyldt.'` (begge severity error). Disse vil derfor blokere EO-download når toggle = TRUE.

Det er den korrekte adfærd: uden skadedato kan man ikke beregne perioderne korrekt.

**Eksempel:** Bruger åbner ny sag, går direkte til Offentlige ydelser, slår togglen til. Stamdata er tom. → EO-download er blokeret med fejlen "Skadedato er ikke udfyldt." og link til EET-siden (som så igen linker til stamdata). Det er en lidt indirekte UX, men korrekt fail-closed.

### 6.7 Edge case: togglen er TRUE men EET-siden er tom

Helt normalt scenarie (jf. spørgsmål 9). Ingen advarsel, ingen popup. `midlertidigtEetGroups = []`, ingen virtuelle rækker injiceres, ingen Midlertidig EET-bilag i PDF. EO-beregningen kører som om der ikke var nogen offentlige ydelser overhovedet (fra denne kilde).

### 6.8 Edge case: skema-validation efter rækkesletning

Når toggle FALSE → TRUE filtrerer midlertidigt_eet-rækker væk, kan tabellen i særlige tilfælde blive helt tom. `OffentligeYdelserTable` har sandsynligvis logik for tom tabel (en trailing empty row). Verificér at filtrering plus efterfølgende re-render ikke producerer en ugyldig state (fx mangel på trailing empty row der skal genskabes).

---

## 7. Tests

### 7.1 Domænetests (prioriteret før UI)

**Ny testfil:** `src/__tests__/domain/erstatningsopgoerelse/midlertidigtEetTransientInjection.test.ts`

- **Beregning, toggle = FALSE:** Ingen virtuelle rækker injiceres. TAF-beregning ignorerer EET-data, selv hvis EET har afgørelser.
- **Beregning, toggle = TRUE, EET tom:** Ingen virtuelle rækker. Beregning kører som hvis offentlige ydelser var tom.
- **Beregning, toggle = TRUE, EET med 1 midlertidig afgørelse med 2 perioder:** 2 virtuelle rækker indgår i TAF-fradrag. Beløb og perioder matcher EET-løbende-beregningens output 1:1.
- **Beregning, toggle = TRUE, EET med blanding af afgørelsestyper:** Kun `Midlertidig` og `Delvist endelig` indgår; `Endelig` ignoreres (ufaktisk på linje med eksisterende kontrakt).
- **Round-trip, toggle = TRUE → FALSE → TRUE:** Beregningen er deterministisk og identisk mellem de to TRUE-tilstande, givet at EET-input er uændret.
- **Invariant 6.1 violation:** Hvis form-state alligevel indeholder midlertidigt_eet-rækker når toggle = TRUE (kunstig konstruktion), skal beregningen filtrere dem væk og ikke dobbelt-tælle. Test at fail-safe-filter virker.

**Eksisterende testfil:** `src/__tests__/domain/erstatningsopgoerelse/midlertidigtEetInsertRows.test.ts`
- Behold som-er, da `buildMidlertidigtEetAfgoerelseGroups` ikke ændrer adfærd. Tilføj evt. en kommentar om at funktionen nu også bruges af toggle-pathway.

**Eksisterende testfil:** `src/__tests__/domain/erstatningsopgoerelse/eoBilagRules.test.ts`
- Opdatér tests for `getEoBilagAvailability.midlertidigEet`. Nu skal availability afhænge af `midlertidigtEetFraEetSiden`-toggle, ikke af `hasMidlertidigEetAfgoerelser`.
- Tilføj test for de tre rækker i tabellen i §2.2.1.

### 7.2 PDF-tests

**Eksisterende testfil:** `src/__tests__/utils/pdf/erstatningsopgoerelse/sections/offentligeYdelserSection.test.ts`
- Tilføj test: når toggle = FALSE og der er manuelle midlertidigt_eet-rækker i tabellen, vises de i "Offentlige ydelser"-bilaget (uændret adfærd).
- Tilføj test: når toggle = TRUE, vises midlertidigt_eet-rækker **ikke** i "Offentlige ydelser"-bilaget (fordi de ikke er i tabellen).

**Eksisterende testfil:** `src/__tests__/utils/pdf/pdfService.downloadFunctions.test.ts` (allerede har midlertidigt_eet-cases)
- Opdatér til at bruge togglen i stedet for direkte `midlertidigtEETAfgoerelseGrupper`.
- Test: toggle = TRUE + EET-afgørelser → "Midlertidig EET"-bilag renderes.
- Test: toggle = FALSE + EET-afgørelser → "Midlertidig EET"-bilag renderes **ikke**.
- Test: toggle = TRUE + EET tom → "Midlertidig EET"-bilag renderes ikke.

### 7.3 UI-tests

**Eksisterende:** `src/__tests__/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.keyboardNavigation.test.tsx`
- Opdatér til at reflektere at "Indsæt"-knappen er fjernet og erstattet af togglen.
- Tilføj keyboard-navigationstest for togglen (Tab-rækkefølge, Enter/Space toggler).

**Ny testfil:** `src/__tests__/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.toggle.test.tsx`
- Toggle FALSE → TRUE uden eksisterende midlertidigt_eet-rækker: ingen popup, toggle commits straks, bilag-checkbox sættes til true.
- Toggle FALSE → TRUE med 1+ midlertidigt_eet-rækker: popup vises, ved annullering forbliver toggle FALSE og rækker bevares, ved bekræftelse sættes toggle = TRUE og rækker filtreres væk.
- Toggle TRUE → FALSE: ingen popup, toggle commits straks, bilag-checkbox sættes til false.
- Ydelsestype-dropdown disable: når toggle = TRUE, kan brugeren ikke vælge "Midlertidigt EET".

**Ny testfil:** `src/__tests__/components/pages/erstatningsopgoerelse/EOberegningTab.eetIssues.test.tsx`
- Toggle = TRUE + EET-issue (severity error) → EOberegning viser fejlen i "Fejl og advarsler", blokerer download.
- Toggle = TRUE + EET-issue (severity warning) → vises som warning, blokerer ikke.
- Toggle = FALSE + samme EET-issues → vises **ikke** i EO.
- Bilag-checkbox `midlertidigEet`-tilstand for de tre rækker i §2.2.1.

### 7.4 Save/load round-trip

Eksisterende `persistenceAccessIsolation.test.ts` skal verificeres uændret.

**Ny test:** Save/load med toggle = TRUE (uden midlertidigt_eet-rækker i tabellen). Round-trip skal bevare togglen og ikke skrive virtuelle rækker til persistens.

---

## 8. Implementeringsrækkefølge (stadier)

### Stadie 1: Schema og fundament (ingen UI-ændring)
1. Tilføj `midlertidigtEetFraEetSiden: jaNejEnum.default('Nej')` til `erstatningsopgoerelseBaseSchema`.
2. Opdatér Zod-schema-tests og initial-values.
3. Verificér at eksisterende sager loader uden ændring (default `'Nej'`).
4. **Test:** kør hele test-suiten. Den skal være grøn. Ingen funktionel ændring endnu.

### Stadie 2: Transient injection-mekanisme i beregning
1. Implementér `effectiveOffentligeYdelserRows` (eller tilsvarende) i den centrale beregningspath, gated på `midlertidigtEetFraEetSiden === 'Ja'`.
2. Tilføj defensivt filter (§6.1).
3. Skriv domænetests (§7.1) — alle skal være grønne før vi rører UI.
4. Verificér at toggle-state stadig er `'Nej'` for alle eksisterende sager → ingen adfærdsændring i praksis.

### Stadie 3: UI på Offentlige ydelser-fanen
1. Slet eksisterende "Indsæt"-knap og tilhørende handlere/dialogs.
2. Tilføj toggle med popup-flow.
3. Tilføj atomisk commit-handler (§3.2).
4. Tilføj ydelsestype-disable i dropdown.
5. UI-tests (§7.3).

### Stadie 4: UI på Beregning-fanen
1. Opdatér `getEoBilagAvailability` til at bruge `midlertidigtEetFraEetSiden`.
2. Fjern `bilagWarningRows` for `midlertidigEet` (jf. §2.2.1 sidste afsnit).
3. Opdatér `midlertidigtEetGroups`-build til at honorere toggle-state.
4. Implementér EET-issues-visning i "Fejl og advarsler" + navigation til EET-siden.
5. Sammenflet med eksisterende `errors`/`warnings` for download-gating.
6. UI-tests (§7.3).

### Stadie 5: PDF og snapshot-revision
1. Verificér at `renderMidlertidigtEetSection` kun renderes når toggle = TRUE.
2. Verificér at `renderOffentligeYdelserSection` ikke ændres.
3. Opdatér snapshot-revision til altid at inkludere EET- og fællesAarsloen-revisioner (§4.2).
4. PDF-tests (§7.2).

### Stadie 6: Kontrakt-opdateringer og oprydning
1. Opdatér `domain-boundary-contract.md` §9 (§5.1).
2. Opdatér `eo-snapshot-contract.md` (§5.2).
3. Opdatér inline-kommentar i `midlertidigtEetInsertRows.ts` (§5.3).
4. Markér `midlertidigtEETAfgoerelseGrupper` som deprecated i schema-kommentar (§3.3).

### Stadie 7: Endelig verifikation
1. Kør hele test-suiten.
2. Manuel UI-test af alle scenarier i §6 (edge cases) plus de tre matrix-rækker i §2.2.1.
3. Save/load round-trip-test med toggle i begge tilstande.
4. Verificér PDF-output i begge tilstande visuelt.
5. Verificér at EET-siden ændringer i live-browser udløser EO-rebuild (toggle = TRUE).

---

## 9. Filer der berøres (overslag)

**Ændres:**
- `src/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.tsx` — fjern knap, tilføj toggle, popup-flow.
- `src/components/pages/erstatningsopgoerelse/EOberegningTab.tsx` — bilag-availability, EET-issues-visning.
- `src/components/pages/Erstatningsopgoerelse.tsx` — passing-through af toggle-state hvis nødvendigt.
- `src/components/tables/OffentligeYdelserTable.tsx` — disable af `midlertidigt_eet` ydelsestype-option.
- `src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts` — nyt felt.
- `src/domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues.ts` — default for nyt felt.
- `src/domain/erstatningsopgoerelse/helpers/eoBilagRules.ts` — opdateret `getEoBilagAvailability` og `bilagWarningRows`.
- `src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts` (eller tilsvarende) — transient injection.
- `src/domain/erstatningsopgoerelse/helpers/indtaegtPerioder.ts` — modtage `effectiveOffentligeYdelserRows` (afhænger af refaktor-strategi).
- `src/domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows.ts` — opdateret kommentar.
- `src/contracts/domain-boundary-contract.md` — opdateret §9.
- `src/contracts/eo-snapshot-contract.md` — ny sektion om transient injection.
- `src/domain/debug/eoDebugNavigationMap.ts` — evt. ny `NavigationTarget`-variant for EET.

**Tilføjes:**
- `src/__tests__/domain/erstatningsopgoerelse/midlertidigtEetTransientInjection.test.ts`
- `src/__tests__/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.toggle.test.tsx`
- `src/__tests__/components/pages/erstatningsopgoerelse/EOberegningTab.eetIssues.test.tsx`

**Slettes:**
- Ingen filer slettes. (Den gamle Indsæt-handler-kode lever inde i `OffentligeYdelserTab.tsx` og fjernes derfra.)

---

## 10. Åbne tekniske beslutninger overladt til implementering

Som aftalt overlades følgende kode-relaterede beslutninger til implementering, med præference for at følge eksisterende mønstre:

1. **Eksakt placering af `effectiveOffentligeYdelserRows`-deriveringen.** Snapshot-builderen er det mest naturlige sted, men kan også være en separat helper kaldt fra både snapshot og evt. andre konsumenter.
2. **Strategi for at sammenflette EET-issues med eksisterende debug-rows.** Enten direkte konvertering til `DebugRowWithNavigation`-typen, eller en separat row-type med samme renderer.
3. **Eksakt tooltip-tekst på disabled ydelsestype-option.** Forslag i §2.1.5; kan justeres for konsistens med andre tooltips.
4. **Rækkefølge i "Fejl og advarsler"-listen.** EET-fejl kan komme før eller efter eksisterende EO-fejl. Følg eksisterende sortering hvis der er en kanonisk rækkefølge; ellers placer EET-issues efter EO-issues, da de har lavere lokal prioritet.
5. **Eventuel renaming af legacy-feltet `midlertidigtEETAfgoerelseGrupper`.** Anbefales ikke i denne implementering; udskydes til en senere oprydning.

---

## 11. Sammenfatning af adfærd (referencetabel)

| Scenarie | UI-effekt | Beregningseffekt | PDF-effekt |
|---|---|---|---|
| Toggle = FALSE, ingen midlertidigt_eet-rækker, ingen EET-afgørelser | Toggle off, dropdown enables alle ydelsestyper, bilag-checkbox disabled | Ingen midlertidigt_eet i TAF | Intet Midlertidig EET-bilag |
| Toggle = FALSE, manuelle midlertidigt_eet-rækker, ingen EET-afgørelser | Som ovenfor, men tabellen viser de manuelle rækker | Manuelle rækker indgår i TAF (uændret adfærd) | Manuelle rækker vises i Offentlige ydelser-bilaget; intet Midlertidig EET-bilag |
| Toggle = FALSE, manuelle midlertidigt_eet-rækker, EET-afgørelser findes | Som ovenfor — EET-siden ignoreres | Kun manuelle rækker indgår; EET ignoreres | Kun manuelle rækker vises; intet Midlertidig EET-bilag (selv om EET har afgørelser) |
| Toggle = TRUE, ingen EET-afgørelser | Toggle on, dropdown disabler midlertidigt_eet, bilag-checkbox enabled (uden effekt) | Ingen virtuelle rækker; ingen midlertidigt_eet i TAF | Intet Midlertidig EET-bilag |
| Toggle = TRUE, EET-afgørelser findes | Som ovenfor | Virtuelle rækker injiceres transient i TAF | Midlertidig EET-bilag renderes med beregningsdetaljer; ingen midlertidigt_eet-rækker i Offentlige ydelser-bilaget |
| Toggle = TRUE, EET-side har blokerende fejl | Som toggle = TRUE; EOberegning viser fejl i "Fejl og advarsler" med link til EET-siden | Beregning blokeres | Download blokeres for både EO-PDF og TAF-fordelt-PDF |
| Toggle = TRUE, EET-side har advarsel | Advarsel vises i EOberegning med link | Beregning kører | Download tilladt |

---

## 12. Risici og mitigering (sammenfatning)

| Risiko | Mitigering |
|---|---|
| Dobbelttælling af midlertidigt EET (manuel række + virtuel) | UI-invariant + defensiv filter i beregning + system-invariant-check (§6.1) |
| Stale snapshot ved EET-ændring | Altid inkludér EET- og fællesAarsloen-revisioner i snapshot-revision (§4.2) |
| Migration af eksisterende sager ændrer adfærd ved load | Default `'Nej'` for togglen sikrer ingen automatisk ændring (§3.1, §B) |
| Bilag-checkbox `midlertidigEet` desync med toggle | Atomiske form-opdateringer (§3.2, §6.2) |
| Inkonsistent UI-state under FALSE → TRUE-flow ved annullering | Toggle er fuldt controlled; vi sætter aldrig værdien før bekræftelse (§2.1.3) |
| EET-fejl giver kryptisk besked i EO uden kontekst | Højre-side-link til EET-siden, fane "Løbende ydelser" (§2.2.2) |
| Glemte read-paths af `offentligeYdelserRows` der bør bruge effective | Verifikation i Stadie 2 + domænetests dækker hovedstier (§7.1) |

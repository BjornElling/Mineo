# WI-009: Ét neutralt source-settings-snapshot (rodårsag bag WI-008's C4)

- **Status:** `gennemført` 2026-07-26, **slutreview gennemført og alle fund rettet** samme dag.
  Se §Udfald og §Slutreview nederst.
- **Oprettet:** 2026-07-26
- **Kilde:** codex sol/high-review af Fase 5's første halvdel, fund C4. Udskilt fra WI-008, fordi
  roden ligger i input-runtime/settings-arkitekturen, ikke i dokumentlaget.
- **Risikoklasse:** **H** — friskhedskæden (`EvaluationSourceToken`) afhænger af den. En manglende
  nøgle betyder, at en download godkendt under den gamle regel kan overleve et regelskift.

## Problemet

Der findes ikke ÉN værdi, der definerer "hvad gør et optaget `EvaluationSourceToken` stale". I stedet
findes tre uafhængige steder, som skal holdes i sync i hånden:

1. `evaluationSettingsFingerprint` (`src/inputCore/react/productionInputRuntime.tsx`) — afgør
   settingsrevisionen og dermed hvornår et token bliver stale.
2. Det, evalueringen FAKTISK læser gennem `createInputEvaluation(..., settings)` og de
   descriptor-/consumer-validatorer, den kalder.
3. Dokumentcapture, som læser sin egen form.

WI-008's pass 0 lukkede halvdelen af hullet: `DocumentSourceSettings` +
`SOURCE_RELEVANT_SETTINGS_KEYS` med compile-time completeness gør nu, at fingerprintet UDLEDES af en
eksplicit erklæret nøgleliste, og at listen ikke kan komme fra typen (mutationstestet). Det der
mangler, er punkt 2: **intet håndhæver, at evalueringen kun læser nøgler INDEN FOR sættet.** En ny
`settings`-læsning i en validator eller row-builder vil derfor stadig kunne indføre en
source-afhængighed, der ikke gør et token stale — og fejlklassen er tavs.

## Foreslået løsning (fra reviewet, ikke besluttet)

- Én exhaustiv projector fra `AppSettings` → source-settings-snapshot. Præcis DEN værdi skal drive
  evaluering, settingsrevision/fingerprint OG dokumentcapture, så de tre ikke kan divergere.
- Et AST-/type-værn, der beviser, at ingen evalueringsafhængig kodesti læser en settings-nøgle uden
  for sættet. **Mutationstest værnet** (jf. guard-selvtest-princippet i AGENTS.md): kan det fejle?
- Overvej at gøre `AppSettings` utilgængelig for evalueringen ad typevejen, så kun snapshottet kan
  nås — det gør fejlklassen urepræsenterbar frem for blot opdaget.

## Bemærk

Der er **ingen kendt live fejl i dag**: de nøgler, evalueringen faktisk læser, ER med i sættet
(enumereret i WI-008's B2). Dette er et manglende værn, ikke en aktiv defekt. Roden hører i Fase 6's
håndhævelsesarbejde.

## Relateret

- `work-items/WI-008-fase5-dokumentoutputs.md` — B2 (den oprindelige, delvist forkerte begrundelse),
  C4 (reviewets fund) og `documentSourceSettings.ts` (den halve lukning).
- `work-items/WI-005-ansvarsbaserede-arkitekturvaern.md` — samme familie af håndhævelsesarbejde.

---

## Kortlægning (2026-07-26, opus/high)

### Navneændring siden WI'en blev skrevet

WI'ens §Problemet nævner `DocumentSourceSettings` + `SOURCE_RELEVANT_SETTINGS_KEYS` i
`src/inputCore/documentSourceSettings.ts`. Den fil findes ikke længere. Fase 6's genåbning flyttede
grænsen til **`src/settings/sourceSettings.ts`** med `SourceSettings` +
`SOURCE_SETTINGS_KEYS` + `projectSourceSettings`. Indholdet svarer til WI'ens beskrivelse; kun
navnene er nye. Sættet er i dag fire nøgler:

| Nøgle | Læses af |
|---|---|
| `documentDownloadFormat` | dokumentcapture (`DocumentRenderSettings`) |
| `brevhovedIndstillinger` | dokumentcapture (`DocumentRenderSettings`) |
| `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden` | EO-rækkeevaluering (`EoRowPolicy`) |
| `allowReguleringMedUdloebMedMaaneder` | EO-rækkeevaluering (`EoRowPolicy`) |

### Det centrale fund: `SourceSettings` er strukturel og derfor ingen grænse

`SourceSettings` er en almindelig strukturel type. `AppSettings` har alle fire nøgler og er derfor
**assignable til `SourceSettings` overalt**. Konsekvensen er, at hver `SourceSettings`-parameter i
dag er en *dokumentationsgrænse*, ikke en håndhævet grænse:

- `projectSourceSettings(settings: SourceSettings)` tager `SourceSettings` — ikke `AppSettings`.
  Projektoren kan altså ikke være den udtømmende indsnævring, WI'en beder om: den modtager en
  værdi, der allerede kunne være hele `AppSettings`, og har ingen måde at afvise en bredere værdi.
- `productionInputRuntime.tsx:58` og `:104-109` sender hele `publishedSettings: AppSettings` ind i
  `captureStableInputEvaluation`/`createInputEvaluation`. Typeparameteren `TSettings` er fri, så
  evalueringen får den brede type — præcis punkt 2 i WI'ens problembeskrivelse.
- `collectAllEoRows(..., rowPolicy: EoRowPolicy, ...)` er korrekt typet, men kaldes fra
  `useEoBeregningViewModel.ts:224` med hele `settings`. Runtime ser derfor det brede objekt
  (deep-frozen klon af ALT), og en ny nøglelæsning i en row-builder ville compilere.

Dette er **samme mønster, som Fase 6 blev genåbnet på**: et vidne/en type oven på en fortsat åben
capability er en aftale, ikke en grænse. Rettelsen skal derfor følge samme lære — *fjern
capabilityen frem for at bevogte den*: source-settings-snapshottet gøres **nominelt**, så en bred
`AppSettings` ikke kan flyde ind i evaluering, EO-rowpolicy eller dokumentcapture.

### Ingen live defekt — WI'ens antagelse holder, men af en anden grund end anført

Én forekomst så først ud som en aktiv fejl: `isLoenindkomstAnsaettelsesforholdEffectivelyEmpty`
(`eoRowIndkomstModel.ts:116`) tager hele `AppSettings` og læser TO nøgler uden for sættet —
`defaultFuldLoenUnderFerie` og (via `resolveDefaultOverenskomstFilter`) overenskomstfilter-defaults.
Den kaldes fra EO-rækkeevalueringens mappe.

Den er dog **ikke gatens prædikat**: eneste kaldssted er
`eoInspektionPageViewModel.ts:213`, altså DEV-inspektionen. Det er allerede dokumenteret i
`eoRowExecutionContext.ts:44-45`. Ingen download godkendes eller blokeres på den. WI'ens
"ingen kendt live fejl i dag" står altså — men begrundelsen er ikke "de læste nøgler er med i
sættet"; den er "den ene læsning uden for sættet ligger uden for gatens sti". Forskellen betyder
noget: der er intet, der HOLDER den uden for gatens sti.

`createDefaultLoenindkomstAnsaettelsesforhold(settings?: AppSettings)` læser også bredt, men er
en ny-sags-seed (ikke evaluering) og ligger bevidst uden for sættet. Den skal blive ved med at
kunne læse hele `AppSettings`.

## Beslutninger

### B1 — Nominelt snapshot frem for AST-værn

**Valgt:** `SourceSettings` gøres nominel (unique-symbol-brand), og `projectSourceSettings` bliver
dens ENESTE konstruktør med signaturen `(settings: AppSettings) => SourceSettings`. Så er
"evalueringen læser kun nøgler inden for sættet" en compilerfejl at bryde, ikke et mønster at
scanne efter. `TSettings` i `createInputEvaluation` forbliver generisk (kernen skal ikke kende
Mineos settings), men produktionsbindingen kan kun levere det nominelle snapshot.

**Fravalgt:** WI'ens foreslåede AST-værn som primær lukning. Per
[[project_typed_write_boundary_over_ast_guard]] er typen førstevalget; et AST-værn oven på en åben
strukturel type er netop det, Fase 6's genåbning afviste. Der tilføjes kun et smalt AST-værn til
brandede typers kendte loft (`{} as SourceSettings`-assertion + uautoriserede kaldere af
projektoren), svarende til `input/write-boundary`s rest efter samme afvejning.

### B2 — DEV-inspektionens brede læsning flyttes ikke

`isLoenindkomstAnsaettelsesforholdEffectivelyEmpty` beholder `AppSettings`, men flyttes UD af
`eoRowEvaluation/` til inspektionslaget, hvis den ikke har andre kaldere der. Så er "row-evaluering
kan ikke læse bredt" en strukturel egenskab af mappen frem for en kommentar, der beder om tillid.
Afgøres med koden i hånden i pass 2.

**Udfald:** ikke flyttet. Funktionens eneste kalder er `eoInspektionPageViewModel.ts:213`, og den
brede `AppSettings` er nu afskåret fra rækkeevalueringen ad TYPEVEJEN i stedet:
`EoRowEvaluationContext.rowPolicy` er nominel, så ingen row-builder kan modtage den brede værdi,
uanset hvilken mappe prædikatet ligger i. En filflytning ville have været kosmetisk oven på en
grænse, compileren allerede håndhæver — og ville have blandet en ren omorganisering ind i en
WI, der ellers kun ændrer grænser.

---

## Udfald (2026-07-26)

Alle tre punkter i WI'ens §Foreslåede løsning er lukket, det første og tredje strukturelt.

### Hvad der blev bygget

1. **`SourceSettings` OG `EoRowPolicy` er nu nominelle** (unique-symbol-brands) med præcis én
   konstruktør hver: `projectSourceSettings(appSettings)` og `projectEoRowPolicy(sourceSettings)`.
   Rækkepolitikken udledes bevidst af source-snapshottet og ikke af `AppSettings`, så der ikke kan
   opstå en rækkepolitik, hvis nøgler ikke også indgår i fingerprintet — netop den divergens, WI'en
   blev skrevet for at lukke.
2. **Brede `AppSettings` er afskåret fra evalueringen.** `productionInputRuntime` publicerer nu det
   PROJEKTEREDE snapshot; broen (`useSettingsRevisionBridge`) er det eneste sted, indsnævringen sker,
   og fingerprintet tages af samme værdi som evalueringen ser. `DEFAULT_EO_ROW_POLICY` erstatter
   row-evalueringens `DEFAULT_APP_SETTINGS`-defaultparametre.
3. **`createInputEvaluation`s `settings`/`TSettings` er FJERNET** — se det uventede fund nedenfor.
4. **Ét smalt AST-værn** (`input/source-settings-projection-boundary`) dækker brandede typers kendte
   loft: en type-assertion til `SourceSettings`/`EoRowPolicy` uden om projektoren. Måler
   AST-assertions gennem `collectTypeAssertions`, ikke tekst, så historik-prosa ikke rammes.
   Allowlisten er tom; ejeren undtages via `appliesTo`.

### Compilerens migrationsliste (§5.2)

Mærkerne afdækkede **seks produktionssteder**, hvor hele `AppSettings` flød ind i gate-kritisk
rækkeevaluering uden at nogen havde besluttet det — fire defaultparametre og to ægte kaldssteder
(`useEoBeregningViewModel`, `eoDocumentDefinitions`). Ingen af dem var synlige før, fordi
`AppSettings` var strukturelt assignable til den smalle type. Det er selve argumentet for at gøre
grænsen nominel frem for at dokumentere den.

`eoSnapshotToInspektionView`s `appSettings`-argument er samtidig indsnævret til `rowPolicy`; det var
dens eneste brug af den brede type.

### Uventet fund: `deriveSettingsFieldIssues` var en død capability

Kernens `settings: TSettings` + den valgfri `deriveSettingsFieldIssues`-hook havde **ingen
produktionskaldssted**. Hookens eneste eksercerer var en test af mekanismen selv (at objektet blev
dybfrosset). `settings` blev altså udelukkende klonet, frosset og kastet væk — mens den frie
typeparameter var den SIDSTE vej, ad hvilken hele `AppSettings` kunne nå evalueringen.

Det er samme fejlklasse som Fase 6's inerte værn: en capability holdt i live af sin egen test. Per
lærdommen *kan capabilityen fjernes, så fjern den* er begge fjernet frem for bevogtet.
Token-bindingsdelen af testen er PORTET (den er en levende invariant); frysningsdelen er væk med
mekanismen.

### Mutationstest af værnet (guard-selvtest-princippet)

**Observeret, ikke påstået.** Med en probe-assertion (`{} as EoRowPolicy`) lagt i den ægte
`eoRowAggregator.ts` rapporterede reglen:

```text
src/domain/eoRowEvaluation/eoRowAggregator.ts:287:23 — Type-assertion til 'EoRowPolicy' uden om
projektoren — mærket skal komme fra `projectSourceSettings`/`projectEoRowPolicy` …
```

Proben er fjernet igen. Første udgave af reglen brugte en regex på filteksten og rapporterede
`undefined:undefined` som position; den blev skrevet om til harnessets `collectTypeAssertions`, så
positionen er ægte og kommentarer pr. konstruktion ikke kan flages.

### WI'ens antagelse om "ingen live defekt" holdt

Men ikke af den anførte grund — se §Kortlægning. Den ene læsning uden for sættet
(`isLoenindkomstAnsaettelsesforholdEffectivelyEmpty`) lå uden for gatens sti; intet HOLDT den der.
Nu gør typen det.

### Berørte filer

- `src/settings/sourceSettings.ts` — to brands, to projektorer, `DEFAULT_EO_ROW_POLICY`,
  completeness mod payload-typen + mod `AppSettings`, to `__createTest*`-fabrikker.
- `src/inputCore/inputReader.ts`, `src/inputCore/runtime/evaluationSourceBinding.ts` — `settings`/
  `deriveSettingsFieldIssues` fjernet.
- `src/inputCore/react/productionInputRuntime.tsx` — publicerer det projekterede snapshot.
- `src/domain/eoRowEvaluation/{eoRowAggregator,eoRowIndkomstRows}.ts`,
  `src/domain/erstatningsopgoerelse/{erstatningsopgoerelseDownloadGate,eoDocumentDefinitions}.ts`,
  `src/domain/erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView.ts` — smal type.
- `src/components/pages/erstatningsopgoerelse/{EOInspektion.tsx,eoBeregning/useEoBeregningViewModel.ts}`
  — projicerer ved grænsen.
- `src/__tests__/quality/architecture/rules/inputBoundaryRules.ts` + `architectureRules.ts` — 32 → 33 regler.
- `src/contracts/app-settings.md`, `docs/architecture/draft-commit-greenfield-design.md`.
- Tests: 6 filer portet til projektor-baserede fixtures, 11 fik en ubrugt import fjernet,
  `productionSettingsRevision.test.tsx` porteret fra identitets- til projektions-assertion,
  `inputCore.test.ts`s settings-halvdel fjernet med mekanismen.

### Verifikation

`generate-build-info.mjs` kørt først. `typecheck`, `typecheck:test`, `lint` (0 warnings),
fuld suite **487 filer / 6109 tests** og `verify:ledgers` (2 filer / 16 tests) grønne.
`build:all` + browsermatrix hører til Fase 7.

---

## Slutreview 2026-07-26 (codex `gpt-5.6-terra`, high)

Reviewet gav **seks fund** — to høje, to middel, to lave. **Alle rettet; ingen afvist.** De to høje
var reelle og pegede samme sted: mit primærværn hvilede på et cast, og mit sekundærværn kunne omgås.

**Modelvalg:** brugeren bad om `terra/high` for at spare tokens, som en bevidst afvigelse fra
klasse H-routingen. Bemærk at BÅDE `sol` og `terra` som bare aliaser afvises af denne konto
(`The 'sol' model is not supported when using Codex with a ChatGPT account`); de fulde id'er
(`gpt-5.6-terra`) virker. Se [[project_codex_orchestration_setup]].

### Fund og udfald

| Fund | Udfald |
|---|---|
| **Høj** — projektorernes completeness var ikke håndhævet: begge sluttede med `as SourceSettings`/`as EoRowPolicy`, så en glemt payload-nøgle var usynlig, og fingerprintet ville læse `undefined` | **Rettet ved roden, ikke med `satisfies`:** mærkerne er nu ÆGTE runtime-symboler (`Symbol('mineo.sourceSettings')`) i stedet for `declare const`. Projektorerne SÆTTER egenskaben, så returværdien opfylder typen uden noget cast, og compileren kontrollerer hver nøgle. Verificeret: fjernes én nøgle fra projektoren, fejler typechecken nu (før: tavs). |
| **Høj** — AST-værnet kunne omgås trivielt (type-alias, kvalificeret navn, generisk coercion), og `appliesTo` undtog hele ejerfilen | Alle tre omveje lukket via to nye, generiske `astQueries`-hjælpere: `collectLocalTypeAliases` (transitiv aliasopløsning + cyklus-sikring) og `collectCallTypeArguments`. **Ejer-undtagelsen er FJERNET** — mulig netop fordi runtime-symbolerne gjorde projektorerne cast-frie, så reglen nu også dækker det sted, hvor mærket fremstilles. |
| **Middel** — testfabrikkerne kunne bruges i produktionskode uden værn | Reglen forbyder nu produktionsimport af `__`-eksporter fra `sourceSettings`, også under alias. Samme konvention og dom som `__createSlimInputTestStore`. |
| **Middel** — `liveTarget`-proben var tekstbaseret, så historik-kommentarer alene kunne holde den grøn | Proben måler nu `hasIdentifier` for både typenavne og projektornavne. En slettet type med efterladt kommentar gør reglen rød, som `liveTarget` er til for. |
| **Lav** — dokumentationen påstod stadig at `AppSettings` opfylder kontrakten STRUKTURELT | Rettet i `mineoDocumentDefinition.ts` og `documentBrevhoved.ts` (påstanden er nu faktuelt forkert — det er hele pointen), og `app-settings.md`s verifikationsdato er opdateret. |
| **Lav** — min kommentar i `inputReader.ts` henviste til en placering for fremtidige settingsafhængige feltissues, som ikke findes | Kommentaren siger nu det rigtige: descriptor-validatorer modtager IKKE `SourceSettings`, og consumer-issues bliver ikke kernens feltissues, så en sådan regel vil kræve en ny, eksplicit auditeret grænse. |

### Egen mutationstest fandt de samme to huller uafhængigt

Før reviewets svar forelå, kørte jeg fire probe-filer mod værnet. Første udgave fangede kun to af
dem — `as unknown as X` og vinkel-syntaks — og MISSEDE type-aliaset og den generiske coercion. Det
bekræfter reviewets fund 2 uafhængigt. Efter rettelsen fanges alle fire (probe-linjer 6, 11, 15, 18).

### Falsk positiv fanget ved at køre værnet mod produktionen

Den skærpede type-argument-kontrol flagede straks
`reguleringDocumentDefinitions.ts:535` — `defineDocumentAction<Request, SourceSettings, Brevhoved>`.
Det er **ikke** en overtrædelse: fabrikken PARAMETRISERES med settings-typen og producerer ingen
værdi af den. Løst med en `define*`-sondring i reglen (ikke en fil-allowlist), og begge retninger er
pinnet i fixtures. Sondringen er navnebaseret og dermed ikke vandtæt; det står eksplicit i reglen,
fordi grænsens primære bevis er strukturen, ikke reglen.

### Hvad reviewet IKKE fandt

Ingen vej hvor hele `AppSettings` stadig kan nå inputevalueringen; ingen rækkepolitik uden om
projektoren; fjernelsen af `deriveSettingsFieldIssues` vurderet forsvarlig og porteringen korrekt;
listecompleteness-checkene ikke vakuøse; ingen ændring af beregningstal, dokumentindhold eller
synlig UI-adfærd.

### Verifikation efter rettelserne

`generate-build-info.mjs` kørt først. `typecheck`, `typecheck:test`, `lint` (0 warnings), fuld suite
**487 filer / 6109 tests** og `verify:ledgers` grønne. Manifestet er 33 regler.

### Næste skridt

WI-011 (generatorens datokontrakt), derefter WI-010. Så Fase 7.

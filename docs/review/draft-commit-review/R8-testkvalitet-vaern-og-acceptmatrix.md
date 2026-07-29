# R8 — Testkvalitet, kvalitetsværn og acceptmatrix

**Status:** Alle otte fund rettet (R8-F07 i etape 9; R8-F01–F06 i etape 10; R8-F08 i etape 11)  
**Dato:** 2026-07-28, opdateret 2026-07-29 (etape 10)  
**Dækket:** `draft-commit-greenfield-design.md` §§7/10; `contract-topology.json`; form-, error-,
critical-action-, persistence-, undo/redo- og document-output-kontrakterne; acceptmatrixen; inputCore-editor-,
surface-, state-, runtime- og history-tests; issue-/dokumentgate-tests; kritiske handlings-tests;
arkitekturharnessen; EO-surface-værnet; dokumentformatværnet.  
**Angreb udført:** grøn af tomhed; in-memory AST-probe med tomt `describe`; falsk warning-case;
form/grid×codec-dækningssweep; command×transaktionsinvariant-sweep; syntetisk editor/mock-grænse;
kommentar-only bypass af quality guard; AST-sweep af aktive migrationsnavne; kontrol af skip/todo/failing/only;
uafhængig efterprøvning af dokumentformatværnets ready-grene.  
**Evidens:** målrettet Vitest-kørsel: 9 filer/199 tests grønne; quality-/arkitekturkørsel: 6 filer/102 tests
grønne; AST-probes: 33 aktive migrationsorienterede deklarationer, 0 skip/todo/failing/only, tomt `describe`
accepteres af acceptmatrixen, EO-værnet accepterer kommentar-only markør, surface-suiterne bruger kun én form-
og én grid-codecfamilie; `git status` før/efter viste kun de allerede eksisterende untracked reviewdokumenter.  
**Fund:** 8 (R8-F01, R8-F02, R8-F03, R8-F04, R8-F05, R8-F06, R8-F07, R8-F08)  
**Hypoteser:** 1 (R8-H01)  
**Handling:** Reviewet var read-only. Rettelserne blev gennemført i etape 9 (R8-F07) og etape 10
(R8-F01–F06); R8-F08 hører til etape 11's sluttilstandssprog.  
**Næste skridt:** R8-F08 (testnavne) i etape 11. Resten er lukket — se hvert fund og
"Resterende checkpoints" nedenfor.

## Kørte kommandoer og probes

```text
npx vitest run \
  src/__tests__/quality/acceptanceMatrix.test.ts \
  src/__tests__/inputCore/inputCore.test.ts \
  src/__tests__/inputCore/runtime/dispatchInput.test.ts \
  src/__tests__/inputCore/react/useFieldEditor.test.tsx \
  src/__tests__/inputCore/react/useFormFieldSurface.test.tsx \
  src/__tests__/inputCore/react/gridAdapter.test.tsx \
  src/__tests__/inputCore/runtime/criticalActionCoordinator.test.ts \
  src/__tests__/document/documentGateMatrix.test.ts \
  src/__tests__/document/documentLifecycleMatrix.test.ts
```

Udfald: 9 testfiler og 199 tests grønne.

```text
npx vitest run \
  src/__tests__/quality/architecture \
  src/__tests__/quality/erstatningsopgoerelseSurfaceGuard.test.ts \
  src/__tests__/quality/contractCoverageMatrix.test.ts \
  src/__tests__/quality/deletionLedger.test.ts \
  src/__tests__/quality/formContractIsolation.test.ts
```

Udfald: 6 testfiler og 102 tests grønne.

Supplerende read-only Node/TypeScript-AST-probes målte:

- aktive testdeklarationer med `greenfield`, `Fase`, `WI` eller `migration`: 33,
- aktive `.skip`, `.todo`, `.failing`, `.only` eller `.skipIf`: 0,
- et syntetisk tomt `describe('Obligatorisk statekæde: …', () => {})` matcher acceptmatrixens punkt 9,
  selv om der er 0 executable leaf-tests,
- en syntetisk håndrullet EO-inputflade med kommentaren `// useFieldEditor` accepteres af
  EO-surface-værnets nuværende tekstprædikat,
- `useFieldEditor.test.tsx` og `useFormFieldSurface.test.tsx` bruger kun `aargangField`, mens
  `gridAdapter.test.tsx` bruger `belobField`; ingen af de tre indeholder en parametriseret fælles
  codec-/adapterkontrakt.

## Fund

### R8-F01 — §10's 30 acceptkriterier har intet levende register

**Lokation:** `src/__tests__/quality/acceptanceMatrix.test.ts:40, 53-353, 475-498`  
**Problem:** Acceptmatrixen registrerer en ældre 15-punkts “Fase 7”-liste, ikke målarkitekturens 30
acceptkriterier i §10. Kildeverifikationen accepterer både `describe` og leaf-tests som dækningskilde.
Punkt 9 peger på et `describe` i `src/__tests__/inputCore/inputCore.test.ts:391`, så punktet kan forblive
grønt, hvis alle underliggende `it`-tests slettes.  
**Evidens:** Koden kræver eksplicit `Array.from({ length: 15 }, ...)`. En in-memory AST-probe med et tomt
`describe` gav `matrixPoint9WouldMatch: true` og `executableLeafTests: 0`. Den målrettede acceptmatrix-test
var fortsat grøn.  
**Angrebet der fandt det:** Den grønne af tomhed; levende AST-binding.  
**Konsekvens:** Trust-kritiske kriterier kan være helt uden dækningskilde, mens CI viser en grøn acceptmatrix.
Et registreret punkt kan desuden overleve uden en udførende assertion.  
**Alvor:** Kritisk  
**Strukturel vurdering:** Tegn på et bredere problem: registret måler en historisk acceptance-flade og
verificerer deklarationsnavne frem for executable leaf-tests bundet til §10.  
**Overvejelse:** Filens egen forklaring siger, at den mindste bærende enhed er testen, men implementeringen
medtager `describe`, hvilket modsiger begrundelsen.  
**Anbefaling:** Erstat registret med præcis 30 §10-punkter og bind hvert punkt til aktive leaf-tests. Lad
AST-kontrollen afvise suite-deklarationer som evidens, medmindre den også verificerer mindst én konkret aktiv
leaf-test under suiten.  
**Forslag til løsning:** Definér et typed 1–30-register, parse suitehierarkiet, registrér leaf-test-id/navn og
tilføj mutationstests for tom suite, arvet skip og slettet leaf-test.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 10)**

Anbefalingen er fulgt i sin helhed, og rettelsen gik ét skridt videre på det punkt, der gjorde fundet
kritisk: registret er ikke bare udvidet til 30 punkter — det er **bundet ORDRET til designets §10**.
`parseDesignCriteria()` læser de nummererede kriterier ud af
`docs/architecture/draft-commit-greenfield-design.md` §10 og sammenligner titel for titel. Udvides §10 til
31 kriterier, eller omformuleres ét af dem, bliver registret rødt med nummeret. Uden den binding ville
registret have været en ny hånd-vedligeholdt liste med præcis den svaghed, fundet beskrev — blot 30 poster
i stedet for 15.

**Kortlægningen bekræftede fundets alvor og fandt mere:** fem af de 30 kriterier (**1, 8, 22, 28, 29**)
havde ingen dækningskilde nogen steder i den gamle matrix. Kriterium 22 (mount-uafhængighed) fik derfor sin
egen nye direkte måling (`mountIndependence.test.tsx`), fordi ingen eksisterende test sammenlignede udfaldet
MED og UDEN et komponenttræ — arkitekturharnesset beviser kun, at ingen komponent SKRIVER.

**Suite-hullet er lukket strukturelt.** Parseren skelner nu `it`/`test` fra `describe`/`suite`, og registret
citerer udelukkende leaf-tests. Et citeret suitenavn afvises med en egen, sigende fejl ("… er en SUITE, ikke
en leaf-test. Et suitenavn overlever sletningen af hver test under det …"). Det havde en direkte konsekvens
for de nye matricer: `stateChains.test.ts`' otte kædenavne KUNNE ikke citeres som evidens, fordi de er
`describe`s med et dynamisk indhold. De er derfor bundet et STÆRKERE sted — `NORMATIVE_CHAIN_NAMES`
sammenlignes ordret med §7.2's liste — og begrundelsen står på stedet i begge filer.

**Mutationsbevist mod den levende kilde, i tre uafhængige retninger:**

1. Citeres et SUITENAVN (`'SettledInput XOR-invariant'`) i stedet for dets leaf-test, bliver registret rødt
   med netop den forklarende besked — hullet, fundet fandt, kan ikke genopstå.
2. Tilføjes et 31. kriterium til §10, fejler bindingen med
   `"… §10 indeholder ikke præcis 30 nummererede kriterier"`.
3. Parserens egne NOT-cases (tømt suite, arvet skip, kommentar, strengliteral, skippet dynamisk navn) er
   pinnet i en syntetisk fixture, som dækker begge retninger.

Dækning: 7 tests i `acceptanceMatrix.test.ts`.

### R8-F02 — Fælles form/grid-feltkontrakt køres ikke pr. codecfamilie

**Lokation:** `src/__tests__/inputCore/react/useFieldEditor.test.tsx:96`;
`src/__tests__/inputCore/react/useFormFieldSurface.test.tsx:90`;
`src/__tests__/inputCore/react/gridAdapter.test.tsx:95`;
`src/inputCore/fieldCodecs.ts:86-355`  
**Problem:** Form-suiterne bruger kun `aargangField` med integer-codec, og grid-suiten bruger primært
`belobField` med amount-codec. Der findes ingen fælles suite, der køres mod både form- og grid-adapteren for
hver codecfamilie som krævet af §7.1.  
**Evidens:** AST-proben fandt ingen parametriseret/shared adapter-suite og ingen codec-fabrikskald i de tre
surface-suiter. Produktionen har tekst, optional tekst, selection/choice, boolean, dato, integer, amount,
procent, string-backed, år, uge og brøk. `fieldCodecs.test.ts` tester parserne isoleret, ikke adapteradfærden.  
**Angrebet der fandt det:** Den parallelle løsning; form/grid×codec-dækningssweep.  
**Konsekvens:** En regression i fx dato-, uge-, procent-, choice- eller tekstfelters åbning, paste, settle,
Escape eller immediate commit kan ramme én surface uden at den lovede fælles kontrakt bliver rød.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Systemisk dækningshul i feltkontraktens testdesign.  
**Overvejelse:** Separate codec-unit-tests og separate surface-tests beviser hver sin halvdel, men ikke
kompositionen, som §7.1 kræver.  
**Anbefaling:** Byg én parametriseret feltkontraktsuite med adapterfactory og codec-cases og kør den mod både
form og grid.  
**Forslag til løsning:** Definér repræsentative descriptor-fixtures pr. codecfamilie og genbrug samme
invariantliste for begge adaptere; behold codec-unit-tests til ren parsing.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 10)**

**Rodårsagen var, at "hver codecfamilie" ikke var et OPREGNELIGT begreb.** Kravet i §7.1 kunne kun
håndhæves mod en hånd-vedligeholdt liste i en testfil — og netop den slags liste er det, der stille falder
bagud, indtil dækningen er én form-familie og én grid-familie. Rettelsen er derfor en TYPEÆNDRING i
produktionen før den er en ny test: `FieldCodec.family: FieldCodecFamily` er nu et **påkrævet** felt
(`src/inputCore/fieldCodec.ts`). En ny familie er en compilerfejl, indtil den har et navn, og derefter en rød
kontraktsuite, indtil den har en case.

`fieldContract.surfaces.test.tsx` kører ÉN invariantliste — samme funktion, ikke to lister der hævder det
samme — mod `useFieldEditor` OG `useCellEditor` for hver familie. Det er muligt, fordi begge adaptere
returnerer den SAMME `FieldEditorController<T>`; dét er §10-kriterium 6, og suiten måler det direkte med en
`form og grid giver IDENTISK canonical, rejected og visning for samme råtekst`-sammenligning oven i de
otte per-surface-invarianter.

**Dækningen er DERIVERET fra produktionskataloget, ikke erklæret.** Suiten opregner de levende familier ud
af `productionInputFields` og fejler med familiens navn, hvis en familie findes på BEGGE surfaces uden at
have en case. Kortlægningen gav derved et præcist billede, den oprindelige analyse ikke havde:

- **Otte familier har begge surfaces** og har nu en fælles case: integer, date, optionalText, amount,
  requiredChoice, percent, boolean, selection.
- **Fire er ENKELT-surface i produktionen** og er navngivet med begrundelse frem for udeladt i tavshed:
  `fraction` + `year` (kun formular), `stringBacked` + `text` (kun rækkecelle). En fælles form/grid-kontrakt
  for dem ville måle en flade, der ikke findes. Et anti-rot-ben fejler, hvis en af dem SENERE får sin anden
  surface og bliver stående på listen.
- **`week` har ingen descriptor i produktionen overhovedet** — hvert uge-felt er wrappet i `stringBacked`
  (fire descriptors, verificeret). Familien er navngivet i typen, men suiten opregner de levende familier
  fra kataloget netop derfor: en case for en familie uden descriptor ville have målt en gren, ingen tilstand
  kan nå.
- **`createChoiceFieldCodec` er IKKE en egen familie:** den er en tynd wrapper, der kun tilføjer en
  dublet-/tomhedskontrol og derefter delegerer hele parse-, format- og tastaturadfærden til
  `createSelectionFieldCodec`. To navne for samme adfærd ville have krævet to identiske cases og foregivet
  en dækning, der ikke måler noget nyt. `requiredChoice` er derimod sin egen: den oversætter tom tekst til en
  gyldig default frem for til `undefined`.

Testkataloget er udvidet med fire descriptors (`renterFra`, `feriePct`, `omregningTilFuldtAar`,
`skadestype`), så de familier, der manglede en modpart, kan måles på begge adressearter. De bruger
`defineStructuralField` mod produktionens ægte Zod-sektionsschemas, så XOR-, eksistens- og
relevansvalideringen fortsat kører mod den rigtige kontrakt.

**Mutationsbevist mod den levende kilde:** trunkeres percent-codecets parse (`12,5` → `12`), fejler
**seks** tests — tre på FORM-surfacen og tre på GRID-surfacen. At fejlen rammer symmetrisk er selve beviset
for, at listen kører mod begge adaptere; en suite, der kun målte den ene, ville have givet tre.

Dækning: 179 tests i `fieldContract.surfaces.test.tsx` (8 familier × 2 surfaces × 9-11 invarianter + 3
dækningskontroller).

### R8-F03 — De obligatoriske statekæder og deres ni aspekter er ikke dækket

**Lokation:** `src/__tests__/inputCore/inputCore.test.ts:391-430`;
`src/__tests__/inputCore/runtime/dispatchInput.test.ts:221-270`;
`src/__tests__/inputCore/react/gridAdapter.test.tsx:277-315`  
**Problem:** Kun `gyldig A → ugyldig X → undo → redo` og række-delete har egentlige undo/redo-forløb.
`ugyldig X → ugyldig Y` og `ugyldig → gyldig` samles i én test uden undo/redo. Kæderne med tom værdi,
bounds-fejl, skjult gyldig værdi og skjult fejl findes ikke som komplette §7.2-forløb. De eksisterende tests
hævder ikke ved hvert trin samlet canonical slot, rejected råtekst, visning, feltissue, consumerstatus,
`.eo`-gate, dokumentgate, revision og history.  
**Evidens:** AST-/kildesweep på de otte normative kædenavne fandt kun de nævnte forløb. Assertionerne i
`inputCore.test.ts` er primært canonical/rejected; grid-testen hævder række-id og rejected-map, men ikke
consumer-, save- eller dokumentgates. Acceptmatrixens punkt 9 refererer kun det overordnede `describe`.  
**Angrebet der fandt det:** Den maskerede værdi; obligatorisk statekæde×aspekt-matrix.  
**Konsekvens:** Undo/redo kan gendanne en delvis eller stale tværlagstilstand, uden at testene opdager
uoverensstemmelse mellem input, visning, gates, revision og history.  
**Alvor:** Kritisk  
**Strukturel vurdering:** Systemisk hul i den trust-kritiske state-models acceptdækning.  
**Overvejelse:** Spredte enkeltinvariant-tests kan ikke erstatte en statekæde, fordi fejlen netop kan opstå i
samspillet mellem lag og overgange.  
**Anbefaling:** Implementér de otte kæder som en datadrevet matrix, der tager det samme ni-aspekt-snapshot
efter hvert trin.  
**Forslag til løsning:** Byg en fælles assertionshelper over runtime, reader/issues, save-projektion,
dokumentdefinition, revision og history; brug den ved alle overgange og efter undo/redo.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 10)**

Anbefalingen er fulgt: `src/__tests__/inputCore/stateChains.test.ts` er en datadrevet matrix over alle otte
§7.2-kæder, som tager ét SAMLET ni-aspekt-snapshot efter hvert trin og sammenligner med den FULDE forventede
tilstand — ikke en delmængde. En delvis forventning ville lade et uhævdet aspekt drifte uset, og det var
netop hullet.

Kæderne kører mod runtime-reduceren og den ægte `undoInputHistory`/`redoInputHistory`, valideret af
kataloget som produktionen gør. Kædelisten er bundet ordret til §7.2 i `NORMATIVE_CHAIN_NAMES`, så en kæde
ikke kan falde ud af matricen uden at en kontrol bliver rød med dens navn.

**Matricen skal selv kunne fejle på hvert aspekt.** En sidste kontrol hævder, at HVERT af de ni aspekter
varierer et sted i matricens egne kæder: er et aspekt konstant på tværs af alle otte kæders alle trin, er
det ikke evidens for noget, og matricen ville se ud som ni aspekter og reelt være ét.

**Tre steder korrigerede kortlægningen en forventning, jeg havde skrevet forkert — og runtime havde ret:**

1. **Et skjult men GYLDIGT felt er fortsat læsbart for consumers.** Readeren gater ikke på relevans, og det
   er korrekt: relevans er den enkelte consumers ansvar
   ([[project_field_visibility_single_source]]). En kerne, der skjulte værdien for ALLE consumers, ville
   gøre det umuligt for en consumer med en anden relevansregel end feltets visningsregel at læse den — altså
   §1.10's overblokering flyttet ind i kernen. Relevansen har præcis ÉN synlig konsekvens i kæderne:
   feltISSUET forsvinder, fordi et usynligt felt ikke må bære en rød markering, brugeren ikke kan finde.
2. **Et read på en SLETTET rækkes felt KASTER bevidst** (`ValidationReader: ukendt, slettet eller forkert
   bundet feltreference`). Kæde 8 hævder derfor, at adressen er UTILGÆNGELIG efter delete og TILGÆNGELIG
   igen efter undo — en stærkere påstand end "canonical er tom", og den er markeret eksplicit som
   `DELETED_ADDRESS` frem for at blive skjult i en `undefined`.
3. `reduceInputCommand` tager ingen `origin`; origin er dispatch-portens krav (§3.7) og måles i
   `commandInvariants.test.ts`. Kæderne måler tilstandsovergangen.

**Mutationsbevist mod den levende kilde, to uafhængige mutationer:**

- Lader row-delete sine rejected descendants stå (`rejectedInputs: input.rejectedInputs`), bliver kæde 8 rød
  — og samtidig `commandInvariants`' egen row-delete-invariant.
- Fjernes oprydningen af en skjult FEJLENDE værdi (§1.9's `withCanonicalValue(…emptyValue)`), bliver kæde 7
  rød. Netop den kæde fandtes slet ikke før.

Dækning: 10 tests (8 kæder + kædelistens completeness + ikke-vakuøs-kontrollen).

### R8-F04 — Transaktionsinvarianterne testes ikke for hver command-type

**Lokation:** `src/inputCore/inputReducer.ts:27-123`;
`src/__tests__/inputCore/runtime/dispatchInput.test.ts:82-220, 337-507`  
**Problem:** Runtime-unionen omfatter 13 mutationstyper plus undo/redo, men de fulde assertions for write,
revision, history og rollback bruger `settleField`. Andre commands har spredte adfærdstests, ikke §7.4's
samlede invariantsuite pr. command-type. `structuralInputTransaction` dækkes primært som origin-afvisning, og
`resetSection` køres ikke gennem runtime-dispatch i denne suite.  
**Evidens:** Command-sweepet fandt omfattende `settleField`-brug, men ingen tilsvarende parametriseret
serialization-/storage-/store-rollback for de øvrige commands. De positive strukturtests hævder enkelte
resultater og origins, ikke én session-write, ét store-write, én monoton revision og højst ét history-trin
samlet.  
**Angrebet der fandt det:** Rollback-stien; command×transaktionsinvariant-sweep.  
**Konsekvens:** Command-specifikke fejl i klassifikation, history-policy, row descendants, replacement-policy
eller rollback kan passere, selv om `settleField`-stien er korrekt.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Dækningsstrategien er centreret om én repræsentativ command, selv om normen kræver
exhaustivitet over unionen.  
**Overvejelse:** Typeunionen kan bruges som autoritet for en compile-time exhaustiv testmatrix, så nye
command-typer ikke kan tilføjes uden en case.  
**Anbefaling:** Parametrisér §7.4-invarianterne over alle command-kinds og giv hver case en gyldig ændring,
no-op/afvisning samt relevante fault-injections.  
**Forslag til løsning:** Indfør et `satisfies Record<RuntimeInputCommand['kind'], CommandInvariantCase>`-register
med eksplicit policy for row-delete og authoritative replacement.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 10)**

Forslaget er implementeret ordret: `src/__tests__/inputCore/runtime/commandInvariants.test.ts` bærer et
`satisfies Record<RuntimeInputCommand['kind'], CommandCase>`-register over alle **14** arter (12
mutationstyper + undo + redo). Tilføjes en trettende mutationsart til unionen, er det en **compilerfejl**
her, indtil den har en case — samme mekanik som `STRUCTURAL_KIND_SET` bruger i produktionen, og valgt frem
for en hånd-vedligeholdt liste netop fordi fundet handlede om en dækning, der stille faldt bagud.

Hver case leverer en `mutate` (reel ændring), et `noop` og — hvor arten HAR en afviselig form — en `reject`.
Alle tre ben kører de fulde §7.4-assertions: ét session-write, ét store-write, én monoton revision, højst ét
history-trin, og ved afvisning: uændret store-REFERENCE, uændret revision, uændret history, nul writes.

**Fire policyer er erklæret pr. case frem for udledt**, fordi de er beslutninger og ikke bivirkninger:

- `clearsHistory` for `replaceCase`/`clearCase` (§3.7's hel-sags-replacement).
- `historyNavigation: 'undo' | 'redo'` — RETNINGEN er erklæret, så et undo, der ved en fejl flyttede i
  redo-retningen, bliver rødt frem for at bestå på totalen.
- Arter uden semantisk no-op (`insertRow`, `settleFieldInNewRow`, `structuralTransaction`,
  `replaceCase`, `clearCase`) bruger en ægte no-op-command til det ben, med begrundelsen på stedet.
- Et gulv kræver, at mindst syv arter HAR et reject-ben, så en fremtidig "sæt `reject: null` overalt"-opblødning
  bliver synlig.

**Kortlægningen rettede én forventning:** sletning af en ALLEREDE slettet række er ikke en no-op men en
AFVISNING (kataloget kaster). Det er den rigtige adfærd — en tavs no-op ville lade en consumer tro, at
rækken var væk, fordi netop dens kommando fjernede den — så `deleteRow`'s gentagne delete bærer nu
afvisnings-benet, ikke no-op-benet.

**Bevidst udeladt:** storage-rollbackens tre fault-injections (kastende `setItem`, ikke-verificerbar
rollback, kastende subscriber) er IKKE kopieret pr. command. De rammer `commitCandidate`, som alle 14 arter
går igennem, og en kopi pr. art ville have målt samme kodesti 14 gange. De bor fortsat i
`dispatchInput.test.ts`, og begrundelsen står i den nye fils hoved.

**Mutationsbevist:** lader row-delete sine rejected descendants stå, bliver
`row-delete efterlader hverken rejected descendants eller orphan-adresser` rød sammen med statekæde 8.

Dækning: 40 tests (14 arter × 2 generiske ben + 12 reject-ben + registerets completeness + row-delete-invarianten).

### R8-F05 — Warning-benet i issue-/gate-matricen er falsk dækket

**Lokation:** `src/__tests__/document/documentGateMatrix.test.ts:232-251`;
`src/__tests__/quality/acceptanceMatrix.test.ts:176-183`  
**Problem:** Testen under “warnings blokerer intet” skaber ikke en warning. Den committer en canonical
bounds-fejl i en irrelevant sektion. Acceptmatrixens punkt 7 matcher kun `describe`-navnet
`warnings blokerer intet`, ikke en leaf-test med en faktisk warning. Der findes heller ikke én samlet §7.3-
matrix, som hævder UI-, beregnings-, dokument- og `.eo`-konsekvensen, og sweepet fandt ingen eksplicit
spy-assertion på, at en beregningsmotor aldrig kaldes fra en blocked projektion.  
**Evidens:** `documentGateMatrix.test.ts:244` skriver `varigeMenMengrad = 121`, som giver et bounds-issue;
testen injicerer intet issue med `severity: 'warning'`. Faktiske warning-tests findes i enkelte domæner, men
de er ikke den registrerede generelle matrixkilde.  
**Angrebet der fandt det:** Den lydløse blokering; falsificering af testcase-fixturen.  
**Konsekvens:** En generel regression, hvor warnings begynder at blokere en beregning, et dokument eller
`.eo`, kan bestå den deklarerede matrix.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Lokalt falsk testcase, men også tegn på at matricen er opdelt uden en autoritativ
tværlagsfixture.  
**Overvejelse:** En irrelevant fejl og en relevant warning tester to forskellige dimensioner og må ikke
bruges som stedfortrædere for hinanden.  
**Anbefaling:** Brug en faktisk relevant warning-fixture og hævd alle fire konsekvenskanaler; registrér en
konkret leaf-test i acceptmatrixen.  
**Forslag til løsning:** Tilføj en kanonisk warning-case ved issue-/projektionsgrænsen og et motor-spy, som
beviser nul kald ved blocked projektion.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 10)**

Fundet var rigtigt, og efterprøvningen forklarede HVORFOR den falske case var opstået: **den generiske
warning-kanal havde ingen producent.** `ProjectionCollector.warn`, `InputIssue`s `Warning`-variant og
`ProjectionResult.warnings` havde NUL callsites og NUL læsere i produktionen (INC-F17). En "kanonisk
warning-case ved issue-/projektionsgrænsen", som forslaget bad om, ville derfor have målt en kanal, ingen
produktionskode bruger — en fjerde variant af R0-F02's fejlklasse. Den kanal er i stedet **slettet**.

Warnings dannes i domænernes egne typer (`EetIssue.severity`, `EoRowStatus`, `IntegrityIssue.severity`), og
invarianten er derfor målt DÉR. Den nye case bygger en komplet, gyldig EET-sag, hvis ENESTE afvigelse er den
ægte advarsel `warn-asl-eet-under-15` (et erhvervsevnetab på 10 %), og hævder alle tre konsekvenskanaler, en
warning kan nå:

1. **beregningen** blev udført (`hasBlockingErrors === false`, `computation !== null`),
2. **dokumentgaten** tillader download (`evaluateEetFaneDownloadGate(...).canDownload === true`),
3. **`.eo`-save** er ikke blokeret (`projectEoSave(...).status === 'ready'`).

Fixturens forudsætninger hævdes eksplicit — der ER en warning, og der er INGEN fejl — så casen ikke kan blive
grøn af tomhed på samme måde som den, den afløser.

**Motor-spyet er tilføjet som sin egen assertion**, fordi sweepet havde ret i, at den manglede: en motor, der
kaldes og hvis resultat kastes væk, ville bestå en resultat-assertion, men kunne kaste, mutere eller regne på
et maskeret input. Testen `en blocked projektion kalder ALDRIG beregningsmotoren` bruger `vi.fn()` gennem
`mapReadyProjection` og bærer en kontrol i modsat retning: ved `ready` KALDES motoren præcis én gang — ellers
målte assertionen blot, at helperen aldrig kalder noget.

Acceptregistrets kriterium 13 peger nu på begge nye tests plus EET-gatens egen
`tillader download trods en warning`-leaf.

### R8-F06 — Kritiske handlinger er ikke integrationstestet ens for form og grid

**Lokation:** `src/__tests__/inputCore/runtime/criticalActionCoordinator.test.ts:46-214`;
`src/__tests__/hooks/useFileSaveLoad.test.tsx:8-20, 106-123`;
`src/__tests__/document/documentLifecycleMatrix.test.ts:52-105, 151-190`;
`src/__tests__/components/pages/VarigeMen.tabNavigationSettle.test.tsx:77-130`  
**Problem:** Coordinator- og save/load-tests bruger syntetiske `ActiveEditor`-objekter. Dokumentlivscyklussens
tests med “åben draft” injicerer blot castede `{ status: 'committed' }`/`{ status: 'blocked' }`-resultater og
åbner ingen editor. Der findes ingen grid-integration for save/download/load/reset/clear/undo/redo. Varige
mén-testen dækker form-fanenavigation via browserens blur-rækkefølge, ikke hele den kritiske handlingsbarriere.  
**Evidens:** `useFileSaveLoad.test.tsx` registrerer en kunstig editor, hvis `settle()` kun kaster.
`documentLifecycleMatrix.test.ts` caster et instrumenteret objekt til `CriticalActionCoordinator`. AST-/
kildesweepet fandt ingen testfil, der kombinerer en virkelig grid-editor med de kritiske handlingers entrypoints.  
**Angrebet der fandt det:** Den fjerde kanal; over-mocking og surface×handling-sweep.  
**Konsekvens:** Et brud i `useFieldEditor`-registrering, adapterens settle/discard-lifecycle eller
grid-specifik eventorden kan passere, selv om den syntetiske coordinator-test er grøn. Det kan give tabt draft,
stale save/download eller forkert kassering ved load/reset.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Testene beskytter coordinatorens implementering isoleret, men ikke den normative
integration mellem begge surfaces og de kritiske handlinger.  
**Overvejelse:** Syntetiske fault-injections er nyttige som unit-tests, men kan ikke bære §7.5's eksplicitte
form/grid-paritet.  
**Anbefaling:** Behold unit-testene og tilføj en fælles kritisk-handlingskontrakt, der køres med en virkelig
form-editor og grid-editor.  
**Forslag til løsning:** Parametrisér save, download, navigate, load, reset, clear, undo og redo over to
surface-harnesses; hævd draft, committed state, gates, I/O-kald og focus/discard efter succes, annullering og fejl.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 10)**

Anbefalingen er fulgt PRÆCIS som formuleret — inklusive dens første halvdel: *behold unit-testene.* De
syntetiske coordinator-tests er urørte, fordi de beviser MEKANISMEN (serialisering, fail-closed,
fault-injection) og kan injicere fejl, en ægte editor ikke kan fremprovokere. Den nye
`criticalActionSurfaceParity.test.tsx` beviser INTEGRATIONEN, som en unit-test pr. konstruktion ikke kan
bære.

Editorne monteres gennem et RIGTIGT komponenttræ og en rigtig provider — ikke en `renderHook`-attrap uden
DOM — og hver af §7.5's seks handlinger måles med den SAMME assertionsfunktion for form og grid:

- **registrering:** den ÆGTE adapter dukker op i `ActiveEditorRegistry.getEditing()`, mens den er åben, og
  afmelder ved settle. Det er kernen i fundet: de gamle tests brugte syntetiske `ActiveEditor`-objekter.
- **save/download:** coordinatorens settle LANDER værdien i aggregaten (den syntetiske test kunne kun se, at
  `settle()` blev kaldt), og tokenet hører til revisionen EFTER settle.
- **navigate:** gennemføres OG gør fejlen synlig som rejected råtekst ved et fejlende settle — en blokeret
  navigation ville fange brugeren på siden med sin egen tastefejl.
- **undo/redo:** `noop` med åben editor, uden ny revision, og draften står stadig åben med sin tekst.
- **load:** fejlende apply BEVARER draften og settler INTET; vellykket apply kasserer den. Det er `load`s hele
  forskel fra save/navigate (§1.4).
- **unmount:** ingen efterladt registrering — en sådan ville gøre enhver senere kritisk handling til en no-op.

Dertil en direkte paritetssammenligning: de seks handlingers udfaldsstatus + draft-tilstand samles pr.
surface og sammenlignes, med et gulv på seks handlinger og mindst to forskellige udfald, så listen ikke kan
blive tom af tomhed.

**Mutationsbevist mod den levende kilde:** ændres `EDITOR_HANDLING.load` fra `'replace'` til `'settle'`,
fejler load-benet på **BEGGE** surfaces med `form: draften blev kasseret ved en FEJLENDE load` og
`grid: draften blev kasseret ved en FEJLENDE load`. At fejlen rammer symmetrisk er beviset for, at
pariteten er reel og ikke to lister, der tilfældigvis hævder det samme.

Dækning: 15 tests (7 × 2 surfaces + paritetssammenligningen).

### R8-F07 — EO-surface-værnet kan omgås med en kommentar

**Lokation:** `src/__tests__/quality/erstatningsopgoerelseSurfaceGuard.test.ts:20-30, 62-100`  
**Problem:** Værnet opdager inputflader med regex over rå tekst og godkender arkitekturvej med
`source.includes(...)`. En håndrullet inputflade kan derfor passere alene ved at nævne fx
`useFieldEditor` i en kommentar eller urelateret streng.  
**Evidens:** En in-memory probe med `// useFieldEditor` efterfulgt af en håndrullet
`<Input field={x} onChange={...} />` gav `isInputSurface: true`, `onGreenfieldPath: true` og
`guardWouldAccept: true`. Filens egen mutationstest bruger ikke kommentar-bypasset.  
**Angrebet der fandt det:** Den grønne af tomhed; kommentar-only mutation mod mekanismen.  
**Konsekvens:** En parallel EO-inputvej uden om den autoritative editor/write-grænse kan accepteres af
quality-gaten. Det kan åbne for lokal værdikopi eller direkte write-flow.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Lokalt værn med forkert analyseteknik; spørgsmålet om imports, JSX props og hooks er
strukturelt og kræver AST/kildegraf.  
**Overvejelse:** Liveness-gulvet på fem filer beskytter kun mod et tomt glob, ikke mod falsk positiv
godkendelse af den enkelte fil.  
**Anbefaling:** Flyt reglen ind i arkitekturharnessen og bevis en virkelig import-/JSX-/call-kæde til den
autoritative surface.  
**Forslag til løsning:** Brug TypeScript-AST og kildegraf til at klassificere persisted input-props og følge
imports/calls; tilføj kommentar-, string- og urelateret-import-fixtures.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 9)**

**Rettelsen fulgte anbefalingen: reglen er flyttet ind i arkitekturharnesset**, og den gamle tekst-guard
(`erstatningsopgoerelseSurfaceGuard.test.ts`) er SLETTET, ikke lappet — begge dens ender var tekstbaserede, og
en lappet udgave ville have bevaret sin egen filglob og sit eget liveness-gulv ved siden af harnessets.

`input/eo-surface-on-greenfield-path` måler nu begge ender som AST:

- **Fladen** genkendes på JSX-attributter (`field`/`location`/`onCommit`/`onDraftChange`) — noder, som en
  kommentar ikke kan producere.
- **Vejen** bevises af en faktisk `import` fra en greenfield-inputmodulsti ELLER et faktisk kald til en af
  inputvejens hooks. En omtale i en kommentar eller en streng kan ikke længere godkende en fil.

Den transiente undtagelse er bevaret uændret i sin logik (ren transient flade uden persisteret `field`), og
liveness-gulvet på fem flader er flyttet med som `minimumMatches: 5`, så en filflytning fortsat ikke kan gøre
værnet trivielt grønt.

**Mutationsbevist mod den LEVENDE kilde med fundets EGET bypass:** indsættes en håndrullet
`<input field={…} onDraftChange={…} />` i `EOInspektionRowsSection.tsx` med `// useFieldEditor` som eneste
"greenfield-bevis", bliver reglen rød med fil:linje. Bypasset er desuden pinnet som en violating fixture, så
det ikke kan genopstå.

### R8-F08 — Aktive testnavne beskriver fortsat migrationen

**Lokation:** Repræsentativt
`src/__tests__/inputCore/fieldCodecs.test.ts:16`;
`src/__tests__/components/pages/Aarsloen.integration.test.tsx:70`;
`src/__tests__/inputCore/react/fieldShells.test.tsx:79`;
`src/__tests__/domain/satser/satserProjection.test.ts:40`;
`src/__tests__/quality/acceptanceMatrix.test.ts:353,475`  
**Problem:** Almindelige produkt-, surface- og projektionssuiter navngiver `greenfield`, migration, faser eller
WI'er i stedet for den invariant, de beskytter. Det strider mod R8 og sluttilstandskravet i R1b.  
**Evidens:** AST-sweep af aktive `describe`/`it`/`test`/`suite`-deklarationer fandt 33 navne med
`greenfield`, `Fase`, `WI` eller `migration`. Nogle fraværs- og load-tolerance-tests er legitime undtagelser,
men de repræsentative almindelige tests ovenfor er ikke historiske tests.  
**Angrebet der fandt det:** Den forældede beskrivelse; AST-sweep af aktive testnavne.  
**Konsekvens:** Testoutput og vedligeholdelsesvejledning beskriver omlægningens rejse frem for den gældende
arkitektur og gør det uklart, om en test beskytter slutproduktet eller en afløst mekanisme.  
**Alvor:** Mindre  
**Strukturel vurdering:** Bred navne-/dokumentationsdrift, ikke et lokalt enkeltfund.  
**Overvejelse:** Fraværsværn, schema-evolution og ægte legacy-filfixtures kan fortsat have historiske ord,
men undtagelserne skal klassificeres eksplicit.  
**Anbefaling:** Klassificér de 33 AST-fund som omskriv/bevar og omskriv alle almindelige tests til
invariantnavne.  
**Forslag til løsning:** Tilføj eventuelt et snævert AST-værn mod migrationssprog i aktive testdeklarationer
med en begrundet allowlist for fraværs- og schema-evolutionstests.  
**Kræver godkendelse:** Nej  
**Status:** **Rettet 2026-07-29 (etape 11)**

**Udfaldet af klassifikationen.** En AST-sweep over ALLE aktive deklarationer (arvet skip respekteret) fandt 41,
ikke 33 — det oprindelige tal var fra en snævrere mønsterliste. 26 blev omskrevet til invariantnavne. De øvrige 15
er bevaret, og fordelingen er den vigtige del af konklusionen: **de er næsten alle `legacy`-navne, og de er
sande.** `.eo`-filer og persisterede sessioner fra ældre programversioner ER legacy-formater, som load-stien
tolererer med vilje, og fraværsværnene navngiver med vilje de slettede symboler.

Derfor er `legacy` **ikke** et forbudt ord i det nye værn (`src/__tests__/quality/testNamingConvention.test.ts`).
Forslaget om "en begrundet allowlist" ville i praksis være blevet længere end fundene — og et værn, hvis
undtagelsesliste overstiger dens fund, måler ikke længere noget. De forbudte mønstre er i stedet de ord, der
utvetydigt beskriver et AFSLUTTET forløb: `greenfield`, `fase <n>`, `WI-<n>`, `migration`/`migrering`/`migreret`.
Tre navne står på en eksakt ALLOWED-liste, hvor migrationsordet ER emnet (MoneyOre-dataomlægningen,
sektionsmigrationen) — med anti-rot i begge retninger: en undtagelse uden en levende deklaration er en fejl, og en
undtagelse uden begrundelse er en fejl.

Værnet er en TEST og ikke en AST-regel i arkitekturharnesset, fordi harnessets kilde-graf bevidst udelukker
`src/__tests__/**`. Det bruger til gengæld harnessets princip: samme AST-parser som acceptregistret
(`quality/testDeclarations.ts`, udskilt i denne etape frem for kopieret), så et linjefilter hverken kan blive
narret af arvet `describe.skip` eller af et navn i en kommentar.

Mutationsbevist i BEGGE retninger: et genindført `describe('greenfield fieldCodecs')` gør værnet rødt med
fil:linje og det ramte mønster, mens PRÆCIS samme navn under `describe.skip` forbliver grønt.

## Hypoteser

### R8-H01 — Dokumentformatværnet kan overse formatdrift i ready-grene

**Lokation:** `src/__tests__/document/documentGateFormatInvariance.test.ts:170-190`;
`work-items/WI-014-dokumentformat-ud-af-projektionskonteksten.md`  
**Problem:** Format-invariansværnet dækker alle 18 hovedapp-outputs, men kun to definitioner når en
`ready`-gren i fixturen. `documentDownloadFormat` er fortsat synligt i projektionskonteksten.  
**Evidens:** Testen dokumenterer selv 34 blocked projektioner og 2 ready projektioner og kræver kun
`readyCount >= 2`. WI-014 findes og beskriver den åbne capability. Dette review efterprøvede tællingen og
filens aktuelle mekanisme, men indførte ikke en formatlæsning i en udækket ready-gren og kan derfor ikke
bevise, at en konkret levende definition allerede er formatdriftet.  
**Angrebet der fandt det:** Den brede capability; den grønne af blocked-mod-blocked.  
**Konsekvens:** En fremtidig eller allerede skjult formatafhængighed i en af de øvrige ready-grene kan give
forskellig gate for PDF og Word uden at værnet bliver rødt.  
**Alvor:** Væsentlig, hvis hypotesen bekræftes  
**Strukturel vurdering:** Verificeret åben begrænsning i værnet; konkret produktionsbrud er ikke bevist.  
**Overvejelse:** Den stærkeste løsning er at fjerne formatet fra projektionskontekstens type frem for at gøre
fixturen stadig større.  
**Anbefaling:** Gennemfør WI-014 og behold testen som sekundært sikkerhedsnet.  
**Forslag til løsning:** Indsnævr projektionssettings, så læsning af `documentDownloadFormat` er en
typefejl; mutationstest derefter én repræsentativ ready-definition.  
**Kræver godkendelse:** Nej  
**Status:** **Bortfaldet 2026-07-29 (etape 11)** — begrænsningen er lukket ved roden, ikke afkræftet.

Hypotesen spurgte, om en formatafhængighed kunne skjule sig i en af de 16 udækkede ready-grene. Spørgsmålet er
blevet umuligt at stille: `documentDownloadFormat` findes ikke længere i projektionskonteksten (R6-F03), så en
`project`, der læser det, er en compilerfejl. Ready-dækningen i fixturen er dermed irrelevant frem for utilstrækkelig
— præcis den løsning, hypotesens egen overvejelse pegede på. Hypotesen blev aldrig bekræftet som et konkret
produktionsbrud, og den tælles ikke som et lukket fund.

## Tilfældighedsfund

- `src/contracts/form-contract.md` beskriver i indledningen fortsat implementeringen som noget, der migreres, og
  har et særskilt historisk afsnit om den slettede migrationsarkitektur.
- `src/contracts/critical-action-contract.md` §6 indeholder en historikparentes om tidligere hooknavne.
- Disse kontraktfund er ikke rettet eller fuldt afgrænset i R8; de hører også under R1's sluttilstandssweep.

## Resterende checkpoints

Status pr. 2026-07-29 (etape 10). Punkt 1-6 er de fund, etapen lukkede.

1. ✅ **En reel 30-punkts §10-matrix er bundet til aktive leaf-tests og mutationstestet.** Bundet ORDRET til
   designets §10, citerer kun leaf-tests, tre uafhængige mutationer (R8-F01).
2. ✅ **§7.1's fælles feltkontrakt er kørt mod både form og grid for alle levende codecfamilier.** Otte
   familier med begge surfaces har en fælles case; fire enkelt-surface-familier er navngivet med begrundelse;
   dækningen er deriveret fra produktionskataloget (R8-F02).
3. ✅ **Alle otte §7.2-statekæder hævder alle ni aspekter ved hvert trin** (R8-F03).
4. ✅ **§7.3's warning-ben er en ÆGTE domæne-warning over tre konsekvenskanaler, og motor-spyet findes.**
   De øvrige klasser (irrelevant, række, aggregat) var og er dækket i `documentGateMatrix` +
   `inputCore.test.ts` (R8-F05).
5. ✅ **§7.4 er exhaustivt bundet til alle runtime-command-kinds** via
   `satisfies Record<RuntimeInputCommand['kind'], …>`. Rollback-faults måles fortsat centralt mod
   `commitCandidate` frem for 14 gange — begrundelsen står under R8-F04.
6. ✅ **§7.5 er integrationstestet med virkelige form- og grid-editorer for alle seks kritiske handlinger**
   (R8-F06).
7. ⏳ **De resterende selvstændige quality guards** er ikke alle semantisk auditeret. Dette pas + etape 9
   dækkede arkitekturharnesset, liveness-laget og de mest relevante input-/EO-guards, ikke hver quality-fil.
   Hører til etape 11-12's afsluttende gennemgang.
8. ⏳ **Den bredere mock-audit uden for critical-action-/dokumentområdet** er ikke gennemført. Etape 10 fjernede
   over-mockingen dér, hvor fundet påviste den (R8-F06); en repo-bred mock-audit er en selvstændig opgave.
9. n/a — der findes intet R8-F09; punktet var en skrivefejl for hypotesen R8-H01, som fortsat spores af
   WI-014 og står som acceptregistrets ENESTE kendte begrænsning (kriterium 27).

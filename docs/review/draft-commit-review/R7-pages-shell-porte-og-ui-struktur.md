# R7 — Pages, shell, porte og UI-struktur

**Status:** Delvist gennemgået
**Dato:** 2026-07-28
**Dækket:** De otte persisterede fagsider, deres væsentlige tab-/sektionslag, app-entries, app-shell,
produktionsruntime/provider, inputporte, transiente input-controls, persisted feltfamilier og fokusdestinationer.
**Angreb udført:** Den brede capability, den parallelle løsning, binding-bypass, monolitisk page, provider-remount,
grøn af tomhed samt dataidentitet forklædt som fokusmetadata.
**Evidens:** TypeScript-AST-inventar af page-viewmodels og rå `Styled*`-callsites; målrettede importsøgninger og
kildeinspektion; `npx vitest run src/__tests__/quality/architecture/architectureRules.test.ts
src/__tests__/inputCore/react/productionInputRuntime.test.ts
src/__tests__/apps/shared/bootstrapClientApp.test.tsx
src/__tests__/inputCore/react/fieldAddressDestination.completeness.test.ts` — 4 testfiler og 91 tests bestod.
(Den sidste testfil og dens modul er SLETTET som led i R7-F03's løsning; kommandoen er bevaret her som
historisk evidens for review-passet, ikke som en kørbar kommando.)
**Fund:** 3 (R7-F01, R7-F02, R7-F03)
**Hypoteser:** Ingen
**Handling:** R7-F02 og R7-F03 er **rettet og verificeret 2026-07-29** (etape 7, andet pas); R7-F01 er parkeret
til etape 12.
**Næste skridt:** Browserbaseret UI-sammenligning og runtime-fuzzing af tab-mount/settle udestår fortsat (se
Resterende checkpoints). Værnets blindhed, som dette pas rejste, er lukket: den nye regel
`input/persisted-controls-use-field-family` dækker HELE komponent-laget frem for kun `fields/**`, og
`input/restore-attributes-carry-destination` dækker de nye DOM-attributter. Begge er mutationstestet mod den
levende kilde.

## Dækket scope

- `src/components/pages/{Stamdata,Erstatningsopgoerelse,Erhvervsevnetab,Forsoergertab,VarigeMen,Aarsloen,Renteberegning,Satser}.tsx`
- Væsentlige undertræer i `src/components/pages/erstatningsopgoerelse/`,
  `src/components/pages/erhvervsevnetab/`, `src/components/pages/renteberegning/` og
  `src/components/pages/varigemen/`
- `src/main.tsx`, `src/apps/shared/bootstrapClientApp.tsx`,
  `src/apps/minprocesrente/minprocesrenteMain.tsx`, `src/apps/minprocesrente/MinProcesrenteApp.tsx`
- `src/inputCore/react/productionInputRuntime.tsx`, `src/inputCore/runtime/initializeInputRuntime.ts`,
  runtimebindingens porte og relevante arkitekturregler
- `src/components/inputs/transient/`, `src/inputCore/react/fields/`,
  `src/inputCore/react/historyRestoreTarget.ts` og `src/inputCore/react/fieldAddressDestination.ts`

## Angreb og evidens

### Page-/viewmodel-inventar

Et TypeScript-AST-script parser hver af de otte §2.1-pages og opsamler kald, hvis navn matcher
`use*ViewModel`/`use*Vm`, samt direkte JSX-brug af `Styled*`:

```text
Stamdata.tsx: VM=[] StyledPersistedCandidates=[]
Erstatningsopgoerelse.tsx: VM=[] StyledPersistedCandidates=[]
Erhvervsevnetab.tsx: VM=[] StyledPersistedCandidates=[]
Forsoergertab.tsx: VM=[] StyledPersistedCandidates=[]
VarigeMen.tsx: VM=[] StyledPersistedCandidates=[]
Aarsloen.tsx: VM=[] StyledPersistedCandidates=[StyledToggleSwitch@318]
Renteberegning.tsx: VM=[] StyledPersistedCandidates=[]
Satser.tsx: VM=[] StyledPersistedCandidates=[]
```

Resultatet blev efterprøvet mod imports, hook-kald og JSX i siderne. EO's eksisterende tab-under-viewmodels blev
ikke talt som page-viewmodels, fordi kontrakten udtrykkeligt sætter enheden per side.

### Shell, runtime og provider-remount

- Mineo-entryen kalder `bootstrapProductionInputRuntime()` i `renderApp` før app-noden returneres
  (`src/main.tsx:9-16`).
- Standalone-entryen etablerer storage-namespace som første bivirknings-import og bootstrapper derefter runtime
  før app-noden returneres (`src/apps/minprocesrente/minprocesrenteMain.tsx:1-19`).
- Unsupported-device-gaten returnerer før `renderApp`, hvilket blev efterprøvet i
  `bootstrapClientApp.test.tsx`.
- `bootstrapProductionInputRuntime()` cacher både binding og startup, mens
  `ProductionInputRuntimeProvider` alene distribuerer bindingen
  (`src/inputCore/react/productionInputRuntime.tsx:141-151,186-201`).
- Den målrettede runtime-test efterprøver, at et gentaget bootstrap-kald returnerer samme binding uden ny
  revision eller rehydrering.

Der blev ikke fundet brud på runtime-init eller provider-remount i det dækkede scope.

### Porte, transiente controls og rå inputadgang

Arkitekturharnesset bestod for den aktuelle kildegraf. Den transiente feltfamilie importerer ikke
case-write-capabilities, og der blev ikke fundet en rå `sections`-/store-write-vej i page-laget. Fund R7-F02 viser
dog, at harnessets fokus-/FieldRef-dækning har et smallere scope end påstanden, det bruges som evidens for.

## Fund

### R7-F01 — Det obligatoriske page-viewmodel-lag findes ikke

**Lokation:** `src/contracts/page-component-contract.md:184`; alle otte persisterede fagsider, blandt andet
`src/components/pages/Stamdata.tsx:48`, `src/components/pages/Erstatningsopgoerelse.tsx:27`,
`src/components/pages/Erhvervsevnetab.tsx:33`, `src/components/pages/Forsoergertab.tsx:66`,
`src/components/pages/Aarsloen.tsx:93` og `src/components/pages/Satser.tsx:125`
**Problem:** Kontrakten kræver præcis ét kanonisk page-level `useXxxViewModel`-indgangspunkt og en page reduceret
til sektionskomposition for hver persisteret fagside. Ingen af de otte sider har dette indgangspunkt. Afledt state,
handlers, gates og taborkestrering ligger fortsat inline. Eksisterende EO-under-viewmodels er tab-lokale og
opfylder ikke kontraktens udtrykkelige per-side-enhed.
**Evidens:** TypeScript-AST-inventaret ovenfor returnerede `VM=[]` for alle otte pages. Kildeinspektion viser
eksempelvis reader-/labelafledning inline i `Stamdata.tsx:48-57`, tab-, projektion- og handlerlogik inline i
`Erstatningsopgoerelse.tsx:27-90`, projektion, fire dokumenthandles og navigation inline i
`Erhvervsevnetab.tsx:33-58`, og projektion, gates, download og præsentationsafledning inline i
`Forsoergertab.tsx:66-102`. `Forsoergertab.tsx` er 637 linjer og `Aarsloen.tsx` 591 linjer.
**Angrebet der fandt det:** Den monolitiske side og den forældede/ikke-implementerede arkitekturpåstand.
**Konsekvens:** Kun strukturel i den nuværende observerede adfærd, men ansvaret for afledt state og handlers er
spredt og kan fortsat vokse inline. Kode og normativ kontrakt beskriver ikke samme arkitektur.
**Alvor:** væsentlig
**Strukturel vurdering:** Tegn på et systemisk problem på tværs af hele det persisterede page-lag.
**Overvejelse:** En lokal udtrækning af de to største sider ville efterlade seks kontraktbrud og endnu et
størrelsesbaseret mønster, som kontrakten udtrykkeligt afviser. Enten skal det kategoriske mønster gennemføres
ensartet, eller også skal kontrakten ændres som en bevidst arkitekturbeslutning.
**Anbefaling:** Tag én samlet beslutning for alle otte pages og håndhæv derefter den valgte grænse strukturelt.
Hvis den gældende kontrakt bevares, flyttes afledt state, handlers og gates til ét page-level VM-indgangspunkt,
mens JSX opdeles i sektionskomponenter.
**Forslag til løsning:** Opret én kanonisk VM pr. §2.1-page, genbrug eksisterende rene domæneprojektioner og
tab-under-viewmodels, og tilføj et AST-værn der udleder §2.1-page-listen fra route-/kontraktinventaret frem for en
manuel LOC-tærskel.
**Kræver godkendelse:** nej — en adfærdsbevarende ansvarsflytning har ingen egentlig synlig UI/UX- eller
beregningsvirkning; ingen implementering er udført.
**Status:** **Rettet 2026-07-29** (etape 12)

**Løsningen fulgte fundets anbefaling: ét samlet valg for alle otte sider, håndhævet strukturelt.** Kontrakten
blev BEVARET (ikke ændret), og mønsteret er gennemført ensartet: hver §2.1-side har nu ét `useXxxViewModel`, som
ejer afledt state, handlers og gates, mens page-komponenten er reduceret til sektions-/fane-komposition.
EO's tre eksisterende tab-niveau-VM'er er bevaret uændret — §4.4's enhed er per SIDE, og tab-VM'er er tilladte
og ønskede subviews.

De to største sider bar hovedparten af arbejdet: `Forsoergertab.tsx` (652 → 38 linjer) og `Aarsloen.tsx`
(587 → 42) er blevet ren komposition over fem henholdsvis syv sektion-komponenter. Årsløns tre meddelelsesbokse
måtte blive TRE selvstændige komponenter frem for én: deres placering på siden er ikke sammenhængende (kritisk
fejl står øverst, advarsler og dokumentfejl mellem Beregningsprincipper og Beregning), og en samlet komponent
kunne ikke gengive rækkefølgen uden at flytte noget synligt.

**Værnet er DERIVERET, ikke erklæret** (fundets eget krav): `input/persisted-page-has-viewmodel` udleder
§2.1-sidelisten af `APP_ROUTES` i `config/pageNavigation.ts` og måler EKSISTENSEN af VM-indgangen — ikke
filstørrelse. En LOC-tærskel ville have accepteret syv kontraktbrud, så længe filerne var små nok, og samtidig
presset mod en kunstig opsplitning, når en side voksede. Mutationsbevist tre gange mod den LEVENDE kilde: en
inlinet VM gør reglen rød med sidens navn; en ny route-nøgle i `APP_ROUTES` gør den rød, FØR nogen skal huske en
liste; og en KOMMENTAR, der nævner `useXxxViewModel`, holder den rød (den måler kald, ikke tekst).

**Tre eksisterende værn fangede omlægningen** — og alle tre var ægte signaler, ikke støj:
* `domain/page-section-access-boundary` flagede de fire nye sektionsmapper; hver har nu SAMME autorisation som
  sin side, så ansvar ikke kan flyttes over grænsen ved at flytte en fil ned i mappen.
* `document/activation-shows-outcome` flagede, at Forsørgertabs download-AKTIVERING var flyttet væk fra sin
  udfaldsVISNING. Beskeden udledes nu i den sektion, der klikker.
* Consumer-ledgeren flagede fire flyttede beregningskaldere; posterne peger nu på VM'erne, som Renteberegning og
  Varige mén allerede gjorde med deres faner.

Adfærd, tal og dokumentindhold er uændrede: fuld suite grøn (505 filer / 6535 tests) uden et enkelt regenereret
golden-snapshot.

### R7-F02 — To persisterede toggles omgår feltfamilien og mister fokusmetadata

**Lokation:** `src/components/pages/Aarsloen.tsx:112-128,318-323`;
`src/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.tsx:83-90,250-280,382-390`;
`src/__tests__/quality/architecture/rules/formRules.ts:914-930`
**Problem:** To persisterede controls bruger `StyledToggleSwitch` direkte og forbinder den manuelt til
`useFieldEditor` eller en inputtransaktion. Selve control-callsite kræver derfor ikke en konkret `FieldRef`, og
ingen af de to calls fører `restoreTargetAttributes` videre. De omgår de typed `ToggleField`/
`MappedToggleField`-adaptere, som binder konkret ref, commitvej og fokusmetadata sammen.
**Evidens:** AST-inventaret fandt den rå toggle i `Aarsloen.tsx:318`. Målrettet søgning fandt den anden i
`OffentligeYdelserTab.tsx:385`. `historyRestoreTarget.ts:45-70` finder kun et undo/redo-mål, når DOM-elementet
bærer både serialiseret feltadresse og editorlokations-id. `StyledToggleSwitch` får kun disse attributter gennem
den eksplicitte `restoreTargetAttributes`-prop; begge callsites udelader den. Arkitekturtesten er grøn, fordi
`form/restore-target-attributes` kun anvendes på `src/inputCore/react/fields/**`, ikke på persisted page-callsites.
Det modsiger samtidig kommentaren i `domainRules.ts:518-535`, som hævder, at alle persisted controls
strukturelt kræver `FieldRef`.
**Angrebet der fandt det:** Den parallelle løsning, binding-bypass og grøn af tomhed/blindt scope.
**Konsekvens:** Undo/redo kan ikke refokusere de konkrete togglelokationer. Derudover kan nye page-lokale rå
controls gentage bypasset uden at blive fanget af det nuværende værn. Beregningstal og persisted write-semantik
blev ikke konstateret ændret.
**Alvor:** væsentlig
**Strukturel vurdering:** To lokale symptomer på en bredere, ubevogtet grænse mellem persisted feltadaptere og
rå præsentationsprimitiver.
**Overvejelse:** Årsløn-togglen har en gate med shake-feedback, og EO-togglen udfører en atomisk flerfelts-/
rækkehandling. De reelle behov forklarer specialadfærden, men ikke at FieldRef- og fokuskontrakten falder væk.
En simpel udskiftning med den nuværende standardtoggle er derfor ikke nødvendigvis tilstrækkelig.
**Anbefaling:** Udvid den typed persisted feltadapter med de faktisk nødvendige gate-/transaktionshooks og lad
de rå `Styled*`-primitiver forblive præsentationslag. Udvid værnet til alle persisted callsites, så direkte rå
controls bliver røde, med eksplicitte ikke-sagsdata-scopes for Indstillinger, Mineo og overlays.
**Forslag til løsning:** Indfør en typed gated/transactional toggle-adapter, der kræver `field` og `location`,
fører restore-attributter igennem og kan delegere den atomiske command uden at flytte domæneoprydning ind i den
generiske widget. Dæk undo/redo-fokus for begge konkrete controls med integrationstests.
**Kræver godkendelse:** nej for at genskabe den allerede dokumenterede undo/redo-fokusadfærd. Hvis løsningen
ændrer, hvilken kontrol brugeren fokuseres på ud over det oprindelige editorsted, er det en synlig
UI/UX-ændring og skal forelægges først — det gør den ikke.
**Status:** **Rettet 2026-07-29** (etape 7, andet pas; se
`work-items/WI-015-etape7-fokusmaal-ejerskab.md`)

**Løsningen (2026-07-28).** Ikke en tredje togglekomponent, men ÉN ny override på de to eksisterende typede
adaptere (`ToggleField`, `MappedToggleField`):

```ts
export type ToggleCommitDecision = 'commit' | 'reject' | 'handled';
export type ToggleCommitOverride<TValue> = (next: TValue) => ToggleCommitDecision;
```

Fundets "overvejelse" var korrekt: en simpel udskiftning med standardtogglen var ikke tilstrækkelig. Men det
tre-vejs-udfald viste sig at være PRÆCIS den mindste udvidelse, der dækker begge reelle behov — og en boolsk
override ville kun have dækket det ene. Årsløns gate skal kunne **afvise** aktiveringen, men vil have
adapteren til at udføre skrivningen (`'commit'`/`'reject'`); EO's toggle afslutter selv som **én atomisk
transaktion** over flere felter og rækker (`'handled'`, så adapteren ikke skriver oveni). Overriden flytter kun
AFSLUTNINGEN; identitet, visning og restore-attributter forbliver adapterens ansvar (§1.11).

Følgeændringer: `useOmregningToggle` skriver ikke længere selv (`onEnabledChange` er væk; hooken returnerer
`decideToggle`), fordi gaten er en afslutningsPOLITIK — ikke en grund til at forbinde et rå
`StyledToggleSwitch`. `ToggleField` fik `checkedOverride`, fordi Årsløns viste tilstand kommer fra gaten frem
for direkte fra feltets afsluttede værdi. I `Aarsloen.tsx` blev både `useFieldEditor`- og
`StyledToggleSwitch`-importen ubrugt — et bevis for at ændringen var komplet.

**Bevidst udestående:** fundets anbefaling om at UDVIDE VÆRNET til alle persisterede callsites er IKKE
gennemført. `form/restore-target-attributes` dækker fortsat kun `src/inputCore/react/fields/**`, hvilket var
netop grunden til, at disse to produktions-callsites var grønne. Det står som den største resterende post i
WI-015 sammen med kravet fra denne rapports tilfældighedsfund-liste om at genåbne værnets troværdighed.
Dækningen er indtil videre `useOmregningToggle.test.tsx` (10 tests) — som er mock-baseret og derfor IKKE
beviser det, fundet handler om; den manglende test er undo/redo-fokus gennem de ægte sider.

### R7-F03 — Global feltadresse bestemmer fokusdestinationen

**Lokation:** `src/inputCore/react/fieldAddressDestination.ts:6-18,33-156,185-213`;
`docs/architecture/draft-commit-greenfield-design.md:454-456`
**Problem:** Den centrale resolver gør feltets dataadresse til autoritet for route og fane gennem globale
EO-/EET-maps, sektionsdefaults og `currentPathname`-specialcases. Målarkitekturens §3.2 siger udtrykkeligt, at
fokusdestination er editorlokationens metadata, og at consumerens contentbox-link ejer sine prioriterede
lokationer.
**Evidens:** `resolveFieldAddressDestination(address, currentPathname)` udleder route fra sektionen og fane fra
adresse-/feltnavnemaps (`fieldAddressDestination.ts:185-213`). Delte felter kræver særregler baseret på aktuel
route (`:130-203`), hvilket konkret viser, at dataidentiteten ikke entydigt bestemmer editorlokationen.
Completeness-testen bestod, men efterprøver den nuværende modsatte model: at alle katalogfelter kan tildeles én
global destination.
**Angrebet der fandt det:** Dataidentitet forklædt som fokusmetadata, den parallelle løsning og den forældede
arkitekturpåstand.
**Konsekvens:** Nye spejlede editorer kræver centrale undtagelser, og save-fejlfokus kan vælge en teknisk
standardflade frem for den brugerrelevante lokation. Den observerede navigation kan derfor ændres, når
kontraktens lokationsejerskab implementeres.
**Alvor:** væsentlig
**Strukturel vurdering:** Systemisk ejerskabsfejl i fokusnavigationen, ikke et enkelt forkert map-entry.
**Overvejelse:** Undo/redo har allerede editorlokationen i sin history-origin og følger dermed den rigtige
retning. Save-blokering bærer kun feltadresser og kompenserer med den globale resolver. De to fokusflows har
derfor konkurrerende modeller.
**Anbefaling:** Konsolidér fokusnavigation omkring registrerede editorlokationer og consumer-ejede
prioritetslister. Bevar feltadressen som dataidentitet og DOM-matchnøgle, ikke som global route-/faneautoritet.
**Forslag til løsning:** Definér en typed lokationsregistrering, hvor hver konkret editor angiver route, fane og
lokations-id, og hvor den kaldende consumer prioriterer gyldige lokationer. Erstat completeness-testen med et
værn for levende, konkrete lokationer og eksplicit consumerprioritet.
**Kræver godkendelse:** Godkendt 2026-07-28. Hvis feltet kan rettes på den aktuelle side, skal brugeren blive
dér og sendes til den konkrete kontrol. Ellers sendes brugeren til den relevante side og fane for den del, som
rapporterede fejlen.
**Status:** **Rettet 2026-07-29** (etape 7, andet pas; se
`work-items/WI-015-etape7-fokusmaal-ejerskab.md`)

**Løsningen (2026-07-28).** `fieldAddressDestination.ts` er SLETTET (ikke omdøbt) sammen med sin
completeness-test. Den havde præcis ÉN produktionskonsument — save-blokeringens fokus — så fundets
"systemiske ejerskabsfejl" havde en enkelt, veldefineret rettelsesflade.

Erstatningen er `src/inputCore/react/editorLocationDestination.ts`: den editor, der faktisk RENDERER feltet,
bærer sin egen destination i DOM (`data-mineo-editor-route`/`-tab`, sat af `buildRestoreTargetAttributes` fra
`EditorLocation`). `lookupEditorLocation(serializedAddress)` returnerer `visible` / `mounted` / `unmounted`, og
`focusFirstBlockingRejectedField` følger den godkendte adfærd ordret: synlig editor → bliv stående og fokusér;
mountet men skjult → følg DENS erklærede route + fane; intet mountet → sektionens side, og **gæt ikke en fane**,
fordi kun lokationen ved det. `faellesAarsloen` har ingen egen route; uden en mountet editor navigeres der ikke.

**Sondringen mellem MOUNTET og SYNLIG er mekanismens grundlag.** EO's faner mountes ved første besøg og
forbliver mountet (skjult med `display: none`, `Erstatningsopgoerelse.tsx:129-200`), så en editor på en besøgt
fane findes i DOM og kan oplyse sin destination, selv når fanen ikke er synlig. Mounter editoren først EFTER
navigationen (lazy tab-mount), aktiverer vent-på-mount-løkken dens fane ÉN gang — uden det ville et felt på en
ikke-besøgt, ikke-standard fane være uopnåeligt.

**To ting bekræftede fundets diagnose stærkere end evidensen i selve fundet:**

1. *Særreglerne forsvandt.* Den gamle model havde fem — `faellesAarsloen`, de tre kontekst-delte forligsfelter,
   `eoBilagSelection`, og `currentPathname`-cases. Hver enkelt var begrundet; tilsammen var de beviset på, at
   nøglen var forkert. Ingen af dem findes i den nye model, og ingen adfærd blev valgt bort: den synlige editor
   vinder, og det er hele forklaringen.
2. *Det valgfrie felt havde nul legitime brugere.* `EditorLocation.route`/`.tabKey` var `?`-valgfri, dokumenteret
   som "udelades kun af rene ikke-navigerbare lokationer". Alle 82 produktionsdeklarationer satte dem alligevel,
   og **produktionen typecheckede uændret**, da de blev påkrævede — kun tests udnyttede valgfriheden. Grænsen er
   dermed primært en TYPE, ikke et værn (jf. R3-F04 og GM-F07's mønster).
   `NON_NAVIGABLE_ROUTE` (tom streng) er den eksplicitte værdi for en standalone-/devtools-lokation, så fraværet
   er en synlig beslutning frem for et udeladt felt — og et værn kan skelne de to.

Fundets forslag om en "typed lokationsREGISTRERING" blev vurderet og ikke gennemført: DOM er allerede
registeret over mounted editorer, og et parallelt React-register ville være en anden kopi af samme sandhed med
sin egen livscyklus at holde i sync. Det er samme afvejning som `historyRestoreTarget`, der af samme grund slår
op i DOM.

Dækning: `saveBlockedFocus.test.ts` er omskrevet (13 tests). De to, den gamle model kun kunne bestå med
særregler: «aktiverer den fane, DEN MOUNTEDE editor erklærer» og «holder brugeren ved den SYNLIGE spejling af et
delt felt uden en kontekst-særregel». **Bevidst udestående:** completeness-testen er erstattet af typen, men det
værn, fundet efterspørger — for LEVENDE, konkrete lokationer, inkl. de to nye DOM-attributter — er ikke skrevet.
Det står i WI-015.

## Resterende checkpoints

- Browserbaseret visuel sammenligning af fælles page-, tab-, download- og fejlmønstre er ikke gennemført.
- Tab-mountstrategierne er inspiceret statisk, men er ikke runtime-fuzzede på tværs af alle sider med åbne
  editorer, tabskift og efterfølgende remount.
- Der er ikke udført mutationstest, fordi passet var read-only. Værnets blindhed i R7-F02 blev i stedet bevist
  ved et levende produktions-callsite, som 91 grønne målrettede tests ikke flagede.
- R7's exitkriterium er ikke opfyldt, før de tre systemiske fund er løst eller kontrakten bevidst er ændret.

## Tilfældighedsfund

- Migrationssprog lever fortsat i produktionskommentarer, blandt andet `src/main.tsx:12`,
  `src/components/pages/Stamdata.tsx:18-25`, `src/components/pages/Erhvervsevnetab.tsx:26-28` og flere
  feltfamiliekommentarer. Det beskriver migrationsforløbet frem for slutarkitekturen og hører til R1's
  sluttilstandssprog.
- `form/restore-target-attributes` er smallere end den arkitekturpåstand, det bruges til at understøtte.
  R7-F02 kræver derfor, at det relevante R0-værns troværdighed genåbnes ved den videre behandling.
  **Lukket 2026-07-29:** den gamle regel er bevaret (den dækker feltfamiliens interne krav), men grænsen mod
  produktions-callsites håndhæves nu af `input/persisted-controls-use-field-family` over hele komponent-laget.
  Efterprøvningen viste desuden, at der efter R7-F02's rettelse kun findes TRE rå control-callsites tilbage —
  Indstillinger, Mineo og løntrin-overlayet — alle uden persisteret sagsdata, og alle eksplicit navngivne i
  reglen frem for at være en åben allowlist.

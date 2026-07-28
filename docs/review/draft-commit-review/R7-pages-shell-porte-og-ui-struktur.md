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
**Fund:** 3 (R7-F01, R7-F02, R7-F03)
**Hypoteser:** Ingen
**Handling:** R7-F03 er godkendt til implementering; de øvrige fund er parkeret uden implementering.
**Næste skridt:** Implementér R7-F03 som godkendt; gennemfør browserbaseret UI-sammenligning og runtime-fuzzing
af tab-mount/settle; genåbn det berørte arkitekturværns scope ved løsning af R7-F02.

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
**Status:** parkeret

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
**Kræver godkendelse:** nej for at genskabe den allerede dokumenterede undo/redo-fokusadfærd; ingen
implementering er udført. Hvis løsningen ændrer, hvilken kontrol brugeren fokuseres på ud over det oprindelige
editorsted, er det en synlig UI/UX-ændring og skal forelægges først.
**Status:** parkeret

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
**Status:** Godkendt til implementering

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

# R8 — Testkvalitet, kvalitetsværn og acceptmatrix

**Status:** Delvist gennemgået  
**Dato:** 2026-07-28  
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
**Handling:** Read-only review; ingen produktions-, test-, plan- eller oversigtsfiler ændret.  
**Næste skridt:** Etabler en levende 30-punkts acceptbinding og gennemfør de manglende matricer og
mutationer; auditér derefter de resterende quality guards og mocks.

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
**Status:** Under videre analyse

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
**Status:** Under videre analyse

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
**Status:** Under videre analyse

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
**Status:** Under videre analyse

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
**Status:** Under videre analyse

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
**Status:** Under videre analyse

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
**Status:** Under videre analyse

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
**Status:** Under videre analyse

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
**Status:** Hypotese — verificeret åben begrænsning, ikke talt som lukket fund

## Tilfældighedsfund

- `src/contracts/form-contract.md` beskriver i indledningen fortsat implementeringen som noget, der migreres, og
  har et særskilt historisk afsnit om den slettede migrationsarkitektur.
- `src/contracts/critical-action-contract.md` §6 indeholder en historikparentes om tidligere hooknavne.
- Disse kontraktfund er ikke rettet eller fuldt afgrænset i R8; de hører også under R1's sluttilstandssweep.

## Resterende checkpoints

R8 kan ikke sættes til `Gennemgået`, før mindst følgende er efterprøvet:

1. En reel 30-punkts §10-matrix er bundet til aktive leaf-tests og mutationstestet på de dyreste invarianter.
2. §7.1's fælles feltkontrakt er kørt mod både form og grid for alle levende codecfamilier.
3. Alle otte §7.2-statekæder hævder alle ni aspekter ved hvert trin.
4. §7.3-matricen har faktiske warning-, irrelevant-, række-, aggregat- og blocked-engine-cases på tværs af
   UI, beregning, dokument og `.eo`.
5. §7.4 er exhaustivt bundet til alle runtime-command-kinds med relevante rollback-faults.
6. §7.5 er integrationstestet med virkelige form- og grid-editorer for alle kritiske handlinger.
7. De resterende selvstændige quality guards er semantisk auditeret mod den aktuelle arkitektur; dette pas
   dækkede arkitekturharnessen og de mest relevante input-/EO-guards, ikke hver quality-fil.
8. Den bredere mock-audit uden for critical-action-/dokumentområdet er gennemført.
9. R8-F09 er af- eller bekræftet ved en strukturel typegrænse og relevant mutation.

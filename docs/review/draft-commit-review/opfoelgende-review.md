# Opfølgende review af draft/commit-rettelser

**Dato:** 2026-07-30  
**Reviewgrundlag:** `fund-oversigt.md`, de tilhørende etaperapporter, brugertestfundene, gældende kontrakter samt den aktuelle implementering og testpakke på branch `greenfield`.

## Konklusion

De fleste konkrete fejlscenarier fra det tidligere review er rettet, og den fulde testpakke er grøn. Rettelserne kan dog ikke samlet godkendes som en afsluttet greenfield-implementering.

Reviewet finder syv væsentlige modfund:

1. Den kritiske replacement-koordinator håndhæver ikke den synkrone callback-grænse, som rettelsen bygger sin sikkerhed på.
2. Afledte, låste satsværdier er materialiseret som persisteret input, selv om de udtrykkeligt ikke er brugerinput.
3. Fokus ved blokeret gemning kan ikke finde felter på faner, som aldrig har været mounted.
4. Dokumentgatens samlede korrekthed er fortsat ikke testet for alle dokumenttyper; den nye parity-test kan kun påvise uenighed mellem to kald til den samme definition.
5. Issue-afhængigheder er stadig brede sektionslæsninger efterfulgt af manuelle tekst-ID-lister, så den oprindelige fejlkategori kan genopstå.
6. Page-arkitekturværnet håndhæver kun tilstedeværelsen af en viewmodel, ikke det ejerskab og den enhed, kontrakten lover.
7. Sluttilstandssproget er fortsat præget af implementeringsfaser og work-item-historik i produktionskode og kontrakter.

Derudover er den centrale fundoversigt blevet forældet og underoptæller de afsluttede brugertestfund.

Der er ikke i dette review påvist en ny konkret fejl i de producerede beregningstal. Fundene vedrører inputintegritet, persistence, navigation, dokumentgates, arkitekturværn og dokumentation.

## Fundoversigt

| ID | Alvor | Relaterede tidligere fund | Vurdering |
|---|---|---|---|
| OF-F01 | Væsentlig | R4-F01 | Den aktuelle fejlsti er rettet, men sikkerhedsgrænsen findes ikke |
| OF-F02 | Væsentlig | GM-F02 | Funktionelt stabil, men forkert greenfield- og persistence-model |
| OF-F03 | Væsentlig | R7-F03, GM-F10 | Rettelsen fejler for aldrig mounted faner |
| OF-F04 | Væsentlig | R6-F04 | Det oprindelige dækningskrav er ikke opfyldt |
| OF-F05 | Væsentlig | R3-F01, R3-F02, R3-F04 | Kendte symptomer er rettet, men fejlklassen består |
| OF-F06 | Middel | R7-F01 | Implementeringen er forbedret, men værnet beviser ikke kontrakten |
| OF-F07 | Væsentlig | R1-F05 samt dele af R1-F03/R1-F06 | Sluttilstandssproget er ikke gennemført |
| OF-F08 | Mindre | Tilfældighedsfund | Den centrale fundregistrering er inkonsistent |

## OF-F01 — Replacement-koordinatorens synkrone grænse er ikke håndhævet

**Relateret fund:** R4-F01.

### Problem

Rettelsen opdeler load i en autoritativ replacement og en efterfølgende metadatafase. De aktuelle produktionskald sender synkrone callbacks, så det oprindeligt observerede metadata-vindue er lukket.

Sikkerheden beskrives imidlertid som typehåndhævet, men `CriticalActionCoordinator.applyReplacement` og `applyDestructive` accepterer generiske callbacks af typen `() => T`. TypeScript infererer uden fejl `T` som `Promise<void>`, hvis en senere callsite sender en `async` callback. Der findes derfor ingen compiler-grænse mod den regression, rettelsen siger at forhindre.

Koordinatoren kontrollerer generationen umiddelbart efter callbackens retur. En asynkron callback returnerer straks et promise, hvorefter koordinatoren kan afvise operationen, mens callbacken fortsætter efter sit første `await` og senere muterer state. Det er en latent fail-closed-fejl: systemet kan rapportere afvisning uden at have forhindret den efterfølgende mutation.

**Evidens:**

- `src/inputCore/runtime/criticalActionCoordinator.ts`: begge metoder er generiske over callbackens returtype.
- De aktuelle kald i `RenteberegningTab.tsx`, `caseResetOperations.ts` og `useFileSaveLoad.ts` er synkrone; fundet er derfor en manglende barriere, ikke en påvist aktiv async-callsite.
- En isoleret TypeScript-kompilering accepterer `applyReplacement(async () => { ... })` uden diagnostik.

### Vurdering af rettelsen

1. **Reel løsning:** Ja for det nuværende load-flow, nej som varig garanti mod problemtypen.
2. **Greenfield:** Nej. En trust-kritisk transaktionsgrænse afhænger fortsat af, at fremtidige callers frivilligt overholder en uskrevet synkron regel.
3. **Struktur:** Koordinatoren er et passende samlet sted, men dens callback-API er bredere end det tilladte state-flow.

### Anbefalet løsning

Erstat den generiske callback-port med eksplicitte synkrone transaktionskommandoer. Koordinatoren bør selv kalde en kendt, synkron systemport til eksempelvis case replacement og reset, så caller ikke kan indlejre vilkårlig asynkron adfærd i den kritiske sektion.

Hvis en callback undtagelsesvis bevares, skal typen afvise promise-retur, der skal findes en compile-negative test, og runtime skal afvise thenables. Det er dog kun et sekundært værn; en allerede startet async-callback kan ikke annulleres sikkert, hvorfor en eksplicit kommandoport er den robuste greenfield-løsning.

## OF-F02 — Afledte satser er fejlagtigt gjort til persisteret input

**Relateret fund:** GM-F02.

### Problem

Rettelsen introducerer `DerivedInputWrite`, som materialiserer låste, afledte lønindkomstsatser i inputaggregatet ved hver kommando. Implementeringen og dens kommentarer fastslår samtidig, at værdierne er afledte og ikke brugerinput.

Fordi felterne ligger i sektionsschemaet, bliver de inkluderet i `.eo`-saveprojektionen sammen med egentligt brugerinput. Ved load accepteres de som input og repareres efterfølgende. Det strider mod persistence-kontraktens regel om, at `.eo` kun indeholder brugerindtastede eller brugervalgte værdier, mens afledte værdier genberegnes efter load.

Rettelsen stabiliserer de viste værdier, men gør det ved at bevare og automatisk vedligeholde en legacy-formet repræsentation i stedet for at etablere en ren grænse mellem brugerinput og domæneprojektion. Den tilføjer samtidig endnu en intern skrivekategori til feltkatalog og reducerer, selv om værdierne ikke må redigeres af brugeren.

**Evidens:**

- `src/domain/erstatningsopgoerelse/control/loenindkomstSatsDerivedWrite.ts`: værdierne beskrives som afledte og ikke som brugerinput.
- `src/inputCore/fieldCatalog.ts`: den generiske `DerivedInputWrite`-mekanisme.
- `src/inputCore/inputReducer.ts`: afledte writes materialiseres ved inputkommandoer.
- Erstatningsopgørelsens persistence-schema indeholder de afledte satsfelter.
- `src/persistence/eoSaveProjection.ts` serialiserer de schema-dækkede sektionsværdier.
- `src/contracts/persistence-contract.md` kræver, at afledte værdier udelades fra `.eo`.

### Vurdering af rettelsen

1. **Reel løsning:** Ja for den konkrete synkronisering, men den flytter problemet ind i persistence-modellen.
2. **Greenfield:** Nej. Løsningen bygger videre på, at de afledte værdier ligner persisteret input.
3. **Struktur:** Mekanismen er samlet og typed, men abstraherer en uønsket state-kategori og øger inputkernens kompleksitet.

### Anbefalet løsning

Fjern reelt afledte og låste værdier fra det persisterede sektionsschema og inputaggregat. Udled dem i en navngiven, typed domæneprojektion fra de faktiske brugerinput, indstillinger og autoritative satskilder. UI skal læse den samme projektion som beregning og dokumenter.

Kun værdier, som brugeren faktisk vælger eller overskriver ved en eksplicit handling, må få et persisteret inputslot. Ved load skal eventuelle historiske afledte slots ignoreres, og projektionen skal genberegnes før første consumer-læsning.

## OF-F03 — Gemmefokus kan ikke finde et felt på en aldrig mounted fane

**Relaterede fund:** R7-F03 og GM-F10.

### Problem

Rettelsen bruger registrerede DOM-editorer som eneste autoritet for et felts placering. Når det blokerende felt ikke er mounted, kender fokusflowet højst sektionens fallback-route. Det navigerer til sektionen og venter derefter på, at editoren registreres, før det kan vælge den rigtige fane.

Flere sider mounter kun den aktive fane. Hvis det blokerende felt ligger på en ikke-default fane, som brugeren aldrig har åbnet, bliver editoren derfor aldrig registreret. Flowet kan ikke udlede fanen, fanen bliver ikke aktiveret, og editoren kan følgelig aldrig blive mounted. Venteløkken løser ikke den cirkulære afhængighed.

`faellesAarsloen` har desuden ingen generel fallback-route i dette flow. Et rejected felt uden en allerede mounted mirror-editor kan derfor blive helt uden navigation.

**Evidens:**

- `src/documents/saveBlockedFocus.ts`: placeringen slås op i den mounted editor-registry; fallback navigerer kun til sektionen, og fanen vælges først efter en senere registrering.
- `Erhvervsevnetab.tsx` mounter kun indholdet for den aktive fane.
- `Erstatningsopgoerelse.tsx` lazy-mounter ikke-default faner.
- `saveBlockedFocus.test.ts` beviser sektionsnavigation og fravær af gættet fane, men ikke fokus på et felt på en aldrig mounted ikke-default fane.

### Vurdering af rettelsen

1. **Reel løsning:** Delvist. Den virker for allerede mounted editorer og simple routes, men ikke for en central lazy-mount-situation.
2. **Greenfield:** Nej. Runtime-DOM anvendes som eneste arkitekturregister for information, som skal være kendt før DOM-elementet kan eksistere.
3. **Struktur:** Registryen er velegnet til at vælge og fokusere en konkret mounted editor, men ikke til route- og faneresolution.

### Anbefalet løsning

Etabler et statisk, typed editor-lokationskatalog keyed af feltadresse eller adresseskabelon. Kataloget skal angive route, eventuel fane og prioriteret consumer/mirror. Dynamiske rækker resolver først deres adresseskabelon og bevarer entity-ID til det efterfølgende konkrete DOM-opslag.

Brug derefter to tydelige trin:

1. Den statiske lokation aktiverer korrekt route og fane.
2. DOM-registryen vælger og fokuserer den nu mounted konkrete editor.

Tilføj integrationstests, der starter på en anden side og målretter rejected input på hver aldrig mounted ikke-default fane samt `faellesAarsloen`.

## OF-F04 — Dokumentgate-testen kan ikke afsløre en fælles forkert definition

**Relateret fund:** R6-F04.

### Problem

Det tidligere fund krævede meningsfuld dækningskontrol for alle 18 dokumentoutputs: klar tilstand, relevant ugyldighed, bounds-fejl, warning og ikke-relevant fejl.

Rettelsen tilføjer en parity-test, der kalder den samme dokumentdefinition gennem den reaktive gate og click-preflight og sammenligner resultaterne. Det beviser kanalparitet, men ikke definitionens domænemæssige korrekthed. Hvis definitionen både i gate og preflight mangler en relevant afhængighed eller medtager en uvedkommende fejl, returnerer begge kanaler samme forkerte svar, og testen består.

Den særskilte gate-matrix dækker kun satser, varigt mén, forsørgertab og renteoversigt. De øvrige definitioner har ikke den samlede, typed fixture-dækning, som det oprindelige fund efterspurgte.

**Evidens:**

- `documentGatePreflightParity.test.ts` fravælger udtrykkeligt en fuld klassematrix og itererer i stedet definitionerne med parity-fixtures.
- `documentGateMatrix.test.ts` indeholder kun fire dokumentområder.

### Vurdering af rettelsen

1. **Reel løsning:** Nej. Den nye test løser en beslægtet konsistensrisiko, men ikke det fundne dækningsproblem.
2. **Greenfield:** Delvist. En fælles definition for gate og preflight er korrekt, men kræver uafhængige forventninger til selve definitionen.
3. **Struktur:** Parity-runneren er nyttig og bør bevares, men den er blevet brugt som erstatning for en anden testdimension.

### Anbefalet løsning

Opret et typed fixture-register keyed af samtlige IDs i `MINEO_DOCUMENT_OUTPUT_IDS`. Hver definition skal levere:

- en klar, downloadbar tilstand,
- hver fejlklasse, som outputtet faktisk kan nå,
- mindst én relevant bounds-/domænefejl,
- warning uden blokering, hvor det er relevant,
- en eksplicit uvedkommende fejl, som ikke må blokere.

Hvis en klasse ikke findes for et output, skal dette angives eksplicit og begrundes, så registeret fortsat er compiler-komplet. En fælles runner skal teste både definitionens direkte projektion og den fulde download-livscyklus uden fil-I/O. Parity-testen beholdes som et separat invariantværn.

## OF-F05 — Manuelle issue-ID-lister bevarer den oprindelige fejlklasse

**Relaterede fund:** R3-F01, R3-F02 og R3-F04.

### Problem

De kendte overblokeringer er rettet ved at indføre manuelle lister over relevante felt-ID'er og grupper. Consumeren læser fortsat en hel sektions issue-bag gennem `InputReader.readSectionFieldIssues` og filtrerer derefter med tekstbaserede inventarer.

Det binder ikke issue-afhængigheden til de værdier, motoren faktisk læser. En ny motorafhængighed kan tilføjes uden at dens felt-ID føjes til listen. Et gammelt ID kan samtidig blive stående og fortsat blokere, så længe feltet stadig eksisterer. De såkaldte completeness-tests beviser hovedsageligt, at de oplistede IDs eksisterer og er klassificeret; de beviser ikke, at listen svarer til consumerens konkrete read-set.

Den brede sektionsmetode er samtidig en offentlig del af `InputReader`, selv om rettelsens mål var, at blokering skulle følge konkrete reads. Derved bevares den mekanisme, der gjorde de oprindelige overblokeringer mulige.

**Evidens:**

- `src/inputCore/read/inputReader.ts`: offentlig `readSectionFieldIssues`.
- EET-importen har et manuelt `IMPORT_DEPENDENCY_FIELD_IDS` og filtrerer en samlet sektionslæsning.
- EO har manuelle grupper som `SVIE_SMERTE_GROUP`, `TAF_GROUP` og `EO_RELEVANT_STAMDATA_FIELD_IDS`.
- De tilhørende tests kontrollerer inventarets eksistens og klassifikation, ikke en typed binding mellem motorens reads og dens blockers.

### Vurdering af rettelsen

1. **Reel løsning:** Ja for de konkret kendte falske blokeringer, nej for fejlklassens gentagelsesrisiko.
2. **Greenfield:** Nej. Løsningen lægger kuraterede lister oven på en bred issue-bag i stedet for at lade afhængigheden udspringe af projektionen.
3. **Struktur:** Listerne er bedre end ad hoc-filtrering spredt i UI, men de udgør parallel metadata til den egentlige motor.

### Anbefalet løsning

Lad hver consumer bygge sit motorinput gennem en typed projektion, der læser konkrete `FieldRef`s via readeren og samtidig samler issues for netop disse reads. Branch-specifikke motorveje skal have branch-specifikke projektioner, så inaktive felter aldrig bliver dependencies.

For collections skal projektionen enumerere de relevante rækker og cellereferencer. Strukturelle rækkeissues skal repræsenteres som typed projektioner over de bundne refs, ikke som en efterfølgende sektionsscan.

Fjern `readSectionFieldIssues` fra den almindelige consumer-port. Hvis UI-diagnostik har et reelt behov for en sektionsoversigt, skal det være en særskilt, snæver diagnostics-port, som beregninger, imports og dokumentgates ikke kan bruge.

## OF-F06 — Page-værnet håndhæver ikke viewmodel-ejerskabet

**Relateret fund:** R7-F01.

### Problem

Siderne er reelt blevet reduceret og flyttet mod page-lokale viewmodels. Det er en klar forbedring. Det nye arkitekturværn kontrollerer dog kun med `.some(...)`, at en side kalder mindst én page-viewmodel, mens kontrakten siger præcis én.

En side kan derfor:

- kalde to konkurrerende viewmodels,
- beholde afledt state, handlers og gates inline,
- tilføje et tomt viewmodel-kald alene for at tilfredsstille værnet.

Værnet bruger desuden et manuelt map fra route keys til sidefiler. Det opdager en manglende map-post, men det er endnu et inventar, der skal vedligeholdes parallelt med den autoritative route-/page-struktur.

### Vurdering af rettelsen

1. **Reel løsning:** Den aktuelle sidestruktur er forbedret; regressionsværnet dækker kun en svagere egenskab end den dokumenterede.
2. **Greenfield:** Overvejende ja i produktionskoden, men ikke i guardens autoritetsmodel.
3. **Struktur:** Guardens påstand og dens faktiske AST-kontrol er ude af sync.

### Anbefalet løsning

Lad værnet tælle page-specifikke viewmodel-kald og kræve præcis ét importeret fra den kanoniske page-lokale viewmodel. Forbyd samtidig de konkrete orkestreringsporte, som kun viewmodel-laget må kalde, direkte fra page-komponenten.

Afled pagefilen fra den autoritative page-/route-definition, hvis dette kan gøres uden en ny konkurrerende registry. Hvis arkitekturen reelt kun kræver “mindst én”, skal kontraktens stærkere løfte i stedet fjernes; guard og kontrakt må beskrive samme invariant.

## OF-F07 — Produktionskoden er stadig forklaret gennem migreringshistorik

**Relateret fund:** R1-F05 samt dele af R1-F03 og R1-F06.

### Problem

Det tidligere review krævede en reel sluttilstand, hvor kode og kontrakter forklarer gældende ansvar og invarianter frem for rejsen gennem faser, passes og work items. Rettelsen har især ryddet navne og enkelte migrationsmarkører, men der er fortsat mange entydigt historiske markører i produktionskoden.

Eksempler omfatter:

- dokumentmoduler med overskrifter som “Fase 5, pass …”,
- `sourceSettings.ts` med WI-008/WI-009 og fasehenvisninger,
- `inputReducer.ts` med Fase 2/WI-004,
- `consumerInventory.ts` med Fase 5,
- ledgers med review-ID'er og cutover-historik,
- `app-settings.md` med WI-009 og R6-F03 som forklaring på gældende design.

En bred kandidatsøgning efter fase-, pass-, WI-, greenfield- og cutover-markører gav 151 matchlinjer i 84 produktionsfiler samt yderligere kontraktmatches. Ikke alle matches er fejl: eksempelvis kan migration af `.eo`-formater og domænets egne skæringsbegreber være legitimt. De nævnte eksempler er derimod entydigt projektforløb og gør den aktuelle arkitektur afhængig af reviewhistorikken for at kunne forstås.

### Vurdering af rettelsen

1. **Reel løsning:** Delvist. Navngivningen er forbedret, men sluttilstandssproget er ikke gennemført.
2. **Greenfield:** Nej for de berørte kommentarer og kontraktpassager; de beskriver fortsat et overgangsprojekt.
3. **Struktur:** Historisk kontekst er spredt ind i autoritative kilder i stedet for at være isoleret i reviewjournaler.

### Anbefalet løsning

Gennemgå produktionskommentarer, JSDoc, ledgers og kontrakter og omskriv hver historisk forklaring til:

- den aktuelle invariant,
- det konkrete problem, den beskytter imod,
- hvorfor en naiv løsning ikke virker.

Bevar kun migrationssprog, hvor runtime faktisk understøtter data- eller schemaovergange. Flyt implementeringshistorik, work-item-numre og reviewreferencer til reviewjournaler.

Tilføj eventuelt et præcist tekst-/AST-værn mod entydige projektmarkører som `WI-###`, “Fase N” og “pass N” i produktionskommentarer og kontrakter. Værnet skal have snævre undtagelser for reelle persistence-migrationer og må ikke ramme almindelige danske domæneord.

## OF-F08 — Fundoversigten underoptæller brugertestfundene

**Type:** Tilfældighedsfund.

### Problem

`fund-oversigt.md` angiver 6 brugertestfund og 79 fund i alt. `draft-commit-brugertestfund.md` indeholder nu UT-F01 til UT-F08, herunder de senere tilføjede og afsluttede UT-F07 og UT-F08.

Med oversigtens øvrige kategorital giver registreringen 81 fund, ikke 79. Påstanden om, at alle 79 registrerede fund er håndteret, beskriver derfor ikke længere det faktiske reviewmateriale. Brugertestrapportens overordnede status står desuden fortsat som “I gang”, selv om alle dens viste fund er lukket.

### Konsekvens

Den centrale status kan ikke bruges som autoritativ completeness-kontrol for opfølgningen. Det er en dokumentationsfejl, ikke en produktfejl, men den svækker sporbarheden i et review, der netop bruges som acceptgrundlag.

### Anbefalet løsning

Gør én fil til autoritativt register og afled kategorital og totaler maskinelt fra de faktiske fund-ID'er. Lad verificeringen fejle ved dubletter, huller, ukendte statustekster og uoverensstemmelse mellem register og delrapporter.

## Områder uden nyt modfund

De øvrige tidligere fund er gennemgået gennem deres rettelsesbeskrivelser, relevante produktionsstier, kontrakter og tests. Reviewet fandt ikke yderligere dokumenterbare fejl ud over fundene ovenfor.

Det er ikke det samme som et formelt bevis for korrekthed i alle UI-forløb. Der er ikke udført interaktiv browsertest i denne opfølgning.

## Slutstatus for rettelserne (2026-07-30)

Alle otte modfund er håndteret, og hvert værn er mutationstestet — ikke blot set grønt.

| ID | Håndtering | Bevis |
|---|---|---|
| OF-F01 | `SynchronousResult<T>` gør en `async` callback til `never` + runtime-thenable-værn | Compile-negativ probe: `applyReplacement(async () => …)` afvises, synkron callback kompilerer |
| OF-F02 | Satserne udledes i `loenindkomstSatsProjection` og er FJERNET fra det persisterede schema | Persisteret model har intet slot; projektionen udleder 0,45 %; låst sats udelades ved save, fri sats bevares |
| OF-F03 | Statisk `fieldLocationCatalog` (route + fane pr. adressetemplate) aktiverer fanen før DOM-opslaget | Katalogbygningen kræver en destination pr. descriptor |
| OF-F04 | Compiler-komplet fixture-register for alle 18 outputs + fuld download-livscyklus | `Object.keys(FIXTURES)` låst mod `MINEO_DOCUMENT_OUTPUT_IDS` |
| OF-F05 | Manuelle ID-lister og `readSectionFieldIssues` er væk; consumers læser sporede refs | Kun en snæver devtools-port tilbage; `createTrackedInputReader` er guard-anker |
| OF-F06 | Værnet kræver PRÆCIS én page-viewmodel og forbyder orkestreringsporte i page-komponenten | Sidelisten deriveres af `APP_PAGE_DEFINITIONS` |
| OF-F07 | Tekstværn over 858 produktionsfiler + alle kontrakt-`.md` | Mutation: en indsat `WI-042/Fase 3/pass 2`-kommentar gør værnet rødt |
| OF-F08 | `verify-review-findings.mjs` udleder totaler af de faktiske rækker | Registret rapporterer nu 81 fund uden huller |

### Rettelse fundet under dette eget-review

`verify:ledgers` var **rød**, og fejlen blev indført af rettelsen selv. OF-F02 fjernede satsslottet med en
`.transform()` på ansættelsesschemaet. Zod udsender da et uigennemsigtigt output-schema — konkret
`items: {}` for ansættelses-arrayet — så `z.toJSONSchema` ikke længere kunne se det nestede løntræ:
feltudledningen faldt fra 239 til 190 og collections fra 16 til 13. Det ramte samtidig
schema-fingerprintet, der altså stod "stabilt" på et blindt schema.

Stripningen er flyttet til sektionsmigratoren, som §3.1a udpeger som ejer. Det bevarer schemaet
introspektivt OG er mere korrekt: et strippet ukendt felt rapporteres i preflight som tabt indtastning,
mens en migration ikke gør det — og satsen genudledes, så den aldrig var tabt.

Nyt værn: `ledgerCompleteness` måler nu gennemsigtigheden DIREKTE (ingen collection må udsende en tom
node). Optællings-testene kunne ikke fange fejlen alene, fordi en blinding fulgt af en nedjusteret
baseline ville stå grøn. Mutationstesten bekræfter, at det nye værn fejler isoleret og navngiver den
blindede collection. Desuden lukket: `fieldLocationCatalog` manglede i katalogkortet, og
`domainBoundaryIsolation` havde et forældet anker efter samme commits refaktorering.

## Verifikation

Følgende tjek er kørt og bestået:

- `npm run typecheck`
- `npm run typecheck:test`
- `npm run lint`
- `npm run verify:ledgers`
- `npm run test` — 509 testfiler og 6.592 tests bestået

`npm run check:runtime` er kørt og afviste korrekt det aktuelle miljø, fordi reviewet blev udført med Node 26.5.0/npm 11.13.0, mens projektet kræver Node 24.18.x/npm 11.16.x. Den samlede release-gate er derfor ikke kørt på den understøttede runtime.

Build er ikke kørt, fordi reviewet ikke ændrer kode, config, app-entry eller assets. Interaktiv browsertest er ikke kørt, fordi opgaven er et statisk opfølgningsreview, og fundene ovenfor kan dokumenteres uden UI-ændringer.

### Efter rettelserne (2026-07-30)

- `npm run typecheck` og `npm run typecheck:test` — rene
- `npm run lint` — ren (exit 0)
- `npm run test` — **511 testfiler / 6.527 tests bestået**
- `npm run verify:ledgers` — 18 tests bestået (var rød før denne omgang)
- `node scripts/architecture/verify-review-findings.mjs` — 81 fund, ingen huller
- `npm run build:all` — bygger (kun de kendte, forudbestående chunk-/dynamic-import-advarsler)

`npm run check:runtime` afviser fortsat miljøet af samme grund som ovenfor (Node 26.5.0 vs. krævet
24.18.x), så den samlede release-gate er ikke kørt på den understøttede runtime. Ingen
golden-snapshots er regenereret; den ene snapshot-ændring er `persistedInputSchemaPaths.json`, hvor
præcis én linje — det afledte satsfelt — er fjernet. Interaktiv browsertest er ikke kørt.

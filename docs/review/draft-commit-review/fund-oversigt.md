# Fundoversigt

Samlet register over alle fund i draft/commit-reviewet: fasefundene (R0–R8), det tværgående
konvergensreview (GM-F01–GM-F15) og brugertestfundene (UT-F01–UT-F06). Én linje pr. fund, ingen prosa —
beskrivelse, evidens og løsningsretning står i rapporten, fundet henviser til.

**Sidst opdateret:** 2026-07-28

## Status

| Kilde | Fund | Åbne | Rettet | Afvist |
|---|---:|---:|---:|---:|
| R0–R8 (fasefund) | 36 | 33 | 3 | 0 |
| GM (konvergensreview) | 15 | 13 | 1 (1 delvist) | 0 |
| UT (brugertest) | 6 | 3 | 2 | 1 |
| INC (tilfældighedsfund) | 3 | 0 | 3 | 0 |
| **I alt** | **60** | **49** | **9 (+1 delvist)** | **1** |

## Bindende regel for tilfældighedsfund

Konstateres et fund undervejs i rettearbejdet — eller i øvrigt i forbindelse med denne proces — som ikke
allerede står i dette register, gælder ét af to udfald. Ingen tredje mulighed findes, og et fund må aldrig
blot passere i en chatbesked:

1. **Rettes straks**, hvis rettelsen ligger inden for den aktuelle ændrings naturlige omfang og ikke kræver
   godkendelse. Fundet skrives ind i registeret med status `Rettet` og en note om, hvilken rettelse det fulgte
   med, så det ikke ser ud som om det aldrig fandtes.
2. **Skrives ind som nyt fund** med næste ledige id i sin kilde (`R<n>-F<nn>`, `GM-F<nn>`, `UT-F<nn>` — eller
   `INC-F<nn>` hvis det ikke hører til en fase), en linje her, og en fuld beskrivelse i den relevante rapport
   efter standardformatet i review-planen. Er det for stort til at rette i reviewets løb, oprettes en work item
   i `work-items/`, og fundet krydsrefereres begge veje.

Numre genbruges ikke, heller ikke når et fund afvises. Et fund uden efterprøvet evidens registreres som
hypotese, ikke som fund.

Tilfældighedsfund fundet under en rettelse skal desuden vurderes for, om de ændrer rækkefølgen nedenfor: et
nyt kritisk fund rykker frem, også midt i en etape.

## Rettelsesrækkefølge

Rækkefølgen er valgt efter review-planens princip "gå efter den dyreste fejl først" og efter at samle fund,
der rører samme mekanisme, i én etape — så en mekanisme ikke omlægges to gange. Etapen er enheden: alle fund i
en etape rettes og verificeres sammen.

| Etape | Fund | Hvorfor her |
|---|---|---|
| **1** | UT-F04 | Blokerer en central EO-funktion med et render-crash. Rettet 2026-07-28. |
| **2** | UT-F05, R2-F01 | Samme årsag som etape 1's fejlklasse: en fælles kommandokontrakt brydes af fem callsites og kaster en uncaught systemfejl. Samme fund fra to vinkler. Rettet 2026-07-28. |
| **3** | R6-F01, GM-F11, R6-F02 | Trust-kritisk dokumentvej: et frisk token bindes til render-fangede settings (kan producere output fra en forældet kilde), og otte flader skjuler udfaldsbeskeden. Alle i dokumenthandle-laget. R6-F02 er GM-F11 fra reviewets egen vinkel og blev derfor rettet her frem for i sin oprindelige placering. Rettet 2026-07-28. |
| **4** | GM-F01, GM-F02, GM-F06, R3-F02, R3-F04 | Én systemisk EO/EET-oprydning: feltfejl skal have ÉN strukturel repræsentation, og consumerblokering skal følge konkrete reads. Konvergensreviewets egen anbefaling nr. 1. Bærer beslutning 1. |
| **5** | GM-F04, R5-F01, GM-F05, GM-F07 | Beregningsflow og projektioner: delresultat fra fejlende række, parallel fieldUi-model, motorkald inde i indsamlingen. Bærer beslutning 2 og 3. |
| **6** | UT-F03, GM-F14, GM-F15 | Tabel- og placeholderkernen: promotion-undo mister fokus, fem kopier af placeholder-algoritmen, parallelle løntabel-/intervalprimitiver. Etape 1 lagde cellebindingen; her samles resten. |
| **7** | UT-F02, UT-F06, R7-F02, GM-F03, R7-F03, GM-F10 | Interaktion, fokus og navigation: dropdown-Enter kapres, placeholder viser en valideringsgrænse, toggles omgår feltfamilien, tre identitetssystemer for samme fokusmål. |
| **8** | R4-F01, R4-F02, GM-F12, GM-F13 | Persistence og hel-sags-handlinger: draft kasseres efter replacement, ufuldstændig oprydning accepteres som succes, `Slet alt` afsluttes anderledes end load. Bærer beslutning 4. |
| **9** | GM-F08, GM-F09, R5-F02, R8-F07, R0-F02 | Døde veje og værn, der ikke kan fejle. Ligger efter etape 1–8, fordi rettelserne dér kan efterlade nye rester og gøre flere værn inerte. |
| **10** | R8-F01, R8-F03, R8-F02, R8-F04, R8-F05, R8-F06, R2-F03, R6-F04, R0-F03 | Testdækning og acceptmatrix: §10's kriterier og de obligatoriske statekæder får et levende register. Sidst, fordi dækningen skal måles mod den FÆRDIGE arkitektur, ikke mod en mellemtilstand. |
| **11** | R1-F01, R1-F02, R1-F03, R1-F04, R1-F05, R1-F06, R1-F07, R6-F03, R8-F08 | Kontrakter, docs og sluttilstandssprog. Til sidst pr. review-planens R1b/R9: teksten skal beskrive systemet, som det er efter alle rettelser. |
| **12** | R7-F01, R0-F01 | Vurderes til sidst: R7-F01 er en omlægning af otte fagsider og kan blive en work item frem for en reviewrettelse; R0-F01 er en runtime-/toolchain-beslutning uden kodeafhængighed. |

**Undtagelse fra rækkefølgen:** et nyt kritisk tilfældighedsfund rettes, når det konstateres — ikke når dets
etape kommer.

## Fasefund (R0–R8)

| Id | Kort titel | Alvor | Lokation | Etape | Status | Rapport |
|---|---|---|---|---:|---|---|
| R0-F01 | Baseline kørt på ikke-understøttet runtime | Væsentlig | `package.json:22-24` | 12 | Åbent | [R0](R0-baseline-og-vaern.md#r0-f01--baseline-kørt-på-ikke-understøttet-runtime) |
| R0-F02 | Tekstprober kan holde døde værn levende | Væsentlig | `architecture/rules/storageRules.ts:27-42` | 9 | Åbent | [R0](R0-baseline-og-vaern.md#r0-f02--tekstprober-kan-holde-døde-værn-levende) |
| R0-F03 | Dokumentformatværnet dækker kun to ready-grene | Væsentlig | `acceptanceMatrix.test.ts:295-303` | 10 | Åbent (WI-014) | [R0](R0-baseline-og-vaern.md#r0-f03--dokumentformatværnet-dækker-kun-to-ready-grene) |
| R1-F01 | Designdokumentets status er indbyrdes modstridende | Væsentlig | `draft-commit-greenfield-design.md` | 11 | Åbent | [R1](R1-kontrakter-og-sluttilstandssprog.md#r1-f01--designdokumentets-status-er-indbyrdes-modstridende) |
| R1-F02 | Arkitekturdocs beskriver afløste grænser som aktuelle | Væsentlig | `docs/architecture/` | 11 | Åbent | [R1](R1-kontrakter-og-sluttilstandssprog.md#r1-f02--arkitekturdocs-beskriver-afløste-grænser-som-aktuelle) |
| R1-F03 | Normative kontrakter bruger fortsat migrationssprog | Væsentlig | `src/contracts/` | 11 | Åbent | [R1](R1-kontrakter-og-sluttilstandssprog.md#r1-f03--normative-kontrakter-bruger-fortsat-migrationssprog) |
| R1-F04 | Topologien mangler to underordnelsesrelationer | Væsentlig | `contract-topology.json:26-51` | 11 | Åbent | [R1](R1-kontrakter-og-sluttilstandssprog.md#r1-f04--topologien-mangler-to-underordnelsesrelationer) |
| R1-F05 | Kode og testnavne beskriver stadig en migration | Væsentlig | `src/` | 11 | Åbent | [R1](R1-kontrakter-og-sluttilstandssprog.md#r1-f05--kode-og-testnavne-beskriver-stadig-en-migration) |
| R1-F06 | Levende ledgers beskrives som midlertidige | Væsentlig | `consumerInventory.ts`, `ledgerTypes.ts` | 11 | Åbent | [R1](R1-kontrakter-og-sluttilstandssprog.md#r1-f06--levende-ledgers-beskrives-som-midlertidige) |
| R1-F07 | Error-kontrakten prioriterer en slettet source-dimension | Mindre | `error-contract.md:114,220` | 11 | Åbent | [R1](R1-kontrakter-og-sluttilstandssprog.md#r1-f07--error-kontrakten-prioriterer-en-slettet-source-dimension) |
| R2-F01 | Indsæt dags dato fejler på fem sider | Væsentlig | Fem side-callsites | 2 | **Rettet 2026-07-28** | [R2](R2-inputkerne-og-felteditor.md#r2-f01--indsæt-dags-dato-fejler-på-fem-sider) |
| R2-F02 | Kontrakt og kode er uenige om skjulte canonical fejl | Væsentlig | `form-contract.md:207-208` | 4 | Åbent | [R2](R2-inputkerne-og-felteditor.md#r2-f02--kontrakt-og-kode-er-uenige-om-skjulte-canonical-fejl) |
| R2-F03 | Obligatoriske statekæder er ufuldstændigt dækket | Væsentlig | `draft-commit-greenfield-design.md:812-823` | 10 | Åbent | [R2](R2-inputkerne-og-felteditor.md#r2-f03--obligatoriske-statekæder-er-ufuldstændigt-dækket) |
| R3-F01 | Midlertidig EET-import overblokeres sektionsvist | Væsentlig | `eetImportPort.ts:39-54` | 4 | Åbent | [R3](R3-issues-og-gates.md#r3-f01--midlertidig-eet-import-overblokeres-sektionsvist) |
| R3-F02 | EO globaliserer feltissues uden faktisk dependency | Væsentlig | `eoDependencyGroups.ts:227-230` | 4 | Åbent | [R3](R3-issues-og-gates.md#r3-f02--eo-globaliserer-feltissues-uden-faktisk-dependency) |
| R3-F03 | Min-max-tooltips mangler inputnavne | Væsentlig | `dateRangeErrorMessages.ts:49-55` | 7 | Åbent | [R3](R3-issues-og-gates.md#r3-f03--min-max-tooltips-mangler-inputnavne) |
| R3-F04 | Den offentlige reader eksponerer hele issue-snapshottet | Væsentlig | `inputReader.ts:130-135` | 4 | Åbent | [R3](R3-issues-og-gates.md#r3-f04--den-offentlige-reader-eksponerer-hele-issue-snapshottet) |
| R4-F01 | Load kan kassere en ny draft efter replacement | Væsentlig | `useFileSaveLoad.ts:198-206` | 8 | Åbent | [R4](R4-persistence-session-eo-undo-redo.md#r4-f01--load-kan-kassere-en-ny-draft-efter-replacement) |
| R4-F02 | Slet alt accepterer ufuldstændig oprydning som succes | Væsentlig | `useFileSaveLoad.ts:473-505` | 8 | Åbent | [R4](R4-persistence-session-eo-undo-redo.md#r4-f02--slet-alt-accepterer-ufuldstændig-oprydning-som-succes) |
| R5-F01 | Årsløn viser en deltotal fra en fejlende række | Væsentlig | `aarsloenProjection.ts:83-298` | 5 | Åbent (godkendt) | [R5](R5-domaeneprojektioner-og-beregningsflow.md#r5-f01--årsløn-viser-en-deltotal-fra-en-fejlende-række) |
| R5-F02 | Raw-section-værnet overser property- og spread-adgang | Væsentlig | `inputBoundaryRules.ts:177-236` | 9 | Åbent | [R5](R5-domaeneprojektioner-og-beregningsflow.md#r5-f02--raw-section-værnet-overser-property--og-spread-adgang) |
| R6-F01 | Frisk token bindes til render-fangede settings | Kritisk | `mineoDocumentEnvironment.ts:44-50` | 3 | **Rettet 2026-07-28** | [R6](R6-dokumentoutput-og-generatorer.md#r6-f01--frisk-token-bindes-til-render-fangede-settings) |
| R6-F02 | Otte outputs kasserer beskeden efter afbrudt download | Væsentlig | Otte dokument-callsites | 3 | **Rettet 2026-07-28** | [R6](R6-dokumentoutput-og-generatorer.md#r6-f02--otte-outputs-kasserer-brugerbeskeden-efter-en-afbrudt-download) |
| R6-F03 | Dokumentformat er fortsat en lovlig gate-dependency | Væsentlig | `sourceSettings.ts:8-85` | 11 | Åbent | [R6](R6-dokumentoutput-og-generatorer.md#r6-f03--dokumentformat-er-fortsat-en-lovlig-gate-dependency) |
| R6-F04 | Gatekontrakten er kun målt på fire af atten definitioner | Væsentlig | `document-output-contract.md:71-87` | 10 | Åbent | [R6](R6-dokumentoutput-og-generatorer.md#r6-f04--gatekontrakten-er-kun-målt-på-fire-af-atten-definitioner) |
| R7-F01 | Det obligatoriske page-viewmodel-lag findes ikke | Væsentlig | Alle otte persisterede fagsider | 12 | Åbent | [R7](R7-pages-shell-porte-og-ui-struktur.md#r7-f01--det-obligatoriske-page-viewmodel-lag-findes-ikke) |
| R7-F02 | To toggles omgår feltfamilien og mister fokusmetadata | Væsentlig | `Aarsloen.tsx`, `OffentligeYdelserTab.tsx` | 7 | Åbent | [R7](R7-pages-shell-porte-og-ui-struktur.md#r7-f02--to-persisterede-toggles-omgår-feltfamilien-og-mister-fokusmetadata) |
| R7-F03 | Global feltadresse bestemmer fokusdestinationen | Væsentlig | `fieldAddressDestination.ts:6-213` | 7 | Åbent (godkendt) | [R7](R7-pages-shell-porte-og-ui-struktur.md#r7-f03--global-feltadresse-bestemmer-fokusdestinationen) |
| R8-F01 | §10's 30 acceptkriterier har intet levende register | Kritisk | `acceptanceMatrix.test.ts:40-498` | 10 | Åbent | [R8](R8-testkvalitet-vaern-og-acceptmatrix.md#r8-f01--10s-30-acceptkriterier-har-intet-levende-register) |
| R8-F02 | Fælles form/grid-feltkontrakt køres ikke pr. codecfamilie | Væsentlig | Tre input-surface-tests | 10 | Åbent | [R8](R8-testkvalitet-vaern-og-acceptmatrix.md#r8-f02--fælles-formgrid-feltkontrakt-køres-ikke-pr-codecfamilie) |
| R8-F03 | Obligatoriske statekæder og ni aspekter er ikke dækket | Kritisk | `inputCore.test.ts:391-430` | 10 | Åbent | [R8](R8-testkvalitet-vaern-og-acceptmatrix.md#r8-f03--de-obligatoriske-statekæder-og-deres-ni-aspekter-er-ikke-dækket) |
| R8-F04 | Transaktionsinvarianter testes ikke for hver command-type | Væsentlig | `inputReducer.ts:27-123` | 10 | Åbent | [R8](R8-testkvalitet-vaern-og-acceptmatrix.md#r8-f04--transaktionsinvarianterne-testes-ikke-for-hver-command-type) |
| R8-F05 | Warning-benet i issue-/gate-matricen er falsk dækket | Væsentlig | `documentGateMatrix.test.ts:232-251` | 10 | Åbent | [R8](R8-testkvalitet-vaern-og-acceptmatrix.md#r8-f05--warning-benet-i-issue-gate-matricen-er-falsk-dækket) |
| R8-F06 | Kritiske handlinger er ikke integrationstestet ens | Væsentlig | Kritiske handlings- og dokumenttests | 10 | Åbent | [R8](R8-testkvalitet-vaern-og-acceptmatrix.md#r8-f06--kritiske-handlinger-er-ikke-integrationstestet-ens-for-form-og-grid) |
| R8-F07 | EO-surface-værnet kan omgås med en kommentar | Væsentlig | `erstatningsopgoerelseSurfaceGuard.test.ts:20-100` | 9 | Åbent | [R8](R8-testkvalitet-vaern-og-acceptmatrix.md#r8-f07--eo-surface-værnet-kan-omgås-med-en-kommentar) |
| R8-F08 | Aktive testnavne beskriver fortsat migrationen | Mindre | `src/__tests__/` | 11 | Åbent | [R8](R8-testkvalitet-vaern-og-acceptmatrix.md#r8-f08--aktive-testnavne-beskriver-fortsat-migrationen) |

## Konvergensfund (GM)

Alle femten er godkendt til implementering. De fire produktbeslutninger, de hviler på, blev truffet
2026-07-28 og står i [grill-me-konvergensreview](grill-me-konvergensreview.md).

| Id | Kort titel | Alvor | Lokation | Etape | Status | Rapport |
|---|---|---|---|---:|---|---|
| GM-F01 | Parallel satsvalidering har konkret regeldrift | Væsentlig | `loenindkomstSatsValidation.ts`, `loenindkomstSatserGate.ts` | 4 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f01--parallel-satsvalidering-har-konkret-regeldrift) |
| GM-F02 | Automatiske satser skrives som en ekstra brugerhandling | Væsentlig | `useLoenindkomstViewModel.ts` | 4 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f02--automatiske-satser-skrives-som-en-ekstra-brugerhandling) |
| GM-F03 | To specialtoggles omgår fælles fokusgenopretning | Væsentlig | `Aarsloen.tsx`, `OffentligeYdelserTab.tsx` | 7 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f03--to-specialtoggles-omgår-fælles-fokusgenopretning) |
| GM-F04 | Årsløn beregner delresultat, mens dokumentet blokerer | Væsentlig | `aarsloenProjection.ts`, `Aarsloen.tsx` | 5 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f04--årsløn-beregner-delresultat-mens-dokumentet-blokerer) |
| GM-F05 | Forsørgertab har en afkoblet parallel fieldUi-model | Væsentlig | `forsoergertabSnapshot.ts`, `Forsoergertab.tsx` | 5 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f05--forsørgertab-har-en-afkoblet-parallel-fieldui-model) |
| GM-F06 | Persisted felter accepterer en separat rå fejltekst | Væsentlig | Fælles feltkomponenter og EO/EET-callsites | 4 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f06--persisted-felter-accepterer-en-separat-rå-fejltekst) |
| GM-F07 | Varige mén kalder motoren inde i projektionsindsamlingen | Væsentlig | `varigeMenReaderProjection.ts` | 5 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f07--varige-mén-kalder-motoren-inde-i-projektionsindsamlingen) |
| GM-F08 | En død React-vej til Årslønsberegningen holdes levende af tests | Mindre | `useAarsloenBeregning.ts` | 9 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f08--en-død-react-vej-til-årslønsberegningen-holdes-levende-af-tests) |
| GM-F09 | Død sektionsvis persistence findes ved siden af aggregate-envelope | Væsentlig | `buildPersistedSection.ts` | 9 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f09--død-sektionsvis-persistence-findes-ved-siden-af-aggregate-envelope) |
| GM-F10 | EO-fejllinks bruger en separat heuristisk feltidentitet | Væsentlig | `eoRowIssueCatalog.ts`, `scrollToEoRow.ts` | 7 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f10--eo-fejllinks-bruger-en-separat-heuristisk-feltidentitet) |
| GM-F11 | Dokumentfejl vises på nogle sider, men forsvinder på andre | Væsentlig | Dokumentførende side-callsites | 3 | **Rettet 2026-07-28** | [GM](grill-me-konvergensreview.md#gm-f11--dokumentfejl-vises-på-nogle-sider-men-forsvinder-på-andre) |
| GM-F12 | Slet alt og load afslutter hel-sags-replacement forskelligt | Mindre til væsentlig | `useFileSaveLoad.ts` | 8 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f12--slet-alt-og-load-afslutter-hel-sags-replacement-forskelligt) |
| GM-F13 | Manuel load og PWA-load kopierer samme shellflow | Mindre | `useFileSaveLoad.ts`, `fileLoad.ts` | 8 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f13--manuel-load-og-pwa-load-kopierer-samme-shellflow) |
| GM-F14 | Placeholder- og cellebindingsalgoritmen findes i fem udgaver | Væsentlig | Fem tabelimplementeringer | 6 | Delvist rettet | [GM](grill-me-konvergensreview.md#gm-f14--placeholder--og-cellebindingsalgoritmen-findes-i-fem-udgaver) |
| GM-F15 | Løntabel-reads og intervaloverlap har parallelle primitiver | Mindre | Årsløn/EO-adaptere og intervalhelpers | 6 | Åbent (godkendt) | [GM](grill-me-konvergensreview.md#gm-f15--løntabel-reads-og-intervaloverlap-har-parallelle-primitiver) |

**GM-F14 — delvist rettet 2026-07-28:** cellebindings-halvdelen er samlet i
`src/inputCore/react/cellSpecBuilder.ts` som led i UT-F04, og alle fem tabeller bruger den nu. Placeholder-
identitetens livscyklus (stabile id'er, kollision efter promotion, `minimumVisibleRows`) findes fortsat i fem
udgaver og hører til etape 6 sammen med UT-F03.

## Brugertestfund (UT)

Indmeldt af brugeren ved brugertest parallelt med reviewet. Beskrivelse, reproduktion og løsningsretning står i
[draft-commit-brugertestfund](../draft-commit-brugertestfund.md).

| Id | Kort titel | Alvor | Lokation | Etape | Status | Rapport |
|---|---|---|---|---:|---|---|
| UT-F01 | Dags-dato-knappen springes over ved Tab | — | `InsertTodayDateButton.tsx:30-36` | — | Afvist med evidens | [UT](../draft-commit-brugertestfund.md#ut-f01--dags-dato-knappen-springes-over-ved-tab) |
| UT-F02 | Enter på dropdown i tabel udløser grid-navigation | Væsentlig | `tableKeyboardNavigation.ts:311-380`, `GridChoiceCell.tsx` | 7 | Åbent | [UT](../draft-commit-brugertestfund.md#ut-f02--enter-på-dropdown-i-tabel-udløser-grid-navigation) |
| UT-F03 | Undo af en rækkes første commit mister cellefokus | Væsentlig | `useCollectionTable.ts:50-55`, `historyRestoreTarget.ts:64-70` | 6 | Åbent | [UT](../draft-commit-brugertestfund.md#ut-f03--undo-af-en-rækkes-første-commit-mister-cellefokus) |
| UT-F04 | Tilføjelse af ansættelsesforhold crasher den nested løntabel | Kritisk | `useCellEditor.ts`, fem tabelflader | 1 | **Rettet 2026-07-28** | [UT](../draft-commit-brugertestfund.md#ut-f04--tilføjelse-af-ansættelsesforhold-crasher-den-nested-løntabel) |
| UT-F05 | Dags-dato-knappen sender en ulovlig immediate-kommando | Væsentlig | `useFieldEditor.commitImmediate`, fem side-callsites | 2 | **Rettet 2026-07-28** | [UT](../draft-commit-brugertestfund.md#ut-f05--dags-dato-knappen-sender-en-ulovlig-immediate-kommando) |
| UT-F06 | Års-placeholder viser en valideringsgrænse | Mindre | `StandardLoenTable.tsx` | 7 | Åbent | [UT](../draft-commit-brugertestfund.md#ut-f06--års-placeholder-viser-en-valideringsgrænse) |

**UT-F04 — rettet 2026-07-28.** Løst ved roden, ikke lokalt: cellens dataidentitet konstrueres nu ét sted
(`src/inputCore/react/cellSpecBuilder.ts`), som udleder ejer-id'erne af `collection.path` — samme sti som
`insertEntity` og readeren bruger. `PlaceholderCell` bærer en fuldt bundet `FieldRef` frem for
`descriptor` + `entityId`, så typen udelukker den gamle fejlform. Typeændringen afslørede to yderligere kopier
af den forkerte bindingsregel (`useGridCellSurface.ts`, `GridChoiceCell.tsx`) — begge fjernet. Den redundante
`fieldOwnerIds`-prop er slettet.

Dækning: `cellSpecBuilder.test.ts` (11 tests), `Loenindkomst.nestedLoentabel.integration.test.tsx` (2 tests) og
AST-reglen `input/cell-binding-single-source`. Alle tre er mutationstestet: bindingen sat tilbage til ét
entity-id giver brugerens præcise fejltekst (`FieldDescriptor(col0_maaned): forventede 2 entity-id'er, modtog 1`)
og gør 6 + 2 tests røde; en genindført lokal `bind()` i en tabelflade gør AST-reglen rød med fil:linje.
Fuld suite efter rettelsen: 495 filer / 6188 tests grøn.

**UT-F05 + R2-F01 — rettet 2026-07-28 (etape 2).** Samme fund fra to vinkler, rettet i én ændring.
`FieldEditorController.settleValue(value)` er nu den ENE programmatiske afslutningskommando: værdien
formateres af feltets eget codec og går gennem editorens normale settle-vej — samme parse, samme XOR (§1.5),
samme ét-history-trin med felt-origin (§3.7) — i stedet for `setImmediateField`, som reduceren kun tillader
for choice/toggle. `useFieldEditor` har nu ÉN settle-udgang, som både den tastede og den programmatiske
indgang går igennem, så §3.5-friskhed og placeholder-override ikke kan divergere. Alle fem callsites migreret
samlet; reducerens fail-fast-guard bevaret uændret.

Dækning: `insertTodayDateButton.contract.integration.test.tsx` (10 tests — ÉN tabeldrevet kontrakt over alle
fem flader gennem de ægte sider og den ægte runtime), 7 nye `useFieldEditor`-tests og AST-reglen
`input/programmatic-commit-uses-settle`. Alle tre mutationstestet: sættes ét callsite tilbage, fejler netop
den fladens 2 tests med brugerens præcise fejltekst
(`InputReducer: setImmediateField er kun tilladt for choice/toggle`) mens de fire øvrige flader forbliver
grønne, og AST-reglen bliver rød med fil:linje:kolonne. Den typemæssige begrænsning af `commitImmediate`
blev vurderet og bevidst ikke gennemført — begrundelsen står i UT-F05-rapporten. Fuld suite: 496 filer /
6207 tests grøn.

**R6-F01 + R6-F02 + GM-F11 — rettet 2026-07-28 (etape 3).** Begge halvdele af dokumentvejen.

*Kildebindingen (R6-F01, kritisk):* `createMineoDocumentEnvironment` tager nu en LÆSEFUNKTION
(`() => SourceSettings`) i stedet for en færdig værdi, så der ikke længere findes et settingsobjekt at holde
fast på fra render. `readPublishedSourceSettings()` returnerer den værdi, `useSettingsRevisionBridge` sætter
i samme layout-fase som settingsrevisionen hæves — læsningen er derfor atomisk med tokenet. Rettelsen er en
signaturændring og ikke et ekstra tokencheck: tokenet var allerede aktuelt, så et check mere kunne ikke
fange fejlen. Dækning: 5 nye tests i en fil, der ikke fandtes før (stien var helt udækket); mutationsbeviset
er, at alle 5 fejler med et forældet `'pdf'` mod det aktuelle `'word'`, når closuren genindføres.

*Udfaldsvisningen (R6-F02/GM-F11):* kortlægningen viste et større problem end otte glemte visninger — de
flader, der huskede beskeden, havde FEM forskellige udgaver af samme fejlrække, og reguleringshooket udledte
en besked, ingen af dets to callsites læste. `DocumentOutcomeMessage` er nu det ene sted, rækken bygges;
alle otte flader viser udfaldet; reguleringshooket leverer beskeden rå, fordi dens callsites kun har
gate-årsagen i knappens tooltip. AST-reglen `document/activation-shows-outcome` håndhæver grænsen.
Bevidst udeladt: ensretning af de fem eksisterende rækkeudgaver er en synlig UI-ændring ud over det
godkendte scope — begrundelsen står i R6-F02.

Fuld suite efter etapen: 498 filer / 6219 tests grøn; `typecheck`, `typecheck:test` og `lint` grønne.

## Tilfældighedsfund konstateret under rettearbejdet

| Id | Kort titel | Alvor | Fundet under | Status |
|---|---|---|---|---|
| INC-F01 | Nested løntabeller delte editorlokation på tværs af ansættelsesforhold | Væsentlig | UT-F04 | **Rettet 2026-07-28** |
| INC-F02 | `INSERT_TODAY_DATE_EVENT` var en død sidekanal uden lytter | Mindre | UT-F05 | **Rettet 2026-07-28** |
| INC-F03 | Mit eget nye AST-værn var tekstbaseret og kunne bæres af en kommentar | Væsentlig | R6-F02 | **Rettet 2026-07-28** |

**INC-F01.** Celle-lokationsid'et var `${section}.${collection}:${rowId}:${colIndex}` uden ejer-id. EO
renderer én løntabel pr. ansættelsesforhold, så to kort med samme række-id delte editorlokation, og en
undo/redo kunne fokusere den forkerte tabels celle (§3.7 kræver en entydig destination). Rettet med
`collectionLocationPrefix`, som tilføjer ejer-id'erne; dækket af
`cellSpecBuilder.test.ts` → "nested instanser under forskellige ejere får forskellige editorlokationer".

**INC-F03.** Den FØRSTE udgave af AST-reglen `document/activation-shows-outcome` afgjorde, om en fil viste
et dokumentudfald, med `entry.text.includes('errorMessage' | …)`. Mutationstesten afslørede fejlen: fjernes
visningen fra `Satser.tsx`, men efterlades dens forklarende kommentar — som indeholder ordet `errorMessage` —
forblev reglen GRØN. En tekstsøgning kan ikke skelne kode fra kommentar; det er præcis review-planens
grundregel 5 ("strukturelle spørgsmål kræver et AST") og memoryen
`project_dansk_prosa_guard_markers`/`project_structural_questions_need_ast`. Reglen måler nu rigtige
AST-noder (JSX-tags og identifiers), og en violating fixture pinner hullet, så det ikke kan genopstå.
Fundet er registreret frem for blot rettet, fordi det er et selvstændigt bevis på, at et NYT værn skal
mutationstestes lige så hårdt som den kode, det bevogter — et grønt værn er ikke evidens for noget.

**INC-F02.** `insertTodayDate` dispatchede et `CustomEvent('mineo:insert-today-date')` på datofeltets
DOM-element ved hvert klik. En repo-bred søgning viste, at INGEN lytter på eventet: den sidste forbruger var
det slettede legacy-date-input, som brugte det til at synkronisere sin interne draft. Efter greenfield-
cutoveren er feltvisningen afledt direkte af den afsluttede revision (§3.5), så sidekanalen havde intet
formål — men den er præcis "den fjerde kanal" fra review-planens standardangreb, og en fremtidig lytter kunne
have gjort den til en reel skjult vej fra en åben draft til noget afsluttet. Slettet sammen med rettelsen af
UT-F05, da den lå i samme fil og samme mekanisme. `insertTodayDate.test.ts` refererede ikke til eventet og er
uændret grøn.

# Erstatningsopgørelse-arkitektur (fra bunden)

**Status:** Implementeret målarkitektur (opdateret 2026-03-05)
**Scope:** Hele Erstatningsopgørelse-fanen inkl. EODebug, EODebugTabel, `erstatningsopgoerelsePdf`, `tafFordeltPaaAarPdf` og underliggende beregninger
**Mål:** Samme UI/UX og samme PDF-indhold som i dag, men med én autoritativ beregningssti

## 0. Implementeringsstatus pr. 2026-03-05

Følgende er nu gennemført i kodebasen:
- `computeEoSnapshot` er indført som autoritativ EO-entry og wired til Beregning, EO-PDF og TAF-fordelt-på-år-PDF.
- Snapshot bygger nu totals, EO-PDF-model, canonical output, debug snapshot og TAF-fordelt-på-år-grundlag i én samlet orkestrering.
- Preflight/invariants dækker nu bl.a. TAF-overlap, TAF-bounds, ferie/fridags-overbooking, kontroluoverensstemmelse og TAF-per-år-afstemning over `100 øre`.
- Beregning-fanen bruger snapshot til download-gating, viser fail-closed/systemfejl eksplicit og åbner ikke længere downloads på baggrund af alene gamle debug-rækker.
- Beregning-fanen viser nu også autoritative snapshot-blokeringer eksplicit og bruger kun snapshot-afledte gating-signaler fra `eoSnapshotToBeregningView`.
- PDF-downloads projekterer nu snapshot til dokumentmodeller i `pdfService` og sender kun de projekterede dokumenter videre til generatorerne.
- `EODebug` bruger nu `eoSnapshotToDebugView` som adapterlag og renderer sektioner via render-only komponenter i stedet for direkte domæne-/dataopslag i page-komponenten.
- `EODebugTabel` læser nu kun snapshot-data og genberegner ikke længere model/sammentælling direkte i renderlaget.
- Den gamle EO-aggregation-pipeline og hook er fjernet fra produktion og tests.

Verificeret 2026-03-05:
- `npm run typecheck`
- `npm run test -- src/__tests__/domain/erstatningsopgoerelse/eoSnapshot.test.ts src/__tests__/components/pages/erstatningsopgoerelse/Erstatningsopgoerelse.debugSnapshotRefresh.test.tsx src/__tests__/components/pages/erstatningsopgoerelse/EOberegningTab.controlCheck.test.tsx src/__tests__/components/pages/erstatningsopgoerelse/EODebugTabel.test.tsx src/__tests__/utils/pdf/tafFordeltPaaAarPdf.wiring.test.ts src/__tests__/utils/pdf/pdfService.downloadFunctions.test.ts src/__tests__/utils/pdf/pdfService.test.ts`
- `npm run test -- src/__tests__/components/pages/erstatningsopgoerelse/EODebug.test.tsx src/__tests__/utils/pdf/pdfService.downloadFunctions.test.ts src/__tests__/utils/pdf/tafFordeltPaaAarPdf.wiring.test.ts src/__tests__/components/pages/erstatningsopgoerelse/EOberegningTab.controlCheck.test.tsx src/__tests__/quality/eetDomainIsolation.test.ts`
- `npm run test -- src/__tests__/components/pages/erstatningsopgoerelse/EOberegningTab.pdfAfsluttesMed.test.tsx src/__tests__/utils/pdf/erstatningsopgoerelsePdf.udkast.test.ts src/__tests__/utils/pdf/erstatningsopgoerelsePdf.indkomstBreakdownVisibility.test.ts`

## 1. Styrende kontrakter

Kontraktprioritet for implementeringen:
1. `src/contracts/*.md`
2. `AGENTS.md`
3. Dette dokument

Nøgleregler:
- Én beregning, mange visninger: samme tal må ikke beregnes i parallelle stier.
- Kun committed, schema-valideret input i beregningslag.
- Fail-closed ved kritiske mangler/invariantbrud.
- Ingen server/API/telemetri eller data ud af browseren.

## 2. Hvad ændres ikke

Følgende bevares i migreringen:
- `usePersistedForm` / `useFormPersistence` som form-state/persistence fundament.
- Zod-schemas for `StamdataValues` og `ErstatningsopgoerelseValues` (kan udvides, men ikke erstattes af alternativ runtime-authority).
- Tab-navigation og lazy-mount mønster på siden.
- App settings-kontekst (`AppSettingsContext`) og eksisterende feature-flags.
- Eksisterende engine-logik genbruges først; omskrivning af engine-internal er ikke del af første migration.

## 3. Nuværende arkitektur (as-is)

## 3.1 Beregningsstier i dag

Der er fem stier med overlappende domæneberegning:

| Sti | Entry | Primære konsumenter |
|---|---|---|
| A | `buildEoCanonicalOutput` | Canonical/parity/aggregation-reference |
| B | `buildErstatningsopgoerelsePdfModel` | EO PDF + TAF-per-år PDF |
| C | `computeErstatningsopgoerelseAggregationFromSnapshot` | Beregning-tab |
| D | `buildEODebugSnapshot` (`buildEODebugModel` + `buildEODebugSammentaellingModel`) | Beregning-tab + EODebugTabel |
| E | `eoSnapshotToDebugView` + render-only sektioner | EODebug-siden |

Præcisering af D vs E:
- D er snapshot-stien for Beregning/EODebugTabel.
- E er debug-fanens projektion/renderlag oven på samme snapshot, ikke en separat beregningssti.

## 3.2 Hovedproblemer

- Parallelle beregningsstier for samme totals/mellemresultater.
- Domænelogik i UI-komponenter.
- PDF-lag modtager rå form-state i flere flows.
- Debug-lag genberegner i stedet for at projektere.

## 4. Målarkitektur

## 4.1 Én autoritativ entry

`computeEoSnapshot(committedInput) -> EoSnapshot`

Alle visninger bliver projektioner af snapshot:
- `eoSnapshotToBeregningView`
- `eoSnapshotToDebugView`
- `eoSnapshotToEoPdfDocument`
- `eoSnapshotToTafPerYearPdfDocument`

## 4.2 Mappestrategi (forenklet, matcher nuværende stil)

Der introduceres ikke ny “feature-konvention”. Brug få, eksplicitte filer i eksisterende lag:

```text
src/domain/erstatningsopgoerelse/
  eoSnapshot.ts
  eoSnapshotInvariants.ts
  eoSnapshotToBeregningView.ts
  eoSnapshotToDebugView.ts
  eoSnapshotToEoPdfDocument.ts
  eoSnapshotToTafPerYearPdfDocument.ts
```

Begrundelse:
- Færre mapper, mere direkte filnavne.
- Tydelig adskillelse mellem beregning (`eoSnapshot*`) og projektion (`eoSnapshotTo*`).

## 5. Konkret snapshot-kontrakt

## 5.1 Type-skitse (implementeringsminimum)

```ts
type EoSnapshotComputed = Readonly<{
  revision: string;
  status: 'ok' | 'warning' | 'error';

  input: Readonly<{
    stamdata: StamdataValues;
    erstatningsopgoerelse: ErstatningsopgoerelseValues;
  }>;

  engines: Readonly<{
    svieSmerte: ReturnType<typeof computeSvieSmerteEngine>;
    tafNetto: ReturnType<typeof computeTafNettoBeregning>;
    tafPerYear: ReturnType<typeof buildTafPerYearResult> | null;
    oevrigeKrav: ReturnType<typeof buildOevrigeKravModel>;
    forlig: ReturnType<typeof parseForligsgrad>;
  }>;

  totals: Readonly<{
    svieSmerteOre: MoneyOre;
    tabtArbejdsfortjenesteFoerForligOre: MoneyOre;
    tabtArbejdsfortjenesteOre: MoneyOre;
    oevrigeKravFoerForligOre: MoneyOre;
    oevrigeKravOre: MoneyOre;
    samletTotalOre: MoneyOre;

    // Krav fra PDF/Beregning-tab for eksplicit visning
    tidligereModtagetTafOre: MoneyOre | null;
    forligFactor: number | null;
  }>;

  invariants: ReadonlyArray<{
    id: string;
    passed: boolean;
    severity: 'warning' | 'error';
    message: string;
    evidence?: ReadonlyArray<string>;
  }>;

  presentation: Readonly<{
    titel: string;
    periodeDisplay: string | null;
    skadelidteNavn: string | null;
    skadestypeLinje: string | null;
    brevhoved: {
      journalnr?: string;
      advokat?: string;
      sagsbehandler?: string;
      dagsDatoISO: string;
    };
  }>;
}>;

type EoSnapshotFailClosed = Readonly<{
  revision: string;
  status: 'fail_closed';
  input: Readonly<{
    stamdata: StamdataValues | null;
    erstatningsopgoerelse: ErstatningsopgoerelseValues | null;
  }>;
  invariants: ReadonlyArray<{
    id: string;
    passed: false;
    severity: 'error';
    message: string;
    evidence?: ReadonlyArray<string>;
  }>;
  failClosedReason: 'schema_guard' | 'critical_invariant' | 'runtime_exception';
}>;

type EoSnapshot = EoSnapshotComputed | EoSnapshotFailClosed;
```

## 5.2 Hvad snapshot IKKE indeholder

- Ingen UI-state (aktiv fane, dialog-state, input-focus).
- Ingen formatteringsspecifikke UI-strenge der kun bruges i én komponent.
- Ingen pdf-lib layoutdata.

## 5.3 Regel for `snapshot.status`

Status sættes deterministisk sådan:
- `fail_closed`: schema-guard fejler, intern runtime-fejl opstår i snapshot-build, eller mindst én invariant med `severity='error'` og `passed=false`, hvor den autoritative EO-beregning ikke kan fortsætte sikkert.
- `error`: preflight-fejl (manglende nødvendige inputs) eller output-specifikke fejl, som ikke gør den autoritative EO-beregning intern inkonsistent, men som blokerer den relevante projektion/download.
- `warning`: ingen errors/fail_closed, men mindst én warning-invariant med `passed=false`.
- `ok`: ingen brudte invariants og ingen preflight-fejl.

Projektioner pattern-matcher altid først på `status`. Ved `fail_closed` renderes fejl-/tomvisning uden antagelse om `engines`/`totals`.

## 5.4 Projektion-adfærd pr. status

- `fail_closed`: visning går til fejl-/runtime-fejlflow. Totals og mellemregninger må ikke vises som gyldige. Eksisterende fejlvisning med fejloplysninger/rapportering anvendes ved runtimefejl.
- `error`: visning viser eksplicit liste over brudte preflight-/invariant-checks. EO-totaler må kun eksponeres, hvis fejlen er output-specifik og ikke underminerer den autoritative EO-beregning. Berørte downloads blokeres.
- `warning`: totals og mellemregninger må vises, men med tydelig warning-/fejlmarkering.
- `ok`: normal visning.

## 6. Beregningsrækkefølge og afhængigheder

## 6.1 Orkestrering i `computeEoSnapshot`

Kald i denne rækkefølge:

1. Defensive schema-guard med `safeParse` af input (beskyttelse mod korrupt rehydrering/persistence).
   - Guard-fejl må ikke kaste; der returneres `EoSnapshotFailClosed`.
2. `parseForligsgrad`.
3. `computeSvieSmerteEngine`.
4. `computeTafNettoBeregning`.
   - Intern afhængighed i denne funktion er allerede:
   - `computeTafBeregningsenhed`
   - `buildIndkomstSkadestidspunkt`
   - `buildLoenudviklingModelV3`
   - `buildIncomeForRanges` (TAF-indtægter)
5. `buildOevrigeKravModel`.
6. Beregn `totals` (før/efter forlig + samlet + ekstrafelter).
7. Byg TAF-per-år grundlag og kør `buildTafPerYearResult`.
8. Kør invariant-registry (afhænger af engines + totals + tafPerYear).
9. Sæt samlet snapshot-status via regler i §5.3 og returnér `EoSnapshotComputed`.

Præcisering:
- Kontekstuelle checks, der afhænger af beregnede arbejdsdage i perioden (fx ferie/fridags-overbooking ift. mulige arbejdsdage), hører til i invariant-registryet efter engine-kald og er ikke preflight-checks.

## 6.2 Beslutning om aggregation-engine

- EO-specifik brug af `erstatningsopgoerelseAggregationPipeline` udfases.
- Beregning-tab læser totals/projektion fra snapshot.
- Den generiske aggregation-engine kan blive i kodebasen, men bruges ikke længere som EO-hovedsti.

## 7. Snapshot-lifecycle i React

## 7.1 Ejerskab

- Snapshot ejes på page-niveau i `Erstatningsopgoerelse.tsx`.

## 7.2 Build-policy (valgt strategi)

- Snapshot bygges lazy ved tab-entry til Beregning/Debug/DebugTabel.
- Build sker kun hvis committed revision er ændret siden sidste snapshot-build.
- Dette bevarer nuværende performance-mønster og giver entydig implementering i første iteration.

## 7.3 Distribution

- Initialt via props (samme mønster som nu).
- Ingen ny context i første iteration.

## 7.4 Stale-håndtering

- Hvis `snapshot.revision !== currentCommittedRevision`, bygges nyt snapshot før normal visning i fanen.
- Eventuel stale-indikator er et UX-signal, ikke en separat blokering af interaktion.
- Stale state er ikke en kontroluoverensstemmelse. Kontroluoverensstemmelse i blokkeringsforstand må kun konstateres på et friskt snapshot, hvor `snapshot.revision === currentCommittedRevision`.

## 8. Debug-model (to typer rows)

Brug to separate modeller:

1. Debug data rows (mellemresultater):
- `{ section, label, rawValue, displayValue, source }`

2. Debug control rows (invariants/fejl):
- `{ checkId, severity, passed, message, evidence }`

Konsekvens:
- EODebug viser begge typer i passende sektioner.
- EODebugTabel kan fortsat have sin daglige matrix, men statuslinjer kommer fra samme control rows.

## 9. PDF-model og TAF per år

## 9.1 EO PDF

- `eoSnapshotToEoPdfDocument(snapshot, selectedElements)` producerer alt indhold til EO-pdf.
- Writers/sections modtager kun document model, aldrig rå `eoValues`/`stamdataValues`.

## 9.2 TAF per år PDF

- TAF per-år forbliver et separat dokument med egen document model:
- `eoSnapshotToTafPerYearPdfDocument(snapshot)`.

## 9.3 Invariant for TAF per år

- Afstemning (max 1 kr afvigelse) er en invariant i snapshot-registry.
- Brud over `100 øre` er en `error`-severity invariant, der blokerer TAF-per-år visning/download.
- Brud over `100 øre` gør ikke i sig selv EO-totalen ugyldig og må derfor ikke alene eskalere hele snapshot til `fail_closed`.
- EO-PDF og Beregning-tab kan fortsat vises fra samme snapshot, hvis den autoritative EO-beregning ellers er intern konsistent.

## 10. Migreringsstrategi (parallelkørsel)

Princip pr. stadie:
- Ny sti introduceres parallelt med gammel sti.
- Parity verificeres i test-suite på reference-cases (ikke i produktion-runtime).
- Valgfrit i dev-mode: runtime-assertions der logger divergens, men aldrig blokerer UI.
- Gammel sti fjernes først når parity + tests er grønne.
- Ingen big-bang switch.

## 11. Implementeringsplan (handlingsrettet)

## Stadie 0: Baseline-tests (obligatorisk før kodeflyt)

Reference-cases (mindst 6):
1. Simpel sag uden TAF.
2. TAF-sag inden for ét kalenderår.
3. TAF over flere år med afstemningslinje.
4. Sag med flere øvrige krav-typer.
5. Sag med forligsgrad.
6. TAF over flere år med forligsgrad, så per-år-afrunding og samlet afstemning testes sammen.

Testformat:
- Input fixture: `StamdataValues + ErstatningsopgoerelseValues`.
- Forventning: totals, centrale engine-felter, invariant-status.
- Pure unit tests (ingen UI).

PDF-baseline i Stadie 0:
- Gem tekst-/strukturbaseret baseline (ikke byte-compare).

## Stadie 1: Introducer `eoSnapshot.ts` [Gennemført 2026-03-05]

Arbejdsopgaver:
- Dag 1-2: Opret `EoSnapshot` type + `computeEoSnapshot` med rækkefølge fra §6.
- Dag 2-3: Opret `eoSnapshotInvariants.ts` med første invariant-sæt.
- Dag 3-4: Udfør mapping-verificering som selvstændig leverance mod nuværende PDF-kontekster (særligt `OpgoerelseContext` i `opgoerelseSection.ts`).
- Dag 3-4 leveranceformat: en tjekliste/tabel der mapper hvert kontekstfelt til enten `snapshot.<sti>` eller `eoSnapshotToEoPdfDocument.<felt>`.
- Dag 4: Wire snapshot på page-niveau side om side med eksisterende flows.

Done:
- Snapshot bygges for reference-cases.
- Mapping-tjekliste er komplet for alle felter i `OpgoerelseContext` samt øvrige EO-PDF-sektioners kontekstinput.
- Ingen ændring i brugeroutput endnu.

## Stadie 2: EO PDF til snapshot-projektion [Gennemført 2026-03-05]

Arbejdsopgaver:
- Implementér `eoSnapshotToEoPdfDocument`.
- Migrér én PDF-sektion ad gangen med parity-test pr. sektion.
- Start med `opgoerelseSection` (størst og mest inputtung), fortsæt derefter regulering, lønindkomst, offentlige ydelser, SH-dage, sygeferiegodtgørelse.
- Tilpas EO PDF writer/sections til kun document model input.
- Parallel assertions mod nuværende `buildErstatningsopgoerelsePdfModel` output.

Done:
- PDF-indholdsparitet på reference-cases.

## Stadie 3: Beregning-tab til snapshot [Gennemført 2026-03-05]

Arbejdsopgaver:
- Erstat EO-aggregation hook-sti med snapshot-projektion.
- Flyt fejlstatus til invariant-baseret model.

Done:
- Samme viste totals som før.
- Ingen EO-aggregation pipeline som primær datakilde.

## Stadie 4: Debug til snapshot [Gennemført 2026-03-05]

Arbejdsopgaver:
- Implementér `eoSnapshotToDebugView` med data rows + control rows.
- Migrer EODebug og EODebugTabel til samme snapshot-revision.

Done:
- `EODebugTabel` er snapshot-only og genberegner ikke længere model/sammentælling.
- `EODebug` læser nu et samlet `eoSnapshotToDebugView` og har ikke længere direkte domæne-/dataopslag i page-komponenten.
- Debug-renderlaget er opdelt i render-only sektioner (`EODebugRowsSection`, `EODebugLoenSections`, `EODebugRegulationSections`).

## Stadie 5: UI-opdeling og adapter-konsolidering [Gennemført 2026-03-05]

Arbejdsopgaver:
- Split `EODebug.tsx` i sektion-renderers baseret på debug-projektion.
- Hold snapshot-forbrugere (`EOberegningTab`, `EODebug`, `EODebugTabel`, PDF-service) på projektion/render-adaptere frem for parallel domænelogik.

Done:
- Snapshot-forbrugerne er nu opdelt i mindre, mere auditerbare renderkomponenter og adaptere.
- Ingen ny domænelogik er introduceret i UI-splittet; beregning og preflight forbliver i snapshot-/domænelaget.

## Stadie 6: Oprydning [Gennemført 2026-03-05]

Arbejdsopgaver:
- Fjern udfasede parallelle stier.
- Omdøb misvisende domænenavne hvor nødvendigt.
- Opdater docs/contracts/tests.

Forventet fjernelse/udfasning (EO-scope):
- `src/calculation/pipeline/erstatningsopgoerelseAggregationPipeline.ts` som EO-primærsti.
- `src/calculation/useErstatningsopgoerelseAggregation.ts` (erstattes af snapshot-baseret hook/projektion).
- Debug-genberegningssti i `EODebug.tsx` (direkte modelbygning).
- Snapshot-eksterne EO-beregninger i PDF-writer/sections.

Done:
- EO-aggregation-pipeline/hook er fjernet som produktionsti.
- Download-gating for EO/TAF styres nu af snapshot-invariants.
- EODebug og PDF-generatorer læser nu via snapshot-projektioner/document-modeller i stedet for parallel genberegning.

## 12. Valideringskørsler (hvornår kører hvad)

- Niveau 1 (schema): ved commit i formular.
- Niveau 2 (preflight): ved snapshot-build.
- Niveau 3 (invariants/projections): ved snapshot-build og før PDF-download.

## 13. Målbare acceptance-kriterier

| Kriterium | Verifikation |
|---|---|
| UI/UX-paritet | Manuel smoke-checkliste på reference-cases |
| PDF-indholdsparitet | Automatisk tekst/struktur-diff mod baseline |
| Én beregningssti | Code search: EO totals beregnes kun i `computeEoSnapshot` |
| Ingen beregning i UI | Code review + regel om ingen engine-imports i `components/pages/erstatningsopgoerelse/*` |
| Ens fejlmodel på tværs | Tests der sammenligner beregningstab/debug/pdf-gating status for samme input |

## 14. Risiko-matrix

| Stadie | Risiko | Begrundelse | Mitigering |
|---|---|---|---|
| 0 Baseline | Lav | Testopsætning | Reference fixtures + snapshots |
| 1 Snapshot | Medium | Feltmapping kan mangle data | Kontrakt-review + parity tests |
| 2 PDF migration | Høj | Mange outputdetaljer | Sektionvis parity assertions |
| 3 Beregning-tab | Lav | Begrænset visningsscope | Direkte før/efter totalsammenligning |
| 4 Debug migration | Medium | Ikke primær slutberegning, men stor kodeoverflade | Trinvis migration + parity på control/data rows |
| 5 UI-opdeling | Medium | Refaktor i store filer | Små PR-trin + commit-boundary tests |
| 6 Oprydning | Lav | Fjernelse af død kode | Fjern kun efter dokumenteret erstatning |

## 15. Samlet konklusion

Dette dokument er nu en implementeringsplan, ikke kun en arkitekturbeskrivelse. Den centrale beslutning er at gøre `computeEoSnapshot` til eneste beregnings-exit og migrere alle forbrugere (Beregning, Debug, PDF) over på snapshot-projektioner via parallelkørsel og parity-tests. Dermed bevares output for brugeren, mens arkitekturen bliver deterministisk, auditerbar og vedligeholdbar.

## 16. Opsamling fra EO-principaudit (tråd 2026-03-05)

Formål med denne opsamling:
- Bevare alle afklarede beregningsprincipper som bindende input til ny EO-arkitektur.
- Samle konstaterede afvigelser i nuværende løsning, så migrationen kan være fail-closed.
- Fastholde åbne spørgsmål og udestående undersøgelser, så arbejdet kan genoptages direkte.

### 16.1 Bindende principbeslutninger afklaret i tråden

- Autoritativ slutvisning er `Erstatningsopgørelse-PDF`. `EODebug` og `EODebugTabel` er mellemregning/forklaring.
- Eventuelle afvigelser mellem nuværende modeller er ikke tilsigtede; afvigelser skal synliggøres og afklares eksplicit.
- Der må ikke findes fallback-beløb i EO. Manglende beregningsmulighed er alvorlig systemfejl.
- `0` må kun vises for gennemført beregning med faktisk resultat `0`.
- Tom indtastning i `tidligereModtagetTaf` er tilladt og tolkes som `0 kr`.
- Bruger skal kunne efterberegne viste mellemregninger; skjult højere præcision må kun bruges i særtilfælde, individuelt besluttet og dokumenteret.
- Overlappende TAF-perioder skal give fejl (må ikke accepteres uden fejlfeedback).
- Brugeren må ikke præsenteres for beregninger, der ikke findes/ikke kunne udføres.
- Kontroluoverensstemmelser er alvorlig systemfejl og må ikke nå brugerflow som normaltilstand.
- TAF per år må være negativ pr. årslinje, men samlet TAF-krav må aldrig være under `0`.
- Hvis TAF per år-afstemning kræver afrunding over `100 øre`, er det systemfejl.
- I case hvor bevidst undergrænsemekanisme clampler til `0`, er resultatet en gyldigt beregnet `0`.
- Ved runtimefejl skal eksisterende fejlvisning med indbygget fejloplysninger/rapportering bruges.
- For de afklarede visningscases er "Visning B" valgt (tooltip-baseret fejlfeedback), forudsat individuel beslutning og dokumentation pr. undtagelse.
- Snapshot-orchestreringen følger en hybridmodel: forudsigelige input-/preflight-fejl stoppes før engine-kald med brugernær fejlmodel, mens uventede engine-/runtimefejl routes til `fail_closed` og eksisterende runtime-fejlvisning.
- Clamp af TAF-perioder må ikke indgå i den autoritative beregningssti. UI må gerne vise bounds/guidance, men snapshot-beregningen må ikke automatisk afskære perioden.
- Tomt `tidligereModtagetTaf` er semantisk `0 kr` og skal eksponeres entydigt som `0`, ikke `null`, i snapshot/projektioner.
- Svie/smerte-periode med gyldig datoformat men out-of-range bounds er en almindelig brugerrettelig `error`-tilstand, ikke i sig selv `fail_closed`/runtimefejl.
- TAF-per-år er et snapshot-trin, ikke et PDF-særflow. Samme grundlag skal bruges i Beregning, Debug og PDF-gating.
- TAF-per-år-afstemningsgrænsen på `100 øre` er bevidst også ved forligsgrad. Afvigelse over `100 øre` anses som tegn på et større systemteknisk problem, ikke legitim afrundingsakkumulering.

### 16.2 Konstaterede afvigelser/risici i nuværende løsning

- Canonical-output-fejl kan blive slugt i debug-aggregator, hvorefter fallback-beregning kan vises som `ok`.
- Sammentælling behandler `0` og `null` ens i visse status-/displaygrene.
- Kontroluoverensstemmelser vises i dialogflow, men er ikke hårdt koblet til download-blockering som systemfejlsgate.
- TAF per år returnerer `null` i scenarier, hvor trådbeslutninger nu kræver henholdsvis:
  - gyldig beregnet `0` (negativ netto før clamp),
  - egentlig systemfejl (`|afrunding| > 100 øre`).
- `TAF fordelt på år`-PDF kan vise "kan ikke beregnes" i stedet for fail-closed systemfejl.
- Tabelinputs kan committe out-of-range værdier med fejlmarkering, men stadig sende værdier videre i beregningsflow.
- TAF-overlap håndteres delvist som UI-fejl, men kerneflow merger perioder for beregning.
- `erstatningsopgoerelseValidator` ser ikke ud til at være aktiv runtime-gate i produktion (kun test-imports fundet).

### 16.3 Afklarede principspørgsmål (lukket 2026-03-05)

- Out-of-range ferie/fridagsfelter, der bruges i EO-beregning, er hård beregningsblokering. Dette gælder både:
  - `tafPerioder[].loseFeriedage` (per TAF-periode)
  - `uspecificeredeFerieFridage` (globalt EO-felt)
- Derudover skal invariant-registryet have kontekstuelle checks, hvor ferie/fridage ikke må overstige det beregningsmæssigt mulige antal arbejdsdage i den relevante periode. Ingen totals eller EO-downloads må behandles som gyldige, før sådanne fejl er rettet.
- TAF-perioder uden for tilladte grænser (differencekrav/endelig EET) er hård beregningsblokering. Perioder må ikke clamples eller ignoreres i autoritativ beregningssti. Fejlvisning skal pege på både den blokerende TAF-periode og den bound-kilde, der udløser blokeringen.
- Ved kontroluoverensstemmelse hard-blokeres alle EO-downloads som systemfejl, og eksisterende fejlvisning med fejloplysninger anvendes.
- For TAF-fordeling per år ved afrundingsafvigelse over `100 øre` afvises download helt; dokumentet må ikke genereres.

### 16.4 Udestående undersøgelser (teknisk) før endelig løsningsdesign

- Kortlægge præcist hvor table-input-fejl bliver (og ikke bliver) løftet til samlet EO-fejlmodel/gating.
- Kortlægge alle download-entrypoints for EO og sikre, at `PdfDownloadResult.success=false` ikke kan blive tavst for bruger.
- Kortlægge alle steder hvor `0` og `null` normaliseres/konflateres i EO debug/sammentælling/PDF.
- Verificere overlap-regelhåndhævelse på tværs af:
  - UI-commit,
  - runtime-beregning,
  - PDF-projektion,
  - load/preflight af `.eo` data.

### 16.5 Resume-startpunkt til næste session

- 16.3 er nu lukket; næste arbejde er at omsætte 16.2 + 16.4 til en konkret "fail-closed migrationscheckliste" under Stadie 0/1.
- Før første refaktor-commit etableres tests, der låser de afklarede principper (især `0` vs `null`, control mismatch-gating, TAF-per-år-afstemning).

### 16.6 Fail-closed migrationscheckliste til Stadie 0/1

Denne checkliste er bindende for første migrationsarbejde og skal være opfyldt, før gammel EO-sti kan udfases.

#### Stadie 0: Test- og kortlægningsgate

- Etabler reference-tests, der eksplicit låser forskellen mellem gyldig beregnet `0` og manglende/ugyldig beregning (`null`/fail-closed).
- Etabler reference-tests for out-of-range ferie/fridagsfelter:
  - `tafPerioder[].loseFeriedage`
  - `uspecificeredeFerieFridage`
  hvor EO-beregning og downloads ikke må optræde som gyldige.
- Etabler reference-tests for kontekstuelle ferie/fridagsfejl, hvor antal ferie/fridage overstiger mulige arbejdsdage i den relevante beregningsperiode.
- Etabler reference-tests for TAF-perioder uden for tilladte bounds, hvor autoritativ sti skal ende i fejl/fail-closed og ikke intern clamp.
- Etabler reference-tests for kontroluoverensstemmelse, hvor både EO-PDF og TAF-fordelt-på-år-PDF skal være blokeret.
- Etabler reference-tests for TAF-per-år-afstemning over `100 øre`, hvor dokumentmodellen/PDF-generationen afvises helt.
- Kortlæg og klassificer alle TAF-bounds som enten:
  - commit-validerbare input-bounds
  - snapshot-afledte bounds fra andre committed felter
- For snapshot-afledte bounds skal fejlmodellen kunne pege på både symptomfeltet (TAF-periode) og årsagsfeltet (fx differencekrav-dato eller endelig EET-dato).
- Kortlæg alle steder hvor `0` og `null` normaliseres eller behandles ens i EO canonical/debug/sammentælling/PDF.
- Kortlæg alle download-entrypoints i EO-scope og verificer, at fejlresultater ikke kan blive tavse for brugeren.
- Kortlæg hvor tabelinput-fejl løftes til samlet EO-fejlmodel/gating, og dokumenter alle huller.
- Kortlæg overlap-regelhåndhævelse på tværs af UI-commit, runtime-beregning, PDF-projektion og load/preflight.
- Kortlæg alle steder hvor stale snapshot kan opstå, og verificer at stale state aldrig klassificeres som kontroluoverensstemmelse eller systemfejl.
- Kortlæg alle nuværende brugere af `buildTafRanges` og klassificer dem som:
  - autoritativ beregningssti
  - UI-/hjælpevisning
  - legacy/parity-reference

#### Stadie 1: Snapshot- og invariant-gate

- `computeEoSnapshot` skal starte med defensiv schema-guard og returnere fail-closed i stedet for fallback-beregning ved korrupt input.
- Uventede runtime-undtagelser i `computeEoSnapshot` skal:
  - ende i `fail_closed`
  - bruge `failClosedReason='runtime_exception'`
  - logges lokalt via `console.error` med tilstrækkelig kontekst til reproduktion
  - route brugeroplevelsen til eksisterende runtime-fejlvisning, ikke en tavs tomvisning
- Snapshot-orchestreringen skal udføre preflight-checks før engine-kald for alle fejl, der kan udtrykkes brugernært på snapshot-niveau (fx overlap, out-of-range periods/bounds, manglende nødvendige inputfelter).
- Engine-throws må ikke være primær mekanisme for forventelige brugerinputfejl i den autoritative sti. Hvis en engine kaster på sådan et tilfælde, er det et hul i preflight-dækningen, som skal lukkes.
- Snapshot må ikke indeholde eller eksponere parallel fallback-totaler; der skal kun være én autoritativ beregningssti.
- Snapshot-stien må ikke bruge clampende `buildTafRanges` direkte. Der skal introduceres en clamp-fri afløser eller refaktorering, som gør begge dele synlige:
  - rå TAF-ranges til autoritativ beregning
  - bound-violations til invariant-registry
- Clamp-baserede TAF-ranges må kun bevares til UI-hjælpemidler og legacy/parity-sammenligning, ikke som input til autoritativ snapshot-beregning.
- Invariant-registry skal have eksplicitte checks for:
  - out-of-range `tafPerioder[].loseFeriedage`
  - out-of-range `uspecificeredeFerieFridage`
  - kontekstuel ferie/fridags-overbooking ift. mulige arbejdsdage
  - TAF-periode uden for bounds
  - overlap i TAF-perioder
  - kontroluoverensstemmelse mellem totals/kontrolsum i friskt snapshot
  - TAF-per-år-afstemning over `100 øre`
- Invariant-brud, som gør beregning eller download utroværdig, skal klassificeres som `error` eller `fail_closed`, aldrig som almindelig warning.
- Projektioner til Beregning, Debug og PDF skal pattern-matche på snapshot-status først og må ikke antage, at totals findes ved `fail_closed`.
- EO-PDF og TAF-fordelt-på-år-PDF må kun modtage snapshot-/document-model-data, aldrig rå form-state.
- `tidligereModtagetTaf` skal i snapshot/totals være normaliseret til et entydigt numerisk `0`, når feltet er tomt.
- Svie/smerte-bounds-fejl med gyldige committed datoer skal klassificeres som brugerrettelig `error`, så fejl kan vises præcist uden at maskere sig som runtimefejl.
- `buildTafPerYearResult` skal refaktoreres væk fra `PdfModel`-afhængighed og i stedet modtage snapshot-relevante domænedata direkte som del af snapshot-build.
- TAF-fordelt-på-år-projektionen må kun eksistere, hvis afstemning mod EO-total er inden for `100 øre`; ellers returneres fejlblokering, ikke tom eller alternativ visning.
- Download-gating skal centraliseres omkring snapshot-status og invariant-resultater, men være output-specifik:
  - kontroluoverensstemmelse i frisk snapshot blokerer alle EO-downloads
  - TAF-per-år-afstemningsfejl over `100 øre` blokerer kun TAF-fordelt-på-år-download

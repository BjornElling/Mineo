# Erstatningsopgørelse-arkitektur (fra bunden)

**Status:** Foreslået målarkitektur (arbejdsplan)
**Scope:** Hele Erstatningsopgørelse-fanen inkl. EODebug, EODebugTabel, `erstatningsopgoerelsePdf`, `tafFordeltPaaAarPdf` og underliggende beregninger
**Mål:** Samme UI/UX og samme PDF-indhold som i dag, men med én autoritativ beregningssti

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
| E | Direkte modelbygning i `EODebug.tsx` via debug-moduler | EODebug-siden |

Præcisering af D vs E:
- D er snapshot-stien for Beregning/EODebugTabel.
- E er EODebug-fanens egen sti.

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
  failClosedReason: 'schema_guard' | 'critical_invariant' | 'unexpected_state';
}>;

type EoSnapshot = EoSnapshotComputed | EoSnapshotFailClosed;
```

## 5.2 Hvad snapshot IKKE indeholder

- Ingen UI-state (aktiv fane, dialog-state, input-focus).
- Ingen formatteringsspecifikke UI-strenge der kun bruges i én komponent.
- Ingen pdf-lib layoutdata.

## 5.3 Regel for `snapshot.status`

Status sættes deterministisk sådan:
- `fail_closed`: schema-guard fejler, eller mindst én invariant med `severity='error'` og `passed=false`, hvor beregning ikke kan fortsætte sikkert.
- `error`: preflight-fejl (manglende nødvendige inputs) uden intern inkonsistens.
- `warning`: ingen errors/fail_closed, men mindst én warning-invariant med `passed=false`.
- `ok`: ingen brudte invariants og ingen preflight-fejl.

Projektioner pattern-matcher altid først på `status`. Ved `fail_closed` renderes fejl-/tomvisning uden antagelse om `engines`/`totals`.

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
- Brud giver `error`/`fail_closed` i snapshot og blokerer TAF-per-år visning/download.

## 10. Migreringsstrategi (parallelkørsel)

Princip pr. stadie:
- Ny sti introduceres parallelt med gammel sti.
- Parity verificeres i test-suite på reference-cases (ikke i produktion-runtime).
- Valgfrit i dev-mode: runtime-assertions der logger divergens, men aldrig blokerer UI.
- Gammel sti fjernes først når parity + tests er grønne.
- Ingen big-bang switch.

## 11. Implementeringsplan (handlingsrettet)

## Stadie 0: Baseline-tests (obligatorisk før kodeflyt)

Reference-cases (mindst 5):
1. Simpel sag uden TAF.
2. TAF-sag inden for ét kalenderår.
3. TAF over flere år med afstemningslinje.
4. Sag med flere øvrige krav-typer.
5. Sag med forligsgrad.

Testformat:
- Input fixture: `StamdataValues + ErstatningsopgoerelseValues`.
- Forventning: totals, centrale engine-felter, invariant-status.
- Pure unit tests (ingen UI).

PDF-baseline i Stadie 0:
- Gem tekst-/strukturbaseret baseline (ikke byte-compare).

## Stadie 1: Introducer `eoSnapshot.ts`

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

## Stadie 2: EO PDF til snapshot-projektion

Arbejdsopgaver:
- Implementér `eoSnapshotToEoPdfDocument`.
- Migrér én PDF-sektion ad gangen med parity-test pr. sektion.
- Start med `opgoerelseSection` (størst og mest inputtung), fortsæt derefter regulering, lønindkomst, offentlige ydelser, SH-dage, sygeferiegodtgørelse.
- Tilpas EO PDF writer/sections til kun document model input.
- Parallel assertions mod nuværende `buildErstatningsopgoerelsePdfModel` output.

Done:
- PDF-indholdsparitet på reference-cases.

## Stadie 3: Beregning-tab til snapshot

Arbejdsopgaver:
- Erstat EO-aggregation hook-sti med snapshot-projektion.
- Flyt fejlstatus til invariant-baseret model.

Done:
- Samme viste totals som før.
- Ingen EO-aggregation pipeline som primær datakilde.

## Stadie 4: Debug til snapshot

Arbejdsopgaver:
- Implementér `eoSnapshotToDebugView` med data rows + control rows.
- Migrer EODebug og EODebugTabel til samme snapshot-revision.

Done:
- Ingen engine-imports i debug-renderlag.
- Parity mod baseline på debug-nøglerækker.

## Stadie 5: UI-opdeling og adapter-konsolidering

Arbejdsopgaver:
- Split `EOOplysningerTab.tsx` i 4-5 sektionskomponenter langs eksisterende ContentBox-grupper.
- Split `LoenindkomstTab.tsx` i 3-4 sektionskomponenter (årsløn, perioder, validering/opsummering, hjælpe-dialoger).
- Split `EODebug.tsx` i sektion-renderers baseret på debug-projektion.
- Ekstraher delt løntrin-finder logik til fælles modul/hook.
- Konsolider tabel commit/persist adapters.

Done:
- Mindre, mere auditerbare komponenter.
- Ingen ny domænelogik introduceret i UI-splittet.

## Stadie 6: Oprydning

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
- Én beregningssti aktiv i EO.

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

### 16.3 Åbne principspørgsmål (skal afklares før implementering)

- Skal out-of-range `loseFeriedage` være hård beregningsblokering (ingen totals/PDF), eller må systemet fortsætte med intern justering?
- Skal TAF-perioder uden for tilladte grænser (differencekrav/endelig EET) blokere hele EO-beregningen, eller må de clamples/ignoreres med tooltip-fejl?
- Ved kontroluoverensstemmelse: skal alle downloads hard-blokeres som systemfejl med rapportering?
- For TAF-fordeling per år ved afrundingsafvigelse over `100 øre`: skal download afvises helt (ingen PDF genereres)?

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

- Start med at lukke de åbne principspørgsmål i 16.3.
- Derefter omsættes 16.2 + 16.4 til en konkret "fail-closed migrationscheckliste" under Stadie 0/1.
- Før første refaktor-commit etableres tests, der låser de afklarede principper (især `0` vs `null`, control mismatch-gating, TAF-per-år-afstemning).

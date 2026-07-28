# WI-015: Etape 7 andet pas — hvem ejer et fokusmål

- **Status:** `review` — fire af fem fund lukket og verificeret 2026-07-29; GM-F10 udskilt (se nedenfor)
- **Oprettet:** 2026-07-28
- **Slice/scope:** Draft/commit-reviewets etape 7, andet pas — fokusnavigationens ejerskab
- **Kilde:** `docs/review/draft-commit-review/fund-oversigt.md` etape 7 (R7-F03, R7-F02, GM-F03, GM-F10) + R3-F03
- **Risikoklasse:** M (fokusnavigation; ingen beregningslogik)
- **Baseline:** `greenfield` @ `3633f09e`

## Scope

| Fund | Kort | Status |
|---|---|---|
| R7-F03 | Global feltadresse bestemmer fokusdestinationen | **Rettet + verificeret** |
| R7-F02 | To toggles omgår feltfamilien og mister fokusmetadata | **Rettet + verificeret** |
| GM-F03 | Samme to toggles, fra konvergensreviewets vinkel | **Rettet + verificeret** |
| R3-F03 | Min-max-tooltips mangler inputnavne | **Rettet + verificeret** |
| GM-F10 | EO-fejllinks bruger en separat heuristisk feltidentitet | **UDSKILT** → egen behandling |

Tilfældighedsfund: INC-F11, INC-F12, INC-F13 (rettet), INC-F14 (åbent, bæres af GM-F10).

Bevidst uden for scope: R7-F01 (page-viewmodel-laget, etape 12) og alt i etape 8–12.

## Verifikation

- `typecheck`, `typecheck:test`, `lint`, `check:mojibake`, `check:filename-case`, `verify:ledgers` — grønne.
- Fuld suite: **502 filer / 6288 tests grøn.**
- Hvert nyt værn og hver ny rettelse er **mutationstestet mod den LEVENDE kilde**, ikke kun mod fixtures.

## Hvad blev gjort

### R7-F03 — destinationen ejes af editorlokationen

`src/inputCore/react/fieldAddressDestination.ts` er **slettet** (ikke omdøbt) sammen med sin
completeness-test; den havde præcis ÉN produktionskonsument (save-blokeringens fokus).

- `EditorLocation.route` + `.tabKey` er nu **PÅKRÆVEDE**. Produktionen typecheckede **uændret** ved skiftet —
  alle 82 lokationsdeklarationer erklærede dem allerede, så det valgfrie felt var et hul uden legitime brugere.
- `buildRestoreTargetAttributes` sætter to nye DOM-attributter: `data-mineo-editor-route` og
  `data-mineo-editor-tab`. Signaturen tager de fire PRIMITIVE værdier, fordi hvert kaldssted memoiserer på
  netop dem (kaldssiderne laver en frisk `loc(...)` pr. render).
- Nyt modul `src/inputCore/react/editorLocationDestination.ts` med `lookupEditorLocation()` →
  `visible` / `mounted` / `unmounted`. **Sondringen MOUNTET vs. SYNLIG er mekanismens grundlag:** EO's faner
  forbliver mountet efter første besøg (skjult med `display: none`), så en skjult editor kan oplyse sin fane.
- `saveBlockedFocus.ts` følger den godkendte adfærd ordret: synlig → bliv stående; mountet-men-skjult → følg
  DENS route + fane; intet mountet → sektionens side, og **gæt ikke en fane**. Loopet aktiverer fanen ÉN gang,
  hvis editoren først mounter undervejs (lazy tab-mount).

**Særreglerne forsvandt.** Den gamle model havde fem (`faellesAarsloen`, tre forligsfelter, `eoBilagSelection`,
`currentPathname`-cases). Ingen findes i den nye, og ingen adfærd blev valgt bort.

### R7-F02 + GM-F03 — de to specialtoggles

Ikke en tredje togglekomponent, men **én ny override** på de to eksisterende adaptere:

```ts
export type ToggleCommitDecision = 'commit' | 'reject' | 'handled';
```

Tre-vejs var nødvendigt, fordi en boolsk override kun kunne dække det ene callsite: Årsløns gate skal kunne
**afvise** men vil have adapteren til at skrive; EO's toggle afslutter selv som **én atomisk transaktion** over
flere felter og rækker. `useOmregningToggle` skriver derfor ikke længere selv — den returnerer `decideToggle`.

### R3-F03 — årsagsinputs er nu typekrævede

`noValidRangeInputs?: string` → `bounds: DateRangeBoundsOrigin` (`static` | `derived` med `causeInputs`).
Fejlen var **valgfriheden**, ikke manglende evne: kun 2 af 14 callsites satte feltet. Compileren enumererede
alle callsites; otte flader navngiver nu en årsag, de før var tavse om.

### Værnene (etapens største post ved nedlukningen — nu lukket)

| Regel | Hul den lukker | Mutationsbevis mod levende kilde |
|---|---|---|
| `input/persisted-controls-use-field-family` | `form/restore-target-attributes` dækkede kun `fields/**` — netop derfor var R7-F02's to callsites grønne | Rå toggle i Årsløn → rød på `Aarsloen.tsx:312:13` |
| `input/focus-destination-owned-by-location` | Typen sikrer at lokationen HAR en destination, ikke at ingen udleder én af dataadressen | `PAGE_DEFAULT_TAB` i save-fokus → rød på 3 positioner |
| `input/restore-attributes-carry-destination` | De nye DOM-attributter kunne droppes uden typefejl | Route/fane fjernet fra builderen → `mangler EDITOR_ROUTE_ATTR, EDITOR_TAB_ATTR` |

Efter R7-F02's rettelse findes der bevisligt kun TRE rå control-callsites tilbage (Indstillinger, Mineo,
løntrin-overlayet), alle uden persisteret sagsdata. Reglens allowlist navngiver dem eksplicit frem for at være
en åben liste.

Dertil `persistedToggleUndoFocus.integration.test.tsx` (3 tests gennem de ÆGTE sider og den ægte runtime) — den
evidens R7-F02 manglede, og den der fandt INC-F12.

## Tilfældighedsfund

- **INC-F11 (væsentlig).** Mit eget nye attribut-værn var **inert**: det talte enhver computed property i
  filen, og `RestoreTargetAttributes`-TYPENS fire computed keys opfyldte det. Mutationen forblev GRØN. Samme
  fejl som INC-F03, begået igen i samme etape. Lærepunkt: **mutationstest mod den levende kilde, ikke kun mod
  fixtures** — fixtures beviser at walkeren virker, ikke at den måler det rigtige.
- **INC-F12 (væsentlig).** EO-togglens simple gren dispatchede helt **uden history-origin**. GM-F03 nævnte
  det, men R7-F02's DOM-rettelse lukkede det ikke: identiteten stod i DOM, mens history-framen var tom. Viser
  en grænse for DOM-baseret evidens — begge halvdele skal hævdes.
- **INC-F13 (mindre).** `NON_NAVIGABLE_ROUTE` var et sentinel for en tilstand ingen kode er i, og dens
  testfixture gjorde fire placeholder-tests røde, fordi `settleFieldInNewRow` kræver en rigtig route (§3.7).
  Runtime havde ret; fixturet havde opfundet en løsere udgave af produktionen. Begge slettet.
- **INC-F14 (åbent).** Se GM-F10 nedenfor.

## GM-F10 — udskilt, med færdig kortlægning

Fundet er **større end sin rapport**, og kortlægningen bør ikke laves om:

`eoRowIssueCatalog`'s `kind: 'fieldPath'`-cellemål er **uopnåelige**, af to uafhængige grunde:

1. `CELL_TABLE_IDS`/`buildCellFocusFieldPath` (`src/config/cellFocusPaths.ts`) har INGEN anden konsument end
   kataloget selv, og `data-mineo-field-path` sættes udelukkende som et bart `name`
   (`StyledTextFieldBase.tsx:219`, `StyledTextAreaBase.tsx:221`). Ingen callsite overskriver det med en
   `tableId:rowScope:rowId:colIndex`-streng (verificeret: nul træf).
2. Grid-cellerne renderer `InputBase` direkte og sætter derfor **slet ikke** attributten.

Opslaget falder derfor altid igennem til rækkeankeret (`data-mineo-row-id`). Hele `focusByRowPattern`s
kolonnevalg er uden virkning — inkl. `inferDateColumn`, som gætter kolonne ud fra dansk fejltekst, og
`focusFieldHint`, som fire row-buildere sætter. De ca. 37 `exactFieldTargets` (bare feltnavne) resolver fint.
**Ingen test nævner `focusTarget` overhovedet** (`eoRowIssueCatalog.test.ts`, `scrollToEoRow.test.ts`).

Det ændrer blast radius i begge retninger: ingen kolonnepræcision at regressere, men tre parallelle
attribut-fallbacks, fire row-buildere og et helt konfigurationsmodul at rydde op i. `scrollToEoRow`s
`gridCellKeyFallback` søger desuden på `data-mineo-undo-field-path` = `rowId:colIndex`, som heller ikke
produceres nogen steder.

**Anbefalet retning:** lad EO-rækkerne bære en `FieldAddress` (samme identitet som `historyRestoreTarget` og
`lookupEditorLocation` bruger) og genbrug `lookupEditorLocation` til opslaget i stedet for tre parallelle
attribut-søgninger. Descriptorerne findes allerede for alle de relevante rækkefelter
(`eoTafPeriodeFraField`/`-TilField`, `eoSvieSmertePeriode*`, `eoFerieperiode*`, `eoOevrigeKravDatoField`), så
et rigtigt `FieldRef` kan bindes pr. række + hint. Bemærk `useEoBeregningViewModel.ts:307`, som kalder
`scrollToEoRow('', …)` for EETs stamdata-links — den vej er live gennem `exactFieldTargets`.

**Hvorfor udskilt:** fundet rører EO's rækkeevalueringskerne, som er trust-kritisk (den gater PDF, jf.
`project_b9_eo_debug_split`), og dens rettelse er en selvstændig omlægning frem for en fortsættelse af
fokusmål-ejerskabet. De fire øvrige fund er lukket og verificeret; at holde dem ucommitterede for at afvente
en større omlægning ville være dårligere.

## Invarianter (må ikke brydes)

- §3.2: fokusmål er editorlokationens metadata; feltadressen er dataidentitet og DOM-matchnøgle.
- §3.7: undo/redo fokuserer den editorlokation, ændringen kom fra — ikke en vilkårlig spejling.
- §1.4/§3.9: save blokeres kun af aktivt relevant rejected råinput; gaten viser altid fejlen (fail-soft).
- §1.11: en override må flytte AFSLUTNINGEN, aldrig identiteten, visningen eller restore-attributterne.
- Ingen beregningstal ændret.

## Godkendelsesgate

- **Påkrævet:** UI/UX for R7-F03.
- **Status:** **Godkendt 2026-07-28**: «Hvis feltet kan rettes på den aktuelle side, skal brugeren blive dér og
  sendes til den konkrete kontrol. Ellers sendes brugeren til den relevante side og fane for den del, som
  rapporterede fejlen.» Implementeringen følger dette ordret. R7-F02/GM-F03/R3-F03 kræver ikke godkendelse
  (dokumenteret adfærd genskabes).

## Resterende / risici

- **GM-F10 + INC-F14** udestår; kortlægningen ovenfor er færdig.
- **`data-mineo-field-path`/`-undo-field-path` lever endnu** i fire `Styled*`-primitiver, fordi GM-F10 stadig
  aftager dem. De bør slettes som led i GM-F10 — men først når EO-vejen er omlagt.
- **Ikke dækket af en test:** loopets fane-aktivering kalder `applyDestination` med
  `window.location.pathname` frem for den route-parameter, kaldet fik. Det er tilsigtet (routen kan have
  ændret sig undervejs), men er ikke pinnet.
- **Browserbaseret UI-sammenligning og runtime-fuzzing af tab-mount/settle** udestår fortsat fra R7's egne
  checkpoints — uændret af dette pas.

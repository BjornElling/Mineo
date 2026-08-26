# Overdragelse – brugerblik Årsløn (BB-096 … BB-116)

Midlertidig fil. Slettes når arbejdet er afsluttet.

Kilde: `docs/testing/brugerblik/aarsloen.md` med brugerens tilbagemeldinger, godkendt 2026-08-26
(inkl. de fire punkter agenten pressede tilbage på – alle tiltrådt).

## Færdigt (fuld suite grøn: 615 filer / 8086 tests)

- **BB-096 dubletter.** Ny generisk kerne `src/utils/tableDuplicateRowDetection.ts`
  (`findDuplicateRows`, `normalizeCellValueForDuplicateComparison`, `DUPLICATE_ROW_MESSAGE`).
  Løntabellens afledning ligger i `standardLoenTableFieldSet.ts`
  (`resolveStandardLoenDuplicateRowIssues`) og er generisk over feltsættet, så Årsløn og EO deler den.
  Kun 2., 3., … forekomst flages. Beløb sammenlignes på BEREGNET værdi (1000+1000 == 2000).
  Wiring: `aarsloenProjection.duplicateRowIssues` → `StandardLoenTable`s nye `ruleIssues`-prop →
  `collectionRuleIssue` pr. celle. Blokerer begge dokumenter.
- **BB-097 feriedage-grænse.** `resolveAarsloenFeriedageOverskriderPeriodenIssue` i
  `aarsloenValidationPolicies.ts`. Rød ring, INGEN indtastningsbegrænsning (cifferloftet urørt).
  Grænsen udledes af motorens `hverdageIPeriode`, ikke af en genberegning.
  `IntegerField` fik `crossFieldIssue` (viderestiller til `NumericTextField`, der havde den i forvejen).
- **BB-098 0 kr. er lovligt.** `hasAtLeastOneValidRow` → `hasAtLeastOneCompletePeriodRow`
  (beløbet indgår ikke længere). Gaten og tabelvalideringen er nu enige om nullet.
- **BB-103 + BB-113 advarsler.** Alle advarsler dannes i `beregnFejlmeddelelser`; 6.-ferieuge-teksten
  er flyttet fra `AarsloenMeddelelserSections.tsx` (var hardkodet prosa uden om formattering og
  feltnavn). Gates nu på `erAarsloenSatsFelterRelevante` i `aarsloenPolicy.ts` – samme
  relevans-prædikat som feltsynligheden. `shouldWarnAarsloenFeriePct` slettet (blev død).
  Teksterne bruger feltets eget navn «Feriegodtgørelse/-tillæg».

## Færdigt (2. runde)

- **BB-113 kontrakt:** feriepenge-principperne står i den NYE tværgående
  `src/contracts/feriepenge-begreber-contract.md`. Brugeren korrigerede undervejs to gange: reglerne er
  ikke årslønsspecifikke (bruges også i EO/SFGG), og de hører ikke i AGENTS.md, som skal holdes kort og
  kun rumme generel udviklingsviden. Kontrakten er registreret efter proceduren:
  `contract-topology.json` (begge lister), `contractCoverageMatrix.test.ts` (entry + Testkobling-listen).
  `aarsloen-contract.md` §5 er nu kun en henvisning.
- **BB-106:** `resolveAarsloenNewCaseDefaults` giver nu alle tre standardværdier.
- **BB-108 (formel):** `aarsloenOmregningFormel` i `aarsloenPeriodDisplay.ts` – «/ 1» udelades nu
  BEGGE steder. Procent-delen afvist som aftalt.
- **BB-109:** `isEmptyOrZero` delt i `erCelleTom` (tabelrækker – 0 bevares) og `erSatsUdeladt`
  (satser – 0 udelades). Brugerens to regler er nu to funktioner.
- **BB-111:** `DOCUMENT_LABEL_FORMS` som erklæret dokument-form + værn
  (`standardLoenDeclaredLabelForms.test.ts`). **Fund undervejs:** «ATP mv. u. tillæg» er IKKE en
  afkortning af «ATP og anden løn u. tillæg» – «mv.» erstatter «og anden løn». Den er derfor erklæret
  som `substitutionReason` med begrundelse, ikke foregivet afledt. Vist tekst uændret (bevist af
  `aarsloenPdf.tableLayout.test.ts`).
- **BB-112:** `aarsloenAntalEnhederLabel` + `aarsloenFradragsParentes` – én ordlyd (nu med «de») og
  ingen tom parentes. `isSinglePeriod` eksponeres fra summary, så de to bokse ikke kan divergere.
- **BB-116 (tankestreg):** ` - ` → ` – ` i `LOEN_2_TOOLTIP_TEXT`.

## Mangler

- **BB-101** «Beregnet årsløn»-linje ved helt år + skjul/forklar de fire virkningsløse felter.
- **BB-102** omregnings-toggle skal være inaktiv med årsag i tooltip.
- **BB-104** de to downloadknapper skal navngive deres dokument.
- **BB-107** fra/til-fejltekst pr. felt (central løsning; ordet «dato» må ikke stå i en ugefejl).
- **BB-114** verificér: `parseWeekDraftForCommit` giver ALLEREDE «Uge skal være mellem 1 og 52»
  årsafhængigt (målt). Fundet er formentlig ikke reproducerbart – efterprøv i browseren før ændring.
- **BB-115** gul ring + tooltip ved dato efter dags dato (ikke blokerende).
- **Dublet-reglen mangler i EO** (lønindkomst pr. ansættelsesforhold) og **offentlige ydelser**.
- **BB-097-mønsteret i EO:** `loseFeriedage`, `uspecificeredeFerieFridage` og SFGG-fraværsdage har
  reglen som `ValidationError` (ingen rød celle). **`oevrigeFravaersdage` er HELT uvalideret** – den
  egentlige nye forekomst. Skal alle fire have rød ring + vises på EO-beregning.

## Afviste fund (ingen handling)

BB-105 (lønperiodeskift), BB-109-satsdelen, BB-110 (dokumentet skal vise 0), BB-115-blokering,
BB-116-labels, BB-108-procentdelen.

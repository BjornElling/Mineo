# Mineo – Snapshot-kontrakt

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Tværgående snapshot-mønster; specialiseres af `eo-snapshot-contract.md`, `eet-snapshot-contract.md` og `forsoergertab-snapshot-contract.md`.
**Senest verificeret mod kode:** 2026-05-31

Denne kontrakt fastlægger, hvad et domæne-snapshot er, og hvordan snapshot-first bruges uden at tvinge alle domæner ind i samme datastruktur.

---

## 1. Formål

Et snapshot er et autoritativt, read-only projektionsobjekt bygget fra committed input for ét domæne.

Snapshot’et findes for at:

- samle domænets beregnings-entry til ét kanonisk sted
- sikre at page-, tab- og PDF-lag bruger samme committed grundlag
- forhindre parallelle, inkonsistente beregningsveje i UI-laget

Et snapshot er ikke persisted state, ikke draft-state og ikke et generelt framework.

---

## 2. Grundregler

1. Et snapshot bygges kun fra committed, schema-valideret input.
2. Et snapshot må ikke læse draft-state, lokal view-state eller ucommittede mellemtilstande.
3. Et snapshot er read-only og må ikke have side-effects.
4. Et snapshot-entrypoint er domænets autoritative beregnings-exit for de forbrugere kontrakten dækker.
5. UI-, tab- og PDF-lag må ikke lave parallelle domæneberegninger uden om snapshot’et, når domænekontrakten siger snapshot-first.

---

## 3. Minimumsindhold

Et snapshot-entrypoint skal eksplicit deklarere de projektioner, som dets forbrugere må bruge. Kontrakten kræver ikke én universel TypeScript-shape, men hvert snapshot-first domæne skal opfylde denne checklist.

Minimum for alle snapshot-former:

1. autoritativ inputpakke og hvilke persisted sektioner den må læse,
2. projections der må forbruges af UI, PDF og debug,
3. gating-/statusfelter,
4. issue-/fejlklassifikation,
5. runtime fail-closed adfærd,
6. om eksponeret `input` er original committed state eller effektiv/transient beregningsinput.

Kontrakten kræver ikke én universel shape på tværs af alle domæner. Den kræver ét eksplicit valgt mønster pr. domæne.

---

## 4. To gyldige snapshot-former

### 4.1 Felt-UI-form

Brug felt-UI-formen, når siden primært renderer feltorienteret feedback og simple page-level gating-flags.

Kendetegn:

- `fieldUi`-projektioner pr. relevant felt
- helpertekster og feltfejl samlet dér, hvor UI direkte bruger dem
- page-level flags som `canShowResult`, `canDownloadPdf` eller tilsvarende

Aktuelt eksempel:

- `computeForsoergertabSnapshot(...)`

### 4.2 Issue-/tab-projektionsform

Brug issue-/tab-formen, når domænet består af flere beregningstabber eller delprojektioner med egne blocking-regler.

Kendetegn:

- én projektion pr. tab/delberegning
- `issues`, `hasBlockingErrors` og `computation` eller tilsvarende samlet pr. projektion
- page-laget sender projektioner top-down til tabs i stedet for at lade tabs kalde motorer direkte

Aktuelt eksempel:

- `computeEetSnapshot(...)`
- `computeEoSnapshot(...)`

---

## 5. Valg af form

Når et nyt domæne løftes til snapshot-first, skal formen vælges ud fra brugeroplevelsen og domænets struktur:

1. Vælg felt-UI-formen, hvis siden i praksis er én samlet visning med feltlokale helpertekster og få resultatgates.
2. Vælg issue-/tab-formen, hvis siden har flere delberegninger eller tabs med selvstændige blocking-regler.
3. Divergér kun fra disse to former, hvis domænet meningsfuldt kræver det; så skal afvigelsen dokumenteres eksplicit i domænets kontrakt eller ved snapshot-entrypointet.

---

## 6. Forhold til andre kontrakter

1. `domain-boundary-contract.md` bestemmer hvilke sektioner snapshot’et må læse.
2. `form-contract.md` bestemmer at snapshot’et kun må bruge committed input.
3. `page-component-contract.md` bestemmer at page-laget orkestrerer snapshot’et og sender projektioner videre top-down.
4. Domænespecifikke kontrakter kan indsnævre, hvilke forbrugere et konkret snapshot-entrypoint er autoritativt for.
5. `eo-snapshot-contract.md`, `eet-snapshot-contract.md` og `forsoergertab-snapshot-contract.md` er domænespecifikke specialiseringer af denne kontrakt.

---

## 6A. Runtimefejl

Uventede runtimefejl i snapshot-entrypoints må aldrig give gyldige totals, PDF-projektioner eller debug-output, der ligner autoritativ beregning.

Runtimefejl skal:

1. fail-close i domænets egen status-/issue-model,
2. rapporteres efter `error-debug-contract.md`,
3. give dansk blokerende brugerbesked,
4. undgå fallback-beregninger i UI/PDF/debug.

---

## 6B. Original vs. effektiv input

Hvis et snapshot bruger transient eller virtuel input, skal original committed input bevares uændret i snapshotets audit-/inputprojektion.

Effektiv input må bruges til beregning, men må ikke persisteres eller skjules som om den var brugerens committed state. EO's midlertidigt-EET-injection er referenceeksemplet på dette mønster.

---

## 7. Hvad kontrakten ikke kræver

Denne kontrakt kræver ikke:

- en fælles `SnapshotInput`-base type for hele kodebasen
- en generisk snapshot-factory eller cross-domain framework
- identiske feltnavne mellem alle domæner

Målet er kanonisk beslutning og ensartet retning, ikke tvungen teknisk ensformighed.

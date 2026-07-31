# Mineo - Forsørgertab snapshot-kontrakt

**Status:** Normativ og gældende
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og `snapshot-contract.md`.  
**Senest verificeret mod kode:** 2026-07-31

---

## 1. Autoritativ indgang

`computeForsoergertabSnapshot(...)` er den autoritative entry for Forsørgertab-sidevisning, felt-UI, beregning og
dokumentprojektion.

UI og dokumentflow må ikke lave parallelle Forsørgertab-beregninger uden om snapshot-projektionen.

---

## 2. Inputgrænser

Snapshotprojektionen deklarerer strukturelle dependencies i:

1. `forsoergertab`,
2. `stamdata`,
3. `faellesAarsloen`.

Dependencies resolver gennem én `InputReader`-revision. Snapshotentrypointet modtager kun `ready` input; rejected
input må aldrig omgås via rå canonical sektioner. Andre domæner kræver ændring i `domain-boundary-contract.md`.

---

## 3. Minimumsprojektioner

Snapshot skal mindst deklarere:

1. felt-UI projektioner,
2. gates for ASL/EAL/resultatvisning,
3. beregningsresultat eller tom tilstand,
4. dokumentgate fra den fælles dokumentdefinition,
5. dokumentprojektion,
6. issues/fejlklassifikation.

---

## 4. Fail-closed

Forventelige brugerinputtilstande skal give afledte issues. Uventede runtimefejl må aldrig give gyldige totals eller dokumentprojektion.

Runtimefejl skal routes efter `error-contract.md` og give dansk blokerende brugerbesked.

---

## 5. Minimumstestflade

Tests skal dække:

1. snapshot bygges kun fra en ready, `EvaluationSourceToken`-bundet inputprojektion,
2. dokumentgaten og dokumentprojektionen kommer fra samme dokumentdefinition og angiver blokerende årsager,
3. runtime exception blokerer output,
4. ændringer i `faellesAarsloen` påvirker snapshot deterministisk,
5. dokumentflow bruger snapshot-projektionen og afviser et stale `EvaluationSourceToken`.

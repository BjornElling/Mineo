# Mineo - Forsørgertab snapshot-kontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og `snapshot-contract.md`.  
**Senest verificeret mod kode:** 2026-05-31

---

## 1. Autoritativ Entry

`computeForsoergertabSnapshot(...)` er den autoritative entry for Forsørgertab-sidevisning, felt-UI, beregning og PDF-projektion.

UI og PDF-flow må ikke lave parallelle Forsørgertab-beregninger uden om snapshot-projektionen.

---

## 2. Inputgrænser

Snapshot må læse:

1. `forsoergertab`,
2. `stamdata`,
3. `faellesAarsloen`.

Andre persisted sektioner kræver ændring i `domain-boundary-contract.md`.

---

## 3. Minimumsprojektioner

Snapshot skal mindst deklarere:

1. felt-UI projektioner,
2. gates for ASL/EAL/resultatvisning,
3. beregningsresultat eller tom tilstand,
4. `pdfGate`,
5. PDF-projektion,
6. issues/fejlklassifikation.

---

## 4. Fail-closed

Forventelige brugerinputtilstande skal give feltfejl eller issues. Uventede runtimefejl må aldrig give gyldige totals eller PDF-projektion.

Runtimefejl skal routes efter `error-debug-contract.md` og give dansk blokerende brugerbesked.

---

## 5. Minimumstestflade

Tests skal dække:

1. snapshot bygges kun fra committed input,
2. `pdfGate.canDownload` følger samme gate som PDF-projektionen og `pdfGate.reasons` angiver blokerende årsager,
3. runtime exception blokerer output,
4. changes i `faellesAarsloen` påvirker snapshot deterministisk,
5. PDF-flow bruger snapshot-projektionen.

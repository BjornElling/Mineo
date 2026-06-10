# Mineo - Varige mén domænekontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `date-contract.md` og `amount-contract.md`.  
**Senest verificeret mod kode:** 2026-06-10

---

## 1. Nuværende Model (autoritativ)

Varige mén er et persisted domæne med sektionen `varigemen`.

**Autoritativ beregningskilde:** `src/domain/varigemen/varigeMenEngine.ts` (`computeVarigeMenEngine`) er den kanoniske engine; underberegninger ejes af `varigeMenCalculations.ts`. PDF-flowet modtager i dag beregningsresultat og input fra UI-tabben oven på denne engine. Det er den bindende nuværende model: ingen nye parallelle afledninger må indføres, og beregning må kun ske via engine-modulet.

---

## 2. Kanoniske Regler

1. Siden må læse `stamdata` og egen `varigemen`-sektion.
2. Beregning må ikke læse draft-state eller lokal UI-state, og må kun ske via det autoritative engine-modul i §1.
3. PDF-download skal gates før renderer-kald.
4. Runtimefejl må ikke give gyldige totals eller PDF-projektion.

---

## 3. Arkitekturvalg: ikke snapshot-first (bevidst)

Varige mén er **bevidst ikke** snapshot-first. Engine-modellen i §1 er den valgte slutarkitektur for dette domæne — ikke et mellemtrin på vej mod en snapshot-projektion.

Begrundelse: snapshot-first findes for at eliminere parallelle, inkonsistente beregningsveje mellem UI, tab og PDF (jf. `snapshot-contract.md §1`). Det problem findes ikke her. Engine-resultatet (`computeVarigeMenEngine`) beregnes ét sted (`MenberegningTab`), og PDF-stien **genbruger** det allerede beregnede `beregningsResultat` — den genberegner ikke. Domænet er en enkelt beregning uden tabber eller selvstændige delberegninger, et snapshot skulle samle. Et snapshot-lag ville her tilføje vægt uden at fjerne en risiko, hvilket strider mod konvergensreglen i `AGENTS.md`.

Beslutningen er truffet endeligt og er ikke et udestående. Snapshot-first er forbeholdt de tre tunge domæner (EO/EET/forsørgertab), jf. `snapshot-contract.md §5`.

---

## 4. Minimumstestflade

Tests skal dække:

1. engine-resultat fra committed input,
2. PDF-gate ved manglende grundlag,
3. runtime exception som blokeret output,
4. at PDF og UI bruger samme beregnede `beregningsResultat` (PDF genberegner ikke).

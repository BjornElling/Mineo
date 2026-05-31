# Mineo - Varige mén domænekontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `date-contract.md` og `amount-contract.md`.  
**Senest verificeret mod kode:** 2026-05-31

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

## 3. Fremtidig retning (ikke-bindende)

Varige mén bør på sigt have en minimal snapshot/projection, der samler committed input, engine-resultat, issue-/blocking-status, PDF-gate og PDF-model. Indtil da er §1 den bindende model; dette afsnit beskriver kun ønsket slutarkitektur.

---

## 4. Minimumstestflade

Tests skal dække:

1. engine-resultat fra committed input,
2. PDF-gate ved manglende grundlag,
3. runtime exception som blokeret output,
4. samme model til UI og PDF, når projection indføres.

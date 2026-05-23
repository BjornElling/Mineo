# Mineo - Varige mén domænekontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `date-contract.md` og `amount-contract.md`.

---

## 1. Nuværende Model

Varige mén er et persisted domæne med sektionen `varigemen`.

Domænet har en central engine, men PDF-flowet må i dag modtage beregningsresultat og input fra UI-tabben. Det er accepteret som nuværende model, men må ikke udvides med nye parallelle afledninger.

---

## 2. Måltilstand

Varige mén skal have en minimal snapshot/projection, der samler:

1. committed input,
2. engine-resultat,
3. issue-/blocking-status,
4. PDF-gate,
5. PDF-model.

---

## 3. Kanoniske Regler

1. Siden må læse `stamdata` og egen `varigemen`-sektion.
2. Beregning må ikke læse draft-state eller lokal UI-state.
3. PDF-download skal gates før renderer-kald.
4. Runtimefejl må ikke give gyldige totals eller PDF-projektion.

---

## 4. Minimumstestflade

Tests skal dække:

1. engine-resultat fra committed input,
2. PDF-gate ved manglende grundlag,
3. runtime exception som blokeret output,
4. samme model til UI og PDF, når projection indføres.

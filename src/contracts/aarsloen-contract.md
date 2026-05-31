# Mineo - Årsløn domænekontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `amount-contract.md` og `periodisering-contract.md`.  
**Senest verificeret mod kode:** 2026-05-31

---

## 1. Nuværende Model (autoritativ)

Årsløn er et persisted domæne med sektionen `aarsloen`.

**Autoritativ beregningskilde:** `src/domain/aarsloen/aarsloenCalculations.ts` (`beregnMetode`, `beregnOmregnetAarsloen`) er den kanoniske beregningskilde for årsløn; periodevisning ejes af `aarsloenPeriodDisplay.ts` og validering af `aarsloenValidationPolicies.ts` + `src/domain/policies/aarsloenPolicy.ts`. Domænet har aktuelt et section-lokalt beregningsflow, hvor page-laget samler committed input, tabelafledninger og PDF-gates fra disse moduler. Det er den bindende nuværende model: ingen anden beregningssti for årsløn må indføres, og featurekode må ikke genberegne årsløn uden for disse moduler.

---

## 2. Kanoniske Regler

1. Beregning må kun bruge committed `aarsloen` og autoriseret read-only `stamdata`, og kun via de autoritative moduler i §1.
2. Dagtælling og årslønsomregning følger den kategori, der er defineret i `periodisering-contract.md`.
3. Beløb og afrunding følger `amount-contract.md`.
4. PDF-gate skal være eksplicit og må ikke afhænge af rendererens interne fejl.

---

## 3. Fremtidig retning (ikke-bindende)

Årsløn bør på sigt migrere mod snapshot-first eller en tilsvarende autoritativ projektion, så tabelafledninger, SH-dage, PDF-gate og PDF-model bygges fra samme committed projektion, og PDF-rendereren ikke genberegner domæneafledninger. Indtil migrationen sker, er §1 den bindende model; dette afsnit beskriver kun ønsket slutarkitektur og må ikke læses som et krav til nuværende kode.

---

## 4. Minimumstestflade

Tests skal dække:

1. tabelafledninger fra committed rows,
2. SH-/hverdagsregler,
3. PDF-gate ved manglende eller invalid beregningsgrundlag,
4. samme projektion til UI og PDF, hvis/når snapshot/projektion indføres.

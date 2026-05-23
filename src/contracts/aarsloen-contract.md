# Mineo - Årsløn domænekontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `amount-contract.md` og `periodisering-contract.md`.

---

## 1. Nuværende Model

Årsløn er et persisted domæne med sektionen `aarsloen`.

Domænet har aktuelt et section-lokalt beregningsflow, hvor page-laget samler committed input, tabelafledninger og PDF-gates. Det er accepteret som nuværende model, men må ikke udvides med flere parallelle beregningsstier.

---

## 2. Måltilstand

Årsløn skal migrere mod snapshot-first eller en tilsvarende autoritativ projektion.

Målet er, at tabelafledninger, SH-dage, PDF-gate og PDF-model bygges fra samme committed projektion, så PDF-rendereren ikke genberegner domæneafledninger.

---

## 3. Kanoniske Regler

1. Beregning må kun bruge committed `aarsloen` og autoriseret read-only `stamdata`.
2. Dagtælling og årslønsomregning følger den kategori, der er defineret i `periodisering-contract.md`.
3. Beløb og afrunding følger `amount-contract.md`.
4. PDF-gate skal være eksplicit og må ikke afhænge af rendererens interne fejl.

---

## 4. Minimumstestflade

Tests skal dække:

1. tabelafledninger fra committed rows,
2. SH-/hverdagsregler,
3. PDF-gate ved manglende eller invalid beregningsgrundlag,
4. samme projektion til UI og PDF, når snapshot/projektion indføres.

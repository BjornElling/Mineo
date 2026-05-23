# Mineo - Renteberegning domænekontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `date-contract.md` og `amount-contract.md`.

---

## 1. Nuværende Model

Renteberegning er et persisted domæne med sektionen `renteberegning`.

Domænet har aktuelt et tabel-/context-drevet flow. Denne model er accepteret, men rente-PDF må ikke afhænge af implicit tabelcontext uden eksplicit gate/preflight.

---

## 2. Måltilstand

Renteberegning skal migrere mod en autoritativ snapshot- eller preflight-projektion, der samler:

1. committed rentekravsrækker,
2. beregningsdato,
3. periodeoutput,
4. kommentarer/visningsvalg,
5. PDF-gate og PDF-model.

---

## 3. Kanoniske Regler

1. Renteberegning må kun bruge committed input.
2. Dato- og dagtælling følger `date-contract.md`.
3. Beløb og afrunding følger `amount-contract.md`, medmindre rentedomænet får en mere specifik dokumenteret regel.
4. PDF-download kræver eksplicit `RentePdfPreflight` eller tilsvarende gate.
5. Renderer-fejl må ikke være primær gate for ugyldigt brugerinput.

---

## 4. Minimumstestflade

Tests skal dække:

1. dagtælling for grænseperioder,
2. renteperioder og afrunding,
3. PDF-gate ved manglende/invalid input,
4. at PDF-output bruger samme preflight/projektion som UI.

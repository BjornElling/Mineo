# Mineo - Renteberegning domænekontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `date-contract.md` og `amount-contract.md`.  
**Senest verificeret mod kode:** 2026-05-31

---

## 1. Nuværende Model (autoritativ)

Renteberegning er et persisted domæne med sektionen `renteberegning`.

**Autoritativ beregningskilde:** `src/domain/renteberegning/renteberegningEngine.ts` (`computeRenteberegning`, `computeRentekravRow`) og `src/domain/renteberegning/procesrenteCalculator.ts` (`calculateProcessInterestWithRates`, `calculateProcessInterestBreakdownWithRates`) er de kanoniske beregningskilder; renteprincipper ejes af `renteCalculationPrinciples.ts`. Domænet har aktuelt et tabel-/context-drevet flow oven på disse motorer. Det er den bindende nuværende model: rente-PDF må ikke afhænge af implicit tabelcontext uden eksplicit gate, og ingen anden rente-beregningssti må indføres.

---

## 2. Kanoniske Regler

1. Renteberegning må kun bruge committed input, og kun via de autoritative moduler i §1.
2. Dato- og dagtælling følger `date-contract.md`.
3. Beløb og afrunding følger `amount-contract.md`, medmindre rentedomænet får en mere specifik dokumenteret regel.
4. PDF-download kræver en eksplicit, auditerbar download-gate beregnet fra committed input (jf. `downloadAllDisabled`/`oversigtDownloadDisabled` i `RenteberegningTab.tsx`), ikke implicit tabelcontext.
5. Renderer-fejl må ikke være primær gate for ugyldigt brugerinput.

---

## 3. Arkitekturvalg: ikke snapshot-first (bevidst)

Renteberegning er **bevidst ikke** snapshot-first. Den tabel-/engine-drevne model i §1 er den valgte slutarkitektur for dette domæne — ikke et mellemtrin på vej mod en snapshot-/preflight-projektion.

Begrundelse: snapshot-first findes for at eliminere parallelle, inkonsistente beregningsveje mellem UI, tab og PDF (jf. `snapshot-contract.md §1`). Det problem findes ikke her. Hver rentekravsrække beregnes idempotent af `computeRentekravRow`, og PDF-stien **genbruger** rækkens allerede beregnede `pdfContext` (periodeoutput m.m.) — den genberegner ikke renteperioder. Beregningen er rækkelokal og selvstændig pr. række; der er ingen tværgående delberegninger eller blocking-projektioner, et snapshot skulle samle. Et snapshot-lag ville her tilføje vægt uden at fjerne en risiko, hvilket strider mod konvergensreglen i `AGENTS.md`.

Beslutningen er truffet endeligt og er ikke et udestående. Snapshot-first er forbeholdt de tre tunge domæner (EO/EET/forsørgertab), jf. `snapshot-contract.md §5`.

---

## 4. Minimumstestflade

Tests skal dække:

1. dagtælling for grænseperioder,
2. renteperioder og afrunding,
3. PDF-gate ved manglende/invalid input,
4. at PDF-output bruger samme rækkeberegnede `pdfContext` som UI (PDF genberegner ikke renteperioder).

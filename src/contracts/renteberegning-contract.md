# Mineo - Renteberegning domænekontrakt

**Status:** Normativ og gældende
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `date-contract.md` og `amount-contract.md`.  
**Senest verificeret mod kode:** 2026-08-01

---

## 1. Nuværende Model (autoritativ)

Renteberegning er et persisted domæne med sektionen `renteberegning`.

**Autoritativ beregningskilde:** `src/domain/renteberegning/renteberegningEngine.ts` (`computeRenteberegning`, `computeRentekravRow`) og `src/domain/renteberegning/procesrenteCalculator.ts` (`calculateProcessInterestWithRates`, `calculateProcessInterestBreakdownWithRates`) er de kanoniske beregningskilder; renteprincipper ejes af `renteCalculationPrinciples.ts`. Domænet har aktuelt et tabel-/context-drevet flow oven på disse motorer. Det er den bindende nuværende model: rente-PDF må ikke afhænge af implicit tabelcontext uden eksplicit gate, og ingen anden rente-beregningssti må indføres.

---

## 2. Kanoniske Regler

1. Renteberegning må kun bruge en `ready`, `EvaluationSourceToken`-bundet inputprojektion fra `InputReader`, og kun via de
   autoritative moduler i §1. Rå canonical sektioner er ikke en tilladt engine-/gate-adgang.
2. Dato- og dagtælling følger `date-contract.md`.
3. Beløb og afrunding følger `amount-contract.md`, medmindre rentedomænet får en mere specifik dokumenteret regel.
4. Dokument-download og nulstilling ("Slet alle indtastninger") kræver eksplicitte, auditerbare gates fra afsluttet
   input, ikke implicit tabelcontext. Hvert rentedokument definerer sine dependencies: fælles `beregningsdato` samt
   felterne i den eller de inkluderede rækker. Den fælles projektion resolver rejected, missing, range/bounds og
   regelissues; et manuelt global/row-scope eller lokale `hasError`-booleans er ikke tilladt. Dermed blokerer en
   ugyldig celle automatisk sin per-række-download og aggregater, der inkluderer rækken, men ikke andre uafhængige
   per-række-dokumenter. Nulstillings-gaten udledes af samme afsluttede inputmodel, men er ikke en dokumentgate.
5. Renderer-fejl må ikke være primær gate for ugyldigt brugerinput.
6. En rentekravsrække med kun valgt tillægstidsenhed er semantisk tom og udgør selv tabellens ene trailing
   indtastningsrække. Enhedsvalget må ikke i sig selv skabe en ekstra synlig række.

---

## 3. Arkitekturvalg: ikke snapshot-first (bevidst)

Renteberegning er **bevidst ikke** snapshot-first. Den tabel-/engine-drevne model i §1 er den valgte slutarkitektur.
Domænet bruger en `EvaluationSourceToken`-bundet `InputProjection` foran motoren; den er en inputintegritetsgrænse, ikke et
beregningssnapshot.

Begrundelse: hver rentekravsrække beregnes idempotent af `computeRentekravRow`, og dokumentstien genbruger rækkens
beregnede context fra samme ready-projektion. Inputprojectionen bygger kun engine-input, når dokumentets/consumerens
strukturelle dependencies er anvendelige. Et yderligere snapshot ville ikke fjerne en parallel beregningssti.

Ved dokumentklik kører critical-action-preflight først. Derefter bygges projektionen fra en frisk `InputReader`; kun
ready-grenens `EvaluationSourceToken` må nå dokumentservicen. Servicen kontrollerer hele tokenet efter lazy-load og
umiddelbart før generatoren og afviser fail-closed ved input- eller settingsdrift.

Beslutningen er truffet endeligt og er ikke et udestående. Snapshot-first er forbeholdt de tre tunge domæner (EO/EET/forsørgertab), jf. `snapshot-contract.md §6`.

---

## 4. Minimumstestflade

Tests skal dække:

1. dagtælling for grænseperioder,
2. renteperioder og afrunding,
3. dokumentgate ved både manglende input, rejected/invalid format og canonical range/bounds-fejl,
4. at både den reaktive knap og click-preflight blokerer før generator og fil-I/O for hver af fejlklasserne i punkt 3,
5. at PDF og Word har samme gate,
6. at dokument-output bruger samme rækkeberegnede `pdfContext` som UI (dokumentet genberegner ikke renteperioder).

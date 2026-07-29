# Mineo - Varige mén domænekontrakt

**Status:** Normativ og gældende
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `date-contract.md` og `amount-contract.md`.  
**Senest verificeret mod kode:** 2026-07-16

---

## 1. Nuværende Model (autoritativ)

Varige mén er et persisted domæne med sektionen `varigemen`.

**Autoritativ beregningskilde:** `src/domain/varigemen/varigeMenEngine.ts` (`computeVarigeMenEngine`) er den kanoniske engine; underberegninger ejes af `varigeMenCalculations.ts`. UI og dokumentdefinition genbruger samme engine-resultat fra den ready projektion. Ingen parallelle afledninger må indføres, og beregning må kun ske via engine-modulet.

---

## 2. Kanoniske Regler

1. Siden må læse `stamdata` og egen `varigemen`-sektion.
2. Beregning må kun modtage en `ready`, `EvaluationSourceToken`-bundet projektion af `stamdata` og `varigemen`; rå canonical
   sektioner, åben draft og lokal UI-state er ikke engine-input.
3. Dokumentdownload gates før renderer-kald af en typed dokumentdefinition. Den samme definition driver reaktiv gate
   og click-preflight og aggregerer alle relevante fejlissues; lokale feltbooleans er ikke gatekilder.
4. Runtimefejl må ikke give gyldige totals eller PDF-projektion.
5. **Bevidst domænebeslutning:** Méngrad er et heltal fra og med 1 til og med 120. Værdier over 100 er gyldigt beregningsinput og anvendes direkte i samme formel som øvrige méngrader.
6. **Bevidst valideringsbeslutning:** En parsebar heltals-méngrad uden for 1..120 committes canonical og giver et
   afledt **rødt** range-issue. Værdien bevares canonical (den maskeres ikke), men den røde feltfejl blokerer efter den
   dependency-specifikke gate (`form-contract.md` §8): den må hverken nå beregningsmotoren eller passere PDF-gaten,
   men den må gemmes i `.eo`. Persistence-schemaet validerer heltalssyntaks; feltdefinition, projektion og engine deler
   domænegrænsen `VARIGE_MEN_MAX_MENGRAD`.

---

## 3. Arkitekturvalg: ikke snapshot-first (bevidst)

Varige mén er **bevidst ikke** snapshot-first. Inputprojektionen og engine-modellen i §1 er slutarkitekturen, ikke et
mellemtrin mod et snapshot.

Begrundelse: snapshot-first findes for at eliminere parallelle, inkonsistente beregningsveje mellem UI, tab og PDF (jf. `snapshot-contract.md §1`). Det problem findes ikke her. Engine-resultatet (`computeVarigeMenEngine`) beregnes ét sted (`MenberegningTab`), og PDF-stien **genbruger** det allerede beregnede `beregningsResultat` — den genberegner ikke. Domænet er en enkelt beregning uden tabber eller selvstændige delberegninger, et snapshot skulle samle. Et snapshot-lag ville her tilføje vægt uden at fjerne en risiko, hvilket strider mod konvergensreglen i `AGENTS.md`.

Beslutningen er truffet endeligt og er ikke et udestående. Snapshot-first er forbeholdt de tre tunge domæner (EO/EET/forsørgertab), jf. `snapshot-contract.md §6`.

---

## 4. Minimumstestflade

Tests skal dække:

1. engine-resultat fra ready, afsluttet input,
2. dokumentgate ved missing, invalid og range/bounds,
3. runtime exception som blokeret output,
4. at PDF og UI bruger samme beregnede `beregningsResultat` (PDF genberegner ikke).
5. grænseværdierne 120 (gyldig og beregnet) og 121 (canonical, range-markeret og blokeret før engine/PDF).

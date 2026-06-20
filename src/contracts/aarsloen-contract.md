# Mineo - Årsløn domænekontrakt

**Status:** Minimal domænekontrakt (normativ)  
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `amount-contract.md` og `periodisering-contract.md`.  
**Senest verificeret mod kode:** 2026-06-20

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
5. Et felts synlighed og dets neutralisering i beregningen udledes af **samme** relevans-prædikat (ét sandt sted) i `src/domain/policies/aarsloenPolicy.ts` — fx `erAarsloenFerieFelterRelevant`, der fodrer både `shouldShowAarsloenFerieFields` (UI) og beregnings-gatingen i `useAarsloenBeregning`. Sidekomponenter må ikke gen-introducere inline synligheds-betingelser på felter, hvis relevans ejes af et prædikat. Jf. `form-contract.md` §2.2.

---

## 2a. Persisteret model og load-tolerance

`aarsloenSchema` (`src/schemas/formSchemas/sections/aarsloenSchemas.ts`) er eneste sandhedskilde for sektionens persisterede form. For at en ældre `.eo` uden et felt ikke fejler hele sektionen (jf. `persistence-contract.md` forward/backward-tolerant load), bærer de påkrævede felter faste schema-defaults, der matcher det en ny, tom sag starter med:

- `loenperiode` → `'maaned'`, `tillaegAngivesSom` → `'procent'`, `tableData` → `[]`, `omregningTilFuldtAar` → `false`, `fuldLoenUnderFerie` → `true`, `retTilSjetteFerieuge` → `true`, `loenPaaHelligdage` → `'Almindelig løn'`.
- Procentfelterne (`feriePct`, `fritvalgPct`, `shSoPct`, `storeBededagPct`, `pensionPct`) og `antalFeriedage` er optional; manglende værdi forbliver `undefined`.
- `tillaegAngivesSom` bestemmer, hvordan lønindkomst-tillæg angives: `'procent'` lader programmet beregne FP/FV/SH/SO- og Arb.g. Pension-beløbene ud fra satserne, mens `'beloeb'` lader brugeren angive beløbene direkte i tabelrækkernes `fpFvShSoBeloeb`/`pensionBeloeb`-felter. De to tilstande er ligestillede; kun den aktive tilstands input fodrer beregning og dokumenter — den fravalgte tilstands persisterede input bevares, men ignoreres (samme relevans-princip som §2-regel 5). At gøre `tillaegAngivesSom` default-bærende og tilføje de to nye række-felter er bogført som `PERSISTED_DATA_VERSION`-bump (3.4 → 3.5).

`loenperiode`-defaulten er **bevidst statisk** og ikke settings-styret: en ny sag sætter feltet fra `defaultLoenIndtastesSom` via `createAarsloenInitialValues`, men schema-defaulten rammer kun load af en fil hvor feltet helt mangler — og `persistence-contract.md` forbyder at injicere device-lokale app-settings under load. At gøre felterne default-bærende ændrer schema-fingerprintet (input-optional) og er bogført som `PERSISTED_DATA_VERSION`-bump.

---

## 3. Arkitekturvalg: ikke snapshot-first (bevidst)

Årsløn er **bevidst ikke** snapshot-first. Den section-lokale engine-/calculations-model i §1 er den valgte slutarkitektur for dette domæne — ikke et mellemtrin på vej mod en snapshot-projektion.

Begrundelse: snapshot-first findes for at eliminere parallelle, inkonsistente beregningsveje mellem UI, tab og PDF (jf. `snapshot-contract.md §1`). Det problem findes ikke her. Årsløns engine-resultat beregnes ét sted (`useAarsloenBeregning`-hook), og PDF-stien **genbruger** det allerede beregnede `beregningsData` — den genberegner ikke domæneafledninger. Der er derfor hverken duplikering eller grænse-smerte at retfærdiggøre et snapshot-lag for, jf. konvergensreglen i `AGENTS.md` (ingen abstraktioner til hypotetisk fremtidig genbrug). Et snapshot-lag her ville tilføje vægt uden at fjerne en risiko.

Beslutningen er truffet endeligt og er ikke et udestående. Snapshot-first er forbeholdt de tre tunge domæner (EO/EET/forsørgertab), jf. `snapshot-contract.md §5`.

---

## 4. Minimumstestflade

Tests skal dække:

1. tabelafledninger fra committed rows,
2. SH-/hverdagsregler,
3. PDF-gate ved manglende eller invalid beregningsgrundlag,
4. at PDF og UI bruger samme beregnede `beregningsData` (PDF genberegner ikke domæneafledninger).

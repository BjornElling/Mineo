# Beregningsarkitektur

**Status:** Arkitekturforklarende reference, ikke selvstændig kontrakt
**Scope:** Alle beregningsdomæner i Mineo

Bindende regler ligger i `src/contracts/*`, især `form-contract.md`, `domain-boundary-contract.md`, `calculation-data-contract.md`, `snapshot-contract.md`, `amount-contract.md`, `date-contract.md` og domænekontrakterne. Ved konflikt har kontrakterne forrang.

## 1. Beregningsgrænse (calculation boundary)

Beregningslaget må kun arbejde på:
- Committed, schema-valideret input
- Eksplicit indgivet read-only reference-data

Beregningslaget må aldrig afhænge af:
- React/hooks/komponenter
- Zustand selectors/store-access
- Persistence (`sessionStorage`, `.eo`, fil-IO)
- UI-policy, labels, tooltips, visningslogik
- Locale-formattering
- Implicit tid (`Date.now`) uden eksplicit input

## 2. Påkrævet pipeline

Alle beregningsflows skal følge denne form:

`CommittedInputSnapshot -> Prepare/Normalize (valgfrit) -> Engine -> OutputSchema`

Regler:
- Snapshot er immutable og konsistent for ét commit-tidspunkt.
- Prepare/Normalize må kun lave deterministisk struktur-normalisering.
- Engine er ren funktion uden sideeffekter.
- OutputSchema er struktureret data (ikke præformatterede UI-strings).

## 2A. Orkestrering og adgang

Engines er rene domænefunktioner, men UI, PDF og kontrol må ikke kalde selvstændige engines direkte, når domænet har snapshot- eller projection-entrypoint.

For snapshot-first-domæner er den kanoniske adgang:

`CommittedInput -> compute<Domain>Snapshot(...) -> UI/PDF/kontrol-projektion`

Direkte engine-kald fra UI/hooks/PDF er et kontraktbrud, medmindre en domænekontrakt eksplicit legitimerer et smallere section-lokalt flow. Se `src/contracts/snapshot-contract.md`.

Snapshot-first gælder de tre tunge domæner (EO/EET/forsørgertab), jf. `snapshot-contract.md §5`. Årsløn, renteberegning og varige mén kører bevidst et section-lokalt engine-flow — det er deres slutarkitektur, ikke en tilstand der skal løftes til snapshot. For disse er den kanoniske adgang ét beregnings-entry (hook/komponent), hvis resultat genbruges af PDF/kontrol uden genberegning.

## 3. Input- og output-regler

Input:
- Zod-valideret
- Canonical committed state
- Ingen draft state
- Ingen derived UI-state

Output:
- Deterministisk for givet input
- Runtime-afledt (må ikke persistes som source of truth)
- Tal/datoer i maskinvenlige værdier (ikke locale-formatterede strings)

## 4. Fail-closed krav

Snapshot-/projection-laget ejer statussemantikken. Engines producerer maskinvenlige resultater eller stopper fail-closed ved input-/invariantfejl.

`status: 'fail_closed'` betyder, at autoritativ beregning ikke må bruges. `status: 'error'` kan i nogle domæner stadig have sikre delresultater; domænekontrakten afgør, hvilke projections der må vises, og hvilke outputs der blokeres.

UI må aldrig erstatte manglende autoritativ beregning med fallback-tal.

## 5. Lagdeling

- Section-lokale, rene afledninger placeres i det relevante domæne under `src/domain/<domaene>/`.
- Beregningsmotorer placeres i domænelaget. Det store EO-domæne samler sine mange engines i en `src/domain/erstatningsopgoerelse/engines/`-undermappe; de øvrige (mindre) domæner placerer deres engine flat i domæneroden (fx `renteberegningEngine.ts`, `varigeMenEngine.ts`, `forsoergertabCalculation.ts`). Afgørende er domæne-placeringen og adskillelsen fra selectors/UI — ikke en obligatorisk `engines/`-undermappe i hvert domæne.
- Tværgående/økonomiske beregninger implementeres som dedikerede engines i domænelag, ikke i selectors/UI.
- Selectors må kun vælge/forme allerede beregnede outputs til visning.

## 6. Domæneklassificering (forklarende baseline)

Section-lokale afledninger her betyder beregningsmæssig placering, ikke persistence-ejerskab. Persistence-ejerskab ejes af `src/contracts/domain-boundary-contract.md`.

Section-lokale afledninger:
- `stamdata`
- `aarsloen`
- `satser`

Tværgående engines:
- renter
- tabt arbejdsfortjeneste
- erhvervsevnetab
- samlet erstatningsopgørelse (aggregation)

Støttedomæner i beregningslag:
- periode-opdeling/overlap
- afrunding/præcision
- output-modeller

## 6.1 EET løbende overlap

Løbende EET bruger `computeEetLoebendeYdelser(...)` gennem EET-snapshot/projektioner. UI, PDF og differencekrav må ikke genskabe overlaplogik lokalt. De konkrete EET-regler ejes af `src/contracts/eet-snapshot-contract.md` og EET-domænets tests, ikke af dette tværgående arkitekturdokument.

## 7. Teststrategi (krav)

Engine-tests skal kunne køres uden UI/store/persistence.

Minimum pr. engine:
- Happy path
- Edge cases/grænseværdier
- Afrunding/præcision
- Determinisme (samme input => identisk output)

Forbud i engine-tests:
- Store/context-baseret inputopbygning
- UI helpers/selectors/draft state

## 8. Stop-regel (forklarende)

Kode, der blander beregning med UI/store/persistence, er normalt kontraktbrud efter `form-contract.md`, `domain-boundary-contract.md` og `snapshot-contract.md`, også hvis funktionaliteten ser korrekt ud.

## 9. Beløbsberegning og afrunding

Normative beløbs- og afrundingsregler ejes af `src/contracts/amount-contract.md`. Dette dokument beskriver kun lagdelingen: beregningslaget skal modtage committed, normaliserede talværdier.

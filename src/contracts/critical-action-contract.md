# Kritiske handlinger og commit-barriere

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Underordnet form- og persistence-kontrakterne for deres dataregler; overordnet page-/flow-implementering for klargøring af kritiske handlinger.
**Senest verificeret mod kode:** 2026-07-14

## 1. Scope

Kontrakten gælder handlinger, der aflæser, erstatter eller kan unmount'e committed sagsstate:
Gem, manuel/PWA-indlæsning, sidenavigation, global undo/redo samt **dokument-output (download)**.

Dokument-download er tilføjet af greenfield draft/commit-designet (2026-07-14): et klik på en download-knap er selv en
afslutning af en eventuelt åben editor, og outputtet skal vurderes ud fra den nye *afsluttede* inputtilstand — ikke en
maskeret tidligere gyldig værdi. Se §2 punkt 8 for afgrænsningen mellem coordinatorens ansvar (klargøring af editor/
persistens) og dokumentets eget domænegate-ansvar.

## 2. Normative regler

1. Én `CriticalActionCoordinator` pr. app-runtime er eneste commit-barriere. Felt-, grid- og
   persistence-grænseflader registrerer typede deltagere med symmetrisk lifecycle.
2. Deltagere opdages aldrig gennem DOM-scanning. Klargøring må ikke vente Promise-ticks,
   animation frames eller timeouts; kun deltagerens eksplicitte commit/persistence-kvittering må afventes.
3. Resultatet er diskrimineret: `committed` eller `blocked` med årsag, deltager og fokusmål.
   Exception, afvist promise, låst editor og fejlende commit håndteres fail-closed.
4. Samtidige klargøringer serialiseres. En klargøring må ikke committe samme editor parallelt
   med en anden; samtidigheden i det efterfølgende flow ejes af den konkrete use-case.
5. Handlingspolitikken er:

| Handling | Åben form-editor | Åben grid-editor | Pending tabelpersistens |
|---|---|---|---|
| Gem | commit | commit eller blokér | afvent |
| Manuel/PWA-indlæsning | blokér uden commit | commit eller blokér | afvent |
| Sidenavigation | blokér uden commit | commit eller blokér | afvent |
| Undo/redo | stille blokering uden commit | stille blokering uden commit | afvent |
| Dokument-download | commit | commit eller blokér | afvent |

6. Gem må først læse blokerende fejl og bygge save-snapshot efter `prepare('save')=committed`.
   Load-I/O og navigation må først starte efter deres tilsvarende godkendelse. Et blokeret resultat
   må ikke starte fil-I/O, routeændring, history-restore eller state replacement. **Dokument-download** må først
   læse et nyt `InputSnapshot`, bygge domæneprojektion/dokument-gate og starte generator/fil-I/O efter
   `prepare('download')=committed`; et blokeret eller fejlende resultat må ikke starte generator eller fil-I/O.
7. Klargøring udløser feltets/gridets normale commitvej; den indfører ingen parallel parsing,
   validering eller beregningslogik. Fokus på et blokerende mål sker uden scroll.
8. **Coordinatoren klargør kun editor/persistens — den ejer ikke domænegates.** For dokument-download finaliserer
   coordinatoren en eventuelt åben editor og afventer tabelpersistens, hvorefter *hvert dokument selv* leverer sin
   typed, revisionsbundne preflight/gate (jf. `document-output-contract.md`), og servicegrænsen fail-closer på den.
   Det fælles hjælpe-flow (finalisér editor → læs snapshot → byg gate) må ikke blive en callback-baseret "god function",
   der skjuler domænescope og gør 18 dokumenter ens på papiret men forskellige i praksis.

## 3. Autoritative kilder

- Coordinator, typer og policy: `src/criticalActions/criticalActionCoordinator.ts`.
- App-runtime og React-registrering: `src/criticalActions/CriticalActionContext.tsx`.
- Formdeltagere: `useStyledFieldAdapter` og `StyledTextField`.
- Grid-/pipeline-deltagere: `useGridCoreController` og `useGridRowPersistenceCore`.

## 4. Testkobling

- `src/__tests__/criticalActions/criticalActionCoordinator.test.ts`
- `src/__tests__/criticalActions/CriticalActionContext.test.tsx`
- `src/__tests__/components/layout/MainLayout.navigationCommitGuard.test.tsx`
- `src/__tests__/components/layout/MainLayout.undoRedoEditorGuard.test.tsx`
- `src/__tests__/hooks/useFileSaveLoad.test.tsx`

## 5. Kendte undtagelser

- **Slet alt** (`handleSletAlt` i `useFileSaveLoad.ts`) rutes bevidst IKKE gennem coordinatoren.
  Handlingen destruerer al committed sagsstate og afslutter med en fuld sidegenindlæsning
  (`window.location.href = '/stamdata'`), der uanset omgår SPA-barrieren. En åben, ikke-committet
  editor-draft ville alligevel blive slettet, så en commit-klargøring ville være meningsløs — der er
  derfor ingen datatabsrisiko ved undtagelsen. Handlingen aflæser `document.activeElement` udelukkende
  for at kunne genskabe fokus, hvis brugeren annullerer bekræftelses-dialogen (ikke deltager-opdagelse).

# Kritiske handlinger og commit-barriere

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Underordnet form- og persistence-kontrakterne for deres dataregler; overordnet page-/flow-implementering for klargøring af kritiske handlinger.
**Senest verificeret mod kode:** 2026-07-12

## 1. Scope

Kontrakten gælder handlinger, der aflæser, erstatter eller kan unmount'e committed sagsstate:
Gem, manuel/PWA-indlæsning, sidenavigation samt global undo/redo.

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

6. Gem må først læse blokerende fejl og bygge save-snapshot efter `prepare('save')=committed`.
   Load-I/O og navigation må først starte efter deres tilsvarende godkendelse. Et blokeret resultat
   må ikke starte fil-I/O, routeændring, history-restore eller state replacement.
7. Klargøring udløser feltets/gridets normale commitvej; den indfører ingen parallel parsing,
   validering eller beregningslogik. Fokus på et blokerende mål sker uden scroll.

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

Ingen.

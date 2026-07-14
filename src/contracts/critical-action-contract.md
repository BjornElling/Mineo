# Kritiske handlinger og inputbarriere

**Status:** Normativ målarkitektur
**Type:** Tværgående kontrakt
**Prioritet:** Underordnet form-, persistence- og dokument-output-kontrakterne for deres dataregler.
**Senest verificeret mod kode:** 2026-07-14

## 1. Scope

Kontrakten gælder handlinger, der aflæser, erstatter eller kan unmount'e autoritativ sagsinput:

- Gem,
- manuel/PWA-indlæsning,
- sidenavigation,
- global undo/redo,
- dokument-output.

## 2. Én coordinator

Én `CriticalActionCoordinator` pr. app-runtime er den eneste barriere. Form- og grid-surfaces registrerer typede
deltagere med symmetrisk lifecycle.

- Deltagere opdages aldrig gennem DOM-scanning.
- Coordinatoren må ikke have egen parsing, validering eller persistence.
- Den udløser feltmotorens normale settle/cancel-policy og afventer inputtransaktionens eksplicitte resultat.
- Promise-ticks, animation frames, timeouts og effekter er ikke kvitteringer.
- Samtidige preparations serialiseres, så samme editor ikke finaliseres parallelt.
- Exception, afvist promise, låst editor eller storagefejl håndteres fail-closed med årsag og fokusmål.

## 3. Handlingspolicy

| Handling | Åben form-editor | Åben grid-editor | Pending inputtransaktion |
|---|---|---|---|
| Gem | settle | settle eller blokér | afvent |
| Manuel/PWA-indlæsning | blokér uden settle | settle eller blokér | afvent |
| Sidenavigation | blokér uden settle | settle eller blokér | afvent |
| Undo/redo | stille blokering uden settle | stille blokering uden settle | afvent |
| Dokument-output | settle | settle eller blokér | afvent |

Klargøring må ikke starte fil-I/O, routeændring, history-restore eller dokumentgenerator ved et blokeret resultat.

## 4. Dokument-output og åben editor

Den reaktive dokumentgate læser senest afsluttede input. Mens editoren er åben, ændrer den åbne draft derfor hverken
visning eller gate. En knap kan fortsat være aktiv på baggrund af den tidligere gyldige afsluttede tilstand.

Ved pointerklik sker blur normalt før click. Blur settler synkront og udsteder en ny revision; et relevant fejl-issue
gør straks knappen disabled, så browseren normalt ikke leverer clicket. Korrekthed må ikke afhænge af denne eventorden.

Enhver aktivering, også tastatur/programmatisk og et click der allerede er leveret, følger derfor:

1. finalisér eventuel åben editor gennem normal settle,
2. afvent transaktionens resultat,
3. læs en ny `InputReader`,
4. evaluer dokumentets typed definition,
5. stop før lazy-load, generator og fil-I/O ved blokering,
6. send kun et revisionsbundet `PreparedDocument<T>` videre.

Ved ugyldigt settle bliver knappen visuelt og funktionelt disabled. Hvis aktiveringen allerede nåede preflight, stoppes
handlingen, feltet fokuseres uden scroll, og den eksisterende danske inputadvarsel vises. Dette er defense-in-depth;
normal pointeradfærd skal allerede have opdateret gaten.

Coordinatoren ejer kun editor-/transaktionsklargøring. Dokumentets dependencies, domæneprojektion og output-invariants
ejes af dokumentdefinitionen efter `document-output-contract.md`.

## 5. Friskhed

Efter en vellykket preparation skal consumeren læse et nyt revisionsbundet snapshot. En godkendelse eller projektion
fra en tidligere revision må ikke genbruges.

Async flows kontrollerer revision igen efter lazy-load og umiddelbart før irreversible handlinger. Er revisionen ændret,
evalueres preflight på ny eller handlingen stoppes fail-closed.

## 6. Autoritative grænser

- Coordinator og policy ligger i den fælles critical-action-infrastruktur.
- Felt-editor-state machine og grid-adaptere er registrerede deltagere.
- Inputtransaktionsrunneren ejer settle og storagekvittering.
- Dokumentdefinitionen ejer gate/preflight; dokumentservicen er mekanisk afvikling.

Nuværende `useStyledFieldAdapter`, `useGridCoreController` og `useGridRowPersistenceCore` er migrationsintegrationer,
ikke normative API-navne.

## 7. Kendt undtagelse

`Slet alt` kan fortsat stå uden for coordinatoren, når handlingen efter bekræftelse destruerer hele sagen og udfører en
fuld sidegenindlæsning. En åben draft ville under alle omstændigheder blive slettet; commit-klargøring har derfor ingen
databevarende funktion. Annullering må fortsat genskabe fokus.

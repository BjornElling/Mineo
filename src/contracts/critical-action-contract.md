# Kritiske handlinger og inputbarriere

**Status:** Normativ og gældende
**Type:** Tværgående kontrakt
**Prioritet:** Underordnet form-, persistence- og dokument-output-kontrakterne for deres dataregler.
**Senest verificeret mod kode:** 2026-07-18

## 1. Scope

Kontrakten gælder handlinger, der aflæser, erstatter eller kan unmount'e autoritativ sagsinput:

- Gem,
- manuel/PWA-indlæsning,
- sidenavigation,
- global undo/redo,
- dokument-output.

## 2. Én coordinator

Én `CriticalActionCoordinator` pr. app-runtime er den eneste barriere. Formular- og gridflader registrerer typede
deltagere med symmetrisk lifecycle.

- Deltagere opdages aldrig gennem DOM-scanning.
- Coordinatoren må ikke have egen parsing, validering eller persistence.
- Den udløser feltmotorens normale settle/cancel-policy og afventer inputtransaktionens eksplicitte resultat.
- Promise-ticks, animation frames, timeouts og effekter er ikke kvitteringer.
- Samtidige preparations serialiseres, så samme editor ikke finaliseres parallelt.
- Exception, afvist promise, låst editor eller storagefejl håndteres fail-closed med årsag og fokusmål.
- Autoritativ load/reset/clear udføres gennem coordinatorens replacement-port: apply kører først, og en åben draft
  kasseres kun efter en vellykket transaktion. En preparation alene må aldrig kassere draften.

## 3. Handlingspolicy

Policyen er ens for form- og grid-editoren; korrekthed må aldrig afhænge af browserens blur/click-rækkefølge.

| Handling | Åben editor (form og grid) | Pending inputtransaktion |
|---|---|---|
| Gem | settle først, evaluér derefter frisk input-/settingssnapshot | afvent |
| Dokument-output | settle først, evaluér derefter frisk input-/settingssnapshot | afvent |
| Sidenavigation | settle og fortsæt (også ved fejlende settle) | afvent |
| Manuel/PWA-indlæsning | gennemfør uden settle; den åbne draft må aldrig blokere handlingen | afvent |
| Load, reset og `Slet alt` | gennemfør uden settle; den åbne draft må aldrig blokere handlingen | afvent |
| Undo/redo | stille no-op; den åbne draft ændres ikke | afvent |

Load, reset og `Slet alt` er anderledes end save/navigation, fordi en gennemført handling under alle omstændigheder
erstatter eller sletter det input, draften kunne være blevet til. De må derfor hverken settle, validere eller bevare
draften som en del af handlingen. Ved en handling med bekræftelse/preflight forbliver draften urørt, indtil brugeren
faktisk godkender apply: ved succes bortfalder draften sammen med den erstattede tilstand; ved annullering eller
apply-fejl forbliver både afsluttet input og åben draft uændret.

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
6. send kun et `EvaluationSourceToken`-bundet `PreparedDocument<T>` videre.

Ved ugyldigt settle bliver knappen visuelt og funktionelt disabled. Hvis aktiveringen allerede nåede preflight, stoppes
handlingen, feltet fokuseres uden scroll, og den eksisterende danske inputadvarsel vises. Dette er defense-in-depth;
normal pointeradfærd skal allerede have opdateret gaten.

Coordinatoren ejer kun editor-/transaktionsklargøring. Dokumentets dependencies, domæneprojektion og output-invariants
ejes af dokumentdefinitionen efter `document-output-contract.md`.

## 5. Friskhed

Efter en vellykket preparation skal consumeren læse et snapshot bundet til et nyt `EvaluationSourceToken` (input- +
settingsrevision). En godkendelse eller projektion fra et tidligere token må ikke genbruges.

Async flows genlæser og sammenligner hele tokenet efter lazy-load og umiddelbart før irreversible handlinger. Er enten
input- eller settingsrevisionen ændret, evalueres preflight på ny, eller handlingen stoppes fail-closed.

## 6. Autoritative grænser

- Coordinator og policy ligger i den fælles critical-action-infrastruktur.
- Felt-editor-state machine og grid-adaptere er registrerede deltagere.
- Inputtransaktionsrunneren ejer settle og storagekvittering.
- Dokumentdefinitionen ejer gate/preflight; dokumentservicen er mekanisk afvikling.

Deltager-registreringen sker ét sted: `useFieldEditor`, som både form-fladen (`useFormFieldSurface`) og
grid-fladen (`useGridCellSurface`) bygger på. Navnet er en implementering, ikke et normativt API-navn —
kontrakten binder deltager-ROLLEN, ikke hooket.

De tre navne `useStyledFieldAdapter`, `useGridCoreController` og `useGridRowPersistenceCore` er slettede
forgængere og må ikke genindføres; de står her alene, så en læser af ældre commits kan finde efterfølgeren.

## 7. Reset, `Slet alt` og load — ingen settle

Load, reset og `Slet alt` følger den samme regel (jf. §3): de gennemføres uden settle, den åbne draft blokerer aldrig
handlingen, og draften kasseres først ved en vellykket apply. Det er korrekt netop fordi en gennemført handling under
alle omstændigheder erstatter eller sletter det input, draften kunne være blevet til — commit-klargøring har derfor ingen
databevarende funktion. Annullering (eller apply-fejl) bevarer både afsluttet input og åben draft og genskaber fokus.

Reset/`Slet alt` ejes af `CaseResetOperations`-porten og routes gennem den samme replacement-command som load.
Handlingen afsluttes med en almindelig navigation, ikke med en fuld sidegenindlæsning: en reload ville rive
komponenttræet ned og dermed kræve sidekanaler for at overleve sig selv. Den mekanik findes ikke.
Baseline nulstilles ad den almindelige vej gennem `authoritativeSnapshotEpoch`, som hel-sags-clear selv bumper.

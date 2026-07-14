# Undo/redo-arkitektur

**Status:** Informativ målarkitektur
**Scope:** Global undo/redo for afsluttet sagsinput
**Normative kilder:** `src/contracts/undo-redo-contract.md`, `persistence-contract.md`, `form-contract.md` og
`mineo-field-pattern.md`
**Implementeringsplan:** `docs/architecture/draft-commit-greenfield-design.md`

## Overblik

Undo/redo er en del af den samme inputkerne som settle, rækkecommands og load/reset:

```text
typed inputcommand + FieldRef-origin
                │
                ▼
       ren inputreducer
                │
        ┌───────┴────────┐
        ▼                ▼
 nyt inputaggregate   history-frame
        │                │
        └───────┬────────┘
                ▼
  én verificeret session-envelope
                │
                ▼
 ét observerbart store-write + ny revision
```

History er ikke et lag ved siden af persistence, som forsøger at rekonstruere flere stores. Den fanges og flyttes i
samme transaktion som inputtet.

## Brugeradfærd

| Situation | Adfærd |
|---|---|
| `Ctrl/Cmd+Z` | Undo til seneste inputframe |
| `Ctrl/Cmd+Y` eller `Ctrl/Cmd+Shift+Z` | Redo |
| Tekst-/grid-editor åben | Stille no-op; browserens native tekst-undo forhindres |
| Load/hel-sags-clear | History ryddes efter succesfuld apply |
| Side-/sektionsreset | Almindelig command, som kan fortrydes |
| Save | Ingen history-effekt |

## History-frame

Et frame indeholder kun:

- `PersistedInputState` med canonical sektioner og rejected inputs,
- strukturel `FieldRef`-origin,
- route/fane-oplysninger, der er nødvendige for fokusrestore.

Frame indeholder ikke revision, åbne drafts, issues, gates, beregninger, runtimefejl eller UI-settings. Den aktuelle
runtime-revision er monoton og skabes på ny ved restore.

`past` og `future` har hver en grænse på 50 frames. History er in-memory og skrives hverken til `sessionStorage` eller
`.eo`.

## Capture

Ved en reel command gemmes før-inputtet som historymål i samme store-write som efter-inputtet. Ét settle giver ét frame,
og en no-op giver intet.

Gyldig værdi + rydning af rejection, ny rejection, rækkepromovering og descendant-oprydning er alle dele af den samme
command. Der er derfor intet behov for coalescing, globale pending-markører eller microtasks.

## Restore

Undo/redo bruger den almindelige transaktionsrunner:

1. vælg target uden at flytte historypointer,
2. valider target-input og feltadresser,
3. skriv og verificér den samlede session-envelope,
4. erstat input og flyt historypointer i ét store-write,
5. udsted ny revision,
6. naviger til route/fane og fokusér origin.

Fejler et trin, forbliver input, storage, history, route og fokus i før-tilstand. Issues og domæneprojektioner genafledes
fra den nye revision efter succes.

## Fokus og feltidentitet

Origin er den samme `FieldRef`, som commanden bruger. En tabelcelle identificeres strukturelt af collection, entity og
felt — ikke af kolonneindeks eller en sammenkædet DOM-string.

Fokusmetadata i DOM er en projektion af feltreferencens `focusTarget`. Route-/fane-rendering kan kræve en begrænset
retry efter restore, men retryen finder et allerede kendt strukturelt mål; den gætter ikke origin fra
`document.activeElement`.

Et persisted row-id ændres aldrig for at redde fokus. Eventuelle tidligere fokusmål bæres eksplicit som aliases uden at
ændre dataidentitet, beregning eller persistence.

## Dynamiske tabeller

History behøver ingen særskilt række-draftmodel:

- add/delete/reorder er typed commands,
- første settle i en tom UI-række promoverer række og felt atomisk,
- sletning fjerner række og descendant-rejections i samme frame,
- undo gendanner begge dele fra inputframen,
- hver celle resyncer fra den nye `InputReader`-revision gennem den fælles feltmotor.

Der findes ingen orphan-reconcile eller form-wide row-draft-token i målarkitekturen.

## App-varianter

Mineo og standalone MinProcesrente deler command-, history- og shortcut-kernen. Navigation er en port: Mineo leverer
route-navigation, mens standalone leverer en no-op routeadapter og stadig gendanner input/fokus.

## Migration fra nuværende model

Den eksisterende `undoRedoStore`, separate section-/`invalidDrafts`-/`fieldErrors`-snapshots, epoch/resync-tokens,
focus-tracker-fallback, `rowId:colIndex` og `captureCoalescing` er migrationskilder. De fjernes, når inputaggregate,
strukturelle feltreferencer og fælles transaktionsrunner overtager i ét cut.

Der må ikke etableres en permanent compatibility-facade mellem modellerne.

## Testflade

Målarkitekturen kræver tests for:

- ét frame og én revision pr. reel command,
- ingen frame ved no-op,
- atomisk storage/input/history-rollback,
- restore af både canonical og rejected feltstate,
- ny monoton revision ved undo/redo,
- afledte issues genberegnes og er ikke i frame,
- korrekt strukturelt fokusmål for formular og grid,
- rækkeadd/-sletning inklusive descendant-rejections,
- historygrænser og redo-gren,
- stille no-op mens editor er åben,
- load/hel-sags-clear rydder history, mens side-reset kan fortrydes.

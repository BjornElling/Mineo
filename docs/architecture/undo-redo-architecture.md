# Undo/redo-arkitektur

**Status:** Informativ. Beskriver den gældende arkitektur; bindende regler ligger i `src/contracts/`
**Scope:** Global undo/redo for afsluttet sagsinput
**Normative kilder:** `src/contracts/undo-redo-contract.md`, `persistence-contract.md`, `form-contract.md` og
`mineo-field-pattern.md`
**Baggrund (informativ):** `docs/architecture/input-architecture.md`

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

- `SettledInput` med canonical sektioner og rejected inputs,
- en `HistoryOrigin` – en DISKRIMINERET union med både datamålet og navigationsdestinationen.

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

**Origin har to dele, og de ejes af hver sit lag.** Datamålet er commandens egen strukturelle `FieldAddress`; en
tabelcelle identificeres af collection, entity og felt – ikke af kolonneindeks eller en sammenkædet DOM-string.
Navigationsdestinationen er `editorLocationId` + `route` + `tabKey`, altså den EDITOR, ændringen kom fra:

```ts
type FieldHistoryOrigin      = { kind: 'field'; field: FieldAddress } & OriginDestination;
type CollectionHistoryOrigin = { kind: 'collection'; collection: string } & RequiredOriginDestination;
```

Delingen er load-bearing og ikke kosmetisk. **Fokusmålet er IKKE en egenskab ved feltdefinitionen** (der findes
ingen `focusTarget` på en `FieldRef`): samme datafelt kan redigeres på flere sider og i flere faner, så en global
standard på descriptoren ville pege det forkerte sted. Editoren bærer i stedet sin egen destination i DOM
(`buildRestoreTargetAttributes`), og `lookupEditorLocation` skelner MOUNTET fra SYNLIG, fordi EO's faner
forbliver mountet efter første besøg.

To ting er urepræsenterbare frem for bevogtede:

- **En `tabKey` uden `route`** – unionen tillader ikke kombinationen, fordi restoren kun aktiverer fanen inde i
  `route !== undefined`-grenen, så en fane uden route ville være lydløst inert.
- **En strukturel rækkehandling uden destination** – `CollectionHistoryOrigin` KRÆVER route + fane i selve
  kernetypen, ikke kun i surface-hooken. Uden en feltadresse er destinationen det eneste, restoren har at gå
  efter, og en undo, der gendannede data og efterlod brugeren på en vilkårlig side, ville være ubrugelig.

Route-/fane-rendering kan kræve en begrænset retry efter restore, men retryen finder et allerede kendt
strukturelt mål; den gætter ikke origin fra `document.activeElement`.

Et persisted row-id ændres aldrig for at redde fokus. En placeholders identitet BEVARES derimod, når rækken
promoveres, så den genindtræder, hvis rækken fjernes igen (`placeholderSlots.ts`) – dataidentitet, beregning og
persistence er upåvirkede.

## Dynamiske tabeller

History behøver ingen særskilt række-draftmodel:

- add/delete/reorder er typed commands,
- første settle i en tom UI-række promoverer række og felt atomisk,
- sletning fjerner række og descendant-rejections i samme frame,
- undo gendanner begge dele fra inputframen,
- hver celle resyncer fra den nye `InputReader`-revision gennem den fælles feltmotor.

Der findes ingen orphan-reconcile eller form-wide row-draft-token.

## App-varianter

Mineo og standalone MinProcesrente deler command-, history- og shortcut-kernen. Navigation er en port: Mineo leverer
route-navigation, mens standalone leverer en no-op routeadapter og stadig gendanner input/fokus.

## Én model, ingen facade

Inputaggregatet, de strukturelle feltreferencer og den fælles transaktionsrunner er den ene model. Der findes
ingen `undoRedoStore`, ingen separate section-/rejected-/fejlsnapshots, ingen epoch- eller resync-tokens, ingen
focus-tracker-fallback, intet `rowId:colIndex` som identitet og ingen `captureCoalescing`. Der må heller ikke
etableres en intern compatibility-facade, der genindfører nogen af dem. Det er en intern runtime-regel og må ikke
forveksles med de eksplicitte persistensadaptere, der skal holde tidligere `.eo`-filer indlæselige.

## Testflade

Arkitekturen er dækket af tests for:

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

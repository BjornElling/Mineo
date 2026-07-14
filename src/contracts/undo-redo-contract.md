# Mineo – Undo/redo-kontrakt

**Status:** Normativ målarkitektur
**Type:** Tværgående kontrakt  
**Prioritet:** Underordnet `form-contract.md` og `persistence-contract.md`; overordnet
`docs/architecture/undo-redo-architecture.md`.
**Senest verificeret mod kode:** 2026-07-14

## 1. Scope

Undo/redo omfatter kun autoritativ inputdata:

- canonical sektioner,
- rejected inputs,
- fokus-origin som strukturel `FieldRef`.

Det omfatter ikke åbne drafts, afledte issues, gates, beregninger, browserens native tekst-history, AppSettings,
`.eo`-filer eller selve `sessionStorage`-envelopen. History er runtime-only og persisteres aldrig.

Indtil fase 5 har erstattet komponentrapporterede `fieldErrors` med rene validatorer, bærer hvert frame desuden et
midlertidigt kompatibilitetssnapshot af disse fejl. Det gendannes i samme Zustand-write som inputtet, så en restore
aldrig åbner save-/dokumentgates mellem inputskiftet og en senere React-effekt. Snapshotfeltet slettes i fase 5 og er
ikke sagsinput.

## 2. Keyboard-adfærd

Når en tekst- eller grid-editor er åben, er Mineos globale undo/redo et stille no-op, og browserens native tekst-undo
forhindres, så draften ikke kan ændres uden om editor-state machine.

Når editoren er lukket:

- `Ctrl/Cmd+Z` udfører undo,
- `Ctrl/Cmd+Y` og `Ctrl/Cmd+Shift+Z` udfører redo.

Editorstatus og pending persistence kommer fra den registrerede kritiske handlingsbarriere, ikke DOM-scanning eller
timing-vent.

## 3. Capture

History ligger i samme runtime-store som inputaggregaten. En reel inputtransaktion:

1. bygger før- og eftertilstand,
2. skriver/verificerer sessionenvelopen,
3. opdaterer input og history i samme Zustand-write,
4. stiger inputrevisionen præcis én gang.

Ét settle eller immediate commit giver højst ét history-trin, uanset om handlingen skriver canonical værdi, rejected
input eller begge dele. No-op giver intet trin. Separate writes må ikke efterfølgende coalesces med globale markører,
microtasks eller timeouts.

En strukturel command, fx rækkesletning, fanger hele den atomiske ændring inklusive descendant-rejections i samme frame.

## 4. Restore

Undo/redo er commands gennem samme transaktionsrunner som øvrige inputændringer.

Restore skal:

1. vælge target-framet uden at mutere history,
2. validere target-input og alle feltadresser,
3. skrive/verificere den samlede session-envelope med rollback,
4. erstatte input og flytte history-pointeren i ét observerbart store-write,
5. skabe en ny monoton inputrevision,
6. navigere og fokusere efter succes.

Revisionen fra et gammelt frame gendannes aldrig. Afledte issues, projektioner og gates genberegnes fra den nye
revision. Fejler restore, forbliver input, storage, history, route og fokus uændret.

## 5. Feltidentitet og fokus-origin

History-origin er en strukturel `FieldRef`, jf. `mineo-field-pattern.md`.

- Hver command-kørsel modtager sin origin eksplicit sammen med commanden; origin er runner-metadata og må ikke udledes
  af DOM-fokus eller pakkes ind i den rene reducercommand.
- Tabelceller identificeres af collection/entity/felt, aldrig `rowId:colIndex`.
- DOM-attributter er kun fokusmål projekteret fra feltreferencen.
- Et stabilt persisted row-id omskrives ikke for fokusrestore.
- Et nødvendigt tidligere fokusmål bæres som eksplicit aliasmetadata og må ikke ændre dataidentiteten.
- Transiente UI-felter deltager ikke i global history.

Fallback til det element, der tilfældigvis har DOM-fokus efter blur, er ikke en korrekt identitetskilde.

## 6. Autoritative replacements

Succesfuld load, hel-sags-clear og migrations-recovery rydder undo/redo efter apply. Ejeransvaret ligger i den fælles
replace-command og må ikke duplikeres i load-callsites.

En side-/sektionsreset er derimod en normal command og kan fortrydes, medmindre en mere specifik godkendt produktregel
siger andet. Save ændrer ikke history.

## 7. Afledt state

Issues og runtimefejl gemmes ikke i history. Når input gendannes, udledes de på ny fra `InputReader`, feltdefinitioner
og domænevalidatorer. Det fjerner mount-, reporter- og cleanup-afhængighed fra restore-flowet.

## 8. Memory-bound

Mineo bevarer højst 50 undo- og 50 redo-trin. Grænserne er brugersemantik og må ikke ændres uden godkendelse, fordi en
ændring kan fjerne forventede redo-muligheder.

## 9. Migrationsregel

Separate section-/rejected-/field-error-snapshots, `captureValueCommit`, `captureCoalescing`, microtask-markører,
form-wide resync-tokens og stringbaserede fokuspaths er overgangsmekanismer og skal fjernes. De må ikke udvides som ny
history-arkitektur.

# Mineo – Undo/redo-kontrakt

**Status:** Normativ og gældende
**Type:** Tværgående kontrakt  
**Prioritet:** Underordnet `form-contract.md` og `persistence-contract.md`; overordnet
`docs/architecture/undo-redo-architecture.md`.
**Senest verificeret mod kode:** 2026-08-07

## 1. Scope

Undo/redo omfatter kun autoritativ inputdata:

- canonical sektioner,
- rejected inputs,
- fokus-origin som strukturel `FieldRef` kombineret med den konkrete editors eksplicitte fokusmål.

Det omfatter ikke åbne drafts, afledte issues, gates, beregninger, browserens native tekst-history, AppSettings,
`.eo`-filer eller selve `sessionStorage`-envelopen. History er runtime-only og persisteres aldrig.

Et frame bærer INTET fejlsnapshot. Det midlertidige `fieldErrors`-kompatibilitetsfelt er fjernet sammen med den
komponentrapporterede fejlmodel: issues er nu rene afledninger af den gendannede revision, så de kan ikke drifte
fra inputtet. `InputHistoryFrame` er derfor præcis `{ input, origin? }`.

Fokus-origin er en DISKRIMINERET union, så de to slags commits ikke kan forveksles:

- `kind: 'field'` — et felt-/celle-commit. Feltadressen er OBLIGATORISK; restoren fokuserer præcis den
  editorlokation, ændringen kom fra.
- `kind: 'collection'` — en strukturel rækkehandling (insert/delete/reorder). Den har intet enkelt felt at
  fokusere, men bærer collectionen og en obligatorisk destination (`route`/`tabKey`), så en restore navigerer til
  den tabel, ændringen kom fra.

Unionen gør to fejl urepræsenterbare: et feltcommit uden adresse, og en rækkehandling uden destination. Begge var
tidligere blot valgfrie felter på én fælles type.

## 2. Keyboard-adfærd

Når en tekst- eller grid-editor er åben, er Mineos globale undo/redo et stille no-op, og browserens native tekst-undo
forhindres, så draften ikke kan ændres uden om felt-editoren.

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

History-origin er en strukturel `FieldRef` kombineret med den konkrete editors eksplicitte fokusmål, jf.
`mineo-field-pattern.md`.

- Hver command-kørsel modtager sin origin eksplicit sammen med commanden; origin er runner-metadata og må ikke udledes
  af DOM-fokus eller pakkes ind i den rene reducercommand.
- Tabelceller identificeres af collection/entity/felt, aldrig `rowId:colIndex`.
- DOM-attributter er kun fokusmål projekteret fra feltreferencen.
- Samme datafelt kan have flere editorlokationer; route/fane er derfor origin-metadata og aldrig én global egenskab på
  feltdefinitionen.
- Et stabilt persisted row-id omskrives ikke for fokusrestore.
- Transiente UI-felter deltager ikke i global history.
- **En endnu ikke oprettet rækkes identitet (placeholder-rækken) SKAL være en ren funktion af den aktuelle
  committede tilstand — aldrig af vejen derhen.** Undo/redo er en tidsmaskine: samme committede tilstand nås
  forfra, bagfra og forfra igen, og en origin, der peger på et placeholder-id, findes kun, hvis fladen viser
  samme identitet, hver gang den samme tilstand er aktuel. En flade må derfor ikke huske identiteten i en
  hukommelse, der kan glemme (eller genmønte) et id, history stadig kan pege på. Ejerskabet ligger i
  `usePlaceholderSlotIds`, hvis id-sekvens er append-only per konstruktion.

Fallback til det element, der tilfældigvis har DOM-fokus efter blur, er ikke en korrekt identitetskilde.

**En felt-origin, hvis fokusmål aldrig kan findes, er et brud på denne kontrakt, ikke et normalt udfald.** Efter
en gennemført restore er originens tilstand aktuel igen, så dens editorlokation skal eksistere i DOM. Den fælles
restore-løkke opgiver derfor ikke længere tavst: opbruges forsøgene, uden at brugeren selv har flyttet fokus,
rapporteres den brudte invariant høj-lydt i udvikling (jf. console-politikken) og tavst i produktion, hvor
manglende fokus er en skavank og ikke må blive til en fejlskærm.

## 6. Autoritative replacements

Succesfuld load og hel-sags-clear rydder undo/redo efter apply. Recovery fra en korrupt current-session sker kun gennem
brugerens eksplicitte `Slet alt` og følger samme clear-regel. Ejeransvaret ligger i den fælles
replace-command og må ikke duplikeres i load-callsites.

En side-/sektionsreset er derimod en normal command og kan fortrydes, medmindre en mere specifik godkendt produktregel
siger andet. Save ændrer ikke history.

## 7. Afledt state

Issues og runtimefejl gemmes ikke i history. Når input gendannes, udledes de på ny fra `InputReader`, feltdescriptors
og domænevalidatorer. Det fjerner mount-, reporter- og cleanup-afhængighed fra restore-flowet.

## 8. Memory-bound

Mineo bevarer højst 50 undo- og 50 redo-trin. Grænserne er brugersemantik og må ikke ændres uden godkendelse, fordi en
ændring kan fjerne forventede redo-muligheder.

## 9. Fraværsregel

Separate section-/rejected-/field-error-snapshots, `captureValueCommit`, `captureCoalescing`, microtask-markører,
form-wide resync-tokens og stringbaserede fokuspaths **findes ikke** i history-arkitekturen. De navngives her som et
fraværsværn: ingen af dem må genindføres, og ingen ny mekanisme må bygges på deres form.

Fraværet er maskinelt efterprøvet: `deletionLedger.test.ts` beviser det fysiske fravær og selvtester, at beviset
ikke er vakuøst, mens `legacy/forbidden-identifier` spærrer navnene som identifiers.

# Mineo - Undo/redo-kontrakt

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Prioritet:** Underordnet `form-contract.md` og `persistence-contract.md`; overordnet `docs/architecture/undo-redo-architecture.md`.  
**Senest verificeret mod kode:** 2026-06-10

Denne kontrakt fastlægger de trust-kritiske grænser for global undo/redo (history-stak `MAX_HISTORY_STEPS = 50` pr. retning, jf. `src/stores/undoRedoStore.ts`). Arkitekturdokumentet må forklare implementationen, men må ikke eje afvigende regler.

---

## 1. Scope

Undo/redo omfatter Mineos committed, schema-validerede sagsinput, den persisterede `invalidDrafts`-recovery-kanal (committed rå draft, jf. `form-contract.md` §2.4) og runtime-only feltfejl, der hører til den committed tilstand.

Undo/redo omfatter ikke:

1. åben draft-state,
2. browserens native tekst-undo,
3. `.eo`-filer,
4. `sessionStorage` som history-lager,
5. device-lokale AppSettings.

History-stakken er runtime-only og må aldrig persisteres.

---

## 2. Keyboard-adfærd

Når en tekstinput-editor eller grid-celle-editor er åben, er Mineos undo/redo-genvej et stille no-op.

`MainLayout` skal stadig forhindre browserens native tekst-undo i dette tilfælde, så ucommitted draft ikke ændres uden om Mineos commit-flow.

Når editor er lukket:

1. `Ctrl+Z` / `Cmd+Z` udløser undo.
2. `Ctrl+Y` / `Cmd+Y` udløser redo.
3. `Ctrl+Shift+Z` / `Cmd+Shift+Z` udløser redo.

---

## 3. Capture

History capture sker før en committed ændring anvendes på `formPersistenceStore`.

Capture må kun ske for reelle commits. No-op commits må ikke oprette history-frames.

Capture, storage-write og store-commit skal behandles som én logisk transaktion. Ved fejl skal:

1. `formPersistenceStore`,
2. `sessionStorage`,
3. undo/redo-stakken

stå i før-tilstand.

---

## 4. Restore

Undo/redo-restore er et autoritativt replace-event.

Restore skal:

1. skrive target-sektioner til `sessionStorage` med rollback,
2. gendanne `formPersistenceStore` atomisk,
3. først derefter committe history-stack-transitionen,
4. bumpe den autoritative snapshot-epoch, så row-drafts resynkroniseres,
5. navigere/fokusere brugeren efter succesfuld restore.

Hvis restore fejler, må navigation og fokus-restore ikke ske.

Restore sker før navigation. Det korte mellemrender-vindue er accepteret; komponenter og beregninger må derfor ikke have side-effects ved render/mount.

---

## 4A. Felt-identitet (forudsætning for korrekt fokus-restore)

> **Normativt hjem:** Selve felt-identitets-API'et (`fieldPath`, `name`-prop og dens projektion til `data-mineo-undo-field-path`) ejes normativt af `mineo-field-pattern.md` (afsnittet "Felt-identitets-API"). Undo/redo er **forbrugeren**: denne kontrakt fastlægger, at felt-identiteten er en bindende forudsætning for fokus-restore, men de underliggende regler for, hvordan felter bærer identitet, hører hjemme i felt-mønstret. Reglerne gentages her for læsbarhed; ved tvivl gælder felt-mønstret.

Fokus-restore i §4 trin 5 er kun korrekt, hvis hvert commit bærer den ændrede værdis identitet. Dette er en trust-kritisk invariant, ikke en bekvemmelighed: lander fokus efter undo på det forkerte felt, fremstår programmet upålideligt. Reglerne er:

1. **Hvert commit skal sende `fieldPath`.** Den der committer en ændring til `formPersistenceStore`, skal sende ændringens identitet med (`setValues(..., { fieldPath })`). Uden den falder `createUndoOrigin` (`usePersistedForm`) tilbage på focus-trackeren, som ved blur peger på det *næste* fokuserede felt — og undo lander så fokus forkert. For tabelceller er identiteten `rowId:colIndex`.
2. **Persisterede felter skal bære `name`-prop.** Både immediate-commit-widgets (toggle/dropdown/radio) og blur-commit-felter (dato/beløb/tekst/percent/year/integer/week/fraction) skal have en `name`-prop lig feltnøglen. Den projiceres til `data-mineo-undo-field-path` på det fokuserbare DOM-element, så fokus-restore kan finde målet. For celle-dropdowns skal identiteten sidde på den fokuserbare combobox-trigger, ikke på et skjult native `<input>`.
3. **Transiente felter deltager ikke.** Felter der kun skriver til lokal React-state og aldrig committer til persisteret state (fx løntrin-finder, sygedagpenge-indsæt), bærer hverken `name` eller `fieldPath` og indgår ikke i undo/redo.

Disse regler håndhæves af `src/__tests__/quality/immediateCommitWidgetUndoName.test.ts` (felt mangler `name`) og regressionstesten `src/__tests__/hooks/undoRedoBlurCommitFocus.test.tsx`. Den underliggende felt-API ejes af `form-contract.md` og `mineo-field-pattern.md`; denne kontrakt fastlægger, at felt-identiteten er en bindende forudsætning for fokus-restore.

---

## 5. Autoritative Replacements

Load, reset, migration og andre hel-sags-replacements rydder undo/redo-stakken efter succesfuld apply.

`replaceAllPersistedData(...)` er den canonical ejer af history-clear for autoritative replacements. Load-utilities må ikke duplikere samme clear som en separat policy.

En per-side nulstilling ("Slet alle indtastninger" → `clearPageData`/`resetForm`) er bevidst IKKE en autoritativ replace: den bevarer undo/redo-stakken, så nulstillingen selv kan fortrydes med undo (jf. JSDoc i `usePersistedForm.resetForm` og regressionstest i `usePersistedForm.test.tsx`).

Save påvirker ikke history-stakken.

---

## 6. Feltfejl og Invalid Draft

Undo/redo må gendanne runtime-only feltfejl som del af history-framet.

Den persisterede `invalidDrafts`-kanal (committed rå draft) indgår i history-framet på linje med committed sektioner: capture snapshotter den, og restore gendanner den atomisk sammen med sektioner og `sessionStorage`. Det er denne mekanisme — ikke et separat draft-transportlag — der genskaber brugerens sidste ikke-committbare input efter undo/redo. `invalidDrafts` ejes normativt af `form-contract.md` §2.4 / `persistence-contract.md` og må aldrig persisteres i `.eo`.

Oprydning af en FORÆLDRELØS celle-draft (en slettet rækkes/rowScopes draft, jf. `persistence-contract.md` §11 punkt 7) er housekeeping og fanger **ingen** history-frame: den slettede rækkes egen sletnings-frame bærer allerede draften, så undo af sletningen gendanner både rækken og dens draft. Dette er på linje med §3's regel om, at kun reelle commits opretter frames.

---

## 7. Memory-bound

Mineo bevarer op til 50 undo-trin og op til 50 redo-trin. Det betyder et praktisk maksimum på 100 fulde runtime-snapshots i hukommelsen.

Dette er en bevidst brugersemantik: en fælles totalgrænse må ikke indføres uden eksplicit beslutning, fordi den kan fjerne forventede redo-muligheder efter en lang undo-sekvens.

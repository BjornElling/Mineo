# Mineo - Undo/redo-kontrakt

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Prioritet:** Underordnet `form-contract.md` og `persistence-contract.md`; overordnet `docs/architecture/undo-redo-architecture.md`.  
**Senest verificeret mod kode:** 2026-06-10

Denne kontrakt fastlægger de trust-kritiske grænser for global undo/redo. Arkitekturdokumentet må forklare implementationen, men må ikke eje afvigende regler.

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

## 5. Autoritative Replacements

Load, reset, migration og andre hel-sags-replacements rydder undo/redo-stakken efter succesfuld apply.

`replaceAllPersistedData(...)` er den canonical ejer af history-clear for autoritative replacements. Load-utilities må ikke duplikere samme clear som en separat policy.

Save påvirker ikke history-stakken.

---

## 6. Feltfejl og Invalid Draft

Undo/redo må gendanne runtime-only feltfejl som del af history-framet.

Den persisterede `invalidDrafts`-kanal (committed rå draft) indgår i history-framet på linje med committed sektioner: capture snapshotter den, og restore gendanner den atomisk sammen med sektioner og `sessionStorage`. Det er denne mekanisme — ikke et separat draft-transportlag — der genskaber brugerens sidste ikke-committbare input efter undo/redo. `invalidDrafts` ejes normativt af `form-contract.md` §2.4 / `persistence-contract.md` og må aldrig persisteres i `.eo`.

---

## 7. Memory-bound

Mineo bevarer op til 50 undo-trin og op til 50 redo-trin. Det betyder et praktisk maksimum på 100 fulde runtime-snapshots i hukommelsen.

Dette er en bevidst brugersemantik: en fælles totalgrænse må ikke indføres uden eksplicit beslutning, fordi den kan fjerne forventede redo-muligheder efter en lang undo-sekvens.

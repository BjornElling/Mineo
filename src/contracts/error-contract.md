# Mineo – Error- og kontrolkontrakt

**Status:** Normativ målarkitektur
**Type:** Tværgående kontrakt
**Senest verificeret mod kode:** 2026-07-16

Kontrakten skelner mellem forventelige input-/domæneissues og systemtekniske runtimefejl. Afledelige issues er rene
projektioner af input og domæneregler; de er ikke en skrivbar runtime-store.

## 1. Issue-model

Et issue skal mindst kunne bære:

- strukturel `FieldRef` eller et eksplicit output-/systemmål,
- stabil maskinlæsbar `code`,
- `reason`,
- `severity: 'error' | 'warning'`,
- deterministisk dansk besked,
- eventuel domænedetalje.

Et issue bærer **ingen** `blocksSave`- eller `blocksProjection`-boolean. Konsekvensen udledes strukturelt af issuets
klasse, dets placering og consumerens faktiske reads (§ konsekvensmodellen nedenfor og `form-contract.md` §8) — den er
aldrig et konfigurerbart flag per issue.

Der findes tre issue-klasser:

- **feltfejl** (rød): vises med rød kant + tooltip på feltet, blokerer `.eo` globalt og enhver afhængig consumer,
- **consumerfejl** (fx `missing`): ingen rød markering; vises i contentboxen og blokerer kun den konkrete consumer,
- **warning**: vises, men blokerer aldrig beregning, dokument eller `.eo`.

Normative årsager:

- `invalid` — feltets afsluttede input er rejected på grund af syntaks (`format`) eller et aktivt commit-interval
  (`range`); altid en **feltfejl**,
- `range`/`bounds` — canonical værdi ligger uden for konkrete grænser; en **feltfejl**,
- `schema` — runtime-schema kan ikke opfyldes; en **feltfejl**,
- `rule` — en feltplaceret domæneregel er brudt; en **feltfejl** (en output-/tværgående regel kan i stedet være en
  consumerfejl),
- `missing` — en consumer kræver et tomt canonical felt; altid en **consumerfejl**, aldrig en rød feltfejl og aldrig
  save-blokerende.

Tekniske runtimefejl er ikke inputissues og følger §8.

### 1.1 Konsekvensmatrix (normativ)

Konsekvensen er deterministisk og følger af klassen — ikke af et flag:

| Tilstand | Rød feltmarkering | Blokerer `.eo` globalt | Blokerer afhængig beregning/dokument | Blokerer uafhængig consumer |
|---|---:|---:|---:|---:|
| Ugyldigt format | Ja | Ja | Ja | Nej |
| Range/bounds-fejl | Ja | Ja | Ja | Nej |
| Anden feltplaceret error (schema/rule) | Ja | Ja | Ja | Nej |
| Tomt felt / `missing` | Nej | Nej | Ja, hvis consumeren kræver feltet | Nej |
| Warning | Nej | Nej | Nej | Nej |

Kun tooltip-/contentboxteksten varierer mellem de røde feltfejl. Matrixen må ikke omgås af et `blocksSave`- eller
`blocksProjection`-flag.

## 2. Ren afledning og ejerskab

Issues bygges af rene funktioner fra:

- `InputReader`,
- feltets definition/codec,
- domænevalidatorer og snapshots,
- relevante AppSettings.

Der findes ingen central skrivbar `fieldErrors`-bus i slutarkitekturen. Komponenter må ikke sætte/rydde domæneissues
ved mount, effect eller unmount. Samme afsluttede input skal give samme issues uanset route, aktiv tab og mount-strategi.

Issues persisteres hverken i `.eo`, `sessionStorage` eller history. De genafledes efter load, reset og undo/redo.

En projektion bærer sine relevante issues i både `ready`- og `blocked`-grenen. Blockers er en kontekstafhængig
delmængde: samme feltfejl kan gøre én consumer uanvendelig, mens en uafhængig consumer forbliver `ready`.
Beregningsblokering lagres derfor ikke som et flag på issueet, men følger af hvilke refs consumeren faktisk læser.

`.eo`-save-gaten er uniform: **enhver aktiv rød feltfejl blokerer `.eo` globalt**, uanset reason (format, range, bounds,
schema, feltplaceret rule). `missing` og warnings blokerer aldrig `.eo`. Dokument-/beregningspolicy er dependency-
specifik: et relevant `error` (feltfejl eller consumerfejl på et læst felt) blokerer den konkrete consumer; en warning
blokerer aldrig.

Eksisterende `fieldErrors`, `useFormFieldErrorReporter`, `onFieldError` og tabeltrackere er migrationskode. De må ikke
bruges som ny sandhedskilde eller kopieres til nye områder.

## 3. Feltidentitet og beskeder

Feltidentitet kommer fra `FieldRef`; dynamiske felter bruger typed builders. Frie string keys, label-parsing og
kolonneindeks som identitet er forbudt.

Sondringen mellem `missing` og `invalid` afgøres af consumeren:

- tom canonical værdi kan være `missing`, hvis consumeren kræver den,
- ikke-tom rejected tekst er `invalid`.

En syntaktisk parsebar tal-, år- eller ugeværdi uden for feltets aktive commit-interval er `invalid`, ikke et canonical
`range`-/`bounds`-issue. Kronologiske datobounds og tværgående domæneregler kan fortsat være canonical issues, når den
relevante specifikke kontrakt foreskriver det.

De godkendte beskedskabeloner er:

| Årsag | Kontroltype | Skabelon |
|---|---|---|
| `missing` | Tekst-/talfelt | `Feltet <navn> er ikke udfyldt` |
| `missing` | Dropdown/valg | `<navn> er ikke valgt` |
| `missing` | Toggle/radio | `<navn> er ikke angivet` |
| `invalid` | Alle | `Der er udfyldt en ugyldig værdi i feltet <navn>` |
| `range`/`bounds` | Alle | Domænets konkrete intervaltekst med relevante grænser |

Kontroltype og label kommer fra feltdefinitionen. Et bart `<felt> mangler` er forbudt.

## 4. Prioritet og visning

Hvis flere issues rammer samme felt, vælger en central deterministisk resolver højst ét aktivt feltissue. Prioritet
defineres eksplicit efter severity og reason/source med stabil `code` som tie-break; komponentrækkefølge eller seneste
reporter må aldrig påvirke den.

Ugyldigt input vises med rød kant og tooltip ved hover. Ingen inline-valideringstekst vises under feltet. Range- og
datotooltips skal vise konkrete grænser. Hvis `min > max`, forklarer tooltippen, at ingen gyldige værdier findes, viser
begge grænser og navngiver de brugervendte input, der skabte dem.

Kontrolvisninger må gruppere alle relevante issues, men må ikke gætte fra beskedtekst. Links skal bruge issueets
strukturelle fokusmål. Henvises til en anden side, er kun sidens navn klikbart.

## 5. Konsekvens for save, beregning og dokumenter

- En projektion kalder ikke beregningsmotoren, hvis et afhængigt issue gør input uanvendeligt.
- `.eo`-save blokeres uniformt af **enhver aktiv rød feltfejl** i sagen, uanset reason (format, range, bounds, schema,
  feltplaceret rule) og uanset repræsentation (rejected råtekst eller canonical værdi med afledt rødt issue). `missing`
  og warnings blokerer aldrig save.
- Ethvert dokumentrelevant issue med `severity: 'error'` blokerer dokument-output, også `range`/`bounds`.
- Dokumentknappen er både visuelt og funktionelt disabled på den senest afsluttede blokerede revision.
- En åben draft ændrer ikke issues eller gate; settle skifter input og afledte issues atomisk til en ny revision.

Dokumentafhængighed udledes af dokumentdefinitionens feltdependencies. Et issue bærer ikke et manuelt global/sektion/
row-scope, der kan drifte fra datarelationen.

## 6. Kontrolvisninger

Kontrolvisninger modtager færdige issue-projektioner. De må:

- vise aktivt issue pr. felt,
- vise alle issues grupperet efter severity/reason,
- tilføje domænenær, målrettet tekst og parent-child-suppression.

De må ikke genvalidere rå sektioner, læse komponentlokal fejlstate eller vedligeholde en parallel issue-store.

## 7. `BugReportButton`

`BugReportButton` er kun til systemtekniske runtimefejl.

Tilladte placeringer:

- `ErrorFallback`,
- `DevtoolsIssueNotice`,
- fil-load-preflight som betinget ekstra handling ved en faktisk teknisk loadfejl.

Forbudte placeringer:

- normale input-, beregnings- og resultatvisninger,
- EOInspektion/EOKontrolTabel,
- normale validerings- eller downloadblokeringer,
- download-fejldialoger.

Snapshot-issues må vise en neutral systemfejlrække, men ikke en inline `BugReportButton`. Rapportering går gennem det
centrale devtools-/systemissue-flow.

## 8. Systemtekniske runtimefejl

Uventede fejl efter en godkendt projektion, fx generatorfejl, routes gennem `reportSystemIssue(...)` og skal mindst
bære:

- schemaVersion,
- stabil kind/code og severity,
- kort dansk `userMessage`,
- teknisk area/context/route,
- UTC-timestamp,
- revision, når en revisionsbundet operation findes,
- nødvendig, sanitiseret evidence/diagnostics.

Persondata må ikke lægges i payloads. `console.error` bruges kun til reelle systemfejl og driver devtools-monitoren;
normal drift er console-tavs.

Dokumentgeneratorfejl er systemfejl: ingen fil downloades, ingen normal valideringsdialog oprettes, og brugeren får
ikke en `BugReportButton` i downloadflowet. Alle forhold, som kan forklares som input-/domæneissues, skal allerede have
disabled knappen og stoppet preflight.

## 9. EO-specifik kontrolvisning

EO's række-evalueringsmotor og issue-katalog er de domænenære kilder til fejl/advarsler på Beregning-fanen. De må ikke
redefinere den tværgående dokumentgate.

Regler:

1. Hver EO-fejl/advarsel er kort, specifik og selvstændig uden `Label:`-præfiks.
2. Navigation bruger strukturelt felt-/cellemål og sætter både route og inputfane ved links ud af EO.
3. Parent-child-suppression følger en deterministisk dependency-graf, ikke beskedordlyd.
4. Fokusfelt i perioder kommer fra strukturelt hint, ikke heuristik over dansk tekst.
5. Manglende datoer er forventelige inputissues, ikke runtimefejl.
6. EOInspektion og EOKontrolTabel kan fortsat dannes fra sikre snapshotdata; de må ikke lave fallback-enginekald for at
   udfylde output efter en blokeret autoritativ beregning.
7. Når `inspektionSnapshot` er `null`, vises en tom-/fejltilstand uden beregningsindhold.

EO-kontroltabeller bruger etablerede tabeltyper; `StandardDisplayTable` er canonical for rene visningstabeller og har
centralt styret samlet bredde på 100 %.

`fail_closed` med `schema_guard` eller `invariant_guard` vises som en neutral blokerende række uden
`BugReportButton`. `runtime_exception` rapporteres gennem systemissue-flowet og må højst give samme neutrale inline
række. De to kendte interne EO-invarianter `control:sammentaelling_mismatch` og
`taf_per_year:afrunding_over_100` må både vises som systemfejlrækker i EOBeregningTab og rapporteres til
devtools-monitoren; knappen til fejlrapportering findes fortsat kun i `DevtoolsIssueNotice`.

## 10. Tidsstempler og tidszone

Systemlogs gemmer canonical instants som UTC ISO 8601 via `getTimestamp()`. Alt tidsoutput, der vises til bruger eller
udvikler, formateres i `Europe/Copenhagen` via de kanoniske dato-/tidshelpers. Dette omfatter fejlrapport, devtools-
notice og rapport-/skærmprintfilnavne.

## 11. Migrationsregel

Den nuværende reporter-/store-model må kun fungere som midlertidig adapter frem til den rene issueprojektion er
migreret. Den må ikke føre til nye source-registre, cleanup-effects, syntetiske `invalid-draft`-entries eller
mount-afhængige dokumentgates.

# Mineo – Error- og kontrolkontrakt

**Status:** Normativ og gældende
**Type:** Tværgående kontrakt
**Senest verificeret mod kode:** 2026-08-09

Kontrakten skelner mellem forventelige input-/domæneissues og systemtekniske runtimefejl. Afledelige issues er rene
projektioner af input og domæneregler; de er ikke en skrivbar runtime-store.

## 1. Issue-model

Et issue skal mindst kunne bære:

- strukturel `FieldRef` eller et eksplicit output-/systemmål,
- stabil maskinlæsbar `code`,
- `reason`,
- `severity`, som på et kerneissue altid er literalen `'error'` (se §4),
- deterministisk dansk besked,
- eventuel domænedetalje.

Et issue bærer **ingen** `blocksSave`- eller `blocksProjection`-boolean. Consumerkonsekvensen udledes strukturelt af
issuets klasse, dets placering og consumerens faktiske reads. Save-konsekvensen udledes af inputrepræsentationen:
rejected input blokerer, canonical input gør ikke (§ konsekvensmodellen nedenfor og `form-contract.md` §8).

Der findes tre issue-klasser:

- **feltfejl** (rød): vises med rød kant + tooltip på feltet og blokerer enhver afhængig consumer,
- **consumerfejl** (fx `missing`): ingen rød markering; vises i contentboxen og blokerer kun den konkrete consumer,
- **warning**: vises, men blokerer aldrig beregning, dokument eller `.eo`.

Normative årsager:

- `invalid` — feltets afsluttede input er rejected, fordi råteksten ikke opfylder feltformatet eller ikke kan omsættes
  til en værdi i det persisterede Zod-schema; altid en **feltfejl**,
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
| Range/bounds-fejl på canonical værdi | Ja | Nej | Ja | Nej |
| Feltplaceret domæneregel på canonical værdi | Ja | Nej | Ja | Nej |
| Consumerplaceret domæneregel (`ConsumerIssue` med `reason: 'rule'`) | Nej | Nej | Ja | Nej |
| Tomt felt / `missing` | Nej | Nej | Ja, hvis consumeren kræver feltet | Nej |
| Warning | Nej | Nej | Nej | Nej |

UI- og consumerkonsekvensen er ens for de røde feltfejl; save-sondringen følger rejected/canonical-repræsentationen.
Matrixen må ikke omgås af et `blocksSave`- eller `blocksProjection`-flag.

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
En flerfeltsprojektion opsamler issues under sine konkrete `FieldRef`-reads. En offentlig sektionsvis issueport og
efterfølgende tekstfiltrering er forbudt; dynamiske rækker enumereres som konkrete refs, før de læses.

`.eo`-save-gaten er strukturel: **ethvert aktivt relevant rejected input blokerer `.eo` globalt**, mens et rødt issue på
schema-gyldigt canonical input ikke blokerer save. `missing` og warnings blokerer heller aldrig `.eo`. Dokument-/
beregningspolicy er dependency-specifik: et relevant `error` (feltfejl eller consumerfejl på et læst felt) blokerer den
konkrete consumer; en warning blokerer aldrig.

Der findes ingen central skrivbar feltfejl-bus: `src/types/fieldErrors`, `useFormFieldErrorReporter`,
`onFieldError` og tabeltrackerne findes ikke, og ingen af dem må genindføres. Den rene issueprojektion er eneste
sandhedskilde.

Bemærk at **navnet** `fieldErrors` ikke er forbudt. Det lever videre som et almindeligt feltnavn i
domænesnapshots (`EetSnapshot.fieldErrors`, `EOInspektionSnapshot.fieldErrors`), hvor det betegner en ren
issueprojektion — ikke en skrivbar kanal. Navnet står derfor bevidst uden for `legacy/forbidden-identifier`s
forbudsliste; der findes ingen allowlist-mekanik at undtage det fra, og forbuddet rammer de konkrete
legacy-symboler (`useFormFieldErrorReporter`, `onFieldError`, `collectPresentFieldErrors`), ikke feltnavnet.

## 3. Feltidentitet og beskeder

Feltidentitet kommer fra `FieldRef`; dynamiske felter bruger typed builders. Frie string keys, label-parsing og
kolonneindeks som identitet er forbudt.

Sondringen mellem `missing` og `invalid` afgøres af consumeren:

- tom canonical værdi kan være `missing`, hvis consumeren kræver den,
- ikke-tom rejected tekst er `invalid`.

En korrekt formateret tal-, år- eller ugeværdi, som kan valideres af det persisterede Zod-schema, er canonical. Ligger
den uden for feltets aktive min/max, giver den et afledt `range`-/`bounds`-issue. Et trecifret årstal er derimod
`invalid`, fordi det ikke opfylder årsfeltets format.

De godkendte beskedskabeloner er:

| Årsag | Kontroltype | Skabelon |
|---|---|---|
| `missing` | Tekst-/talfelt | `Feltet <navn> er ikke udfyldt` |
| `missing` | Dropdown/valg | `<navn> er ikke valgt` |
| `missing` | Toggle/radio | `<navn> er ikke angivet` |
| `invalid` | Alle | `Der er udfyldt en ugyldig værdi i feltet '<navn>'` |
| `schema` | Alle | `Der er gemt en ugyldig værdi i feltet '<navn>'` |
| `range`/`bounds` | Alle | Domænets konkrete intervaltekst med relevante grænser |

Skabelonerne for `schema` og `range`/`bounds` produceres af `src/inputCore/catalog/boundsValidators.ts`, som
ejer de syv bounds-validatorer (`integerBoundsValidator`, `integerStringBoundsValidator`,
`percentBoundsValidator`, `amountBoundsValidator`, `yearBoundsValidator`, `yearStringBoundsValidator`,
`weekYearBoundsValidator`) og er eneste producent af `reason: 'schema'` — sidstnævnte gennem modulets
ottende eksport, `canonicalStringCodecValidator`, som netop IKKE er en bounds-validator.

Kontroltype og label kommer fra feltdescriptoren. Et bart `<felt> mangler` er forbudt. Feltnavnet står i
enkelte anførselstegn i de to skabeloner, der citerer det (`invalid`, `schema`): beskeden læses i "Fejl og
advarsler" UDEN feltet foran sig, og labels indeholder selv punktummer og bindestreger
("Hvis genopt. - tidl. kap.dato"), som ellers løber sammen med prosaen. `quoteFieldLabel` ejer formen.

## 4. Prioritet og visning

Hvis flere issues rammer samme felt, vælger en central deterministisk resolver højst ét aktivt feltissue.
Prioriteten er `compareFieldIssues` (`src/inputCore/inputIssue.ts`) og har præcis tre led i denne rækkefølge:

1. **`reason`** efter fast rangorden `format` → `bounds` → `rule` → `schema`. Den mest direkte feltfejl vinder:
   kunne råteksten ikke parses, er en regel om den parsede værdi uden mening.
2. **`code`** leksikografisk.
3. **`message`** leksikografisk.

Komponentrækkefølge eller seneste reporter må aldrig påvirke den.

**Hverken `source` eller `severity` indgår.** Der findes ingen `source`-dimension — §11 forbyder source-registre —
og `severity` er på et `FieldIssue`/`ConsumerIssue` den ENESTE literal `'error'`: et kerneissue er per definition
blokerende, og advarsler dannes i domænernes egne typer (`EetIssue.severity`, `EoRowStatus`,
`IntegrityIssue.severity`). En feltbundet domæneadvarsel repræsenteres særskilt som `FieldWarning`
(`src/inputCore/fieldWarning.ts`): den binder literal `warning` og en ikke-tom tooltipbesked sammen, men er
ikke et `InputIssue` og påvirker ingen gate. Et felt, der kun kan have én fejl, kan ikke sortere noget. En
prioritetsregel, der nævnte de to, ville beskrive dimensioner, modellen ikke har, og kunne læses som en
invitation til at genindføre dem.

Ugyldigt input vises med rød kant og tooltip ved hover. En `FieldWarning` vises med gul kant og sin bundne
tooltip; rød fejl har altid visuel forrang. En gul kant uden en ikke-tom tooltipbesked må ikke kunne renderes.
Ingen inline-valideringstekst vises under feltet. Range- og
datotooltips skal vise konkrete grænser. Hvis `min > max`, forklarer tooltippen, at ingen gyldige værdier findes, viser
begge grænser og navngiver de brugervendte input, der skabte dem.

**Tooltip vs. "Fejl og advarsler" (brugerkrav 2026-07-30).** De to flader viser IKKE nødvendigvis samme tekst.
Boksen viser altid den fulde besked. Tooltippet afhænger af `reason`, og `resolveFieldIssueTooltip`
(`src/inputCore/inputIssue.ts`) er det ENE sted, valget træffes:

| `reason` | Tooltip |
|---|---|
| `bounds`, `rule` | den fulde besked, ordret |
| alle øvrige (`format`, `schema`) | den generiske `FIELD_ISSUE_GENERIC_TOOLTIP` = `Fejl i indtastning` |

Tabellen er en **allowlist**: `REASONS_WITH_SPECIFIC_TOOLTIP` rummer præcis `bounds` og `rule`, og enhver anden
— også en fremtidig — `reason` falder i den generiske gren. Det er den sikre default: en ukendt årsag lækker
ikke en uegnet tekst til tooltippet. Samme klassifikation gælder download-tooltip: `format`/`schema` må bruge
`Fejl i indtastning`, mens `bounds`/`rule` skal bevare den konkrete besked.

Begrundelsen er informationsværdi, ikke længde: `bounds`/`rule` fortæller HVAD der er galt ("skal være mellem 0
og 100", "skal ligge efter skadedatoen"), og det er den eneste brugbare del i et tooltip. `format`/`schema`
tilføjer derimod kun feltets eget navn, som allerede står ved markøren. Skallerne
(`StyledTextFieldBase` m.fl.) modtager kun `error: boolean` + `helperText`/`tooltipText` og må derfor ALDRIG
udlede klassen af beskedteksten. Den visuelt skjulte a11y-tekst er fortsat den FULDE besked — en
skærmlæserbruger kan ikke se feltet, forkortelsen bygger på.

Kontrolvisninger må gruppere alle relevante issues, men må ikke gætte fra beskedtekst. Links skal bruge issueets
strukturelle fokusmål. Henvises til en anden side, er kun sidens navn klikbart.

**En besked-boks findes kun MED indhold (normativ).** En fejl-/meddelelsesboks må aldrig være synlig uden en
læsbar besked. En boks med overskrift og tom brødtekst er værre end ingen boks: den påstår en fejl, den ikke kan
navngive, og brugeren har intet at handle på.

Tilstedeværelse afgøres derfor af typen, ikke af truthiness. Boksens indhold er en `PageMessage`
(`src/components/layout/pageMessage.ts`) — en diskrimineret union, hvor fravær er den eksplicitte variant
`NO_MESSAGE`, og hvor `pageMessage()` normaliserer `null`/`undefined`/tom/whitespace til netop den. En
tilstedeværende variant bærer altid ikke-tom, trimmet tekst.

- Render KUN gennem `PageMessageBox` (selvstændig boks med overskrift) eller `PageMessageRow` (linje i en
  eksisterende `ContentBox`) — begge i `src/components/layout/PageMessageBox.tsx`. De ejer værnet —
  `hasPageMessage` — så en side ikke håndruller sit eget.
- Et `??`-fallback på et besked-felt skal have besked-typen. Viewmodeller pinder deres besked-felter med
  `withPageMessages<'…'>()`, så en forkert typet værdi bliver en compile-fejl frem for en tom boks.
- Flere kilder til samme boks prioriteres med `firstPageMessage(...)`, ikke med `??`: `'' ?? b` giver `''`.

Baggrund: Årsløns "Kritisk Fejl"-boks stod permanent og tom øverst på siden. Viewmodellen skrev `?? []` på et
`string | null`-felt; et tomt array er truthy, så boksens håndrullede værn (`if (!beregningsFejl)`) slap
igennem, og `{[]}` renderede lovligt til ingenting, fordi `string[]` er en gyldig `ReactNode`. Ingen af de tre
lag — `??`, den inferede viewmodel-returtype eller truthiness-værnet — kunne se fejlen alene.
Grænsen håndhæves af `ui/message-box-guarded-by-page-message` i AST-manifestet.

## 5. Konsekvens for save, beregning og dokumenter

- En projektion kalder ikke beregningsmotoren, hvis et afhængigt issue gør input uanvendeligt.
- `.eo`-save blokeres af **ethvert aktivt relevant rejected input** i sagen. Canonical værdier med afledte røde
  range-/bounds-/rule-issues kan gemmes; `missing` og warnings blokerer heller aldrig save.
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
8. Når `Varige mén-afgørelse`, `Midlertidigt EET-afgørelse` eller `Endeligt EET-afgørelse` er `Ja`, er en helt
   manglende nødvendig afgørelses-/virkningsdato en gul, ikke-blokerende komplethedsadvarsel i "Fejl og advarsler".
   Den efterlader datofelterne uden rød markering og må ikke blokere dokumenter. En faktisk `FieldIssue` på et af
   de samme datofelter har altid forrang som rød fejl; den må aldrig maskeres som en manglende-dato-advarsel.

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

## 11. Ingen reporter-/store-model

Issues afledes rent fra `InputReader`, feltdescriptors og domænevalidatorer;
der findes ingen skrivbar feltfejl-bus, ingen source-registre, ingen cleanup-effects, ingen syntetiske
`invalid-draft`-entries og ingen mount-afhængige dokumentgates. Genindfør dem ikke.

**EO følger samme model uden en domænelokal issuealgebra.** Readerprojektionen filtrerer det kanoniske
`FieldIssueSet` på sektion, og række-, snapshot- og downloadlaget modtager de samme strukturelle
`FieldIssue`-adresser. Top-level felter slås op ved deres faktiske adresse; nested løncelleissues beholder
deres entity-sti. Der konstrueres ingen feltnøgle-map eller syntetisk `${id}:loenindkomst`-issue.

Følgende slettede navne er derfor forbudt som identifiers (`legacy/forbidden-identifier`):
`EoInputIssueSource`, `EoFieldIssuesBySource`, `collectPresentFieldErrors`, `blocksSave`.

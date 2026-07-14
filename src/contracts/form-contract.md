# Mineo – Form-kontrakt

**Version:** 1.0
**Status:** Normativ målarkitektur
**Type:** Tværgående kontrakt
**Senest verificeret mod kode:** 2026-07-14
**Formål:** At fastlægge én ensartet model for input, redigering, validering og beregningsgrænser i Mineo.

Denne kontrakt beskriver slutarkitekturen. Den eksisterende implementering migreres efter
`docs/architecture/draft-commit-greenfield-design.md`; overgangs-API'er er ikke præcedens for nye løsninger.

---

## 1. Grundprincipper

1. Applikationen kører 100 % client-side, og brugerdata må ikke forlade browseren.
2. Draft, afsluttet input og beregningsklart input er tre forskellige semantiske niveauer.
3. Alle autoritative inputændringer går gennem én atomisk inputtransaktion.
4. Beregning, save og dokument-output må kun læse gennem den autoritative read-/projektionsgrænse.
5. Samme problem løses med samme feltmotor, codec, feltidentitet og issue-model på formular- og tabeloverflader.
6. Domænegrænser styres af `domain-boundary-contract.md`.

## 2. Tre inputniveauer

### 2.1 Åben draft

En åben draft er den rå tekst, brugeren redigerer, mens editoren er åben.

- Den må være tom, delvis eller ugyldig.
- Den lever kun i felt-editorens state machine.
- Den indgår ikke i undo/redo, `sessionStorage`, `.eo`, validering, beregning eller output.
- `onChange` må kun ændre denne draft.

Mens editoren er åben, bygger visning, beregninger og download-gates fortsat på den senest afsluttede inputtilstand.
At åbne editoren eller skrive må derfor ikke få beregnede sektioner til skiftevis at blive vist og skjult.

### 2.2 Afsluttet input

Afsluttet input er feltets autoritative tilstand efter blur, Enter eller en tilladt immediate-commit-handling. Tilstanden
er enten:

- **gyldig:** en typet canonical værdi, eller
- **ugyldig:** den ikke-tomme rå tekst, som ikke kunne parses.

Et ugyldigt afsluttet input maskerer altid en eventuel tidligere gyldig canonical værdi. Den tidligere værdi er kun
recovery-data og må ikke nå en consumer, så længe masken findes.

Tom tekst parser til feltets definerede tomme canonical værdi, normalt `undefined`. Om tomhed er en fejl, afgøres af den
consumer, som kræver feltet.

### 2.3 Domæneprojektion

En domæneprojektion bygges fra ét revisionsbundet input-snapshot gennem den fælles `InputReader`.

- Kun en `ready` projektion må fodre beregningsmotorer, save eller dokumentgeneratorer.
- En `blocked` projektion bærer strukturelle blockers med feltreference og årsag.
- Både `ready` og `blocked` bærer alle relevante issues. Et canonical range-/bounds-issue eller en warning må ikke
  forsvinde, blot fordi det ikke gør den konkrete beregningsprojektion uanvendelig.
- Om et issue blokerer beregning, afgøres af den konkrete consumerprojektion. Det er ikke en global egenskab ved feltet.
- Domænekode må ikke modtage rå canonical sektioner som alternativ adgangsvej.
- Uafhængige projektioner må fortsat være `ready`, selv om en anden consumer er blokeret.

## 3. Autoritativ inputaggregate

Den autoritative runtime-tilstand består konceptuelt af:

```ts
type PersistedInputState = Readonly<{
  sections: FormPersistenceSections;
  rejectedInputs: Readonly<Record<SerializedFieldAddress, RejectedInput>>;
}>;

type InputRuntimeState = Readonly<{
  input: PersistedInputState;
  revision: InputRevision;
}>;
```

Regler:

1. Canonical sektioner er altid valideret af deres Zod-schema.
2. Rejected inputs er dækket af eget Zod-schema og validerede strukturelle feltadresser.
3. Aggregate og revision ændres atomisk; en inputhandling må aldrig efterlade deltilstand.
4. Revisionen stiger præcis én gang ved en reel transaktion og ikke ved en no-op.
5. Revisionen persisteres ikke som brugerdata og gendannes ikke fra history.
6. Eksisterende `invalidDrafts`, separate feltfejl-slices og sektionsvise skrive-API'er er migrationssubstrat, ikke
   tilladte slut-API'er.

## 4. Feltdefinition og identitet

Hvert persisteret felt har én typed `FieldRef<T>`, der forbinder:

- en strukturel `FieldAddress`,
- feltets codec,
- brugervendt label,
- kontroltype,
- fokusmål.

Samme reference bruges ved render, settle, validering, projektion, history-origin, gate og fokus-restore.

- Statiske felter defineres én gang.
- Dynamiske række-/entity-felter dannes af typed builders.
- Felt- og collection-bindings samles i ét katalog, der forsegles før state-validering og læsning.
- En dynamisk reference er kun gyldig, når alle dens entities findes i det konkrete input-snapshot.
- Adresser beskriver data, ikke DOM eller tabelgeometri.
- Frie strengnøgler og identitet som `rowId:colIndex` er forbudt.
- DOM-attributter må være en projektion af feltreferencen, men må ikke være dens autoritet.

Det normative komponent- og codec-mønster findes i `mineo-field-pattern.md`.

## 5. Event-semantik

### 5.1 Tastning

`onChange` må kun opdatere den åbne draft. Det må ikke:

- parse eller validere domænedata,
- ændre afsluttet input,
- trigge beregninger eller afledt feedback,
- skrive persistence eller history.

### 5.2 Settle

Blur og Enter bruger samme feltmotor og samme `settleField`-transaktion:

1. codec parser den aktuelle rå tekst,
2. gyldigt resultat skriver canonical værdi og fjerner en eventuel rejection,
3. ugyldigt resultat skriver den rå tekst som rejection og bevarer recovery-værdien maskeret,
4. storage, aggregate, history og revision ændres som én transaktion.

En global kritisk handling må udløse den samme settle-sti gennem en registreret deltager. Der må ikke findes en separat
parse-, validerings- eller persistencevej til kritiske handlinger.

### 5.3 Escape

Escape annullerer universelt alt siden editoren blev åbnet:

- den åbne draft erstattes med editorens start-snapshot,
- intet committes eller valideres,
- det umiddelbart efterfølgende blur må ikke settle den annullerede tekst.

Hvis feltet var afsluttet ugyldigt før åbning, gendannes den ugyldige tekst; den skjulte tidligere canonical værdi må
ikke vises i stedet.

### 5.4 Immediate commit

Kun disse handlinger må committe uden en åben draft/blur-grænse:

1. Delete/Backspace på en fokuseret, lukket celle rydder feltet.
2. Valg af dropdown-menupunkt committer valget; søge-/filtertekst gør ikke.
3. Toggle- eller radioaktivering committer valget.

De går gennem samme transaktionsrunner og feltreference som øvrige commits.

### 5.5 Forbudte mønstre

- commit eller domænevalidering i `onChange`,
- implicit commit via effect,
- `queueMicrotask`, timeout, Promise-tick eller render-rækkefølge som korrekthedsforudsætning,
- side-effects i state-updaters,
- flere writes, der bagefter forsøges coalescet til én brugerhandling,
- lokale fallback-stores for persisterede felter.

## 6. Fokus- og redigeringsmodel

Mineos tekst-, dato- og talfelter bruger den eksisterende to-trinsmodel:

1. Første fokus giver fokus uden at åbne editoren.
2. Klik på et allerede fokuseret felt eller et plausibelt starttegn åbner editoren.

Når editoren er lukket:

- et printbart tegn åbner editoren og erstatter det viste indhold med tegnet,
- paste åbner ikke editoren og følger feltets codec-regler,
- Delete/Backspace følger immediate-commit-undtagelsen for tabelceller.

Keyboard-navigation ejes af `keyboard-navigation.md`.

## 7. Initialisering, synlighed og relevans

1. Initial values materialiseres gennem sektionens Zod-schema og bruges kun ved oprettelse eller reelt fravær.
2. En eksisterende afsluttet værdi må aldrig overskrives af initial values ved navigation, rerender, settings-ændring
   eller lokal resync.
3. Synlighed og beregningsrelevans udledes af samme domæneprædikat.
4. Skjult canonical input bevares gennem F5 og `.eo`, medmindre brugeren eksplicit sletter det.
5. Når et styrende valg efter den gældende produktregel gør rejected input irrelevant, skal rydningen udtrykkes som én
   typed domænecommand i samme transaktion som valget. Canonical skjulte værdier må ikke ryddes implicit.

## 8. Datoer, bounds og save-policy

- Dato-draft er rå tekst; canonical dato er `ISODateString | undefined`.
- Datoformat parses kun ved settle gennem det kanoniske datocodec.
- Min/max og tværfeltgrænser læser kun senest afsluttet input.
- En parsebar dato uden for interval committes canonical og giver et afledt range-/bounds-issue.
- Ugyldigt format giver rejected input og ingen ny canonical værdi.

`.eo`-save følger commitbarhed, ikke enhver rød fejlmarkering:

- rejected input blokerer save,
- schema-/regel-fejl blokerer efter deres save-policy,
- range/bounds med en schema-gyldig canonical værdi kan fortsat gemmes, når domænet foreskriver det.

Dokument-output har en strengere policy: ethvert dokumentrelevant issue med fejlseverity blokerer dokumentet, herunder
range/bounds. Se `document-output-contract.md`.

## 9. Dynamiske tabeller

Rækkeinfrastrukturen ejer kun stabil rækkeidentitet, rækkefølge, add/delete/reorder og eventuelle tomme UI-rækkers
livscyklus. Den ejer ikke en parallel `draftRows`-kopi af celleværdier.

- Hver celle bruger samme feltmotor og codec som formularfelter.
- Første settle i en tom UI-række promoverer rækken atomisk, også hvis inputtet er ugyldigt.
- Sletning af en række fjerner række og alle descendant-rejections i samme transaktion.
- Orphan-state skal være urepræsenterbar; reconcile-effects er forbudt som slutarkitektur.
- Add, delete og reorder bruger samme command-runner som feltændringer.

De to lønfelter `Løn`/`Løn (2)` og ydelsesfelterne `Ydelse`/`Ydelse (2)` har fortsat identisk domænebetydning inden
for hvert par og summeres uden særbehandling.

## 10. Validering og issues

Issues afledes rent fra `InputReader`, feltmetadata, domænevalidatorer og relevante AppSettings:

- `invalid` fra rejected input,
- `missing` fra consumerens requirement,
- `range`/`bounds` fra canonical værdi og konkrete grænser,
- `schema`/`rule` fra domænevalidatoren.

Mounted komponenter rapporterer ikke afledelige fejl til en central store. Samme issue-model driver feltmarkering,
tooltip, kontrolvisning, save-gate og dokument-gate med deres respektive policy.

Fejl- og beskedregler ejes af `error-contract.md`.

## 11. Kritiske handlinger

Kritiske handlinger følger `critical-action-contract.md`.

Særligt for dokument-download:

1. Den reaktive gate bygger på senest afsluttede input, også mens en editor er åben.
2. Klik/aktivering finaliserer editoren før dokumentpreflight.
3. Preflight læser en frisk revision og bruger samme dokumentdefinition som den reaktive gate.
4. Ved et nyt relevant fejl-issue bliver knappen visuelt og funktionelt disabled.
5. Generator, lazy-load og fil-I/O må aldrig starte ved blokering.

## 12. Migrationsregel

`useDraftField`, `useTableInputCore`, `useRowDrafts`, `useSliceRowDrafts`, `FormPersistenceContext`, offentlige
`invalidDrafts`-/`fieldErrors`-API'er og deres string-key-builders må eksistere midlertidigt under migrationen. De må
ikke udvides, kopieres eller bruges som normativt eksempel. De slettes efter acceptkriterierne i greenfield-planen.

Fase-3-gridbroen er den eneste tilladte tilføjelse til migrationslaget: den bærer en konkret rejected-clear fra
celle-blur til den eksisterende effektbaserede sektionspersistence, så begge dele rammer samme transaktionscommand.
Den skriver ingen state/storage selv, er uafhængig af timing og slettes sammen med grid-pipelinen i fase 4.

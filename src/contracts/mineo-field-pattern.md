# Mineo feltmønster

**Status:** Normativ målarkitektur
**Type:** Tværgående komponent-/adapterkontrakt  
**Prioritet:** Supplement til `form-contract.md`; ejer feltdefinitioner, codecs, editor-state machine og surface-adaptere.
**Senest verificeret mod kode:** 2026-07-14

Denne kontrakt fastlægger ét fælles feltmønster for Styled-felter og tabelceller. Eksisterende hooks og adaptere er
migrationskode, indtil de er erstattet efter `docs/architecture/draft-commit-greenfield-design.md`.

## 1. Begreber

- **Åben draft:** rå tekst, der kun findes mens editoren er åben.
- **Afsluttet input:** enten canonical typet værdi eller rejected rå tekst efter settle.
- **Feltdefinition:** codec og stabil præsentationsmetadata for én feltart.
- **Feltreference:** feltdefinition bundet til en strukturel adresse.
- **Surface-adapter:** tynd integration til formular eller grid; den ejer ikke inputsemantik.

## 2. Lagdeling

### Lag A — UI-base

UI-basen ejer render, styling, a11y og videresendelse af input-, fokus- og keyboard-events.

Den må ikke:

- parse, formatere eller validere domæneværdier,
- kende persistence eller history,
- holde en alternativ rejected-/fejltilstand,
- eksponere DOM-events som domæne-API.

Den modtager en draft-string og en string-callback. Inputsemantiske handlers bindes til det faktiske input; musehandlers
kan bindes til feltroden for at bevare to-trins-aktiveringen.

### Lag B — fælles editor-state machine

Én reducer/state machine ejer for både formular og grid:

- lukket, fokuseret og åben editorstatus,
- lokal rå draft,
- start-snapshot til Escape,
- touched-status,
- settle ved blur, Enter og kritisk handling,
- undertrykkelse af blur efter cancel,
- resync ved autoritativt snapshot-skift.

State machine kalder kun den fælles inputtransaktion. Den må ikke kende et konkret domæne eller have surface-specifik
parsing.

### Lag C — feltdefinition og codec

Hver inputfamilie har ét `FieldCodec<T>`:

```ts
type FieldCodec<T> = Readonly<{
  parseForSettle(raw: string): FieldResolution<T>;
  format(value: T): string;
  acceptsInitialKey(key: string): boolean;
  normalizePaste?(raw: string): string;
}>;
```

Krav:

1. `parseForSettle` returnerer enten canonical værdi eller deterministisk ugyldighed.
2. Tom tekst mapper til feltets canonical tomme værdi.
3. `format` er deterministisk og bruges kun for afsluttede gyldige værdier.
4. Canonicalisering må kun ske ved settle og kun efter den eksisterende felt-/numerikregel.
5. Dato, beløb, procent, heltal, brøk, uge, år og tekst må ikke have separate form- og tabelcodecs.
6. Domæne-bounds hører til rene validatorer/projektioner, medmindre grænsen er en del af syntaksen.

### Lag D — surface-adaptere

Form- og grid-adaptere må kun tilføje:

- konkret rendering og hit-area,
- grid-navigation,
- kopiér/indsæt-integration,
- registrering hos `CriticalActionCoordinator`,
- projektion af feltreference til DOM-fokusmetadata.

De må ikke parse, skrive persistence, eje history, oprette fingerprints eller holde parallelle draft-/invalid-stores.

## 3. Feltdefinition, reference og adresse

```ts
type FieldDefinition<T> = Readonly<{
  codec: FieldCodec<T>;
  label: string;
  controlKind: 'text' | 'choice' | 'toggle';
  focusTarget: FieldFocusTarget;
}>;

type FieldRef<T> = Readonly<{
  address: FieldAddress;
  definition: FieldDefinition<T>;
}>;
```

Regler:

1. Samme `FieldRef` følger feltet gennem render, settle, issue, projektion, gate, history og fokus-restore.
2. Statiske felter kommer fra ét feltkatalog; dynamiske felter dannes af typed entity-/row-builders.
3. Adressen beskriver data strukturelt og versioneres/migreres som persistenceformat.
4. Label og kontroltype kommer fra definitionen, aldrig fra parsing af en key eller fri streng.
5. Rækkeidentitet er datanøglen; kolonneindeks må ikke indgå i persistent feltidentitet.
6. Transiente UI-hjælpefelter bruger samme codec/editor, men har ingen persisted `FieldRef` og deltager ikke i history.

## 4. Settle-kontrakt

- `onChange` ændrer kun den åbne draft.
- Blur og Enter udløser samme `settle`.
- Escape gendanner præcis tilstanden ved editorens åbning og committer aldrig.
- Et succesfuldt settle skriver canonical værdi og fjerner tidligere rejection atomisk.
- Et ugyldigt settle skriver rejected rå tekst og maskerer den tidligere canonical værdi atomisk.
- Et no-op-settle skriver hverken storage eller history og stiger ikke revisionen.
- Kritiske handlinger bruger samme settle-handle; der findes ingen særskilt preflight-parser.

Mens editoren er åben, forbliver resten af UI'et på seneste afsluttede revision. Den åbne draft må ikke drive
feltissues, beregning, resultatvisning eller download-gate.

## 5. Keyboard-policy

Standard for åbne teksteditorer:

- Blur → settle.
- Enter → settle og derefter den aftalte navigation.
- Escape → cancel til start-snapshot; efterfølgende blur undertrykkes.

Tilladte immediate commits:

- Delete/Backspace på lukket, fokuseret celle rydder og committer uden at åbne editoren.
- Valg af dropdown-menupunkt committer straks; filtertekst gør ikke.
- Toggle/radio committer straks.

Den fulde navigationsadfærd ejes af `keyboard-navigation.md`.

## 6. Fejlvisning

Et felt viser højst ét aktivt issue ad gangen efter den centrale, deterministiske prioritet i `error-contract.md`.

- Ugyldigt input, range/bounds og domæneregler afledes fra senest afsluttede input.
- Den åbne draft viser ingen afledt fejlfeedback.
- Fejl vises som rød kant og tooltip ved hover; der vises ingen inline-valideringstekst under feltet.
- `error=true` kræver en ikke-tom dansk tooltip/a11y-beskrivelse.
- Monterede komponenter må ikke rapportere afledelige fejl til en central store.

## 7. Dynamiske tabeller

- Hver celle bruger den fælles editor-state machine og feltets fælles codec.
- Grid-adapteren må ændre commit-triggeren ved navigation, men ikke commit-semantikken.
- Rækkeinfrastrukturen må ikke holde en ekstra værdibærende `draftRows`-kopi.
- Første settle i en tom UI-række promoverer rækken atomisk, også ved rejected input.
- Rækkesletning fjerner descendant-rejections i samme transaktion; efterfølgende reconcile-effects er forbudt.
- Paste-normalisering og første-tast-filter ligger i det fælles codec, ikke i hver `Table*Input`.

## 8. Immediate-commit-kontroller

Toggle, radio og dropdownvalg har ingen cancel-fase og committer i samme brugerhandling. De bruger fortsat
`FieldRef`, transaktionsrunner, issue-model og history-origin. Popupens `onClose` er en interaktionshændelse og må ikke
forveksles med et værdi-commit.

## 9. Skjulte domæneregler

Ikke-indlysende defaults og constraints skal være eksplicitte i feltdefinitionen eller den relevante domænekontrakt.
Eksempler er procentintervaller, to-cifret årspolitik og sikkerhedsgrænser for cifferantal.

## 10. Reference og migrationsværn

Den normative reference er denne kontrakt sammen med `form-contract.md` og
`docs/architecture/draft-commit-greenfield-design.md`.

`useDraftField`, `useTableInputCore`, `useRowDrafts`, `useCellInvalidDraftChannel`, `onFieldError`-kanaler,
fingerprints og `rowId:colIndex` er overgangsmekanismer. De må ikke kopieres eller udvides som nye referenceeksempler.

## 11. Tjekliste

- Én feltdefinition og ét codec pr. inputfamilie.
- Én editor-state machine på tværs af formular og grid.
- Én strukturel `FieldRef` gennem hele flowet.
- Ingen parsing, validering eller afledt feedback under tastning.
- Ét atomisk settle med højst ét history-trin og én revision.
- Escape gendanner editorens start-snapshot.
- Ingen local fallback-state for persisterede felter.

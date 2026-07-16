# Mineo feltmønster

**Status:** Normativ målarkitektur
**Type:** Tværgående komponent-/adapterkontrakt  
**Prioritet:** Supplement til `form-contract.md`; ejer feltdefinitioner, codecs, felt-editor og surface-adaptere.
**Senest verificeret mod kode:** 2026-07-16

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

### Lag B — fælles felt-editor

Én reducer/editor ejer for både formular og grid kun den åbne editors rå draft og lifecycle. Lukket visning er ikke
lokal state, men afledes direkte af `SettledFieldState`:

- rejected rå tekst vises ordret,
- canonical værdi vises med `codec.format`,
- åbning starter draften med rejected tekst eller `codec.formatForEdit`,
- blur, Enter og kritisk handling udsteder samme `settleField(FieldRef, raw)`,
- Escape lukker uden command og undertrykker det efterfølgende blur-settle.

Der findes ingen lukket draftkopi, touched-kopi af input, pending-prop-guard, fingerprint eller epoch-resync. En
autoritativ replacement kan ikke passere commit-barrieren, mens editoren er åben. Editorlaget kalder kun den fælles
inputtransaktion og må ikke kende et konkret domæne eller have surface-specifik parsing.

### Lag C — feltdefinition og codec

Hver inputfamilie har ét `FieldCodec<T>`:

```ts
type FieldCodec<T> = Readonly<{
  parseForSettle(raw: string): FieldResolution<T>;
  format(value: T): string;
  formatForEdit(value: T): string;
  acceptsInitialKey(key: string): boolean;
  normalizePaste?(raw: string): string;
}>;
```

Krav:

1. `parseForSettle` returnerer enten canonical værdi eller deterministisk ugyldighed.
2. Tom tekst mapper til feltets canonical tomme værdi.
3. `format` er deterministisk og bruges kun for den lukkede visning af afsluttede gyldige værdier.
4. `formatForEdit` er obligatorisk og gendanner den revisionsbundne edit-tekst uden at læse en parallel draft. For
   beløbsudtryk bevares udtrykket her, selv om `format` viser det beregnede og dansk formaterede beløb.
5. Canonicalisering må kun ske ved settle og kun efter den eksisterende felt-/numerikregel.
6. Dato, beløb, procent, heltal, brøk, uge, år og tekst må ikke have separate form- og tabelcodecs.
7. En syntaktisk parsebar tal-, år- eller ugeværdi uden for feltets aktive commit-interval er rejected rå tekst og må
   ikke blive canonical input. Kronologiske datobounds og tværgående domæneregler, som en mere specifik kontrakt
   klassificerer som canonical issues, hører til rene validatorer/projektioner og må ikke samtidig implementeres i
   settle-policyen.
8. Paste bevarer mest muligt input efter én regel: normalisér feltets tilladte format, og afskær derefter fra højre
   til det længste præfiks, som feltets format, præcision, cifferloft og aktive commit-interval kan rumme. Heltalsfelter
   fjerner separatoren og hele decimaldelen uden afrunding; decimalaktiverede felter bevarer decimaler op til deres
   præcision. Tilladte beløbsoperatorer bevares som udtryk. Samme normalisering bruges på formular- og tabeloverfladen.
9. Dato-paste håndhæver formatets komponentgrænser (dag 1–31 og måned 1–12) med samme præfiksregel. Kronologiske
   min/max-datobounds er en bevidst undtagelse: de må ikke afskære paste, fordi afkortning af årsdelen kan flytte datoen
   til et andet århundrede og dermed forvanske brugerens værdi. De bounds forbliver afledte issues efter settle.

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
}>;

type FieldRef<T> = Readonly<{
  address: FieldAddress;
  definition: FieldDefinition<T>;
}>;
```

Regler:

1. Samme `FieldRef` følger feltet gennem render, settle, issue, projektion, gate og history.
2. Statiske felter kommer fra ét feltkatalog; dynamiske felter dannes af typed entity-/row-builders.
3. Adressen beskriver data strukturelt og versioneres/migreres som persistenceformat.
4. Label og kontroltype kommer fra definitionen, aldrig fra parsing af en key eller fri streng.
5. Rækkeidentitet er datanøglen; kolonneindeks må ikke indgå i persistent feltidentitet.
6. Transiente UI-hjælpefelter bruger samme codec/editor, men har ingen persisted `FieldRef` og deltager ikke i history.
7. Felt- og collection-bindings registreres i ét forseglet `InputCatalog`; dynamiske refs skal både matche templaten
   og pege på entities, der findes i det konkrete input-snapshot.
8. History-origin kombinerer `FieldRef` med den konkrete editors fokusmål. Fokusmålet er overflademetadata, ikke en del
   af datafeltets definition; samme felt kan derfor have flere gyldige editorlokationer uden parallel dataidentitet.

## 4. Settle-kontrakt

- `onChange` ændrer kun den åbne draft.
- Blur og Enter udløser samme `settle`.
- Escape gendanner præcis tilstanden ved editorens åbning og committer aldrig.
- Et succesfuldt settle skriver canonical værdi og fjerner tidligere rejection atomisk.
- Et ugyldigt settle skriver rejected rå tekst og maskerer den tidligere canonical værdi atomisk.
- Et no-op-settle skriver hverken storage eller history og stiger ikke revisionen.
- Kritiske handlinger bruger samme settle-handle; der findes ingen særskilt preflight-parser.
- Felt-editoren modtager ikke `value`, `parse`, `format`, `onCommit` eller rejected-callbacks som alternative porte.

Mens editoren er åben, forbliver resten af UI'et på seneste afsluttede revision. Den åbne draft må ikke drive
feltissues, beregning, resultatvisning eller download-gate.

## 5. Keyboard-policy

Standard for åbne teksteditorer:

- Blur → settle.
- Enter → settle og derefter den aftalte navigation.
- Escape → luk uden command, så den uændrede afsluttede starttilstand vises igen; efterfølgende blur undertrykkes.

Tilladte immediate commits:

- Delete/Backspace på et lukket, fokuseret formularfelt eller en celle rydder og committer uden at åbne editoren.
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

- Hver celle bruger den fælles felt-editor og feltets fælles codec.
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
Eksempler er procentintervaller, tocifret årspolitik og sikkerhedsgrænser for cifferantal.

`infer`-politikken for tocifrede år er en låst, løbende regel: `20xx` bruges til og med fem år efter det aktuelle
kalenderår; senere tocifrede år fortolkes som `19xx`. Grænsen skal flytte sig med kalenderåret og må ikke erstattes af
et fast pivotår. Eksempel: `30` fortolkes som 1930 i 2024, men som 2030 fra og med 2025.

## 10. Reference og migrationsværn

Den normative reference er denne kontrakt sammen med `form-contract.md` og
`docs/architecture/draft-commit-greenfield-design.md`.

`useDraftField`, `useTableInputCore`, `useRowDrafts`, `useCellInvalidDraftChannel`, `onFieldError`-kanaler,
fingerprints og `rowId:colIndex` er overgangsmekanismer. De må ikke kopieres eller udvides som nye referenceeksempler.

## 11. Tjekliste

- Én feltdefinition og ét codec pr. inputfamilie.
- Én felt-editor på tværs af formular og grid.
- Én strukturel `FieldRef` gennem hele flowet.
- Ingen parsing, validering eller afledt feedback under tastning.
- Ét atomisk settle med højst ét history-trin og én revision.
- Escape lukker uden command og viser igen det uændrede afsluttede input.
- Ingen lokal fallback-state for persisterede felter.

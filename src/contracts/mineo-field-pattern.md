# Mineo feltmønster

**Status:** Normativ og gældende
**Type:** Tværgående komponent-/adapterkontrakt  
**Prioritet:** Supplement til `form-contract.md`; ejer feltdescriptors, codecs, felt-editor og surface-adaptere.
**Senest verificeret mod kode:** 2026-08-08

Denne kontrakt fastlægger ét fælles feltmønster for formularfelter og tabelceller. Mønstret ER den
implementerede arkitektur; der findes ingen parallel inputmodel ved siden af den — se §10 og
`form-contract.md` §12.

## 1. Begreber

- **Åben draft:** rå tekst, der kun findes mens editoren er åben.
- **Afsluttet input:** enten canonical typet værdi eller rejected rå tekst efter settle.
- **Feltdescriptor:** codec og stabil præsentationsmetadata for én feltart.
- **Feltreference:** feltdescriptor bundet til en strukturel adresse.
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
lokal state, men afledes direkte af `SettledFieldView`:

- rejected rå tekst vises ordret,
- canonical værdi vises med `codec.format`,
- åbning starter draften med rejected tekst eller `codec.formatForEdit`,
- blur, Enter og kritisk handling udsteder samme `settleField(FieldRef, raw)`,
- Escape lukker uden command og undertrykker det efterfølgende blur-settle.

Der findes ingen lukket draftkopi, touched-kopi af input, pending-prop-guard, fingerprint eller epoch-resync. En
autoritativ replacement kan ikke passere commit-barrieren, mens editoren er åben. Editorlaget kalder kun den fælles
inputtransaktion og må ikke kende et konkret domæne eller have surface-specifik parsing.

### Lag C — feltdescriptor og codec

Hver inputfamilie har ét `FieldCodec<T>` (`src/inputCore/fieldCodec.ts`):

```ts
// udsnit; codec'en bærer også decimalPolicy? og options?.
type FieldCodec<T> = Readonly<{
  family: FieldCodecFamily;
  parseForSettle(raw: string): FieldResolution<T>;
  format(value: T): string;
  formatForEdit(value: T): string;
  acceptsInitialKey(key: string): boolean;
  normalizePaste?(raw: string): string;
  signPolicy?: FieldSignPolicy;
}>;
```

`decimalPolicy` er decimalpolitikken (`form-contract.md` §8.3 ejer reglen). `options` er den
maskinlæsbare opregning af et valgfelts mulige tilstande og er ikke kosmetik: den er det eneste sted,
en konsument kan udlede feltets fulde værdimængde uden at gætte.

`family` er obligatorisk og navngiver inputfamilien (`text`, `optionalText`, `selection`, `requiredChoice`,
`boolean`, `date`, `integer`, `amount`, `percent`, `stringBacked`, `year`, `week`, `fraction`). `signPolicy`
er fortegns-politikken; `form-contract.md` §8.2 ejer reglen om den.

Krav:

1. `parseForSettle` returnerer enten canonical værdi eller deterministisk ugyldighed. `FieldRejectReason` har
   præcis én værdi, `'format'` — en anden afvisningsgrund er urepræsenterbar, og det er dét, der gør krav 7
   og `form-contract.md` §8 sande i typesystemet frem for kun i prosa.
2. Tom tekst mapper til feltets canonical tomme værdi.
3. `format` er deterministisk og bruges kun for den lukkede visning af afsluttede gyldige værdier.
4. `formatForEdit` er obligatorisk og gendanner den revisionsbundne edit-tekst uden at læse en parallel draft. For
   beløbsudtryk bevares udtrykket her, selv om `format` viser det beregnede og dansk formaterede beløb.
5. Canonicalisering må kun ske ved settle og kun efter den eksisterende felt-/numerikregel.
6. Dato, beløb, procent, heltal, brøk, uge, år og tekst må ikke have separate form- og tabelcodecs.
7. En korrekt formateret tal-, år- eller ugeværdi, som kan valideres af det persisterede Zod-schema, bliver canonical
   input. Feltets aktive min/max samt kronologiske og tværgående domænegrænser hører til rene validatorer/projektioner
   og må ikke samtidig implementeres som rejection i settle-policyen.
8. Paste behandles tegn for tegn som almindelig tastning fra samme startposition. Et tegn, som codecet ville afvise,
   springes over, men paste fortsætter med næste tegn. Præcision-, ciffer- og længdegrænser håndhæves undervejs;
   overskydende tegn springes over. Et resultat, der stadig er formatmæssigt ugyldigt, bevares som rejected råtekst
   ved settle i stedet for at blive tavst afkortet til en anden gyldig værdi. Samme regel bruges på formular- og
   tabeloverfladen.
9. Dato-paste bruger samme tegn-for-tegn-regel. Separatorer normaliseres efter datofeltets formatregel, gentagne
   separatorer afvises, og paste fortsætter. Kronologiske min/max-datobounds må ikke afskære paste; de forbliver
   afledte issues efter settle, mens formatmæssigt ugyldige kalenderdatoer bevares som rejected råtekst.

### Lag D — surface-adaptere

Form- og grid-adaptere må kun tilføje:

- konkret rendering og hit-area,
- grid-navigation,
- kopiér/indsæt-integration,
- registrering hos `CriticalActionCoordinator`,
- projektion af feltreference til DOM-fokusmetadata.

De må ikke parse, skrive persistence, eje history, oprette fingerprints eller holde parallelle draft-/invalid-stores.

## 3. Feltdescriptor, reference og adresse

```ts
// src/inputCore/fieldDescriptor.ts — udsnit; descriptoren bærer også id, template,
// emptyValue, isEmpty, readCanonical, writeCanonical, relevance?, validators? og bind.
type FieldDescriptor<T> = Readonly<{
  codec: FieldCodec<T>;
  label: string;
  controlKind: FieldControlKind; // 'text' | 'choice' | 'toggle'
}>;

type FieldRef<T> = Readonly<{
  address: FieldAddress;
  descriptor: FieldDescriptor<T>;
}>;
```

`AnyFieldRef` er den type-udviskede variant, som `FieldIssue.field` bærer.

Regler:

1. Samme `FieldRef` følger feltet gennem render, settle, issue, projektion, gate og history.
2. Statiske felter kommer fra ét feltkatalog; dynamiske felter dannes af typed entity-/row-builders.
3. Adressen beskriver data strukturelt og versioneres/migreres som persistenceformat.
4. Label og kontroltype kommer fra descriptoren, aldrig fra parsing af en key eller fri streng.
5. Rækkeidentitet er datanøglen; kolonneindeks må ikke indgå i persistent feltidentitet.
6. Transiente UI-hjælpefelter bruger samme codec/editor, men har ingen persisted `FieldRef` og deltager ikke i history.
7. Felt- og collection-bindings registreres i ét forseglet `InputCatalog`; dynamiske refs skal både matche templaten
   og pege på entities, der findes i det konkrete input-snapshot.
8. History-origin kombinerer feltets `FieldAddress` med den konkrete editors fokusmål. Fokusmålet er
   overflademetadata, ikke en del af datafeltets descriptor; samme felt kan derfor have flere gyldige
   editorlokationer uden parallel dataidentitet.
   `HistoryOrigin` er en **diskrimineret union** på `kind`, ikke én type med et valgfrit felt:
   `FieldHistoryOrigin` bærer en PÅKRÆVET `field: FieldAddress`, mens `CollectionHistoryOrigin` slet
   ikke har feltet, men i stedet en påkrævet `collection` og en påkrævet destination. En strukturel
   rækkehandling har ikke ét felt — men et feltcommit må heller ikke kunne sendes uden adresse, og
   netop den fejl gør unionen urepræsenterbar. Route og fane følger altid med.

## 4. Settle-kontrakt

- `onChange` ændrer kun den åbne draft.
- Blur og Enter udløser samme `settle`.
- Escape gendanner præcis tilstanden ved editorens åbning og committer aldrig.
- Et succesfuldt settle skriver canonical værdi og fjerner tidligere rejection atomisk.
- Et ugyldigt settle rydder feltets canonical slot til tomværdien og skriver rejected rå tekst atomisk — gensidigt
  udelukkende (XOR). Der maskeres ingen tidligere canonical værdi; en afløst gyldig værdi findes kun i undo-historikken.
- Et no-op-settle skriver hverken storage eller history og stiger ikke revisionen.
- Kritiske handlinger bruger samme settle-handle; der findes ingen særskilt preflight-parser.
- Felt-editoren modtager ikke `value`, `parse`, `format`, `onCommit` eller rejected-callbacks som alternative porte.

Mens editoren er åben, forbliver resten af UI'et på seneste afsluttede revision. Den åbne draft må ikke drive
feltissues, beregning, resultatvisning eller download-gate.

En afledt, ikke-blokerende `FieldWarning` må præsenteres på den afsluttede revision. Den fælles form-/gridskal
viser gul ring og den bundne tooltipbesked; rød `FieldIssue` har forrang. Advarslen må ikke føres ind i editorens
canonical/rejected state.

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
- Paste-normalisering og første-tast-filter ligger i det fælles codec, ikke i den enkelte celle-komponent.

## 8. Immediate-commit-kontroller

Toggle, radio og dropdownvalg har ingen cancel-fase og committer i samme brugerhandling. De bruger fortsat
`FieldRef`, transaktionsrunner, issue-model og history-origin. Popupens `onClose` er en interaktionshændelse og må ikke
forveksles med et værdi-commit.

## 9. Skjulte domæneregler

Ikke-indlysende defaults og constraints skal være eksplicitte i feltdescriptoren eller den relevante domænekontrakt.
Eksempler er procentintervaller, tocifret årspolitik og sikkerhedsgrænser for cifferantal.

Årsfortolkningen af tocifrede år (`interpretYear` i `src/utils/dateInputValidation.ts`) er en låst, løbende regel: `20xx` bruges til og med fem år efter det aktuelle
kalenderår; senere tocifrede år fortolkes som `19xx`. Grænsen skal flytte sig med kalenderåret og må ikke erstattes af
et fast pivotår. Eksempel: `30` fortolkes som 1930 i 2024, men som 2030 fra og med 2025.

## 10. Reference og fraværsværn

Den normative reference er denne kontrakt sammen med `form-contract.md`.

Feltidentitet er den strukturelle `FieldRef`/feltadresse. Der findes ingen parallel draft-kanal, ingen
fingerprints og ingen `rowId:colIndex` som persistent identitet — genindfør dem ikke.

De slettede modulstier og symboler — herunder `useDraftField`, `useTableInputCore`, `useRowDrafts`,
`useCellInvalidDraftChannel` og `onFieldError` — er dækket af `input/deleted-legacy-architecture-import` og
`legacy/forbidden-identifier` (se `form-contract.md` §12). Navneværnet supplerer de ansvarsbaserede grænser;
det er ikke i sig selv inputarkitekturens bevis.

Lagdelingen i §Lag D er til gengæld håndhævet af `input/write-boundary`, `input/cell-binding-single-source`,
`input/programmatic-commit-uses-settle`, `input/derived-values-are-not-input-writes` og
`input/persisted-controls-use-field-family`.

## 11. Tjekliste

- Én feltdescriptor og ét codec pr. inputfamilie.
- Én felt-editor på tværs af formular og grid.
- Én strukturel `FieldRef` gennem hele flowet.
- Ingen parsing, validering eller afledt feedback under tastning.
- Ét atomisk settle med højst ét history-trin og én revision.
- Escape lukker uden command og viser igen det uændrede afsluttede input.
- Ingen lokal fallback-state for persisterede felter.

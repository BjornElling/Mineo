# Brugertestfund under draft/commit-reviewet

**Formål:** Dette dokument er det løbende arbejdsregister for symptomer, som brugeren opdager ved brugertest
parallelt med reviewet i `draft-commit-greenfield-review-plan.md`.

**Status:** Afsluttet
**Senest opdateret:** 2026-07-29

## Bindende arbejdsmetode

For hvert indmeldt symptom skal undersøgelsen:

1. forsøge at genskabe den konkret observerede adfærd,
2. dokumentere reproduktionen eller registrere symptomet som en hypotese, hvis det ikke kan genskabes,
3. finde den mekaniske kerneårsag frem for kun det nærmeste fejlsted,
4. afklare om årsagen er enkeltstående eller et symptom på et større strukturelt eller arkitektonisk problem,
5. søge repo-bredt efter parallelle implementeringer og andre flader, hvor samme årsag kan give lignende afledte
   symptomer,
6. vurdere eksisterende kontrakter, tests og kvalitetsværn: både om de beskriver den ønskede adfærd, og om de
   faktisk kan fejle, når adfærden brydes,
7. anbefale en samlet løsningsretning og den nødvendige regressionsdækning.

Undersøgelsen skal **altid begynde med at tage to skridt tilbage**: Før en lokal rettelse overvejes, skal det
afgøres, om problemet bør løses strukturelt gennem tydeligere ejerskab, fælles semantik, konsolideret
infrastruktur eller en arkitektonisk omlægning. En lokal patch er kun den foretrukne løsning, når evidensen viser,
at årsagen reelt er lokal.

Dette dokument registrerer analyser og løsningsretninger. Programadfærd ændres ikke som en skjult del af
registreringen. Synlige UI/UX-ændringer og ændringer af beregningslogik følger fortsat godkendelsesgrænserne i
`AGENTS.md`.

**Tilfældighedsfund.** Konstateres et fund undervejs i undersøgelsen eller rettelsen af et symptom, som ikke
allerede er registreret, skal det enten rettes straks eller skrives ind som nyt fund — aldrig blot nævnes i en
chatbesked. Reglen er bindende og beskrevet i `docs/review/draft-commit-review/fund-oversigt.md`, som også
bærer den samlede tælling og rettelsesrækkefølgen.

## Oversigt

| Id | Symptom | Resultat | Strukturel rækkevidde | Status |
|---|---|---|---|---|
| UT-F01 | Dags-dato-knappen springes over ved Tab | Tilsigtet eksisterende adfærd | Ingen fejl registreret | Afvist med evidens |
| UT-F02 | Enter på dropdown i tabel flytter en række ned | Genskabt | Tværgående dropdown-/grid-integration | **Rettet 2026-07-28** |
| UT-F03 | Undo af den sidste værdi i en tabelrække mister cellefokus | Genskabt | Fælles placeholder-/history-integration | **Rettet 2026-07-28** |
| UT-F04 | Tilføjelse af ansættelsesforhold udløser React-crash | Genskabt | Nested feltbinding i fælles tabel-/celleinfrastruktur | **Rettet 2026-07-28** |
| UT-F05 | Dags-dato-knappen udløser `setImmediateField`-fejl | Fejlmekanisme genskabt | Fælles feltkommandokontrakt og fem knapintegrationer | **Rettet 2026-07-28** |
| UT-F06 | Års-placeholder viser en valideringsgrænse | Genskabt | Placeholder-ejerskab i den fælles feltfamilie | **Rettet 2026-07-28** |
| UT-F07 | Download-gate-årsagen vises både som tekst og tooltip | Genskabt | Gate-årsagens klassifikation + 9 dokumentdefinitioner | **Rettet 2026-07-29** |
| UT-F08 | Minus kan tastes i et ikke-negativt procentfelt | Genskabt | Fortegns-politik i hele den numeriske feltfamilie | **Rettet 2026-07-29** |

## Afklaret uden fund

### UT-F01 — Dags-dato-knappen springes over ved Tab

**Indmeldt symptom:** Når fokus står i feltet før knappen »Indsæt dags dato«, springer Tab direkte over knappen.

**Resultat:** Symptomet er reelt, men adfærden har været tilsigtet fra knappens første implementering og er derfor
ikke registreret som en programfejl.

**Evidens:**

- `src/components/inputs/InsertTodayDateButton.tsx:30-36` dokumenterer og implementerer eksplicit
  `tabIndex={-1}`. Kommentaren klassificerer knappen som en musegenvej ved siden af datofeltet.
- `git blame` viser, at `tabIndex={-1}` stammer fra komponentens oprindelige commit `5cd9fb44` den 10. februar
  2026. Adfærden er således ikke en senere regression.
- `src/contracts/keyboard-navigation.md` fastlægger, at sideintegrerede handlingsknapper kun indgår i den normale
  feltsekvens ved eksplicit opt-in. Dags-dato-knappen har intet sådant opt-in.

**Konklusion:** I overensstemmelse med brugerens instruktion bortfalder symptomet. Det tæller ikke som et åbent
fund og medfører ingen anbefalet ændring.

## Indmeldte fund

Alle indmeldte fund er lukket: UT-F02–UT-F06 pr. 2026-07-28 (UT-F02 og UT-F06 i etape 7), UT-F07 og UT-F08 pr.
2026-07-29; UT-F01 blev afvist med evidens ovenfor. Hver enkelt bevarer sin fulde analyse, fordi analysen er
evidensen for løsningens form — ikke kun for at fejlen fandtes.

### UT-F02 — Enter på dropdown i tabel udløser grid-navigation

**Indmeldt symptom:** Enter på en dropdown uden for en tabel åbner menuen korrekt. Enter på en dropdown i en
tabel flytter i stedet fokus én tabelrække ned. En tabel-dropdown skal også åbne menuen.

**Genskabelse:** Genskabt deterministisk i en midlertidig integrationstest med den rigtige `GridChoiceCell`,
grid-controller og tabel-capture-handler:

1. render en grid-række med en `GridChoiceCell`,
2. fokusér dens element med `role="combobox"`,
3. send `Enter`,
4. kontrollér om dropdownens `listbox` åbnes.

Testen fejlede: ingen `listbox` fandtes, og comboboxen forblev `aria-expanded="false"`. Kommando:

```text
npx vitest run src/__tests__/components/tables/gridCellReentry.integration.test.tsx -t "MIDLERTIDIG REPRO"
```

Udfald: `1 failed`; den midlertidige test blev fjernet igen efter reproduktionen.

**Kerneårsag:**

- `StyledDropdown` kan selv åbne ved Enter, og dens formularvariant virker derfor korrekt.
- I en tabel modtager `handleTableKeyDownCapture` eventet før dropdownens egen `onKeyDown`.
- Tabelhandleren fritager kun en **lukket** dropdown fra Enter-navigation, hvis en forfader har
  `data-mineo-table-dropdown="true"` (`tableKeyboardNavigation.ts:311-312`).
- `GridChoiceCell` renderer den fælles `StyledDropdown`, men sætter ikke denne attribut.
- Tabelhandleren fortsætter derfor til sin generelle Enter-gren (`tableKeyboardNavigation.ts:368-380`), kalder
  `preventDefault()` og `stopPropagation()` og flytter fokus vertikalt. Dropdownens egen Enter-handler får aldrig
  eventet.

**Strukturel vurdering:** Dette er ikke bedst forstået som én manglende attribut. Det er et strukturelt brud i
ejerskabet af popup-semantik:

- `Container` klassificerer lukkede popup-kontroller ud fra deres ARIA-semantik (`role="combobox"` og
  `aria-haspopup`) og frigiver Enter korrekt.
- Grid-navigationen har sin egen parallelle klassifikation. Den bruger generisk ARIA-semantik, når en popup
  allerede er åben, men kræver den gamle komponent-specifikke attribut, mens popupen er lukket.
- `GridChoiceCell` erstattede den nu slettede `TableDropdown`, uden at den gamle private markør fulgte med.
- Flere sluttilstandsfiler beskriver fortsat `TableDropdown` som levende arkitektur:
  `gridUxSpec.ts`, `dropdownInteractionCore.ts` og kommentarer i `tableKeyboardNavigation.ts`. Det er
  migrationsrester og dokumentationsdrift, ikke kun en isoleret eventfejl.

**Berørte flader:** Alle aktuelle tabel-dropdowns går gennem `GridChoiceCell` og deler derfor årsagen:

- `BeregnetRenteTable`
- `EetAslAfgoerelserTable`
- `OffentligeYdelserTable`
- `SvieSmerteTable`

`EetAslAfgoerelserTable` har to dropdownkolonner. Problemet er dermed mindst fem konkrete dropdownflader fordelt
på fire tabeller.

**Mulige lignende afledte symptomer:**

- Enhver ny eller eksisterende lukket popup-kontrol i en grid-celle kan få sin aktiveringstast kapret, selv om
  den eksponerer korrekt ARIA-semantik.
- De samme gamle attributkontroller bruges i tabelmodulets pointer-, klik-, dobbeltklik- og blur-nære
  interaktionsveje. En `GridChoiceCell` identificeres heller ikke dér som dropdown. Klik åbner aktuelt menuen,
  men grid-controlleren kan samtidig føre intern celle-redigeringsbogføring for kontrollen. Mulige Escape-,
  genklik- eller fokusrestaureringssymptomer skal falsificeres særskilt; de er endnu hypoteser.
- Testnettet verificerer Enter på den fælles dropdown uden for tabeller og klik på `GridChoiceCell`, men mangler
  netop kontraktkrydset »lukket fælles dropdown + tabel-capture + Enter«. Derfor kunne både kontrakt og tests
  være grønne, mens den konkrete integration var brudt.

**Anbefalet strukturel løsning:**

1. Etablér én fælles, semantisk klassifikation af popup-widgets til både `Container` og grid-navigation.
2. Lad grid-navigationen frigive aktiveringstaster for en lukket popup ud fra den fælles kontrolsemantik, ikke
   ud fra navnet eller en privat attribut fra en slettet komponent.
3. Brug kun surface-specifik metadata, hvor grid'et reelt behøver information, som ARIA/control-semantikken ikke
   kan udtrykke.
4. Fjern eller omskriv alle levende `TableDropdown`-rester, så kode, kommentarer og `gridUxSpec` beskriver
   slutarkitekturen.
5. Gennemgå de øvrige marker-baserede dropdown-undtagelser samlet, især pointer/click/double-click, så samme
   kontrol ikke klassificeres forskelligt afhængigt af eventtype.

**Nødvendig regressionsdækning:**

- Enter og Shift+Enter på lukket `GridChoiceCell` åbner menuen og flytter ikke cellefokus.
- Enter på åben `GridChoiceCell` vælger den fremhævede option uden grid-navigation.
- Tab på lukket dropdown følger tabel-/Container-sekvensen; Tab på åben dropdown følger popup-kontrakten.
- Delete/Backspace følger `allowEmpty`-reglen uden at åbne menu eller flytte fokus.
- Første klik, gentaget klik, Escape og fokusretur efter lukning efterlader grid-controllerens celle-/edit-state
  konsistent.
- En fælles kontrakttest køres mod både formular- og grid-adapteren, så popup-semantikken ikke igen divergerer
  mellem surfaces.

**Konsekvens:** Forkert og inkonsistent tastaturadfærd; ingen beregningstal eller persisterede data er observeret
påvirket.

**Alvor:** Væsentlig.

**Kræver godkendelse:** Nej. Den ønskede brugeroplevelse er udtrykkeligt fastlagt af brugeren i indmeldingen og
er allerede normativ i `keyboard-navigation.md`.

**Status: Rettet 2026-07-28** (etape 7).

**Løsning: én fælles, ARIA-baseret popup-klassifikation.** Analysens punkt 1 og 2 er fulgt til punkt og prikke,
og efterprøvningen viste, at problemet var STØRRE end fundet beskrev.

**Markøren var ikke blot udeladt af `GridChoiceCell` — den blev ikke sat af NOGEN kode.** En repo-bred søgning
på `data-mineo-table-dropdown` fandt kun de SEKS steder, der LÆSTE den (Enter-fritagelsen, expanded-varianten
og pointer-/klik-/dobbeltklik-guards), og NUL steder der satte den. Attributten hørte til den slettede
`TableDropdown`; efter cutoveren var hver enkelt af de seks kontroller dermed inert. Det ændrer fundets
karakter: det er ikke "GridChoiceCell glemte en attribut", men "en privat markør fra en slettet komponent
efterlod grid'ets hele dropdown-kontrakt uden mål". `isTableDropdownExpanded` — en tredje kopi af
ARIA-opslaget, som KUN nåedes gennem markøren — var død i samme forstand.

**`popupWidgetSemantics.ts`** (`src/components/inputs/`) er nu den ene klassifikation af "er dette en
popup-kontrol, og er den åben?". Den måler udelukkende ARIA (`role="combobox"` / `aria-haspopup`, og
`aria-controls` kun sammen med åben tilstand — `aria-controls` alene er for bredt). Både `Container` og
grid-navigationen aftager den; de havde hver sin næsten-identiske kopi af `getWidgetHost` +
`getNearestExpanded`, som nu er væk. En ny popup-kontrol med korrekt ARIA klassificeres derfor rigtigt af
begge flader uden at skulle registreres nogen steder (analysens punkt 1–3).

**Punkt 5 — de øvrige eventtyper — er gennemført samlet, og hypotesen var reel.** Pointer-, klik- og
dobbeltklik-guards var inerte af samme grund, så grid'et førte to-trins-redigeringsbogføring for
dropdown-celler: `armClickEditableCell`/`openEditing` for en kontrol, hvis `prepareEditFromKey` er `false` og
hvis `commitCurrent` er en no-op — altså en "editor", der ikke findes. De tre callsites deler nu ét navngivet
prædikat (`ownsItsOwnPointerInteraction`), så en dropdown ikke kan klassificeres forskelligt afhængigt af
eventtype.

**Punkt 4 — sluttilstandssproget — er ryddet:** `gridUxSpec.dropdownContract` beskriver nu popup-celler og
deres ARIA-klassifikation frem for `TableDropdown` og markør-attributten; `dropdownInteractionCore`'s
"to implementeringer"-præmis er rettet til den ene, der findes; `GridChoiceCell`'s "erstatter legacy"-noter er
væk. `keyboard-navigation.md` §"Popup-widget detection" er strammet: den tillod tidligere "ARIA-semantik
**eller en anden tilsvarende, auditérbar mekanisme**" — præcis det hul, den private markør kom ind ad. Den
kræver nu ét sted, forbyder komponentnavn/markør/lokal kopi, og kræver samme klassifikation på tværs af
eventtyper.

**Dækning:** `popupWidgetKeyboardContract.integration.test.tsx` (7 tests) kører ÉN tabeldrevet popup-kontrakt
mod BEGGE surfaces gennem den ægte side-runtime, de ægte celler og den ægte capture-handler — analysens sidste
regressionspunkt. To rækker, så en kapret Enter faktisk KAN flytte fokus og altså er observerbar. Dækker
Enter, Shift+Enter, Enter på ÅBEN dropdown (vælg uden grid-navigation), typeahead, pointer-vejen og Delete.
AST-reglen `input/popup-semantics-single-source` håndhæver grænsen med to ben: ingen privat markør, og ingen
lokal kopi af ARIA-opslaget i en navigationsflade — det andet ben er nødvendigt, fordi en kopi ikke bruger
nogen markør og derfor ville slippe forbi det første.

**Mutationsbevis:** genindføres markør-klassifikationen i keydown-vejen, fejler 3 tests med brugerens præcise
symptom (ingen `listbox`, `aria-expanded="false"`); fjernes popup-grenen fra pointer-vejen, fejler netop
pointer-testen og ingen andre; begge guard-ben er mutationstestet hver for sig og bliver røde med fil:linje.

**Ærlig afgrænsning:** typeahead-benet skelner IKKE den nye klassifikation fra den gamle — dropdownens
`prepareEditFromKey` er også `false`, så grid'ets printbare gren ville frigive tasten alligevel. Popup-grenen
er defense-in-depth dér. Det står i testens egen dokumentation, så den ikke senere læses som stærkere evidens
end den er. Delete er bevidst FORTSAT grid-ejet (`gridUxSpec`-kontrakten giver grid'et ryd-tasten); det ben
pinner afgrænsningen af, hvad frigivelsen omfatter.

### UT-F04 — Tilføjelse af ansættelsesforhold crasher den nested løntabel

**Indmeldt symptom:** Ved forsøg på at tilføje et ansættelsesforhold vises den tekniske fejlvisning. Den centrale
fejl er:

```text
FieldDescriptor(col0_maaned): forventede 2 entity-id'er, modtog 1
```

Stacken går gennem `bindTemplatePath` → `useCellEditor` → `GridTextCell` → `StandardLoenTable` →
`AnsaettelsesforholdCard`.

**Genskabelse:** Fejlen er genskabt deterministisk i en midlertidig test med EO-feltsættet og præcis den binding,
som `StandardLoenTable` udfører:

1. opret `createEoStandardLoenFieldSet('af-1')`,
2. bind feltet `col0_maaned` med lønrækkens id `row-1`,
3. forvent, at løntabellens celle kan oprettes.

Testen fejlede med den samme fejltekst som brugerens stack:

```text
Error: FieldDescriptor(col0_maaned): forventede 2 entity-id'er, modtog 1
```

Kommando:

```text
npx vitest run src/__tests__/domain/erstatningsopgoerelse/eoStandardLoenFieldSet.test.ts -t "MIDLERTIDIG REPRO"
```

Udfald: `1 failed`; den midlertidige test blev fjernet igen efter reproduktionen.

**Den konkrete hændelseskæde:**

1. Et ansættelsesforhold oprettes med id `A`.
2. `AnsaettelsesforholdCard` bygger et EO-feltsæt med `createEoStandardLoenFieldSet(A)` og renderer den fælles
   `StandardLoenTable`.
3. Løntabellens rækker er nested: En celleadresse kræver både ansættelsesforholdets id `A` og lønrækkens id `R`.
4. `StandardLoenTable.buildCellSpec` binder eksisterende celler som `descriptor.bind(R)`.
5. For en placeholder sender tabellen det ubundne descriptor og `R` til `useCellEditor`, som også binder som
   `descriptor.bind(R)`.
6. `FieldDescriptor` håndhæver adressens aritet og afviser derfor begge stier: to id'er var påkrævet, ét blev
   leveret. Fejlen opstår allerede under render og fanges af React error boundary.

**Kerneårsag:** Den delte celletype modellerer dataidentitet forskelligt for eksisterende rækker og
placeholders:

- En eksisterende celle kan bære en fuldt bundet `FieldRef`, men `StandardLoenTable` antager lokalt, at alle
  tabeller kun har ét række-id.
- En placeholder må kun bære `FieldDescriptor` + ét `entityId`. `useCellEditor` binder selv feltet og har dermed
  den samme hardcodede antagelse om præcis ét entity-niveau.
- EO-feltsættet hævder i kommentarer, at descriptorerne bindes til ansættelsesforholdets id, men
  `createEoStandardLoenFieldSet` returnerer de rå descriptorer uændret. Read- og valideringsstierne binder
  korrekt med `(employmentId, rowId)`; kun den redigerende surface mangler ejeridentiteten.

Det er derfor ikke primært én glemt parameter i `AnsaettelsesforholdCard`. Den kanoniske cellegrænse kan ikke
repræsentere en placeholder i en nested collection.

**Strukturel vurdering:** Problemet er et tværgående kontraktbrud mellem feltadresse, tabeladapter og editor:

- `FieldRef` er den kanoniske redigeringsgrænse, men placeholder-celler fører igen et ubundet descriptor ind i
  React-editoren og lader editoren konstruere dataidentitet.
- `StandardLoenTableFieldSet` beskrives som parametriseret til både top-level Årsløn og nested EO-løn, men typen
  kan ikke udtrykke de nødvendige ejer-id'er eller en korrekt binder.
- Top-level Årsløn kræver kun række-id'et og har derfor skjult fejlen i den fælles tabel.
- `useCollectionTable` kender allerede `fieldOwnerIds` og bruger dem for eksisterende rækker, men taber dem
  igen for placeholders. Den samme strukturelle asymmetri findes dermed i den anden fælles tabeladapter.

**Berørte flader:**

- Hele `StandardLoenTable` under hvert ansættelsesforhold er ramt, både tom placeholder og allerede
  persisterede lønrækker samt alle redigerbare kolonner.
- De nested varianter af `LoenudviklingManuelTable` og `LoenudviklingManuelProcentsatsTable` under et
  ansættelsesforhold bruger `fieldOwnerIds={[af.id]}`. Eksisterende rækker bindes korrekt, men den tomme
  indtastningsrække går gennem den fejlende placeholder-kontrakt og vil derfor kunne udløse samme aritetsfejl,
  når den pågældende lønudviklingstilstand vises.
- De samme to manuelle tabeller bruges også top-level under »Indtægt før skaden«. De varianter kræver kun
  række-id og er derfor ikke ramt af netop denne aritetsfejl.

**Mulige lignende afledte symptomer:**

- En indlæst `.eo`-fil med ansættelsesforhold kan udløse fejlen ved første render uden, at brugeren først
  tilføjer en ny række.
- Skift af lønperiode eller tillægsvisning ændrer synlige kolonner, men ikke årsagen; enhver synlig celle i den
  nested standardløntabel kan være første crashsted.
- Enhver anden eller senere nested collection, som anvender `CellSpec`-placeholderen, vil fejle på samme måde.
- En lokal rettelse kun af eksisterende rækker vil efterlade tomrækken defekt; en lokal rettelse kun i
  `StandardLoenTable` vil efterlade de nested manuelle tabeller defekte.

**Kontrakt- og testdrift:**

- `eoStandardLoenFieldSet.test.ts` tester collection-ref, read-rekonstruktion og validering, men renderer eller
  binder aldrig en redigerbar celle.
- Testfilens og produktionsfilens kommentarer siger, at feltsættet binder celle-descriptorerne til
  ansættelsesforholdet. Testene beviser ikke udsagnet, og implementeringen gør det ikke.
- `Aarsloen.integration.test.tsx` dækker den delte tabel i dens top-level variant. Den kan ikke afsløre et
  manglende ejer-id.
- Der er ikke fundet en integrationstest, som tilføjer et ansættelsesforhold og renderer kortets standardløntabel.
- Runtime-guardens præcise fejl er korrekt fail-fast-adfærd; problemet er, at typningen og integrationstestene
  tillader en ugyldig binding at nå runtime.

**Anbefalet strukturel løsning:**

1. Lad både eksisterende celler og placeholder-celler bære en **fuldt bundet `FieldRef`**, konstrueret ved den
   collection-/tabelgrænse, som kender hele ejerstien.
2. Fjern binding af dataidentitet fra `useCellEditor`; hooken skal drive det allerede identificerede felt og
   kun tilføje placeholderens atomiske rækkeoprettelse.
3. Konsolidér den fælles celle-spec-bygger, så `StandardLoenTable`, `useCollectionTable` og lokale
   tabelimplementeringer ikke hver især kan vælge en forskellig bindingsmodel.
4. Lad typen gøre det umuligt at oprette en placeholder med et ubundet descriptor og kun det inderste
   række-id. Bevar runtime-guard som ekstra integritetsværn.
5. Ret de misvisende kommentarer og kontraktbeskrivelser samtidig, så de beskriver den faktisk håndhævede
   `FieldRef`-grænse.

En lokal tilføjelse af `employmentId` til ét `bind`-kald anbefales ikke: den reparerer hverken
placeholder-stien eller de andre nested tabeller og fastholder parallel dataidentitetskonstruktion.

**Nødvendig regressionsdækning:**

- Tilføj ansættelsesforhold og render hele kortet uden error boundary.
- Nested standardløntabel: tom placeholder, promotion, eksisterende række, alle lønperioder og alle
  betinget synlige kolonner.
- Nested manuel og manuel-procentsats: placeholder og eksisterende række.
- Samme fælles cellekontrakttest mod både top-level og to-niveau-nested collection.
- Indlæsning af gyldig `.eo` med ansættelsesforhold og lønrækker renderer og kan redigeres.
- Type-/kontrakttest, der forhindrer, at en ubundet descriptor igen bruges som React-cellens dataidentitet.

**Konsekvens:** En central EO-funktion kan ikke anvendes, og den berørte React-del crasher under render. Der er
ikke observeret datatab eller forkerte beregningstal, men indlæsning med eksisterende data skal behandles som en
trust-kritisk regressionsrisiko.

**Alvor:** Kritisk.

**Kræver godkendelse:** Nej. Rettelsen skal genskabe den allerede implementerede og tilsigtede funktion uden at
ændre brugerflow eller beregningsregler.

**Status:** **Rettet 2026-07-28.** Løst efter den anbefalede strukturelle retning, ikke lokalt.

**Gennemført løsning:**

1. Cellens dataidentitet konstrueres nu ÉT sted: `src/inputCore/react/cellSpecBuilder.ts`. Ejer-id'erne
   udledes af `collection.path` — den samme sti, `insertEntity` og readeren bruger — så en tabel ikke kan
   glemme ejeren. `collectionOwnerEntityIds` er den ene kilde.
2. `PlaceholderCell` bærer nu `field: FieldRef<T>` frem for `descriptor` + `entityId`, og `useCellEditor`
   binder ikke længere selv. Hooken driver kun det allerede identificerede felt og tilføjer placeholderens
   atomiske rækkeoprettelse. Den gamle fejlform er dermed udelukket af TYPEN, ikke jaget af en test.
3. Alle fem tabelflader (`useCollectionTable`, `StandardLoenTable`, `BeregnetRenteTable`,
   `EetAslAfgoerelserTable`, `OevrigeKravTable`) samt form-fladen `EntityChoiceField` bruger den fælles bygger.
   Typeændringen afslørede to yderligere kopier af den forkerte bindingsregel — `useGridCellSurface.cellFieldOf`
   og `GridChoiceCell`s restore-mål — begge fjernet.
4. Den redundante `fieldOwnerIds`-prop er slettet fra `useCollectionTable`, de to nested
   `Loenudvikling*`-tabeller og deres callsites: den var en parallel kopi af en kendsgerning, collectionen
   allerede bar, og netop den duplikation lod `StandardLoenTable` tage fejl.
5. De misvisende kommentarer i `eoStandardLoenFieldSet.ts` og `StandardLoenTable.tsx` — som hævdede, at
   feltsættet bandt descriptorerne til ansættelsesforholdet — er omskrevet til at beskrive den faktisk
   håndhævede grænse.

**Regressionsdækning (mutationstestet, ikke kun grøn):**

- `src/__tests__/inputCore/react/cellSpecBuilder.test.ts` — 11 tests: ejer-udledning top-level/nested/flere
  led, identisk adresse for eksisterende og placeholder på samme række-id, hele kolonnesættet i den nested
  collection, og kollisionsfri editorlokation pr. ejer.
- `src/__tests__/components/pages/erstatningsopgoerelse/Loenindkomst.nestedLoentabel.integration.test.tsx` —
  2 tests: hele kortet renderes uden error boundary både med TOM løntabel (brugerens handling) og med
  committede lønrækker (den indlæste `.eo`-risiko).
- AST-reglen `input/cell-binding-single-source` i `rules/inputBoundaryRules.ts`: en tabelflade må ikke selv
  kalde `descriptor.bind(...)`. Typen dækker ikke den rest — en tabel kunne binde korrekt formet men
  ejer-løst — så reglen holder fladerne på den fælles vej.

Mutationsbevis: sættes bindingen tilbage til ét entity-id, fejler 6 af de 11 kontrakttests og BEGGE
integrationstests med brugerens præcise fejltekst
`FieldDescriptor(col0_maaned): forventede 2 entity-id'er, modtog 1`. Genindføres en lokal `bind()` i en
tabelflade, bliver AST-reglen rød med fil:linje. Fuld suite efter rettelsen: 495 filer / 6188 tests grøn;
`typecheck` og `typecheck:test` grønne.

**Afledt tilfældighedsfund:** INC-F01 (nested løntabeller delte editorlokation på tværs af
ansættelsesforhold) blev konstateret under rettelsen og rettet samtidig — se
`docs/review/draft-commit-review/fund-oversigt.md`.

**Rest til etape 6:** placeholder-identitetens livscyklus (stabile id'er, kollision efter promotion,
`minimumVisibleRows`) findes fortsat i fem udgaver. Kun cellebindings-halvdelen af GM-F14 er lukket her;
resten hører sammen med UT-F03.

### UT-F05 — Dags-dato-knappen sender en ulovlig immediate-kommando

**Indmeldt teknisk hændelse:** Samme fejlrapport indeholder en ældre, separat hændelse:

```text
Uncaught Error: InputReducer: setImmediateField er kun tilladt for choice/toggle
```

Rapporten angiver ikke den udløsende brugerhandling. Hændelsen er derfor ikke henført til tilføjelsen af
ansættelsesforholdet.

**Genskabelse og evidens:** Reducerens fejlmekanisme er dækket og genskabt af den eksisterende målrettede test
»afviser immediate commit på tekstfelter og værdier uden for codecets kontrakt«:

```text
npx vitest run src/__tests__/inputCore/inputCore.test.ts -t "afviser immediate commit på tekstfelter"
```

Udfald: `1 passed`. Testen beviser, at et `setImmediateField` mod et tekstfelt deterministisk kaster den
rapporterede `choice/toggle`-fejl.

Repo-sporet viser samtidig en fuld produktionsvej til præcis kommandoen:

1. Alle datofelterne er deklareret med `controlKind: 'text'`.
2. `InsertTodayDateButton` kalder sidens callback med dags dato.
3. Fem sider videresender værdien til feltcontrollerens `commitImmediate(today)`.
4. `useFieldEditor.commitImmediate` bygger `setImmediateField`.
5. `inputReducer.reduceImmediateChoice` afviser tekstfeltet med præcis den rapporterede fejl.

**Kerneårsag:** Den fælles feltcontroller eksponerer `commitImmediate` som en generisk metode, selv om dens
kontrakt kun tillader dropdown, toggle og radio. Dags-dato-integrationen bruger metoden som en generel
»commit en allerede kendt værdi«-genvej og omgår dermed tekstfeltets settle-sti. Runtime-reduceren håndhæver
kontrakten korrekt, men API'et og callsites gør det let at bryde den.

**Strukturel vurdering:** Dette er ikke en fejl i datoformatet eller i én side:

- Form-kernereglen tillader kun immediate commit for valg/toggle/radio samt den særskilte immediate clear.
  Programmatisk indsættelse af dato er et tekstinput og skal igennem samme parse-/settle-semantik som en
  brugerindtastet dato.
- Controllerens generiske TypeScript-signatur kan ikke skelne tekstfelter fra choice/toggle-felter, så ugyldig
  brug opdages først under brugerhandlingen.
- Den samme forkert valgte kommando er kopieret til alle fem dags-dato-integrationer.

**Berørte flader:** Klik på »Indsæt dags dato« kan udløse fejlen i:

- Varigt mén
- Renteberegning
- Forsørgertab
- Erhvervsevnetab
- Erstatningsopgørelsens felt »Opgørelse lavet den«

**Mulige lignende afledte symptomer:**

- Hvis et datofelt har en åben draft, kan et fejlet knapklik efterlade draft/fokus i en vanskelig
  mellemtilstand, fordi dispatch kaster, før controlleren når sin normale lukning.
- Andre action-knapper kan senere genbruge `commitImmediate` til tekst-/tal-/datofelter og få samme crash.
- En løsning, der blot tillader tekst i `setImmediateField`, kan skabe en større kontraktfejl ved at omgå
  codec-settle, rejected-input-XOR, history-origin og eventuel relevant oprydningssemantik.

**Anbefalet strukturel løsning:**

1. Indfør én eksplicit controllerkommando til at settle en leveret tekstværdi gennem feltets normale codec- og
   settle-motor; dags-dato-knappen skal bruge denne vej.
2. Begræns `commitImmediate` typemæssigt eller opdel controllerfacaderne, så text-controls ikke eksponerer en
   choice/toggle-kommando.
3. Bevar reducerens fail-fast-guard; den må ikke lempes til at acceptere vilkårlige tekstfelter.
4. Migrér alle fem callsites samlet og søg efter øvrig misbrug af samme controllerkommando.

**Nødvendig regressionsdækning:**

- Klik på hver af de fem dags-dato-knapper committer en canonical dato, opretter ét history-trin og kaster ikke.
- Undo/redo gendanner dato og fokus korrekt.
- Åben gyldig og rejected draft håndteres deterministisk ved knapklik efter den valgte settle-/erstatningsregel.
- Den programmatisk leverede dato går gennem samme codec og validering som manuel indtastning.
- Text-controls kan ikke kalde choice/toggle-immediate-vejen; reducerens runtime-test bevares.

**Konsekvens:** En delt handlingsknap kan udløse en uncaught systemfejl på fem sider. Der er ikke observeret
datatab eller forkerte beregningstal.

**Alvor:** Væsentlig.

**Kræver godkendelse:** Nej for at føre dags-dato-knappen gennem den eksisterende settle-semantik. Hvis
knapklik på en allerede åben draft kræver en ny synlig konflikt-/erstatningsadfærd, skal den konkrete
brugeroplevelse dog forelægges.

**Status:** **Rettet 2026-07-28.** Løst efter den anbefalede strukturelle retning (punkt 1, 2 og 4), ikke lokalt.

**Gennemført løsning:**

1. Der findes nu ÉN eksplicit controllerkommando til at afslutte et felt med en programmatisk leveret værdi:
   `FieldEditorController.settleValue(value)`. Den formaterer værdien med feltets eget codec og sender den
   gennem den NORMALE settle-vej — samme parse, samme XOR-invariant (§1.5), samme ét-history-trin med
   felt-origin (§3.7) og samme placeholder-promotion som en tastet værdi. `setImmediateField` bruges ikke.
2. State-machinen fik den tilsvarende rene transition `settleEditorWithText` (`fieldEditorState.ts`). Den
   leverede tekst ERSTATTER en eventuel åben draft: knappen er en eksplicit afslutningshandling, så den
   halvskrevne draft er netop det, brugeren beder om at få overskrevet.
3. `useFieldEditor` har nu ÉN settle-udgang (`dispatchSettleIntent`), som både `settle()` og `settleValue()`
   går igennem. Override, dispatch-rækkefølge og lukning kan derfor ikke divergere mellem de to indgange.
   §3.5-friskhedsguarden gælder begge veje: en ÅBEN editor på en erstattet revision settler ikke.
4. Alle fem callsites er migreret samlet: Forsørgertab, Varigt mén, Renteberegning, Erhvervsevnetab og
   Erstatningsopgørelsens »Opgørelse lavet den«.
5. Reducerens fail-fast-guard er BEVARET uændret — den er ikke lempet til at acceptere tekstfelter.

**Regressionsdækning (mutationstestet, ikke kun grøn):**

- `src/__tests__/components/pages/insertTodayDateButton.contract.integration.test.tsx` — 10 tests: ÉN
  tabeldrevet kontrakt over alle fem flader (2 tests pr. flade), kørt gennem de ægte sider og den ægte
  produktions-runtime. Hver flade måles på det autoritative afsluttede input, læst gennem feltets egen
  descriptor, og på at klikket giver ét undo-trin med en felt-origin. Testen lytter samtidig på `window`'s
  `error`, så en uncaught dispatch-fejl fejler testen på brugerens præcise symptom.
- `src/__tests__/inputCore/react/useFieldEditor.test.tsx` — 7 nye tests: programmatisk settle af et
  TEKSTFELT, kontrasten at `commitImmediate` på samme felt afvises af reduceren, ét history-trin med
  felt-origin, codec-vejen, draft-erstatning, §3.5-friskhed og settle på et lukket felt.
- AST-reglen `input/programmatic-commit-uses-settle` i `rules/inputBoundaryRules.ts`: et `commitImmediate`
  inde i en handlingsknaps `onCommit` er forbudt. Reglen er bevidst scopet til attributtens subtree, så
  Årslønssidens LOVLIGE toggle-immediate-commit ikke rammes.

Mutationsbevis: sættes ét callsite tilbage til `commitImmediate(today)`, fejler netop den fladens 2
integrationstests med brugerens præcise fejltekst
`InputReducer: setImmediateField er kun tilladt for choice/toggle`, mens de øvrige fire flader forbliver
grønne — og AST-reglen bliver rød med fil:linje:kolonne. Fuld suite efter rettelsen: 496 filer / 6207 tests
grøn; `typecheck`, `typecheck:test` og `lint` grønne.

**Vurderet og bevidst ikke gjort:** løsningsforslagets punkt 2 nævner som alternativ at begrænse
`commitImmediate` TYPEMÆSSIGT. Det ville kræve, at `controlKind` føres ind i `FieldDescriptor`/`FieldRef`s
TYPE og dermed røre 236 referencer. Prisen svarer ikke til gevinsten, når reduceren allerede fejler fail-fast
på præcis den overtrædelse, og den ene påviste fejlform nu er dækket af både en fælles kommando og et
AST-værn. Vurderingen er noteret her frem for kun i en commitbesked.

Den konkrete brugerhandling bag loggen kl. 12:55 kan fortsat ikke fastslås ud fra fejlrapporten alene; det
ændrer ikke, at produktionsvejen til kommandoen er lukket.

**Afledt tilfældighedsfund:** INC-F02 (`INSERT_TODAY_DATE_EVENT` var en død sidekanal uden lytter) blev
konstateret under rettelsen og rettet samtidig — se `docs/review/draft-commit-review/fund-oversigt.md`.

### UT-F06 — Års-placeholder viser en valideringsgrænse

**Indmeldt symptom:** På siden »Årslønsberegning« viser årscellerne i tabellen »Indtægtsoplysninger«
placeholderen `åååå (≤2026)`. Det er forkert. Placeholders skal kun vise den rene forventede værdis form, fx
`mm`, `åååå` og `0,00 kr.`, og må ikke angive min-/maxgrænser eller andre begrænsninger for inputtet.

**Genskabelse:** Genskabt deterministisk i en midlertidig integrationstest mod den faktiske
`Aarsloen`-side:

1. render en tom Årsløn-sag med lønperioden »Måned«,
2. find første datarækkes celle under »År«,
3. aflæs inputelementets placeholder,
4. forvent den rene formatværdi `åååå`.

Testen fejlede:

```text
Expected: "åååå"
Received: "åååå (≤2026)"
```

Kommando:

```text
npx vitest run src/__tests__/components/pages/Aarsloen.integration.test.tsx -t "MIDLERTIDIG REPRO"
```

Udfald: `1 failed`; den midlertidige test blev fjernet igen efter reproduktionen.

**Kerneårsag:** `StandardLoenTable` konstruerer års-placeholderen lokalt som
`åååå (≤${CURRENT_YEAR})`. Visningslaget kobler dermed placeholderens formatvejledning direkte til en
dynamisk valideringsgrænse. `CURRENT_YEAR` importeres i tabellen alene til denne tekst.

Fejlen blev indført ved greenfield-cutoveren i commit `cce46102`. Den tidligere `TableYearInput` havde den rene
default `åååå`; den nye `GridYearCell` fik ingen semantisk default, og tabellen erstattede den lokalt med den
grænsebærende tekst. Det er derfor en migrationsregression og ikke en oprindelig produktregel.

**Strukturel vurdering:** Den konkrete grænsetekst findes kun ét sted, men årsagen er bredere end én streng:

- Rene format-placeholders ejes i dag inkonsistent. `GridDateCell`, `GridAmountCell` og `GridPercentCell` har
  fælles defaults, mens `GridYearCell` og `GridWeekCell` ikke har nogen.
- `StandardLoenTable` udfylder derfor måned og år lokalt, men efterlader ugeceller uden deres tidligere rene
  default `uu/åååå`.
- Samme tabel kan midlertidigt erstatte format-placeholderen i enhver periodecelle med teksten
  `Indtastning mangler`. Det er et beslægtet brud på den nu fastlagte regel om, at placeholderen kun beskriver
  værdiens form. En manglende-værdi-indikation er valideringsfeedback og bør ikke overtage placeholderens
  semantiske ansvar.
- Grænser hører allerede hjemme i feltissues og tooltips. At gentage en delmængde i placeholderen giver to
  konkurrerende beskrivelser, og den årstalsafhængige tekst ændrer sig desuden med kalenderåret.

**Berørte flader:**

- Fejlen er synlig på Årslønsberegningens månedstabel.
- `StandardLoenTable` deles med løntabellen under et ansættelsesforhold i Erstatningsopgørelse. Når UT-F04 er
  rettet, vil samme års-placeholder være synlig dér.
- Ugevarianten på begge flader har mistet den tidligere rene `uu/åååå`-placeholder ved samme migration.
- `Indtastning mangler` kan erstatte placeholderen i måned-, år-, uge- og datoperiodeceller efter tabelhandle-
  feedback og er derfor en parallel afledt variant af problemet.

**Repo-bred afgrænsning:** En søgning efter `≤`/`≥` i brugte placeholder-definitioner fandt ingen andre
grænsebærende placeholders. Dato-placeholders i `dateRanges` er konsekvent `dd-mm-åååå`, og beløbs- og
procentfamilierne bruger rene centrale defaults. Den konkrete grænsetekst er således lokal; det inkonsistente
ejerskab af format-placeholders er strukturelt.

**Anbefalet strukturel løsning:**

1. Definér den rene placeholder ved den semantiske feltfamilie: mindst `åååå` for år, `uu/åååå` for uge,
   `dd-mm-åååå` for dato og de eksisterende centrale tal-/beløbsformater.
2. Lad tabeller kun override en placeholder, når feltets domæne har en reelt anden **formatrepræsentation**,
   fx månedens `mm`; aldrig for at vise bounds, validering eller status.
3. Fjern `CURRENT_YEAR` fra `StandardLoenTable` og hold alle min-/maxoplysninger i det kanoniske issue-/tooltip-
   flow.
4. Flyt `Indtastning mangler` ud af placeholderkanalen. Bevar den nødvendige fokus/scroll/visuelle feedback via
   tabelhandle- og issue-mekanikken uden at ændre feltets formatvejledning.
5. Fastlæg reglen i den relevante felt-/UI-kontrakt, så placeholders og valideringsbeskeder ikke igen blandes
   ved en migration.

**Nødvendig regressionsdækning:**

- Månedstabellen viser `mm` og `åååå` uden årstal eller grænsesymboler.
- Ugetabellen viser den rene uge-/år-form; dagstabellen viser `dd-mm-åååå`.
- Beløbsfelter viser den centrale rene beløbs-placeholder sammen med `kr.`-adornmentet.
- Samme assertions køres mod både Årsløn og den delte EO-løntabel.
- Ændring af `CURRENT_YEAR` påvirker valideringsissue/tooltips, men aldrig placeholderteksten.
- Manglende tabeldata kan fortsat lokaliseres visuelt uden at erstatte format-placeholderen.

**Konsekvens:** UI'et blander formatvejledning og valideringsgrænse og afviger fra den ønskede ensartede
placeholder-semantik. Input, beregninger og persistence er ikke påvirket.

**Alvor:** Mindre.

**Kræver godkendelse:** Nej. Brugeren har udtrykkeligt fastlagt den ønskede placeholder-adfærd. En eventuel ny
synlig erstatning for teksten `Indtastning mangler` skal dog forelægges, hvis eksisterende fokus/flash-feedback
ikke kan bevare samme konkrete brugeroplevelse.

**Status: Rettet 2026-07-28** (etape 7).

**Løsning: den rene form ejes af feltfamilien.** `src/utils/fieldFormatPlaceholders.ts` er nu den ene kilde til
`åååå` / `uu/åååå` / `dd-mm-åååå` / `mm` / `dd`, ved siden af de eksisterende
`DEFAULT_AMOUNT_PLACEHOLDER`/`DEFAULT_PERCENT_PLACEHOLDER`. `GridYearCell`, `GridWeekCell`, `GridDateCell`,
`YearField`, `WeekField` og `DateField` bærer den som DEFAULT (analysens punkt 1), så en tabel ikke længere kan
— eller behøver — udfylde formen selv.

**Punkt 2 og 3 er gennemført:** `StandardLoenTable` override'er nu KUN månedscellens `mm`, som er en ægte
formatrepræsentation (heltalsfamilien kender ikke måned-formen). Årscellens `åååå (≤${CURRENT_YEAR})` er væk,
og `CURRENT_YEAR`-importen med den; grænsen står i feltets issue/tooltip, hvor den hørte hele tiden. Uge- og
datocellernes rene former, som migreringen havde fjernet, kommer nu fra familien uden en prop på callsitet.
`BeregnetRenteTable`s redundante `placeholder="0,00"` (= beløbsfamiliens default) er også væk.

**Punkt 4 — `Indtastning mangler` ud af placeholder-kanalen — brugergodkendt 2026-07-28.** Markeringen bruger nu
tabellens EKSISTERENDE visuelle idiom: `getCellStyle` giver den pegede celle samme `errorFlash`-animation som
`flashError`, oven i den scroll-into-view der allerede var der. Ingen ny visuel mekanik, og placeholderen viser
fortsat kun formen. Markeringen er stadig ikke en feltfejl (§1.7) — den gør ikke feltet rødt og blokerer intet,
og `missingCell`-effecten rydder den, så snart værdien er indtastet.

**Punkt 5 — reglen er fastlagt normativt** i `form-contract.md` §8.1: en placeholder er formvejledning og intet
andet; grænser hører i issue/tooltip; formen ejes af feltfamilien, og en callsite må kun override for en reelt
anden FORMATREPRÆSENTATION. Placeret som underafsnit til §8 (Format, bounds og save-gate), hvor bounds-reglen
i forvejen står — så de to beskrivelser af samme felt står side om side og ikke igen kan drifte fra hinanden.

**Repo-bred efterprøvning bekræftede fundets afgrænsning og udvidede den lidt:** ingen andre grænsebærende
placeholders findes. `dateRanges.ts` bar dog 33 `placeholder: 'dd-mm-åååå'`-felter, som INGEN kode læste
(INC-F08) — de er slettet sammen med de fem typefelter, der erklærede dem.

**Dækning:** fem nye tests i `Aarsloen.integration.test.tsx` gennem den ÆGTE side og den ægte runtime, fordi
det netop var VISNINGSLAGET der koblede grænsen på — en unittest af feltfamilien ville have været grøn hele
tiden. Måned/år, uge og dag hver for sig, beløbsformen + kr.-adornmentet, samt et bredt værn: INGEN placeholder
i tabellen må bære et grænsesymbol (`≤≥<>`) eller et fircifret årstal, så et nyt grænsebærende udtryk et
vilkårligt sted gør testen rød uden at nogen skal huske en case. Dertil `«Indtastning mangler» overtager IKKE
placeholderen`, som driver den ægte kæde omregnings-toggle → tabellens handle → markering, og
`fieldFormatPlaceholders.test.ts` (5 tests), der pinner konstanterne mod grænsesymbol, årstal, enhed og
statusbesked.

**Mutationsbevis:** genindføres `placeholder={\`åååå (≤${...}\`}` på årscellen, fejler 2 tests med brugerens
præcise streng (`Expected "åååå" / Received "åååå (≤2026)"`) — både den konkrete og det brede værn. Fjernes
`isMissing` fra `getCellStyle`, fejler netop markerings-testen og ingen andre.

### UT-F03 — Undo af en rækkes første commit mister cellefokus

**Indmeldt symptom:** På EO-oplysninger udfyldes en række i tabellen »Svie og smerte / Periode« med kolonnerne
»Fra o.m.«, »Til o.m.«, »Antal dage« og »Tilstand«. Når undo-sekvensen når den første værdi, der oprettede
rækken, fjernes rækken korrekt, men ingen celle har derefter fokus. Fokus skal blive i den tilsvarende celle i
den nu tomme indtastningsrække; hvis den fjernede værdi var øverst under »Fra o.m.«, skal den celle fortsat have
fokus.

**Genskabelse:** Den præcise restore-fejl er genskabt deterministisk i en midlertidig integrationstest af det
fælles fokusopslag:

1. history-origin peger på feltet `fra` i den promoverede række,
2. rækken er efter undo ikke længere i DOM,
3. den aktuelle placeholder har samme collection/felt/kolonne, men et nyt række-id og dermed en anden
   feltadresse og editorlokation,
4. `findRestoreTarget` forsøges mod originen.

Testen forventede den aktuelle placeholder som fokusmål, men modtog `null`. Kommando:

```text
npx vitest run src/__tests__/inputCore/react/historyRestoreTarget.test.tsx -t "MIDLERTIDIG REPRO"
```

Udfald: `1 failed`; den midlertidige test blev fjernet igen efter reproduktionen.

**Den konkrete hændelseskæde:**

1. Den tomme indtastningsrække har placeholder-id `P`.
2. Første ikke-tomme settle i en celle promoverer `P` atomisk til en persisteret række. History-frame'et får
   korrekt en felt-origin med rækkens feltadresse og editorlokation.
3. Tabellen skal fortsat vise en tom trailing række. `useCollectionTable` ser derfor, at `P` nu er committet,
   genererer placeholder-id `Q` og **overskriver** sin eneste gemte placeholder-identitet
   (`useCollectionTable.ts:50-55`).
4. Når undo senere når promoverings-committet, gendannes førtilstanden uden række `P`. Rækken fjernes korrekt,
   mens den viste placeholder fortsat er `Q`.
5. Fokusrestoren kræver et eksakt match på både `P`'s feltadresse og `P`'s editorlokation
   (`historyRestoreTarget.ts:64-70`). Intet sådant element kan længere mounte.
6. Restore-løkken prøver 15 frames og giver derefter lydløst op
   (`historyTargetRestoreLoop.ts:12,119`). Det fokuserede element er samtidig blevet unmountet, så fokus ender
   uden for tabelcellerne.

**Kerneårsag:** History- og restore-identiteten er korrekt præcis, men den fælles placeholder-livscyklus
destruerer den UI-identitet, som et promotion-undo senere skal genskabe. Problemet er dermed ikke, at restore
»glemmer at kalde focus«; restore får et mål, som tabellen har gjort umuligt at finde.

**Strukturel vurdering:** Problemet ligger i den fælles grænse mellem dynamiske rækker, placeholder-promotion og
history-restore:

- `FieldHistoryOrigin` lover, at en promotion-undo fokuserer præcis den celle, brugeren skrev i.
- `useCollectionTable` kan kun huske den seneste placeholder og kan derfor ikke demotere en fjernet række-id
  tilbage til den oprindelige placeholder-identitet.
- Tre større tabelimplementeringer (`StandardLoenTable`, `BeregnetRenteTable` og
  `EetAslAfgoerelserTable`) har hver sin lokale placeholder-pulje. De bevarer tidligere placeholder-id'er og
  kan derfor genbruge et promoveret id, når undo fjerner rækken igen. Samme concern er således løst på to
  måder.
- Den gamle, nu ubrugte `reconcileGridRowIdentityForRestore` indeholder fortsat en separat
  `undoAliasRowIdsByRowId`-model. Ingen produktionsflade bruger den, men flere tests vedligeholder stadig
  mekanismen. Det er yderligere parallelitet og testdækning af død arkitektur.

**Berørte flader:** Alle seks tabeller, der bruger `useCollectionTable`, deler den fejlende placeholder-model:

- `SvieSmerteTable`
- `TafPeriodeTable`
- `FerieperiodeTable`
- `OffentligeYdelserTable`
- `LoenudviklingManuelTable`
- `LoenudviklingManuelProcentsatsTable`

`OevrigeKravTable` har en lokal kopi af den samme enkelt-id-model og er derfor en syvende berørt tabel.

De tre tabelimplementeringer med lokale placeholder-puljer er ikke påvist ramt af netop denne identitetsfejl,
men deres adfærd er ikke dækket af en fælles promotion→undo→fokus-kontrakttest og skal efterprøves.

**Kontrakt- og testdrift:**

- `undo-redo-contract.md` §1 og §5 kræver, at et felt-/celle-commit gendanner præcis editorlokation.
- `fieldEditorEngine.ts` fastslår udtrykkeligt, at placeholder-promotion skal have en felt-origin, så undo
  fokuserer den skrevne celle.
- Testen i `dispatchInput.test.ts:469-490` hedder »undo fokuserer den skrevne celle«, men verificerer kun, at
  `restoredOrigin` returneres uændret fra runtime. Den renderer ingen demoteret tabelrække og beviser intet om
  faktisk DOM-fokus.
- `historyRestoreTarget` tester det eksakte match isoleret, mens celle-attributtestene kun tester en celle, der
  fortsat eksisterer. Ingen test krydser promotion, undo, row-unmount, placeholder-remount og endeligt fokus.
- Et tidligere review anbefalede eksplicit test af »undo/redo af promotion«
  (`docs/reviews/codex-fase34-review.md:59-67`). Den efterfølgende lukning dækkede, at originen findes, men ikke
  at dens fokusmål kan eksistere efter undo. Den observerede fejl er derfor et ufuldstændigt lukket,
  tidligere kendt risikoscenarie.

**Mulige lignende afledte symptomer:**

- Redo efter promotion-undo kan fokusere inkonsistent, afhængigt af om `P` igen findes som committet række, mens
  den aktive placeholder stadig er `Q`.
- Flere promotioner og efterfølgende undo i samme tabel kan miste fokus på hvert trin, fordi hver promotion
  overskriver det eneste huskede placeholder-id.
- Samme symptom kan opstå ved første commit i enhver kolonne, også dropdownkolonner med immediate commit og
  rejected første settle; fejlen afhænger af rækkens identitet, ikke feltets codec.
- Navigation til den korrekte side/fane lykkes fortsat, men fokus kan mangle. En test, der kun kontrollerer
  route/fane eller `restoredOrigin`, vil derfor fejlagtigt se grøn ud.

**Anbefalet strukturel løsning:**

1. Gør placeholder-identitet til ét fælles ansvar for alle dynamiske tabeller.
2. Bevar en ordnet pulje af placeholder-id'er på tværs af promotion og undo, så et id, der ikke længere er
   committet, igen kan blive UI-placeholder. Den eksisterende puljeadfærd i de tre større tabeller er et
   konkret mønster, der skal vurderes og konsolideres frem for at skabe en tredje restore-model.
3. Hold dataidentiteten (`FieldAddress`) præcis. Undgå fallback til »samme kolonne« via DOM-geometri,
   streng-parsing af `editorLocationId` eller vilkårligt første felt; det kan fokusere forkert række efter
   sortering eller ved flere placeholders.
4. Fjern den døde alias-/normaliseringsarkitektur og dens tests, når den levende placeholder-livscyklus dækker
   restore-invarianten.
5. Lad den fælles løsning håndtere både én og flere synlige placeholder-slots, nested collections og sorteret
   visning.

**Nødvendig regressionsdækning:**

- Første settle i en placeholder promoverer rækken; undo fjerner rækken og fokuserer samme celle som
  placeholder.
- Samme test for tekst/dato/tal, rejected settle og immediate-commit-dropdown.
- Redo genopretter rækken og fokuserer samme celle.
- To eller flere efterfølgende promotioner kan undo/redo'es med korrekt fokus på hvert trin.
- Sorteret tabel og tabel med flere minimum-placeholders bevarer korrekt række-/slotmål.
- Route-/faneskift før undo venter på mount og fokuserer derefter den demoterede placeholder.
- En fælles kontrakttest køres mod både `useCollectionTable`-tabellerne og de hidtil lokale
  placeholder-puljeimplementeringer.

**Konsekvens:** Fokus forsvinder efter en gyldig undo-handling, så tastaturflowet brydes. Input og history
gendannes korrekt; der er ikke observeret datatab eller påvirkning af beregningstal.

**Alvor:** Væsentlig.

**Kræver godkendelse:** Nej. Den ønskede fokusadfærd er udtrykkeligt fastlagt af brugeren i indmeldingen og er
allerede normativ i `undo-redo-contract.md`.

**Status: Rettet 2026-07-28** (etape 6, sammen med GM-F14 — samme mekanisme).

**Løsning: én delt, BEVARENDE placeholder-identitets-livscyklus.** Analysen pegede præcist på årsagen —
`useCollectionTable` kunne kun huske det SENESTE placeholder-id og kunne derfor ikke demotere et fjernet
række-id tilbage til dets oprindelige identitet. `usePlaceholderSlotIds`
(`src/inputCore/react/placeholderSlots.ts`) er nu den ene livscyklus: hvert slot husker sit id, OGSÅ efter at
id'et er blevet committet, så forsvinder det igen fra de committede rækker (undo), genindtræder det på sin
oprindelige plads med præcis den identitet, `findRestoreTarget` leder efter.

Reglen er formuleret som "et slots id er stabilt, indtil slottet forsvinder" — ikke "genbrug hvis muligt".
Det gør også en åben celleeditor sikker: identiteten skifter ikke under redigering, heller ikke når en
naborække promoveres.

Analysens punkt 2 pegede på de tre større tabellers eksisterende puljeadfærd som "et konkret mønster, der
skal vurderes og konsolideres frem for at skabe en tredje restore-model". Det er fulgt: puljen ER det mønster,
generaliseret. Alle fem implementeringer er migreret — `useCollectionTable` (og dermed dens seks tabeller),
`StandardLoenTable`, `EetAslAfgoerelserTable`, `BeregnetRenteTable` og `OevrigeKravTable`, hvis lokale kopi
bar SAMME enkelt-id-defekt som `useCollectionTable` og altså var en femte berørt tabel. `minimumVisibleRows`
bærer den eneste saglige forskel (antal synlige tomme rækker), så antalsreglen ikke længere begrunder en kopi
af identitetsalgoritmen (GM-F14).

Analysens punkt 3 er overholdt: der er INGEN fallback til "samme kolonne" via DOM-geometri eller
streng-parsing af `editorLocationId`. Fokusrestoren matcher fortsat eksakt på feltadresse + editorlokation;
det, der ændrede sig, er at målet nu KAN eksistere.

**Punkt 4 — den døde alias-arkitektur — er fjernet.** `reconcileGridRowIdentityForRestore` (med sin
`undoAliasRowIdsByRowId`-model) og `normalizeGridRows` havde nul produktionscallsites og blev holdt i live af
tre testfiler. Begge er slettet sammen med `createEmptyRowId`, hvis determinismekrav var en egenskab ved
netop den slettede mekanisme (id'et blev dannet i en dobbelt-invokeret `setState`-updater). `gridRowIdContract
Guard` er omskrevet fra at bevogte den døde vej til at bevogte den levende — dens egen første assertion sagde
i forvejen, at ingen produktionstabel brugte `normalizeGridRows`, mens de følgende assertions fortsat målte
netop den.

**Dækning:**
- `placeholderSlots.test.ts` (8 tests): livscyklussen som ren funktion — stabilitet, promotion, genindtræden,
  flere promoveringer i rækkefølge, flere slots, at naboslots bevarer id, og at puljen ikke vokser ubegrænset.
- `placeholderPromotionUndoFocus.integration.test.tsx` (4 tests) gennem den ÆGTE `useCollectionTable`, de
  ægte greenfield-celler og den ægte runtime: promotion → undo → `findRestoreTarget` finder cellen. Dækker
  tekstcelle, immediate-commit-dropdown, to promoveringer med to undo, og en tabel med flere synlige tomme
  rækker. Det var netop denne kæde, ingen eksisterende test krydsede.
- `gridRowIdContractGuard` binder nu værnet til den levende mekanisme, inkl. en runtime-bekræftelse af
  unikhed + genindtræden.

**Mutationsbevis:** gendannes den gamle "kast det promoverede id væk"-model i puljen, fejler 7 af 12 tests —
alle fire integrationstests gennem den ægte tabel plus de tre livscyklus-tests, der hævder genindtræden. En
genindført lokal `placeholderIdsRef`/`placeholderIdRef` i en tabel gør AST-lignende struktur-guarden rød med
fil:linje.

**Bevidst udestående:** de resterende regressionspunkter i analysens liste — rejected settle som første
commit, route-/faneskift før undo, og sorteret tabel — er IKKE tilføjet som separate cases. Begrundelsen er,
at de alle afhænger af rækkens IDENTITET og ikke af feltets codec eller af navigationen: identiteten er nu
bevist bevaret af de fire flader ovenfor, og dropdown-casen dækker allerede en anden commit-art. Det er en
afgrænsning af dækningen, ikke af rettelsen.

### UT-F07 — Download-gate-årsagen vises både som tekst og som tooltip

**Indmeldt symptom:** På Varigt mén vises ved en deaktiveret download-knap BÅDE et tooltip ved hover og en
identisk tekst foran knappen — begge med »Indtastning mangler«. Der skal kun vises tooltip. Samme fejl går igen
på Forsørgertab-siden, hvor »Der er ikke beregnet en PDF-klar EAL- eller ASL-del.« står både som tekst og
tooltip. Tooltip-teksten skal desuden være væsentlig simplere: mangler der indtastninger, skal den universelt
bare angive »Indtastning mangler«.

**Genskabelse:** Genskabt ved kildelæsning og bekræftet af mutationstest gennem de ægte sider. Dobbeltvisningen
stod ordret i to komponenter — `MenberegningTab.tsx:347-351` og `ForsoergertabBeregningSection.tsx:57-63` —
hvor et `<Tooltip title={download.disabledReason}>` wrappede en `<Typography>` med PRÆCIS samme udtryk som
barn. En repo-bred søgning bekræftede, at netop de to flader (og ingen andre) havde mønsteret.

**Kerneårsag — to lag.**

1. **Dobbeltvisningen.** De to flader rendererede årsagen i to kanaler. Det var samtidig et brud på den
   kontrakt, der allerede fandtes: `page-component-contract.md` §11.1 placerer blokerings-årsagen i
   TOOLTIPPET (`disabledReason`), og `error-contract.md` fastslår, at der ikke vises inline-valideringstekst.
   Symptomet var altså ikke en manglende regel, men to flader der ikke fulgte den.
2. **Den lange tekst.** Gate-årsagen havde kun `{code, message}`, hvor `message` var både den interne
   forklaring OG brugerteksten. Beskederne beskrev derfor gatens egen tilstandsmaskine — »Der er ikke beregnet
   en PDF-klar EAL- eller ASL-del.«, »Ingen gyldige rækker i tabel«, »Fatale beregningsfejl«, »Mangler
   periode-data« — frem for hvad brugeren skal GØRE. Der fandtes ingen måde at skelne »brugeren mangler at
   indtaste noget« fra »her er en konkret fejl, det er værd at citere« (EO-rækkemotorens
   »Feriegodtgørelse er ikke udfyldt«). En forenkling kunne derfor kun laves med strengmatch pr. gate.

**Strukturel vurdering:** Problemet er ejerskabet af den BRUGERRETTEDE tekst. Beskeden blev formuleret i
domænelaget og forbrugt uændret af UI'et, uden at nogen af de to lag ejede oversættelsen fra tilstand til
brugertekst. Derfor kunne hver flade vælge sin egen visning, og hver gate sin egen ordlyd.

**Berørte flader:** Ud over de to indmeldte fandt typeændringen NI dokumentdefinitionsfiler, som byggede
`{status:'blocked', reasons:[{code,message}]}` i hånden og dermed omgik gate-konstruktørerne helt:
`varigeMen`, `satser`, `forsoergertab`, `eet`, `aarsloen`, `renteberegning`, `eo`, `regulering` og
MinProcesrente-standalone. Det var en PARALLEL vej til samme datastruktur — den slags, der kan drifte uset.

**Gennemført løsning:**

1. **Årsagen bærer sin egen klassifikation.** `DocumentDownloadGateReason` har nu
   `kind: 'missing-input' | 'specific'`. `resolveDocumentGateTooltip` er det ENE sted, klassen bliver tekst:
   `missing-input` viser `DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE` (»Indtastning mangler«), `specific` citeres
   ordret. `message` bevares ALTID som den interne forklaring, så koder, tests og logs stadig kan skelne to
   blokeringer, der deler brugertekst. Klassifikationen er DATA frem for et strengmatch, netop fordi et match
   ville drifte.
2. **`blockDocumentDownload` defaulter til `missing-input`.** En gate skal aktivt vælge `specific`. De to
   steder, der har en ægte felt-/rækkenavngiven besked, gør det: EO-gaten og EO-dokumentprojektionen. De
   fire issue-baserede gates (aarsløn stamdata/range, satser, renteberegning, regulering) bruger
   `blockedFromIssues`, som citerer issuet hvis det findes og ellers falder til den universelle tekst.
3. **Den parallelle vej er lukket.** `blockedProjection` / `blockedProjectionWithSpecificReason` /
   `blockedFromIssues` i `documentOutcome.ts` er nu den ene måde en projektion siger »blokeret«. Alle ni
   filer er migreret; `reguleringDocumentDefinitions`' lokale `blocked()`-helper er slettet. Typen tvinger
   klassifikationen frem — det var TYPEÆNDRINGEN, der fandt de ni filer, ikke en søgning.
4. **Dobbeltvisningen er fjernet** på begge flader; årsagen står kun i tooltippet.
5. **Forsørgertab bruger nu `download.errorMessage` frem for `visibleDocumentFailureMessage`.** Det er
   nødvendigt og ikke kosmetik: preflighten gater EFTER commit-barrieren
   (`documentLifecycle.ts:168-171`), så et klik på en ENABLED knap kan blokere, fordi settlet netop gjorde
   værdien ugyldig. Tooltippet er ikke fremme efter et klik, og denne side har ingen shake-/fokus-feedback
   (modsat Varigt mén). Filtreredes gate-blokeringen væk, ville netop det klik være lydløst — den MODSATTE
   fejl af den indmeldte. Samtidig er fladens inline udfaldsrække erstattet af den kanoniske
   `DocumentOutcomeMessage`, hvilket lukker den femte rækkeudgave, R6-F02 lod stå.

**Dækning (mutationstestet, ikke kun grøn):** fire nye integrationstests gennem de ÆGTE sider —
`MenberegningTab.integration.test.tsx` (2) og `Forsoergertab.integration.test.tsx` (2). Hver måler TO ting
samtidig, fordi kun begge sammen udelukker begge fejlretninger: teksten findes IKKE som synlig tekstknude,
OG den findes som ikonets tilgængelige navn. Ét ben alene ville være grønt, hvis årsagen forsvandt helt
(usynlig blokering) eller hvis dobbeltvisningen bestod. Varigt mén dækker desuden BEGGE gate-udfald
(manglende værdi og rød feltfejl) og beviser, at de deler brugertekst men har forskellig intern `message`.

**Mutationsbevis:** genindføres dobbeltvisningen i `MenberegningTab`, fejler netop de 2 nye tests med
brugerens symptom (`expected <p …> to be null`). Erstattes `resolveDocumentGateTooltip` med `reason.message`,
fejler præcis den test, der hævder ÉN universel tekst for to forskellige blokeringer. Sættes Forsørgertabs
kilde tilbage til `visibleDocumentFailureMessage`, fejler netop aktiverings-testen.

**Konsekvens:** Ren visnings-/tekstfejl. Ingen beregningstal, gate-beslutninger eller persisterede data er
påvirket — `canDownload` er uændret for hver enkelt gate.

**Alvor:** Mindre (visning), men bredt: alle download-flader delte den lange beskedform.

**Kræver godkendelse:** Nej. Brugeren har udtrykkeligt fastlagt både at kun tooltippet skal vises, og at
teksten universelt skal være »Indtastning mangler«.

**Status: Rettet 2026-07-29.**

### UT-F08 — Minus kan tastes som første tegn i et ikke-negativt procentfelt

**Indmeldt symptom:** I procentfelter, der ikke må være negative, kan der alligevel indtastes et minustegn som
første indtastning. Det må ikke kunne ske. Brugeren lod det være åbent, om blokeringen sker via en »kan være
negativ«-værdi på feltet eller udledes af grænseværdierne, og bad om den strukturelt bedste løsning.

**Genskabelse:** Genskabt deterministisk gennem det ægte `PercentField` + produktions-runtime. Diagnosen viste,
at `-5` blev committet CANONICAL i den autoritative store (`{"feriePct":-5}`) uden nogen rejection — altså ikke
kun et kosmetisk problem i draften. En efterfølgende probe af codec-laget viste årsagen:

```text
percent.acceptsInitialKey('-') = true      (på et allowNegative:false codec)
integer.acceptsInitialKey('-') = true      (på et allowNegative:false codec)
amount.acceptsInitialKey('-')  = true
```

**Kerneårsag:** `allowNegative` var erklæret på HVERT numerisk codec i produktionskataloget — 30+ steder — og
honoreret af INGENTING. Konfigurationen blev alene brugt til en construction-time-sanity-check
(`assertNumericBounds`); den nåede aldrig frem til nogen adfærd. I stedet hardkodede hver feltkomponent sit
eget svar, og de var indbyrdes UENIGE for de SAMME descriptorer:

| Komponent | Hardkodet svar | Feltets faktiske erklæring |
|---|---|---|
| `PercentField` | `allowNegative: true` | alle procentfelter er `false` |
| `GridPercentCell` | `allowNegative: false` | samme felter — modsat svar |
| `IntegerField` | `allowNegative: true` | alle heltalsfelter er `false` |
| `GridIntegerCell` | `allowNegative: true` | månedscellen er 1..12 |
| `MenberegningTab` (méngrad) | `allowNegative: false` | lokal gentagelse af feltets egen regel |
| `BeregnetRenteTable` (tillægstid) | `allowNegative: true` | feltet er 0..99 |

Fundet er derfor ikke »en manglende `false` på ét callsite«, men at politikken slet ikke havde en vej fra det
sted, den ER erklæret, til det sted, den skal virke. To flader af samme feltfamilie kunne svare forskelligt,
uden at noget blev rødt.

**Strukturel vurdering og valg af løsning:** Brugerens to muligheder blev vurderet. At udlede fortegnet af
GRÆNSEVÆRDIERNE (`minValue >= 0`) blev forkastet: flere felter erklærer `allowNegative: false` UDEN `minValue`
på codecet (grænsen ligger i en separat validator), så udledningen ville fail-open netop dér. Den erklærede
politik er desuden det, der semantisk menes. Løsningen er derfor en EKSPLICIT politik — men gjort til DATA på
codecet frem for en parameter, hver komponent skal huske.

**Gennemført løsning:**

1. `FieldCodec` bærer nu `signPolicy?: 'nonNegative' | 'signed'`, udledt af `allowNegative` i de tre numeriske
   factories. `createStringBackedFieldCodec` VIDERESTILLER det indre codecs politik — uden det ville
   månedscellen (et heltal gennem adapteren) miste sin politik og få minus tilbage.
2. `acceptsInitialKey` honorerer nu politikken: minus åbner kun editoren på et felt, der må være negativt.
   Det var den halvdel, der lukkede brugerens præcise symptom (minus som FØRSTE tegn).
3. `src/inputCore/react/fields/signPolicy.ts` er det ene opslag fra descriptor til politik
   (`fieldAllowsNegative` / `codecAllowsNegative`). Alle SEKS callsites i tabellen ovenfor læser den nu.
4. **Bevidst afgrænsning — beløbsfelter.** `acceptsInitialKey` tillader fortsat `-` for BEGGE politikker i
   beløbsfamilien: minus er også SUBTRAKTION i et udtryk (»5000-200«), og et ikke-negativt felt må gerne
   regne sig ned til et lovligt resultat. Tegnfilteret blokerer netop kun det UNÆRE minus
   (`containsUnaryMinusToken`), og den skelnen kan et enkelt-tegns-opslag ikke foretage.
5. **Bevidst afgrænsning — §1.6 er urørt.** `parseForSettle` er fortsat fortegns-BLIND, og paste bevarer et
   indsat minus. En negativ værdi, der NÅR frem — fx fra en indlæst `.eo`-fil — committes derfor stadig
   canonical og bærer sit røde bounds-issue, frem for at få fortegnet stille fjernet eller blive afvist som
   råtekst. Politikken styrer udelukkende, hvad der kan TASTES.

**Dækning (mutationstestet):** `fieldSignPolicy.contract.test.tsx` — 13 tests i TRE lag, fordi en rettelse i
kun ét lag ville efterlade fejlen i et andet: codec-laget (politik + `acceptsInitialKey` i begge retninger,
adapter-arv, beløbs-undtagelsen, §1.6-afgrænsningen), katalog-laget (INGEN numerisk produktionsdescriptor
mangler politik; alle procentfelter er ikke-negative; de fortegnede er UDELUKKENDE beløbsfelter — sidste ben
er ankeret mod, at »alt er nonNegative« ville bestå trivielt) og surface-laget gennem de ægte komponenter.

Surface-testene måler bevidst i en ÅBEN editor med caret på position 0. Det er afgørende: et minus efter et
ciffer giver »1-«, som mønsteret afviser UANSET politikken, så en test der tastede minus dér ville være grøn
med politikken slået fra. Netop den fælde faldt testens første udgave i, og det var en mutationstest af
`PercentField`, der afslørede den. Samme mutationstest afslørede også, at testkatalogets `belobField` er
`allowNegative: false` og derfor ikke kunne bære »fortegnet beløb«-casen; den bruger nu et ægte
produktionsfelt (årslønstabellens beløbskolonne).

**Værn:** AST-reglen `input/sign-policy-from-descriptor` forbyder en hardkodet `allowNegative`-literal i et
fortegns-følsomt tegnfilter-kald i HELE `src/` (undtagen filter-ejeren selv, hvor det ER parameteren). Scopet
er bredt med vilje: to af de seks drifter stod i en sidekomponent og en tabel, ikke i den fælles feltfamilie.
Også en KORREKT literal er forbudt — den er en anden samtidig sandhed om feltets politik. Typen kan ikke lukke
resten, da `allowNegative` er en almindelig `boolean` i filter-optionerne.

**Mutationsbevis (fire mutationer, hver dræbt af netop den test der hævder mekanismen):** hardkodes
`PercentField` tilbage til `true`, fejler surface-testen med brugerens symptom; lader `acceptsInitialKey`
acceptere minus igen, fejler codec-testen; fjernes adapterens viderestilling, fejler adapter-testen; hardkodes
`signPolicy` til `'signed'`, fejler 4 tests på tværs af alle tre lag. AST-reglen bliver rød med
`input/sign-policy-from-descriptor` + fil:linje, når en komponent igen hardkoder literalen.

**Konsekvens:** En ulovlig negativ værdi kunne indtastes og blev committet canonical. Den blev fanget af
bounds-validatoren som en rød feltfejl og kunne derfor ikke fodre en motor (`error-contract.md` §1.1), så der
er ikke observeret forkerte beregningstal. Fejlen var i indtastnings-værnet, ikke i beregningskæden.

**Alvor:** Væsentlig — feltfamiliens erklærede regler var uden virkning på tværs af hele det numeriske input.

**Kræver godkendelse:** Nej. Brugeren har udtrykkeligt fastlagt den ønskede adfærd og overlod valget af
mekanisme til den strukturelt bedste løsning.

**Status: Rettet 2026-07-29.**

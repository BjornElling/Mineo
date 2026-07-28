# Brugertestfund under draft/commit-reviewet

**Formål:** Dette dokument er det løbende arbejdsregister for symptomer, som brugeren opdager ved brugertest
parallelt med reviewet i `draft-commit-greenfield-review-plan.md`.

**Status:** I gang  
**Senest opdateret:** 2026-07-28

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

## Oversigt

| Id | Symptom | Resultat | Strukturel rækkevidde | Status |
|---|---|---|---|---|
| UT-F01 | Dags-dato-knappen springes over ved Tab | Tilsigtet eksisterende adfærd | Ingen fejl registreret | Afvist med evidens |
| UT-F02 | Enter på dropdown i tabel flytter en række ned | Genskabt | Tværgående dropdown-/grid-integration | Åbent |
| UT-F03 | Undo af den sidste værdi i en tabelrække mister cellefokus | Genskabt | Fælles placeholder-/history-integration | Åbent |
| UT-F04 | Tilføjelse af ansættelsesforhold udløser React-crash | Genskabt | Nested feltbinding i fælles tabel-/celleinfrastruktur | Åbent |
| UT-F05 | Dags-dato-knappen udløser `setImmediateField`-fejl | Fejlmekanisme genskabt | Fælles feltkommandokontrakt og fem knapintegrationer | Åbent |
| UT-F06 | Års-placeholder viser en valideringsgrænse | Genskabt | Placeholder-ejerskab i den fælles feltfamilie | Åbent |

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

## Åbne fund

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

**Status:** Åbent; analyse gennemført, ikke implementeret.

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

**Status:** Åbent; analyse gennemført, ikke implementeret.

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

**Status:** Åbent; årsag og berørte callsites bekræftet, ikke implementeret. Den konkrete brugerhandling bag
loggen kl. 12:55 kan ikke fastslås ud fra fejlrapporten alene.

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

**Status:** Åbent; analyse gennemført, ikke implementeret.

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

**Status:** Åbent; analyse gennemført, ikke implementeret.

# Mineo – Side-komponent-kontrakt

**Version:** 0.3
**Status:** Normativ og gældende
**Prioritet:** Underordnet samtlige tværgående kontrakter jf. `contract-topology.json` (`subordinateContracts`), som alle går forud ved konflikt. App-entry/-shell-laget (§3.1) er specifikt underordnet `app-shell-contract.md`.
**Senest verificeret mod kode:** 2026-08-14

Dette dokument er **normativt**.
Kode, der afviger fra denne kontrakt, betragtes som **arkitektonisk fejl**.

---

## Formål

Denne kontrakt fastlægger:

- hvad en side er i Mineo
- hvilke typer sider programmet består af
- hvilket ansvar der ligger på rute-, layout-, page- og tab-niveau
- hvilke mønstre der er bindende på tværs af sider

Kontrakten skal beskrive den ønskede, langsigtet holdbare arkitektur for hele programmet.
Den må ikke reduceres til et snapshot af ét enkelt domænes aktuelle implementering.

---

## 1. Sidehierarki

Mineo består arkitektonisk af fire niveauer:

1. **App-/route-niveau**
   - Routing, globale providers, theme og top-level device gate.
2. **Layout-niveau**
   - `MainLayout` ejer navigation, global gem/hent/slet alt og overlay/dialoger; den fælles
     `CriticalActionCoordinator` ejer commit-barrieren før kritiske handlinger.
3. **Page-niveau**
   - Den route-komponent brugeren navigerer til.
   - Ejer sidens primære orkestrering, persisted state-adgang og visning af én sammenhængende funktion.
4. **Tab-/sektion-niveau**
   - Underopdeling af en side.
   - Tabs er ikke selvstændige routes.

En komponent er kun en "side", hvis den er routet fra `App.tsx` eller renderes som top-level hard stop fra `main.tsx`.

---

## 2. Sidekategorier

Ikke alle sider i Mineo er af samme type. Kontrakten skelner mellem disse kategorier:

### 2.1 Persisted fagsider

Sider der ejer eller orkestrerer persisted sagsdata og beregning.

Aktuelle eksempler:

- `Stamdata`
- `Erstatningsopgørelse`
- `Erhvervsevnetab`
- `Forsørgertab`
- `Varige mén`
- `Årslønsberegning`
- `Renteberegning`
- `Satser`

### 2.2 System-/indstillingssider

Sider der viser eller muterer app-indstillinger, men ikke sagsdata.

Aktuelt eksempel:

- `Indstillinger`

### 2.3 Informationssider

Sider der primært viser statisk eller let interaktiv information.

Aktuelt eksempel:

- `Mineo`

### 2.4 Hjælpe-/systemruter

Ruter med et snævert flowansvar, som ikke er almindelige fagsider.

Aktuelle eksempler:

- `OpenEo` — PWA-filindlæsningsfejl-flow (`src/components/system/`)
- `UnsupportedDevicePage` — hard-stop ved uunderstøttet enhed (renderet af `apps/shared/bootstrapClientApp.tsx`)

Disse komponenter bor **ikke** i `src/components/pages/`. `pages/`-mappen er reserveret til kategori 2.1–2.3 samt standalone-appens egen side (`pages/minprocesrente/MinProcesrenteCalculatorPage.tsx`, jf. `app-shell-contract.md`). Hjælpe-/systemruter placeres i `src/components/system/` (route-monterede) eller renderes direkte fra app-shellen (`apps/shared/bootstrapClientApp.tsx`, hard-stop).

### 2.5 Auth-gate-renderede komponenter

Komponenter, der renderes af `AuthGate` som et gate foran hele app-roden — ikke via routing og ikke som device-hard-stop fra app-shellen.

Aktuelt eksempel:

- `LoginPage` — renderes af `AuthGate`, når brugeren ikke er låst op; app-træet (med `MainLayout` og routede sider) monteres først efter unlock.

Denne kategori falder uden for §1-niveauerne: `LoginPage` er hverken routet fra `App.tsx` (§1 app-/route-niveau) eller et device-hard-stop renderet af `bootstrapClientApp.tsx` (§2.4). Den sidder mellem app-entry/-shell (§3.1) og routing (§3.2): app-entryen vælger `AuthGate` som app-rod, og gaten beslutter at vise `LoginPage` i stedet for app-træet.

Placering og regler:

- `LoginPage` ligger i auth-modulet (`src/auth/LoginPage.tsx`) og importeres af `src/auth/AuthGate.tsx`. Det er ikke en fagside i §2.1-forstand, og den hører derfor hjemme tæt på gaten i `src/auth/` frem for i `src/components/pages/` (som er reserveret til kategori 2.1–2.3).
- De tværgående kontrakter gælder, hvor de er relevante: navngivne form-felter følger `form-contract.md` / `mineo-field-pattern.md`, og auth-mekanikken styres af `auth-gate-contract.md`, som er det normative hjem for selve gaten (styrke, persistens, placering).
- Regler for persisted fagsider gælder **ikke**: `LoginPage` ejer ikke sagsdata, åbner ingen felt-editorfacade for et
  fagdomæne og indgår ikke i undo/redo eller `.eo`-save/load.
- Page-header-reglen (§4.3) og layout-byggestenene (§10) gælder ikke som krav; auth-gaten må have sit eget UX, jf. `auth-gate-contract.md`.

Regler for persisted fagsider gælder ikke automatisk for de øvrige kategorier.
Kontrakten skal derfor altid være eksplicit om, hvilke regler der gælder for hvilke sidetyper.

---

## 3. Route- og layoutansvar

### 3.1 App-entry (`main.tsx`) + app-shell (`apps/shared/bootstrapClientApp.tsx`)

> Dette afsnit er **underordnet `app-shell-contract.md`**, som ejer de bindende regler for app-entry, device-gate-placering, multi-app-isolation, install-prompt-politik og service-worker-reload. Afsnittet her opsummerer kun grænsefladen mod side-laget; ved tvivl gælder app-shell-kontrakten.

Hver app-entry (`src/main.tsx`, `src/apps/minprocesrente/minprocesrenteMain.tsx`) er tynd og delegerer top-level runtime-opstart til den delte app-shell `apps/shared/bootstrapClientApp.tsx`. App-shellen ejer device gating, initial render-beslutning mellem app og hard-stop side, og install-prompt-politik. Hver app-entry vælger app-roden (fx `AuthGate` for Mineo) og leverer PWA-/service-worker-opstart som callbacks til shellen.

Mobil/tablet-blokering renderes som et separat hard-stop (`UnsupportedDevicePage`) af `bootstrapClientApp.tsx` — ikke i den enkelte app-entry.

### 3.2 `App.tsx`

`App.tsx` er route-sammensætning og provider-komposition og må eje:

- `BrowserRouter`
- globale providers
- theme
- route-registrering
- wrapping af pages i fælles layout/error boundary

`App.tsx` må ikke overtage domænespecifik page-logik.

### 3.3 `MainLayout`

`MainLayout` er det fælles skærm-layout for routede sider og må eje:

- sidemenu
- global navigation mellem routes
- orkestrering af den fælles kritiske handlingsbarriere ved sideskift/gem
- globale overlays/dialoger
- gem/hent/slet alt
- route-uafhængige driftsfunktioner

Pages må ikke duplikere denne globale adfærd lokalt.

---

## 4. Page-komponentens ansvar

En page-komponent er ansvarlig for at orkestrere én brugerforståelig funktion.

### 4.1 En page må gerne

- hente felt-editorfacaden for de sagsfelter, siden ejer
- hente typed read-/inputprojektioner for eget domæne og eksplicit autoriserede delte domæner
- sammensætte tabs/sektioner
- beregne page-lokale viewmodels fra revisionsbundne, afsluttede inputprojektioner
- styre lokal UI-state, der kun angår sidens visning

### 4.2 En page må ikke

- læse persisted data fra andre fagsider uden udtrykkelig domænekontrakt
- læse inputaggregatets rå canonical sektioner eller rejected-input-map uden om `InputReader`
- flytte global navigation/gem-hent-ansvar ud af `MainLayout`
- indføre skjult state-sync, der kan overskrive afsluttet brugerinput
- forlade sig på åben draft til beregning, validering, derived feedback eller dokumentgate

### 4.3 Page-header

En almindelig side skal selv rendere:

- root-container (`<Box>` eller tilsvarende)
- sidetitel via `<Typography className="page-title">`

Hjælpe-/systemruter (jf. 2.4) som `UnsupportedDevicePage` og `OpenEo` må afvige, når deres UX-behov er anderledes.

### 4.4 Viewmodel-lag (persisterede fagsider)

Hver **persisteret fagside (§2.1)** skal have præcis ét kanonisk viewmodel-indgangspunkt,
der ejer sidens afledte state, handlers og gates:

- kanonisk form: `useXxxViewModel()` + sektions-komposition, med page-komponenten reduceret til at
  kalde VM'en og sætte sektionerne sammen. Selve beregningskernen (`compute*`-snapshot) bevares uændret;
  VM'en orkestrerer, den genberegner ikke.
- **Hvordan VM'en når sektionerne, er et frit valg.** Er sektionstræet fladt, sendes `vm` som prop
  (fx Satser, Varige mén, Renteberegning). Bliver prop-drillingen dyb, indkapsles den i et
  `XxxVmProvider`/`useXxxVm()`-par i sidens `xxxContext.ts` (fx Stamdata, Årsløn, Forsørgertab samt
  EO's `EOOplysningerTab` og `LoenindkomstTab`). Begge former opfylder reglen; det ene faste krav er,
  at der kun findes ÉT viewmodel-indgangspunkt pr. side.

Reglen er **kategorisk, ikke størrelses-gated.** Der er ikke en LOC-tærskel: enhver §2.1-side har
en VM, uanset dens aktuelle størrelse. Det giver ét forudsigeligt svar på "hvor bor afledt state +
handlers" på tværs af hele fagside-laget og forhindrer, at en side glider tilbage til inline-logik
eller en parallel snapshot-funktion, når den vokser.

Enheden er **per side**: tab-tunge fagsider har ét VM-indgangspunkt på page-niveau. Tab-niveau-
under-VM'er (feature-slicede) er tilladt og ønskede, hvor en tab er et substantielt subview, men er
ikke et selvstændigt krav for hver tab.

**Bevidst uden for reglen:** system-/indstillingssider (§2.2) og informationssider (§2.3). En VM er
her ikke påkrævet — at kræve mønstret universelt ville være den tomme ceremoni, §12 og §13 advarer
imod. En sådan side må frit bruge en VM, hvis den reelt har afledt state at huse, men skal ikke.

**Anti-refactor-back:** når en §2.1-sides VM er tynd, fordi siden har lidt logik, skal VM'en bære en
kort rationale-kommentar — *"naturlig arkitektur"* eller *"bevidst bevaret for ensartning"* — så en
senere oprydning ikke inliner den i den tro, at den er overflødig. Ensartning på tværs af §2.1 er et
gyldigt, bevidst designvalg og ikke en fejl, der skal "forenkles" væk.

---

## 5. Persistence på page-niveau

### 5.1 Primært persisted ansvar

En persisted fagside skal have ét tydeligt primært ansvar for det domæne, brugeren oplever at være på.

Det betyder ikke nødvendigvis, at siden kun må læse/skrive præcis én sektion.
Nogle sider orkestrerer bevidst flere autoriserede sektioner.

Aktuelle gyldige mønstre i kodebasen:

- side med ét primært persisted domæne
- side med ét primært domæne plus eksplicit delte sektioner
- side uden sagsdata, men med app-settings

Kontrakten er derfor:

- siden skal have et klart primært dataansvar
- alle ekstra sektioner skal være eksplicit autoriseret af domænekontrakten
- persisted adgang må ikke "snige sig ind" dybt i undertræet uden et bevidst mønster

### 5.2 Initial values

For persisted sagsdomæner skal initial values ligge i navngivne domænemoduler, ikke inline i page-filen.

Initial values registreres ved domænets inputdefinition og materialiseres gennem sektionens Zod-schema af
inputinfrastrukturen. Page-laget må ikke skrive defaults ind ved mount eller resync.

Inline initial values er kun acceptable, når værdien er afledt af settings ved oprettelse af ny sag. Alle otte
persisterede fagsider har i dag et navngivet initial-values-modul, så en inline default er en bevidst undtagelse
med begrundelse — aldrig standardmålet.

### 5.3 Read-only adgang til andre sektioner

Hvis en side kun læser et andet domæne, modtager den den smalleste navngivne, typed projektion, som kontrakten tillader.
Projektionen bygges fra `InputReader` og bærer revision. Siden må ikke åbne en editorfacade eller hente en rå sektion
for read-only adgang.

---

## 6. Tabs og sektioner

### 6.1 Tabs er page-subviews

Tabs er underordnede page-komponenter og ikke selvstændige persisted domæner.
De skal som udgangspunkt modtage deres data og callbacks fra page-niveau.

### 6.2 Tilladte tab-typer

En tab kan være:

- input-tab
- beregnings-/resultat-tab
- kontrol-/hjælpetab
- ren informationssektion

Kontrakten må ikke antage, at alle tabs passer i kun to kategorier.

### 6.3 Dataflow til tabs

Standardmønsteret er top-down props fra page til tab.

Tabs bør ikke selv åbne persisted forms for sidens primære domæne, medmindre:

- tabben reelt fungerer som et selvstændigt page-niveau modul, og
- dette er en bevidst, dokumenteret undtagelse

### 6.4 Aktiv tab-state

Hvis aktiv tab skal huskes på tværs af navigation/reloads, skal siden bruge `usePersistedActiveTab`.

Hvis tab-state er rent lokal, midlertidig view-state uden persistencekrav, kan lokal state være acceptabel.

Kontrakten er derfor:

- persisted aktiv tab: `usePersistedActiveTab`
- ikke-persisted view-toggle: lokal state er tilladt

Det er forkert at gøre persisted tab-state til et universelt krav for alle sideinterne skift.

### 6.5 Mount-strategi

Tabs må enten:

- mountes betinget (unmountes når de ikke er aktive), eller
- holdes mounted efter første besøg (fx via "visited"-sæt + `display:none`).

Normativ beslutningsregel:

- **Inputintegritet og issues må aldrig afhænge af mount-strategien.** Afsluttet input lever i det autoritative
  inputaggregate, og issues genafledes fra `InputReader`. Tab-skift går gennem feltmotorens normale settle-/cancelpolicy;
  en komponent må derfor unmountes uden at miste afsluttet gyldigt eller rejected input.
- Mount-strategien er dermed et **frit implementeringsvalg styret af render-omkostning og UX** (fx undgå tung initial render af et stort tab ved at holde det mounted efter første besøg), ikke et korrekthedskrav.
- **Forbudt:** at lade afsluttet input, et afledeligt issue eller en runtimefejl, som skal overleve navigation, eksistere
  kun i mounted lokal state. Korrekt ejerskab skal rettes; hold-mounted må ikke bruges som databevaring.

Valget skal ikke være ad hoc per side: en sides tabs bør følge ét konsistent mønster (alle betinget, eller alle hold-mounted efter første besøg).

---

## 7. Composed values og tværsektion-viewmodels

Når en side sammensætter flere autoriserede domæner til tab-forbrug, skal det ske som én eksplicit, typed projektion fra
samme `InputReader`-revision.

Krav:

- dependencies og sammensætning skal være samlet ét sted på page-/domænegrænsen
- typen skal have et tydeligt navn, når sammensætningen bruges bredt på siden
- tabs må ikke hver især læse rå sektioner eller bygge samme kombination

Memoisering er et implementeringsvalg; den bindende regel er én revisionskonsistent projektion uden bypass.

**Én projektion betyder ikke nødvendigvis ét `ProjectionResult`.** Forsørgertab, EET og EO gater bevidst pr.
dependency-gruppe i stedet for at samle hele siden i én `ready | blocked`: en enkelt rød celle ville ellers
neutralisere gyldige, uafhængige grene. Kravet om revisionskonsistens og fravær af bypass er det samme —
grenene læser samme `InputReader`-revision. Se `domain-boundary-contract.md` og `src/inputCore/projection.ts`.

---

## 8. Fejlhåndtering på siden

### 8.1 Feltissues

Siden modtager issues fra den fælles issueprojektion efter `error-contract.md`.

- Komponenter må ikke rapportere eller rydde afledelige issues ved mount/unmount.
- Lokal `useState` må bruges til rent visuel UI-state, ikke som parallel domæneissue-model.
- Fokus og navigation bruger issueets strukturelle `FieldRef`.

### 8.2 Aggregerede sideblokeringer

Blokerende eller vejledende sidetilstande afledes fra samme revisionsbundne input-/issueprojektion som de relevante
beregninger. De må ikke bygge på åben draft, component reporters eller skjulte effects.

---

## 9. Input-, commit- og beregningsgrænser

Page- og tab-komponenter skal respektere `form-contract.md`:

- åben draft ændrer kun editorens lokale tekst,
- settle/immediate commit går gennem den fælles inputtransaktion,
- beregning og afledt feedback bruger kun en `ready` inputprojektion,
- et rejected afhængigt felt har ingen skjult tidligere canonical værdi at falde tilbage på (XOR); dets canonical slot er
  ryddet til tomværdien, og readeren skjuler feltet bag den røde fejl,
- en åben editor bevarer visning og gates fra senest afsluttede revision.

Pages må orkestrere projektioner og viewmodels, men må ikke selv sammensætte motorinput fra rå sektioner.

---

## 10. Præsentation og styling

### 10.1 Fælles struktur

Sider skal bruge de etablerede layout-byggesten, hvor de passer til sidetypen:

- `ContentBox` til indholdsbokse
- `page-title`
- etablerede række-klasser og input-komponenter
- etablerede tabeltyper; nye ad hoc-tabelformater i pages og kontrolvisninger kræver eksplicit kontraktændring
- for `StandardDisplayTable` er samlet tabelbredde centralt styret til 100 %; callsites må gerne lade kolonnebredder være automatiske eller sætte dem manuelt pr. kolonne, men må ikke selv overstyre den samlede tabelbredde

Kontrakten er konsistens i brugeroplevelse og struktur, ikke pixel-identisk kopi af én referencefil.

### 10.2 Tab-styling

Tabs på tværs af fagsider bør visuelt følge samme familieskab.
Men stylingdetaljer må ikke bindes til én specifik fil som arkitektonisk sandhedskilde.

Skal tab-styling gøres fuldt ens, sker det ved at flytte den til ét fælles abstraktionspunkt — ikke ved at
kopiere `sx`-objekter mellem filer. Kontrakten er:

- samme visuelle principper
- ingen vilkårlig divergens
- ingen krav om tekstuelt identisk `sx`-objekt i alle filer

### 10.3 DOM-manipulation

Imperativ DOM-adgang i pages og tabs er som udgangspunkt forbudt til almindelig feltstyring.
Brug refs og etablerede komponentkontrakter.

Undtagelser kan accepteres i globale infrastrukturlag som fokusgenopretning. Commit-barrieren må
ikke bruge DOM-scanning; den bruger registrerede deltagere efter `critical-action-contract.md`.

### 10.4 Tooltip-præsentation

Almindelige MUI-tooltips bruger den fælles theme-styling: venstrestillet tekst, indholdsbaseret bredde med én
fælles maksimalbredde og balanceret, naturlig ordombrydning ved hele ord. Callsites må ikke indføre faste
tooltipbredder, centreret tekst eller manuelle linjeskift for at styre ombrydningen. Afvigelser kræver et reelt
andet indholdsformat, ikke blot lokal tilpasning. Et langt sammenhængende token må nødombrydes, så det ikke
overskrider den fælles maksimalbredde.

### 10.5 Bilagsvalg og andre betingede afkrydsningsfelter

Individuelle afkrydsningsfelter og deres tilhørende tekst skjules aldrig, så længe den omgivende sektion
vises. Det gælder både almindelige og betingede valg. Hvis et felt ikke er aktuelt, vises det **inaktivt
og umarkeret** med årsagen i tooltippet. Den afsluttede værdi bevares i inputkernen og vises igen, når
forudsætningen bliver opfyldt. Hele sektionen må fortsat skjules efter sidens overordnede flow.

Begrundelsen er den samme som for download-ikonet (§11): et valg, der forsvinder, efterlader brugeren i tvivl
om, hvorvidt muligheden findes i programmet. Et inaktivt felt med en forklaring besvarer i stedet både
"findes valget?" og "hvorfor kan jeg ikke vælge det nu?". Reglen gælder uanset, om forudsætningen mangler,
fordi beregningen ikke producerer noget bilag, eller fordi brugeren selv har fravalgt indholdet et andet sted.

Regler:

1. **Inaktivering og årsag er uadskillelige.** `CheckboxField` modtager dem som ÉN prop
   (`unavailableReason: string | null`); `null` betyder, at valget er muligt. Et inaktivt betinget felt uden
   årsag efterlader brugeren uden forklaring, og en årsag uden inaktivering beskriver en tilstand, feltet ikke
   er i — begge er umulige at konstruere gennem prop'en. Bærer en domænemodel tilgængeligheden, gør den samme
   invariant strukturel (discriminated union på `enabled`), så en årsagsløs inaktiv tilstand ikke kan opstå.
2. **Årsagen har ÉN visningskanal: tooltippet — og kun ved hover.** Som gate-årsagen i §11 må ingen flade
   rendere den som en tekstknude ved eller under feltet.
3. **Årsagen er kort og præcis:** ÉN kort sætning på brugerens sprog, der navngiver den manglende
   forudsætning — fx «Pensionsalderen er ikke forhøjet i perioden» eller «Mer-erstatning er fravalgt
   nedenfor». Ingen udbygget begrundelse, ingen gentagelse af feltets egen label, og ingen redegørelse for
   regelgrundlaget eller for hvad brugeren så skal gøre; et tooltip læses i forbifarten (brugerbeslutning
   2026-08-14). Men den skal stadig navngive forudsætningen — ikke et indholdsløst "ikke tilgængelig".
4. **Rangorden når flere forudsætninger mangler:** brugerens eget fravalg forklares FØR en beregningsårsag.
   Har brugeren fravalgt indholdet, er beregningen ikke udført, og en beregningsårsag ville da være en påstand
   om et regnestykke, programmet ikke har lavet.
5. **Den afsluttede værdi bevares uændret,** mens feltet er inaktivt (den vises blot umarkeret, jf.
   `StyledCheckbox`), og vises igen, når valget bliver muligt. Et inaktivt bilagsvalg må aldrig kunne nå
   dokumentmodellen: dokumentlaget gater selvstændigt på både valget og indholdets tilstedeværelse.
6. **Tooltip-indpakningen ejes af feltfamilien,** ikke af fladen. Et disabled MUI-input udsender ingen
   pointer-events, så hover-fladen er en wrapper (`mineo-disabled-hover-target`) omkring kontrol + label.
   Fladen sætter kun gruppeklassen `disabled-hover-checkbox-group`, der bærer nedtoningen og hover-kontrasten.

Afgrænsning: synlighedsreglen gælder alle individuelle afkrydsningsfelter. Den ændrer ikke inputfelter,
der skjules af et **Ja/Nej-svar på samme formular** (fx datofelterne under en ménafgørelse) — der er
skjulningen selve formularens forgrening, og felterne er dækket af
`input-field-behavior-contract.md`'s regler om skjulte værdier. Et element, der pr. definition ALTID indgår,
bruger `lockedOn` (altid markeret), ikke `disabled` (altid umarkeret).

---

## 11. Download-, dialog- og hjælpeflows

### 11.1 Page-lokale flows

En side må eje page-lokale hjælpeflows som:

- dokument-download
- kontrol-view
- lokale modal-dialoger
- sideinterne søge-/hjælpeværktøjer

Sådanne flows skal dog fortsat respektere:

- input-/projektionsgrænsen
- den fælles afledte issue-model
- eksisterende fælles utilities, hvor de findes

Downloadflows der kan hente både PDF og Word, skal følge `document-format-contract.md`.
Hvis en knap eller ikonhandling henter det aktive dokumentformat, skal brugeren kunne se
formatet i tekst, tooltip eller aria-label.

Hvert downloadflow bruger én typed dokumentdefinition efter `document-output-contract.md`. Den samme definition driver
den reaktive gate og click-preflight. Aktivering finaliserer eventuel åben editor før et frisk
`EvaluationSourceToken` evalueres;
generator, lazy-load og fil-I/O starter aldrig ved blokering.

Download-ikonet skal altid vises sammen med sin tekstlinje. Når den tekstlinje/label, som
download-ikonet hører til, er synlig, skal ikonet også være synligt — men som **nedtonet,
inaktivt** ikon (`disabled`), når download er blokeret, med blokerings-årsagen i tooltip
(`disabledReason`, udledt af download-gatens `reasons`). Ikonet må aldrig helt forsvinde,
mens dets label bliver stående (det efterlader en tom plads, hvor brugeren forventer ikonet).
Er hele rækken (label + ikon) skjult sammen — fx fordi sektionen ikke er relevant — er det
konsistent og tilladt. Undtagelse: tabelceller med en etableret "ingen værdi"-markør (fx
`-` pr. række) beholder markøren frem for et nedtonet ikon.

**Gate-årsagen har ÉN visningskanal: tooltippet — og kun ved hover.** En deaktiveret download-knap
giver brugeren INGEN besked, hverken under knappen eller i rækken. Reglen er universel for hele
programmet (brugerbeslutning 2026-07-31) og gælder uanset, hvornår blokeringen opdages:

- Ingen flade må rendere `disabledReason` (eller en gate-`reason.message`) som en tekstknude.
- Et KLIK på en inaktiv knap besvares ikke med tekst. Det gælder også, når blokeringen først
  opdages under AKTIVERINGEN — preflighten gater efter commit-barrieren, så et klik med en åben
  editor kan blokere, fordi settlet gjorde værdien ugyldig. Knappen var synligt inaktiv, og
  brugeren har haft tooltippet til rådighed; en besked oveni ville forklare det, brugeren allerede
  kunne se. Udfaldet `gate-blocked` bærer derfor ingen besked
  (`resolveDocumentOutcomeMessage` → `null`), og en flade skal rendere `handle.errorMessage` RÅT
  uden at lægge egen politik oven på det.
- Et visuelt svar er stadig tilladt og ønsket, hvor det findes: shake + fokus på det første
  blokerende felt er ikke en besked, men en pegepind til det felt, brugeren skal rette.
- Årsagerne bevares på udfaldet som auditdata (`rejection.reasons`) og som tooltip-kilde. Ingen
  årsagsliste må være tom — men "synlig" betyder her tooltip og audit, ikke en tekstknude.

Udfaldsrækken viser derfor kun de udfald, knappens tilstand IKKE kunne forudse: et stale-afbrud
(sagen ændrede sig undervejs) og en utilgængelig DEV-server.

Udfaldsrækken/-boksen bæres af en `PageMessage` og renderes af `PageMessageBox`/`PageMessageRow`, så den
ikke kan blive synlig uden læsbart indhold. Viewmodellen pinder sine besked-felter med
`withPageMessages<'…'>()` — nødvendigt, fordi sidens context-type er `ReturnType<typeof useXxxViewModel>`,
altså inferensen selv, og en forkert typet besked derfor ikke har noget at afvige fra. Se
`error-contract.md` §4 for invarianten og dens baggrund.

**Teksten ejes af årsagen, ikke af fladen.** `DocumentDownloadGateReason.kind` har fire værdier og afgør,
hvad brugeren læser:

| `kind` | Brugertekst |
|---|---|
| `page-errors` | `DOWNLOAD_BLOCKED_BY_PAGE_ERRORS_MESSAGE` ("Opgørelse kan ikke hentes, når der er fejl ovenfor") — når siden selv viser fejlen i sin fejl-/advarselsboks |
| `invalid-input` | den universelle `DOWNLOAD_BLOCKED_INVALID_INPUT_MESSAGE` ("Fejl i indtastning") |
| `missing-input` | den universelle `DOWNLOAD_BLOCKED_MISSING_INPUT_MESSAGE` ("Indtastning mangler") |
| `specific` | citeres ordret; reserveret til PRÆCIS ÉN felt-/rækkenavngiven fejl (se `error-contract.md` §4) |

Prioritet ved flere årsager og den fulde klassifikationsregel står i `document-output-contract.md` §A5.1.

`message` er altid den interne forklaring og må ikke antages at være brugertekst. En flade må ikke vælge
tekst selv eller læse `blockedReasons[0].message` til visning — brug `handle.disabledReason`, som allerede er
oversat, eller `resolveBlockedGateTooltip(gate.reasons)` for en per-række-gate.

Grænsen er håndhævet af `document/download-tooltip-from-gate` i AST-manifestet: `.message` på et
`reasons`-/`blockedReasons`-udtryk i `src/components/**` gør harnesset rødt. Værnet blev tilføjet, fordi
Renteberegnings rækkeknapper viste gate-interne strenge ("Rentelinjen findes ikke længere") direkte til
brugeren — kontrakten forbød det i forvejen, men intet målte det.

En flade må heller ikke lægge sin egen `??`-fallback eller ternary oven på gatens svar. EO's fire knapper
gjorde netop det og kastede gatens årsag væk for en hardkodet streng; den beslutning hører i gaten (klassen
`page-errors`), ikke i den flade der tegner knappen.

### 11.2 Fælles komponenter før lokal speciallogik

Hvis der allerede findes en fælles komponent eller hook for en gentagen UI-adfærd, skal den genbruges eller udvides før ny parallel implementering oprettes.

Det gælder især for:

- download-knapper
- shake-/fejlfeedback
- persisted tab-navigation
- input commit-hjælpere

Men kontrakten skal ikke kræve én EET-specifik komponent på sider, hvor domænet er anderledes.

---

## 12. Wrapper-komponenter og memoisering

`React.memo` og eventuelle wrapper-komponenter er implementeringsvalg, ikke selve essensen af page-arkitekturen.

Kravet er:

- page-komponenter skal være stabile og læsbare
- unødvendig wrapper-støj skal undgås
- `displayName` bør sættes på memoiserede pages og tabs

Det er tilladt både:

- at eksportere page-komponenten direkte
- at bruge en intern page-komponent plus en tynd eksport-wrapper

Der er ikke arkitektonisk værdi i at kræve det ene mønster universelt.

---

## 13. Hvad kontrakten ikke må gøre

Denne kontrakt må ikke:

- ophøje midlertidige implementation details til universelle regler
- gøre EET/EO-specifikke mønstre til generel sandhed for alle sider
- kræve identisk kode, hvor kun adfærden behøver være ens
- blande domæneregler, formregler og page-ansvar sammen i samme regel uden tydelig afgrænsning

Når et krav reelt handler om domænegrænser, input-semantik eller keyboard-navigation, hører det hjemme i den relevante kontrakt og skal kun refereres herfra.

---

## 14. Vurderingsregel ved nye eller ændrede sider

Når en side ændres eller oprettes, skal følgende spørgsmål kunne besvares klart:

1. Hvilken sidekategori tilhører den?
2. Hvad er sidens primære dataansvar?
3. Hvilke andre sektioner læses eller skrives, og hvorfor er det autoriseret?
4. Hvad ligger på page-niveau, og hvad er delegeret til tabs/sektioner?
5. Bevarer tab-strategien draft-state og fejltilstande korrekt?
6. Er der introduceret duplikeret global adfærd, som burde ligge i `MainLayout`?

Hvis disse svar ikke er tydelige i koden, er arkitekturen for uklar.

---

## 15. Ændringer af kontrakten

Ændringer skal være eksplicitte, begrundede og versionsstyrede.
Kode må aldrig stiltiende afvige fra kontrakten.

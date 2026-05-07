# Mineo – Side-komponent-kontrakt

**Version:** 0.2
**Status:** Gældende arkitektur (normativ)
**Prioritet:** Underordnet `domain-boundary-contract.md`, `form-contract.md` og `keyboard-navigation.md`, som går forud ved konflikt.

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
   - `MainLayout` ejer navigation, global gem/hent/slet alt, overlay/dialoger og commit-flush før sideskift.
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
- `UnsupportedDevicePage` — hard-stop ved uunderstøttet enhed (`main.tsx`)

Disse komponenter bor **ikke** i `src/components/pages/`. `pages/`-mappen er reserveret til kategori 2.1–2.3. Hjælpe-/systemruter placeres i `src/components/system/` (route-monterede) eller renderes direkte fra `main.tsx` (hard-stop).

Regler for persisted fagsider gælder ikke automatisk for de øvrige kategorier.
Kontrakten skal derfor altid være eksplicit om, hvilke regler der gælder for hvilke sidetyper.

---

## 3. Route- og layoutansvar

### 3.1 `main.tsx`

`main.tsx` er top-level runtime gate og må eje:

- device gating
- PWA bootstrap
- service worker-opstart
- initial render-beslutning mellem app og hard-stop side

Mobil/tablet-blokering skal fortsat ligge her og renderere `UnsupportedDevicePage` som et separat stop.

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
- commit-flush ved sideskift/gem
- globale overlays/dialoger
- gem/hent/slet alt
- route-uafhængige driftsfunktioner

Pages må ikke duplikere denne globale adfærd lokalt.

---

## 4. Page-komponentens ansvar

En page-komponent er ansvarlig for at orkestrere én brugerforståelig funktion.

### 4.1 En page må gerne

- hente persisted state for sit eget domæne
- hente eksplicit autoriserede delte sektioner jf. `domain-boundary-contract.md`
- sammensætte tabs/sektioner
- beregne page-lokale derived flags og view models fra committed state
- styre lokal UI-state, der kun angår sidens visning

### 4.2 En page må ikke

- læse persisted data fra andre fagsider uden udtrykkelig domænekontrakt
- flytte global navigation/gem-hent-ansvar ud af `MainLayout`
- indføre skjult state-sync, der kan overskrive committed brugerinput
- forlade sig på draft-state til beregning eller derived feedback

### 4.3 Page-header

En almindelig side skal selv rendere:

- root-container (`<Box>` eller tilsvarende)
- sidetitel via `<Typography className="page-title">`

Hjælpe-/systemruter (jf. 2.4) som `UnsupportedDevicePage` og `OpenEo` må afvige, når deres UX-behov er anderledes.

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

Kanonisk mønster:

```typescript
usePersistedForm(schema, 'domaene', DOMAENE_INITIAL_VALUES);
```

Inline initial values er kun acceptable, når der ikke findes et egentligt domænemodul endnu, eller når værdien er afledt af settings ved oprettelse af ny sag.
Det er en overgang eller en bevidst undtagelse, ikke standardmålet.

### 5.3 Read-only adgang til andre sektioner

Hvis en side kun læser en delt sektion, skal den bruge den mest præcise read-model, der findes for formålet.

Det betyder typisk:

- `usePersistedSection(...)`
- selector/snapshot-hooks, når siden har revisions- eller snapshotbehov

At bruge fuld `usePersistedForm(...)` til ren read-only adgang er som udgangspunkt forkert og må kun ske, hvis siden faktisk ejer commit-adgangen til den sektion.

---

## 6. Tabs og sektioner

### 6.1 Tabs er page-subviews

Tabs er underordnede page-komponenter og ikke selvstændige persisted domæner.
De skal som udgangspunkt modtage deres data og callbacks fra page-niveau.

### 6.2 Tilladte tab-typer

En tab kan være:

- input-tab
- beregnings-/resultat-tab
- debug-/hjælpetab
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

- mountes betinget, eller
- holdes mounted efter første besøg

Normativ beslutningsregel:

- Tabs der indeholder draft-capable inputs eller runtime-fejl som skal bevares, skal holdes mounted efter første besøg.
- Tabs der kun viser beregnede resultater eller andre rene visninger, må mountes betinget.

Valget skal ikke være ad hoc per side.

---

## 7. Composed values og tværsektion-viewmodels

Når en side sammensætter flere autoriserede persisted sektioner til tab-forbrug, skal den gøre det eksplicit og typesikkert.

Krav:

- sammensætningen skal være samlet ét sted på page-niveau
- typen skal have et tydeligt navn, når sammensætningen bruges bredt på siden
- tabs skal ikke hver især bygge deres egen ad hoc kombination af de samme sektioner

`React.useMemo` er normalt det rigtige mønster, men selve kontrakten er den eksplicitte og centraliserede sammensætning, ikke det konkrete hook-navn.

---

## 8. Fejlhåndtering på siden

### 8.1 Feltfejl

Når en side eller tab arbejder med feltfejl for persisted sagsdata, skal den bruge den centrale fejl-infrastruktur.

Kanoniske mønstre:

- `useFormFieldErrorReporter(...)`
- `useFormFieldErrors(...)`
- selector/snapshot-varianter, når der er behov for det

Lokal `useState` må gerne bruges til UI-state, men ikke som parallel domænefejlmodel.

### 8.2 Aggregerede sideblokeringer

Blokerende eller vejledende side-tilstande skal afledes fra committed state og/eller den centrale fejlmodel.
De må ikke bygge på draft-state eller skjulte effekter.

---

## 9. Input-, commit- og beregningsgrænser

Page- og tab-komponenter skal respektere `form-contract.md`.
Særligt gælder:

- ingen beregning fra draft-state
- ingen commit i `onChange`
- ingen implicit commit via `useEffect`
- ingen derived feedback baseret på ucommitted input

En page må gerne sammensætte beregningsinput til domain-funktioner, men kun fra committed state.

---

## 10. Præsentation og styling

### 10.1 Fælles struktur

Sider skal bruge de etablerede layout-byggesten, hvor de passer til sidetypen:

- `ContentBox` til indholdsbokse
- `page-title`
- etablerede række-klasser og input-komponenter
- etablerede tabeltyper; nye ad hoc-tabelformater i pages og debug-visninger kræver eksplicit kontraktændring
- for `StandardDisplayTable` er samlet tabelbredde centralt styret til 100 %; callsites må gerne lade kolonnebredder være automatiske eller sætte dem manuelt pr. kolonne, men må ikke selv overstyre den samlede tabelbredde

Kontrakten er konsistens i brugeroplevelse og struktur, ikke pixel-identisk kopi af én referencefil.

### 10.2 Tab-styling

Tabs på tværs af fagsider bør visuelt følge samme familieskab.
Men stylingdetaljer må ikke bindes til én specifik fil som arkitektonisk sandhedskilde.

Hvis tab-styling skal være fuldt ens, skal den flyttes til et fælles abstraktionspunkt.
Indtil da er kontrakten:

- samme visuelle principper
- ingen vilkårlig divergens
- ingen krav om tekstuelt identisk `sx`-objekt i alle filer

### 10.3 DOM-manipulation

Imperativ DOM-adgang i pages og tabs er som udgangspunkt forbudt til almindelig feltstyring.
Brug refs og etablerede komponentkontrakter.

Undtagelser kan accepteres i globale infrastrukturlag som `MainLayout`, hvor commit-flush og fokusgenopretning kræver DOM-integration.

---

## 11. Download-, dialog- og hjælpeflows

### 11.1 Page-lokale flows

En side må eje page-lokale hjælpeflows som:

- PDF-download
- debug-view
- lokale modal-dialoger
- sideinterne søge-/hjælpeværktøjer

Sådanne flows skal dog fortsat respektere:

- committed-state grænser
- central fejlrapportering, når persisted data påvirkes
- eksisterende fælles utilities, hvor de findes

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

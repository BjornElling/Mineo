# Mineo – Domænegrænse-kontrakt

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Tværgående; constrainer `page-component-contract.md`.
**Senest verificeret mod kode:** 2026-07-12

Dette dokument fastlægger bindende grænser mellem persisted sektioner, sideejerskab og tværdomæne-afhængigheder.

---

## 1. Sektionskategorier

Mineo arbejder med to normative kategorier af persisted sektioner:

### 1.1 Sags-globale sektioner

Sags-globale sektioner beskriver grunddata for sagen og må læses på tværs af domæner.

Aktuelle sags-globale sektioner:

- `stamdata`
- `satser`
- `faellesAarsloen`

### 1.2 Domæne-sektioner

Domæne-sektioner ejes af ét fagdomæne og må kun læses/skrives efter eksplicit kontrakt.

Aktuelle domæne-sektioner:

- `aarsloen`
- `renteberegning`
- `varigemen`
- `forsoergertab`
- `erstatningsopgoerelse`
- `erhvervsevnetab`

---

## 2. Grundregel for læsning og skrivning

1. En side må altid læse og skrive sin egen domæne-sektion.
2. Alle sider må læse sags-globale sektioner.
3. Sags-globale sektioner har navngivne skrive-ejere:
   - `stamdata` skrives kun fra siden `Stamdata`
   - `satser` skrives kun fra siden `Satser`
   - `faellesAarsloen` skrives kun fra siderne `Erhvervsevnetab` og `Forsørgertab`
4. En side må ikke skrive til en sags-global sektion, blot fordi den må læse den.
5. En side må ikke læse eller beregne på en anden fagsides domæne-sektion uden eksplicit undtagelse i denne kontrakt.

Rationale:
- `stamdata` er fælles, autoritativ sagsinformation.
- Governance-problemer skal løses med eksplicit skriveejerskab, ikke ved at oprette mikro-sektioner som workaround.

---

## 3. Stamdata er sags-globalt og autoritativt

1. `stamdata` er den autoritative sektion for sagens grundoplysninger om bl.a. skadelidte.
2. `skadelidteFodselsdato` hører normativt til i `stamdata`.
3. `skadelidteFodselsdato` må ikke persisteres parallelt i andre sektioner.
4. Sider der afhænger af `skadelidteFodselsdato`, skal læse værdien fra `stamdata` og ved fejl eller manglende værdi henvise brugeren til `Stamdata`.

---

## 4. Neutral sektion er en undtagelse, ikke standard

En neutral sektion må kun oprettes, når alle følgende kriterier er opfyldt:

1. Felterne udgør en semantisk sammenhængende gruppe, ikke ét enkelt løst felt.
2. Gruppen har mindst 3 felter eller repræsenterer et tydeligt, selvstændigt fælles deldomæne.
3. Ingen eksisterende sags-global sektion kan udvides uden at forplumre ejerskabet.
4. Læse- og skriveejerskab kan beskrives klart og stabilt i denne kontrakt.

Hvis disse kriterier ikke er opfyldt, skal løsningen være:
- udvidelse af eksisterende sags-global sektion, eller
- en eksplicit domæne-kontraktændring for et konkret læsebehov.

Aktuel anvendelse:
- `faellesAarsloen` er en gyldig neutral sektion.
- `faellesPersondata` er afskaffet, fordi `skadelidteFodselsdato` hører hjemme i `stamdata`.

---

## 5. Persistensskrivende sidegrænser

Følgende persistensskrivende sider må ikke læse eller beregne på hinandens domæne-sektioner uden eksplicit undtagelse:

- `Erstatningsopgørelse`
- `Erhvervsevnetab`
- `Varige mén`
- `Årslønsberegning`
- `Renteberegning`
- `Satser`
- `Forsørgertab`

`Satser` er en sags-global side, ikke et fagdomæne. Den står i listen, fordi den skriver persisted sagsdata og derfor er underlagt page-boundary-regler.

Tværside-afhængigheder må kun etableres ved kontraktændring i denne fil.

---

## 6. Domænespecifikke regler

### 6.1 Erhvervsevnetab

1. `Erhvervsevnetab` er et aktivt, selvstændigt beregningsdomæne med egen persisted state.
2. Siden må være fuldt tilgængelig i navigation, routing, persistence, save/load og PDF-generering på linje med de øvrige fagsider.
3. Siden må læse `stamdata` og `faellesAarsloen`.
4. Siden må ikke læse andre fagsiders domæne-sektioner.
5. `computeEetSnapshot(...)` er den autoritative beregnings-entry for tab- og PDF-projektioner i Erhvervsevnetab-domænet.
   Den følger `snapshot-contract.md` og den domænespecifikke `eet-snapshot-contract.md`.
6. Tab-komponenter og PDF-flow må ikke lave parallelle EET-beregninger uden om snapshot-projektionen.
7. ASL-afgørelsesrækken indeholder `fsTilbageholdtEet` (`Ja`/`Nej`). Feltet er beregningsmæssigt knyttet til den afgørelse, der senere afløses. Når feltet er `Ja`, skal overgangen til den næste afgørelse bruge den næste afgørelses faktiske virkningsdato som afløsningsdato i stedet for den nye overlap-skæringsdato. Feltet på den sidste afgørelse har aldrig beregningsmæssig effekt, fordi den ikke afløses af en efterfølger. Der må ikke bygges parallel validering eller beregning af dette felt uden om den centrale EET-beregning.
8. Folkepensionsalder må kun beregnes via `src/data/folkepensionAlderRates.ts` — herunder `getFolkepensionAlder`, `getFolkepensionsdato` og `getDagenFoerFolkepensionsdato`. Kapitaliseringstabellerne må ikke være kilde til alder i måneder, labels eller folkepensionsdato. Filen ligger i `src/data/` (ikke under `src/data/kapitalisering/`) fordi den er tværdomæne og ikke kapitaliseringsspecifik.

### 6.2 Forsørgertab

1. `Forsørgertab` er et selvstændigt beregningsdomæne med egen persisted state.
2. Siden må læse `stamdata` og `faellesAarsloen`.
3. Siden må ikke læse andre fagsiders domæne-sektioner.
4. `computeForsoergertabSnapshot(...)` er den autoritative beregnings-entry for side- og PDF-projektioner i Forsørgertab-domænet.
   Den følger `snapshot-contract.md` og den domænespecifikke `forsoergertab-snapshot-contract.md`.
5. UI-komponenter og PDF-flow må ikke lave parallelle Forsørgertab-beregninger uden om snapshot-projektionen.
6. ASL-beregningen må kun bruge `src/data/folkepensionAlderRates.ts` til folkepensionsalder — herunder `getFolkepensionAlder`, `getFolkepensionsdato` og `getDagenFoerFolkepensionsdato`. Forsørgertabstabeller og kapitaliseringstabeller må ikke duplikere folkepensionsalderdata.

### 6.3 Varige mén

1. `Varige mén` er et selvstændigt beregningsdomæne med egen persisted state.
2. Siden må læse `stamdata`.
3. Siden må ikke skrive til `stamdata`.
4. Domænets output-/PDF-model følger `varigemen-contract.md`.

### 6.4 Fælles årsløn

1. `faellesAarsloen` er en neutral persisted sektion til fælles, autoritative årslønsfelter.
2. Sektionen må kun indeholde `aslAarsloen` og `ealAarsloen`.
3. `Erhvervsevnetab` og `Forsørgertab` må læse og skrive sektionen som en navngiven multi-writer-undtagelse.
4. Felterne må ikke persisteres parallelt i de to domæne-sektioner.
5. Fælles regler for disse felter skal implementeres i neutrale moduler under `src/domain/aslEalAarsloen/`.
6. Ingen page-local default, hydration eller initialValues-materialisering må overskrive en eksisterende afsluttet
   `faellesAarsloen`-værdi uden en eksplicit brugercommand.
7. Begge sider skal bruge samme schema, initial values og valideringsregler for sektionen.

---

## 7. Navnekollision: "Midlertidigt EET"

1. Ydelsestypen `midlertidigt_eet` i offentlige ydelser er en selvstændig ydelseskategori.
2. Denne kategori må ikke fortolkes som teknisk integration til siden `Erhvervsevnetab`.
3. Forekomst af teksten "EET" i ydelsestyper er derfor ikke i sig selv et kontraktbrud.

---

## 8. EO-felter for midlertidigt/endeligt EET

1. Felterne i `EOOplysningerTab` for midlertidigt/endeligt EET er aktive felter i EO-domænet.
2. `EOInspektion` og EO-PDF må bruge disse felter via EO-data (`erstatningsopgoerelse`), fordi de er en del af EO-opgørelsen.
3. Disse EO-felter må aldrig kobles til persisted data fra siden `Erhvervsevnetab`.
4. Navnelighed mellem felter og sidenavn giver ingen implicit datakontrakt.

---

## 9. Snæver EO-import af midlertidigt EET

1. `Erstatningsopgørelse` må som eksplicit undtagelse læse:
   - `erhvervsevnetab`
   - `faellesAarsloen`
   - `stamdata`
2. Undtagelsen gælder togglen "Midlertidigt EET indsættes fra Erhvervsevnetab-siden" på *Offentlige ydelser*-fanen, samt den virtuelle injection denne toggle aktiverer i EO-beregning og PDF-bilag "Midlertidig EET".
3. EET-domænet eksponerer en typed, read-only og Zod-valideret importport, der bygger på samme
   canonical beregningskerne som EET-snapshottet. EO modtager portens import-context som eksplicit snapshot-input og må ikke læse
   EET-engines eller deres interne resultatformer direkte.
4. Importporten og siden `Erhvervsevnetab -> Løbende ydelser` skal bruge samme canonical
   EET-beregning. De har bevidst hver sin context, fordi EO's TAF-slutdato erstatter
   EET-beregningsdatoen som afgrænsning i importen. Context-forskellen ejes af EET-porten;
   importen må ikke implementeres som en parallel EO-specifik kopi eller udløse EET-beregning
   inde i EO-snapshottet.
5. Importen må ikke bruge differencekravs-varianten af løbende ydelser.
6. Importen må kun medtage rækker fra afgørelser med typen `Midlertidig` eller `Delvist endelig`; rækker fra `Endelig` må ikke indgå.
   Ukendte eller kontraktstridige importrelevante afgørelsestyper skal fail-close og rapporteres som blocking issue; de må ikke silently droppes som irrelevante.
7. Undtagelsen giver kun read-only adgang; EO må ikke skrive tilbage til EET-relaterede sektioner.
8. Importportens pengefelter er `MoneyOre`. EO må først konvertere dem til kroner ved den
   eksisterende `AmountValue`-grænse, hvor de virtuelle offentlige-ydelsesrækker konstrueres.
9. Manglende, schema-ugyldig eller runtime-fejlende import-context, mens togglen er aktiveret,
   skal give en eksplicit blokerende issue. Tilstanden må ikke maskeres som "ingen relevante
   EET-rækker".
   Importens feltissues bindes til de konkrete top-level- og rækkerefs, importprojektionen læser; en bred
   sektionsscan eller et parallelt inventar af tekst-id'er er ikke en gyldig dependency-grænse.
10. Virtuelle rækker injiceres aldrig i inputaggregatet. EET er den autoritative kilde, og EO's persisted offentligeYdelserRows forbliver upåvirket af EET-ændringer på persistens-niveau. Når togglen er aktiv, filtreres eksisterende manuelle `midlertidigt_eet`-rækker væk fra tabellen, og ydelsestype-optionen `midlertidigt_eet` deaktiveres i dropdown'en — så der altid er præcis én kilde til midlertidigt EET-data ad gangen.

---

## 10. Delt forligsgrad mellem EO og differencekrav

1. Felterne `forligAnsvarsgradProcent`, `forligAnsvarsgradBroek` og `forligDato` bor i
   `erstatningsopgoerelse`-sektionen, men er som eksplicit undtagelse **delt kilde** med
   `Erhvervsevnetab -> Differencekrav`-fanen.
2. `Erhvervsevnetab`-siden (og dens differencekrav-fane) må derfor både **læse og skrive**
   `erstatningsopgoerelse`-sektionen — men kun for disse tre forligs-felter. Bindingen sker via
   samme globale store-slice, så ændringer slår igennem begge steder.
3. Undtagelsen er bevidst bidirektionel (til forskel fra §9, der er read-only): forligsgraden
   redigeres ligeværdigt fra begge faner. Settings-afledte initialværdier på `Erhvervsevnetab`-siden
   skal matche EO-sidens egne, så en command herfra ikke materialiserer afvigende EO-defaults.
4. Undtagelsen giver **ikke** adgang til øvrige EO-felter eller EO-beregnet output. Al læsning og alle refs
   krydser den navngivne port `domain/erstatningsopgoerelse/forligInputPort.ts`; EET må ikke importere EO's
   descriptor-katalog direkte. `domain/cross-domain-descriptor-port` håndhæver porten alias-sikkert, mens
   `domain/page-section-access-boundary` stopper ved den godkendte port og følger alle øvrige relative
   importkanter transitivt.

---

## 11. Håndhævelse

1. Nye hooks, viewmodels og pipelines må ikke hente persisted data fra andre fagsider end egen side plus de sags-globale sektioner, de er autoriseret til.
2. Reviews skal afvise skjulte afhængigheder mellem fagsiders afsluttede inputprojektioner.
3. Ved tvivl gælder fail-closed: afvis koblingen, dokumentér behovet, og afvent kontraktændring.
4. Når et domæne bruger snapshot-first, skal snapshot-entrypointet også følge `src/contracts/snapshot-contract.md` og en domænespecifik kontrakt eller dokumenteret entrypoint-deklaration med:
   - autoritative inputsektioner
   - autoritative forbrugere
   - status-/issue-model
   - PDF/kontrol-projektioner
   - runtime fail-closed-semantik
5. Page-boundary quality-tests er et sikkerhedsnet, ikke fuld statisk sikkerhed. Aliasering, dynamiske imports og nye facade-hooks kræver stadig manuel review mod denne kontrakt.

---

## 12. Aktuelle domænekontrakter

Minimale domænekontrakter supplerer denne fil. Den autoritative liste ejes af `domainContracts` i `contract-topology.json`; nedenstående skal holdes i sync med den:

- `eo-snapshot-contract.md`
- `eet-snapshot-contract.md`
- `forsoergertab-snapshot-contract.md`
- `aarsloen-contract.md`
- `renteberegning-contract.md`
- `varigemen-contract.md`
- `satser-contract.md`
- `indskudte-loentillaeg-contract.md`

Nye beregnings- eller PDF-producerende domæner skal have mindst en tilsvarende kort kontrakt, før de betragtes som dækket af kontraktlandskabet.

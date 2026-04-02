# Mineo – Domænegrænse-kontrakt

**Status:** Gældende arkitektur (normativ)

Dette dokument fastlægger bindende grænser mellem sider/domæner, så tværkobling ikke sniger sig ind.

---

## 1. Sidegrænser (normative)

1. Følgende sider må ikke læse eller beregne på hinandens persisted sagsdata:
   - `Erstatningsopgørelse`
   - `Erhvervsevnetab`
   - `Varige mén`
   - `Årslønsberegning`
   - `Renteberegning`
   - `Satser`
2. Eneste generelle undtagelse er `Stamdata`, som må læses på tværs.
3. Tværside-afhængigheder må kun etableres ved en eksplicit kontraktændring i denne fil.

## 2. Erhvervsevnetab

1. `Erhvervsevnetab` er et aktivt, selvstændigt beregningsdomæne med egen persisted state.
2. Siden må være fuldt tilgængelig i navigation, routing, persistence, save/load og PDF-generering på linje med de øvrige fagsider.
3. Implementeringen ændrer ikke sidegrænserne i §1: EET må stadig ikke læse eller beregne på persisted sagsdata fra andre fagsider end `stamdata`.
4. Nye beregningsafhængigheder, policy-linjer eller pipelines på tværs af fagsider kræver fortsat en eksplicit kontraktændring i denne fil.

## 2a. Forsørgertab

1. `Forsørgertab` er et selvstændigt beregningsdomæne med egen persisted state.
2. Siden må være fuldt tilgængelig i navigation, routing, persistence, save/load og PDF-generering på linje med de øvrige fagsider.
3. Siden må læse `stamdata`.

## 2b. Fælles årsløn

1. `faellesAarsloen` er en neutral persisted sektion til fælles, autoritative årslønsfelter.
2. Sektionen må kun indeholde de fælles felter `aslAarsloen` og `ealAarsloen`.
3. `Erhvervsevnetab` og `Forsørgertab` må læse og skrive `faellesAarsloen`.
4. De to årslønsfelter må ikke persisteres parallelt i `erhvervsevnetab`- eller `forsoergertab`-sektionerne.
5. Delte ASL-årslønregler må implementeres i neutrale, fælles moduler under `src/domain/faellesAarsloen/` og må bruges af begge sider.
6. Eventuelle tværgående hooks/komponenter for disse felter skal navngives neutralt og må ikke leve i en sidespecifik mappe.
7. Denne undtagelse gælder kun de to nævnte felter og deres fælles valideringsregler; øvrige tværside-afhængigheder er fortsat forbudt uden ny kontraktændring.

## 2c. Fælles persondata

1. `faellesPersondata` er en neutral persisted sektion til fælles, autoritative personfelter.
2. Sektionen må kun indeholde feltet `skadelidteFodselsdato`.
3. `Erhvervsevnetab`, `Forsørgertab` og `Varige mén` må læse og skrive `faellesPersondata`.
4. `skadelidteFodselsdato` må ikke persisteres parallelt i `stamdata`-, `erhvervsevnetab`- eller `forsoergertab`-sektionerne.
5. Denne undtagelse gælder kun det nævnte felt; øvrige tværside-afhængigheder er fortsat forbudt uden ny kontraktændring.

## 3. Navnekollision: "Midlertidigt EET"

1. Ydelsestypen `midlertidigt_eet` i offentlige ydelser er en selvstændig ydelseskategori.
2. Denne kategori må ikke fortolkes som teknisk integration til siden `Erhvervsevnetab`.
3. Forekomst af teksten "EET" i ydelsestyper er derfor ikke i sig selv et kontraktbrud.

## 4. EO-felter for midlertidigt/endeligt EET

1. Felterne i `EOOplysningerTab` for midlertidigt/endeligt EET er aktive felter i EO-domænet.
2. `EODebug` og EO-PDF må bruge disse felter via EO-data (`erstatningsopgoerelse`), fordi de er en del af EO-opgørelsen.
3. Disse EO-felter må aldrig kobles til persisted data fra siden `Erhvervsevnetab`.
4. Navnelighed mellem felter og sidenavn giver ingen implicit datakontrakt.

## 5. Håndhævelse

1. Nye hooks/pipelines må ikke hente persisted data fra andre fagsider end deres egen side + `stamdata`.
2. Reviews skal afvise ændringer, hvor en side skjult afhænger af en anden sides committed state.
3. Ved tvivl gælder fail-closed: afvis koblingen, dokumentér behovet, og afvent kontraktændring.

## 6. Snæver EO-import af midlertidigt EET

1. `Erstatningsopgørelse` må som en eksplicit undtagelse læse følgende persisted sektioner til import på fanen `Offentlige ydelser`:
   - `erhvervsevnetab`
   - `faellesAarsloen`
   - `faellesPersondata`
   - `stamdata`
2. Undtagelsen gælder kun knappen, der indsætter `midlertidigt_eet`-rækker i EO-tabellen.
3. Importen skal bruge samme beregningsvej som siden `Erhvervsevnetab` -> fanen `Løbende ydelser`, så EO indsætter de rækker brugeren ville få vist dér.
4. Importen må ikke bruge differencekravs-varianten af løbende ydelser.
5. Importen må kun medtage rækker, der udspringer af afgørelser med typen `Midlertidig` eller `Delvist endelig`; rækker fra `Endelig` må ikke indgå.
6. Undtagelsen giver kun read-only adgang fra EO mod EET-relaterede sektioner; EO må ikke skrive tilbage til disse sektioner.

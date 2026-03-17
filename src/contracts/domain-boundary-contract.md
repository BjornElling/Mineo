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

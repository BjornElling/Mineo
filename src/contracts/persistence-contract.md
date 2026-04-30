# Mineo – Persistence-kontrakt

**Status:** Gældende arkitektur (normativ)

Denne kontrakt samler de trust-kritiske regler for persistence, save/load og autoritative state replacements.

---

## 1. Scope

Kontrakten gælder for:

- `sessionStorage`-persistens af sagsdata
- `.eo` save/load
- atomisk apply af indlæst snapshot
- schema-evolution og preflight

App-settings er ikke omfattet; se `app-settings.md`.

---

## 2. Kun schema-valideret brugerinput

1. Persistens må kun indeholde schema-valideret brugerinput.
2. Runtime-fejl, debug-state, UI-state og derived outputs må ikke persisteres som sagsdata.
3. Samme Zod-schemas skal beskytte både save og load.

---

## 3. Save-garantier

1. Save skal inkludere alt brugerindtastet, schema-valideret sagsinput.
2. Save må ikke inkludere device-lokale defaults eller afledte værdier kun for at gøre filen "komplet".
3. Save-gating følger commitbarhed, ikke al rød fejl-UI.
4. Felter eller rækker, der er schema-valideret brugerinput men aktuelt skjult i UI, skal stadig gemmes i `.eo`, medmindre brugeren eksplicit sletter dem.

---

## 4. Load-garantier

1. Load skal være atomisk, medmindre brugeren eksplicit vælger delvis indlæsning efter preflight.
2. Ingen in-memory state må muteres før preflight-beslutningen er truffet.
3. Ved apply-fejl skal eksisterende in-memory state bevares uændret.
4. Filer gemt fra schema-version `1.0` og frem skal kunne indlæses så langt det er sikkert muligt:
   - ukendte/udgåede felter strippes og rapporteres
   - manglende nyere felter må ikke alene få hele sektionen til at fejle
5. Ved schema-udvikling skal manglende felter derfor være `optional()` eller have sikker default.
6. Ukendte sektioner i `.eo`-filer må ikke i sig selv få hele loaden til at fejle; de skal rapporteres som ikke-indlæste og holdes ude af apply-snapshot’et.

---

## 5. Preflight

Preflight skal mindst indeholde:

- forventet antal felter
- antal felter/sektioner der kan indlæses
- antal fejl
- brugerrettede årsager per fejl

Preflight skal tilbyde præcis disse valg:

- `Indlæs trods fejl`
- `Send fejloplysninger`
- `Stop og gør intet`

---

## 6. Autoritative state replacements

Ved reset, load eller anden autoritativ erstatning gælder:

1. Hele snapshot’et valideres før apply.
2. Sektioner erstattes atomisk.
3. Runtime-feltfejl ryddes atomisk sammen med apply.
4. Draft-resync må kun trigges af autoritative replace-events.

Den kanoniske load-rækkefølge er:

1. læs/dekryptér fil eller storage
2. strip ukendte felter/sektioner efter schema
3. valider sektioner/snapshot
4. vis preflight og afvent brugerbeslutning
5. skriv/replace autoritativt snapshot
6. ryd runtime-fejl og trig resync

Ingen sidekomponent eller almindelig page-hook må omgå denne rækkefølge.

---

## 7. Schema-evolution fra version 1.0

`PERSISTED_DATA_VERSION = '1.0'` er kompatibilitetsbaseline for `.eo`-filer.

Fremadrettede ændringer af persisted struktur skal ske efter følgende prioritet:

1. Bevar brugerdata hvis den gamle betydning sikkert kan mappes til ny struktur.
2. Strip ukendte eller fjernede felter, når sikker mapping ikke findes.
3. Rapportér tab eller strip via preflight i stedet for at gætte.
4. `sessionStorage`-hydrering må ikke bruge global hard wipe alene pga. versionsmismatch:
   - hver persisted sektion vurderes separat
   - kompatible sektioner bevares
   - ukendte/fjernede felter strippes
   - inkompatible eller korrupte sektioner ryddes fail-closed
5. Hvis en fremtidig schema-ændring kræver mapping fra version `1.0` eller nyere, skal mappingen være eksplicit, entydig og testet.

Der holdes ikke runtime-kompatibilitetskode for filer eller interne modeller fra før schema-version `1.0`.
Det er tilladt at bryde bagudkompatibilitet for intern runtime-struktur, men `.eo`-load skal stadig bevare mest muligt sikkert brugerinput fra version `1.0` og frem.

---

## 8. SessionStorage-livscyklus

1. `sessionStorage` er browser-sessionens durable cache, ikke den autoritative runtime-sandhed.
2. Data i `sessionStorage` må forsvinde ved tab-/vindueslukning eller browseroprydning; `.eo` er den eneste brugerrettede, eksplicitte langtidsbevaring.
3. Hydrering fra `sessionStorage` må kun ske som autoritativ initialization/replacement, ikke som skjult løbende overskrivning af aktiv committed state.
4. Fejl ved skrivning til `sessionStorage` skal behandles fail-closed og må ikke skjules som om persist lykkedes.
5. Skjult persisted sagsinput skal forblive i `sessionStorage`, indtil brugeren eksplicit ændrer eller sletter det; ren visningslogik må ikke strippe det.

---

## 9. Runtime-arkitekturgrænser

Følgende regler er bindende for persistence-laget under aktiv runtime:

1. `formPersistenceStore` er den eneste committed runtime-sandhed for persisted sagsinput.
2. `sessionStorage` er durable browser-persistens og må ikke fungere som et parallelt aktivt state-lag.
3. Persistence-hooks må ikke holde en separat lokal committed kopi af en persisted sektion.
4. Reaktive læsninger af persisted sektioner, revisions eller feltfejl skal gå via store-selectors/read-model hooks, ikke via providerens render-cyklus.
5. `FormPersistenceContext` er et infrastrukturlag for imperative persistence-operationer, hydration, notices og autoritative replaces; det må ikke udvikle sig til generel state-broker for almindelige sektionslæsninger.
6. Persistence-API'er må ikke eksponere `onChange`-lignende convenience-API'er, der inviterer til commit af committed state fra draft-semantik.
7. Tværsektion-readmodels skal være eksplicitte og read-only. Når et tværsektion-flow bliver et etableret mønster, skal sammensætningen ligge i et dedikeret hook/modul frem for som ad hoc hydrering spredt i page-komponenter.
8. UI-synlighed er ikke i sig selv en persistence-grænse: når et persisted sagsfelt eller en persisted række skjules, skal committed værdier fortsat bevares, mens validering og beregning eksplicit skal ignorere dem, når de ikke længere er domænemæssigt aktive.

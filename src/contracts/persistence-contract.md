# Mineo – Persistence-kontrakt

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Overordnet `schema-evolution.md` for save/load-invarianter. `schema-evolution.md` ejer konkrete schema-ændringsregler.

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
4. Filer skal kunne indlæses så langt det er sikkert muligt inden for den aktuelle schema-/formatpolitik:
   - ukendte/udgåede felter strippes og rapporteres
   - manglende nyere felter må ikke alene få hele sektionen til at fejle, hvis de kan håndteres via `optional()`, sikker default eller eksplicit migrator
   - ugyldige eksisterende felter kan medføre hel-sektion-drop, hvis de ikke sikkert kan migreres
5. Ved schema-udvikling skal manglende felter derfor være `optional()` eller have sikker default, medmindre en eksplicit breaking-change beslutning i `schema-evolution.md` siger andet.
6. Ukendte sektioner i `.eo`-filer må ikke i sig selv få hele loaden til at fejle; de skal rapporteres som ikke-indlæste og holdes ude af apply-snapshot’et.

**Implementation status:** Den aktuelle load-model er sektion-baseret: efter sanitization parses hver sektion med Zod. Fejler en sektion parse, indlæses den ikke delvist. Denne kontrakts "så langt det er sikkert muligt" betyder derfor aktuelt: bevar sektioner der parser sikkert; drop sektioner der ikke parser; rapportér årsagen i preflight. Feltvis recovery kræver eksplicit migrator/recovery-lag og må ikke antages implicit.

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

Semantik:

1. `Indlæs trods fejl` betyder hel-sags-erstatning med de sektioner, der er loadbare efter preflight. Sektioner der ikke kan indlæses, bevares ikke fra den aktive runtime-sag.
2. `Send fejloplysninger` må ikke sende brugerdata ud af browseren. Funktionen skal være lokal, fx kopiering/eksport af sanitiserede fejloplysninger eller åbning af eksisterende lokale bugrapport-flow.
3. `Stop og gør intet` må ikke mutere in-memory state, `sessionStorage` eller undo/redo-historik.

Preflight-UI skal gøre destruktiv partial-load tydelig: ved `Indlæs trods fejl` fjernes fejlede sektioner fra den aktive sag.

---

## 6. Autoritative state replacements

Ved reset, load eller anden autoritativ erstatning gælder:

1. Hele snapshot’et valideres før apply.
2. Sektioner erstattes atomisk.
3. Runtime-feltfejl ryddes atomisk sammen med apply.
4. Draft-resync må kun trigges af autoritative replace-events.
5. Undo/redo-history ryddes ved succesfuld autoritativ hel-sags-erstatning, jf. `undo-redo-contract.md`.

Den kanoniske load-rækkefølge er:

1. læs/dekryptér fil eller storage
2. anvend eventuelle eksplicitte migratorer på den rå sektionsværdi
3. strip ukendte felter/sektioner efter schema
4. valider sektioner/snapshot
5. vis preflight og afvent brugerbeslutning
6. skriv/replace autoritativt snapshot
7. ryd runtime-fejl, ryd undo/redo-history ved hel-sags-apply og trig resync

Ingen sidekomponent eller almindelig page-hook må omgå denne rækkefølge.

Versionsmismatch er ikke i sig selv en migration. Hvis en sektion fra en anden `PERSISTED_DATA_VERSION` validerer mod aktuel struktur efter migrator/sanitization, betyder det kun at den kan bevares; eventuelle nye schema-defaults kan være anvendt under parse. Feltvis brugerinformation om breaking changes kræver eksplicit migrator-resultat.

---

## 7. Schema-evolution fra version 1.0

Mineo har to uafhængige versionsbegreber:

1. `FILE_FORMAT_VERSION` er `.eo`-containerens version. Den bumpes kun ved inkompatible ændringer i container/top-level format, metadata eller krypterings-/indpakningsstruktur.
2. `PERSISTED_DATA_VERSION` er sagsinput-schema-versionen for sektionerne i `persistenceRegistry`. Den bumpes ved ændringer i persisted sektionsschemas, migrator-/parse-semantik eller load-sanitization der ændrer sagsinput-kontrakten.

Den aktuelle runtime-konstant ejes alene af `PERSISTED_DATA_VERSION` i `src/config/persistenceVersion.ts`; kontrakten må ikke hardkode konstantværdien. Version `1.0` er historisk kompatibilitetsbaseline, ikke den aktuelle konstantværdi.

De to versioner må ikke bumpes "for en sikkerheds skyld" uden klassifikation. De behøver ikke følges ad.

Fremadrettede ændringer af persisted struktur skal ske efter følgende prioritet:

1. Bevar brugerdata hvis den gamle betydning sikkert kan mappes til ny struktur.
2. Strip ukendte eller fjernede felter, når sikker mapping ikke findes.
3. Rapportér tab eller strip via preflight i stedet for at gætte.
4. `sessionStorage`-hydrering må ikke bruge global hard wipe alene pga. versionsmismatch:
   - hver persisted sektion vurderes separat
   - kompatible sektioner bevares
   - ukendte/fjernede felter strippes
   - inkompatible eller korrupte sektioner ryddes fail-closed
5. Hvis en fremtidig schema-ændring kræver mapping, skal mappingen være eksplicit, entydig og testet.

Der holdes ikke legacy runtime-kode eller kompatibilitetslag alene for at bevare forældede interne modeller. Ved breaking schema- eller container-ændringer er en klar dansk afvisnings-/preflight-fejl acceptabel, hvis migration ikke er sikker eller proportional.

---

## 8. SessionStorage-livscyklus

1. `sessionStorage` er browser-sessionens durable cache, ikke den autoritative runtime-sandhed.
2. Data i `sessionStorage` må forsvinde ved tab-/vindueslukning eller browseroprydning; `.eo` er den eneste brugerrettede, eksplicitte langtidsbevaring.
3. Hydrering fra `sessionStorage` må kun ske som autoritativ initialization/replacement, ikke som skjult løbende overskrivning af aktiv committed state.
4. Initial hydrering skal ske, før app-children kan læse committed state, eller også skal et eksplicit startup-gate forhindre læsning. Børn under provideren må ikke basere beregning på et unhydreret `null`-snapshot.
5. Fejl ved skrivning til `sessionStorage` skal behandles fail-closed og må ikke skjules som om persist lykkedes.
   - Gælder `persistData`, `replaceAllPersistedData`, `clearPageData` og `clearAllData`.
   - Hvis storage-mutationen fejler, må committed runtime-store ikke ændres.
   - Hvis fejl opstår efter delvis mutation, skal store, storage og undo/redo-state rulles tilbage eller operationen rapporteres som ikke gennemført.
   - Brugeren skal have synlig dansk fejlfeedback; normal drift skal være console-silent.
6. Skjult persisted sagsinput skal forblive i `sessionStorage`, indtil brugeren eksplicit ændrer eller sletter det; ren visningslogik må ikke strippe det.
7. Afviste/korrupte storage-nøgler fra startup-hydrering må ryddes som efterfølgende cleanup. Runtime-apply af det hydrerede snapshot skal stadig være atomisk; cleanup-vinduet må ikke anvende afviste nøgler i runtime.

SessionStorage keys ejes af `src/config/storageManifest.ts`. Manifestet er eneste registry for domæne-keys, UI-state keys og dynamiske prefix-keys. Rename eller fjernelse af en Mineo-key kræver eksplicit obsolete-key politik: rydning, migration eller bevidst bevarelse.

---

## 9. Runtime-arkitekturgrænser

Følgende regler er bindende for persistence-laget under aktiv runtime:

1. `formPersistenceStore` er den eneste committed runtime-sandhed for persisted sagsinput.
2. `sessionStorage` er durable browser-persistens og må ikke fungere som et parallelt aktivt state-lag.
3. Persistence-hooks må ikke holde en separat lokal committed kopi af en persisted sektion.
4. Reaktive læsninger af persisted sektioner, revisions eller feltfejl skal gå via store-selectors/read-model hooks, ikke via providerens render-cyklus.
5. `FormPersistenceContext` er et infrastrukturlag for imperative persistence-operationer, hydration, notices og autoritative replaces; det må ikke udvikle sig til generel state-broker for almindelige sektionslæsninger.
6. Persistence-API'er må ikke eksponere `onChange`-lignende convenience-API'er, der inviterer til commit af committed state fra draft-semantik.
7. Tværsektion-readmodels skal være eksplicitte og read-only. `usePersistedSectionSelector(pageKey)` er den kanoniske read-only adgang til enkeltsektioner. Gentagne sammensatte tværsektion-læsninger skal samles i navngivne hooks/readmodels senest ved anden forekomst.
8. UI-synlighed er ikke i sig selv en persistence-grænse: når et persisted sagsfelt eller en persisted række skjules, skal committed værdier fortsat bevares, mens validering og beregning eksplicit skal ignorere dem, når de ikke længere er domænemæssigt aktive.
9. Der findes en monotont stigende global committed-change token for "noget committed er ændret". Sektion-revisions må bruges til fine-grained selectors, men ikke som kollisionsfri global change-identitet.

---

## 10. Post-apply metadata

Load består af to faser:

1. atomisk apply af sagsdata,
2. efterfølgende metadata-synkronisering, fx filnavn, file handle og PWA pending-request.

Hvis fase 1 fejler, er load ikke anvendt, og eksisterende state skal være uændret.

Hvis fase 2 fejler efter succesfuld fase 1, må fejlen ikke præsenteres som om sagsdata ikke blev indlæst. UI skal vise en separat dansk advarsel om, at sagen er indlæst, men efterfølgende filmetadata eller direkte "Gem"-kobling muligvis ikke er synkroniseret.

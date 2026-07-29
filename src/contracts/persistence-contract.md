# Mineo – Persistence-kontrakt

**Status:** Normativ målarkitektur
**Type:** Tværgående kontrakt
**Prioritet:** Overordnet `schema-evolution.md` for save/load-invarianter.
**Senest verificeret mod kode:** 2026-07-16

Denne kontrakt samler de trust-kritiske regler for runtime-persistence, `.eo`, save/load og autoritative replacements.
Per-sektion-storage og `invalidDrafts` er slettet (2026-07-25): der er én current-session-envelope og ét
`rejectedInputs`-map i det autoritative aggregat.

## 1. Scope og dataklasser

Kontrakten gælder:

- runtime-aggregatet for sagsinput,
- den ene `sessionStorage`-envelope for aktiv sag,
- `.eo` save/load,
- atomiske inputtransaktioner og replacements,
- schema- og adresse-evolution.

AppSettings og uafhængig UI-sessionstate er ikke sagsinput og ligger fortsat under deres egne kontrakter/nøgler.

Sagsinput har to autoritative dele:

1. Zod-validerede canonical sektioner.
2. Zod-validerede rejected inputs med rå tekst og strukturel feltadresse.

Rejected input er afsluttet brugerinput, men ikke canonical domænedata. Det overlever F5 og undo/redo, men skrives
aldrig til `.eo` og må aldrig nå beregning eller dokument-output som en tidligere gyldig værdi.

Afledte issues, beregninger, gates, runtimefejl, åbne drafts og history er ikke sagsdata.

## 2. Én runtime-sandhed og én transaktionsgrænse

Den autoritative runtime-sandhed er ét inputaggregate med én monoton revision. Alle ændringer går gennem én intern
command-runner, herunder:

- settle og immediate commit,
- insert/delete/reorder af rækker,
- reset af sektion,
- replace/clear af sag,
- undo/redo.

For hver reel transaktion gælder:

1. Læs ét før-snapshot.
2. Byg kandidattilstanden med en ren reducer.
3. Valider berørte canonical sektioner med deres Zod-schemas.
4. Valider rejected inputs og adresser mod rejected-schema og feltkatalog.
5. Afvis semantisk no-op uden write, history eller revisionsstigning.
6. Serialisér hele inputenvelopen.
7. Skriv og verificér den ene sessionnøgle.
8. Opdatér aggregate og history i ét observerbart store-write; stig revisionen én gang.

Ved fejl skal storage, aggregate og history stå i før-tilstand. Delvis mutation må aldrig blive observerbar.

Offentlige sektionswrites, særskilte rejected-input-writes og fejlreporter-writes er forbudt som slut-API. Editorlaget
udsteder typed commands; consumers får read-only `InputReader` eller godkendte projektioner.

## 3. Én `sessionStorage`-envelope

Aktiv sagsinput lagres under én namespace-aware Mineo-nøgle:

```ts
type InputEnvelope = Readonly<{
  envelopeVersion: string;
  persistedDataVersion: string;
  input: PersistedInputState;
}>;
```

Envelopen har **ét** current-only format. Der findes ingen `fieldAddressVersion`-bro, sentinel-adresser eller
adresseoversættelse: feltadresser er altid det aktuelle kanoniske strukturelle format, valideret mod kataloget.

Regler:

1. Envelopen og alle underdele er Zod-dækket.
2. `sessionStorage` er durable browsercache, ikke en parallel runtime-sandhed.
3. Hydrering sker én gang før React-render, efter appens namespace er fastlagt.
4. Provider-mount/remount må ikke genhydrere eller overskrive aktiv inputtilstand.
5. En storage-write, som fejler eller ikke kan verificeres, må ikke ændre runtime.
6. Skjult canonical sagsinput bevares, indtil brugeren eksplicit ændrer/sletter det eller en godkendt load/reset erstatter
   det.
7. UI-sessionstate som aktive faner forbliver i egne manifest-ejede nøgler og er ikke del af inputenvelopen.
8. `Slet alt` rydder inputenvelope og den SAGSNÆRE Mineo-ejede UI-sessionstate; fil-load erstatter kun
   sagsinput og ændrer ikke uafhængig UI-sessionstate.

Storage keys ejes af `src/config/storageManifest.ts`. Rename/fjernelse kræver eksplicit migrations- eller rydningspolitik.

### 3.8a Reset-policyen

Reset-policyen er en egenskab ved NØGLEN, ikke ved den use-case der kalder `Slet alt`. Den bor derfor i
manifestet (`SESSION_RESET_POLICY`), hvor hver UI-nøgle er klassificeret som præcis én af:

- **`caseScoped`** — sagsnær tilstand: brugerindtastede hjælpeværdier og filnavns-/filhåndtags-metadata, der
  hører til den sag, der slettes. `Slet alt` SKAL rydde dem; overlever de en bekræftet hel-sags-clear, kan de
  hydrere ind i den næste, tomme sag og påvirke den.
- **`deviceScoped`** — uafhængig UI-præference eller devtools-tilstand, som ikke beskriver sagen. `Slet alt`
  rydder dem bevidst IKKE: §3.7 holder dem uden for inputenvelopen, og en bruger, der sletter sin sag, har
  ikke bedt om at få sidemenuen foldet sammen. Aktive-fane-nøglerne hører her — en fane er en
  navigationsposition, ikke sagsdata.

Klassifikationen er udtømmende og compiler-håndhævet: en ny manifest-nøgle kan ikke undlade at vælge side.

Hele reset-transaktionen (inputenvelope, sagsnær sessionstate, filhåndtag) ejes af `CaseResetOperations`, som
er det ENESTE sted der enumererer policyen. Hver oprydningsgrænses resultat skal kontrolleres, og en
oprydning, der ikke kunne verificeres, rapporteres som en REST i handlingens resultat. `Slet alt` må aldrig
melde fuld succes, når en rest kan bestå.

`Slet alt` afsluttes inde i appen, som fil-load: begge er autoritative hel-sags-replacements gennem samme
grænse og må ikke ende to forskellige steder. En fuld sidegenindlæsning er ikke en lovlig afslutning.

## 4. Bootstrap og current-session-korruption

Gamle interne browser-sessioner migreres **ikke**. Programmet opdateres kun, når ingen brugere er aktive, så der bygges
ingen legacy-sessionreader, per-sektion-nøgle-migration, `invalidDrafts`-oversættelse, adressebro, dual-read eller
kompatibilitetsdialog. Kun `.eo`-fil-load er bagud-/fremadtolerant (§5); det er en separat produktgaranti og må aldrig
bruges som begrundelse for runtime-kompatibilitet.

Bootstrap læser kun den nye, manifest-ejede current-session-nøgle én gang før React-render. Data under pensionerede
browsernøgler læses eller dekodes aldrig og er derfor hverken current-data eller current-korruption. En inkompatibel
envelopeændring kræver en ny nøgle; kun indhold under den aktuelle nøgle klassificeres efter følgende regler:

1. Findes ingen envelope, starter sagen tom.
2. Findes en gyldig envelope, hydreres den.
3. Er den tilstedeværende envelope korrupt (kan ikke parses/valideres mod current-format), håndteres det **fail-closed**
   som dataintegritet, ikke versionskompatibilitet: den rå envelope bevares uændret, alle normale inputwrites blokeres,
   og brugeren får den eksisterende eksplicitte danske systemfejl. Bootstrap må aldrig stiltiende starte tomt og senere
   overskrive den korrupte kilde. Kun brugerens eksplicitte `Slet alt` må fjerne den korrupte kilde og starte en tom sag.

Current-formatets serialiserede feltadresse har én byte-for-byte kanonisk JSON-repræsentation. Alternative
property-rækkefølger, ekstra whitespace og øvrige ækvivalente JSON-varianter accepteres ikke som current keys.

## 5. `.eo` save-garantier

1. `.eo` indeholder alt schema-valideret brugerinput og kun canonical sagsinput.
2. Rejected inputs, åbne drafts, UI-state, device-lokale defaults, issues, history og afledte værdier inkluderes ikke.
3. Skjult canonical input gemmes, medmindre brugeren eksplicit har slettet det.
4. Save må først læse input efter `prepare('save')=committed` fra den kritiske handlingsbarriere.
5. Save-projektionen skal være `ready`: den kræver fravær af rejected input og et schema-gyldigt canonical snapshot,
   men blokeres ikke af afledte issues på canonical værdier.
6. Canonical snapshot valideres med de samme Zod-schemas som load.
7. Artefaktet bygges og verificeres før sink. In-memory download verificeres før browserdownload; en read-back-sink
   verificeres mod de faktisk skrevne bytes.

`.eo`-save-gaten er strukturel: ethvert aktivt relevant rejected input blokerer save globalt og skrives aldrig til
filen. Et afledt rødt range-/bounds-/rule-issue på en ellers schema-gyldig canonical værdi blokerer ikke save; værdien
gemmes uændret. `missing` og warnings blokerer heller aldrig save (se `form-contract.md` §8).

Sektionsschemas validerer canonical syntaks, shape og sikker numerisk repræsentation — ikke feltets fortegn, min/max,
tværfeltsrelationer eller øvrige domæneregler. Sådanne regler afledes som issues fra samme canonical snapshot og må
ikke gøre værdien urepræsenterbar eller få en loadbar sektion droppet.

Al inbound `.eo`-afkodning går gennem én `EoFileCodec`. Save-read-back-verifikation er en separat strikt
integritetskontrol og må ikke blandes med loadens tolerante migrering.

Load- og savekilder/sinks er typede porte med diskriminerede resultater. Egentlige fejl kastes; cancel er et eksplicit
resultat. Højst én filhandling må være aktiv ad gangen. En PWA-loadrequest under en aktiv filhandling må ikke tabes:
seneste request bevares og tilbydes med `Indlæs fil`/`Ignorer`, når den aktive handling er afsluttet.

## 6. Load-garantier

1. Load er atomisk, medmindre brugeren eksplicit accepterer delvis load i preflight.
2. Ingen runtime-, storage- eller history-state muteres før preflight-beslutningen.
3. Ved apply-fejl bevares den aktive sag uændret.
4. Ukendte/fjernede felter og sektioner rapporteres og holdes ude af apply-snapshotet.
5. Manglende nyere felter må ikke alene blokere eller advare; de håndteres med `optional()`, sikker schema-default eller
   eksplicit migrator.
6. En sektion, som ikke sikkert kan parses efter migration/sanitization, droppes som hel sektion og forklares i preflight.
7. Godkendt load oversætter canonical sektioner til gyldige settled felter, har ingen rejected inputs og erstatter hele
   inputaggregaten i én transaktion.
8. Manuel og PWA-initieret load må først starte fil-I/O efter `prepare('load')=committed`.

Den kanoniske rækkefølge er:

1. læs/dekryptér og resolvér kildeversion,
2. normalisér og anvend eventuel eksakt migrator,
3. strip ukendte felter/sektioner,
4. valider hver sektion og byg kandidat,
5. vis preflight og afvent beslutning,
6. replace hele aggregaten atomisk,
7. ryd history ved succesfuld hel-sags-erstatning og udsted ny revision.

Ingen page, hook eller domæneconsumer må omgå rækkefølgen.

## 7. Preflight

Preflight viser mindst:

- forventede/loadbare/fejlende antal,
- brugerrettede årsager per fejl.

Den tilbyder præcis:

- `Indlæs trods fejl`,
- `Send fejloplysninger`,
- `Stop og gør intet`.

`Indlæs trods fejl` erstatter hele sagen med de loadbare sektioner; fejlede sektioner bevares ikke fra den aktive sag.
Dette skal stå tydeligt. `Send fejloplysninger` må kun bruge et lokalt, sanitiseret flow og må aldrig sende brugerdata
ud af browseren. `Stop og gør intet` må ikke mutere noget.

Hvis filen ikke indeholder ét eneste meningsfuldt felt, der kan indlæses, stoppes fail-closed før preflight; en tom
destruktiv erstatning må ikke tilbydes.

## 8. Autoritative replacements og history

- Load og hel-sags-clear, der erstatter hele sagen, er autoritative replacements. Recovery fra en korrupt current-
  session sker kun gennem brugerens eksplicitte `Slet alt` og er samme hel-sags-clear, ikke en migrator.
- Hele kandidataggregaten valideres før apply.
- Rejected inputs erstattes/ryddes som del af samme aggregate, aldrig i en efterfølgende cleanup.
- Afledte issues genberegnes og lagres ikke.
- En succesfuld hel-sags-erstatning rydder history; save påvirker ikke history.
- En side-reset er en almindelig inputtransaktion og kan fortrydes, medmindre en mere specifik produktregel siger andet.
- Hver succesfuld replacement skaber en ny runtime-revision; en gammel revision genbruges ikke.

## 9. Schema- og versionsansvar

`FILE_FORMAT_VERSION`, `PERSISTED_DATA_VERSION` og `InputEnvelope.envelopeVersion` er forskellige:

- filformatversion: container/indpakning,
- persisted dataversion: canonical sektionsschemas og load-semantik,
- envelopeversion: sessionaggregatets struktur.

Der findes **ingen** særskilt feltadresseversion: feltadresser er altid current-formatet. De øvrige versioner bumpes kun
ved ændringer i deres eget ansvar. `.eo`-load-migrationer er eksakte og typed; der gættes aldrig ud fra shape eller
versionssortering. En version uden sikker mapping går til den dokumenterede fail-closed/preflight-sti. En inkompatibel
ændring af de strukturelle feltadresser er ikke en versioneret migration, men en current-session-korruption efter §4,
fordi gamle interne sessioner aldrig migreres.

Der beholdes ikke legacy-runtimekode alene for gamle interne modeller.

## 10. Runtime-read-grænser

Kun inputinfrastrukturen må se aggregate-internals. Den eksponerer:

- editorfacader til typed commands og feltstate,
- read-only `InputReader` til domæne/projektion,
- autoritative replace-porte til persistence-infrastruktur.

Rå sektionsselectors, `FormPersistenceContext` som generel broker og offentlige `persistData`-/`commitInvalidDraft`-
lignende API'er er forbudt i slutarkitekturen. Tværsektion-consumers modtager en navngiven typed projektion, ikke et
vilkårligt aggregate-udsnit.

## 11. Post-apply metadata

Load har to resultater:

1. atomisk apply af sagsinput,
2. efterfølgende synkronisering af filnavn, handle og PWA-metadata.

Fejler fase 1, er intet indlæst. Fejler fase 2 efter en vellykket fase 1, skal UI sige, at sagen er indlæst, men at
filmetadata eller direkte Gem-kobling muligvis ikke er synkroniseret. Det må ikke fremstilles som en rollback af sagen.

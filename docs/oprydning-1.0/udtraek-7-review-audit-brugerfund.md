# Udtræk 7 – review, runtime-input-audit, brugerfund, dependency-update

Kilder: `docs/review/` (seks filer: regulering-taf, taf-fundament, eo-filens-livscyklus, værdiklasse,
kontrolfaner, parallel-redesign), `docs/testing/runtime-input-audit/` (STATUS, CRASHES, OBSERVATIONS,
QUESTIONS, AUDIT-WORKER-ERRORS), `docs/brugerfund-der-skal-rettes.md`, `docs/dependency-update-2026-11-07.md`.
Kun punkter, der mangler eller kun står i kode/kommentar/test, er med på hovedlisten.

## A. Udviklerens afgørelser (UI/UX og beregning) – mangler i kontrakt/domænedokument

A1. **Offentlige ydelsers basisår ved «Beregningsperiode».** Basisåret er altid året for beregningsperiodens
slutdato. Et ansættelsesforholds «Evt. særlig fra-dato for regulering» påvirker aldrig ydelserne, og kortenes
rækkefølge har ingen betydning. Angivet løn bruger den anvendte reguleringsdato.
Kilde: regulering-taf, log 3a. Kun i kommentar: `src/domain/erstatningsopgoerelse/engines/tafNettoBeregning.ts:90`.
Hjem: `docs/domain/taf/tabt-arbejdsfortjeneste.md` §«Regulering før lønnens reguleringsdato» (nyt underafsnit om ydelser).

A2. **Ydelsesdelen nedreguleres også.** Ydelser i en beregningsperiode efter TAF-årene reguleres baglæns med
den årlige satsregulering spejlet fra basisåret. Den baglæns variant er eksplicit; den fælles
`opregulerMedAkkumuleretReguleringssats` beholder reglen «målår ≤ kildeår → ingen regulering» for sine øvrige
brugere (EET/EAL, erhvervsevnetab, TAF opreguleret, validator).
Kilde: log 3 + AP5-faldgruben. Kun i kommentar: `offentligeYdelserUdviklingBeregning.ts:102`.
Hjem: samme afsnit som A1.

A3. **Kronetillæg i lønpakken (forhøjet grundløn, anciennitetstillæg).** Pakkemodellen gælder: tillægget lægges
til løntrinssatsen og virker procentvis gennem forholdet; det lægges aldrig absolut oven i dags- eller
månedslønnen. Beløbet regnes om til pakkens enhed – «Ansættelse» ved offentlig overenskomst,
overenskomstens `grundloenAngivetPer` ved privat; TAF-enheden indgår aldrig. Begge felter har frit valg mellem
Time og Måned på begge flader, også ved angivet løn; enheden gemmes med beløbet og udledes aldrig af et andet
felt. Én omregning (faktor 160,33, `convertAnciennitetSats`), afrundet til øre før brug og vist i bilaget.
«Dag» tilbydes ikke (ville kræve en 7,4-faktor, som strider mod 0,048-faktoren og ikke holder ved deltid).
«Ansættelse» og TAF-enheden kobles ikke med en validering (månedslønnet med «Fuld løn under ferie» = Nej har
TAF i arbejdsdage).
Kilde: log 10, 10a; «Enhedsspørgsmålet». Kun i kommentarer/test: `SatsEnhedChoiceField.tsx`,
`AnciennitetstillaegFields.tsx`, `overenskomstRates.ts:1608ff`, `kronetillaegEnheder.test.ts`.
Hjem: `docs/domain/taf/tabt-arbejdsfortjeneste.md` (nyt § «Kronetillæg i lønpakken») og feltafsnittene i
`src/contracts/input-field-behavior-contract.md`.

A4. **Angivet løn er den samlede løn.** «Månedslønnen udgør»/«Dagslønnen udgør» er den samlede løn på datoen
inkl. alle lønandele, herunder Store Bededagstillæg, hvis det blev udbetalt; programmet lægger intet til.
Bevidst ingen hjælpetekst.
Kilde: log 9c. Mangler helt. Hjem: `src/contracts/indskudte-loentillaeg-contract.md` §2a (nyt pkt.) og
`tabt-arbejdsfortjeneste.md`.

A5. **Kontrolfanerne afvikles.** «EO-kontrol» og «Kontroltabel» fjernes begge. Dagsgrundlaget bevares som
særskilt download på Beregning-siden: knappen «Download dagsgrundlag som CSV-udtræk», filen
`{journalnr} - Dagsgrundlag.csv`, bygget som ren projektion af snapshottet uden egen regelhåndhævelse.
Der bygges ingen facitsager og ingen uafhængig referenceberegning («clean room»); dukker beløbsfejl op, der er
gået gennem alle tests, bygges et målrettet `…IndependentOracle` for området – ikke en fuld referencemotor.
Kilde: kontrolfaner-vurdering, «Afgørelser» + §8. Mangler; `eo-snapshot-contract.md` §6–6.2 beskriver stadig
fanerne som gældende. Hjem: `src/contracts/eo-snapshot-contract.md` §6 (omskrives). Se også C1.

A6. **Windows' Gem-dialog bevares.** Udvikleren har valgt at beholde den, selv om Chromium kan tømme en
eksisterende fil ved overskrivning gennem dialogen, før Mineo får håndtaget; en fejl efter brugerens accept kan
derfor efterlade filen tom. Efter at Chromium har overtaget et fil-/tilladelsesvalg, eller den endelige
skrivning er startet, gentager Mineo aldrig automatisk.
Kilde: eo-filens-livscyklus, opfølgning 2026-11-21. Mangler. Hjem: `src/contracts/persistence-contract.md`
(afsnittet om direkte overskrivning/read-back).

A7. **SFGG ved direkte overenskomstsats: dage før første sats spærrer.** Dage med krav, men uden
overenskomstsats, spærrer med linjen «Dagssats kunne ikke fastsættes for den valgte overenskomst i
TAF-perioden» – også når kun nogle dage mangler.
Kilde: værdiklasse fund C. Kun i kommentar: `sfggResult.ts:65`. Hjem:
`docs/domain/sygeferiegodtgoerelse/sygeferiegodtgoerelse.md` §4.1.

A8. **Årsløn med negative rækker.** En negativ række giver samme gule advarsel som på EO; en samlet negativ
løn spærrer med «Lønnen i tabellen er samlet negativ (… kr.) – kontrollér lønrækkerne».
Kilde: værdiklasse fund E. Kun i kommentar: `aarsloenProjection.ts:391`, `aarsloenBeregning.ts:206`.
Hjem: `src/contracts/aarsloen-contract.md`.

A9. **Indlæste værdier, codec/katalog ikke kan fortolke, bliver røde – ikke tavse.** Ukendt ydelsestype
(«Ukendt ydelsestype «…» – vælg en ydelsestype»), EAL-/ASL-årsløn med øre («Beløbet skal angives i hele
kroner») og EO's måneds-/ugekolonner med fx «1.5» bevares uændret og får rød ring; ingen preflight, ingen
ændret værdi.
Kilde: værdiklasse fund G. Kun i kommentarer: `erstatningsopgoerelseDescriptors.ts:1142`,
`faellesAarsloenDescriptors.ts:31`, `erstatningsopgoerelseLoenDescriptors.ts:481`.
Hjem: `src/contracts/persistence-contract.md` (load-afsnit) med krydshenvisning fra `schema-evolution.md`.

A10. **Heltalsfelt og udtryk med øre.** I et `integerOnly`-beløbsfelt (ASL-/EAL-årsløn) committes et udtryk med
øre («399999,5+0», «1000/3») som det afrundede tal, ligesom en tastet decimal.
Kilde: værdiklasse §5.3. Kun i kommentar: `src/inputCore/fieldCodecs.ts:361`.
Hjem: `src/contracts/amount-contract.md` §3 (integerOnly).

A11. **Små visningsregler med 0/øre.** «(reduceret til max)» trykkes kun, når svie/smerte faktisk er skåret
ned (sammenligning i hele øre); et tidligere modtaget beløb på 0 er intet fradrag og giver hverken «- 0 kr.»
eller «Der er tidligere modtaget 0 kr.»; bilaget «Regulering» viser en anciennitetssats på 0 som
«0,00 kr./måned fra …», ikke «Indtastning mangler».
Kilde: værdiklasse §5.3. Kun i kode/kommentar (`svieSmerteEngine.ts:322`, `eoPresentationSectionBuilders.ts`,
`reguleringSection.ts`). Hjem: `src/contracts/eo-snapshot-contract.md` (svie/smerte-præsentation) og
`docs/domain/taf/tabt-arbejdsfortjeneste.md`.

A12. **Importeret EET-linje på 0 kr.** Hovedopgørelsen beholder linjen; «TAF fordelt på år» udelader den.
Bevidst præsentationsforskel; beløbet dannes samme sted.
Kilde: taf-fundament, «Bevidste forskelle». Ikke fundet. Hjem: `eo-snapshot-contract.md` §10.

A13. **Grafen viser en negativ måned som intet indtægtsniveau.** Et negativt bånd kræver et nyt grafdesign og er
fravalgt; årsfordelingen viser derimod negative år som «+ …»-fradrag (allerede i §10).
Kilde: værdiklasse fund B. Hjem: graf-punkterne i `eo-snapshot-contract.md` (ved udviklerbeslutningerne
2026-10-18).

A14. **Grafens pixel-troskab.** Farver, størrelser og placeringer i TAF-grafen ændres ikke som smagssag; kun
dokumenterede tegnefejl, efter forelæggelse. Delvist dækket («dens udseende bevares»), men uden forbuddet.
Kilde: parallel-redesign #50. Hjem: samme sted som A13.

A15. **Mobil-specifikationsboksen i MinProcesrente er bevidst større.** `SpecifikationDownloadBox` renderes kun,
når `isMobile` er sand (kun standalone); den større knap med beskrivende tekst er bevidst (større trykfelt,
ingen hover-tooltip på mobil). Må ikke ensrettes med Mineos ikonknap.
Kilde: BF-061. Mangler. Hjem: `src/contracts/renteberegning-contract.md` eller `app-shell-contract.md` §5.3.

A16. **EET-afgørelse uden datoer.** En afgørelse markeret som truffet, men uden datoer, oplyses i dokumentet som
truffet; den har ingen referencedato og afgrænser derfor ikke TAF.
Kilde: BF-054. Ikke fundet i kontrakt/domæne. Hjem: `tabt-arbejdsfortjeneste.md` (afgrænsning ved EET).

A17. **Tabeller kun for skader før 2005 er fjernet fra PDF-dokumentationen.** Blandede tabeller med dækning fra
2005 bevares. Må ikke genindføres.
Kilde: BF-024. Ikke fundet. Hjem: `src/contracts/satser-contract.md`.

## B. Varige regler (adfærd, arkitektur, afhængigheder, praksis)

B1. **Reguleringslaget har ingen stille neutral fallback.** Reguleringen slås op pr. dato pr.
ansættelsesforhold (`regulering(d)`), uafhængigt af TAF-arbejdsdage; TAF og SFGG læser samme opslag. Udfaldet er
typed: «reguleret», «ingen regulering» med grund (`ikke-valgt`, `intet-loengrundlag`) eller «uden for dækning» –
aldrig en stille basissats eller tavs 0 %. Lovligt fravalg og tomme valgfrie felter er ikke fejl, derfor ingen
generel AST-regel mod `?? 0`. Kildens dækningsstart forveksles aldrig med brugerens reguleringsdato.
Kilde: regulering-taf, Fælles mønstre + Codex pkt. 1–4, AP2. Kun i kommentar: `reguleringOpslag.ts:11-22`.
Hjem: `docs/architecture/calculation-architecture.md` (nyt afsnit om regulering).

B2. **Kontrol og test må ikke dele det, de kontrollerer.** Beregningsregler og enhedsfejl sikres med håndregnede
facitter, ikke med motorens egen udregning; en kontrol, der bruger samme primitiv som motoren, kan ikke fange
fejl i den. `src/__tests__/AGENTS.md` §2.1 kræver kun «konkrete taleksempler».
Kilde: regulering-taf AP-fælleskrav, kontrolfaner §5.1. Hjem: `src/__tests__/AGENTS.md` §2.1.

B3. **Værdiklasse-skemaet ved ny beregning eller ny inputflade.** Find klassificeringsstederne mekanisk
(`<= 0`, `continue`, `filter`, `?? 0`/`|| 0`, `Math.max(0, …)`, division, afrunding, visning) i den ændrede kæde;
afgør for hvert sted, hvilke værdiklasser (fortegn, nul, tom, under mindste enhed, grænse, datoklasser som
omvendt/én-dags/årsskifte/uden for perioden/overlap) der kan nå dertil fra et felt – «ikke nåbar» kræver en
navngiven grænse – og hvad der sker. Tavs udeladelse eller ændring af en tilladt værdi er et fund; ændrer det et
tal, forelægges det.
Kilde: værdiklasse §2–3, §5.6. Hjem: `src/__tests__/AGENTS.md` (nyt afsnit) eller `docs/vejledninger/`.

B4. **Afrunding fjerner binær regnestøj først.** `rounding.ts` normaliserer til 15 betydende cifre, men kun når
forskellen er under en milliontedel af afrundingsenheden, så store tal bevarer sidste ciffer; det giver decimalt
korrekt halv-op (også floor/ceil). Ellers rundes 64.500 × 82 % op ét trin for meget.
Kilde: værdiklasse fund A. Kun i kommentar: `src/utils/rounding.ts:39`. Hjem: `src/contracts/amount-contract.md` §5.

B5. **Load-migration: en gemt, aldrig læst værdi er ikke brugerens valg.** Har et persisteret felt aldrig været
vist eller læst (fx angivet løns `anciennitetstillaegSatsAngivesPer` med schema-default 'Måned'), overskrives det
ved indlæsning af ældre filer med den værdi, beregningen faktisk brugte. Migrationen styres af eksplicit
kildeversion i `PERSISTED_DATA_VERSION_HISTORY`; mangler versionen, stopper modulet frem for at gætte.
Kilde: regulering-taf AP1-faldgruben. Kun i kommentar: `src/persistence/persistedLoadAdapter.ts:196-260`.
Hjem: `src/contracts/schema-evolution.md`.

B6. **Fil-I/O-detaljer uden kontraktdækning** (efterprøv mod `src/persistence/` ved indarbejdning): filstørrelse
kontrolleres før indholdet læses til fingerprint; standardmappens håndtag og registrering læses samlet, skal
matche det valgte ID, og der faldes tilbage til skrivebordet, når opslag eller passivt tilladelsestjek ikke svarer;
Hent skelner annulleret filvalg fra afbrudt læsning; sene svar fra filåbning/læsning kan aldrig anvende en sag;
Gem verificerer artefaktet før filvalg og sagsrevisionen igen før endelig skrivning. Tidsstempel bruges aldrig som
bevis for ændring – kun indhold.
Kilde: eo-filens-livscyklus (tabel + opfølgning). Hjem: `src/contracts/persistence-contract.md`.

B7. **Bevidst tilbageholdte afhængighedsversioner (grund og løftebetingelse).**
- jsdom 30.x: jsdom 31 vurderer `:focus-visible` som `:focus` (ingen mus/tastatur-skelnen) → ændret MUI-fokus/ripple; løftes når fokusadfærden kan verificeres.
- TypeScript 6.0.3: typescript-eslint understøtter `<6.1.0`, og AST-værnene bruger compiler-API'et, som ændres i 7; løftes samlet med lint og AST-harness. Peer-kontrollen omgås ikke.
- docx præcis 9.7.1: 9.15 ændrer Word-goldens (`w:val="clear"`, gridbredder i «Løbende ydelser (EET)» 100→1377) – kræver særskilt vurdering af Word-layout.
- `@playwright/test` præcis 1.64.1: 1.65 leverer i Firefox `cancel` før `setFiles` i FileChooser-mønstret; produktets filindlæsning ændres ikke for at skjule driverforskellen.
Kilde: dependency-update, «Bevidst tilbageholdt». Kun som versionsnumre i `package.json`.
Hjem: `AGENTS.md` §«Afhængigheder og advisories» (nyt punkt «Fastholdte versioner»).

B8. **Øvrige vedligeholdsregler.** Cloudflares `compatibility_date` er en adfærdsaftale og løftes ikke automatisk
med Wrangler. CI-runneren pinnes eksplicit (`ubuntu-26.04`), ikke `ubuntu-latest`. CI installerer npm fra
`packageManager` før `npm ci`.
Kilde: dependency-update. Ikke fundet i AGENTS/README. Hjem: `AGENTS.md` §Afhængigheder.

B9. **Fravalgte arkitekturretninger – genåbnes ikke uden et konkret problem.** Ingen generisk headless
dropdown-kerne (filstørrelse er ikke grund nok); ingen fælles EO/EET-forligseditor (EET bruger
`forligInputPort`; højst en neutral præsentationsprimitiv); `dateRanges.ts` forbliver ét auditerbart katalog;
EO-sektioner omlægges ikke til bogstavelige `Block[]` – `DocumentComposer` er grænsen; intet generisk feature-VM-lag;
ingen deklarativ `GridSpec`; intet globalt download-register; intet deklarativt settings-register; ingen universel
`carryForwardSeries`/forløbstype for former uden egen serie; IndexedDB key/value og append-only log forbliver
adskilte databaser over fælles transportprimitiv; load fylder aldrig en fil op med app-defaults. Build-asset-
oprydningen er fravalgt af udvikleren; den accepterede restrisiko er, at begge builds deler `public/`, og
standalone-buildets efterbehandling sletter/omskriver variantfiler.
Kilde: parallel-redesign #2, #3, #7, #18, #21, #29, #32, #35, #42, #44, #45, #46. Ikke fundet samlet nogen steder.
Hjem: `docs/architecture/` (fx et afsnit «Fravalgte retninger» i `input-architecture.md` /
`document-output-architecture.md`) eller `AGENTS.md` §Konvergens.

B10. **E2E kan ikke styre native platformdialoger.** Native File System Access-dialoger
(`showSaveFilePicker`/`showOpenFilePicker`), `showDirectoryPicker` og en ægte native launchQueue kan ikke styres
headless; E2E bruger OPFS-handles og erstatter kun vælgerne, og fallback-stien testes efter capability-isolation.
De native kapabilitetstests skipper forventet i Firefox/WebKit.
Kilde: runtime-audit GAP-002/003, eo-filens-livscyklus «Begrænsninger». Hjem: E2E-afsnittet i `AGENTS.md` eller
`src/__tests__/AGENTS.md` §2.7/§9.

## C. Åbne punkter (efterprøvet kort mod koden)

C1. **Afviklingen af kontrolfanerne er besluttet, men ikke udført.** `src/domain/eoInspektion/` (14 filer inkl.
`eoInspektionSammentaelling.ts`) og `EOKontrolTabel.tsx` («Download tabel (CSV-format)») findes; kontrakten
beskriver fanerne. Rækkefølge efter vurderingen: (1) bevarelseslove som snapshot-invarianter – bevar det
eksisterende indeksforholds-check i `eoCanonicalOutput.ts`, tilføj SFGG-total = sum pr. ansættelsesforhold;
(2) CSV som ren snapshotprojektion med kolonnesum-test – afklar restøre ved summering og om CSV må hentes ved
fejl i en anden gren (fx svie/smerte), hvilket i dag er muligt; (3) egenskabstests i runtime-fuzzen (ombytning af
uafhængige rækker, input uden for alle perioder først); (4) fjern `control:sammentaelling_mismatch`, fanerne,
`inspektionSnapshot`, `'inspektion'`-target, linket «Kontroltabel», `inspektionLayerIsolation`; (5) omskriv
§6–6.2; (6) `showEOInspektionMenu` udgår og ignoreres stille i gamle indstillinger. BB-290-beløbsregressionerne
(402.750 kr., fradrag 7.875 kr.) og weekendydelse-testen skal overleve. En bruger med tidligere valgt kontrolfane
skal lande på en gyldig fane.
Kilde: kontrolfaner §6–7, §9. Hjem: opgave + `eo-snapshot-contract.md` §6.

C2. **Sletningen brækker levende afhængigheder.** `docs/brugerfund-der-skal-rettes.md` er både log og udviklerens
indtagsskabelon (næste ID BF-071) og henvises fra `src/contracts/input-field-behavior-contract.md:12` og `:905`
samt `.claude/skills/brugerblik/SKILL.md:120`. `docs/testing/runtime-input-audit/` oprettes og skrives af
`.agents/skills/jette-interaktionsaudit` (`scripts/init-audit-workspace.mjs`, `scripts/record-audit-error.mjs`,
`SKILL.md:24,131`). Afgør: bevar en tom indtagsskabelon/flyt den, og opdatér skills og kontrakthenvisninger.

C3. **Opdeling af to store komponenter er anbefalet, ikke udført.** `AnsaettelsesforholdCard.tsx` (790 linjer) og
`IndtaegtFoerSkadenSection.tsx` (592 linjer): afgrænset opdeling efter ansvar (identitet/status, overenskomst og
satser, SFGG/advarsler; hhv. indtægt-før-skaden og lønudvikling/basisdato), samme VM og `LoenudviklingFields`, ingen
ændret rækkefølge, labels eller fokusflow. Ingen udviklerafgørelse – kandidat, ikke krav.
Kilde: parallel-redesign #1, #22.

C4. **Kendte svagheder uden nåbar virkning (stadig i koden).** `formatKr(Infinity)` giver «0 kr.»
(`formatAsAmount` returnerer kun '' for NaN); `formatDeductionKr(-2000)` giver «- -2.000 kr.»;
`erstatningsopgoerelseValidator.ts:286` tillader forligsprocent 0–100, mens feltet kræver 1–100 (feltets røde
ring spærrer). Hjem: kort kommentar ved funktionerne eller en åben-punkter-liste.

C5. **Dokumentlayout (ikke efterprøvet).** Opgørelsens standardtekst kan i en kort sag efterlade én linje på en
næsten tom side før bilagene; en lang «Beregnes som»-beskrivelse kan støde mod labelen i PDF.
Kilde: regulering-taf, sideobservation.

C6. **WebKit-login under fuld parallel smoke (ustabil).** `Log ind`-klik ventede 120 s én gang under fuld
parallel kørsel; 0/56 i målrettede kørsler. Kun relevant, hvis det dukker op igen.
Kilde: runtime-audit CRASH-002.

## Kodehenvisninger til slettede dokumenter

Direkte stier til `docs/review/…`:

| Sted | Ny varig formulering (erstat henvisningen) |
|---|---|
| `src/components/pages/erstatningsopgoerelse/loenudvikling/AnciennitetstillaegFields.tsx:20-25` | «Satsens enhed vælges ens på begge overflader: enheden gemmes med beløbet og udledes aldrig af «Beregnes ud fra» eller et andet felt. Rækken er derfor én fælles række.» (drop «tidligere»-fortællingen og #1/#22). |
| `src/components/pages/erstatningsopgoerelse/loenudvikling/loenudviklingBinding.ts:77-80` | «Alle tre felter er fælles for begge overflader, også enhedsvalget: enheden er brugerens valg og udledes aldrig af «Beregnes ud fra».» |
| `src/components/pages/erstatningsopgoerelse/loenudvikling/SatsEnhedChoiceField.tsx:11-12` | «… «Dag» tilbydes bevidst ikke: det kræver en faktor mellem dag og time, som programmet ikke har, og som ikke kan kendes ved deltid. Tillægget virker procentvis gennem lønpakken, så pakkens enhed (Time/Måned) er tilstrækkelig.» |
| `src/data/overenskomstRates.ts:1616-1617` | Behold forklaringen (TAF-enheden beskriver tællingen af TAF-grundlaget, ikke satsens enhed; brugt her giver den forkerte reguleringer); fjern «(afklaringslog 10a, docs/review…, fund A1/A2/C5)». |
| `src/domain/erstatningsopgoerelse/engines/regulering/reguleringOpslag.ts:12-18` | «Reguleringsopslag pr. dato.» + behold resten; erstat «Før lå SFGG's regulering … (fund A4)» med «SFGG må ikke afhænge af TAF-segmenterne: et segment uden TAF-arbejdsdage (fx fyldt af løse feriedage) ville ellers give basissatsen uden regulering og uden fejl.» |
| `src/persistence/persistedLoadAdapter.ts:197-199` | «Første persisted-data-version, hvor begge kronetillæg bærer en gemt enhed, som er brugerens eget valg.» |
| `src/persistence/persistedLoadAdapter.ts:253-254` (kun «afklaringslog 12») | «Den ændrede fortolkning af forhøjet grundløn … er godkendt af udvikleren og sker uden preflight eller advarsel ved indlæsning.» |
| `src/schemas/formSchemas/sections/erstatningsopgoerelseSchemas.ts:267-268` | «Enheden, beløbet ovenfor er angivet i. Gemmes med beløbet og udledes aldrig af et andet felt. Ældre filer …» (fjern parentesen). |
| `src/__tests__/domain/erstatningsopgoerelse/kronetillaegEnheder.test.ts:15-16` | «Kronetillæg i offentlig overenskomst regnes i pakkens enhed («Ansættelse»), aldrig i TAF-enheden.» |
| `src/__tests__/utils/persistenceMigrations.test.ts:355` | «Kronetillæggenes enheder i filer fra før 3.15: angivet løns gemte, aldrig læste anciennitetsenhed overskrives med den enhed, beregningen tvang; forhøjet grundløn får «Ansættelse»-enheden.» |

Øvrige henvisninger, der bliver døde ved sletningen (samme behandling – fjern markøren, behold begrundelsen):

- «afklaringslog 10a/12» uden sti: `useEoOplysningerViewModel.ts:227`; `overenskomstOffentligSegmenter.ts:48` («fund A1, afklaringslog 10a» → slet parentesen); tests `persistenceVersionDrift.test.ts:85`, `overenskomstRates.test.ts:1075`, `reguleringWordContent.test.ts:81`, `angivetLoenHelpers.test.ts:52`, `eoPdfModel.test.ts:1285`, `overenskomstReguleringShared.test.ts:114`, `reguleringSection.test.ts:233` – alle til «pakkens enhed er «Ansættelse»; TAF-enheden indgår ikke» / «enheden er brugerens valg».
- «afklaringslog 8a»: `sfggSegmentering.ts:461`, `:490`, `sfggWarnings.ts:70`, `docs/domain/sygeferiegodtgoerelse/sygeferiegodtgoerelse.md:569` → «De manuelle reguleringsformer har ingen værdier før reguleringsdatoen; en ældre referenceperiode regnes med reguleringsdatoens niveau.»
- «afklaringslog 9b»: `src/contracts/indskudte-loentillaeg-contract.md:46`, `:87` → fjern markøren; reglen står allerede.
- «AP2»: `loenudviklingBeregning.ts:134` → «… og reguleringsopslaget pr. dato, som TAF-segmenterne er bygget af …».
- «værdiklasse-gennemgangen 2026-11-24, fund X, godkendt …»: `aarsloenBeregning.ts:206`, `aarsloenProjection.ts:391`, `eetSnapshot.ts:431`, `sfggResult.ts:65`, `svieSmerteEngine.ts:322`, `indtaegtPerioder.ts:657`, `erstatningsopgoerelseDescriptors.ts:1144`, `erstatningsopgoerelseLoenDescriptors.ts:483`, `faellesAarsloenDescriptors.ts:33`, `fieldCodecs.ts:361`, `rounding.ts:39`, tests `fieldSignPolicy.contract.test.tsx:151`, `rounding.test.ts:63` → slet parentesen; begrundelsen står allerede i sætningen («ellers tæller rækken ikke med uden besked» osv.). Ved «godkendt af udvikleren» skrives evt. «udviklerens afgørelse».
- Q-001 (runtime-audit): `src/__tests__/components/pages/erstatningsopgoerelse/loentrinFinderTrigger.keyboard.test.tsx:146` → «`keyboard-navigation.md` §Popup-fokus-restore: Escape returnerer fokus til «Find løntrin».»
- Kontrakthenvisninger til `docs/brugerfund-der-skal-rettes.md`: `input-field-behavior-contract.md:12`, `:905` (se C2).

## Optælling

Kandidater i alt: ca. 85. Allerede dækket: ca. 52 (bl.a. log 1, 2, 4, 5, 6, 7, 8, 8a–8d, 9, 9a, 9b, 9d, 11; KL-nulbasis;
C1/C4-visning; hele taf-fundament undtagen A12; værdiklasse B, D, F; eo-filens konflikt-/fingerprint-/read-back-/
klientscope-/legacy-regler; BF-065, BF-047, BF-059, BF-060, BF-062, BF-063, BF-066, BF-068, BF-052, BF-038/056;
npm-allowlist, `npm.cmd`, overrides-praksis, `.stryker-tmp`). Hovedlisten: A 17, B 10, C 6 = 33.
Udeladt som ikke-varigt: audit-sessionslog, worker-fejllog (løst i skillen), verifikationstal, fund-statusser.

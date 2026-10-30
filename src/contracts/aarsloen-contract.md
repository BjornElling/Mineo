# Mineo - Årsløn domænekontrakt

**Status:** Normativ og gældende
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `amount-contract.md` og `periodisering-contract.md`.  
**Senest verificeret mod kode:** 2026-10-30

---

## 1. Nuværende Model (autoritativ)

Årsløn er et persisted domæne med sektionen `aarsloen`.

**Autoritativ beregningskilde:** `buildAarsloenReaderProjection` i `src/domain/aarsloen/aarsloenProjection.ts` samler reader-læste værdier, tabelvalidation, omregningsgate, beregning og dokumentstamdata fra én `InputReader`-revision. `src/domain/aarsloen/aarsloenCalculations.ts` (`beregnMetode`, `beregnOmregnetAarsloen`) er den kanoniske beregningskilde for årsløn; periodevisning ejes af `aarsloenPeriodDisplay.ts` og validering af `aarsloenValidationPolicies.ts` + `src/domain/policies/aarsloenPolicy.ts`. Ingen parallel beregningssti må indføres.

---

## 2. Kanoniske Regler

1. Beregning må kun bruge en `ready` projektion af `aarsloen` og autoriseret `stamdata` fra samme `InputReader`-revision.
2. Dagtælling og årslønsomregning følger den kategori, der er defineret i `periodisering-contract.md`.
3. Beløb og afrunding følger `amount-contract.md`.
4. Dokumentgaten skal være en typed dokumentdefinition med strukturelle dependencies og må ikke afhænge af rendererens
   interne fejl, lokale feltbooleans eller rå sektionslæsning.
5. Et felts synlighed og dets neutralisering i beregningen udledes af **samme** relevans-prædikat (ét sandt sted) i `src/domain/policies/aarsloenPolicy.ts` – fx `erAarsloenFerieFelterRelevant`, der fodrer både `shouldShowAarsloenFerieFields` (UI) og den kanoniske beregning. Sidekomponenter må ikke gen-introducere inline synligheds-betingelser på felter, hvis relevans ejes af et prædikat. Jf. `form-contract.md` §7.
6. En tabelrække med komplet periode og uden noget beløb er en blokerende `missing_amount`-fejl på første
   beløbscelle. Rækken må ikke aktivere helårsomregning eller passere dokumentgaten.
7. SH-dage-dokumentet sammenlægger overlappende/sammenhængende perioder og skriver `Periode`/`Perioder` efter
   det sammenlagte antal. Flere perioder formateres med den fælles danske listehelper og `og` før sidste led.

---

## 2a. Persisteret model og load-tolerance

`aarsloenSchema` (`src/schemas/formSchemas/sections/aarsloenSchemas.ts`) er eneste sandhedskilde for sektionens persisterede form. For at en ældre `.eo` uden et felt ikke fejler hele sektionen (jf. `persistence-contract.md` forward/backward-tolerant load), bærer de påkrævede felter faste schema-defaults, der matcher det en ny, tom sag starter med:

- `loenperiode` → `'maaned'`, `tillaegAngivesSom` → `'procent'`, `tableData` → `[]`, `omregningTilFuldtAar` → `false`, `fuldLoenUnderFerie` → `true`, `retTilSjetteFerieuge` → `true`, `loenPaaHelligdage` → `'Almindelig løn'`.
- Procentfelterne (`feriePct`, `fritvalgPct`, `shSoPct`, `storeBededagPct`, `pensionPct`) og `antalFeriedage` er optional; manglende værdi forbliver `undefined`. `feriePct` er dog påkrævet efter den fælles regel med erstatningsopgørelsen (`feriepenge-begreber-contract.md` §2c): uden fuld løn under ferie er et tomt felt en blokerende mangel uden rød ring, og beregningen vises ikke.
- `tillaegAngivesSom` bestemmer, hvordan lønindkomst-tillæg angives: `'procent'` lader programmet beregne FP/FV/SH/SO- og Arb.g. Pension-beløbene ud fra satserne, mens `'beloeb'` lader brugeren angive beløbene direkte i tabelrækkernes `fpFvShSoBeloeb`/`pensionBeloeb`-felter. De to tilstande er ligestillede; kun den aktive tilstands input fodrer beregning og dokumenter – den fravalgte tilstands persisterede input bevares, men ignoreres (samme relevans-princip som §2-regel 5). At gøre `tillaegAngivesSom` default-bærende og tilføje de to nye række-felter blev bogført som et `PERSISTED_DATA_VERSION`-bump; den aktuelle version står i `src/config/persistenceVersion.ts`.

`loenperiode`-defaulten er **bevidst statisk** og ikke settings-styret: en ny sag sætter feltet fra `defaultLoenIndtastesSom` via `createAarsloenInitialValues`, men schema-defaulten rammer kun load af en fil hvor feltet helt mangler – og `persistence-contract.md` forbyder at injicere device-lokale app-settings under load. At gøre felterne default-bærende ændrer schema-fingerprintet (input-optional) og er bogført som `PERSISTED_DATA_VERSION`-bump.

---

## 2b. Overenskomst som tillægsgrundlag

Årslønnens «Tillæg beregnes på baggrund af» har valgene Procent, Beløb og Overenskomst. EO beholder sit eksisterende valg mellem Procent og Beløb.

Siden er delt i bokse (brugerblik BB-347/BB-348, udviklerafgørelse 2026-10-27): **Lønforhold** (tillægsgrundlag, overenskomstvælger, Reguleringsdato med info-ikon, i Overenskomst Fuld løn under ferie og Løn på helligdage, Store Bededag-tilvalget), **Satser** (de fem procentfelter; skjult i Beløb), **Indtægtsoplysninger** (Løn indtastes som lige over tabellen), Beregningsprincipper, **Fejl og advarsler** og Beregning. Fuld løn under ferie og Løn på helligdage vises kun, når de læses – altid i Overenskomst, ellers kun ved aktiv omregning – efter prædikatet `erAarsloenLoenforholdValgRelevante` i `aarsloenPolicy.ts`, som også styrer ferie-/SH-advarslerne (§2-regel 5; BB-353/BB-354).

**Siden udfyldes oppefra og ned** (udviklerafgørelse 2026-10-27): et valg eller en indtastning må kun ændre, hvad der vises *længere nede* – aldrig få en ny række til at dukke op ovenfor. Derfor står Fuld løn under ferie og Løn på helligdage dér, hvor de læses: i Overenskomst i Lønforhold (satsopslaget), ellers i Beregningsprincipper under omregningen, lige over de felter, de styrer (`loenforholdValgPlacering` i viewmodellen). Placeringen afhænger kun af tillægsgrundlaget, sidens første valg. Kan en række ikke placeres efter princippet, vises den hellere altid end betinget af noget nedenfor.

I Overenskomst vises samme organisationsfiltre og overenskomstvælger som på Lønindkomst samt en særskilt Reguleringsdato. `domain/loen/overenskomstSatser.ts` ejer fælles satsbindinger, dækning og tooltiptekster. Årsløn anvender den valgte datos satser på **alle** lønrækker, også før datoen og ved satsskift i perioden. Der periodiseres ikke, og der gives ikke advarsel om lønrækker før overenskomstens dækning. Manglende overenskomst/dato, ugyldig dato og privat overenskomst uden satser på datoen spærrer beregning og dokument. Årslønsdokumentets satsafsnit angiver overenskomsten og satsdatoen (`resolveAarsloenSatsKilde`, BB-355).

Feriegodtgørelse/-tillæg indtastes altid manuelt. Fritvalg, SH/SO og arbejdsgiverpension fastsættes og låses af overenskomsten; ved offentlige tillæg uden sats forbliver feltet manuelt som på Lønindkomst. Indtil både overenskomst og en gyldig dato kendes, står de tre felter låste og tomme med en tooltip om det, der mangler (BB-349/BB-351); dækningsteksten bruges kun ved en dato før overenskomstens første satser. `resolveAarsloenSatsBindings` i `aarsloenTillaeg.ts` er det ene sted for låsningen, descriptor-relevansen og projektionen. Helligdagsvalget indgår i det fælles satsopslag, herunder tilpasning af både SH/SO og fritvalg.

Store Bededagstillæg har i Overenskomst samme til-/fravalg som på Lønindkomst. Valget vises kun ved Almindelig løn på helligdage, og satsen udledes af den valgte reguleringsdato og tilvalget gennem den eksisterende fælles regel: 0,45 % fra 1. januar 2024, ellers 0 %; uden gyldig dato er satsen ukendt og vises tom, ikke 0 % (BB-349). Ved fravalg fra 2024 genbruges Lønindkomsts ikke-blokerende advarsel. Nye sager starter med tilvalget slået til. Procent- og Beløb-tilstandenes eksisterende adfærd ændres ikke.

Årslønnens eksisterende ferie-/SH-advarsler vurderes også uden helårsomregning i Overenskomst. Advarsler om 6. ferieuge vises fortsat kun ved aktiv omregning, hvor valget er synligt. En SH/SO-sats, overenskomsten selv har fastsat og låst, vurderes ikke (BB-352). En feriesats over 20 % får i Procent og Overenskomst samme gule ring og tekst som på Lønindkomst – også i tidligere gemte sager (udviklerafgørelse 2026-10-27); EO’s beregningstekniske minimum på 12 % gælder ikke årsløn.

**Fejl og advarsler** (BB-350): boksen er magen til de øvrige siders og samler ALLE blokerende fejl og mangler – feltfejl med feltets navn, «Overenskomst mangler»/«Reguleringsdato mangler», lønrækkernes cellefejl, en kritisk beregningsfejl og et afbrudt dokument – efterfulgt af advarslerne. Hver række linker til feltet eller cellen. Ved felterne er der kun rød ring og tooltip, ingen tekst. Rækkerne bygges i `aarsloenIssueRows.ts`.

Automatiske satser udledes kun i `readAarsloenValues`; de skrives ikke tilbage i inputaggregatet. Tidligere manuelt input bevares ved tilstandsskift og i save/load. Den fælles løntabel og dokumentgenerator modtager det afledte satsæt med normaliseret Procent-tilstand, så ingen parallel beregningsmotor indføres.

Version 3.17 tilføjer årslønnens eget tillægsgrundlag samt optional `overenskomstId`, `overenskomstLoenmodtager`, `overenskomstArbejdsgiver`, `reguleringsdato` og `beregnStoreBededagstillaeg`. Udviklerbeslutning 2026-10-27: tidligere gemte sager bevarer alle hidtidige værdier uden ny advarsel; de nye felter er tomme. Den eksplicitte historiske load-policy indsætter kun `undefined`, aldrig lokale indstillinger eller automatiske satser.

---

## 3. Arkitekturvalg: ikke snapshot-first (bevidst)

Årsløn er **bevidst ikke** snapshot-first. Den ready inputprojektion og section-lokale engine-/calculations-model i §1
er slutarkitekturen, ikke et mellemtrin mod et snapshot.

Begrundelse: snapshot-first findes for at eliminere parallelle, inkonsistente beregningsveje mellem UI, tab og PDF (jf. `snapshot-contract.md §1`). Det problem findes ikke her. Årsløns engine-resultat bygges ét sted i `buildAarsloenReaderProjection`, og PDF-stien **genbruger** det allerede beregnede `beregningsData` – den genberegner ikke domæneafledninger. Der er derfor hverken duplikering eller grænse-smerte at retfærdiggøre et snapshot-lag for, jf. konvergensreglen i `AGENTS.md` (ingen abstraktioner til hypotetisk fremtidig genbrug). Et snapshot-lag her ville tilføje vægt uden at fjerne en risiko.

Beslutningen er truffet endeligt og er ikke et udestående. Snapshot-first er forbeholdt de tre tunge domæner (EO/EET/forsørgertab), jf. `snapshot-contract.md §6`.

---

## 4. Minimumstestflade

Tests skal dække:

1. tabelafledninger fra ready, afsluttede rækkeinput,
2. SH-/hverdagsregler,
3. dokumentgate ved missing, invalid, range/bounds og regelissues,
4. at dokument og UI bruger samme beregnede `beregningsData` uden genberegning.

---

## 5. Feriepenge-begreberne

De kanoniske regler for feriegodtgørelse, ferietillæg og fællesbetegnelsen 'feriepenge' er **ikke
årslønsspecifikke** – de samme formuleringer bruges i erstatningsopgørelsen (lønindkomst pr.
ansættelsesforhold, sygeferiegodtgørelse) og i begge fladers dokumenter. Reglerne står derfor i den
tværgående `feriepenge-begreber-contract.md` og gælder hele programmet.

Konsekvens her: satsfeltet hedder «Feriegodtgørelse/-tillæg», fordi det rummer begge ydelser. Sidens
advarselstekster om dets sats bruger feltets eget navn og kommer fra `beregnFejlmeddelelser`
(`aarsloenValidationPolicies.ts`) samt den fælles `resolveHoejFeriePctAdvarsel` – ikke som løs prosa i sidekomponenterne.

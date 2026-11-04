# Mineo - Feriepenge-begreber

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Sideordnet de øvrige tværgående kontrakter. Begrænser enhver domænekontrakt, der producerer
brugervendt tekst om ferieydelser – herunder `aarsloen-contract.md` og erstatningsopgørelsens kontrakter.
**Senest verificeret mod kode:** 2026-11-04 (§2d: satsen afgør ydelsen; §2b–2c: grænser og både-og)

---

## 1. Scope

Kontrakten fastlægger **sprogbrugen** om ferieydelser i al brugervendt tekst: feltlabels, advarsler,
tooltips, fejlbeskeder, rækketekster i «Fejl og advarsler» og genererede PDF/Word-dokumenter.

Den gælder **hele programmet**, ikke én flade. Feriepenge-formuleringer optræder mindst i:

- **Årsløn** – satsfeltet og sidens advarsler,
- **Erstatningsopgørelsen** – lønindkomst pr. ansættelsesforhold og sygeferiegodtgørelse,
- de **dokumenter**, begge flader producerer.

Kontrakten regulerer primært **ord**. Den ændrer ingen beregning; hvilke procentsatser der faktisk anvendes, ejes af
beregningsdomænerne. Men fordi den indtastede sats afgør, hvilken ydelse der er tale om (§2d), fastlægger den også
de valideringsregler, der holder satsen og «Fuld løn under ferie» i overensstemmelse med hinanden (§2b–2c).

---

## 2. Normative regler

Udviklerbeslutning 2026-08-26.

1. **En lønmodtagers løn tillægges enten a) feriegodtgørelse eller b) ferietillæg. Aldrig begge.**
2. **Hvad der udløser hvad:** Får lønmodtageren løn under ferie, får vedkommende **ferietillæg**. Ellers
   får vedkommende **feriegodtgørelse**.
3. **Beregningsteknisk omregning:** Til tider skal et ferietillæg beregningsteknisk opgøres som
   feriegodtgørelse. Da omregnes **1 % ferietillæg** til:
   - **12,5 % feriegodtgørelse** uden ret til 6. ferieuge,
   - **15 % feriegodtgørelse** med ret til 6. ferieuge.

   Ved **forhøjet ferietillæg** (mere end 1 %) lægges forhøjelsen oven i. Kommunalt ansatte har typisk et
   forhøjet ferietillæg på 1,95 %, svarende til **16,95 % feriegodtgørelse**. Andre satser forekommer.
4. **'Feriepenge' er en sproglig fællesnævner** for den formelle RET til en af de to ydelser, og bruges
   kun dér, hvor det potentielt kan være den ene eller den anden. **Om selve procentsatsen bruges altid
   den konkrete ydelses korrekte navn** – aldrig fællesbetegnelsen.

### 2a. Konsekvens for satsfeltet

Feltet hedder overalt **«Feriegodtgørelse/-tillæg»**, netop fordi det rummer begge ydelser (regel 1–2). Labelen
skifter ikke med indtastningen – det gælder også den manuelle lønudviklingstabels kolonne af samme sats.

Al **anden** brugervendt tekst om en indtastet sats – advarsler, fejl, rækketekster, tabeloverskrifter og
dokumenter – navngiver ydelsen efter satsen (§2d): «Ferietillæg på 1 %», «Feriegodtgørelse: 12,5 %». Kun hvor der
ingen sats er at navngive efter (et tomt felt: «Feriegodtgørelse/-tillæg er ikke udfyldt»), eller hvor en kolonne
rummer satser af begge slags, bruges feltets generiske navn.

Ordene **«feriepengesats»** og **«feriegodtgørelsessats»** må ikke bruges om dette felts sats.

### 2b. Krav og grænser på erstatningsopgørelsens satsfelt (udviklerbeslutning 2026-10-06, 2026-11-04)

Gælder «Feriegodtgørelse/-tillæg» på et ansættelsesforhold under Lønindkomst og samme sats i den manuelle
lønudviklingstabel («Manuelt angivet»), som er satsen fra en senere dato
(`src/domain/erstatningsopgoerelse/validation/loenindkomstSatsAssessment.ts`, `vurderEoFeriesats`):

1. **Påkrævet, når kortet har lønoplysninger i procent-tilstand** – uanset beregningsmåde og reguleringsform.
   Lønrækkernes tillæg, fradraget for indtægt efter skaden og beregningsgrundlaget læser feltet i alle former,
   og efter regel 1 får en lønmodtager altid en af de to ydelser (BB-274).
2. **Et tomt felt er en manglende indtastning**: ingen rød ring (brugeren har ikke skrevet noget), men en
   blokerende linje i «Fejl og advarsler» – «Feriegodtgørelse/-tillæg er ikke udfyldt».
3. **Tvungen både-og.** Erstatningsopgørelsen opgør TAF med satsen som feriegodtgørelse også ved løn under ferie
   (regel 3). Et **ferietillæg** (under 12 %) er derfor næsten altid en fejl, men ikke altid:
   - ved løn under ferie – eller når «Fuld løn under ferie» ikke stilles (andet end beregningsperiode) – giver det
     en **gul, ikke-blokerende** ring og linje med vejledningen efter regel 3;
   - har brugeren svaret **Nej** til «Fuld løn under ferie», siger satsen og svaret hinanden imod, og det er en
     **rød, blokerende** feltfejl.
4. **Over 20 %** giver en gul, ikke-blokerende ring og linje: «Feriegodtgørelse over 20 % er usædvanligt –
   kontrollér satsen» (BB-286).
5. **Over 25 %** er feltets egen røde grænse: «Feriegodtgørelse kan ikke overstige 25 %».
6. I beløb-tilstand er procentfeltet skjult og hverken påkrævet eller markeret. Den manuelle tabels basisrække er da
   brugerens egen indtastning og vurderes; i procent-tilstand er den en låst kopi af ansættelsesforholdets felt.

### 2c. Ét krav for begge lønflader (udviklerbeslutning 2026-10-30, M-37; 2026-11-04)

Om satsen er påkrævet, afgøres ÉT sted for både Årsløn og erstatningsopgørelsens ansættelsesforhold:
`erFeriePctPaakraevet` i `src/domain/loen/feriePctKrav.ts`. De to flader skal følges ad, så en ændret forudsætning ændres
begge steder. Satsen er påkrævet, når

1. satserne er i brug (tillæggene angives i procent, ikke som beløb),
2. løntabellen har indtastede beløb (`hasIndtastetLoenoplysninger`, `src/domain/standardLoen/loenoplysningerInput.ts`), og
3. satsen OPGØRES som feriegodtgørelse.

Led 3 er den eneste bevidste forskel og gives som argument. Erstatningsopgørelsen opgør altid satsen som feriegodtgørelse
(regel 3), så dér er kravet ubetinget. Årsløn regner med den faktiske ydelse: ved «Fuld løn under ferie» er satsen
ferietillægget, og feltet må stå tomt. Er valget skjult, tæller det som sin standardværdi (fuld løn). Manglen meldes
ens på begge flader – uden rød ring – med `FERIE_PCT_MANGLER_BESKED` («Feriegodtgørelse/-tillæg er ikke udfyldt») og
blokerer.

Den tvungne både-og (§2b pkt. 3) gælder **kun** erstatningsopgørelsen. På Årsløn er en **feriegodtgørelse** (12 % og
derover) sammen med «Fuld løn under ferie» = Ja en **rød, blokerende** feltfejl på satsen, når valget vises
(`resolveAarsloenFeriegodtgoerelseVedFuldLoenIssue` i `aarsloenProjection.ts`): lagt oven i en løn, der dækker ferien,
bliver årslønnen ca. 11,5 % for høj. Et ferietillæg uden fuld løn under ferie er fortsat en advarselslinje. Grænserne
over 20 % (gul) og over 25 % (rød) er de samme som i §2b.

### 2d. Satsen afgør ydelsen (udviklerbeslutning 2026-11-04)

Én skillelinje i hele programmet (`src/domain/loen/feriePctYdelse.ts`, `FERIEGODTGOERELSE_MIN_PCT`):

- **under 12 %** er satsen et **ferietillæg** – 1 %, eller et forhøjet ferietillæg (typisk op til ca. 3 %);
- **12 % og derover** er satsen **feriegodtgørelse** – 12 %, 12,5 % eller 15 % ved ret til 6. ferieuge, evt. med et
  forhøjet ferietillæg lagt oven i. Feriegodtgørelse er næppe over 20 % og aldrig over 25 %.

`ferieYdelseNavn` giver navnet til al tekst efter §2a; `resolveFaellesFerieYdelse` afgør en kolonnes overskrift
(reguleringsværdiernes «Feriegodtg.»/«Ferietill.», generisk «Feriegodtg./-till.» ved blandede satser).

---

## 3. Autoritative kilder

- **Feltnavnet** ejes af descriptor-katalogerne, som begge flader binder sig til:
  `src/inputCore/catalog/aarsloenDescriptors.ts` og
  `src/inputCore/catalog/erstatningsopgoerelseLoenDescriptors.ts`.
- **Årsløns advarselstekster** dannes ét sted: `beregnFejlmeddelelser` i
  `src/domain/aarsloen/aarsloenValidationPolicies.ts`. Sidekomponenterne renderer dem og formulerer dem
  ikke – en tekst, der er hardkodet i en komponent, står uden om både den kanoniske
  procentformattering og relevans-gatingen.
- **Procentformattering** følger den kanoniske `formatPercent` i `src/utils/formatUtils.ts`.

---

## 4. Testkobling

- `src/__tests__/domain/loen/loenSatsAdvarsler.test.ts` – hævder §2d: skillelinjen ved 12 %, navnene og den
  fælles ydelse for en kolonne, samt grænserne 20 % og 25 %.
- `src/__tests__/domain/aarsloen/aarsloenValidationPolicies.test.ts` – hævder, at Årsløns
  advarselstekster navngiver ydelsen efter satsen med den kanoniske procentformattering.
- `src/__tests__/domain/aarsloen/aarsloenOverenskomst.test.ts` – hævder §2c's røde både-og på Årsløn, at et skjult
  valg ikke vurderes, og grænsen over 25 %.
- `src/__tests__/domain/erstatningsopgoerelse/loenindkomstSatsAssessment.test.ts` – hævder §2b pkt. 3: et ferietillæg
  er gult ved løn under ferie og rødt ved svaret Nej, og et skjult valg gør det aldrig rødt.
- `src/__tests__/domain/erstatningsopgoerelse/manualRegulationIssues.test.ts` – hævder samme regler for den manuelle
  lønudviklingstabels feriesats.
- `src/__tests__/domain/loen/feriePctKrav.test.ts` – hævder §2c: erstatningsopgørelsens krav er den fælles regel, og
  begge flader skriver samme linje. `src/__tests__/domain/aarsloen/aarsloenProjection.test.ts` hævder Årsløns tilstande.
- `src/__tests__/domain/erstatningsopgoerelse/reguleringsPresentation.test.ts` – hævder
  reguleringstabellernes kolonneoverskrift for feriesatsen efter rækkernes ydelse.

---

## 5. Kendte undtagelser

**Sygeferiegodtgørelse (SFGG).** `docs/domain/sygeferiegodtgoerelse/sygeferiegodtgoerelse.md` og
SFGG-motorerne bruger «feriepengesats» om den **lovbestemte** sats på 12,5 %, som altid anvendes uanset
hvad brugeren har indtastet for lønindkomsten. Her er ordet korrekt efter regel 4: teksten omtaler den
generelle ret og ikke ét felts indtastede sats.

*Risiko:* lav – ordet står i domænedokumentation og kodekommentarer, ikke i feltnær brugertekst.
*Re-evaluering:* hvis en SFGG-tekst en dag skal navngive et felts sats, gælder regel 4's hovedregel.

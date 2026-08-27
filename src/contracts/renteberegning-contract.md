# Mineo - Renteberegning domænekontrakt

**Status:** Normativ og gældende
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md`, `date-contract.md` og `amount-contract.md`.  
**Senest verificeret mod kode:** 2026-08-27 (§Regel 12's fire afgrænsninger er tilføjet samme dag og
verificeret som gældende adfærd: `createRenteberegningInitialValues` sætter `beregningsdato: undefined`,
kommentarfeltet er fladens ene felt, 7 %-rækken står ligeværdigt, og telefonopstillingen har ét
datofelt. §Regel 8's uforanderlige halvårsinddeling og §Regel 11's
lovhenvisninger er tilføjet efter udviklerens afgørelse samme dag; halvårsguarden i
`src/data/interestRates.ts` er mutationstestet i begge grene. §Regel 9–10 er nye og verificeret mod
`procesrenteCalculator.ts`: tillægssatsen slås op på rentedatoen og genbruges for alle perioder,
referencesatsen slås op pr. halvårsstart. Beregningen er uændret; de brugervendte tekster, der sagde
«forfaldsdato», er rettet til «rentedato». §Regel 7's paste-afgrænsning blev verificeret 2026-08-11:
`maxDraftLength` håndhæves også ved paste, og integrationstesten «afgrænser et indsat trecifret tal
som ved tastning» måler at et paste af `987` giver `98` uden fejltilstand)

---

## 1. Nuværende Model (autoritativ)

Renteberegning er et persisted domæne med sektionen `renteberegning`.

**Autoritativ beregningskilde:** `src/domain/renteberegning/renteberegningEngine.ts` (`computeRenteberegning`, `computeRentekravRow`) og `src/domain/renteberegning/procesrenteCalculator.ts` (`calculateProcessInterestWithRates`, `calculateProcessInterestBreakdownWithRates`) er de kanoniske beregningskilder; renteprincipper ejes af `renteCalculationPrinciples.ts`. Domænet har aktuelt et tabel-/context-drevet flow oven på disse motorer. Det er den bindende nuværende model: rente-PDF må ikke afhænge af implicit tabelcontext uden eksplicit gate, og ingen anden rente-beregningssti må indføres.

---

## 2. Kanoniske Regler

1. Renteberegning må kun bruge en `ready`, `EvaluationSourceToken`-bundet inputprojektion fra `InputReader`, og kun via de
   autoritative moduler i §1. Rå canonical sektioner er ikke en tilladt engine-/gate-adgang.
2. Dato- og dagtælling følger `date-contract.md`.
3. Beløb og afrunding følger `amount-contract.md`, medmindre rentedomænet får en mere specifik dokumenteret regel.
4. Dokument-download og nulstilling ("Slet alle indtastninger") kræver eksplicitte, auditerbare gates fra afsluttet
   input, ikke implicit tabelcontext. Hvert rentedokument definerer sine dependencies: fælles `beregningsdato` samt
   felterne i den eller de inkluderede rækker. Den fælles projektion resolver rejected, missing, range/bounds og
   regelissues; et manuelt global/row-scope eller lokale `hasError`-booleans er ikke tilladt. Dermed blokerer en
   ugyldig celle automatisk sin per-række-download og aggregater, der inkluderer rækken, men ikke andre uafhængige
   per-række-dokumenter. Nulstillings-gaten udledes af samme afsluttede inputmodel, men er ikke en dokumentgate.
5. Renderer-fejl må ikke være primær gate for ugyldigt brugerinput.
6. En rentekravsrække med kun valgt tillægstidsenhed er semantisk tom og udgør selv tabellens ene trailing
   indtastningsrække. Enhedsvalget må ikke i sig selv skabe en ekstra synlig række.
7. `Evt. tillægstid` har den synlige heltalsform 0–99 og rummer højst to cifre. Feltet blokerer effektivt det
   tredje ciffer: det kommer ikke ind i feltet, hverken ved tastning eller paste. Paste behandles præcis som
   tastning, så et paste af `100` giver samme resultat som at taste `100`, nemlig at det sidste ciffer aldrig
   når feltet. Den afkortning er det forventede resultat af feltets længdegrænse og er ikke skjult truncering
   af en værdi, feltet kunne have rummet. En værdi, der derimod ligger inden for de to cifre, men uden for
   0–99, bliver canonical ved settle og får det afledte bounds-issue, som blokerer afhængige consumers. Samme
   bounds-regel er autoritativ ved load, hvor en trecifret værdi fra fil ikke er en tastning og derfor
   committes canonical med sit røde bounds-issue frem for at blive afkortet.
8. Hvert kalenderår er opdelt i to halvår: 1. januar–30. juni og 1. juli–31. december. **Halvårsgrænserne
   er uforanderlige og udledes ikke af data.** Referencesatsen ER den officielle udlånsrente, som
   Nationalbanken har fastsat pr. 1. januar og pr. 1. juli det pågældende år (rentelovens § 5, stk. 1,
   2. pkt.), så inddelingen kan ikke ændre sig. Domænet må derfor ikke indrettes til en anden kadence:
   en referencesats med en anden ikrafttrædelsesdato end `01-01` eller `01-07`, eller et manglende
   halvår i serien, er en **datafejl** og ikke en ny periodeinddeling. `src/data/interestRates.ts`
   fail-closer på begge ved modul-load, fordi begge ellers er tavst forkerte: motoren skærer kun ved
   30. juni og 31. december, og et manglende halvår ville få satsopslaget til at videreføre forrige
   halvårs sats. En referencesats
   fastsættes på halvårets første dag og gælder til halvårets sidste dag. Hvis beregningsdatoen ligger efter
   udgangen af det senest dækkede halvår, bruger motoren den senest kendte referencesats og dokumentet viser
   en tydelig advarsel med denne halvårsudgang. Datoen for satsens ikrafttræden er ikke i sig selv en
   advarselsgrænse. Denne fail-soft-regel er den autoritative beregningsmetode; fremtidige satser må ikke
   gættes eller indføres som en skjult særregel, og beregningen må ikke blokeres alene fordi datoen ligger
   fremme i tid.
9. **Terminologi (bindende, brugervendt).** Domænet har præcis to datobegreber pr. rentekrav:
   **«Forfaldsdato»** er kravets forfaldsdato, som brugeren indtaster, og **«Rentedato»** er
   forfaldsdato + eventuel tillægstid. Er der ingen tillægstid, er de to datoer ens. Rentedatoen er
   den dato, renten løber fra, og den er derfor det afgørende begreb i beregningen; forfaldsdatoen er
   alene det beregningstekniske udgangspunkt for at fastsætte rentedatoen. Ordet «Forfaldsdato» må
   ikke bruges om andet end kravets egen forfaldsdato: en sats' ikrafttræden heder **«Gælder fra»**,
   og ordet «Rentedato» må ikke bruges som overskrift over en sats' ikrafttræden. Reglen gælder
   labels, kolonneoverskrifter, tooltips, fejlbeskeder, beregningsforudsætninger og
   dokumentkolonner – både i Mineo og i standalone MinProcesrente.
10. **Satsvalg (bindende beregningsregel).** Den samlede rentesats er referencesats + tillægssats, og
    de to satser vælges på hver sin måde:
    - **Referencesatsen er periodisk.** Den læses på hvert halvårs første dag inde i beregningen, så
      et krav, der løber hen over et halvårsskifte, regnes med den sats, hvert halvår havde.
    - **Tillægssatsen er fastlåst pr. krav.** Den vælges én gang ud fra den enkelte rækkes
      **rentedato** og ændres ikke undervejs i beregningen. Ligger rentedatoen før `01-03-2013`,
      anvendes 7 % for hele kravet – også for perioder efter `01-03-2013`. Forfaldsdatoen er aldrig
      nøglen til tillægssatsen.
    Al brugervendt tekst, der navngiver en dato som grundlag for en sats, skal navngive den dato,
    reglen ovenfor faktisk bruger. En sammenlagt «procesrente»-visning pr. dato er derfor ikke
    tilladt: den ville være forkert for krav med rentedato før `01-03-2013` og periode efter.
11. **Lovhenvisninger for de to satser (udviklerens afgørelse 2026-08-25).** Begge satser har hjemmel i
    rentelovens **§ 5, stk. 1**, som lyder: «Renten efter forfaldsdagen fastsættes til en årlig rente,
    der svarer til den fastsatte referencesats med et tillæg på 8 pct. Som referencesats anses i denne
    lov den officielle udlånsrente, som Nationalbanken har fastsat henholdsvis pr. den 1. januar og den
    1. juli det pågældende år.» Tillægget på 8 pct. står i **stk. 1** (1. pkt.), og definitionen af
    referencesatsen i **stk. 1, 2. pkt.** Satsfanens to sætninger skal henvise dertil – ikke til
    stk. 2, som er hjemlen til at ændre satsen og hverken fastsætter tillægget eller referencesatsen.
12. **Fire bevidste afgrænsninger af fladens omfang (udviklerens afgørelser 2026-08-25).** Alle fire er
    afgjort som «uændret» og står her, fordi hver af dem ellers ser ud som en oplagt forbedring.
    Ændr dem ikke uden en ny afgørelse:
    - **Beregningsdato forudfyldes ikke.** Feltet er tomt, når fladen åbnes – i både Mineo og
      standalone MinProcesrente; brugeren udfylder selv eller bruger «Indsæt dags dato». En urørt sag
      må ikke bære en værdi, brugeren ikke selv har skrevet: ellers er «Slet alle indtastninger» aktiv
      fra begyndelsen, og `Gem` har noget at gemme, som ikke er brugerens indtastning.
      `createRenteberegningInitialValues` sætter derfor `beregningsdato: undefined`.
    - **Ét kommentarfelt pr. flade.** Kommentaren hører til fladen og trykkes generelt på alle
      specifikationer. En rentelinje får ikke sit eget kommentarfelt, heller ikke selv om
      rækkespecifikationerne i Mineo hentes enkeltvis til hver sin modpart.
    - **Tillægssatsens historiske 7 %-række vises ligeværdigt** med den gældende 8 %-sats og skal
      blive ved med det. Rækken må ikke rykkes ned, gøres mindre fremtrædende eller sættes under en
      «overgangsregel»-overskrift.
    - **Standalones telefonopstilling har bevidst kun ét datofelt.** «Evt. tillægstid», «Enhed» og
      «Rentedato» findes kun i desktopopstillingen, fordi der ikke er plads til dem på en telefon –
      heller ikke vandret. På telefon lægges forfaldsdatoen derfor direkte til grund for renten
      (rentedato = forfaldsdato). Enhedslåsen gør opstillingen fast, så en skjult tillægstid ikke kan
      regne med i det viste tal.

---

## 3. Arkitekturvalg: ikke snapshot-first (bevidst)

Renteberegning er **bevidst ikke** snapshot-first. Den tabel-/engine-drevne model i §1 er den valgte slutarkitektur.
Domænet bruger en `EvaluationSourceToken`-bundet `InputProjection` foran motoren; den er en inputintegritetsgrænse, ikke et
beregningssnapshot.

Begrundelse: hver rentekravsrække beregnes idempotent af `computeRentekravRow`, og dokumentstien genbruger rækkens
beregnede context fra samme ready-projektion. Inputprojectionen bygger kun engine-input, når dokumentets/consumerens
strukturelle dependencies er anvendelige. Et yderligere snapshot ville ikke fjerne en parallel beregningssti.

Ved dokumentklik kører critical-action-preflight først. Derefter bygges projektionen fra en frisk `InputReader`; kun
ready-grenens `EvaluationSourceToken` må nå dokumentservicen. Servicen kontrollerer hele tokenet efter lazy-load og
umiddelbart før generatoren og afviser fail-closed ved input- eller settingsdrift.

Beslutningen er truffet endeligt og er ikke et udestående. Snapshot-first er forbeholdt de tre tunge domæner (EO/EET/forsørgertab), jf. `snapshot-contract.md §6`.

---

## 4. Minimumstestflade

Tests skal dække:

1. dagtælling for grænseperioder,
2. renteperioder og afrunding,
3. dokumentgate ved både manglende input, rejected/invalid format og canonical range/bounds-fejl,
4. at både den reaktive knap og click-preflight blokerer før generator og fil-I/O for hver af fejlklasserne i punkt 3,
5. at PDF og Word har samme gate,
6. at dokument-output bruger samme rækkeberegnede `pdfContext` som UI (dokumentet genberegner ikke renteperioder),
7. at satsvalget følger §2.10: tillægssatsen er den samme i alle perioder for et krav, hvis rentedato
   ligger før `01-03-2013`, også når perioden løber ind i tiden efter, mens referencesatsen skifter ved
   halvårsskiftet inde i samme beregning,
8. at referencesatsserien er en ubrudt kæde af halvår med ikrafttræden kun `01-01`/`01-07` (§2.8) –
   både som datapåstand og som modul-load-fail-close.

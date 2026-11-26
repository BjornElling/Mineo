# Fund – gruppe G1

Dokumenter: `input-field-behavior-contract.md` (IFB), `mineo-field-pattern.md` (MFP), `form-contract.md` (FC),
`keyboard-navigation.md` (KN). Alle fire er efterprøvet afsnit for afsnit, rettet og stemplet 2026-11-26.

De to kendte drift-kandidater er bekræftet og rettet (koden har ret):
- IFB §1.0a (nu §1.6): et valg i en dropdown, der ikke kan være tom, gør aldrig alene en række udfyldt – heller ikke
  et ikke-default valg (`isAslAfgoerelseRowEmpty`, `RENTEKRAV_CONTENT_KEYS` udelader `enhed`).
- IFB §4.6: «Indsæt dags dato» uden for grænsen er inaktiv med tooltip (`resolveInsertTodayDisabledReason`) på Varige
  mén, Erhvervsevnetab, Forsørgertab og Renteberegning; EO's knap er undtaget. Generel regel nu i IFB §2.1.

Øvrige væsentlige rettelser mod koden: méngrad-eksemplet (nu uden «1–120»), decimalkommaet tilladt i alle beløbs- og
procentfelter med afrunding ved settle (IFB §1.2/§2.2/§2.3, FC §8.3), tekstfelter trimmes altid ved settle, tekstlængde-
kategorien bilagsnumre 12, skadedatogrænsen ved erhvervssygdom (anmeldelsesdato minus 5 år), brøk over 1 og procent 0
er canonical røde fejl (ikke formatfejl), synlige toggle-etiketter i IFB §4.12–4.15, klagetogglen vises ved mindst én
EET-afgørelse, tom paste er no-op også i Ydelse/Tillæg, issue-årsagerne i FC §10, transiente felter bruger ikke
`FieldCodec`/felt-editoren (MFP §3), `InputCatalog` er ikke «forseglet», `Container`-navigationen bor i
`containerNavigation/`, `Ctrl+S` er eneste *genvej* (ikke eneste tastaturvej) til filhandlingerne, Enter på en knap uden
opt-in flytter til første mål, brudte §-henvisninger (KN §1.4/§1.7/«ovenfor»/«§Editor åben», FC §1.9 og «§7 i
mineo-field-pattern», IFB §1.6).

## (a) Behandlede rapportpunkter

- udtraek-1/A1: indarbejdet i IFB §4.1.
- udtraek-1/A4: indarbejdet i IFB §4.6a.
- udtraek-1/A6: indarbejdet i IFB §4.15 («Verserende klagesag over EET-afgørelse?»).
- udtraek-1/A9: indarbejdet i IFB §2.5.
- udtraek-1/A17: indarbejdet i IFB §8 (Find løntrin); fokusdelen står i KN §Overlay note: Løntrin-finder.
- udtraek-1/A19: indarbejdet i IFB §3.6.
- udtraek-1/A26: division med 0 indarbejdet i IFB §2.2 (ordret tooltip). Delen «en udfyldt, rød værdi meldes ikke også
  som manglende» overladt til `error-contract.md` (G3); for øvrige krav står den i IFB §6.
- udtraek-1/A29: forkastet for G1 – bilags-, graf- og bekræftelsestekster hører til `document-output-contract.md`/
  `eo-snapshot-contract.md` §13 (G2/G3); EET-kildeskiftets tekst kunne ikke genfindes som én streng.
- udtraek-1/A32: indarbejdet i IFB §1.2a (afvist varsel ved tavst fjernet fortegn/punktum) og FC §8.2 (typografiske
  minustegn; henviser til §1.2a). Afgrænsning: FC §8.2 ejer fortegnspolitikken, IFB §1.2a paste-reglen.
- udtraek-1/A35: indarbejdet i IFB §3.6, §8 og FC §12.
- udtraek-1/A44: dropdown-princippet indarbejdet i IFB §1.6; «begge dubletrækker markeres» er EET-specifikt og hører
  til `eet-snapshot-contract.md` (G2, jf. udtraek-2/A23).
- udtraek-1/A54: indarbejdet i KN §Tab / Shift+Tab (tab-ringen og sidemenuen).
- udtraek-1/A56: indarbejdet i KN §Globale genveje (følgeregel om Ctrl+Z i åbent felt).
- udtraek-1/A60: indarbejdet i IFB §1.3.
- udtraek-1/A67: indarbejdet i IFB §2.1 og §4.6.
- udtraek-1/A70: indarbejdet i FC §7 punkt 3 (programdækkende ordlyd og komprimeringsundtagelsen).
- udtraek-1/B1: indarbejdet i FC §7 punkt 3.
- udtraek-1/B5: indarbejdet i FC §9.
- udtraek-1/B11: indarbejdet i IFB §1.2 (`keyFilterFromAdmission`).
- udtraek-1/C12 (testkoblingen for `resolveInsertTodayDisabledReason`): indarbejdet i IFB §9. Den anden del står i (c).
- udtraek-2/A2: indarbejdet i IFB §1.6.
- udtraek-2/A5: overladt til `amount-contract.md` (G3) – reglen om 0 kr. er en beløbsregel, ikke en formularregel.
- udtraek-2/A11: indarbejdet i FC §9.
- udtraek-2/A19: indarbejdet i IFB §2.3 (eneste felt med 0 = tom).
- udtraek-2/A49: indarbejdet i IFB §2.1.
- udtraek-2/C2: afklaret – efterprøvet for alle collections med tomhedsregel (ASL-afgørelser, rentekrav, løn- og
  EO-rækker, ydelser); koden følger reglen overalt. Indarbejdet i IFB §1.6.
- udtraek-3/A1: indarbejdet i IFB §4.1.
- udtraek-3/A3: indarbejdet i IFB §4.8.
- udtraek-3/A4: indarbejdet i IFB §4.18.
- udtraek-3/A5: indarbejdet i IFB §4.17.
- udtraek-3/A6: indarbejdet i IFB §4.17.
- udtraek-3/A7: indarbejdet i IFB §4 (skadedatogrænsen) og §4.4.
- udtraek-3/A9: indarbejdet i IFB §4.19 og §2.5 (kategorien 12 tegn).
- udtraek-3/A10: kort indarbejdet i IFB §2.1; grænseteksternes ordlyd (`maxBoundKind: 'dagsDato'`) overladt til
  `date-contract.md` (G3).
- udtraek-3/A16–A18: indarbejdet i IFB §6 (nyt afsnit om øvrige erstatningskrav).
- udtraek-3/A20: indarbejdet i IFB §4.15.
- udtraek-3/A21: indarbejdet i IFB §4.16.
- udtraek-3/A36: overladt til `eo-snapshot-contract.md` §14 (G2), første foreslåede hjem; IFB beskriver ikke
  beregningsgrundlagets felter.
- udtraek-3/A37: indarbejdet i IFB §1.2a (afvist ønske) med henvisning fra FC §8.2.
- udtraek-3/B3: indarbejdet i MFP §2 Lag A (label = synligt navn, tilgængeligt navn og fejltekst); «»-konventionen i
  beskeder overladt til `error-contract.md` §3 (G3).
- udtraek-4/A8: indarbejdet i FC §7 punkt 5 («Løn indtastes som» på Årsløn og EO, uden dialog).
- udtraek-4/A9: overladt til `schema-evolution.md` (G4) – den godkendte load-ændring er kernen.
- udtraek-4/A14: indarbejdet i FC §8.1 (pladsholder med enhed). Ingen-autoudfyldning overladt til
  `eo-snapshot-contract.md` §15 (G2).
- udtraek-4/A22: indarbejdet i IFB §8 og KN §Overlay note: Løntrin-finder.
- udtraek-4/A26: forkastet for G1 – en designvurdering pr. felt, ikke en feltregel; hører til
  `page-component-contract.md` (G5).
- udtraek-4/A27: indarbejdet i IFB §3.6.
- udtraek-4/B7: indarbejdet i FC §9.
- udtraek-4/B8: indarbejdet i IFB §3.6, §8 og FC §12.
- udtraek-5/A1: indarbejdet i KN §Tab / Shift+Tab.
- udtraek-5/A11: indarbejdet i FC §9 (henviser til `undo-redo-contract.md` §1 for persistensen).
- udtraek-5/A19: indarbejdet i IFB §2.1.
- udtraek-5/A27: indarbejdet i IFB §7.
- udtraek-5/A28: indarbejdet i IFB §7.
- udtraek-5/B3: indarbejdet i IFB §2.1.
- udtraek-5/B5: overladt til `page-component-contract.md` (G5), første foreslåede hjem (styling af
  `.text-action-button`).
- udtraek-6/A12: indarbejdet i IFB §6.
- udtraek-6/A22: indarbejdet i IFB §2.2 (fortegn) og FC §8.2.
- udtraek-7/A3: forkastet for IFB – kronetillæggenes enhed er en TAF-domæneregel (`tabt-arbejdsfortjeneste.md`, G7);
  IFB har ingen feltafsnit for lønudvikling.
- udtraek-7/C2: henvisningerne til `docs/brugerfund-der-skal-rettes.md` er fjernet fra IFB (indledning og kildeafsnit).
- udtraek-7/Q-001: KN §Popup-fokus-restore findes fortsat under samme navn; testkommentaren kan pege derhen.

## Afslutning (hovedagenten, 2026-11-26)

Alle punkter i (b) og (c) er lukket i arbejdsstykke 3:
- b1: forelagt; udvikleren valgte tre cifre. `DAGANTAL_MAX_DIGITS = digitsRequiredFor(366)` på de tre felter;
  IFB §2.8 nævner dem; e2e-matrixen taster nu `367`.
- c1: forelagt; udvikleren valgte `0,00` overalt. `PercentField` vælger pladsholder efter decimalpolitikken som
  grid-cellen, `DerivedPercentField` viser `0,00`; de håndskrevne `placeholder="0"` er fjernet; FC §8.1/§8.3.
- c2 + c4: forelagt; udvikleren valgte «én Escape = én ting». `Overlay` ignorerer Escape ved `defaultPrevented`
  eller åbent overlay; den døde Tab-ring-markør er fjernet; KN §Escape og to nye tests i `Overlay.test.tsx`.
- c3: forelagt; de korte navne er bevidste. Undtagelsen står i MFP §Lag A.
- c5: lukket uden ændring af adfærd – den nedre grænse kan aldrig ligge efter dags dato; begrundelsen står i IFB
  §2.1.
- c6: tests for redo under overlay og for undo/redo med åben editor tilføjet i `useUndoRedoShortcuts.test.tsx`; KN
  henviser til dem.
- c7: kommentarerne i `signPolicy.ts` og `AmountField.tsx` rettet; samtidig fjernet historik i `Overlay.tsx`,
  `gridCells.tsx` og `BeregnetRenteTable.tsx`.

## (b) Konflikter kode ↔ udviklerafgørelse (forelægges)

1. **Tre dagfelter tager imod fire cifre, selv om de højst må være 366.** Gælder «Løse ferie-/feriefridage» og «Antal
   fraværsdage (mandag-fredag)» i beregningsgrundlaget samt «Ferie- og fraværsdage uden løn i referenceperioden».
   - I dag kan brugeren taste fx `1000`. Feltet bliver rødt med «Antal dage skal være mellem 0 og 366».
   - Udviklerens afgørelse (IFB §2.8) er, at cifferloftet følger feltets maksimum: med maksimum 366 skulle det fjerde
     ciffer slet ikke kunne tastes, som i «Méngrad» (højst 120, tre cifre).
   - Koden giver felterne det faste loft på 4 cifre for felter uden maksimum (`UNBOUNDED_DAY_COUNT_MAX_DIGITS` i
     `erstatningsopgoerelseDescriptors.ts`, `integerField`). Kontrakten er ikke ændret.

## (c) Uafklarede tvivlstilfælde

1. **Pladsholderen i procentfelter på formularer.** En tom procentcelle i en tabel viser `0,00`, men et procentfelt med
   decimaler på en formular viser `0` (`PercentField` bruger altid `DEFAULT_PERCENT_PLACEHOLDER`). Det fremgår ikke, om
   formularens `0` er tilsigtet; FC §8.1/§8.3 beskriver nu kun tabelcellens valg.
2. **Én Escape kan lukke to ting.** Står den røde fejlboks (efter et mislykket Gem/Hent) fremme, og trykker brugeren
   Escape i et åbent felt eller i en åben bekræftelsesdialog, lukker samme tryk både fejlboksen og annullerer
   feltet/lukker dialogen. `Overlay.tsx` lytter ubetinget på `document`, og formularfeltets Escape stopper ikke
   propagation. KN siger «én Escape = én handling». Uklart, om fejlboksen skal vente, til intet andet har Escape.
3. **Toggle-etiketter på EO oplysninger.** Descriptorernes labels («Varige mén-afgørelse», «Midlertidigt
   EET-afgørelse», «Endeligt EET-afgørelse», «Verserende klage (mén/EET)») afviger fra skærmens tekster. Det
   tilgængelige navn kommer fra skærmteksten via `labelledBy`, så skærmlæseren er korrekt; men MFP siger, at
   descriptorens label er feltets synlige navn. Uklart, om labels skal ensrettes, eller om toggles er en undtagelse.
4. **Fejlboksens lukkeknap.** Knappen bærer opt-in-markøren til Tab-ringen, men står uden for `Container`, så markøren
   ingen virkning har. KN siger ikke, om knappen skal kunne nås med Tab.
5. **Nedre grænse for «Indsæt dags dato» på Varige mén og Erhvervsevnetab.** Kun den øvre grænse afprøves.
   Udtrækket kalder udfaldet «sikkert», men det er ikke dokumenteret, at en nedre grænse aldrig kan ligge efter dags
   dato.
6. **Testdækning af genveje.** Reglen om, at undo/redo og `Ctrl+S` er uvirksomme under et åbent overlay, er kun
   testet for undo og `Ctrl+S`; redo (`Ctrl+Y`/`Ctrl+Shift+Z`) og stien med åben editor har ingen test. KN påstår nu
   kun det, der er testet.
7. **Forældede kodekommentarer (til kommentaroprydningen):** `signPolicy.ts:25` siger «paste bevarer et indsat minus»
   (paste springer det over), og `AmountField.tsx:22–23` siger, at et heltalscodec ikke tager imod komma (det gør det
   og afrunder).
